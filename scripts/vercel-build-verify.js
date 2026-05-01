/**
 * Lightweight build step for Vercel: ensures the app graph loads without starting the HTTP listener.
 * Do not set VERCEL here — local `npm run build` should use normal ./data paths.
 */
process.env.SKIP_HTTP_LISTEN = "1";
require("../server");
console.log("[vercel-build] server bundle ok");
