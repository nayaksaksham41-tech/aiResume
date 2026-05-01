/**
 * Vercel catch-all: handles /api, /api/auth/me, /api/admin/users, etc.
 * (A plain api/index.js does not receive /api/auth/me — Vercel looks for api/auth/me.js first.)
 */
const serverless = require("serverless-http");
const app = require("../server");

module.exports = serverless(app);
