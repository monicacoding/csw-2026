// ---------------------------------------------------------------------------
// Ambient background: a soft grid layer that parallaxes gently with the
// mouse, plus a scattering of idle-animating decorations (drifting clouds,
// twinkling sparkles, floating checkered-flag confetti bits, faded skid
// marks) so the canvas feels alive rather than flat.
// ---------------------------------------------------------------------------

const Ambient = (() => {
  function init() {
    const layer = document.createElement('div');
    layer.id = 'bgLayer';
    document.body.prepend(layer);

    spawnClouds(layer, 4);
    spawnSparkles(layer, 10);
    spawnConfetti(layer, 8);
    spawnSkidMarks(layer, 3);

    // gentle parallax
    let raf = null;
    window.addEventListener('mousemove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const px = (e.clientX / window.innerWidth - 0.5) * 16;
        const py = (e.clientY / window.innerHeight - 0.5) * 16;
        layer.style.transform = `translate(${px}px, ${py}px)`;
        raf = null;
      });
    });
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function spawnClouds(layer, n) {
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'ambient-item ambient-cloud';
      el.style.top = `${rand(5, 70)}%`;
      el.style.left = `-10%`;
      el.style.animationDuration = `${rand(38, 60)}s`;
      el.style.animationDelay = `${rand(-30, 0)}s`;
      el.style.opacity = rand(0.35, 0.6);
      layer.appendChild(el);
    }
  }

  function spawnSparkles(layer, n) {
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'ambient-item ambient-sparkle';
      el.style.top = `${rand(2, 96)}%`;
      el.style.left = `${rand(2, 96)}%`;
      el.style.width = el.style.height = `${rand(14, 24)}px`;
      el.style.animationDuration = `${rand(2.4, 4.5)}s`;
      el.style.animationDelay = `${rand(0, 3)}s`;
      el.innerHTML = Icons.sparkle;
      layer.appendChild(el);
    }
  }

  function spawnConfetti(layer, n) {
    const colors = ['var(--gold)', 'var(--brick)', 'var(--navy)'];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'ambient-item ambient-confetti';
      el.style.top = `${rand(4, 92)}%`;
      el.style.left = `${rand(4, 96)}%`;
      el.style.width = el.style.height = `${rand(10, 16)}px`;
      el.style.color = colors[i % colors.length];
      el.style.animationDuration = `${rand(4, 7)}s`;
      el.style.animationDelay = `${rand(0, 4)}s`;
      el.innerHTML = Icons.checkerbit;
      layer.appendChild(el);
    }
  }

  function spawnSkidMarks(layer, n) {
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div');
      el.className = 'ambient-item ambient-skid';
      el.style.top = `${rand(10, 85)}%`;
      el.style.left = `${rand(5, 80)}%`;
      el.style.width = `${rand(70, 130)}px`;
      el.style.animationDuration = `${rand(5, 8)}s`;
      el.style.animationDelay = `${rand(0, 3)}s`;
      el.style.transform = `rotate(${rand(-25, 25)}deg)`;
      el.innerHTML = `<svg width="100%" height="14" viewBox="0 0 100 14"><path d="M2 10c10-6 20 4 30-2s20 4 30-2 20 4 36-2" fill="none" stroke="var(--navy)" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 9"/></svg>`;
      layer.appendChild(el);
    }
  }

  return { init };
})();

window.Ambient = Ambient;
