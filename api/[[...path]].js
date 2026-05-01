/**
 * Vercel optional catch-all: receives /api, /api/generate-resume, /api/svc/auth/me, etc.
 * vercel.json rewrites every path to /api/$1 so the original path is preserved.
 * server.js strips the /api prefix when VERCEL is set so Express routes match locally-shaped URLs.
 */
const serverless = require("serverless-http");
const app = require("../server");

module.exports = serverless(app);
