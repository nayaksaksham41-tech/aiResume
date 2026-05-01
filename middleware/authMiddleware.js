const { verifyToken } = require("../services/authTokens");

function extractBearer(authorization) {
  if (!authorization || typeof authorization !== "string") return null;
  const m = authorization.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function tryScriptApiKey(req) {
  const key = process.env.SCRIPT_API_KEY;
  if (!key) return null;
  const sent = req.get("x-api-key");
  if (sent && sent === key) {
    return { id: "script", email: "script@local" };
  }
  return null;
}

/**
 * Requires a valid JWT (cookie `auth_token` or Authorization: Bearer) or matching SCRIPT_API_KEY.
 */
function requireAuth(req, res, next) {
  const scriptUser = tryScriptApiKey(req);
  if (scriptUser) {
    req.user = scriptUser;
    return next();
  }

  const token = req.cookies?.auth_token || extractBearer(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ error: "Authentication required. Sign up or log in." });
  }
  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (_e) {
    res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

module.exports = { requireAuth, extractBearer };
