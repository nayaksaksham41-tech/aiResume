function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch (_e) {
    return iso;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const origin = window.location.origin;
  const denied = document.getElementById("adminDenied");
  const main = document.getElementById("adminMain");
  const usersBody = document.getElementById("usersBody");
  const btnRefresh = document.getElementById("btnRefresh");
  const historySection = document.getElementById("historySection");
  const historyUserLabel = document.getElementById("historyUserLabel");
  const historyListAdmin = document.getElementById("historyListAdmin");

  async function gate() {
    try {
      const me = await fetch(`${origin}/svc/auth/me`, { credentials: "include", cache: "no-store" });
      if (me.status === 401 || me.status === 403 || me.status === 404) {
        window.location.href = `${origin}/auth.html`;
        return false;
      }
      if (!me.ok) {
        denied.textContent = "Could not verify your session. Try again.";
        denied.classList.remove("hidden");
        return false;
      }
      const data = await me.json();
      if (!data.isAdmin) {
        denied.textContent = "You don’t have access to this page.";
        denied.classList.remove("hidden");
        return false;
      }
      return true;
    } catch (_e) {
      window.location.href = `${origin}/auth.html`;
      return false;
    }
  }

  async function loadUsers() {
    const res = await fetch(`${origin}/svc/admin/users`, {
      credentials: "include",
      cache: "no-store",
    });
    if (res.status === 403) {
      denied.textContent = "Admin access only.";
      denied.classList.remove("hidden");
      main.classList.add("hidden");
      return;
    }
    if (!res.ok) {
      denied.textContent = "Could not load users.";
      denied.classList.remove("hidden");
      return;
    }
    const data = await res.json();
    const users = data.users || [];

    usersBody.innerHTML = users
      .map(
        (u) => `
      <tr data-user-id="${escapeHtml(u.id)}">
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(formatDate(u.createdAt))}</td>
        <td><strong>${Number(u.resumeCount) || 0}</strong></td>
        <td>
          <button type="button" class="text-btn js-show-history" data-user-id="${escapeHtml(u.id)}">
            View histories
          </button>
        </td>
      </tr>`,
      )
      .join("");

    usersBody.querySelectorAll(".js-show-history").forEach((btn) => {
      btn.addEventListener("click", () => {
        const uid = btn.getAttribute("data-user-id");
        if (uid) loadHistory(uid);
      });
    });
  }

  async function loadHistory(userId) {
    historyListAdmin.innerHTML = "";
    historyUserLabel.textContent = "Loading…";
    historySection.classList.remove("hidden");

    const res = await fetch(`${origin}/svc/admin/users/${encodeURIComponent(userId)}/history`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) {
      historyUserLabel.textContent = "Could not load histories.";
      return;
    }
    const data = await res.json();
    const user = data.user;
    const entries = data.entries || [];

    historyUserLabel.textContent = user
      ? `${user.email} — ${entries.length} resume(s) stored`
      : "";

    if (!entries.length) {
      historyListAdmin.innerHTML =
        '<p class="history-empty" style="border: none">No resume history for this account yet.</p>';
      return;
    }

    historyListAdmin.innerHTML = entries
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
          <a class="text-btn" href="${origin}/svc/history/${encodeURIComponent(e.id)}/download/pdf">PDF</a>
          <a class="text-btn" href="${origin}/svc/history/${encodeURIComponent(e.id)}/download/docx">Word</a>
        </div>
      </article>`,
      )
      .join("");
  }

  const ok = await gate();
  if (!ok) return;

  main.classList.remove("hidden");
  await loadUsers();

  btnRefresh.addEventListener("click", () => loadUsers());
});
