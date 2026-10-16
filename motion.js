// motion.js — shared micro-interactions (no dependencies)
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Cross-page view transitions reject their promises when a navigation
  // interrupts them (fast clicks, back button). That's expected, so silence it.
  const quiet = vt => vt && ['ready', 'finished', 'updateCallbackDone'].forEach(p => vt[p]?.catch(() => {}));
  addEventListener('pageswap', e => quiet(e.viewTransition));

  // ---------- Splash loader (home only) ----------
  // Progress follows real work (hero photo + fonts + page load), but the
  // counter eases toward it so it never jumps, and never lingers past 3s.
  const root = document.documentElement;
  const splash = document.getElementById('splash');
  window.splashDone = new Promise(resolve => {
    if (!splash || root.classList.contains('no-splash')) { root.classList.remove('splashing'); return resolve(); }
    const countEl = splash.querySelector('.splash-count');
    const dots = [...splash.querySelectorAll('.splash-bar i')];
    const heroPhoto = document.querySelector('.hero-photo img');
    const tasks = [
      heroPhoto && !heroPhoto.complete ? new Promise(r => { heroPhoto.onload = heroPhoto.onerror = r; }) : null,
      document.fonts?.ready,
      document.readyState === 'complete' ? null : new Promise(r => addEventListener('load', r, { once: true })),
    ].filter(Boolean);
    let doneTasks = 0, shown = 0;
    const t0 = performance.now(), MIN = 1100, MAX = 3000;
    tasks.forEach(p => p.then(() => doneTasks++));

    let finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      countEl.textContent = '100';
      dots.forEach(d => { d.classList.add('on'); d.classList.remove('head'); });
      setTimeout(() => {
        splash.classList.add('out');
        root.classList.remove('splashing');
        root.classList.add('splash-done');
        try { sessionStorage.setItem('splashSeen', '1'); } catch (e) {}
        resolve();
        splash.addEventListener('transitionend', () => splash.remove(), { once: true });
      }, 180);
    };
    const tick = now => {
      const elapsed = now - t0;
      const real = tasks.length ? doneTasks / tasks.length : 1;
      // time floor keeps the counter moving even while waiting on the network
      const target = Math.min(1, Math.max(Math.min(real, elapsed / MIN), elapsed / MAX * 0.9));
      shown += (target - shown) * 0.12;
      const pct = Math.round(shown * 100);
      countEl.textContent = String(pct).padStart(3, '0');
      const lit = Math.round(shown * dots.length);
      dots.forEach((d, i) => { d.classList.toggle('on', i < lit - 1); d.classList.toggle('head', i === lit - 1); });
      if ((real === 1 && elapsed >= MIN && pct >= 99) || elapsed >= MAX) return finish();
      requestAnimationFrame(tick);
    };
    setTimeout(finish, MAX + 250); // timers still fire if rAF is throttled (background tabs)
    requestAnimationFrame(tick);
  });

  // ---------- Eyebrow labels ("02 — About") above page titles ----------
  const navLinks = [...document.querySelectorAll('.site-nav a')];
  const activeIdx = navLinks.findIndex(a => a.classList.contains('active'));
  const title = document.querySelector('.page-title, .hero h1');
  if (title && activeIdx >= 0) {
    const eb = document.createElement('p');
    eb.className = 'eyebrow';
    eb.textContent = `${String(activeIdx + 1).padStart(2, '0')} — ${navLinks[activeIdx].textContent.trim()}`;
    title.before(eb);
  }

  // ---------- Footer: black slab with dot-matrix nav ----------
  const footer = document.querySelector('body > footer, .site-footer');
  if (footer && navLinks.length) {
    const year = new Date().getFullYear();
    footer.innerHTML = `
      <nav class="foot-nav" aria-label="Footer">
        ${navLinks.map(a => `<a href="${a.getAttribute('href')}"${a.classList.contains('active') ? ' class="active" aria-current="page"' : ''}>${a.textContent.trim()}</a>`).join('')}
      </nav>
      <div class="foot-meta">
        <span>© <span id="year">${year}</span> Rishi Rakesh Urs</span>
        <span><a href="https://www.linkedin.com/in/rishi-rakesh-urs/" target="_blank" rel="noopener">LinkedIn ↗</a><a href="https://github.com/Rishi-R-Urs" target="_blank" rel="noopener">GitHub ↗</a></span>
      </div>`;
  }

  // ---------- Header shadow once scrolled ----------
  const header = document.querySelector('.site-header');
  const onScrollHeader = () => header && header.classList.toggle('scrolled', scrollY > 8);

  // ---------- Hero parallax ----------
  const heroImg = document.querySelector('.hero-photo img, .about-cover img, .travel-cover img');
  if (heroImg && !reduce) heroImg.setAttribute('data-parallax', '');
  let ticking = false;
  const onScrollParallax = () => {
    if (!heroImg || reduce || ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const h = heroImg.parentElement.offsetHeight;
      heroImg.style.setProperty('--py', `${Math.min(scrollY, h) * 0.35}px`);
      ticking = false;
    });
  };

  // ---------- Home hero: face-aware placement on a white canvas ----------
  // Find the person in the photo by scanning for non-white pixels, then
  // place the photo so the subject sits left of centre and the text gets
  // the free white space to its right. Falls back to a stacked layout.
  const hero = document.querySelector('.hero-photo');
  const overlay = hero?.querySelector('.hero-overlay');
  const portrait = hero?.querySelector('img');
  let subject = { x0: 0.33, x1: 0.64 };           // fallback, in image fractions

  const findSubject = img => {
    try {
      const w = 240, h = Math.round(240 * img.naturalHeight / img.naturalWidth);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0, w, h);
      const d = g.getImageData(0, 0, w, h).data;
      const ink = new Array(w).fill(0);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (d[i + 3] < 128) continue;              // undecoded/transparent: not subject
        const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        if (lum < 225) ink[x]++;
      }
      const busy = ink.map(n => n / h > 0.06);    // a column is "subject" if >6% non-white
      // longest continuous run of busy columns = the person (ignores thin
      // border lines or specks near the photo's edges)
      let best = [-1, -1], start = -1;
      for (let x = 0; x <= w; x++) {
        if (x < w && busy[x]) { if (start < 0) start = x; continue; }
        if (start >= 0 && x - start > best[1] - best[0]) best = [start, x];
        start = -1;
      }
      const span = (best[1] - best[0]) / w;
      if (best[0] >= 0 && span > 0.08 && span < 0.9) subject = { x0: best[0] / w, x1: best[1] / w };
    } catch (e) { /* tainted canvas or decode issue: keep fallback */ }
  };

  const layoutHero = () => {
    if (!hero || !portrait?.naturalWidth) return;
    const W = hero.clientWidth;
    const H = Math.round(Math.min(640, Math.max(440, innerHeight * 0.64)));
    const imgW = H * portrait.naturalWidth / portrait.naturalHeight;
    const subjW = (subject.x1 - subject.x0) * imgW;
    const margin = Math.max(24, Math.min(96, W * 0.05));
    const gap = Math.max(32, W * 0.03);
    const textW = Math.min(620, Math.max(400, W * 0.38));
    // ideal: subject centred at 30% of the width; slide left if the text needs room
    let subjLeft = W * 0.30 - subjW / 2;
    subjLeft = Math.min(subjLeft, W - margin - textW - gap - subjW);
    subjLeft = Math.max(subjLeft, margin * 0.5);
    const fits = subjLeft + subjW + gap + textW <= W - margin + 1;
    hero.classList.toggle('hero-canvas', fits);
    if (!fits) {
      hero.style.height = portrait.style.cssText = overlay.style.cssText = '';
      // stacked: the photo is cropped by object-fit:cover, so pick the crop
      // that puts the subject's centre in the middle of the frame
      const boxW = portrait.clientWidth, boxH = portrait.clientHeight;
      const shownW = Math.max(boxW, boxH * portrait.naturalWidth / portrait.naturalHeight);
      const c = (subject.x0 + subject.x1) / 2;
      const p = shownW > boxW ? (c * shownW - boxW / 2) / (shownW - boxW) : 0.5;
      portrait.style.setProperty('object-position', `${(Math.min(1, Math.max(0, p)) * 100).toFixed(1)}% 40%`, 'important');
      return;
    }
    hero.style.height = H + 'px';
    portrait.style.width = imgW + 'px';
    portrait.style.height = H + 'px';
    portrait.style.left = (subjLeft - subject.x0 * imgW) + 'px';
    overlay.style.setProperty('--ov-left', (subjLeft + subjW + gap) + 'px');
    overlay.style.setProperty('--ov-right', margin + 'px');
  };
  if (portrait) {
    // decode() resolves once pixels are actually readable (complete != decoded)
    const ready = () => { findSubject(portrait); layoutHero(); };
    const whenLoaded = portrait.complete ? Promise.resolve() : new Promise(r => portrait.addEventListener('load', r, { once: true }));
    whenLoaded.then(() => portrait.decode?.()).then(ready, ready);
    addEventListener('resize', () => requestAnimationFrame(layoutHero));
  }

  // ---------- Experience timeline line draws with scroll ----------
  const timeline = document.querySelector('.timeline');
  const onScrollTimeline = () => {
    if (!timeline || reduce) return;
    const r = timeline.getBoundingClientRect();
    const p = (innerHeight * 0.7 - r.top) / r.height;
    timeline.style.setProperty('--tl', Math.max(0, Math.min(1, p)).toFixed(3));
  };

  const onScroll = () => { onScrollHeader(); onScrollParallax(); onScrollTimeline(); };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Scroll reveal with stagger ----------
  // Returns the transition delay (ms) for the i-th revealed element.
  // `el` is the element, `i` its index among siblings revealed together.
  function staggerDelay(el, i) {
    if (el.matches('.city, .kicker')) return 0;           // headings lead, never wait
    const step = el.matches('.tile, .chips li') ? 40 : 70; // small items cascade faster
    return Math.min(i, 5) * step;                          // cap so big batches don't drag
  }

  const revealTargets = document.querySelectorAll(
    '.band .card, main .card, .project, .hobby, .contact-box, .tile, .city, .about-body > *'
  );
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      // index within this batch, so things that enter together cascade
      entries.filter(e => e.isIntersecting).forEach((e, i) => {
        e.target.style.setProperty('--d', `${staggerDelay(e.target, i)}ms`);
        e.target.classList.add('in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealTargets.forEach(el => {
      // skip home cards hidden in inactive groups; they animate via CSS on switch
      if (el.closest('.group')) return;
      el.classList.add('reveal');
      io.observe(el);
    });
  }

  // ---------- Surface spotlight: feed cursor position to the hovered card ----------
  const SURFACE = '.card, .project, .hobby-body, .contact-box, .stat';
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const s = e.target.closest?.(SURFACE) || e.target.closest?.('.hobby')?.querySelector('.hobby-body');
    if (!s) return;
    const r = s.getBoundingClientRect();
    s.style.setProperty('--mx', `${e.clientX - r.left}px`);
    s.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  // ---------- Buttons become "hardware keys": LED · label · arrow cell ----------
  document.querySelectorAll('.btn').forEach(b => {
    if (b.querySelector('.btn-label')) return;
    const text = b.textContent.replace(/[→↗]\s*$/, '').trim().replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const ext = b.target === '_blank';
    const arrow = b.dataset.icon || (ext ? '↗' : '→');
    b.innerHTML = `<span class="btn-led" aria-hidden="true"></span><span class="btn-label">${text}</span>` +
      `<span class="btn-arrow${ext ? ' ext' : ''}" aria-hidden="true"><i>${arrow}</i><i>${arrow}</i></span>`;
    if (ext && !b.rel) b.rel = 'noopener';
  });

  // Copy keys: copy the value, confirm in the label, then restore
  document.querySelectorAll('.btn[data-copy]').forEach(b => {
    const l = b.querySelector('.btn-label');
    const live = document.createElement('span');
    live.className = 'sr-only'; live.setAttribute('aria-live', 'polite');
    b.after(live);
    b.addEventListener('click', async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(b.dataset.copy); ok = true; } catch (e) {}
      l.textContent = ok ? 'Copied' : 'Press ⌘C';
      if (l.dataset.text) l.dataset.text = l.textContent;
      live.textContent = ok ? `${b.dataset.copy} copied to clipboard` : '';
      b.classList.add('done');
      clearTimeout(b._t);
      b._t = setTimeout(() => { l.textContent = 'Copy'; if (l.dataset.text) l.dataset.text = 'Copy'; b.classList.remove('done'); }, 1800);
    });
  });

  // ---------- Home selector: numbered keys with an LED for the active group ----------
  document.querySelectorAll('.selector .pill').forEach((p, i) => {
    const text = p.textContent.trim();
    p.innerHTML = `<span class="pill-idx" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>` +
      `<span class="pill-label">${text}</span><span class="pill-led" aria-hidden="true"></span>`;
    p.setAttribute('aria-pressed', p.classList.contains('active'));
    p.addEventListener('click', () => requestAnimationFrame(() =>
      document.querySelectorAll('.selector .pill').forEach(q => q.setAttribute('aria-pressed', q.classList.contains('active')))));
  });

  // ---------- Travel city keys: photo count + flash the heading you jump to ----------
  document.querySelectorAll('.jump a').forEach(a => {
    const target = document.querySelector(a.getAttribute('href'));
    const n = target?.nextElementSibling?.querySelectorAll('.tile').length || 0;
    const name = a.textContent.trim();
    a.innerHTML = `<span class="jump-led" aria-hidden="true"></span><span class="jump-label">${name}</span>` +
      `<span class="jump-count" aria-label="${n} photos">${String(n).padStart(2, '0')}</span>`;
    a.addEventListener('click', () => {
      if (!target) return;
      target.classList.remove('flash'); void target.offsetWidth; target.classList.add('flash');
    });
  });

  // ---------- Mobile menu key: 3x3 dot glyph that morphs into an X ----------
  const navToggle = document.querySelector('.nav-toggle');
  if (navToggle) {
    navToggle.innerHTML = '<span class="dots" aria-hidden="true">' + '<i></i>'.repeat(9) + '</span>';
    navToggle.setAttribute('aria-expanded', 'false');
    const navEl = document.querySelector('.site-nav');
    navToggle.addEventListener('click', () => requestAnimationFrame(() => {
      const open = navEl?.classList.contains('open');
      navToggle.setAttribute('aria-expanded', String(!!open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }));
  }

  // ---------- "→" arrows get their own span so they can nudge ----------
  document.querySelectorAll('a').forEach(a => {
    const last = a.lastChild;
    if (last && last.nodeType === 3 && /→\s*$/.test(last.textContent)) {
      last.textContent = last.textContent.replace(/→\s*$/, '');
      const s = document.createElement('span');
      s.className = 'arrow'; s.textContent = '→'; s.setAttribute('aria-hidden', 'true');
      a.appendChild(s);
    }
  });

  // ---------- Home: sliding pill indicator ----------
  const selector = document.getElementById('selector');
  if (selector) {
    const ind = document.createElement('span');
    ind.className = 'pill-indicator';
    selector.prepend(ind);
    selector.classList.add('has-indicator');
    const move = () => {
      const a = selector.querySelector('.pill.active');
      if (!a) return;
      ind.style.width = a.offsetWidth + 'px';
      ind.style.height = a.offsetHeight + 'px';
      ind.style.transform = `translate(${a.offsetLeft}px, ${a.offsetTop}px)`;
    };
    selector.addEventListener('click', e => e.target.closest('.pill') && requestAnimationFrame(move));
    addEventListener('resize', move);
    (document.fonts?.ready || Promise.resolve()).then(move);
  }

  // ---------- Count-up numbers ----------
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const fmt = (n, dec) => n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const run = el => {
      const end = parseFloat(el.dataset.count);
      const dec = (el.dataset.count.split('.')[1] || '').length;
      const suffix = el.dataset.suffix || '';
      if (reduce) { el.textContent = fmt(end, dec) + suffix; return; }
      const t0 = performance.now(), dur = 1400;
      const step = t => {
        const p = Math.min(1, (t - t0) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fmt(end * eased, dec) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const cio = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { run(e.target); cio.unobserve(e.target); }
    }), { threshold: 0.6 });
    counters.forEach(c => cio.observe(c));
  }

  // ---------- Travel lightbox (FLIP zoom from the clicked tile) ----------
  const album = document.querySelector('.album');
  if (album) {
    const lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-hidden', 'true');
    lb.innerHTML = `
      <button class="lb-close" aria-label="Close">×</button>
      <button class="lb-prev" aria-label="Previous photo">‹</button>
      <button class="lb-next" aria-label="Next photo">›</button>
      <figure><img alt=""><figcaption></figcaption></figure>`;
    document.body.appendChild(lb);
    const img = lb.querySelector('img'), cap = lb.querySelector('figcaption');
    const tiles = [...album.querySelectorAll('.tile')];
    let idx = -1, lastFocus = null;

    const flipFrom = thumb => {
      if (reduce || !thumb) return;
      const from = thumb.getBoundingClientRect(), to = img.getBoundingClientRect();
      if (!to.width) return;
      img.animate([
        { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`, opacity: .6 },
        { transform: 'none', opacity: 1 }
      ], { duration: 420, easing: 'cubic-bezier(.2,.7,.2,1)' });
    };

    const show = (i, animate) => {
      idx = (i + tiles.length) % tiles.length;
      const t = tiles[idx], thumb = t.querySelector('img');
      img.src = thumb.src; // thumb shows instantly, full-res swaps in
      const full = new Image();
      full.onload = () => { if (tiles[idx] === t) img.src = full.src; };
      full.src = t.href;
      img.alt = thumb.alt;
      cap.textContent = t.querySelector('.caption')?.textContent || '';
      if (animate) requestAnimationFrame(() => flipFrom(thumb));
    };
    const open = i => {
      lastFocus = document.activeElement;
      lb.classList.add('show'); lb.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      show(i, true);
      lb.querySelector('.lb-close').focus();
    };
    const close = () => {
      lb.classList.remove('show'); lb.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      lastFocus?.focus();
    };

    album.addEventListener('click', e => {
      const t = e.target.closest('.tile');
      if (!t || e.metaKey || e.ctrlKey) return; // cmd/ctrl-click still opens in a tab
      e.preventDefault();
      open(tiles.indexOf(t));
    });
    lb.querySelector('.lb-close').onclick = close;
    lb.querySelector('.lb-prev').onclick = () => show(idx - 1);
    lb.querySelector('.lb-next').onclick = () => show(idx + 1);
    lb.addEventListener('click', e => { if (e.target === lb || e.target.tagName === 'FIGURE') close(); });
    addEventListener('keydown', e => {
      if (!lb.classList.contains('show')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }
})();
