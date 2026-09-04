// ---------------------------------------------------------------------------
// Easter egg mini-game: a light dodge/collect runner starring the mascot.
// Triggered by clicking the mascot in the corner 7× (see mascot.js).
// Self-contained modal + canvas. Logs a score via Store.recordMinigameScore
// and, once found, unlocks the secret leaderboard view (App.openSecretLeaderboard).
// ---------------------------------------------------------------------------

const Minigame = (() => {
  const LANE_COUNT = 3;
  const COIN_VALUE = 10;
  const PLAYER_GLYPH = '🏎️';
  const COIN_GLYPH = '🪙';
  const OBSTACLE_GLYPH = '🚧';
  const LIFE_GLYPH = '❤️';
  const STARTING_LIVES = 3;

  // Difficulty ramp: survival-based, not a countdown. Both fall speed and
  // spawn frequency scale continuously with elapsed survival time. Fall
  // speed is deliberately uncapped — it keeps climbing the longer a skilled
  // player lasts. Spawn frequency ramps at the same rate the old 30s curve
  // used (so the first ~30s feels identical to before) but is floored, since
  // a spawn interval can't sensibly reach zero.
  const BASE_FALL_SPEED = 3.4;
  const FALL_SPEED_RAMP_PER_SEC = 0.16;
  const BASE_SPAWN_MS = 720;
  const MIN_SPAWN_MS = 300;
  const SPAWN_RAMP_MS_PER_SEC = 14;

  // Score = coins collected, minus a modest time penalty that rewards
  // efficiency without overriding the benefit of surviving longer to grab
  // more coins overall. Tuned so that for two runs a full "extra" coin
  // (worth COIN_VALUE) always outweighs even a large survival-time gap:
  // e.g. 15 coins/30s (105) still beats 10 coins/15s (77.5), while 10
  // coins/20s (70) beats the slower 10 coins/30s (55) on the same coin count.
  const TIME_PENALTY_PER_SEC = 1.5;

  let modalEl = null;
  let openedAt = 0;

  function ensureModal() {
    if (modalEl) return modalEl;
    modalEl = document.createElement('div');
    modalEl.className = 'modal-backdrop';
    modalEl.style.display = 'none';
    modalEl.innerHTML = `
      <div class="sketch-modal" style="max-width:520px;text-align:center;">
        <button class="modal-close" id="mgCloseX">✕</button>
        <div id="mgContent"></div>
      </div>`;
    document.body.appendChild(modalEl);
    // A short grace period after opening protects against the very rapid
    // extra clicks that unlocked the egg landing on the backdrop itself
    // (position:fixed, covers the whole viewport) and closing it again
    // the instant it appears.
    modalEl.addEventListener('click', (e) => {
      if (e.target !== modalEl) return;
      if (Date.now() - openedAt < 700) return;
      close();
    });
    modalEl.querySelector('#mgCloseX').addEventListener('click', close);
    return modalEl;
  }

  function isOpen() {
    return !!modalEl && modalEl.style.display === 'flex';
  }

  function close() {
    if (modalEl) modalEl.style.display = 'none';
  }

  function open({ celebrateFind = false } = {}) {
    const modal = ensureModal();
    openedAt = Date.now();
    modal.style.display = 'flex';
    const content = modal.querySelector('#mgContent');

    if (celebrateFind) {
      content.innerHTML = `
        <div style="animation: mgPop 0.5s ease;">
          <img src="${Mascot.src('wink')}" style="width:120px;border-radius:16px;margin-bottom:10px;" alt="Mascot" />
          <h2 class="sketch-title" style="font-size:24px;">You Found It!</h2>
          <p class="eyebrow-hand">A secret mini-game, just for curious clickers like you.</p>
          <button class="doodle-btn" id="mgStart">Play Now</button>
        </div>
        <style>@keyframes mgPop { from { transform: scale(0.7) rotate(-4deg); opacity:0; } to { transform: scale(1) rotate(0); opacity:1; } }</style>
      `;
      content.querySelector('#mgStart').addEventListener('click', showIntro);
    } else {
      showIntro();
    }

    function showIntro() {
      content.innerHTML = `
        <h2 class="sketch-title" style="font-size:24px;">Mile Dash</h2>
        <div class="mg-explainer">
          <p>🎮 <span><strong>Controls:</strong> tap ← → (or A / D) to switch lanes.</span></p>
          <p>${COIN_GLYPH} <span><strong>Coins</strong> are worth ${COIN_VALUE} points each — grab every one you can reach.</span></p>
          <p>${OBSTACLE_GLYPH} <span><strong>Obstacles</strong> cost you a life on contact — steer clear of them.</span></p>
          <p>${LIFE_GLYPH} <span>You start with <strong>${STARTING_LIVES} lives</strong> — the run ends the moment you lose them all.</span></p>
          <p>🏁 <span><strong>Goal:</strong> survive as long as you can and grab every coin you can reach — it only gets faster the longer you last!</span></p>
        </div>
        <button class="doodle-btn" id="mgPlay">Start Engines</button>
      `;
      content.querySelector('#mgPlay').addEventListener('click', startGame);
    }

    function startGame() {
      content.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;font-family:var(--font-hand);font-size:18px;color:var(--navy);margin-bottom:8px;padding-right:44px;">
          <span id="mgScore">Score: 0</span>
          <div class="mg-lives" id="mgLives"></div>
          <span id="mgTime">Time: 0s</span>
        </div>
        <canvas id="mgCanvas" width="440" height="360" style="background:var(--sage);border-radius:20px;border:2.5px solid var(--navy);"></canvas>
      `;
      runGame(content);
    }

    function runGame(content) {
      const canvas = content.querySelector('#mgCanvas');
      const ctx = canvas.getContext('2d');
      const laneWidth = canvas.width / LANE_COUNT;
      let playerLane = 1;
      let score = 0;
      let coinsCollected = 0;
      let lives = STARTING_LIVES;
      let renderedLives = null;
      const startTime = Date.now();
      let entities = [];
      let spawnTimer = 0;
      let running = true;

      function renderLives() {
        if (lives === renderedLives) return;
        renderedLives = lives;
        const livesEl = content.querySelector('#mgLives');
        if (!livesEl) return;
        livesEl.innerHTML = [0, 1, 2].map((i) =>
          `<span class="mg-life-icon ${i >= lives ? 'lost' : ''}">${LIFE_GLYPH}</span>`
        ).join('');
      }
      renderLives();

      function keyHandler(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a') playerLane = Math.max(0, playerLane - 1);
        if (e.key === 'ArrowRight' || e.key === 'd') playerLane = Math.min(LANE_COUNT - 1, playerLane + 1);
      }
      window.addEventListener('keydown', keyHandler);

      function spawn() {
        const lane = Math.floor(Math.random() * LANE_COUNT);
        const type = Math.random() < 0.35 ? 'cone' : 'coin';
        entities.push({ lane, y: -30, type });
      }

      function loop() {
        if (!running) return;
        const elapsed = Date.now() - startTime;
        const elapsedSeconds = elapsed / 1000;
        const timeEl = content.querySelector('#mgTime');
        if (timeEl) timeEl.textContent = `Time: ${Math.floor(elapsedSeconds)}s`;

        // Survival format: the only end condition is running out of lives.
        if (lives <= 0) { endGame(elapsedSeconds); return; }

        // Ramp difficulty with elapsed survival time — fall speed is
        // deliberately uncapped, so it keeps climbing the longer you last.
        const fallSpeed = BASE_FALL_SPEED + elapsedSeconds * FALL_SPEED_RAMP_PER_SEC;
        const spawnInterval = Math.max(MIN_SPAWN_MS, BASE_SPAWN_MS - elapsedSeconds * SPAWN_RAMP_MS_PER_SEC);

        spawnTimer += 16;
        if (spawnTimer > spawnInterval) { spawn(); spawnTimer = 0; }

        entities.forEach((e) => (e.y += fallSpeed));

        const playerY = canvas.height - 50;
        entities = entities.filter((e) => {
          if (e.y > playerY - 18 && e.y < playerY + 18 && e.lane === playerLane) {
            if (e.type === 'coin') { score += COIN_VALUE; coinsCollected += 1; } else lives -= 1;
            return false;
          }
          return e.y < canvas.height + 40;
        });

        const scoreEl = content.querySelector('#mgScore');
        if (scoreEl) scoreEl.textContent = `Score: ${score}`;
        renderLives();

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#E7EEE9';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#1D3557';
        ctx.setLineDash([10, 10]);
        for (let i = 1; i < LANE_COUNT; i++) {
          ctx.beginPath();
          ctx.moveTo(laneWidth * i, 0);
          ctx.lineTo(laneWidth * i, canvas.height);
          ctx.stroke();
        }
        ctx.setLineDash([]);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        entities.forEach((e) => {
          const cx = laneWidth * e.lane + laneWidth / 2;
          ctx.font = '26px serif';
          ctx.fillText(e.type === 'coin' ? COIN_GLYPH : OBSTACLE_GLYPH, cx, e.y);
        });

        const px = laneWidth * playerLane + laneWidth / 2;
        ctx.font = '32px serif';
        ctx.fillText(PLAYER_GLYPH, px, playerY);

        requestAnimationFrame(loop);
      }

      requestAnimationFrame(loop);

      async function endGame(elapsedSeconds) {
        running = false;
        window.removeEventListener('keydown', keyHandler);

        // Survival format: every run ends at 0 lives by definition, so a
        // lives-based multiplier no longer means anything — coins collected
        // are the primary driver. A modest time penalty layers in on top as
        // an efficiency tiebreaker: for the same coin count, the faster run
        // scores higher, but it's never enough to let a short low-coin run
        // beat a longer high-coin one (see TIME_PENALTY_PER_SEC above).
        const survived = Math.floor(elapsedSeconds);
        const timePenalty = Math.round(elapsedSeconds * TIME_PENALTY_PER_SEC);
        const finalScore = Math.max(0, score - timePenalty);

        const code = Auth.getCurrentCode();
        if (code) {
          try { await Store.recordMinigameScore(code, finalScore); } catch (e) { console.warn(e); }
        }
        content.innerHTML = `
          <h2 class="sketch-title" style="font-size:24px;">Game Over!</h2>
          <div style="font-family:var(--font-display);font-size:40px;color:var(--navy);margin:10px 0;">${finalScore} pts</div>
          <p class="eyebrow-hand">${coinsCollected} coin${coinsCollected === 1 ? '' : 's'} collected · survived ${survived}s</p>
          <p class="eyebrow-hand">${score} coin pts − ${timePenalty} time penalty = ${finalScore}</p>
          <p class="eyebrow-hand">Your score has been logged to the secret leaderboard.</p>
          <div style="display:flex;gap:12px;justify-content:center;margin-top:16px;">
            <button class="doodle-btn" id="mgSecretBtn">Secret Leaderboard 🤫</button>
            <button class="doodle-btn ghost" id="mgClose">Close</button>
          </div>
        `;
        content.querySelector('#mgClose').addEventListener('click', close);
        content.querySelector('#mgSecretBtn').addEventListener('click', () => {
          close();
          if (window.App && window.App.openSecretLeaderboard) window.App.openSecretLeaderboard();
        });
      }
    }
  }

  return { open, close, isOpen };
})();

window.Minigame = Minigame;
