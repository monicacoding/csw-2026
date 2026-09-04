// ---------------------------------------------------------------------------
// Single-page app orchestration: login overlay, the hub canvas (track +
// activity cards + bingo board), a generic modal system reused for every
// activity/leaderboard/secret view, and the finish-line celebration.
// ---------------------------------------------------------------------------

const Toast = (() => {
  let el = null;
  function ensure() {
    if (el) return el;
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
    return el;
  }
  function show(msg, type = '') {
    const t = ensure();
    t.textContent = msg;
    t.className = `toast show ${type}`;
    clearTimeout(t._hideTimer);
    t._hideTimer = setTimeout(() => { t.className = 'toast'; }, 2600);
  }
  return { show };
})();
window.Toast = Toast;

const App = (() => {
  let currentUser = null;

  async function init() {
    Cursor.init();
    Ambient.init();

    const code = Auth.getCurrentCode();
    if (code) {
      currentUser = await Store.getOrCreateUser(code);
      showHub();
    } else {
      showLogin();
    }
  }

  // ---------------- Login ----------------
  function showLogin() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appRoot').style.display = 'none';

    Mascot.mount(document.getElementById('mascotMount'), 'greet', "Hop in — let's go the extra mile!");

    const input = document.getElementById('codeInput');
    const pinInput = document.getElementById('pinInput');
    const errorEl = document.getElementById('loginError');
    const submitBtn = document.getElementById('loginForm').querySelector('button');
    input.value = '';
    pinInput.value = '';
    errorEl.hidden = true;
    input.style.borderColor = '';
    pinInput.style.borderColor = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Start Your Engine';

    input.addEventListener('input', () => {
      input.value = input.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    });
    pinInput.addEventListener('input', () => {
      pinInput.value = pinInput.value.replace(/[^0-9]/g, '').slice(0, 4);
    });

    function showLoginError(msg) {
      errorEl.textContent = msg;
      errorEl.hidden = false;
    }

    const form = document.getElementById('loginForm');
    form.onsubmit = async (e) => {
      e.preventDefault();
      errorEl.hidden = true;
      input.style.borderColor = '';
      pinInput.style.borderColor = '';

      const code = input.value.trim();
      const pin = pinInput.value.trim();

      if (!Auth.isValidCode(code)) {
        input.style.borderColor = 'var(--brick)';
        input.placeholder = '4 letters, A-Z only';
        return;
      }
      if (!Auth.isValidPin(pin)) {
        pinInput.style.borderColor = 'var(--brick)';
        showLoginError('PIN must be exactly 4 digits.');
        return;
      }

      const btn = form.querySelector('button');
      btn.disabled = true;
      btn.textContent = 'Starting…';

      try {
        const pinHash = await Auth.hashPin(pin);
        const existing = await Store.getUser(code);

        if (!existing) {
          // First time this short login has been seen — this PIN becomes theirs.
          const pinDigitHashes = await Auth.hashPinDigits(pin);
          currentUser = await Store.createUser(code, pinHash, pinDigitHashes);
        } else if (!existing.pinHash) {
          // A record from before PINs existed — adopt this PIN rather than
          // locking someone out of their existing progress.
          const pinDigitHashes = await Auth.hashPinDigits(pin);
          await Store.setPin(code, pinHash, pinDigitHashes);
          currentUser = await Store.getUser(code);
        } else if (existing.pinHash === pinHash) {
          await Store.touchLastSeen(code);
          currentUser = existing;
        } else {
          pinInput.style.borderColor = 'var(--brick)';
          showLoginError('Incorrect PIN for this login.');
          btn.disabled = false;
          btn.textContent = 'Start Your Engine';
          return;
        }

        Auth.setCurrentCode(code);
        showHub();
      } catch (err) {
        console.error(err);
        btn.disabled = false;
        btn.textContent = 'Start Your Engine';
        showLoginError('Something went wrong — please try again.');
      }
    };

    document.getElementById('forgotPinBtn').onclick = () => openForgotPinFlow();
  }

  // ---------------- Forgot PIN ----------------
  const PIN_RESET_MAX_ATTEMPTS = 5;
  const PIN_RESET_LOCKOUT_MS = 5 * 60 * 1000;

  let forgotModalEl = null;
  function ensureForgotModal() {
    if (forgotModalEl) return forgotModalEl;
    forgotModalEl = document.createElement('div');
    forgotModalEl.className = 'modal-backdrop';
    forgotModalEl.style.display = 'none';
    forgotModalEl.innerHTML = `
      <div class="sketch-modal" style="max-width:420px;text-align:center;">
        <button class="modal-close" id="fpClose">✕</button>
        <div id="fpContent"></div>
      </div>`;
    document.body.appendChild(forgotModalEl);
    forgotModalEl.addEventListener('click', (e) => { if (e.target === forgotModalEl) closeForgotModal(); });
    forgotModalEl.querySelector('#fpClose').addEventListener('click', closeForgotModal);
    return forgotModalEl;
  }
  function closeForgotModal() {
    if (forgotModalEl) forgotModalEl.style.display = 'none';
  }

  // A lock is active if pinResetLockedUntil is set and still in the future.
  function pinResetLockInfo(user) {
    if (!user?.pinResetLockedUntil) return { locked: false };
    const until = new Date(user.pinResetLockedUntil);
    const msLeft = until - Date.now();
    if (msLeft <= 0) return { locked: false };
    return { locked: true, minutesLeft: Math.max(1, Math.ceil(msLeft / 60000)) };
  }

  function openForgotPinFlow() {
    const modal = ensureForgotModal();
    modal.style.display = 'flex';
    const content = modal.querySelector('#fpContent');
    const prefill = document.getElementById('codeInput').value.trim();
    renderForgotCodeStep(content, Auth.isValidCode(prefill) ? prefill : '');
  }

  function renderForgotCodeStep(content, prefill) {
    content.innerHTML = `
      <h2 class="sketch-title" style="font-size:22px;">Forgot Your PIN?</h2>
      <p class="eyebrow-hand">Enter your short login to get started.</p>
      <div class="pin-field" style="text-align:left;">
        <label for="fpCode">Short Login</label>
        <input class="code-input" id="fpCode" maxlength="4" style="font-size:22px;padding:12px;" autocomplete="off" value="${prefill}" placeholder="ABCD" />
      </div>
      <p class="login-error" id="fpCodeError" hidden></p>
      <button class="doodle-btn" id="fpCodeNext" style="width:100%;margin-top:10px;">Continue</button>
    `;
    const codeInput = content.querySelector('#fpCode');
    codeInput.addEventListener('input', () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
    });
    content.querySelector('#fpCodeNext').addEventListener('click', async () => {
      const errEl = content.querySelector('#fpCodeError');
      errEl.hidden = true;
      const code = codeInput.value.trim();
      if (!Auth.isValidCode(code)) {
        errEl.textContent = '4 letters, A-Z only.';
        errEl.hidden = false;
        return;
      }
      const user = await Store.getUser(code);
      if (!user || !user.pinHash) {
        errEl.textContent = 'No account found for that login.';
        errEl.hidden = false;
        return;
      }
      const lock = pinResetLockInfo(user);
      if (lock.locked) {
        renderForgotLockedStep(content, code, lock);
        return;
      }
      renderForgotDigitStep(content, code);
    });
  }

  function renderForgotLockedStep(content, code, lock) {
    content.innerHTML = `
      <h2 class="sketch-title" style="font-size:22px;">Too Many Attempts</h2>
      <p class="eyebrow-hand">Too many incorrect guesses for "${code}". Please try again in about ${lock.minutesLeft} minute${lock.minutesLeft === 1 ? '' : 's'}.</p>
      <button class="doodle-btn ghost" id="fpBack" style="width:100%;margin-top:10px;">Back to Login</button>
    `;
    content.querySelector('#fpBack').addEventListener('click', closeForgotModal);
  }

  function renderForgotDigitStep(content, code) {
    content.innerHTML = `
      <h2 class="sketch-title" style="font-size:22px;">Verify It's You</h2>
      <p class="eyebrow-hand">Enter one digit that was part of your PIN for "${code}" — any position.</p>
      <div class="pin-field" style="text-align:left;">
        <label for="fpDigit">One Digit</label>
        <input class="code-input" id="fpDigit" maxlength="1" inputmode="numeric" style="font-size:26px;letter-spacing:0;padding:12px;" autocomplete="off" placeholder="•" />
      </div>
      <p class="login-error" id="fpDigitError" hidden></p>
      <button class="doodle-btn" id="fpDigitNext" style="width:100%;margin-top:10px;">Verify</button>
    `;
    const digitInput = content.querySelector('#fpDigit');
    digitInput.addEventListener('input', () => {
      digitInput.value = digitInput.value.replace(/[^0-9]/g, '').slice(0, 1);
    });
    content.querySelector('#fpDigitNext').addEventListener('click', async () => {
      const errEl = content.querySelector('#fpDigitError');
      errEl.hidden = true;
      const digit = digitInput.value.trim();
      if (!/^[0-9]$/.test(digit)) {
        errEl.textContent = 'Enter a single digit, 0–9.';
        errEl.hidden = false;
        return;
      }

      const freshUser = await Store.getUser(code); // re-check lock in case of a concurrent attempt
      const lock = pinResetLockInfo(freshUser);
      if (lock.locked) { renderForgotLockedStep(content, code, lock); return; }

      const digitHash = await Auth.hashPin(digit);
      if ((freshUser.pinDigitHashes || []).includes(digitHash)) {
        renderForgotNewPinStep(content, code);
        return;
      }

      const result = await Store.registerFailedPinReset(code, {
        maxAttempts: PIN_RESET_MAX_ATTEMPTS,
        lockoutMs: PIN_RESET_LOCKOUT_MS,
      });
      if (result.locked) {
        renderForgotLockedStep(content, code, { locked: true, minutesLeft: Math.ceil(PIN_RESET_LOCKOUT_MS / 60000) });
      } else {
        const remaining = PIN_RESET_MAX_ATTEMPTS - result.attempts;
        errEl.textContent = `Incorrect — that digit wasn't in your PIN. ${remaining} attempt${remaining === 1 ? '' : 's'} left.`;
        errEl.hidden = false;
      }
    });
  }

  function renderForgotNewPinStep(content, code) {
    content.innerHTML = `
      <h2 class="sketch-title" style="font-size:22px;">Set a New PIN</h2>
      <p class="eyebrow-hand">Choose a new 4-digit PIN for "${code}".</p>
      <div class="pin-field" style="text-align:left;">
        <label for="fpNewPin">New 4-Digit PIN</label>
        <input class="code-input" id="fpNewPin" maxlength="4" type="password" inputmode="numeric" style="font-size:26px;padding:12px;" autocomplete="off" placeholder="••••" />
      </div>
      <p class="login-error" id="fpNewPinError" hidden></p>
      <button class="doodle-btn" id="fpNewPinSave" style="width:100%;margin-top:10px;">Save New PIN</button>
    `;
    const pinInput = content.querySelector('#fpNewPin');
    pinInput.addEventListener('input', () => {
      pinInput.value = pinInput.value.replace(/[^0-9]/g, '').slice(0, 4);
    });
    content.querySelector('#fpNewPinSave').addEventListener('click', async () => {
      const errEl = content.querySelector('#fpNewPinError');
      errEl.hidden = true;
      const newPin = pinInput.value.trim();
      if (!Auth.isValidPin(newPin)) {
        errEl.textContent = 'PIN must be exactly 4 digits.';
        errEl.hidden = false;
        return;
      }
      const pinHash = await Auth.hashPin(newPin);
      const pinDigitHashes = await Auth.hashPinDigits(newPin);
      await Store.resetPin(code, pinHash, pinDigitHashes);
      closeForgotModal();

      const codeInput = document.getElementById('codeInput');
      const loginPinInput = document.getElementById('pinInput');
      codeInput.value = code;
      loginPinInput.value = '';
      loginPinInput.focus();
      Toast.show('🔑 PIN reset — log in with your new PIN.', 'success');
    });
  }

  // ---------------- Hub ----------------
  function showHub() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appRoot').style.display = 'block';
    // Read the persisted glyph fresh rather than trusting currentUser, which
    // may not have been refreshed since the player last changed it via the
    // cursor picker (that writes straight to the store, not to currentUser).
    Cursor.setGlyph(MockDB.getDoc('users', currentUser.code)?.cursorGlyph || '🏎️');
    renderPlayerBadge();
    renderPreviewStrip();
    renderTrack();
    renderActivityBoard();
    maybeShowFinishLine();
  }

  async function refreshUser() {
    currentUser = await Store.getUser(currentUser.code);
    return currentUser;
  }

  function renderPlayerBadge() {
    let badge = document.getElementById('playerBadge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'playerBadge';
      badge.className = 'player-badge';
      document.body.appendChild(badge);
    }
    // The avatar always shows a plain cursor icon — a constant "click here
    // to change your cursor" affordance, not a reflection of the current
    // choice (that's what the picker's own highlighted option is for).
    badge.innerHTML = `
      <button class="player-badge__avatar" id="avatarBtn" title="${currentUser.code} — click to change your cursor">${Icons.cursor}</button>
      <button class="player-badge__exit" id="exitBtn" title="Log out">✕</button>
    `;
    badge.querySelector('#avatarBtn').addEventListener('click', () => CursorPicker.toggle());
    badge.querySelector('#exitBtn').addEventListener('click', () => {
      Auth.logOut();
      currentUser = null;
      document.getElementById('playerBadge')?.remove();
      document.getElementById('previewStrip')?.remove();
      CursorPicker.close();
      showLogin();
    });
  }

  function renderPreviewStrip() {
    let strip = document.getElementById('previewStrip');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'previewStrip';
      strip.className = 'preview-strip';
      document.body.appendChild(strip);
    }
    const currentOverride = localStorage.getItem('csw2026_preview_date') || '';
    const dayBtns = CSW_SCHEDULE.map((d) =>
      `<button data-date="${d.date}" class="${d.date === currentOverride ? 'is-active' : ''}">${d.label.slice(0,3)}</button>`
    ).join('');
    strip.innerHTML = `
      <span>🔧 PREVIEW —</span>
      ${dayBtns}
      <button data-date="">Real</button>
      <button id="resetPreviewData">Reset</button>
    `;
    strip.querySelectorAll('button[data-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.dataset.date) localStorage.setItem('csw2026_preview_date', btn.dataset.date);
        else localStorage.removeItem('csw2026_preview_date');
        showHub();
      });
    });
    strip.querySelector('#resetPreviewData').addEventListener('click', () => {
      MockDB.reset();
      localStorage.removeItem('csw2026_preview_date');
      Auth.logOut();
      currentUser = null;
      document.getElementById('playerBadge')?.remove();
      document.getElementById('previewStrip')?.remove();
      showLogin();
    });
  }

  // Builds the hover-popover markup for one timeline day, straight from
  // `d.day.activities` — every activity that day, not just the tracked
  // portal one. Nothing here is a separately-maintained list: add an
  // activity (remote or on-site) to CSW_SCHEDULE and it shows up here
  // automatically. This is schedule information only — deliberately no
  // per-user completion status (Completed/Missed/etc.); that lives on the
  // activity cards below, not here.
  function dayPopoverHTML(d) {
    const itemsHTML = d.day.activities.map((a) => {
      const typeClass = a.type === 'onsite' ? 'onsite' : 'remote';
      const typeLabel = a.type === 'onsite' ? 'On-Site' : 'Remote';
      return `<div class="track-marker-popover__item">
                <div class="track-marker-popover__item-row">
                  <span class="track-marker-popover__activity">${a.title}</span>
                  <span class="track-marker-popover__type ${typeClass}">${typeLabel}</span>
                </div>
              </div>`;
    }).join('');

    return `<div class="track-marker-popover">
              <div class="track-marker-popover__day">${d.day.label} · ${formatShortDate(d.day.date)}</div>
              <div class="track-marker-popover__theme">${d.day.theme}</div>
              ${itemsHTML}
            </div>`;
  }

  function renderTrack() {
    const days = AppState.computeDashboardDays(currentUser);
    const completed = AppState.completedDayCount(currentUser);

    const markers = document.getElementById('trackMarkers');
    markers.innerHTML = days.map((d) => {
      const cls = d.tileState === 'done' ? 'past' : d.tileState === 'active' ? 'active' : d.tileState === 'missed' ? 'missed' : '';
      const glyph = d.tileState === 'done' ? '✓' : d.tileState === 'missed' ? '✕' : d.day.label[0];
      return `<div class="track-marker ${cls}" tabindex="0" aria-label="${d.day.label}: ${d.day.theme} — ${d.activity.title}">
                <div class="track-marker-label">${d.day.label}<span class="track-marker-date">${formatShortDate(d.day.date)}</span></div>
                ${glyph}
                ${dayPopoverHTML(d)}
              </div>`;
    }).join('');

    // The mascot is pinned to the corner (see .track-mascot in sketch.css) —
    // only its pose/speech reflect progress now, not a horizontal position.
    const mascotEl = document.getElementById('trackMascot');
    const state = completed === 0 ? 'greet' : completed >= 5 ? 'celebrate' : 'running';
    const speechText = completed === 0 ? "Let's get rolling!" : completed >= 5 ? 'Full house — amazing!' : `${completed} down, ${5 - completed} to go!`;
    mascotEl.innerHTML = `
      <div class="speech">${speechText}</div>
      <div class="mascot-bob"><img src="${Mascot.src(state)}" alt="Mascot" /></div>
    `;
    Mascot.attachEasterEgg(mascotEl);
  }

  function renderActivityBoard() {
    const days = AppState.computeDashboardDays(currentUser);
    const grid = document.getElementById('activityGrid');
    grid.innerHTML = days.map(({ day, activity, tileState }, i) => {
      const rot = [-2, 1.5, -1, 2, -1.5][i % 5];
      const statusIcon = tileState === 'done'
        ? `<span style="color:var(--success);">${Icons.check}</span>`
        : tileState === 'locked' ? `<span style="width:16px;display:inline-block;color:var(--ink-soft);">${Icons.lock}</span>` : '';
      const statusText = tileState === 'active' ? 'Play now →' : tileState === 'locked' ? 'Locked' : tileState === 'done' ? 'Completed' : "Time's up";
      return `
        <div class="sketch-card activity-card ${tileState === 'locked' ? 'locked' : 'interactive'} ${tileState}"
             style="--hover-rot:${rot}deg;" data-activity="${activity.id}" data-locked="${tileState === 'locked'}">
          <div class="activity-card__medal">${pillarIcon(day.pillarIcon)}</div>
          <div class="activity-card__day">${day.label} · ${day.theme}</div>
          <div class="activity-card__title">${activity.title}</div>
          <div class="activity-card__status ${tileState === 'done' ? 'done' : tileState}">${statusIcon} ${statusText}</div>
        </div>`;
    }).join('');

    grid.querySelectorAll('.activity-card').forEach((card) => {
      card.addEventListener('click', () => {
        if (card.dataset.locked === 'true') {
          Toast.show('🔒 Not unlocked yet — check back on the day!', 'error');
          return;
        }
        openActivityModal(card.dataset.activity);
      });
    });
  }

  function openBingoModal() {
    openModal((body) => {
      body.innerHTML = `
        <h2 class="sketch-title brick" style="text-align:center;width:100%;">Bingo Card</h2>
        <p style="text-align:center;color:var(--ink-soft);margin-bottom:18px;">Complete all five activities to check every square, then unlock the bonus tile.</p>
        <div class="bingo-grid" id="bingoGrid" style="max-width:none;"></div>
      `;
      renderBingoBoard(body.querySelector('#bingoGrid'));
    });
  }

  function renderBingoBoard(grid) {
    const bingo = { ...Store.emptyBingo(), ...(currentUser.bingo || {}) };
    const cells = [
      { key: 'nomination', title: 'Who Went The Extra Mile?' },
      { key: 'hyperlinkRace', title: 'Hyperlink Race' },
      { key: 'photoFinish', title: 'Photo Finish' },
      { key: 'snapJudgement', title: 'Snap Judgement' },
      { key: 'trivia', title: 'Race Day Trivia' },
    ];
    const coreComplete = AppState.bingoCoreComplete(currentUser);
    grid.innerHTML = cells.map((c, i) => {
      const checked = bingo[c.key];
      const rot = [1.5, -2, 1, -1, 2][i % 5];
      return `
        <div class="sketch-card bingo-cell interactive ${checked ? 'checked' : ''}" style="--hover-rot:${rot}deg;" data-activity="${c.key}">
          <div class="bingo-medal">${checked ? Icons.check : Icons.star}</div>
          <div class="bingo-cell__title">${c.title}</div>
        </div>`;
    }).join('') + `
      <div class="sketch-card bingo-cell interactive ${bingo.bonus ? 'bonus secret-glow' : coreComplete ? 'bonus' : 'bonus-locked'}" style="--hover-rot:-1.5deg;" id="bonusCell">
        <div class="bingo-medal" style="${bingo.bonus ? 'background:var(--gold);color:var(--navy);' : ''}">${bingo.bonus ? Icons.trophy : Icons.lock}</div>
        <div class="bingo-cell__title">${bingo.bonus ? 'Bonus Unlocked! 🎉' : 'Bonus Square'}</div>
        ${!bingo.bonus ? `<div style="font-family:var(--font-hand);font-size:13px;">Complete all 5 to unlock</div>` : ''}
      </div>`;

    grid.querySelectorAll('.bingo-cell[data-activity]').forEach((cell) => {
      cell.addEventListener('click', () => {
        const key = cell.dataset.activity;
        if (bingo[key]) { Toast.show('Already checked off — nice work!', 'success'); return; }
        if (!isActivityUnlocked(key)) { Toast.show('🔒 Not unlocked yet — check back on the day!', 'error'); return; }
        openActivityModal(key);
      });
    });
    document.getElementById('bonusCell').addEventListener('click', () => {
      if (bingo.bonus) Toast.show('🏆 Full house! You already claimed the bonus.', 'success');
      else Toast.show('Complete the other 5 squares first!', 'error');
    });
  }

  // ---------------- Generic modal ----------------
  function ensureModal() {
    let modal = document.getElementById('genericModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'genericModal';
      modal.className = 'modal-backdrop';
      modal.style.display = 'none';
      modal.innerHTML = `<div class="sketch-modal"><button class="modal-close" id="genericModalClose">✕</button><div id="genericModalBody"></div></div>`;
      document.body.appendChild(modal);
      modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
      modal.querySelector('#genericModalClose').addEventListener('click', closeModal);
    }
    return modal;
  }
  function openModal(renderFn) {
    const modal = ensureModal();
    modal.style.display = 'flex';
    const body = modal.querySelector('#genericModalBody');
    renderFn(body);
  }
  function closeModal() {
    const modal = document.getElementById('genericModal');
    if (modal) modal.style.display = 'none';
  }

  function openActivityModal(activityId) {
    const fnMap = {
      hyperlinkRace: Games.hyperlinkRace,
      snapJudgement: Games.snapJudgement,
      trivia: Games.trivia,
      photoFinish: Games.photoFinish,
      nomination: Games.nomination,
    };
    const fn = fnMap[activityId];
    if (!fn) return;
    const day = findActivityDay(activityId); // schedule is the single source of truth for the day/theme header
    openModal((body) => {
      // Two ways an activity can hand control back:
      //  - done(): the usual case — submission is final, close the modal and
      //    bounce back to the hub with a toast (Hyperlink Race, Snap
      //    Judgement, Trivia).
      //  - refresh(): submission is logged and the hub's bingo/score state
      //    should update in the background, but the modal stays open so the
      //    activity can show a post-submit view in place (Photo Finish's
      //    Gallery, the nomination's Recognition Wall).
      fn(body, currentUser, day, {
        done: async () => {
          await refreshUser();
          closeModal();
          showHub();
          Toast.show('🏁 Nice work — logged!', 'success');
        },
        refresh: async () => {
          await refreshUser();
          showHub();
        },
      });
    });
  }

  // ---------------- Leaderboard ----------------
  const BOARDS = [
    { key: 'combined', label: 'Combined Overall' },
    { key: 'hyperlinkRaceEntries', label: 'Hyperlink Race' },
    { key: 'snapJudgementEntries', label: 'Snap Judgement' },
    { key: 'triviaEntries', label: 'Race Day Trivia' },
    { key: 'photoFinishEntries', label: 'Photo Finish (votes)' },
  ];
  // Shown only to a user who has actually played the secret mini-game (see
  // visibleBoards below) — undiscovered players don't get a hint that this
  // tab exists at all, keeping the easter-egg's spirit intact.
  const SECRET_BOARD = { key: 'minigameEntries', label: '🤫 Secret Leaderboard' };

  // Per-user, not global: whether *this* user has a recorded mini-game
  // score (not just whether they've clicked the mascot enough times to
  // "find" it — see Store.recordMinigameScore vs markEasterEggFound).
  async function hasMinigameScore() {
    return currentUser ? Store.hasSubmitted('minigameEntries', currentUser.code) : false;
  }

  async function visibleBoards() {
    return (await hasMinigameScore()) ? [...BOARDS, SECRET_BOARD] : BOARDS;
  }

  // `activeKey` lets a caller deep-link straight to one activity's tab
  // (e.g. an activity's "View Leaderboard" button — see
  // Games.renderAlreadyCompleted in js/games.js) instead of always landing
  // on the combined view. Falls back to 'combined' for an unrecognized key
  // rather than rendering a tab-less blank state.
  async function openLeaderboardModal(activeKey = 'combined') {
    const boards = await visibleBoards();
    const key = boards.some((b) => b.key === activeKey) ? activeKey : 'combined';
    openModal((body) => renderLeaderboard(body, key));
  }

  async function renderLeaderboard(body, active) {
    body.innerHTML = `
      <h2 class="sketch-title" style="text-align:center;width:100%;">Leaderboard</h2>
      <div id="lbChampion"></div>
      <div class="lb-tabs" id="lbTabs"></div>
      <div id="lbList"></div>
    `;
    const boards = await visibleBoards();
    body.querySelector('#lbTabs').innerHTML = boards.map((b) =>
      `<button class="doodle-btn sm ${b.key === active ? '' : 'ghost'}" data-key="${b.key}">${b.label}</button>`
    ).join('');
    body.querySelectorAll('#lbTabs button').forEach((btn) => {
      btn.addEventListener('click', () => renderLeaderboard(body, btn.dataset.key));
    });

    let rows = [], getScore = (r) => r.score, scoreLabel = 'pts';
    if (active === 'combined') {
      rows = await Store.getCombinedLeaderboard(50);
      getScore = (r) => r.totalScore || 0;
    } else if (active === 'hyperlinkRaceEntries') {
      rows = await Store.getLeaderboard(active, { orderBy: 'elapsedMs', direction: 'asc' });
      scoreLabel = '';
      getScore = (r) => { const s = Math.round((r.elapsedMs||0)/1000); return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`; };
    } else if (active === 'photoFinishEntries') {
      rows = await Store.getLeaderboard(active, { orderBy: 'votes', direction: 'desc' });
      scoreLabel = 'votes';
      getScore = (r) => r.votes || 0;
    } else {
      // Covers every remaining per-activity board generically, including
      // the secret one (minigameEntries) — same {code, score} row shape.
      rows = await Store.getLeaderboard(active, { orderBy: 'score', direction: 'desc' });
    }

    const listEl = body.querySelector('#lbList');
    const champEl = body.querySelector('#lbChampion');
    if (rows.length === 0) {
      listEl.innerHTML = `<p style="text-align:center;color:var(--ink-soft);">No entries yet — be the first to post a score!</p>`;
      champEl.innerHTML = '';
      return;
    }
    champEl.innerHTML = `
      <div class="lb-champion">
        <div class="mascot-bob"><img src="${Mascot.src('celebrate')}" alt="" /></div>
        <div class="lb-champion__info">
          <div class="doodle-tag">Current Leader</div>
          <div class="lb-champion__name">${rows[0].code || rows[0].id}</div>
        </div>
      </div>
    `;
    listEl.innerHTML = rows.map((r, i) => {
      const rank = i + 1;
      const code = r.code || r.id;
      const scoreVal = getScore(r);
      return `<div class="lb-row rank-${rank}"><div class="lb-rank">${rank}</div><div class="lb-code">${code}</div><div class="lb-score">${scoreVal}${typeof scoreVal === 'number' && scoreLabel ? ' '+scoreLabel : ''}</div></div>`;
    }).join('');
  }

  // ---------------- Secret leaderboard ----------------
  async function openSecretLeaderboard() {
    await refreshUser();
    openModal(async (body) => {
      if (!currentUser.easterEgg || !currentUser.easterEgg.found) {
        body.innerHTML = `
          <div style="text-align:center;">
            <div class="mascot-bob"><img src="${Mascot.src('wink')}" style="width:110px;border-radius:16px;" /></div>
            <p style="font-family:var(--font-hand);font-size:18px;color:var(--ink-soft);">Nothing to see here… yet. 🤫</p>
          </div>`;
        return;
      }
      const rows = await Store.getLeaderboard('minigameEntries', { orderBy: 'score', direction: 'desc', limit: 50 });
      body.innerHTML = `
        <div style="text-align:center;">
          <div class="mascot-bob"><img src="${Mascot.src('celebrate')}" style="width:90px;border-radius:14px;" /></div>
          <h2 class="sketch-title secret-glow" style="font-size:24px;">🤫 Secret Leaderboard</h2>
          <p style="font-family:var(--font-hand);color:var(--ink-soft);">Mile Dash high scores — only found by the curious.</p>
        </div>
        <div id="secretList" style="margin-top:14px;"></div>`;
      const list = body.querySelector('#secretList');
      list.innerHTML = rows.length === 0
        ? `<p style="text-align:center;color:var(--ink-soft);">No scores yet. Be the first!</p>`
        : rows.map((r, i) => `<div class="lb-row rank-${i+1}"><div class="lb-rank">${i+1}</div><div class="lb-code">${r.code}</div><div class="lb-score">${r.score} pts</div></div>`).join('');
    });
  }

  // ---------------- Finish line ----------------
  async function maybeShowFinishLine() {
    if (AppState.bingoFullHouse(currentUser) && !currentUser.finishLineSeenAt) {
      await Store.markFinishLineSeen(currentUser.code);
      currentUser.finishLineSeenAt = MockDB.now();
      const overlay = document.createElement('div');
      overlay.className = 'finish-overlay';
      overlay.innerHTML = `
        <div class="sketch-card finish-card">
          <div style="font-size:28px;">🎉 🏁 🎉</div>
          <div class="mascot-bob" style="display:inline-block;"><img src="${Mascot.src('finish')}" alt="Mascot crossing the finish line" /></div>
          <h1>You Went the Extra Mile!</h1>
          <p style="color:var(--ink-soft);font-size:16px;">You completed the full Bingo Card — every square checked. See you at Friday's Victory Lap Party!</p>
          <div style="display:flex;gap:14px;justify-content:center;margin-top:10px;">
            <button class="doodle-btn" id="flLeaderboard">See the Leaderboard</button>
            <button class="doodle-btn ghost" id="flClose">Back to Hub</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#flClose').addEventListener('click', () => overlay.remove());
      overlay.querySelector('#flLeaderboard').addEventListener('click', () => { overlay.remove(); openLeaderboardModal(); });
    }
  }

  return { init, openActivityModal, openLeaderboardModal, openBingoModal, openSecretLeaderboard };
})();
window.App = App;

document.addEventListener('DOMContentLoaded', () => App.init());
