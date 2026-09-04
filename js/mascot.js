// ---------------------------------------------------------------------------
// The race car mascot: a friendly recurring character pinned in the bottom-
// right corner, with idle animation (CSS bob + blink, see sketch.css) and a
// hidden easter-egg trigger — click it 7 times within ~4.5 seconds to unlock
// the secret mini-game. A dashed ring appears after a few clicks as a hint
// that something is building, so the discovery feels earned, not random.
// ---------------------------------------------------------------------------

const Mascot = (() => {
  const STATES = {
    greet: 'assets/mascot/greet.jpg',
    running: 'assets/mascot/running.jpg',
    celebrate: 'assets/mascot/celebrate.jpg',
    finish: 'assets/mascot/finish.jpg',
    wink: 'assets/mascot/wink.jpg',
  };

  function src(state) {
    return STATES[state] || STATES.greet;
  }

  function mount(el, state, speechText) {
    if (!el) return;
    el.classList.add('mascot-block');
    el.innerHTML = `
      ${speechText ? `<div class="speech">${speechText}</div>` : ''}
      <div class="mascot-bob"><img src="${src(state)}" alt="Extra Mile mascot race car" /></div>
    `;
  }

  // Wires the click-counting easter-egg trigger onto any element (typically
  // the mascot riding the track). Safe to call every re-render: the hint
  // ring is re-attached each time (the caller resets the element's innerHTML
  // on every render), but the click listener itself is wired only once.
  function attachEasterEgg(el) {
    if (!el) return;
    el.classList.add('eggable');
    el.style.cursor = 'none';
    el.title = 'Beep beep!';

    if (!el.querySelector(':scope > .egg-progress-ring')) {
      const ring = document.createElement('div');
      ring.className = 'egg-progress-ring';
      el.appendChild(ring);
    }

    if (el.dataset.eggWired) return;
    el.dataset.eggWired = 'true';

    let clicks = 0;
    let resetTimer = null;
    const NEEDED = 7;
    const HINT_AT = 3;
    const WINDOW_MS = 4500; // generous enough for a real mouse, still reads as "rapid clicking"

    el.addEventListener('click', (e) => {
      e.stopPropagation();

      // Once the mini-game (or its reveal) is open, extra clicks on the
      // mascot are simply ignored — they must not re-count or re-trigger.
      if (window.Minigame && Minigame.isOpen()) return;

      clicks += 1;

      const img = el.querySelector('img');
      if (img) {
        img.style.transition = 'transform 0.12s ease';
        img.style.transform = 'scale(0.88)';
        setTimeout(() => { img.style.transform = ''; }, 120);
      }

      // Look the ring up fresh each time — re-renders replace the DOM node.
      const ring = el.querySelector(':scope > .egg-progress-ring');
      if (clicks >= HINT_AT) ring?.classList.add('show');

      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        clicks = 0;
        el.querySelector(':scope > .egg-progress-ring')?.classList.remove('show');
      }, WINDOW_MS);

      if (clicks >= NEEDED) {
        clicks = 0;
        ring.classList.remove('show');
        clearTimeout(resetTimer);
        revealEasterEgg();
      }
    });
  }

  async function revealEasterEgg() {
    const code = Auth.getCurrentCode();
    if (code) {
      try { await Store.markEasterEggFound(code); } catch (e) { console.warn('Could not record easter egg find', e); }
    }
    if (window.Minigame) {
      window.Minigame.open({ celebrateFind: true });
    } else {
      console.error('Minigame module not loaded — cannot open easter egg.');
    }
  }

  return { STATES, src, mount, attachEasterEgg, revealEasterEgg };
})();

window.Mascot = Mascot;
