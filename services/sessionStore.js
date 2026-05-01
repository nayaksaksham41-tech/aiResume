const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { getDataRoot } = require("./dataRoot");

const TTL_MS = 30 * 60 * 1000;
const sessions = new Map();

function sessionsDir() {
  return path.join(getDataRoot(), "sessions");
}

function createSession(payload) {
  const id = crypto.randomUUID();
  const row = { ...payload, createdAt: Date.now() };

  if (process.env.VERCEL) {
    fs.mkdirSync(sessionsDir(), { recursive: true });
    fs.writeFileSync(path.join(sessionsDir(), `${id}.json`), JSON.stringify(row), "utf8");
    return id;
  }

  sessions.set(id, row);
  return id;
}

function getSession(id) {
  if (!id || typeof id !== "string") return null;

  if (process.env.VERCEL) {
    const fp = path.join(sessionsDir(), `${id}.json`);
    if (!fs.existsSync(fp)) return null;
    try {
      const raw = fs.readFileSync(fp, "utf8");
      const row = JSON.parse(raw);
      if (Date.now() - row.createdAt > TTL_MS) {
        try {
          fs.unlinkSync(fp);
        } catch (_e) {
          /* ignore */
        }
        return null;
      }
      return row;
    } catch (_e) {
      return null;
    }
  }

  const row = sessions.get(id);
  if (!row) return null;
  if (Date.now() - row.createdAt > TTL_MS) {
    sessions.delete(id);
    return null;
  }
  return row;
}

function deleteSession(id) {
  if (process.env.VERCEL) {
    try {
      fs.unlinkSync(path.join(sessionsDir(), `${id}.json`));
    } catch (_e) {
      /* ignore */
    }
    return;
  }
  sessions.delete(id);
}

module.exports = { createSession, getSession, deleteSession };
