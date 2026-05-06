const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const { getDataRoot } = require("./dataRoot");
const { getRedisClient } = require("./redisClient");

const ROLLING_MS = 24 * 60 * 60 * 1000;

function usageZsetKey(userId) {
  return `cva:usage:roll24:${userId}`;
}

function usagePath() {
  return path.join(getDataRoot(), "resume_usage_roll24.json");
}

function ensureFile() {
  const p = usagePath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify({ clocks: {} }, null, 2), "utf8");
  }
}

function loadFs() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(usagePath(), "utf8"));
  } catch (_e) {
    return { clocks: {} };
  }
}

function saveFs(data) {
  ensureFile();
  fs.writeFileSync(usagePath(), JSON.stringify(data, null, 2), "utf8");
}

function cutoffTs() {
  return Date.now() - ROLLING_MS;
}

/**
 * Rolling 24h resume generations per user (pruned on each read/write).
 * Redis: sorted set scores = unix ms event time.
 */
async function getRollingCount(userId) {
  const redis = getRedisClient();
  const cutoffMs = cutoffTs();
  const now = Date.now();

  if (redis) {
    try {
      const key = usageZsetKey(userId);
      await redis.zremrangebyscore(key, "-inf", cutoffMs);
      return await redis.zcard(key);
    } catch (e) {
      console.error("[usageStore] Redis getRollingCount failed:", e?.message || e);
    }
  }

  const db = loadFs();
  const arr = db.clocks[userId];
  const list = Array.isArray(arr) ? arr.filter((ts) => ts > cutoffMs && ts <= now) : [];
  db.clocks[userId] = list;
  saveFs(db);
  return list.length;
}

async function recordGeneration(userId) {
  const redis = getRedisClient();
  const now = Date.now();
  const member = `${now}:${crypto.randomUUID()}`;
  const cutoffMs = cutoffTs();

  if (redis) {
    try {
      const key = usageZsetKey(userId);
      await redis.zremrangebyscore(key, "-inf", cutoffMs);
      await redis.zadd(key, { score: now, member });
      /** Auto-expire zset slightly past window so stale keys vanish without manual cleanup */
      await redis.expire(key, Math.ceil((ROLLING_MS + 86400000) / 1000));
      return;
    } catch (e) {
      console.error("[usageStore] Redis recordGeneration failed:", e?.message || e);
    }
  }

  const db = loadFs();
  const prev = Array.isArray(db.clocks[userId]) ? db.clocks[userId].filter((ts) => ts > cutoffMs) : [];
  prev.push(now);
  db.clocks[userId] = prev;
  saveFs(db);
}

module.exports = {
  ROLLING_MS,
  getRollingCount,
  recordGeneration,
};
