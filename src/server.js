const { serve } = require('@hono/node-server');
const express = require('express');
const app = express();

const port = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
serve({
  fetch: app.fetch,
  port,
});