document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("profileForm");
  const status = document.getElementById("profileStatus");
  const origin = window.location.origin;

  function setStatus(msg, kind = "") {
    status.textContent = msg;
    status.className = `status ${kind}`.trim();
  }

  try {
    const res = await fetch(`${origin}/svc/profile`, { credentials: "include", cache: "no-store" });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      window.location.href = `${origin}/auth.html`;
      return;
    }
    const data = await res.json();
    const p = data.profile || {};
    document.getElementById("displayName").value = p.displayName || "";
    document.getElementById("headline").value = p.headline || "";
    document.getElementById("phone").value = p.phone || "";
  } catch (_e) {
    setStatus("Could not load profile.", "error");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {
      displayName: String(fd.get("displayName") || "").trim(),
      headline: String(fd.get("headline") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
    };

    setStatus("Saving…", "");
    try {
      const res = await fetch(`${origin}/svc/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Save failed");
      }
      setStatus("Saved.", "");
    } catch (err) {
      setStatus(err.message || "Save failed.", "error");
    }
  });
});
