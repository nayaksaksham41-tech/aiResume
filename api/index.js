/**
 * Vercel serverless entry: all HTTP traffic is rewritten here (see vercel.json).
 */
const serverless = require("serverless-http");
const app = require("../server");

module.exports = serverless(app);
