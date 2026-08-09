const { serve } = require('@hono/node-server');
const app = require('./app');

const port = Number(process.env.PORT) || 11111;

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port, // 数値型のポート番号を渡す
});