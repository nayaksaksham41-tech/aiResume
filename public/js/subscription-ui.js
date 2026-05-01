document.addEventListener("DOMContentLoaded", async () => {
  const origin = window.location.origin;
  const planEl = document.getElementById("planName");
  const statusEl = document.getElementById("planStatus");
  const noteEl = document.getElementById("planNote");

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
    const sub = data.subscription || {};
    planEl.textContent = sub.plan === "free" ? "Free" : String(sub.plan || "Free");
    statusEl.textContent = sub.status || "active";
    noteEl.textContent =
      sub.plan === "free"
        ? "You’re on the free tier: unlimited resume generations stored locally for your account. Paid tiers can be wired here later."
        : "Thanks for subscribing.";
  } catch (_e) {
    planEl.textContent = "—";
    statusEl.textContent = "—";
    noteEl.textContent = "Could not load subscription details.";
  }
});
