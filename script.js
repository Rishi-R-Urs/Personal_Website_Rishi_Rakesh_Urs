// Mobile nav
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('.site-nav');
if (toggle && nav){
  toggle.addEventListener('click', ()=> nav.classList.toggle('open'));
}

// Accent color picker (saved)
const accentInput = document.getElementById('accent');
const root = document.documentElement;
const savedAccent = localStorage.getItem('accent');
if (savedAccent) root.style.setProperty('--accent', savedAccent);
if (accentInput){
  accentInput.value = savedAccent || getComputedStyle(root).getPropertyValue('--accent').trim();
  accentInput.addEventListener('input', e=>{
    root.style.setProperty('--accent', e.target.value);
    localStorage.setItem('accent', e.target.value);
  });
}

// Footer year
const y = document.getElementById('year');
if (y) y.textContent = new Date().getFullYear();

// Scroll progress bar
const progress = document.getElementById('progress');
if (progress){
  document.addEventListener('scroll', ()=>{
    const scrollTop = window.scrollY;
    const docHeight = document.body.scrollHeight - window.innerHeight;
    const pct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    progress.style.width = pct + '%';
  });
}

// Travel lightbox
const gallery = document.querySelector('.gallery');
if (gallery){
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbCap = document.getElementById('lightbox-caption');
  const lbClose = document.querySelector('.lightbox-close');

  gallery.addEventListener('click', e=>{
    const img = e.target.closest('img');
    if (!img) return;
    lbImg.src = img.dataset.full || img.src;
    lbImg.alt = img.alt || '';
    lbCap.textContent = img.parentElement.querySelector('figcaption')?.textContent || '';
    lb.classList.add('show');
    lb.setAttribute('aria-hidden','false');
  });

  lbClose.addEventListener('click', ()=>{
    lb.classList.remove('show');
    lb.setAttribute('aria-hidden','true');
    lbImg.src = '';
  });

  lb.addEventListener('click', e=>{
    if (e.target === lb) lbClose.click();
  });

  document.addEventListener('keydown', e=>{
    if (e.key === 'Escape' && lb.classList.contains('show')) lbClose.click();
  });
}
