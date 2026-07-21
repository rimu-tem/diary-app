const { Hono } = require("hono");
const ensureAuthenticated = require("../middlewares/ensure-authenticated");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["query"] });
const { z } = require("zod");
const { zValidator } = require("@hono/zod-validator");

const app = new Hono();

const paramValidator = zValidator(
  "param",
  z.object({
    memoryId: z.string().uuid(),
    userId: z.coerce.number().int().min(0),
  }),
  (result, c) => {
    if (!result.success) {
      return c.json({
        status: "NG",
        errors: [result.error],
      }, 400);
    }
  }
);

module.exports = app;