// ===========================================================================
// Admin Panel — moderation tools for whichever short logins are on the admin
// list. Store.getAdminCodes/addAdminCode/removeAdminCode (js/store.js) is the
// actual storage; js/dev-mode.js's "Manage Admins" section (MIFN-only) is
// the only place that list is edited.
//
// Distinct from Developer Mode itself: Dev Mode stays MIFN-only forever —
// it's temporary scaffolding, deleted before the real event ships (see that
// file's header) — while this panel is the real, permanent moderation
// surface, reachable by any short login the admin list names, MIFN included.
//
// Three things live here:
//   1. A floating dock button (own element, appended into #utilityDock)
//      that only renders once this browser's logged-in user is confirmed to
//      be on the admin list — nothing shows while that check is still
//      in flight or for anyone not on the list.
//   2. The panel itself: Active/Deleted tabs for the two gallery-style
//      activities (Photo Finish, Who Went The Extra Mile), each entry with
//      a soft-delete or restore button.
//   3. A reset-one-activity-for-one-user tool — deliberately presented next
//      to, but visually separated from, the soft-delete list above: reset
//      permanently clears a submission so its owner can redo it from
//      scratch, which is a materially different (and less reversible)
//      operation than hiding a bad entry via soft-delete.
// Every destructive action (soft-delete, restore, reset) is confirm()-gated,
// same precedent as js/dev-mode.js's own Reset button.
// ===========================================================================
const AdminPanel = (() => {
  let adminCodesCache = null; // Set<string> | null — null means "not loaded yet"
  let cachedForCode = null;   // which user.code the cache above was fetched for
  let latestCtx = null;       // { user, showHub, refreshUser } from the most recent render()

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const GALLERY_TABS = [
    { key: 'photoFinishEntries', label: 'Photo Finish', bingoKey: 'photoFinish', textField: 'caption', fetch: (opts) => Store.getPhotoFinishEntries(opts) },
    { key: 'nominations', label: 'Who Went The Extra Mile?', bingoKey: 'nomination', textField: 'reason', fetch: (opts) => Store.getNominations(opts) },
  ];

  const RESET_ACTIVITY_OPTIONS = [
    { key: 'hyperlinkRace', label: 'Hyperlink Race' },
    { key: 'snapJudgement', label: 'Snap Judgement' },
    { key: 'photoFinish', label: 'Photo Finish' },
    { key: 'nomination', label: 'Who Went The Extra Mile?' },
    { key: 'trivia', label: 'Race Day Trivia (all 5 days)' },
  ];

  // Called from js/app.js's showHub(), exactly like DevMode.render — but
  // unlike DevMode's check (a plain `===` against a hardcoded code), this
  // one needs a real Firestore read the first time it runs for a given
  // user. Rather than block showHub() on that, this renders nothing (no
  // dock button) on a cold cache, kicks the fetch off in the background,
  // and calls `showHub` again once it resolves — the same optimistic-UI,
  // re-render-when-it-lands shape js/dev-mode.js's setMinimized already
  // uses for a write; this is the same idea for a read.
  function render(user, { showHub, refreshUser }) {
    latestCtx = { user, showHub, refreshUser };
    if (!user) { document.getElementById('adminPanelDockBtn')?.remove(); return; }

    if (cachedForCode !== user.code) {
      adminCodesCache = null;
      cachedForCode = user.code;
    }
    if (adminCodesCache === null) {
      document.getElementById('adminPanelDockBtn')?.remove();
      Store.getAdminCodes()
        .then((codes) => { adminCodesCache = new Set(codes); showHub(); })
        .catch((e) => { console.warn('Could not load the admin list', e); adminCodesCache = new Set(); showHub(); });
      return;
    }

    ensureDockButton(adminCodesCache.has(user.code));
  }

  function ensureDockButton(show) {
    let btn = document.getElementById('adminPanelDockBtn');
    if (!show) { btn?.remove(); return; }
    if (btn) return; // already there — openPanel() always reads latestCtx fresh, nothing to re-wire
    btn = document.createElement('button');
    btn.id = 'adminPanelDockBtn';
    btn.className = 'doodle-btn sm navy';
    btn.innerHTML = '<span>🛡️</span><span>Admin Panel</span>';
    btn.addEventListener('click', openPanel);
    document.getElementById('utilityDock')?.appendChild(btn);
  }

  // ---- The panel's own modal (deliberately separate from js/app.js's
  // #genericModal — this never needs that modal's lock-while-mid-session
  // behavior, and keeping its own element means this module stays fully
  // self-contained, same as js/cursor-picker.js). ----------------------------
  let modalEl = null;
  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'modal-backdrop';
    modalEl.style.display = 'none';
    modalEl.innerHTML = `
      <div class="sketch-modal sketch-modal--wide">
        <button class="modal-close" id="apClose">✕</button>
        <div id="apBody"></div>
      </div>`;
    document.body.appendChild(modalEl);
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closePanel(); });
    modalEl.querySelector('#apClose').addEventListener('click', closePanel);
    return modalEl;
  }
  function closePanel() {
    if (modalEl) modalEl.style.display = 'none';
  }

  let activeTabKey = GALLERY_TABS[0].key;
  let activeSubView = 'active'; // 'active' | 'deleted'

  function openPanel() {
    const modal = ensureModal();
    modal.style.display = 'flex';
    renderPanelBody(modal.querySelector('#apBody'));
  }

  async function renderPanelBody(body) {
    const tab = GALLERY_TABS.find((t) => t.key === activeTabKey);
    body.innerHTML = `
      <h2 class="sketch-title" style="text-align:center;width:100%;">🛡️ Admin Panel</h2>
      <div class="lb-tabs" id="apTabs">
        ${GALLERY_TABS.map((t) => `<button class="doodle-btn sm ${t.key === activeTabKey ? 'is-active-tab' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}
      </div>
      <div class="admin-subtabs" id="apSubtabs">
        <button class="doodle-btn sm ${activeSubView === 'active' ? 'is-active-tab' : ''}" data-sub="active">Active</button>
        <button class="doodle-btn sm ${activeSubView === 'deleted' ? 'is-active-tab' : ''}" data-sub="deleted">🗑️ Deleted</button>
      </div>
      <div id="apList" class="admin-list"><p style="text-align:center;color:var(--ink-soft);">Loading…</p></div>
      <div class="admin-reset-tool" id="apResetTool">
        <h3 style="color:var(--navy);font-size:15px;margin:0 0 4px;">🔄 Reset one activity for one user</h3>
        <p style="color:var(--ink-soft);font-size:12.5px;margin:0 0 10px;">Permanently clears that activity's submission so they can redo it from scratch. This is <strong>not</strong> the same as soft-delete above — soft-delete only hides a bad entry; this actually erases the original attempt and cannot be undone.</p>
        <div class="admin-reset-tool__row">
          <input id="apResetCode" maxlength="4" placeholder="ABCD" class="code-input" style="font-size:16px;padding:8px;width:90px;" />
          <select id="apResetActivity">
            ${RESET_ACTIVITY_OPTIONS.map((o) => `<option value="${o.key}">${o.label}</option>`).join('')}
          </select>
          <button class="doodle-btn sm brick" id="apResetBtn">⚠ Reset</button>
        </div>
      </div>
    `;

    body.querySelector('#apTabs').querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeTabKey = btn.dataset.tab;
        activeSubView = 'active';
        renderPanelBody(body);
      });
    });
    body.querySelector('#apSubtabs').querySelectorAll('button').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeSubView = btn.dataset.sub;
        renderPanelBody(body);
      });
    });

    const codeInput = body.querySelector('#apResetCode');
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    });
    body.querySelector('#apResetBtn').addEventListener('click', async () => {
      const code = codeInput.value.trim();
      const activityKey = body.querySelector('#apResetActivity').value;
      const activityLabel = RESET_ACTIVITY_OPTIONS.find((o) => o.key === activityKey)?.label || activityKey;
      if (!/^[A-Z]{4}$/.test(code)) { Toast.show('Enter a valid 4-letter short login.', 'error'); return; }
      const confirmed = confirm(
        `Reset "${activityLabel}" for "${code}"?\n\n` +
        `This permanently clears their submission for this one activity so they can redo it from scratch — their original attempt is gone for good. This is different from soft-delete: soft-delete only hides an entry, it doesn't erase it.`
      );
      if (!confirmed) return;
      const btn = body.querySelector('#apResetBtn');
      btn.disabled = true; btn.textContent = 'Resetting…';
      try {
        await Store.resetUserActivity(code, activityKey);
        Toast.show(`🔄 Reset "${activityLabel}" for ${code}.`, 'success');
        codeInput.value = '';
      } catch (err) {
        console.error(err);
        Toast.show('⚠️ Could not reset that activity — see console for details.', 'error');
      } finally {
        btn.disabled = false; btn.textContent = '⚠ Reset';
      }
    });

    await renderList(body, tab);
  }

  async function renderList(body, tab) {
    const listEl = body.querySelector('#apList');
    let rows;
    try {
      rows = await tab.fetch({ includeDeleted: true });
    } catch (err) {
      console.error(err);
      listEl.innerHTML = `<p style="text-align:center;color:var(--brick);">⚠️ Could not load submissions.</p>`;
      return;
    }
    const visible = rows.filter((r) => (activeSubView === 'deleted') === !!r.deleted);
    if (visible.length === 0) {
      listEl.innerHTML = `<p style="text-align:center;color:var(--ink-soft);">${activeSubView === 'deleted' ? 'Nothing soft-deleted.' : 'No submissions yet.'}</p>`;
      return;
    }
    listEl.innerHTML = visible.map((r) => `
      <div class="sketch-card admin-list__row" style="padding:12px;">
        <div class="admin-list__row-main">
          <span style="font-weight:700;color:var(--navy);">${escapeHtml(r.code || r.id)}</span>
          <span style="color:var(--ink-soft);font-size:12.5px;">"${escapeHtml(r[tab.textField] || '')}"</span>
        </div>
        <button class="doodle-btn sm ${activeSubView === 'deleted' ? '' : 'brick'}" data-code="${r.id}">${activeSubView === 'deleted' ? '♻️ Restore' : '🗑️ Delete'}</button>
      </div>`).join('');

    listEl.querySelectorAll('button[data-code]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const entryCode = btn.dataset.code;
        const deleting = activeSubView !== 'deleted';
        const confirmed = confirm(
          deleting
            ? `Soft-delete this ${tab.label} entry from "${entryCode}"?\n\nIt will disappear from the Gallery/Wall and their Bingo Card credit for it immediately — but it isn't erased, and can be restored any time from the Deleted tab.`
            : `Restore this ${tab.label} entry from "${entryCode}"?\n\nIt reappears in the Gallery/Wall and their Bingo Card credit for it is reinstated immediately.`
        );
        if (!confirmed) return;
        btn.disabled = true;
        try {
          await Store.setSubmissionDeleted(tab.key, entryCode, tab.bingoKey, deleting);
          Toast.show(deleting ? '🗑️ Entry soft-deleted.' : '♻️ Entry restored.', 'success');
          await renderList(body, tab);
        } catch (err) {
          console.error(err);
          Toast.show('⚠️ Could not update that entry.', 'error');
          btn.disabled = false;
        }
      });
    });
  }

  // Forces the next render() call to re-fetch the admin list from Firestore
  // instead of trusting the cache — called by js/dev-mode.js's "Manage
  // Admins" section right after it adds/removes a code, so that change is
  // reflected (the dock button appearing/disappearing) without needing a
  // full page reload.
  function invalidateCache() {
    adminCodesCache = null;
  }

  return { render, invalidateCache };
})();

window.AdminPanel = AdminPanel;
