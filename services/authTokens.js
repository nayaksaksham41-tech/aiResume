const jwt = require("jsonwebtoken");

function getJwtSecret() {
  const s = process.env.JWT_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  return "cva-dev-jwt-secret-not-for-production";
}

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, getJwtSecret(), { expiresIn: "7d" });
}

function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

module.exports = {
  getJwtSecret,
  signToken,
  verifyToken,
};
