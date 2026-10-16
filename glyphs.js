// glyphs.js — high-resolution dot-matrix pictograms for the Hobbies page.
// Each glyph is sampled from a pictogram drawn on an offscreen canvas into a
// COLS x ROWS grid of LEDs with 4 brightness levels; warm pixels become
// tiger-orange LEDs. Rendered to a DPR-aware canvas so it stays crisp.
// Interactions: column-sweep reveal, cursor "magnet" spotlight, ripple on enter/click.
(() => {
  const COLS = 44, ROWS = 30;
  const PICTO = { swim: '🏊', kart: '🏎️', horse: '🏇', theatre: '🎭', travel: '🌏' };
  // Low-res fallbacks (16x12) if the platform can't draw emoji to canvas
  const FALLBACK = {
    swim:    ['................','..........**....','.........****...','....##....**....','...####.........','..##..########..','.#.........####.','................','.##..##..##..##.','#..##..##..##..#','................','.##..##..##..##.'],
    kart:    ['................','................','.......**.......','......****......','......#..#......','..############..','.##############.','.#.##......##.#.','..####....####..','..#**#....#**#..','...##......##...','................'],
    horse:   ['......#.#.......','.....######.....','....########....','...#########....','..####*#####....','.######.#####...','#######..#####..','.####.....####..','..........#####.','..........#####.','..........#####.','..........#####.'],
    theatre: ['.######.........','########........','##*##*##.######.','################','##....###*##*##.','.#.##.##########','.######.##....##','..####..#.####.#','.........######.','..........####..','................','................'],
    travel:  ['.......##.......','.......##.......','......####......','......####......','.....######.....','...##########...','.##############.','##....####....##','......####......','.......##.......','.....**##**.....','....**....**....'],
  };

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const C = {
    off:   css.getPropertyValue('--g-800').trim() || '#262626',
    on:    '#FFFFFF',
    tiger: css.getPropertyValue('--tiger').trim() || '#FD6A02',
  };

  // ---- sample a pictogram into [{level 0..3, hot}] ----
  function sample(key) {
    const W = COLS * 8, H = ROWS * 8;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `${H * 0.92}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    g.fillText(PICTO[key], W / 2, H / 2 + H * 0.04);
    const data = g.getImageData(0, 0, W, H).data;
    const cells = []; let any = 0;
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      let a = 0, r = 0, gr = 0, b = 0, n = 0;
      for (let sy = 1; sy < 8; sy += 2) for (let sx = 1; sx < 8; sx += 2) {
        const i = ((y * 8 + sy) * W + (x * 8 + sx)) * 4;
        const al = data[i + 3] / 255;
        a += al; r += data[i] * al; gr += data[i + 1] * al; b += data[i + 2] * al; n++;
      }
      a /= n;
      if (a < 0.28) { cells.push({ level: 0, hot: false }); continue; }
      any++;
      r /= a * n; gr /= a * n; b /= a * n;
      const lum = (0.2126 * r + 0.7152 * gr + 0.0722 * b) / 255;
      const hot = r > 150 && r > gr * 1.35 && r > b * 1.6;      // warm -> orange LED
      const level = lum > 0.62 ? 3 : lum > 0.38 ? 2 : 1;        // detail inside the shape
      cells.push({ level, hot });
    }
    return any > 40 ? cells : null;
  }
  function fromBitmap(rows) { // upscale 16x12 fallback onto the grid
    const cells = [];
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const ch = rows[Math.floor(y / ROWS * rows.length)][Math.floor(x / COLS * rows[0].length)];
      cells.push({ level: ch === '.' ? 0 : 3, hot: ch === '*' });
    }
    return cells;
  }

  document.querySelectorAll('.hobby[data-glyph]').forEach(card => {
    const key = card.dataset.glyph;
    const host = card.querySelector('.glyph');
    if (!host || !PICTO[key]) return;
    const cells = sample(key) || fromBitmap(FALLBACK[key]);

    const cv = document.createElement('canvas');
    cv.setAttribute('role', 'img');
    cv.setAttribute('aria-label', `${card.querySelector('h2')?.textContent || key} glyph`);
    host.appendChild(cv);
    const g = cv.getContext('2d');

    let pitch = 7, dpr = 1;
    const size = () => {
      const avail = Math.min(host.parentElement.clientWidth - 40, 420);
      pitch = Math.max(5, Math.floor(avail / COLS));
      dpr = Math.min(2, devicePixelRatio || 1);
      cv.width = COLS * pitch * dpr; cv.height = ROWS * pitch * dpr;
      cv.style.width = COLS * pitch + 'px'; cv.style.height = ROWS * pitch + 'px';
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    };

    // state
    let revealStart = reduce ? -1e9 : null; // null = not yet revealed
    let mouse = null;                       // {x,y} in grid units
    const ripples = [];                     // {x,y,t0}
    let running = false;

    function draw(now) {
      g.clearRect(0, 0, cv.width, cv.height);
      const r0 = pitch * 0.34;
      let busy = false;
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
        const c = cells[y * COLS + x];
        // reveal sweep: columns light left -> right
        let on = 0;
        if (revealStart !== null) {
          const t = (now - revealStart - x * 14) / 260;
          on = Math.max(0, Math.min(1, t));
          if (t < 1) busy = true;
        }
        let boost = 0, warm = 0;
        if (mouse) {
          const d = Math.hypot(x - mouse.x, (y - mouse.y) * 1.1);
          boost = Math.max(0, 1 - d / 7);       // magnet radius ~7 dots
          warm = boost > 0.55 ? 1 : 0;
        }
        for (const rp of ripples) {
          const age = (now - rp.t0) / 900;
          if (age > 1) continue;
          busy = true;
          const ring = Math.abs(Math.hypot(x - rp.x, y - rp.y) - age * 34);
          if (ring < 1.6) { boost = Math.max(boost, (1 - ring / 1.6) * (1 - age)); warm = 1; }
        }
        const lit = c.level > 0 ? on : 0;
        const radius = r0 * (1 + boost * 0.9) * (c.level === 0 ? 0.8 : 1);
        g.beginPath();
        g.arc(x * pitch + pitch / 2, y * pitch + pitch / 2, radius, 0, Math.PI * 2);
        if (lit > 0 && (c.hot || warm)) {
          g.fillStyle = C.tiger; g.globalAlpha = Math.max(0.25, lit);
          g.shadowColor = C.tiger; g.shadowBlur = 6 * boost + (c.hot ? 4 : 0);
        } else if (lit > 0) {
          g.fillStyle = C.on; g.globalAlpha = lit * (0.28 + c.level * 0.24) + boost * 0.3;
          g.shadowBlur = 0;
        } else {
          g.fillStyle = boost > 0.1 ? C.tiger : C.off;
          g.globalAlpha = boost > 0.1 ? 0.15 + boost * 0.35 : 1;
          g.shadowBlur = 0;
        }
        g.fill();
      }
      g.globalAlpha = 1; g.shadowBlur = 0;
      while (ripples.length && now - ripples[0].t0 > 900) ripples.shift();
      return busy || !!mouse;
    }
    const loop = now => { running = draw(now); if (running) requestAnimationFrame(loop); };
    const kick = () => { if (!running) { running = true; requestAnimationFrame(loop); } };

    const toGrid = e => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) / pitch - 0.5, y: (e.clientY - r.top) / pitch - 0.5 };
    };
    if (!reduce) {
      card.addEventListener('pointerenter', e => { ripples.push({ ...toGrid(e), t0: performance.now() }); kick(); });
      card.addEventListener('pointermove', e => { mouse = toGrid(e); kick(); });
      card.addEventListener('pointerleave', () => { mouse = null; kick(); });
      card.addEventListener('click', e => { ripples.push({ ...toGrid(e), t0: performance.now() }); kick(); });
    }
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      if (revealStart === null) revealStart = performance.now();
      kick(); io.disconnect();
    }, { threshold: 0.4 }).observe(cv);
    new ResizeObserver(size).observe(host.parentElement);
  });
})();
