const { serve } = require('@hono/node-server');
const app = require('./app');

const port = Number(process.env.PORT) || 8888;
console.log(`Server running at http://localhost:${port}/`);
serve({
  fetch: app.fetch,
  port,
});