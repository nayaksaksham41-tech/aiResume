/**
 * Admin accounts: optional ADMIN_EMAIL (comma-separated full emails) plus
 * any account whose local part (before @) is `nayaksaksham41`.
 */
function isAdminEmail(email) {
  const e = String(email || "")
    .toLowerCase()
    .trim();
  if (!e) return false;

  const extras = String(process.env.ADMIN_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (extras.includes(e)) return true;

  const local = e.split("@")[0];
  return local === "nayaksaksham41";
}

module.exports = { isAdminEmail };
