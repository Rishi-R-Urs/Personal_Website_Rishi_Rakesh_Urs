// text-fx.js — GSAP text effects tuned to the dot-matrix theme.
// If GSAP fails to load, or the visitor prefers reduced motion, text stays static.
window.addEventListener('DOMContentLoaded', () => {
  if (!window.gsap || !window.ScrambleTextPlugin) return;
  gsap.registerPlugin(ScrambleTextPlugin, TextPlugin);
  const EASE = 'power2.inOut'; // closest GSAP curve to cubic-bezier(.4,0,.2,1)

  const label = el => {
    el.dataset.text = el.textContent.trim();
    el.setAttribute('aria-label', el.dataset.text);
    return el.dataset.text;
  };
  const decode = (el, duration = 0.9, chars = 'upperCase') => gsap.to(el, {
    duration, ease: 'none',
    scrambleText: { text: el.dataset.text, chars, speed: 0.6, revealDelay: duration * 0.35, oldClass: 'scramble-char', newClass: '' }
  });

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    // wait for fonts and for the home splash to lift, so the intro is actually seen
    Promise.all([document.fonts.ready, window.splashDone]).then(() => {

      // (a) Name boots up like a dot-matrix display: noise -> letters
      // Each word scrambles in its own span so the line still wraps at spaces.
      document.querySelectorAll('[data-fx="reveal"]').forEach(el => {
        const words = label(el).split(/\s+/);
        el.innerHTML = words.map(w => `<span aria-hidden="true" data-text="${w}">${w}</span>`).join(' ');
        gsap.fromTo(el, { opacity: 0 }, { opacity: 1, duration: 0.2 });
        el.querySelectorAll('span').forEach((s, i) => decode(s, 1.2, '01').delay(0.1 + i * 0.15));
      });
      gsap.from('.hero-overlay .hero-tag, .hero-overlay .hero-cta', {
        opacity: 0, duration: 0.5, ease: EASE, stagger: 0.1, delay: 1.1
      });

      // (b) Tagline types, holds, deletes (block cursor is CSS)
      document.querySelectorAll('[data-fx="rotate"]').forEach(el => {
        const words = JSON.parse(el.dataset.words);
        const tl = gsap.timeline({ repeat: -1, delay: 2 });
        words.forEach(w => {
          tl.to(el, { duration: w.length * 0.045, text: w, ease: 'none' })
            .to({}, { duration: 2 })
            .to(el, { duration: 0.35, text: '', ease: 'none' });
        });
      });

      // (c) Mono labels decode when they scroll in; serif titles just fade
      const io = new IntersectionObserver(es => es.forEach(e => {
        if (!e.isIntersecting) return;
        const el = e.target;
        if (el.dataset.text) decode(el, 0.7);
        else gsap.fromTo(el, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.6, ease: EASE });
        io.unobserve(el);
      }), { threshold: 0.6 });
      document.querySelectorAll('.eyebrow, .kicker, .chip-label').forEach(el => { label(el); io.observe(el); });
      document.querySelectorAll('.page-title, .hero h1').forEach(el => io.observe(el));

      // (d) Dot-matrix footer links glitch on hover
      document.querySelectorAll('.foot-nav a').forEach(a => {
        label(a);
        a.addEventListener('mouseenter', () => { gsap.killTweensOf(a); decode(a, 0.35); });
      });
    });
  });
});
