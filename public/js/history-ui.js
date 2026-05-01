function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch (_e) {
    return iso;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const listEl = document.getElementById("historyList");
  const emptyEl = document.getElementById("historyEmpty");
  const origin = window.location.origin;

  try {
    const res = await fetch(`${origin}/api/history`, { credentials: "include", cache: "no-store" });
    if (res.status === 401) {
      window.location.href = `${origin}/auth.html`;
      return;
    }
    const data = await res.json();
    const entries = data.entries || [];

    if (!entries.length) {
      emptyEl.classList.remove("hidden");
      return;
    }

    emptyEl.classList.add("hidden");
    listEl.innerHTML = entries
      .map(
        (e) => `
      <article class="history-card">
        <div class="history-card-main">
          <h2 class="history-title">${escapeHtml(e.resumeTitle || "Resume")}</h2>
          <p class="history-meta">${formatDate(e.createdAt)}</p>
          <p class="history-preview">${escapeHtml(e.jdPreview || "")}</p>
          ${
            typeof e.atsOverall === "number"
              ? `<p class="history-ats">ATS estimate: <strong>${e.atsOverall}</strong></p>`
              : ""
          }
        </div>
        <div class="history-card-actions">
          <a class="text-btn" href="/results.html?history=${encodeURIComponent(e.id)}">Open</a>
          <a class="text-btn" href="${origin}/api/history/${encodeURIComponent(e.id)}/download/pdf">PDF</a>
          <a class="text-btn" href="${origin}/api/history/${encodeURIComponent(e.id)}/download/docx">Word</a>
        </div>
      </article>`,
      )
      .join("");
  } catch (_e) {
    emptyEl.textContent = "Could not load history.";
    emptyEl.classList.remove("hidden");
  }
});
