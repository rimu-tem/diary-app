const { serve } = require('@hono/node-server');
const app = require('./app');

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
serve({
  fetch: app.fetch,
  port,
});