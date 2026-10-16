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
    '.band .card, main .card, .project, .hobby, .contact-box, .city, .about-body > *'
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

  // ---------- Travel carousels ----------
  document.querySelectorAll('.album .gallery').forEach(track => {
    const slides = [...track.querySelectorAll('.tile')];
    const wrap = document.createElement('div');
    wrap.className = 'carousel' + (slides.length < 2 ? ' single' : '');
    track.before(wrap); wrap.appendChild(track);
    track.tabIndex = 0;
    track.setAttribute('role', 'region');
    track.setAttribute('aria-roledescription', 'carousel');
    track.setAttribute('aria-label', (track.previousElementSibling?.textContent || wrap.previousElementSibling?.textContent || 'Photos').trim());
    if (slides.length < 2) { slides[0]?.classList.add('is-active'); return; }

    const pad = n => String(n).padStart(2, '0');
    const ui = document.createElement('div');
    ui.className = 'carousel-ui';
    ui.innerHTML = `
      <span class="count" aria-live="polite">01 / ${pad(slides.length)}</span>
      <span class="dots">${slides.map((_, i) => `<button aria-label="Photo ${i + 1}"></button>`).join('')}</span>
      <span class="autoplay" aria-hidden="true"><i></i></span>
      <span class="arrows"><button class="prev" aria-label="Previous photo">←</button><button class="next" aria-label="Next photo">→</button></span>`;
    wrap.appendChild(ui);
    const dots = [...ui.querySelectorAll('.dots button')];
    const count = ui.querySelector('.count');
    const prev = ui.querySelector('.prev'), next = ui.querySelector('.next');
    let active = 0;

    const go = i => {
      i = Math.max(0, Math.min(slides.length - 1, i));
      track.scrollTo({ left: slides[i].offsetLeft - slides[0].offsetLeft, behavior: reduce ? 'auto' : 'smooth' });
    };
    const setActive = i => {
      active = i;
      slides.forEach((s, k) => s.classList.toggle('is-active', k === i));
      dots.forEach((d, k) => d.setAttribute('aria-current', k === i ? 'true' : 'false'));
      count.textContent = `${pad(i + 1)} / ${pad(slides.length)}`;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      prev.disabled = i === 0;
      next.disabled = atEnd && i === slides.length - 1;
    };
    // the slide whose left edge is nearest the track's left edge is "active"
    const sync = () => {
      const x = track.scrollLeft + slides[0].offsetLeft;
      let best = 0;
      slides.forEach((s, k) => { if (Math.abs(s.offsetLeft - x) < Math.abs(slides[best].offsetLeft - x)) best = k; });
      if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) best = slides.length - 1;
      if (best !== active || !slides[best].classList.contains('is-active')) setActive(best);
    };
    let raf = 0;
    track.addEventListener('scroll', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(sync); }, { passive: true });
    prev.onclick = () => { go(active - 1); restart(); };
    next.onclick = () => { go(active + 1); restart(); };
    dots.forEach((d, k) => d.onclick = () => { go(k); restart(); });
    track.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1); restart(); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); go(active - 1); restart(); }
    });

    // Mouse drag to scroll (touch already scrolls natively)
    let down = null;
    track.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = { x: e.clientX, left: track.scrollLeft, moved: false };
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!down.moved && Math.abs(dx) > 6) { down.moved = true; track.classList.add('dragging'); }
      if (down.moved) track.scrollLeft = down.left - dx;
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      if (down.moved) {
        track.classList.remove('dragging');
        track.dataset.justDragged = '1';
        setTimeout(() => delete track.dataset.justDragged, 50);
        sync(); go(active);
      }
      down = null; restart();
    });
    track.addEventListener('dragstart', e => e.preventDefault());

    // Autoplay: only while on screen, not hovered/focused, motion allowed
    const DELAY = 4500;
    let visible = false, paused = false, timer = 0;
    wrap.style.setProperty('--autoplay', DELAY + 'ms');
    function restart() {
      clearTimeout(timer);
      wrap.classList.remove('playing');
      if (reduce || !visible || paused) return;
      void wrap.offsetWidth; // restart the progress-bar animation
      wrap.classList.add('playing');
      timer = setTimeout(() => { go(active + 1 >= slides.length ? 0 : active + 1); restart(); }, DELAY);
    }
    wrap.addEventListener('mouseenter', () => { paused = true; restart(); });
    wrap.addEventListener('mouseleave', () => { paused = false; restart(); });
    wrap.addEventListener('focusin', () => { paused = true; restart(); });
    wrap.addEventListener('focusout', () => { paused = false; restart(); });
    new IntersectionObserver(([e]) => { visible = e.intersectionRatio > 0.6; restart(); }, { threshold: [0, 0.6, 1] }).observe(wrap);
    document.addEventListener('visibilitychange', () => { visible = visible && !document.hidden; restart(); });

    setActive(0);
  });

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
      if (t && t.closest('.gallery')?.dataset.justDragged) { e.preventDefault(); return; } // end of a drag, not a click
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
