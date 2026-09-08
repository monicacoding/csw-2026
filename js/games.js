// ---------------------------------------------------------------------------
// The five activities. Each render function takes the modal body element,
// the current user, that activity's schedule `day` entry (label/theme —
// see data/schedule.js, the single source of truth for that header text),
// and a `ctx` object with two ways to hand control back to app.js:
//   - ctx.done(): submission is final — refresh user state, close the
//     modal, bounce to the hub with a toast (Hyperlink Race, Snap
//     Judgement, Trivia).
//   - ctx.refresh(): submission is logged and hub state (bingo/score)
//     should update in the background, but the modal stays open so the
//     activity can show a post-submit view in place (Photo Finish's
//     Gallery, the nomination's Recognition Wall).
// Every activity is one-submission-per-user, guarded with an early
// `Store.hasSubmitted` check.
// ---------------------------------------------------------------------------

const Games = (() => {
  function modalHeader(day, title) {
    return `
      <div class="game-modal-header">
        <div class="doodle-tag">${day.label} · ${day.theme}</div>
        <h2 class="sketch-title">${title}</h2>
      </div>`;
  }

  // Shared "already done" screen for the three one-shot activities that
  // don't have a post-submit view of their own to return to (Hyperlink
  // Race, Snap Judgement, Trivia — unlike Photo Finish's Gallery and the
  // nomination's Recognition Wall, revisiting these has nothing else to
  // show) — the message plus a way to go see how you stack up.
  // `leaderboardKey` deep-links to that activity's own leaderboard tab
  // rather than landing on the combined view — it's the same collection
  // name already used for the Store.hasSubmitted(...) check right above
  // each call site, and matches a `BOARDS` key in app.js 1:1.
  function renderAlreadyCompleted(body, day, title, message, leaderboardKey = 'combined') {
    body.innerHTML = modalHeader(day, title) + `
      <div style="text-align:center;">
        <p style="color:var(--success);font-weight:700;">${message}</p>
        <button class="doodle-btn ghost" id="viewLeaderboardBtn" style="margin-top:8px;">🏆 View Leaderboard</button>
      </div>`;
    body.querySelector('#viewLeaderboardBtn').addEventListener('click', () => window.App.openLeaderboardModal(leaderboardKey));
  }

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // Hyperlink Race and Snap Judgement specifically need a real desktop
  // browser (Hyperlink Race opens a second tab to hunt through; Snap
  // Judgement's crop-reveal + dropdown are tuned for a mouse) — block
  // starting either one from a phone-class viewport rather than let it run
  // in a degraded state. Race Day Trivia has no such requirement and isn't
  // gated here.
  function renderDesktopOnlyBlock(body, day, title) {
    body.innerHTML = modalHeader(day, title) + `
      <div style="text-align:center;">
        <p style="font-size:40px;">💻</p>
        <p style="color:var(--ink-soft);font-weight:700;">${escapeHtml(title)} needs a desktop or laptop browser to play — switch devices and come back to give it a go!</p>
      </div>`;
  }

  // User-submitted free text (nominee names, reasons, captions, product
  // guesses) gets rendered back into the page for everyone to read — escape
  // it so a colleague's "reason" can't smuggle in markup.
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Resizes an uploaded image client-side (max dimension + JPEG re-encode)
  // before turning it into a data URL — keeps Photo Finish submissions from
  // bloating the mock localStorage-backed data layer.
  function fileToResizedDataUrl(file, maxDim = 480, quality = 0.72) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read that file.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("That file doesn't look like an image."));
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            const scale = maxDim / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------------- Hyperlink Race (Tuesday · Picking Up The Pace) ----------------
  const HR_START_URL = 'https://example.com/company-news';
  const HR_CORRECT_DATE = '2026-09-01'; // ISO date the goal page was actually last updated

  function parseFlexibleDate(input) {
    const cleaned = input.trim();
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
      return `${y}-${m}-${day}`;
    }
    const iso = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
    const us = cleaned.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (us) return `${us[3]}-${String(us[1]).padStart(2,'0')}-${String(us[2]).padStart(2,'0')}`;
    return null;
  }

  async function hyperlinkRace(body, user, day, ctx) {
    const already = await Store.hasSubmitted('hyperlinkRaceEntries', user.code);
    if (already) {
      renderAlreadyCompleted(body, day, 'Hyperlink Race', "✅ You've already completed the Hyperlink Race!", 'hyperlinkRaceEntries');
      return;
    }
    if (window.isMobileViewport && window.isMobileViewport()) {
      renderDesktopOnlyBlock(body, day, 'Hyperlink Race');
      return;
    }

    body.innerHTML = modalHeader(day, 'Hyperlink Race') + `
      <div style="text-align:center;">
        <p style="color:var(--ink-soft);">Race to find the answer hidden on our destination page. Click Start, hunt it down, then report back with when it was last updated.</p>
        <div style="font-family:var(--font-display);font-size:52px;color:var(--navy);margin:20px 0;" id="hrTimer">00:00</div>
        <div style="display:flex;gap:14px;justify-content:center;">
          <button class="doodle-btn" id="hrStart">Start</button>
          <button class="doodle-btn brick" id="hrFound" disabled>Found It!</button>
        </div>
        <div id="hrSubmitArea" style="margin-top:20px;display:none;">
          <div class="field"><label>When was it last updated?</label><input id="hrDateAnswer" type="text" placeholder="e.g. March 3, 2026 or 03/03/2026" /></div>
          <button class="doodle-btn navy" id="hrSubmit" style="width:100%;">Submit</button>
        </div>
      </div>`;

    let startTime = null, timerInterval = null, elapsedMs = 0;
    const timerEl = body.querySelector('#hrTimer');
    const fmt = (ms) => {
      const s = Math.floor(ms / 1000);
      return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    };

    body.querySelector('#hrStart').addEventListener('click', () => {
      window.open(HR_START_URL, '_blank');
      startTime = Date.now();
      timerInterval = setInterval(() => { timerEl.textContent = fmt(Date.now() - startTime); }, 200);
      body.querySelector('#hrStart').disabled = true;
      body.querySelector('#hrFound').disabled = false;
      // Session has genuinely started — lock the modal against outside-
      // click/✕ dismissal. No in-app way out from here except finishing
      // (a browser refresh still works as an escape hatch, just not one
      // this UI offers — see the comment on ctx.lock in app.js).
      ctx.lock();
    });

    body.querySelector('#hrFound').addEventListener('click', () => {
      clearInterval(timerInterval);
      elapsedMs = Date.now() - startTime;
      body.querySelector('#hrSubmitArea').style.display = 'block';
      body.querySelector('#hrFound').disabled = true;
    });

    body.querySelector('#hrSubmit').addEventListener('click', async (e) => {
      const raw = body.querySelector('#hrDateAnswer').value;
      const parsed = parseFlexibleDate(raw);
      const dateCorrect = parsed === HR_CORRECT_DATE;
      const seconds = Math.round(elapsedMs / 1000);
      let score = Math.max(10, Math.floor(200 - seconds));
      if (!dateCorrect) score = Math.floor(score / 2);

      e.target.disabled = true;
      e.target.textContent = 'Submitting…';
      await Store.submitEntry({
        collection: 'hyperlinkRaceEntries', code: user.code, bingoKey: 'hyperlinkRace',
        scoreDelta: score, data: { elapsedMs, dateCorrect, rawAnswer: raw, score },
      });
      ctx.done();
    });
  }

  // ---------------- Snap Judgement (Thursday · The Final Stretch) ----------------
  // 8 fixed rounds, each a Microsoft product screenshot (data/ms-products.js
  // — SNAP_ROUNDS; image paths are placeholders until the real screenshots
  // are dropped in, with a graceful fallback card if one 404s). Guessing is
  // a dropdown over the full alphabetized MS_PRODUCTS list, so scoring is
  // always an exact match — no free-text typos to adjudicate.
  //
  // The reveal is crop-based, not blur-based: the image is always shown at
  // full resolution, just clipped to a centered window that widens each
  // level (clip-path: inset(...), same image/scale/position throughout —
  // only how much of it is visible changes). Level 4 clips nothing, i.e.
  // the full image.
  const SJ_LEVEL_COUNT = 4;
  const SJ_LEVEL_CLIP = [
    'inset(36% 36% 36% 36%)',
    'inset(24% 24% 24% 24%)',
    'inset(11% 11% 11% 11%)',
    'inset(0% 0% 0% 0%)',
  ];
  const SJ_BASE_PER_CORRECT = 50;
  const SJ_REVEAL_BONUS_BY_LEVEL = [30, 20, 10, 0]; // less revealed → bigger bonus, only paid on correct guesses
  const SJ_IDEAL_SECONDS_PER_ROUND = 12; // par pace for full speed bonus
  const SJ_MAX_SECONDS_PER_ROUND = 40; // pace at/beyond which the speed bonus is zero
  const SJ_MAX_SPEED_BONUS_PER_CORRECT = 20;

  async function snapJudgement(body, user, day, ctx) {
    const already = await Store.hasSubmitted('snapJudgementEntries', user.code);
    if (already) {
      renderAlreadyCompleted(body, day, 'Snap Judgement', "✅ You've already made your guesses!", 'snapJudgementEntries');
      return;
    }
    if (window.isMobileViewport && window.isMobileViewport()) {
      renderDesktopOnlyBlock(body, day, 'Snap Judgement');
      return;
    }
    renderSnapIntro(body, user, day, ctx);
  }

  function renderSnapIntro(body, user, day, ctx) {
    body.innerHTML = modalHeader(day, 'Snap Judgement') + `
      <div class="game-explainer">
        <p>🎯 <span><strong>Goal:</strong> guess the Microsoft product from a small window into its screenshot.</span></p>
        <p>🔢 <span>There are <strong>${SNAP_ROUNDS.length} rounds</strong>, one screenshot each — you start seeing just a sliver of the real image, and the window widens each time you tap "Reveal More."</span></p>
        <p>📋 <span>Pick your answer from the <strong>dropdown</strong> of Microsoft products — no typing, so it always registers correctly.</span></p>
        <p>🏁 <span><strong>Scoring</strong> blends three things: getting it right, revealing as little as possible before you guess, and how fast you clear all ${SNAP_ROUNDS.length} rounds.</span></p>
      </div>
      <button class="doodle-btn" id="sjStart" style="width:100%;">Start Guessing</button>`;
    body.querySelector('#sjStart').addEventListener('click', () => {
      ctx.lock(); // session starts now — no in-app way out until it's finished
      runSnapRounds(body, user, day, ctx);
    });
  }

  function snapUpdateRevealUI(body, level) {
    const pct = (level / SJ_LEVEL_COUNT) * 100;
    const clip = SJ_LEVEL_CLIP[level - 1];
    const img = body.querySelector('#sjImg');
    if (img) img.style.clipPath = clip;
    const fallback = body.querySelector('#sjImgFallback');
    if (fallback) fallback.style.clipPath = clip;
    body.querySelector('#sjFill').style.width = `${pct}%`;
    body.querySelector('#sjMarker').style.left = `${pct}%`;
    body.querySelector('#sjLevelLabel').textContent = `Reveal level ${level} / ${SJ_LEVEL_COUNT}`;
    if (level >= SJ_LEVEL_COUNT) body.querySelector('#sjReveal').disabled = true;
  }

  function runSnapRounds(body, user, day, ctx) {
    const rounds = SNAP_ROUNDS;
    let roundIdx = 0;
    let level = 1;
    let correctCount = 0;
    const roundResults = []; // { correct, level, product, guess }
    const startTime = Date.now();

    function renderRound() {
      level = 1;
      const round = rounds[roundIdx];
      body.innerHTML = modalHeader(day, 'Snap Judgement') + `
        <div style="text-align:center;">
          <div style="font-family:var(--font-hand);font-size:15px;color:var(--ink-soft);margin-bottom:10px;">Round ${roundIdx + 1} of ${rounds.length}</div>
          <div style="width:100%;aspect-ratio:16/10;border-radius:20px;overflow:hidden;background:var(--sage);margin-bottom:10px;border:2.5px solid var(--navy);position:relative;">
            <img id="sjImg" src="${round.image}" alt="" style="width:100%;height:100%;object-fit:cover;clip-path:${SJ_LEVEL_CLIP[0]};transition:clip-path 0.3s ease;" onerror="this.style.display='none';document.getElementById('sjImgFallback').style.display='flex';" />
            <div id="sjImgFallback" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;flex-direction:column;gap:6px;font-family:var(--font-display);color:var(--navy);clip-path:${SJ_LEVEL_CLIP[0]};transition:clip-path 0.3s ease;">
              <span style="font-size:34px;">📸</span>
              <span style="font-size:13px;">Screenshot coming soon</span>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;font-family:var(--font-hand);font-size:14px;color:var(--ink-soft);margin-bottom:4px;">
            <span id="sjLevelLabel">Reveal level 1 / ${SJ_LEVEL_COUNT}</span>
          </div>
          <div class="reveal-track">
            <div class="reveal-track__fill" id="sjFill" style="width:${(1 / SJ_LEVEL_COUNT) * 100}%;"></div>
            <div class="reveal-track__tick" style="left:25%;"></div>
            <div class="reveal-track__tick" style="left:50%;"></div>
            <div class="reveal-track__tick" style="left:75%;"></div>
            <div class="reveal-track__marker" id="sjMarker" style="left:${(1 / SJ_LEVEL_COUNT) * 100}%;">👀</div>
          </div>
          <div class="reveal-track__labels"><span>1</span><span>2</span><span>3</span><span>4</span></div>

          <div class="field" style="text-align:left;margin-top:16px;">
            <label>Which Microsoft product is this?</label>
            <select id="sjGuess">
              <option value="" disabled selected>Choose a product…</option>
              ${MS_PRODUCTS.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
            </select>
          </div>
          <div id="sjFeedback" style="min-height:22px;font-weight:700;margin-bottom:6px;"></div>
          <div style="display:flex;gap:14px;justify-content:center;">
            <button class="doodle-btn ghost" id="sjReveal">Reveal More</button>
            <button class="doodle-btn" id="sjSubmit" disabled>Lock In Guess</button>
          </div>
        </div>`;

      const guessEl = body.querySelector('#sjGuess');
      const submitBtn = body.querySelector('#sjSubmit');
      guessEl.addEventListener('change', () => { submitBtn.disabled = !guessEl.value; });

      body.querySelector('#sjReveal').addEventListener('click', () => {
        if (level >= SJ_LEVEL_COUNT) return;
        level += 1;
        snapUpdateRevealUI(body, level);
      });

      submitBtn.addEventListener('click', () => {
        const guess = guessEl.value;
        const correct = guess === round.product;
        if (correct) correctCount += 1;
        roundResults.push({ correct, level, product: round.product, guess });

        body.querySelector('#sjFeedback').innerHTML = correct
          ? `<span style="color:var(--success);">✅ Correct — it's ${escapeHtml(round.product)}!</span>`
          : `<span style="color:var(--brick);">❌ Not quite — it was ${escapeHtml(round.product)}.</span>`;
        submitBtn.disabled = true;
        body.querySelector('#sjReveal').disabled = true;
        guessEl.disabled = true;

        setTimeout(() => {
          roundIdx += 1;
          if (roundIdx < rounds.length) renderRound(); else finish();
        }, 900);
      });
    }

    function finish() {
      const totalElapsedSec = (Date.now() - startTime) / 1000;
      const avgSecPerRound = totalElapsedSec / rounds.length;
      // Aggregate pace across the whole 8-round run, not per-round timing —
      // one speed factor, paid out proportionally across correct guesses.
      const speedFactor = clamp(
        (SJ_MAX_SECONDS_PER_ROUND - avgSecPerRound) / (SJ_MAX_SECONDS_PER_ROUND - SJ_IDEAL_SECONDS_PER_ROUND), 0, 1,
      );
      let correctnessPoints = 0, revealBonus = 0;
      roundResults.forEach((r) => {
        if (r.correct) {
          correctnessPoints += SJ_BASE_PER_CORRECT;
          revealBonus += SJ_REVEAL_BONUS_BY_LEVEL[r.level - 1];
        }
      });
      const speedBonus = Math.round(correctCount * SJ_MAX_SPEED_BONUS_PER_CORRECT * speedFactor);
      const score = correctnessPoints + revealBonus + speedBonus;

      body.innerHTML = modalHeader(day, 'Snap Judgement') + `
        <div style="text-align:center;">
          <p style="font-size:40px;">📸</p>
          <div style="font-family:var(--font-display);font-size:44px;color:var(--brick);margin:6px 0;">${score} pts</div>
          <p style="color:var(--ink-soft);">${correctCount} / ${rounds.length} correct</p>
          <p class="eyebrow-hand">${correctnessPoints} for correctness + ${revealBonus} for minimal reveals + ${speedBonus} speed bonus</p>
          <button class="doodle-btn" id="sjFinish" style="width:100%;margin-top:10px;">Submit &amp; Continue</button>
        </div>`;
      body.querySelector('#sjFinish').addEventListener('click', async (e) => {
        e.target.disabled = true; e.target.textContent = 'Submitting…';
        await Store.submitEntry({
          collection: 'snapJudgementEntries', code: user.code, bingoKey: 'snapJudgement',
          scoreDelta: score, data: { score, correctCount, totalRounds: rounds.length, correctnessPoints, revealBonus, speedBonus, roundResults },
        });
        ctx.done();
      });
    }

    renderRound();
  }

  // ---------------- Race Day Trivia (all week — 5 new questions daily) ----------------
  // Runs Monday through Friday now, not just once on Friday: each day has
  // its own 5-question set (data/trivia-questions.js — TRIVIA_BY_DAY, keyed
  // by the schedule day id) and its own submission that locks after
  // answering, exactly like every other single-day activity. Score
  // accumulates across the days completed so far (Store.submitTriviaDay
  // handles the cumulative bookkeeping + the per-day vs. aggregate bingo
  // flags — see the comment there).
  const TQ_BASE_PER_CORRECT = 10;
  const TQ_MAX_SPEED_BONUS_PER_CORRECT = 10;
  const TQ_IDEAL_SECONDS_PER_QUESTION = 6; // par pace for full speed bonus
  const TQ_MAX_SECONDS_PER_QUESTION = 20; // pace at/beyond which the speed bonus is zero
  const TRIVIA_DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const capitalize = (s) => s[0].toUpperCase() + s.slice(1);

  // Count of daily trivia sets this user has completed so far — read
  // straight off their existing bingo flags (triviaMon..triviaFri), no
  // extra round-trip needed alongside the cumulative score already on
  // `user.triviaTotalScore`.
  function triviaDaysCompleted(user) {
    const bingo = user?.bingo || {};
    return TRIVIA_DAY_ORDER.filter((d) => bingo[`trivia${capitalize(d)}`]).length;
  }

  async function trivia(body, user, day, ctx) {
    const dayId = day.id; // 'mon'..'fri' — which day's 5-question set this is
    const already = await Store.hasSubmittedTriviaDay(user.code, dayId);
    if (already) {
      const cumulative = user.triviaTotalScore || 0;
      const daysCompleted = triviaDaysCompleted(user);
      renderAlreadyCompleted(
        body, day, 'Race Day Trivia',
        `✅ You've already completed today's trivia! Cumulative score: ${cumulative} pts across ${daysCompleted} / ${TRIVIA_DAY_ORDER.length} days.`,
        'triviaEntries',
      );
      return;
    }
    renderTriviaIntro(body, user, day, ctx);
  }

  function renderTriviaIntro(body, user, day, ctx) {
    const questions = TRIVIA_BY_DAY[day.id] || [];
    const daysCompleted = triviaDaysCompleted(user);
    body.innerHTML = modalHeader(day, 'Race Day Trivia') + `
      <div class="game-explainer">
        <p>🏁 <span><strong>Goal:</strong> answer today's ${questions.length} CSW trivia questions, one at a time.</span></p>
        <p>📅 <span>Race Day Trivia runs <strong>all week</strong> — a new set unlocks each day, Monday through Friday, and your score adds up across every day you complete.</span></p>
        <p>✅ <span>You earn <strong>base points</strong> for every question you get right.</span></p>
        <p>⏱️ <span><strong>Speed matters too</strong> — the clock starts when you begin and stops on your last answer. Clearing today's round faster earns a bonus on top of your correct answers.</span></p>
      </div>
      ${daysCompleted > 0 ? `<p class="eyebrow-hand" style="text-align:center;">🏆 Cumulative score so far: <strong>${user.triviaTotalScore || 0} pts</strong> across ${daysCompleted} day${daysCompleted === 1 ? '' : 's'}.</p>` : ''}
      <button class="doodle-btn" id="tqStart" style="width:100%;">Start Today's Race</button>`;
    body.querySelector('#tqStart').addEventListener('click', () => {
      ctx.lock(); // session starts now — no in-app way out until it's finished
      runTrivia(body, user, day, ctx);
    });
  }

  function runTrivia(body, user, day, ctx) {
    const dayId = day.id;
    const questions = TRIVIA_BY_DAY[dayId] || [];
    let idx = 0, correctCount = 0, locked = false;
    const startTime = Date.now();

    function renderQuestion() {
      locked = false;
      const q = questions[idx];
      const pct = Math.round((idx / questions.length) * 100);
      body.innerHTML = modalHeader(day, 'Race Day Trivia') + `
        <div style="text-align:center;">
          <div style="font-family:var(--font-hand);font-size:15px;color:var(--ink-soft);margin-bottom:4px;">Question ${idx+1} of ${questions.length}${q.pillar ? ` · ${escapeHtml(q.pillar)}` : ''}</div>
          <div style="height:8px;background:var(--sage);border-radius:999px;overflow:hidden;margin-bottom:22px;"><div style="height:100%;background:var(--gold);width:${pct}%;transition:width .3s ease;"></div></div>
          <div style="font-family:var(--font-display);font-size:20px;color:var(--navy);margin-bottom:20px;">${escapeHtml(q.q)}</div>
          <div id="tqChoices"></div>
        </div>`;
      const choicesEl = body.querySelector('#tqChoices');
      q.choices.forEach((choice, i) => {
        const btn = document.createElement('button');
        btn.className = 'doodle-btn ghost';
        btn.style.cssText = 'display:block;width:100%;text-align:left;margin-bottom:10px;text-transform:none;letter-spacing:normal;font-size:15px;';
        btn.textContent = choice;
        btn.addEventListener('click', () => selectChoice(i, choicesEl, q));
        choicesEl.appendChild(btn);
      });
    }

    function selectChoice(i, choicesEl, q) {
      if (locked) return;
      locked = true;
      if (i === q.correctIndex) correctCount += 1;
      [...choicesEl.children].forEach((b, bi) => {
        if (bi === q.correctIndex) { b.style.background = 'var(--sage)'; b.style.borderColor = 'var(--success)'; b.style.color = 'var(--success)'; }
        else if (bi === i) { b.style.background = '#FBE4DF'; b.style.borderColor = 'var(--brick)'; b.style.color = 'var(--brick)'; }
        b.disabled = true;
      });
      setTimeout(() => { idx += 1; if (idx < questions.length) renderQuestion(); else finish(); }, 700);
    }

    async function finish() {
      // Aggregate pace across today's round (not summed per-question
      // bonuses) — one speed factor from total completion time, paid out
      // proportionally across the questions actually answered correctly.
      const totalElapsedSec = (Date.now() - startTime) / 1000;
      const avgSecPerQuestion = totalElapsedSec / questions.length;
      const speedFactor = clamp(
        (TQ_MAX_SECONDS_PER_QUESTION - avgSecPerQuestion) / (TQ_MAX_SECONDS_PER_QUESTION - TQ_IDEAL_SECONDS_PER_QUESTION), 0, 1,
      );
      const basePoints = correctCount * TQ_BASE_PER_CORRECT;
      const speedBonus = Math.round(correctCount * TQ_MAX_SPEED_BONUS_PER_CORRECT * speedFactor);
      const score = basePoints + speedBonus;
      // Predicted post-submit cumulative — `user` hasn't been refreshed yet
      // at this point, so this is genuinely "current total + what you just
      // earned," not a stale read.
      const cumulativeAfter = (user.triviaTotalScore || 0) + score;
      const daysCompletedAfter = triviaDaysCompleted(user) + 1;

      body.innerHTML = modalHeader(day, 'Race Day Trivia') + `
        <div style="text-align:center;">
          <p style="font-size:40px;">🏁</p>
          <div style="font-family:var(--font-display);font-size:44px;color:var(--brick);margin:6px 0;">${score} pts</div>
          <p style="color:var(--ink-soft);">${correctCount} / ${questions.length} correct today</p>
          <p class="eyebrow-hand">${basePoints} for correctness + ${speedBonus} speed bonus</p>
          <p class="eyebrow-hand" style="margin-top:10px;">🏆 Cumulative Race Day Trivia score: <strong>${cumulativeAfter} pts</strong> across ${daysCompletedAfter} / ${TRIVIA_DAY_ORDER.length} days.</p>
          <button class="doodle-btn" id="tqFinish" style="margin-top:10px;">Submit &amp; Continue</button>
        </div>`;
      body.querySelector('#tqFinish').addEventListener('click', async (e) => {
        e.target.disabled = true; e.target.textContent = 'Submitting…';
        await Store.submitTriviaDay({
          code: user.code, dayId,
          scoreDelta: score, data: { score, correctCount, totalQuestions: questions.length, basePoints, speedBonus },
        });
        ctx.done();
      });
    }

    renderQuestion();
  }

  // ---------------- Photo Finish (Wednesday · The Halfway Mile) ----------------
  async function photoFinish(body, user, day, ctx) {
    body.innerHTML = modalHeader(day, 'Photo Finish') + `
      <div id="pfSubmitArea"></div>
      <h3 style="color:var(--navy);margin:22px 0 10px;font-size:16px;">Gallery</h3>
      <p class="gallery-rules">🗳️ Voting rules: you get <strong>one vote, total</strong> — and you can't vote for your own entry.</p>
      <div id="pfGallery" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div>`;

    const submitArea = body.querySelector('#pfSubmitArea');
    const already = await Store.hasSubmitted('photoFinishEntries', user.code);
    if (already) {
      submitArea.innerHTML = `<p style="color:var(--success);font-weight:700;">✅ You've already submitted your Photo Finish entry!</p>`;
    } else {
      submitArea.innerHTML = `
        <div class="field">
          <label>Your photo</label>
          <input id="pfImageInput" type="file" accept="image/*" class="visually-hidden" />
          <label for="pfImageInput" class="doodle-btn ghost pf-upload-btn" id="pfUploadLabel">📸 Choose a Photo</label>
        </div>
        <div id="pfPreviewWrap" style="display:none;margin:10px 0;">
          <img id="pfPreview" style="width:100%;max-height:200px;object-fit:cover;border-radius:14px;border:2.5px solid var(--navy);" />
        </div>
        <div class="field"><label>Your caption</label><textarea id="pfCaption" rows="3" placeholder="Make us laugh…"></textarea></div>
        <button class="doodle-btn" id="pfSubmit" style="width:100%;" disabled>Add a photo and caption to submit</button>`;

      let imageDataUrl = null;
      const submitBtn = submitArea.querySelector('#pfSubmit');
      const captionInput = submitArea.querySelector('#pfCaption');
      const uploadLabel = submitArea.querySelector('#pfUploadLabel');

      function refreshSubmitState() {
        const ready = !!imageDataUrl && captionInput.value.trim().length > 0;
        submitBtn.disabled = !ready;
        submitBtn.textContent = ready ? 'Submit' : 'Add a photo and caption to submit';
      }
      captionInput.addEventListener('input', refreshSubmitState);

      submitArea.querySelector('#pfImageInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) { imageDataUrl = null; uploadLabel.textContent = '📸 Choose a Photo'; refreshSubmitState(); return; }
        try {
          imageDataUrl = await fileToResizedDataUrl(file);
          const previewWrap = submitArea.querySelector('#pfPreviewWrap');
          submitArea.querySelector('#pfPreview').src = imageDataUrl;
          previewWrap.style.display = 'block';
          uploadLabel.textContent = '📸 Photo Selected ✓';
        } catch (err) {
          Toast.show(err.message, 'error');
          imageDataUrl = null;
          uploadLabel.textContent = '📸 Choose a Photo';
        }
        refreshSubmitState();
      });

      submitBtn.addEventListener('click', async (e) => {
        const caption = captionInput.value.trim();
        if (!caption || !imageDataUrl) return;
        e.target.disabled = true;
        e.target.textContent = 'Submitting…';
        await Store.submitEntry({
          collection: 'photoFinishEntries', code: user.code, bingoKey: 'photoFinish',
          scoreDelta: 0, data: { caption, imageDataUrl, votes: 0 },
        });
        // Update hub state in the background but keep the modal open — then
        // re-run this same function so it re-renders as "already submitted"
        // with a fresh Gallery that now includes this entry, right in place.
        await ctx.refresh();
        Toast.show('🏁 Entry submitted — check out the Gallery!', 'success');
        await photoFinish(body, user, day, ctx);
      });
    }

    // ---- Gallery ----
    const votedKey = `csw2026_voted_${user.code}`;
    const votedSet = new Set(JSON.parse(localStorage.getItem(votedKey) || '[]'));
    const entries = await Store.getPhotoFinishEntries();
    const grid = body.querySelector('#pfGallery');
    if (entries.length === 0) {
      grid.innerHTML = `<p style="color:var(--ink-soft);grid-column:1/-1;">No entries yet — be the first!</p>`;
    } else {
      grid.innerHTML = entries.map((e) => `
        <div class="sketch-card" style="padding:14px;">
          ${e.imageDataUrl ? `<img src="${e.imageDataUrl}" alt="" style="width:100%;height:120px;object-fit:cover;border-radius:12px;margin-bottom:8px;" />` : ''}
          <div style="font-weight:700;color:var(--navy);font-size:13px;margin-bottom:8px;">"${escapeHtml(e.caption)}"</div>
          <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--ink-soft);">
            <span>— ${escapeHtml(e.code)}</span>
            <button class="doodle-btn sm vote-btn" data-code="${e.id}" ${e.code === user.code ? 'disabled title="You can\'t vote for your own entry"' : ''}>▲ ${e.votes || 0}</button>
          </div>
        </div>`).join('');
      grid.querySelectorAll('.vote-btn').forEach((btn) => {
        if (btn.disabled) return;
        btn.addEventListener('click', async () => {
          const entryCode = btn.dataset.code;
          if (votedSet.has(entryCode)) return;
          btn.disabled = true;
          try {
            await Store.voteForPhoto(entryCode, user.code);
            votedSet.add(entryCode);
            localStorage.setItem(votedKey, JSON.stringify([...votedSet]));
            btn.textContent = `▲ ${Number(btn.textContent.replace('▲ ','')) + 1}`;
          } catch (err) { Toast.show(err.message, 'error'); btn.disabled = false; }
        });
      });
    }
  }

  // ---------------- Nomination (Friday · Crossing the Finish Line) ----------------
  const NOMINATION_EMOJIS = ['🏆', '⭐', '🔥', '🎉', '👏', '🥇', '🚀', '💪', '🙌', '🎯', '🏅', '✨'];

  async function nomination(body, user, day, ctx) {
    const already = await Store.hasSubmitted('nominations', user.code);
    if (already) {
      await renderRecognitionWall(body, day);
      return;
    }
    renderNominationForm(body, user, day, ctx);
  }

  function renderNominationForm(body, user, day, ctx) {
    body.innerHTML = modalHeader(day, 'Who Went The Extra Mile?') + `
      <div style="text-align:center;">
        <p style="color:var(--ink-soft);">Give a shout-out to a colleague who went above and beyond this week.</p>
        <div class="field" style="text-align:left;"><label>Colleague's first &amp; last name</label><input id="nomName" type="text" placeholder="e.g. Jane Doe" /></div>
        <div class="field" style="text-align:left;">
          <label>Pick an emoji for your shout-out</label>
          <div class="emoji-picker" id="nomEmojiPicker">
            ${NOMINATION_EMOJIS.map((em) => `<button type="button" class="emoji-option" data-emoji="${em}">${em}</button>`).join('')}
          </div>
        </div>
        <div class="field" style="text-align:left;"><label>Why?</label><textarea id="nomReason" rows="4" placeholder="Tell us what they did…"></textarea></div>
        <button class="doodle-btn" id="nomSubmit" style="width:100%;">Submit Nomination</button>
      </div>`;

    let selectedEmoji = null;
    const picker = body.querySelector('#nomEmojiPicker');
    picker.querySelectorAll('.emoji-option').forEach((btn) => {
      btn.addEventListener('click', () => {
        picker.querySelectorAll('.emoji-option').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedEmoji = btn.dataset.emoji;
      });
    });

    body.querySelector('#nomSubmit').addEventListener('click', async (e) => {
      const nomineeName = body.querySelector('#nomName').value.trim();
      const reason = body.querySelector('#nomReason').value.trim();
      const nameParts = nomineeName.split(/\s+/).filter(Boolean);
      if (nameParts.length < 2) { Toast.show("Please enter the colleague's first and last name.", 'error'); return; }
      if (!reason) { Toast.show('Please tell us why.', 'error'); return; }
      if (!selectedEmoji) { Toast.show('Pick an emoji for your shout-out.', 'error'); return; }

      e.target.disabled = true; e.target.textContent = 'Submitting…';
      await Store.submitEntry({
        collection: 'nominations', code: user.code, bingoKey: 'nomination',
        scoreDelta: 0, data: { nomineeName, reason, emoji: selectedEmoji },
      });
      // Same in-place pattern as Photo Finish: refresh hub state in the
      // background, keep the modal open, and show the Recognition Wall.
      await ctx.refresh();
      Toast.show('🏁 Nomination submitted!', 'success');
      await renderRecognitionWall(body, day);
    });
  }

  // Same card grid structure, spacing, and scroll handling as Photo
  // Finish's Gallery (photoFinish() below) — same inline grid style, same
  // sketch-card padding/thumbnail/caption/meta rhythm, and no separate
  // scroll container of its own (the modal's own overflow-y handles it,
  // same as the Gallery), rather than a second, differently-behaved list
  // implementation.
  async function renderRecognitionWall(body, day) {
    const entries = await Store.getNominations();
    body.innerHTML = modalHeader(day, 'Who Went The Extra Mile?') + `
      <p style="text-align:center;color:var(--success);font-weight:700;">✅ Thanks for recognizing a teammate!</p>
      <h3 style="color:var(--navy);margin:22px 0 10px;font-size:16px;">🏆 Recognition Wall</h3>
      <div id="recognitionWall" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;"></div>`;
    const wall = body.querySelector('#recognitionWall');
    if (entries.length === 0) {
      wall.innerHTML = `<p style="color:var(--ink-soft);grid-column:1/-1;">No shout-outs yet — be the first!</p>`;
    } else {
      // Emoji is a small accent to the left of the name, not a photo-sized
      // focal element — reading order is emoji → name → message, with the
      // name and message doing the visual work (unlike Photo Finish's card,
      // where the image genuinely is the focal point).
      wall.innerHTML = entries.map((e) => `
        <div class="sketch-card" style="padding:14px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:17px;line-height:1;flex-shrink:0;">${e.emoji || '🏆'}</span>
            <span style="font-weight:700;color:var(--navy);font-size:13px;">${escapeHtml(e.nomineeName || '')}</span>
          </div>
          <div style="font-size:12px;color:var(--ink-soft);">"${escapeHtml(e.reason || '')}"</div>
        </div>`).join('');
    }
  }

  return { hyperlinkRace, snapJudgement, trivia, photoFinish, nomination };
})();

window.Games = Games;
