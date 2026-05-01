/**
 * Single serverless entry for Vercel (see vercel.json rewrite).
 * Browser APIs live under /svc/* — never /api/* — so they are not confused with this folder.
 */
const serverless = require("serverless-http");
const app = require("../server");

module.exports = serverless(app);
