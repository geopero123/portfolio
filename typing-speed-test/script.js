(function () {
  'use strict';

  // ---- elements ----
  const $ = (s) => document.querySelector(s);
  const modesBar = $('#modes');
  const bestWpmEl = $('#bestWpm');
  const live = $('#live'), liveTime = $('#liveTime'), liveWpm = $('#liveWpm'), liveAcc = $('#liveAcc');
  const stage = $('#stage'), stream = $('#stream'), ghost = $('#ghost');
  const restartBtn = $('#restart'), againBtn = $('#again');
  const results = $('#results'), resultNote = $('#resultNote');
  const rWpm = $('#rWpm'), rAcc = $('#rAcc'), rRaw = $('#rRaw'), rChars = $('#rChars'), rConsist = $('#rConsist');
  const chart = $('#chart'), pbNote = $('#pbNote');
  const toast = $('#toast'), toastMsg = $('#toastMsg');

  const WORDS = ('the of and to in is you that it he was for on are as with his they at be this have from ' +
    'or one had by word but not what all were we when your can said there use an each which she do how their ' +
    'if will up other about out many then them these so some her would make like him into time has look two ' +
    'more write go see number no way could people my than first water been call who oil its now find long down ' +
    'day did get come made may part over new sound take only little work know place year live me back give most ' +
    'very after thing our just name good sentence man think say great where help through much before line right ' +
    'too mean old any same tell boy follow came want show also around form three small set put end does another ' +
    'well large must big even such because turn here why ask went men read need land different home us move try ' +
    'kind hand picture again change off play spell air away animal house point page letter mother answer found ' +
    'study still learn should world high every near add food between own below country plant last school father ' +
    'keep tree never start city earth eye light thought head under story saw left dont few while along might ' +
    'close something seem next hard open example begin life always those both paper together got group often run').split(' ');

  const BEST_KEY = (secs) => 'wire-best-' + secs;

  // ---- state ----
  let duration = 30;
  let running = false;
  let finished = false;
  let startTime = 0;
  let timerId = null;
  let words = [];          // strings
  let wordEls = [];        // { el, chars[] }
  let wi = 0, ci = 0;      // word index, char index within word
  let correctChars = 0;    // net correct chars (incl. word-completing spaces)
  let typedKeys = 0, wrongKeys = 0;
  let samples = [];        // cumulative wpm at each elapsed second

  // ---- helpers ----
  function showToast(msg, isErr) {
    toastMsg.textContent = msg;
    toast.classList.toggle('err', !!isErr);
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function randomWord() {
    return WORDS[Math.floor(Math.random() * WORDS.length)];
  }

  function loadBest() {
    const v = localStorage.getItem(BEST_KEY(duration));
    bestWpmEl.textContent = v ? v : '—';
  }

  function saveBest(wpm) {
    const prev = Number(localStorage.getItem(BEST_KEY(duration)) || 0);
    if (wpm > prev) {
      localStorage.setItem(BEST_KEY(duration), String(wpm));
      loadBest();
      return true;
    }
    return false;
  }

  // ---- stream rendering ----
  function appendWords(n) {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < n; i++) {
      const w = randomWord();
      words.push(w);
      const el = document.createElement('span');
      el.className = 'word';
      const chars = [];
      for (const ch of w) {
        const c = document.createElement('span');
        c.className = 'c';
        c.textContent = ch;
        el.appendChild(c);
        chars.push(c);
      }
      frag.appendChild(el);
      wordEls.push({ el, chars });
    }
    stream.appendChild(frag);
  }

  let caretHolder = null; // empty span used when the caret sits past the last char
  function placeCaret() {
    const old = stream.querySelector('.caret');
    if (old) old.classList.remove('caret');
    if (caretHolder) { caretHolder.remove(); caretHolder = null; }

    const w = wordEls[wi];
    if (!w) return;
    // extras live after the base chars, so the live char list is re-read here
    const allChars = w.el.querySelectorAll('.c');
    if (ci < allChars.length) {
      allChars[ci].classList.add('caret');
    } else {
      caretHolder = document.createElement('span');
      caretHolder.className = 'c caret';
      w.el.appendChild(caretHolder);
    }
    // keep the active line in view inside the clipped stream
    const line = parseFloat(getComputedStyle(stream).lineHeight) || 40;
    const top = w.el.offsetTop - stream.offsetTop;
    if (top > line * 1.2) stream.scrollTop = top - line;
  }

  // ---- test lifecycle ----
  function reset() {
    clearInterval(timerId);
    running = false;
    finished = false;
    wi = 0; ci = 0;
    correctChars = 0; typedKeys = 0; wrongKeys = 0;
    samples = [];
    words = []; wordEls = [];
    caretHolder = null;
    stream.innerHTML = '';
    stream.scrollTop = 0;
    appendWords(80);
    placeCaret();
    results.hidden = true;
    pbNote.hidden = true;
    live.classList.remove('running');
    liveTime.textContent = duration;
    liveWpm.textContent = '0';
    liveAcc.textContent = '100%';
    stage.classList.add('idle');
    ghost.value = '';
    loadBest();
  }

  function begin() {
    running = true;
    stage.classList.remove('idle');
    startTime = performance.now();
    live.classList.add('running');
    timerId = setInterval(tick, 200);
  }

  function elapsedSecs() {
    return (performance.now() - startTime) / 1000;
  }

  function currentWpm() {
    const min = elapsedSecs() / 60;
    return min > 0 ? (correctChars / 5) / min : 0;
  }

  function accuracy() {
    return typedKeys ? Math.max(0, (typedKeys - wrongKeys) / typedKeys) * 100 : 100;
  }

  function tick() {
    const el = elapsedSecs();
    const left = Math.max(0, duration - el);
    liveTime.textContent = Math.ceil(left);
    liveWpm.textContent = Math.round(currentWpm());
    liveAcc.textContent = Math.round(accuracy()) + '%';
    const sec = Math.floor(el);
    if (sec >= 1 && samples.length < sec) samples.push(currentWpm());
    if (left <= 0) finish();
  }

  function finish() {
    clearInterval(timerId);
    running = false;
    finished = true;
    live.classList.remove('running');
    liveTime.textContent = '0';
    stage.classList.add('idle');
    ghost.blur();

    const wpm = Math.round(currentWpm());
    const raw = Math.round((typedKeys / 5) / (duration / 60)); // all keystrokes, right or wrong
    const acc = accuracy();
    const consist = consistency();

    rWpm.textContent = wpm;
    rAcc.textContent = Math.round(acc) + '%';
    rRaw.textContent = raw;
    rChars.textContent = (typedKeys - wrongKeys) + '/' + typedKeys;
    rConsist.textContent = Math.round(consist) + '%';
    resultNote.textContent = duration + 's test · ' + new Date().toLocaleTimeString();
    drawChart();
    pbNote.hidden = !saveBest(wpm);
    results.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function consistency() {
    if (samples.length < 2) return 100;
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    if (!mean) return 0;
    const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
    return Math.max(0, (1 - sd / mean) * 100);
  }

  // ---- chart ----
  function drawChart() {
    const W = 600, H = 140, PAD = 10;
    const pts = samples.length ? samples : [currentWpm()];
    const max = Math.max(...pts, 10) * 1.15;
    const x = (i) => PAD + (i / Math.max(pts.length - 1, 1)) * (W - PAD * 2);
    const y = (v) => H - PAD - (v / max) * (H - PAD * 2);
    let line = '';
    pts.forEach((v, i) => { line += (i ? ' L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); });
    const area = line + ' L' + x(pts.length - 1).toFixed(1) + ' ' + (H - PAD) + ' L' + x(0).toFixed(1) + ' ' + (H - PAD) + ' Z';
    const grid = [0.25, 0.5, 0.75].map((f) => {
      const gy = (PAD + f * (H - PAD * 2)).toFixed(1);
      return '<line x1="' + PAD + '" y1="' + gy + '" x2="' + (W - PAD) + '" y2="' + gy + '" stroke="var(--line-soft)" stroke-width="1"/>';
    }).join('');
    chart.innerHTML = grid +
      '<path d="' + area + '" fill="var(--accent-glow)"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
  }

  // ---- typing input ----
  function typeChar(ch) {
    const w = wordEls[wi];
    if (!w) return;
    typedKeys++;
    if (ci < w.chars.length) {
      const target = words[wi][ci];
      if (ch === target) {
        w.chars[ci].classList.add('ok');
        correctChars++;
      } else {
        w.chars[ci].classList.add('bad');
        wrongKeys++;
      }
      ci++;
    } else {
      // overflow beyond the word — render as extra chars
      const extras = w.el.querySelectorAll('.c.extra').length;
      if (extras < 10) {
        const c = document.createElement('span');
        c.className = 'c extra';
        c.textContent = ch;
        if (caretHolder) w.el.insertBefore(c, caretHolder); else w.el.appendChild(c);
        ci++;
      }
      wrongKeys++;
    }
    placeCaret();
  }

  function backspace() {
    const w = wordEls[wi];
    if (!w || ci === 0) return;
    ci--;
    if (ci >= w.chars.length) {
      const extras = w.el.querySelectorAll('.c.extra');
      const last = extras[extras.length - 1];
      if (last) last.remove();
    } else {
      const c = w.chars[ci];
      if (c.classList.contains('ok')) correctChars--;
      c.classList.remove('ok', 'bad');
    }
    placeCaret();
  }

  function commitWord() {
    const w = wordEls[wi];
    if (!w || ci === 0) return; // ignore space on an empty word
    typedKeys++;
    const clean = ci === w.chars.length && !w.el.querySelector('.c.bad, .c.extra');
    if (clean) correctChars++; // the space counts when the word is perfect
    else { w.el.classList.add('done-bad'); wrongKeys++; }
    wi++;
    ci = 0;
    if (wi > words.length - 30) appendWords(40);
    placeCaret();
  }

  ghost.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') return; // handled globally
    if (finished) { e.preventDefault(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (running) backspace();
      return;
    }
    if (e.key === ' ') {
      e.preventDefault();
      if (running) commitWord();
      return;
    }
    if (e.key.length === 1) {
      e.preventDefault();
      if (!running) begin();
      typeChar(e.key);
    }
  });
  ghost.addEventListener('input', () => { ghost.value = ''; }); // keep mobile keyboards from accumulating text

  // ---- focus / idle ----
  stage.addEventListener('click', () => ghost.focus());
  ghost.addEventListener('focus', () => { if (!finished) stage.classList.remove('idle'); });
  ghost.addEventListener('blur', () => stage.classList.add('idle'));

  // ---- modes / restart ----
  modesBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.mode');
    if (!btn) return;
    modesBar.querySelectorAll('.mode').forEach((b) => b.classList.toggle('active', b === btn));
    duration = Number(btn.dataset.secs);
    reset();
    ghost.focus();
  });

  function restart() {
    reset();
    ghost.focus();
    showToast('New ' + duration + 's test — start typing.');
  }
  restartBtn.addEventListener('click', restart);
  againBtn.addEventListener('click', restart);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') { e.preventDefault(); restart(); }
  });

  reset();
})();
