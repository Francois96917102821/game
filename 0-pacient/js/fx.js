// Фоновые частицы (пепел/искры/пыль) и экранные эффекты.
const FX = (() => {
  const canvas = document.getElementById('particles');
  const c = canvas.getContext('2d');
  let w, h, parts = [], mode = 'ash';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = innerWidth * dpr; h = canvas.height = innerHeight * dpr;
  }
  addEventListener('resize', resize); resize();

  const modes = {
    ash:   { n: 60, color: '180,180,170', speed: 0.4, size: 2, drift: 0.3 },
    embers:{ n: 45, color: '255,140,40', speed: -0.7, size: 2.2, drift: 0.5 },
    dust:  { n: 40, color: '150,170,150', speed: 0.1, size: 1.5, drift: 0.15 },
    glitch:{ n: 50, color: '80,255,220', speed: 0.3, size: 1.5, drift: 0.8 }
  };

  function spawn(m, anywhere) {
    return {
      x: Math.random() * w, y: anywhere ? Math.random() * h : (m.speed < 0 ? h + 10 : -10),
      r: (Math.random() * m.size + 0.6) * (w / 600 + 1),
      vy: (Math.random() * 0.8 + 0.4) * m.speed * (w / 500 + 1),
      vx: (Math.random() - 0.5) * m.drift * (w / 500 + 1),
      a: Math.random() * 0.6 + 0.2
    };
  }

  function setMode(name) {
    mode = modes[name] ? name : 'ash';
    const m = modes[mode];
    parts = Array.from({ length: reduce ? 0 : m.n }, () => spawn(m, true));
  }

  function frame() {
    const m = modes[mode];
    c.clearRect(0, 0, w, h);
    for (const p of parts) {
      p.x += p.vx + Math.sin(p.y / 80) * 0.2; p.y += p.vy;
      if (p.y > h + 10 || p.y < -10 || p.x < -10 || p.x > w + 10) Object.assign(p, spawn(m, false));
      c.fillStyle = `rgba(${m.color},${p.a})`;
      c.beginPath(); c.arc(p.x, p.y, p.r, 0, 6.283); c.fill();
    }
    requestAnimationFrame(frame);
  }
  setMode('ash'); frame();

  return {
    setMode,
    shake() {
      if (reduce) return;
      const el = document.querySelector('.screen.active');
      if (!el) return;
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    },
    flash() {
      if (reduce) return;
      const el = document.getElementById('flash');
      el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    },
    vibrate(ms) { if (navigator.vibrate) navigator.vibrate(ms); }
  };
})();
