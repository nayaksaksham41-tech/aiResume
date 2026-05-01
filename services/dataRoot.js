const fs = require("fs");
const path = require("path");

/**
 * Writable JSON store root. On Vercel serverless, only `/tmp` is writable — use DATA_DIR to override.
 */
function getDataRoot() {
  if (process.env.DATA_DIR) {
    const root = path.resolve(process.env.DATA_DIR);
    fs.mkdirSync(root, { recursive: true });
    return root;
  }
  if (process.env.VERCEL) {
    const root = "/tmp/cva-data";
    fs.mkdirSync(root, { recursive: true });
    fs.mkdirSync(path.join(root, "history_items"), { recursive: true });
    return root;
  }
  return path.join(__dirname, "..", "data");
}

module.exports = { getDataRoot };
