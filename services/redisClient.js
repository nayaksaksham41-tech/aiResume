const { Redis } = require("@upstash/redis");

let redisClient = null;

/**
 * Supports both Upstash-named env vars and Vercel “Redis/KV” template names.
 * If only one pair is injected by the dashboard, routing still connects.
 */
function getRedisCredentials() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ||
    process.env.KV_REST_API_URL ||
    process.env.REDIS_REST_URL ||
    "";
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ||
    process.env.KV_REST_API_TOKEN ||
    process.env.REDIS_REST_TOKEN ||
    "";
  return { url: url.trim(), token: token.trim() };
}

function getRedisClient() {
  if (redisClient) return redisClient;
  const { url, token } = getRedisCredentials();
  if (!url || !token) return null;
  redisClient = new Redis({ url, token });
  return redisClient;
}

module.exports = { getRedisClient, getRedisCredentials };
