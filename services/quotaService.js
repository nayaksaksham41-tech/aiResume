const { isAdminEmail } = require("./adminService");
const subscriptionStore = require("./subscriptionStore");
const usageStore = require("./usageStore");
const { AppError } = require("../middleware/errorHandler");

const FREE_DAILY_ROLLING = 2;
const PRO_1M_DAILY = 10;
const PRO_3M_DAILY = 12;

function paidPlanExpiresAtMs(row, nowMs) {
  const raw = row.expiresAt;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return 0;
  return t > nowMs ? t : 0;
}

function rollingLimitForStoredPlan(row, nowMs) {
  const plan = row.plan || "free";
  const paidUntil = paidPlanExpiresAtMs(row, nowMs);
  if (!paidUntil) return { limit: FREE_DAILY_ROLLING, billedPlan: "free" };
  if (plan === "pro_1m") return { limit: PRO_1M_DAILY, billedPlan: "pro_1m" };
  if (plan === "pro_3m") return { limit: PRO_3M_DAILY, billedPlan: "pro_3m" };
  return { limit: FREE_DAILY_ROLLING, billedPlan: "free" };
}

function isQuotaExemptUser(user) {
  if (!user) return false;
  if (user.id === "script") return true;
  if (user.email && isAdminEmail(user.email)) return true;
  return false;
}

/**
 * @returns {{ exempt: true } | { exempt: false, limit: number, used: number, billedPlan: string }}
 */
async function getQuotaSnapshot(user) {
  if (isQuotaExemptUser(user)) {
    return { exempt: true };
  }
  const sub = await subscriptionStore.getSubscription(user.id);
  const nowMs = Date.now();
  const { limit, billedPlan } = rollingLimitForStoredPlan(sub, nowMs);
  const used = await usageStore.getRollingCount(user.id);
  return { exempt: false, limit, used, billedPlan };
}

async function assertCanGenerateResume(user) {
  const snap = await getQuotaSnapshot(user);
  if (snap.exempt) return snap;
  if (snap.used >= snap.limit) {
    throw new AppError(
      "You've reached your resume limit for the last 24 hours. Subscribe for more generations per day.",
      402,
      "QUOTA_EXCEEDED",
    );
  }
  return snap;
}

async function recordSuccessfulGeneration(user) {
  if (isQuotaExemptUser(user)) return;
  await usageStore.recordGeneration(user.id);
}

function expiresMillis(row) {
  const raw = row.expiresAt || row.renewsAt || null;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

async function buildAccountQuotaPayload(user) {
  const stubUpgradeEnabled = process.env.SUBSCRIPTION_STUB === "true";
  const row = await subscriptionStore.getSubscription(user.id);
  const quota = await getQuotaSnapshot(user);
  const storedPlan = row.plan || "free";
  const expMs = expiresMillis(row);
  const nowMs = Date.now();
  const paidWindowActive =
    expMs > nowMs && (storedPlan === "pro_1m" || storedPlan === "pro_3m");

  let effectivePlan = storedPlan;
  if ((storedPlan === "pro_1m" || storedPlan === "pro_3m") && !paidWindowActive) {
    effectivePlan = "free";
  }
  if (storedPlan !== "pro_1m" && storedPlan !== "pro_3m") {
    effectivePlan = "free";
  }

  if (quota.exempt) {
    return {
      subscription: {
        plan: storedPlan,
        effectivePlan: "unlimited",
        status: row.status || "active",
        expiresAt: row.expiresAt ?? null,
        renewsAt: row.renewsAt ?? null,
      },
      quota: { exempt: true },
      stubUpgradeEnabled,
    };
  }

  return {
    subscription: {
      plan: storedPlan,
      effectivePlan,
      status: row.status || "active",
      expiresAt: row.expiresAt ?? null,
      renewsAt: row.renewsAt ?? null,
    },
    quota: {
      exempt: false,
      usedRolling24h: quota.used,
      limitRolling24h: quota.limit,
    },
    stubUpgradeEnabled,
  };
}

module.exports = {
  FREE_DAILY_ROLLING,
  PRO_1M_DAILY,
  PRO_3M_DAILY,
  assertCanGenerateResume,
  recordSuccessfulGeneration,
  getQuotaSnapshot,
  rollingLimitForStoredPlan,
  buildAccountQuotaPayload,
};
