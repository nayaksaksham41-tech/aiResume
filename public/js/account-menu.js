/**
 * Renders the account icon + dropdown when #accountMount is present and the user is signed in.
 * Include after <div id="accountMount">; requires credentials cookies.
 */
(function initAccountMenu() {
  const mount = document.getElementById("accountMount");
  if (!mount || window.location.protocol === "file:") return;

  const MENU = [
    { label: "Home", href: "/" },
    { label: "Profile", href: "/profile.html" },
    { label: "History (resumes created)", href: "/history.html" },
    { label: "Subscription", href: "/subscription.html" },
    { type: "logout", label: "Log out" },
  ];

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function closeDropdown(btn, panel) {
    panel.classList.add("hidden");
    btn.setAttribute("aria-expanded", "false");
  }

  async function logout() {
    try {
      await fetch(`${window.location.origin}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } catch (_e) {
      /* ignore */
    }
    window.location.href = `${window.location.origin}/auth.html`;
  }

  async function boot() {
    let me;
    try {
      me = await fetch(`${window.location.origin}/api/auth/me`, {
        credentials: "include",
        cache: "no-store",
      });
    } catch (_e) {
      window.location.href = `${window.location.origin}/auth.html`;
      return;
    }

    if (me.status === 401) {
      window.location.href = `${window.location.origin}/auth.html`;
      return;
    }

    let userEmail = "";
    let isAdmin = false;
    try {
      const data = await me.json();
      userEmail = data.user?.email || "";
      isAdmin = data.isAdmin === true;
    } catch (_e) {
      /* keep empty */
    }

    const adminLink = isAdmin
      ? `<a class="account-menu-item account-menu-admin" role="menuitem" href="/admin.html">Admin dashboard</a>`
      : "";

    const wrap = document.createElement("div");
    wrap.className = "account-menu-wrap";
    wrap.innerHTML = `
      <button type="button" class="account-icon-btn" id="accountMenuBtn" aria-haspopup="true" aria-expanded="false" title="Account menu" aria-label="Account menu">
        <svg class="account-icon-svg" width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
        </svg>
      </button>
      <div class="account-dropdown hidden" id="accountDropdown" role="menu" aria-label="Account">
        ${
          userEmail
            ? `<div class="account-dropdown-email">${escapeHtml(userEmail)}</div>`
            : ""
        }
        ${adminLink}
        ${MENU.map((item) => {
          if (item.type === "logout") {
            return `<button type="button" class="account-menu-item" role="menuitem" data-action="logout">${escapeHtml(item.label)}</button>`;
          }
          return `<a class="account-menu-item" role="menuitem" href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`;
        }).join("")}
      </div>
    `;

    mount.innerHTML = "";
    mount.appendChild(wrap);
    mount.classList.remove("hidden");

    const btn = wrap.querySelector("#accountMenuBtn");
    const panel = wrap.querySelector("#accountDropdown");

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const open = panel.classList.contains("hidden");
      if (open) {
        panel.classList.remove("hidden");
        btn.setAttribute("aria-expanded", "true");
      } else {
        closeDropdown(btn, panel);
      }
    });

    wrap.querySelector('[data-action="logout"]')?.addEventListener("click", () => {
      logout();
    });

    document.addEventListener("click", (e) => {
      if (!wrap.contains(e.target)) closeDropdown(btn, panel);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDropdown(btn, panel);
    });
  }

  boot();
})();
