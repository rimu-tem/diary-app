const { Hono } = require('hono');
const { html } = require('hono/html');
const layout = require('../layout');
const ensureAuthenticated = require('../middlewares/ensure-authenticated');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: ['query'] });
const { z } = require('zod');
const { zValidator } = require('@hono/zod-validator');
const { HTTPException } = require('hono/http-exception');
const { defaultIsContentTypeBinary } = require('hono/aws-lambda');

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');


const app = new Hono();

app.use(ensureAuthenticated());

const memoryIdValidator = zValidator(
  'param',
  z.object({
    memoryId: z.string().uuid(),
  }),
  (result) => {
    if (!result.success) {
      throw new HTTPException(400, { message: 'URL の形式が正しくありません。' });
    }
  }
);

const memoryFormValidator = zValidator(
  'form',
  z.object({
    memoryName: z.string(),
    diary: z.string(),
  }),
  (result) => {
    if (!result.success) {
      throw new HTTPException(400, { message: '入力された情報が不十分または正しくありません' });
    }
  }
);

app.get('/new', (c) => {
  return c.html(
    layout(
      c,
      '日記の作成',
      html`
        <form method="post" action="/memories" class="my-3">
          <div class="mb-3">
            <label class="form-label">題名</label>
            <input type="text" name="memoryName" class="form-control" />
          </div>
          <div class="mb-3">
            <label class="form-label">日記</label>
            <textarea name="diary" class="form-control"></textarea>
          </div>
          <button class="btn btn-primary" type="submit">保存</button>
        </form>
      `,
    ),
  );
});

app.post('/', async (c) => {
  const { user } = c.get('session') ?? {};
  const body = await c.req.parseBody();
  //console.log(user.id);

  // 予定を登録
  const memory = await prisma.memory.create({
    data: {
      memoryId: randomUUID(),
      memoryName: body.memoryName.slice(0, 255) || '（名称未設定）',
      diary: body.diary,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user.id,
    },
  });

  // 作成した予定のページにリダイレクト
  return c.redirect('/memories/' + memory.memoryId);
});

app.get('/:memoryId', memoryIdValidator, async (c) => {
  const { user } = c.get('session') ?? {};
  const memory = await prisma.memory.findUnique({
    where: { memoryId: c.req.valid('param').memoryId },
    include: {
      user: {
        select: {
          userId: true,
          username: true,
        },
      },
    },
  });

  if (!memory) {
    return c.notFound();
  }


  // 閲覧ユーザと、出欠を登録したユーザ情報を格納するための Map を作る。
  const userMap = new Map(); // key: userId, value: { userId, username }
  const viewerUserId = user.id;
  userMap.set(viewerUserId, { userId: viewerUserId, username: user.login });

  const users = Array.from(userMap.values());

  // コメント取得
  const comments = await prisma.comment.findMany({
    where: { memoryId: memory.memoryId },
  });
  const commentMap = new Map(); // key: userId, value: comment
  comments.forEach((comment) => {
    commentMap.set(comment.userId, comment.comment);
  });
  const whois = user.login;

  return c.html(
    layout(
      c,
      `予定: ${memory.memoryName}`,
      html`
        <div class="card my-3">
          <h4 class="card-header">${memory.memoryName}</h4>
          <div class="card-body">
            <p style="white-space: pre;">${memory.diary}</p>
          </div>
          <div class="card-footer">
            作成者: ${memory.user.username}
          </div>
        </div>
        ${isMine(user.id, memory)
          ? html`
              <div class="mb-3">
                <a
                  href="/memories/${memory.memoryId}/edit"
                  class="btn btn-primary"
                >
                  この予定を編集する <i class="bi bi-pencil"></i>
                </a>
              </div>`
          : ''}
            <div class="mb-3">
              <h5>コメント</h5>
            </div>
              ${users.map((user) => {
                const comment = commentMap.get(user.userId);
                return html`
                  <div class="mb-3">
                    <p>${whois}：
                      <small id="${user.userId === viewerUserId ? "self-comment" : ""}"> 
                        ${comment}
                      </small>
                    </p>
                  </div>
                  ${user.userId === viewerUserId
                    ? html`
                        <button
                          data-memory-id="${memory.memoryId}"
                          data-user-id="${user.userId}"
                          id="self-comment-button"
                          class="btn btn-info"
                        >
                          編集
                        </button>`
                    : ''}
                `;
              })}
      `,
    ),
  );
});



function isMine(userId, memory) {
  return memory && parseInt(memory.createdBy, 10) === parseInt(userId, 10);
}

app.get('/:memoryId/edit', memoryIdValidator, async (c) => {
  const { user } = c.get('session') ?? {};
  const memory = await prisma.memory.findUnique({
    where: { memoryId: c.req.valid('param').memoryId },
  });
  if (!isMine(user.id, memory)) {
    return c.notFound();
  }

  return c.html(
    layout(
      c,
      `予定の編集: ${memory.memoryName}`,
      html`
        <form
          class="my-3"
          method="post"
          action="/memories/${memory.memoryId}/update"
        >
          <div class="mb-3">
            <label class="form-label">題名</label>
            <input
              type="text"
              name="memoryName"
              class="form-control"
              value="${memory.memoryName}"
            />
          </div>
          <div class="mb-3">
            <label class="form-label">日記</label>
            <textarea name="diary" class="form-control">${memory.diary}</textarea>
          </div>
            <button type="submit" class="btn btn-primary">
            以上の内容で予定を編集する <i class="bi bi-pencil"></i>
          </button>
        </form>
        <h3 class="my-3">危険な変更</h3>
        <form method="post" action="/memories/${memory.memoryId}/delete">
          <button type="submit" class="btn btn-danger">
            この予定を削除する <i class="bi bi-trash"></i>
          </button>
        </form>
      `,
    ),
  );
});

app.post('/:memoryId/update', memoryIdValidator, memoryFormValidator, async (c) => {
  const { user } = c.get('session') ?? {};
  const memory = await prisma.memory.findUnique({
    where: { memoryId: c.req.param('memoryId') },
  });
  if (!isMine(user.id, memory)) {
    return c.notFound();
  }

  const body = c.req.valid('form');
  const updatedMemory = await prisma.memory.update({
    where: { memoryId: memory.memoryId },
    data: {
      memoryName: body.memoryName.slice(0, 255) || '（名称未設定）',
      diary: body.diary,
      updatedAt: new Date(),
    },
  });

  return c.redirect('/memories/' + updatedMemory.memoryId);
});

async function deleteMemoryAggregate(memoryId) {
  await prisma.comment.deleteMany({ where: { memoryId } });
  await prisma.memory.delete({ where: { memoryId } });
}
app.deleteMemoryAggregate = deleteMemoryAggregate;

app.post('/:memoryId/delete', memoryIdValidator, async (c) => {
  const { user } = c.get('session') ?? {};
  const memory = await prisma.memory.findUnique({
    where: { memoryId: c.req.valid('param').memoryId },
  });
  if (!isMine(user.id, memory)) {
    return c.notFound();
  }

  await deleteMemoryAggregate(memory.memoryId);
  return c.redirect('/');
});

module.exports = app;