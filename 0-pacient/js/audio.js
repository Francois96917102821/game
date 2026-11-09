// Звук синтезируется в браузере: файлы не нужны. Позже можно заменить на mp3/ogg.
const Sound = (() => {
  let ctx, master, ambientNodes = [], muted = localStorage.getItem('tq_mute') === '1';

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.8;
    master.connect(ctx.destination);
  }

  function noiseBuffer(sec) {
    const b = ctx.createBuffer(1, ctx.sampleRate * sec, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  function stopAmbient() {
    ambientNodes.forEach(n => { try { n.stop(); } catch (e) {} });
    ambientNodes = [];
  }

  const ambients = {
    drone(freq = 55, windLevel = 0.04) {
      const g = ctx.createGain(); g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 3);
      g.connect(master);
      [freq, freq * 1.01, freq * 1.5].forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 2 ? 'sine' : 'sawtooth';
        o.frequency.value = f;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220;
        o.connect(lp); lp.connect(g); o.start(); ambientNodes.push(o);
      });
      const n = ctx.createBufferSource(); n.buffer = noiseBuffer(4); n.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
      const wg = ctx.createGain(); wg.gain.value = windLevel;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
      const lg = ctx.createGain(); lg.gain.value = 250;
      lfo.connect(lg); lg.connect(bp.frequency); lfo.start();
      n.connect(bp); bp.connect(wg); wg.connect(master); n.start();
      ambientNodes.push(n, lfo);
    }
  };

  const sfx = {
    drip() {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(500, t + 0.12);
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.3);
    },
    growl() {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = 70; lfo.frequency.value = 22; lg.gain.value = 30;
      lfo.connect(lg); lg.connect(o.frequency);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 400;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.3);
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.8);
      o.connect(lp); lp.connect(g); g.connect(master);
      o.start(t); lfo.start(t); o.stop(t + 1.8); lfo.stop(t + 1.8);
    },
    hit() {
      const t = ctx.currentTime, n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.4);
      const g = ctx.createGain(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      g.gain.setValueAtTime(0.6, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      n.connect(lp); lp.connect(g); g.connect(master); n.start(t);
    },
    shot() {
      const t = ctx.currentTime, n = ctx.createBufferSource(); n.buffer = noiseBuffer(0.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      n.connect(g); g.connect(master); n.start(t);
    },
    radio() {
      const t = ctx.currentTime, n = ctx.createBufferSource(); n.buffer = noiseBuffer(1);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 2;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2, t + 0.1);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.9);
      n.connect(bp); bp.connect(g); g.connect(master); n.start(t);
    },
    click() {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = 220;
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.07);
    },
    echo() {
      const t = ctx.currentTime;
      [880, 1320].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + i * 0.12);
        g.gain.exponentialRampToValueAtTime(0.1, t + i * 0.12 + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.12 + 0.7);
        o.connect(g); g.connect(master); o.start(t + i * 0.12); o.stop(t + i * 0.12 + 0.8);
      });
    }
  };

  return {
    init,
    play(name) { if (!ctx || !sfx[name]) return; try { sfx[name](); } catch (e) {} },
    ambient(name, ...args) {
      if (!ctx) return;
      stopAmbient();
      if (ambients[name]) ambients[name](...args);
    },
    get muted() { return muted; },
    toggle() {
      muted = !muted;
      localStorage.setItem('tq_mute', muted ? '1' : '0');
      if (master) master.gain.value = muted ? 0 : 0.8;
      return muted;
    }
  };
})();
