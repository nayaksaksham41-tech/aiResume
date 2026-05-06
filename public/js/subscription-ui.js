document.addEventListener("DOMContentLoaded", () => {
  const origin = window.location.origin;
  const planEl = document.getElementById("planName");
  const statusEl = document.getElementById("planStatus");
  const usageEl = document.getElementById("planUsage");
  const noteEl = document.getElementById("planNote");

  async function patchPlan(plan) {
    const res = await fetch(`${origin}/svc/subscription`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ plan }),
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      window.location.href = `${origin}/auth.html`;
      return null;
    }
    if (!res.ok) {
      let msg = `Request failed (${res.status}).`;
      try {
        const data = await res.json();
        if (data?.error) msg = typeof data.error === "string" ? data.error : msg;
      } catch (_e) {
        /* ignore */
      }
      throw new Error(msg);
    }
    return res.json();
  }

  function formatPlanLabel(effective, stored) {
    if (effective === "unlimited") return "Admin / unlimited";
    const labels = {
      free: "Free",
      pro_1m: "Pro (1 month)",
      pro_3m: "Pro (3 months)",
    };
    return labels[effective] || labels[stored] || String(effective || "Free");
  }

  function render(data) {
    const sub = data.subscription || {};
    const quota = data.quota || {};
    const stub = data.stubUpgradeEnabled === true;

    planEl.textContent = formatPlanLabel(sub.effectivePlan, sub.plan);
    statusEl.textContent = sub.status || "—";

    if (quota.exempt) {
      usageEl.textContent = "Not limited";
    } else {
      usageEl.textContent = `${quota.usedRolling24h ?? "—"} / ${quota.limitRolling24h ?? "—"} generations (rolling 24h)`;
    }

    let note = "";
    if (quota.exempt) {
      note = "Your account is not subject to generation limits.";
    } else if (sub.effectivePlan === "free") {
      note =
        "You’re on the free tier: 2 resume generations per rolling 24 hours. Pick a Pro plan below for higher daily limits.";
    } else {
      const exp = sub.expiresAt
        ? new Date(sub.expiresAt).toLocaleDateString(undefined, { dateStyle: "medium" })
        : null;
      note = exp
        ? `Pro benefits apply through ${exp}. Daily limit resets on a rolling 24-hour clock.`
        : "Pro plan is active. Daily limit resets on a rolling 24-hour clock.";
    }
    if (!stub && !quota.exempt) {
      note +=
        " Plan buttons stay disabled until payment is integrated. For testing, enable SUBSCRIPTION_STUB=true on the server.";
    }
    noteEl.textContent = note;

    document.querySelectorAll(".subscription-plan-btn").forEach((b) => {
      b.disabled = !stub || quota.exempt === true;
      b.title =
        quota.exempt === true
          ? "Your account already has unlimited access."
          : stub
            ? "Preview only: activates the plan record without charging a card."
            : "Enable SUBSCRIPTION_STUB on the server to test plan switches.";
    });

    const down = document.getElementById("downgradeFreeBtn");
    if (down) {
      down.disabled = !stub || quota.exempt === true;
      down.classList.toggle(
        "hidden",
        quota.exempt === true || stub !== true || sub.effectivePlan === "free",
      );
    }
  }

  async function load() {
    try {
      const res = await fetch(`${origin}/svc/subscription`, {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        window.location.href = `${origin}/auth.html`;
        return;
      }
      const data = await res.json();
      render(data);
    } catch (_e) {
      planEl.textContent = "—";
      statusEl.textContent = "—";
      usageEl.textContent = "—";
      noteEl.textContent = "Could not load subscription details.";
    }
  }

  document.querySelectorAll(".subscription-plan-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const plan = btn.getAttribute("data-plan");
      if (!plan || btn.disabled) return;
      btn.disabled = true;
      try {
        const data = await patchPlan(plan);
        if (data) render(data);
      } catch (e) {
        noteEl.textContent = e.message || "Could not update plan.";
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.getElementById("downgradeFreeBtn")?.addEventListener("click", async () => {
    const btn = document.getElementById("downgradeFreeBtn");
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    try {
      const data = await patchPlan("free");
      if (data) render(data);
    } catch (e) {
      noteEl.textContent = e.message || "Could not update plan.";
    } finally {
      btn.disabled = false;
    }
  });

  load();
});
