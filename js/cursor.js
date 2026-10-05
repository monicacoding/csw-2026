// ---------------------------------------------------------------------------
// Custom racing cursor: a small checkered-flag glyph that follows the mouse,
// leaving a trail of fading spark particles — a lightweight nod to the
// racing theme instead of the default OS pointer.
//
// Why this file is written the way it is: a software-drawn cursor can only
// ever be as smooth as the page's frame rate (the OS pointer is drawn by the
// hardware, this one is drawn by us, every frame), so anything in here that
// costs main-thread time shows up directly as "the cursor lags". Measured
// with a fixed per-frame time budget, the glyph itself is free; the trail was
// the cost. So:
//  - The glyph's position is written once per animation frame (rAF-
//    coalesced), not once per mousemove event.
//  - The trail is drawn on ONE <canvas> (no DOM nodes, no CSS/Web
//    Animations, no compositor layer per spark) by a rAF loop that only runs
//    while sparks are alive — zero cost when the pointer is still. Earlier
//    versions created and removed a DOM node per spark, then replayed pooled
//    elements with element.animate(); both still cost style invalidation per
//    spark and one promoted layer per live spark.
//  - If frames stay slow while the pointer is moving, the trail turns itself
//    off for the rest of the session (see watchFrame) — on a struggling
//    machine, no trail beats a laggy cursor, and most people will never find
//    the picker to do it themselves. The glyph stays; "Default cursor" in the
//    picker is the full opt-out.
//  - Glyph 'none' (Cursor.NONE) tears all of it down — the dot, the
//    listeners, the canvas — and hands the pointer back to the browser
//    (html.system-cursor, see css/sketch.css), rather than just hiding it.
// ---------------------------------------------------------------------------

const Cursor = (() => {
  const NONE = 'none';
  const DEFAULT_GLYPH = '🏎️';
  const COLOR_VARS = ['--gold', '--brick', '--gold-dark'];
  const POOL_SIZE = 64;      // max live sparks; oldest is recycled first
  const LIFE_MS = 600;
  const TRAIL_DPR = 1;       // sparks are 2-5px soft blobs: retina resolution would cost 4x the pixels for nothing visible
  const SHED_FLAG = 'csw2026_trail_shed'; // sessionStorage: trail already switched off this session

  let dot = null, canvas = null, ctx = null, dpr = 1;
  let palette = [], pool = [], poolIdx = 0, trailEnabled = true;
  let moveRaf = 0, tickRaf = 0, dirty = null;
  let pendingX = 0, pendingY = 0, lastMoveAt = 0;
  let lastX = null, lastY = null, lastMoveTime = 0, smoothedSpeed = 0, lastSpawn = 0;
  let startedAt = 0, lastFrameT = 0, watched = 0, slow = 0;

  // Velocity -> trail intensity mapping. Speed is in CSS pixels per ms.
  // Below MIN_SPEED the cursor is treated as "holding still" — no particles
  // spawn at all. From MIN_SPEED up to SPEED_FOR_MAX_DENSITY, spawn frequency,
  // particle count per spawn, and opacity all ramp up linearly, capping out
  // at full density/intensity for anything faster. Particle color/shape/size
  // are untouched — only how often and how strongly they appear changes.
  const MIN_SPEED = 0.035;
  const SPEED_FOR_MAX_DENSITY = 2.2;
  const SPAWN_INTERVAL_MAX_MS = 90; // slow movement: sparse particles
  const SPAWN_INTERVAL_MIN_MS = 16; // fast movement: ~one particle per frame
  const MAX_PARTICLES_PER_SPAWN = 3;

  // Frame-health watchdog: only frames rendered while the pointer is moving
  // count, the first few seconds after start are ignored (page load is
  // legitimately busy), and a gap over 200ms is a paused/background tab, not
  // a slow frame. A "slow" frame is >40ms (under 25fps); if 40% of the last
  // 90 watched frames were slow, the trail is shed.
  const WARMUP_MS = 4000;
  const SLOW_FRAME_MS = 40;
  const WATCH_WINDOW = 90;
  const SLOW_SHARE = 0.4;

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function sessionFlag() { try { return sessionStorage.getItem(SHED_FLAG) === '1'; } catch { return false; } }

  function onLeave() { if (dot) dot.style.opacity = '0'; lastX = null; }
  function onEnter() { if (dot) dot.style.opacity = '1'; }

  function sizeCanvas() {
    if (!canvas) return;
    dpr = TRAIL_DPR;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = null;
  }

  function startTrail() {
    const cs = getComputedStyle(document.documentElement);
    palette = COLOR_VARS.map((v, i) => cs.getPropertyValue(v).trim() || ['#F2A73B', '#9C3B2E', '#D98F22'][i]);
    canvas = document.createElement('canvas');
    canvas.id = 'cursorTrail';
    ctx = canvas.getContext('2d');
    document.body.appendChild(canvas);
    pool = Array.from({ length: POOL_SIZE }, () => ({ alive: false, x: 0, y: 0, r: 0, color: '', op: 0, t0: 0 }));
    poolIdx = 0;
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
  }

  function stopTrail() {
    window.removeEventListener('resize', sizeCanvas);
    if (tickRaf) cancelAnimationFrame(tickRaf);
    tickRaf = 0; dirty = null;
    canvas?.remove(); canvas = null; ctx = null; pool = [];
  }

  function start(glyph) {
    document.documentElement.classList.remove('system-cursor');
    dot = document.createElement('div');
    dot.id = 'cursorDot';
    dot.textContent = glyph;
    document.body.appendChild(dot);

    trailEnabled = !sessionFlag();
    if (trailEnabled) startTrail();
    startedAt = performance.now();
    watched = slow = 0;

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('mouseenter', onEnter);
  }

  function stop() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseleave', onLeave);
    window.removeEventListener('mouseenter', onEnter);
    if (moveRaf) cancelAnimationFrame(moveRaf);
    moveRaf = 0;
    stopTrail();
    dot?.remove(); dot = null;
    lastX = lastY = null; smoothedSpeed = 0; lastFrameT = 0;
    document.documentElement.classList.add('system-cursor');
  }

  // `glyph`: an emoji, or Cursor.NONE for the browser's normal pointer.
  function init(glyph) { setGlyph(glyph); }

  function setGlyph(glyph) {
    if (glyph === NONE) { if (dot) stop(); else document.documentElement.classList.add('system-cursor'); return; }
    const g = glyph || DEFAULT_GLYPH;
    if (dot) dot.textContent = g;
    else start(g);
  }

  // Switches the trail off for the rest of this session and says so once —
  // quietly turning something off with no explanation would just look like
  // a bug. Deliberately not saved to the user's doc or localStorage: a slow
  // moment shouldn't permanently cost someone their trail.
  function shedTrail() {
    trailEnabled = false;
    stopTrail();
    try { sessionStorage.setItem(SHED_FLAG, '1'); } catch { /* fine — just won't persist across reloads */ }
    window.Toast?.show('✨ The site was running slowly, so the cursor trail is off for now. Pick "Default cursor" from the avatar menu if the cursor still lags.');
  }

  function watchFrame(t) {
    const dt = lastFrameT ? t - lastFrameT : 0;
    lastFrameT = t;
    if (!trailEnabled || dt <= 0 || dt > 200 || t - startedAt < WARMUP_MS) return;
    watched++;
    if (dt > SLOW_FRAME_MS) slow++;
    if (watched >= WATCH_WINDOW) {
      const tooSlow = slow / watched >= SLOW_SHARE;
      watched = slow = 0;
      if (tooSlow) shedTrail();
    }
  }

  // One rAF callback per frame while the pointer has moved in the last
  // ~150ms: places the glyph, and (because it reschedules itself every frame
  // during movement, regardless of how often mouse events arrive) gives
  // watchFrame a true frame-to-frame time.
  function frame(t) {
    moveRaf = 0;
    if (!dot) return;
    dot.style.transform = `translate(${pendingX}px, ${pendingY}px) translate(-50%,-50%)`;
    watchFrame(t);
    if (performance.now() - lastMoveAt < 150) moveRaf = requestAnimationFrame(frame);
    else lastFrameT = 0;
  }

  function onMove(e) {
    pendingX = e.clientX; pendingY = e.clientY;
    const now = performance.now();
    lastMoveAt = now;
    if (!moveRaf) moveRaf = requestAnimationFrame(frame);
    if (!trailEnabled) return;

    // Instantaneous speed since the last move event. A stale/first sample
    // (mouse re-entered after being away, or this is the very first event)
    // is treated as zero rather than producing a bogus spike.
    let instSpeed = 0;
    if (lastX !== null) {
      const dt = now - lastMoveTime;
      if (dt > 0 && dt < 200) {
        const dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);
        instSpeed = dist / dt;
      }
    }
    lastX = e.clientX; lastY = e.clientY; lastMoveTime = now;

    // Low-pass filter so one jittery event doesn't spike/starve the trail.
    smoothedSpeed = smoothedSpeed * 0.65 + instSpeed * 0.35;

    if (smoothedSpeed < MIN_SPEED) return; // near-stationary — no trail

    const t = clamp((smoothedSpeed - MIN_SPEED) / (SPEED_FOR_MAX_DENSITY - MIN_SPEED), 0, 1);
    const spawnInterval = SPAWN_INTERVAL_MAX_MS - t * (SPAWN_INTERVAL_MAX_MS - SPAWN_INTERVAL_MIN_MS);

    if (now - lastSpawn > spawnInterval) {
      lastSpawn = now;
      const count = 1 + Math.round(t * (MAX_PARTICLES_PER_SPAWN - 1));
      const opacity = 0.32 + t * 0.58;
      for (let i = 0; i < count; i++) spawnParticle(e.clientX, e.clientY, opacity);
    }
  }

  // Recycles the next particle in a ring: at the very top spawn rate the
  // oldest spark is reused slightly before its fade finishes, which is
  // invisible in practice and bounds the live count.
  function spawnParticle(x, y, opacity) {
    const p = pool[poolIdx];
    poolIdx = (poolIdx + 1) % pool.length;
    p.alive = true;
    p.x = x + (Math.random() * 10 - 5);
    p.y = y + (Math.random() * 10 - 5);
    p.r = (4 + Math.random() * 5) / 2;
    p.color = palette[Math.floor(Math.random() * palette.length)];
    p.op = opacity;
    p.t0 = performance.now();
    if (!tickRaf) tickRaf = requestAnimationFrame(tick);
  }

  // Draws every live spark, clearing only the rectangle the previous frame
  // touched (not the whole viewport). Same motion as the old CSS keyframes:
  // an ease-out over LIFE_MS, drifting up 14px while shrinking to 20% size and
  // fading to nothing. Stops rescheduling itself when nothing is alive.
  function tick(now) {
    tickRaf = 0;
    if (!ctx) return;
    if (dirty) ctx.clearRect(dirty.x0 - 1, dirty.y0 - 1, dirty.x1 - dirty.x0 + 2, dirty.y1 - dirty.y0 + 2);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, alive = 0;
    for (const p of pool) {
      if (!p.alive) continue;
      const t = Math.max(0, (now - p.t0) / LIFE_MS);
      if (t >= 1) { p.alive = false; continue; }
      const e = 1 - (1 - t) * (1 - t);
      const r = p.r * (1 - 0.8 * e);
      const y = p.y - 14 * e;
      ctx.globalAlpha = p.op * (1 - e);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, y, r, 0, Math.PI * 2);
      ctx.fill();
      if (p.x - r < x0) x0 = p.x - r;
      if (p.x + r > x1) x1 = p.x + r;
      if (y - r < y0) y0 = y - r;
      if (y + r > y1) y1 = y + r;
      alive++;
    }
    dirty = alive ? { x0, y0, x1, y1 } : null;
    if (alive) tickRaf = requestAnimationFrame(tick);
  }

  return { NONE, init, setGlyph };
})();

window.Cursor = Cursor;
