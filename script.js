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
