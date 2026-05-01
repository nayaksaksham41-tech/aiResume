const { isAdminEmail } = require("../services/adminService");

function requireAdmin(req, res, next) {
  const email = req.user?.email;
  if (!email || !isAdminEmail(email)) {
    return res.status(403).json({ error: "Admin access only." });
  }
  next();
}

module.exports = { requireAdmin };
