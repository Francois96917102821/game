// Движок: показ сцен, выборы, переменные, сохранения, концовки.
(() => {
  const $ = id => document.getElementById(id);
  const SAVE_KEY = 'tq_save', END_KEY = 'tq_endings';
  let state = null, typing = null;

  const load = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const save = () => localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  const openEndings = () => load(END_KEY) || [];

  function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  }

  function menu() {
    stopTyping();
    $('btn-continue').hidden = !(load(SAVE_KEY) && !isFinished(load(SAVE_KEY)));
    FX.setMode('ash');
    $('bg').style.background = '#0b0d0c';
    show('intro');
  }

  function isFinished(s) { const sc = STORY.scenes[s.scene]; return !sc || sc.ending || s.scene === 'to_be_continued'; }

  function newGame() {
    state = { scene: STORY.start, vars: { ...STORY.vars } };
    go(STORY.start);
  }

  function renderStats() {
    $('stats').innerHTML = STORY.stats.map(s => {
      const val = state.vars[s.key];
      return `<span class="${val <= s.low ? 'low' : ''}">${s.label}: <b>${Math.max(val, 0)}</b></span>`;
    }).join('');
  }

  function stopTyping() { if (typing) { typing.skip(); typing = null; } }

  function typeParagraphs(paras, done) {
    const box = $('text');
    box.innerHTML = '';
    const els = paras.map(p => {
      const el = document.createElement('p');
      if (typeof p === 'object') el.className = 'echo';
      box.appendChild(el);
      return { el, str: typeof p === 'object' ? p.e : p };
    });
    let pi = 0, ci = 0, timer = null, finished = false;
    const finish = () => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      els.forEach(o => { o.el.textContent = o.str; });
      typing = null; done();
    };
    typing = { skip: finish };
    const step = () => {
      if (pi >= els.length) return finish();
      const o = els[pi];
      ci += 2;
      o.el.textContent = o.str.slice(0, ci);
      if (ci >= o.str.length) { pi++; ci = 0; timer = setTimeout(step, 350); }
      else timer = setTimeout(step, 22);
      $('story').scrollTop = $('story').scrollHeight;
    };
    step();
  }

  function go(id) {
    stopTyping();
    const scene = STORY.scenes[id];
    if (!scene) { console.error('Нет сцены', id); return menu(); }
    const v = state.vars;
    if (scene.onEnter) scene.onEnter(v);

    if (v.health <= 0 && !scene.ending) { return go('end_gray'); }

    state.scene = id;
    save();
    show('game');
    renderStats();
    $('bg').style.background = scene.bg || BG.dark;
    FX.setMode(scene.fx || 'ash');
    if (scene.ambient) Sound.ambient(...scene.ambient);
    (scene.sfx || []).forEach((s, i) => setTimeout(() => Sound.play(s), i * 400));
    if (scene.effect === 'shake') { FX.shake(); FX.vibrate(200); }
    if (scene.effect === 'flash') { FX.flash(); FX.vibrate(120); }

    if (scene.ending) {
      const list = openEndings();
      if (!list.includes(scene.ending)) { list.push(scene.ending); localStorage.setItem(END_KEY, JSON.stringify(list)); }
    }

    const choicesBox = $('choices');
    choicesBox.innerHTML = '';
    typeParagraphs(scene.text, () => {
      if (scene.ending) {
        const e = STORY.endings.find(x => x.id === scene.ending);
        const h = document.createElement('h3');
        h.className = 'ending-title'; h.textContent = 'Концовка: ' + e.title;
        choicesBox.appendChild(h);
      }
      (scene.choices || []).filter(c => !c.if || c.if(v)).forEach((c, i) => {
        const b = document.createElement('button');
        b.textContent = c.text;
        b.style.animationDelay = i * 120 + 'ms';
        b.onclick = () => {
          Sound.play('click');
          if (c.do) c.do(state.vars);
          if (c.next === '@menu') { save(); menu(); } else go(c.next);
        };
        choicesBox.appendChild(b);
      });
      $('story').scrollTop = $('story').scrollHeight;
    });
  }

  function showEndings() {
    const open = openEndings();
    $('endings-list').innerHTML = STORY.endings.map(e => open.includes(e.id)
      ? `<li class="open"><b>${e.title}</b><small>${e.desc}</small></li>`
      : '<li>🔒 ???<small>Концовка не открыта</small></li>').join('');
    show('endings');
  }

  function startAudio() { Sound.init(); }

  $('btn-new').onclick = () => { startAudio(); Sound.ambient('drone', 50, 0.03); newGame(); };
  $('btn-continue').onclick = () => { startAudio(); state = load(SAVE_KEY); go(state.scene); };
  $('btn-endings').onclick = showEndings;
  $('btn-back').onclick = menu;
  $('btn-menu').onclick = menu;
  $('btn-mute').onclick = () => { $('btn-mute').textContent = Sound.toggle() ? '🔇' : '🔊'; };
  $('btn-mute').textContent = Sound.muted ? '🔇' : '🔊';
  $('text').onclick = () => { if (typing) typing.skip(); };

  menu();
})();
