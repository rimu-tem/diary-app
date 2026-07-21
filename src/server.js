const { serve } = require('@hono/node-server');
const app = require('./app');

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
serve({
  fetch: app.fetch,
  port,
});