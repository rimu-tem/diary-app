const { serve } = require('@hono/node-server');
const app = require('./app');

const port = Number(process.env.PORT) || 3000;

console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port, // 数値型のポート番号を渡す
});