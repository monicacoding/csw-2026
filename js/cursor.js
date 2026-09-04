// ---------------------------------------------------------------------------
// Custom racing cursor: a small checkered-flag glyph that follows the mouse,
// leaving a trail of fading spark particles — a lightweight nod to the
// racing theme instead of the default OS pointer.
// ---------------------------------------------------------------------------

const Cursor = (() => {
  let dot, lastSpawn = 0;
  let lastX = null, lastY = null, lastMoveTime = 0, smoothedSpeed = 0;
  const COLORS = ['var(--gold)', 'var(--brick)', 'var(--gold-dark)'];
  const DEFAULT_GLYPH = '🏎️';

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

  function init(glyph) {
    if (dot) {
      setGlyph(glyph);
      return;
    }
    dot = document.createElement('div');
    dot.id = 'cursorDot';
    dot.textContent = glyph || DEFAULT_GLYPH;
    document.body.appendChild(dot);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseleave', () => { dot.style.opacity = '0'; lastX = null; });
    window.addEventListener('mouseenter', () => { dot.style.opacity = '1'; });
  }

  function setGlyph(glyph) {
    if (dot) dot.textContent = glyph || DEFAULT_GLYPH;
  }

  function onMove(e) {
    dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%,-50%)`;
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

  function spawnParticle(x, y, opacity = 0.9) {
    const p = document.createElement('div');
    p.className = 'cursor-particle';
    const size = 4 + Math.random() * 5;
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    p.style.width = `${size}px`;
    p.style.height = `${size}px`;
    p.style.background = color;
    p.style.left = `${x + (Math.random() * 10 - 5)}px`;
    p.style.top = `${y + (Math.random() * 10 - 5)}px`;
    p.style.setProperty('--p-opacity', opacity);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 650);
  }

  return { init, setGlyph };
})();

window.Cursor = Cursor;
