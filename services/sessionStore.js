const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { getDataRoot } = require("./dataRoot");
const { getRedisClient } = require("./redisClient");

const TTL_MS = 30 * 60 * 1000;
const TTL_SEC = Math.ceil(TTL_MS / 1000);
const SESSION_KEY_PREFIX = "cva:session:";

const sessions = new Map();

function sessionsDir() {
  return path.join(getDataRoot(), "sessions");
}

function sessionRedisKey(id) {
  return `${SESSION_KEY_PREFIX}${id}`;
}

/**
 * Persist generation payload across Vercel instances: use Redis when UPSTASH_* env is set.
 * Local dev uses an in-memory Map; legacy Vercel /tmp file path only if Redis is absent.
 */
async function createSession(payload) {
  const id = crypto.randomUUID();
  const row = { ...payload, createdAt: Date.now() };

  const redis = getRedisClient();
  if (redis) {
    await redis.set(sessionRedisKey(id), JSON.stringify(row), { ex: TTL_SEC });
    return id;
  }

  if (process.env.VERCEL) {
    fs.mkdirSync(sessionsDir(), { recursive: true });
    fs.writeFileSync(path.join(sessionsDir(), `${id}.json`), JSON.stringify(row), "utf8");
    return id;
  }

  sessions.set(id, row);
  return id;
}

async function getSession(id) {
  if (!id || typeof id !== "string") return null;

  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(sessionRedisKey(id));
      if (raw == null) return null;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (typeof parsed.createdAt === "number" && Date.now() - parsed.createdAt > TTL_MS) {
        await deleteSession(id).catch(() => {});
        return null;
      }
      return parsed;
    } catch (_e) {
      return null;
    }
  }

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

async function deleteSession(id) {
  if (!id || typeof id !== "string") return;

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(sessionRedisKey(id));
    } catch (_e) {
      /* ignore */
    }
    return;
  }

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
