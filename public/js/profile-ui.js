document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("profileForm");
  const status = document.getElementById("profileStatus");
  const emailEl = document.getElementById("profileEmail");
  const cvList = document.getElementById("profileCvList");
  const cvEmpty = document.getElementById("profileCvEmpty");
  const origin = window.location.origin;

  function setStatus(msg, kind = "") {
    status.textContent = msg;
    status.className = `status ${kind}`.trim();
  }

  function formatWhen(iso) {
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    } catch (_e) {
      return iso || "";
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  try {
    const meRes = await fetch(`${origin}/svc/auth/me`, { credentials: "include", cache: "no-store" });
    if (meRes.status === 401 || meRes.status === 403 || meRes.status === 404) {
      window.location.href = `${origin}/auth.html`;
      return;
    }
    if (!meRes.ok) {
      setStatus("Could not load account.", "error");
      return;
    }
    const me = await meRes.json();
    emailEl.textContent = me.user?.email || "—";

    const [profRes, histRes] = await Promise.all([
      fetch(`${origin}/svc/profile`, { credentials: "include", cache: "no-store" }),
      fetch(`${origin}/svc/history`, { credentials: "include", cache: "no-store" }),
    ]);

    if (profRes.status === 401 || profRes.status === 403 || profRes.status === 404) {
      window.location.href = `${origin}/auth.html`;
      return;
    }
    if (!profRes.ok) {
      setStatus("Could not load profile.", "error");
      return;
    }

    const profData = await profRes.json();
    const p = profData.profile || {};
    document.getElementById("phone").value = p.phone || "";
    document.getElementById("linkedinUrl").value = p.linkedinUrl || "";

    if (histRes.ok) {
      const histData = await histRes.json();
      const entries = histData.entries || [];
      if (!entries.length) {
        cvEmpty.classList.remove("hidden");
        cvList.innerHTML = "";
      } else {
        cvEmpty.classList.add("hidden");
        cvList.innerHTML = entries
          .map((e) => {
            const title = escapeHtml(e.resumeTitle || "Tailored resume");
            const when = escapeHtml(formatWhen(e.createdAt));
            const preview = escapeHtml(e.jdPreview || "");
            const ats =
              typeof e.atsOverall === "number"
                ? `<span class="profile-cv-ats">ATS ~${e.atsOverall}</span>`
                : "";
            const openUrl = `./results.html?history=${encodeURIComponent(e.id)}`;
            return `<li class="profile-cv-item">
              <div class="profile-cv-main">
                <strong class="profile-cv-title">${title}</strong>
                <span class="profile-cv-meta">${when} ${ats}</span>
                ${preview ? `<p class="profile-cv-preview">${preview}</p>` : ""}
              </div>
              <a class="text-btn profile-cv-open" href="${openUrl}">Open</a>
            </li>`;
          })
          .join("");
      }
    } else {
      cvEmpty.textContent = "Could not load resume list.";
      cvEmpty.classList.remove("hidden");
    }
  } catch (_e) {
    setStatus("Could not load profile.", "error");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = {
      phone: String(fd.get("phone") || "").trim(),
      linkedinUrl: String(fd.get("linkedinUrl") || "").trim(),
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
