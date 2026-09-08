// ---------------------------------------------------------------------------
// The cursor picker: a small popover (opened by clicking the player badge's
// avatar, which always shows a plain cursor icon — a constant affordance,
// not a reflection of the current choice) that lets the player swap the
// custom cursor glyph. Applies instantly via Cursor.setGlyph and persists on
// the user's record (Store.setCursorGlyph) so it sticks for the session,
// same as everything else pending the real Firestore swap.
// ---------------------------------------------------------------------------

const CursorPicker = (() => {
  const OPTIONS = ['🏎️', '🏁', '⚡', '⭐', '🏆', '🔥'];
  let panel = null;

  function ensurePanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.className = 'cursor-picker-panel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <div class="cursor-picker-panel__title">Pick Your Cursor</div>
      <div class="cursor-picker-panel__grid" id="cpGrid"></div>
    `;
    document.body.appendChild(panel);

    document.addEventListener('click', (e) => {
      if (panel.style.display !== 'flex') return;
      if (panel.contains(e.target)) return;
      if (e.target.closest('#avatarBtn')) return; // the toggle button handles itself
      close();
    });

    return panel;
  }

  function renderOptions(current) {
    const grid = panel.querySelector('#cpGrid');
    grid.innerHTML = OPTIONS.map((glyph) =>
      `<button class="cursor-picker-option ${glyph === current ? 'is-selected' : ''}" data-glyph="${glyph}">${glyph}</button>`
    ).join('');
    grid.querySelectorAll('.cursor-picker-option').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const glyph = btn.dataset.glyph;
        Cursor.setGlyph(glyph);
        grid.querySelectorAll('.cursor-picker-option').forEach((b) => b.classList.toggle('is-selected', b === btn));

        const code = Auth.getCurrentCode();
        if (code) {
          try { await Store.setCursorGlyph(code, glyph); } catch (e) { console.warn('Could not save cursor choice', e); }
        }
      });
    });
  }

  function position() {
    const avatarBtn = document.getElementById('avatarBtn');
    if (!avatarBtn) return;
    const anchor = document.getElementById('previewStrip') || document.getElementById('playerBadge');
    const rect = (anchor || avatarBtn).getBoundingClientRect();
    panel.style.top = `${rect.bottom + 10}px`;
    panel.style.right = '28px';
  }

  function open(currentGlyph) {
    ensurePanel();
    renderOptions(currentGlyph);
    position();
    panel.style.display = 'flex';
  }

  function close() {
    if (panel) panel.style.display = 'none';
  }

  async function toggle() {
    ensurePanel();
    if (panel.style.display === 'flex') { close(); return; }
    const code = Auth.getCurrentCode();
    const user = code ? await FirestoreDB.getDoc('users', code) : null;
    open(user?.cursorGlyph || '🏎️');
  }

  return { toggle, open, close };
})();

window.CursorPicker = CursorPicker;
