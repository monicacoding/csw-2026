// ---------------------------------------------------------------------------
// The cursor picker: a small popover (opened by clicking the player badge's
// avatar, which always shows a plain cursor icon — a constant affordance,
// not a reflection of the current choice) that lets the player swap the
// custom cursor glyph — or turn the custom cursor off. "Default cursor" leads
// the options because it's the fix for a laggy machine (it removes the custom
// cursor and its trail entirely), not just a style preference. Applies
// instantly and persists on the user's record via DisplayPrefs — this module
// only draws the UI and forwards clicks.
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
    // "Default cursor" leads, full-width, ahead of the emoji choices: it's
    // the answer to a performance complaint, so it should be the first thing
    // someone struggling with lag sees, not a seventh-of-seven afterthought.
    grid.innerHTML = `
      <button class="cursor-picker-option cursor-picker-option--none ${current === Cursor.NONE ? 'is-selected' : ''}" data-glyph="${Cursor.NONE}" title="Use your normal system cursor — no custom cursor, no trail (smoothest)">
        Default cursor <span>(fastest)</span>
      </button>
      ${OPTIONS.map((glyph) =>
        `<button class="cursor-picker-option ${glyph === current ? 'is-selected' : ''}" data-glyph="${glyph}">${glyph}</button>`
      ).join('')}
    `;
    grid.querySelectorAll('.cursor-picker-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        DisplayPrefs.setGlyph(btn.dataset.glyph);
        grid.querySelectorAll('.cursor-picker-option').forEach((b) => b.classList.toggle('is-selected', b === btn));
      });
    });
  }

  function position() {
    const avatarBtn = document.getElementById('avatarBtn');
    if (!avatarBtn) return;
    const anchor = document.getElementById('devModePanel') || document.getElementById('playerBadge');
    const rect = (anchor || avatarBtn).getBoundingClientRect();
    panel.style.top = `${rect.bottom + 10}px`;
    panel.style.right = '28px';
  }

  function open() {
    ensurePanel();
    renderOptions(DisplayPrefs.getGlyph());
    position();
    panel.style.display = 'flex';
  }

  function close() {
    if (panel) panel.style.display = 'none';
  }

  function toggle() {
    ensurePanel();
    if (panel.style.display === 'flex') { close(); return; }
    open();
  }

  return { toggle, open, close };
})();

window.CursorPicker = CursorPicker;
