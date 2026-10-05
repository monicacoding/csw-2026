// ---------------------------------------------------------------------------
// Custom racing cursor: a small checkered-flag glyph that follows the mouse,
// leaving a trail of fading spark particles — a lightweight nod to the
// racing theme instead of the default OS pointer.
//
// Performance notes (this file used to be the main suspect in "the site
// lags" reports):
//  - The glyph's position is written once per animation frame (rAF-
//    coalesced), not once per mousemove event — a 1000Hz gaming mouse used
//    to mean up to ~1000 style writes a second for something the screen
//    only shows ~60 times.
//  - The trail uses a fixed pool of particle elements created once and
//    replayed with the Web Animations API, instead of creating, styling,
//    appending and (via setTimeout) removing a fresh node for every spark —
//    up to ~190 DOM insertions + removals a second at full speed before.
//    No per-particle will-change either: that promoted every short-lived
//    spark to its own compositor layer.
//  - Glyph 'none' (Cursor.NONE) tears all of it down — the dot, the
//    listeners, the particle pool — and hands the pointer back to the
//    browser (html.system-cursor, see css/sketch.css), rather than just
//    hiding it. The trail alone can also be switched off while keeping the
//    glyph (Cursor.setTrail) — that's what "Reduce animations" uses.
// ---------------------------------------------------------------------------

const Cursor = (() => {
  const NONE = 'none';
  const DEFAULT_GLYPH = '🏎️';
  const COLORS = ['var(--gold)', 'var(--brick)', 'var(--gold-dark)'];
  const POOL_SIZE = 64;

  let dot = null, trail = null, pool = [], poolIdx = 0;
  let trailEnabled = true;
  let rafId = 0, pendingX = 0, pendingY = 0;
  let lastX = null, lastY = null, lastMoveTime = 0, smoothedSpeed = 0, lastSpawn = 0;

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

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  function onLeave() { if (dot) dot.style.opacity = '0'; lastX = null; }
  function onEnter() { if (dot) dot.style.opacity = '1'; }

  function start(glyph) {
    document.documentElement.classList.remove('system-cursor');
    dot = document.createElement('div');
    dot.id = 'cursorDot';
    dot.textContent = glyph;
    document.body.appendChild(dot);

    trail = document.createElement('div');
    trail.id = 'cursorTrail';
    pool = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = document.createElement('div');
      p.className = 'cursor-particle';
      const size = 4 + Math.random() * 5;
      p.style.width = p.style.height = `${size}px`;
      p.style.background = COLORS[i % COLORS.length];
      trail.appendChild(p);
      pool.push(p);
    }
    document.body.appendChild(trail);

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    window.addEventListener('mouseenter', onEnter);
  }

  function stop() {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseleave', onLeave);
    window.removeEventListener('mouseenter', onEnter);
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    dot?.remove(); dot = null;
    trail?.remove(); trail = null;
    pool = []; poolIdx = 0;
    lastX = lastY = null; smoothedSpeed = 0;
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

  function setTrail(enabled) {
    trailEnabled = enabled;
    if (!enabled) { lastX = null; smoothedSpeed = 0; }
  }

  function flush() {
    rafId = 0;
    if (dot) dot.style.transform = `translate(${pendingX}px, ${pendingY}px) translate(-50%,-50%)`;
  }

  function onMove(e) {
    pendingX = e.clientX; pendingY = e.clientY;
    if (!rafId) rafId = requestAnimationFrame(flush);
    if (!trailEnabled) return;

    const now = performance.now();

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

  // Replays the next pooled particle from this position. The pool is a ring:
  // at the very top spawn rate the oldest spark is recycled slightly before
  // its fade finishes, which is invisible in practice and bounds the live
  // particle count (previously unbounded by anything but spawn rate).
  function spawnParticle(x, y, opacity) {
    const p = pool[poolIdx];
    poolIdx = (poolIdx + 1) % pool.length;
    const px = x + (Math.random() * 10 - 5);
    const py = y + (Math.random() * 10 - 5);
    const at = `translate(${px}px, ${py}px) translate(-50%, -50%)`;
    p.animate([
      { opacity, transform: `${at} scale(1)` },
      { opacity: 0, transform: `${at} translateY(-14px) scale(0.2)` },
    ], { duration: 600, easing: 'ease-out' });
  }

  return { NONE, init, setGlyph, setTrail };
})();

window.Cursor = Cursor;
