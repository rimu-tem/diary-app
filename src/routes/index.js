const { Hono } = require("hono");
const { html } = require("hono/html");
const layout = require("../layout");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["query"] });

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault('Asia/Tokyo');

const app = new Hono();

function memoryTable(memories) {
  return html`
    <table class="table">
      <tr>
        <th>予定名</th>
        <th>作成日時</th>
        <th>更新日時</th>
      </tr>
      ${memories.map(
        (memory) => html`
          <tr>
            <td>
              <a href="/memories/${memory.memoryId}">
                ${memory.memoryName}
              </a>
            </td>
            <td>${memory.formattedCreatedAt}</td>
            <td>${memory.formattedUpdatedAt}</td>
          </tr>
        `,
      )}
    </table>
  `;
}

app.get("/", async (c) => {
  const { user } = c.get("session") ?? {};
  const memories = user
    ? await prisma.memory.findMany({
      where: { createdBy: user.id },
      orderBy: { updatedAt: "desc" },
    })
    : [];
  memories.forEach((memory) => {
    memory.formattedCreatedAt = dayjs(memory.createdAt).tz().format('YYYY/MM/DD HH:mm');
    memory.formattedUpdatedAt = dayjs(memory.updatedAt).tz().format('YYYY/MM/DD HH:mm');
  });

  return c.html(
    layout(
      c,
      null,
      html`
        <div class="my-3">
          <div class="p-5 bg-primary rounded-3">
            <h1 class="text-white">毎日日記</h1>
            <p class="text-white">
              毎日日記は、GitHubで認証でき、日々の振り返りができるサービスです。
            </p>
          </div>
        </div>
        ${user
          ? html`
              <div class="my-3">
                <h3 class="my-3">日記を書く</h3>
                <a class="btn btn-primary" href="/memories/new">日記を書く＋</a>
                ${memories.length > 0
                  ? html`
                      <h3 class="my-3">あなたの日記一覧</h3>
                      ${memoryTable(memories)}
                    `
                  : ""}
              </div>
            `
          : ""}
      `,
    ),
  );
});

module.exports = app;