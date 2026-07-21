"use strict";
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["query"] });

const testUser = {
  userId: 0,
  username: "testuser",
};

function mockIronSession() {
  const ironSession = require("iron-session");
  jest.spyOn(ironSession, "getIronSession").mockReturnValue({
    user: { login: testUser.username, id: testUser.userId },
    save: jest.fn(),
    destroy: jest.fn(),
  });
}

// テストで作成したデータを削除
async function deleteMemoryAggregate(memoryId) {
  const { deleteMemoryAggregate } = require("./routes/schedules");
  await deleteMemoryAggregate(memoryId);
}

// フォームからリクエストを送信する
async function sendFormRequest(app, path, body) {
  return app.request(path, {
    method: "POST",
    body: new URLSearchParams(body),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      'Origin': 'http://localhost:3000',
    },
  });
}

// JSON を含んだリクエストを送信する
async function sendJsonRequest(app, path, body) {
  return app.request(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
    },
  });
}

describe("/login", () => {
  beforeAll(() => {
    mockIronSession();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("ログインのためのリンクが含まれる", async () => {
    const app = require("./app");
    const res = await app.request("/login");
    expect(res.headers.get("Content-Type")).toBe("text/html; charset=UTF-8");
    expect(await res.text()).toMatch(/<a href="\/auth\/github"/);
    expect(res.status).toBe(200);
  });

  test("ログイン時はユーザ名が表示される", async () => {
    const app = require("./app");
    const res = await app.request("/login");
    expect(await res.text()).toMatch(/testuser/);
    expect(res.status).toBe(200);
  });
});

describe("/logout", () => {
  test("ログアウト時に / へリダイレクトされる", async () => {
    const app = require("./app");
    const res = await app.request("/logout");
    expect(res.headers.get("Location")).toBe("/");
    expect(res.status).toBe(302);
  });
});

describe("/memories", () => {
  let memoryId = "";
  beforeAll(() => {
    mockIronSession();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await deleteMemoryAggregate(memoryId);
  });

  test("日記が作成でき、表示される", async () => {
    await prisma.user.upsert({
      where: { userId: testUser.userId },
      create: testUser,
      update: testUser,
    });

    const app = require("./app");

    const postRes = await sendFormRequest(app, "/memories", {
      memoryName: "テスト日記1",
      diary: "テスト内容1\r\nテスト内容2",
    });

    const createdMemoryPath = postRes.headers.get("Location");
    expect(createdMemoryPath).toMatch(/memories/);
    expect(postRes.status).toBe(302);

    memoryId = createdMemoryPath.split("/memories/")[1];

    const res = await app.request(createdMemoryPath);
    const body = await res.text();
    expect(body).toMatch(/テスト日記1/);
    expect(body).toMatch(/テスト内容1/);
    expect(body).toMatch(/テスト内容2/);
    expect(res.status).toBe(200);
  });
});

describe("/memories/:memoryId/users/:userId/comments", () => {
  let memoryId = "";
  beforeAll(() => {
    mockIronSession();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await deleteMemoryAggregate(memoryId);
  });

  test("コメントが更新できる", async () => {
    await prisma.user.upsert({
      where: { userId: testUser.userId },
      create: testUser,
      update: testUser,
    });

    const app = require("./app");

    const postRes = await sendFormRequest(app, "/memories", {
      memoryName: "テストコメント更新日記1",
      diary: "テストコメント更新内容1",
    });

    const createdMemoryPath = postRes.headers.get("Location");
    memoryId = createdMemoryPath.split("/memories/")[1];

    const res = await sendJsonRequest(
      app,
      `/memories/${memoryId}/users/${testUser.userId}/comments`,
      {
        comment: "testcomment",
      },
    );

    expect(await res.json()).toEqual({ status: "OK", comment: "testcomment" });

    const comments = await prisma.comment.findMany({ where: { memoryId } });
    expect(comments.length).toBe(1);
    expect(comments[0].comment).toBe("testcomment");
  });
});

describe("/memories/:memoryId/update", () => {
  let memoryId = "";
  beforeAll(() => {
    mockIronSession();
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await deleteMemoryAggregate(memoryId);
  });

  test("日記が更新できる", async () => {
    await prisma.user.upsert({
      where: { userId: testUser.userId },
      create: testUser,
      update: testUser,
    });

    const app = require("./app");

    const postRes = await sendFormRequest(app, "/memories", {
      memoryName: "テスト更新日記1",
      diary: "テスト更新内容1",
    });

    const createdMemoryPath = postRes.headers.get("Location");
    memoryId = createdMemoryPath.split("/memories/")[1];

    const res = await sendFormRequest(app, `/memories/${memoryId}/update`, {
      memoryName: "テスト更新日記2",
      diary: "テスト更新内容2",
    });

    const memory = await prisma.memory.findUnique({
      where: { memoryId },
    });
    expect(memory.memoryName).toBe("テスト更新日記2");
    expect(memory.diary).toBe("テスト更新内容2");
  });
});

describe("/memories/:memoryId/delete", () => {
  beforeAll(() => {
    mockIronSession();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("日記に関連する全ての情報が削除できる", async () => {
    await prisma.user.upsert({
      where: { userId: testUser.userId },
      create: testUser,
      update: testUser,
    });

    const app = require("./app");

    const postRes = await sendFormRequest(app, "/memories", {
      memoryName: "テスト削除日記1",
      diary: "テスト削除内容1",
    });

    const createdMemoryPath = postRes.headers.get("Location");
    const memoryId = createdMemoryPath.split("/memories/")[1];

    await sendJsonRequest(
      app,
      `/memories/${memoryId}/users/${testUser.userId}`,
    );

    // コメント作成
    await sendJsonRequest(
      app,
      `/memories/${memoryId}/users/${testUser.userId}/comments`,
      {
        comment: "testcomment",
      },
    );

    // 削除
    const res = await sendFormRequest(app, `/memories/${memoryId}/delete`, {});
    expect(res.status).toBe(302);

    // テスト
    const comments = await prisma.comment.findMany({ where: { memoryId } });
    expect(comments.length).toBe(0);

    const memory = await prisma.memory.findUnique({
      where: { memoryId },
    });
    expect(memory).toBeNull();
  });
});