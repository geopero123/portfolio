(function () {
  'use strict';

  // ---- elements ----
  const $ = (s) => document.querySelector(s);
  const drop = $('#drop'), fileInput = $('#file');
  const grid = $('#grid'), gridWrap = $('#gridWrap');
  const formatSel = $('#format'), formatDesc = $('#formatDesc');
  const qualityRange = $('#qualityRange'), qualityVal = $('#qualityVal');
  const maxDimSel = $('#maxDim');
  const downloadAll = $('#downloadAll'), clearBtn = $('#clear');
  const savedTotal = $('#savedTotal'), summary = $('#summary');
  const toast = $('#toast'), toastMsg = $('#toastMsg');

  // ---- state ----
  // item: { id, file, bitmap, card, els, outBlob, outUrl, outW, outH, gen }
  let items = [];
  let uid = 0;
  let recompressTimer = null;

  const FORMAT_DESC = {
    webp: 'Modern format, ~30% smaller than JPEG.',
    jpeg: 'Works everywhere; no transparency.',
    png: 'Lossless — quality slider is ignored.'
  };
  const MIME = { webp: 'image/webp', jpeg: 'image/jpeg', png: 'image/png' };
  const EXT = { webp: '.webp', jpeg: '.jpg', png: '.png' };

  // ---- helpers ----
  function showToast(msg, isErr) {
    toastMsg.textContent = msg;
    toast.classList.toggle('err', !!isErr);
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  function baseName(name) {
    return name.replace(/\.[^.]+$/, '');
  }

  function settings() {
    return {
      format: formatSel.value,
      quality: Number(qualityRange.value) / 100,
      maxDim: Number(maxDimSel.value)
    };
  }

  function refreshTotals() {
    let before = 0, after = 0, ready = 0;
    for (const it of items) {
      if (!it.outBlob) continue;
      before += it.file.size;
      after += it.outBlob.size;
      ready++;
    }
    const saved = Math.max(0, before - after);
    savedTotal.textContent = fmtBytes(saved);
    summary.textContent = ready
      ? ready + ' image' + (ready > 1 ? 's' : '') + ' · ' + fmtBytes(before) + ' → ' + fmtBytes(after)
      : '';
    downloadAll.disabled = ready === 0;
    clearBtn.disabled = items.length === 0;
    gridWrap.hidden = items.length === 0;
  }

  function sliderFill() {
    const pct = (qualityRange.value - qualityRange.min) / (qualityRange.max - qualityRange.min) * 100;
    qualityRange.style.setProperty('--fill', pct + '%');
    qualityVal.textContent = qualityRange.value;
  }

  // ---- card ----
  function buildCard(it) {
    const card = document.createElement('div');
    card.className = 'card busy';
    card.innerHTML =
      '<div class="frame"><img alt=""><div class="working">PRESSING…</div></div>' +
      '<div class="body">' +
        '<div class="name"></div>' +
        '<div class="sizes"><span class="before"></span><span class="after">…</span><span class="pct"></span></div>' +
        '<div class="squeeze"><i></i></div>' +
        '<div class="meta"></div>' +
        '<div class="rowbtns">' +
          '<button class="mini save">Download</button>' +
          '<button class="mini del" title="Remove">✕</button>' +
        '</div>' +
      '</div>';
    card.querySelector('.name').textContent = it.file.name;
    card.querySelector('.name').title = it.file.name;
    card.querySelector('.before').textContent = fmtBytes(it.file.size);
    card.querySelector('.save').addEventListener('click', () => saveOne(it));
    card.querySelector('.del').addEventListener('click', () => removeOne(it));
    it.card = card;
    it.els = {
      img: card.querySelector('img'),
      after: card.querySelector('.after'),
      pct: card.querySelector('.pct'),
      bar: card.querySelector('.squeeze i'),
      meta: card.querySelector('.meta')
    };
    grid.appendChild(card);
  }

  function removeOne(it) {
    items = items.filter((x) => x !== it);
    if (it.outUrl) URL.revokeObjectURL(it.outUrl);
    if (it.bitmap && it.bitmap.close) it.bitmap.close();
    it.card.remove();
    refreshTotals();
  }

  // ---- compression ----
  async function decode(file) {
    if (window.createImageBitmap) {
      try { return await createImageBitmap(file); } catch (_) { /* fall through */ }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode failed')); };
      img.src = url;
    });
  }

  function encode(source, opts) {
    const srcW = source.width || source.naturalWidth;
    const srcH = source.height || source.naturalHeight;
    let w = srcW, h = srcH;
    if (opts.maxDim && Math.max(w, h) > opts.maxDim) {
      const k = opts.maxDim / Math.max(w, h);
      w = Math.max(1, Math.round(w * k));
      h = Math.max(1, Math.round(h * k));
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (opts.format === 'jpeg') {
      // JPEG has no alpha — composite on white instead of black
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, w, h);
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve({ blob, w, h }) : reject(new Error('encode failed')),
        MIME[opts.format],
        opts.format === 'png' ? undefined : opts.quality
      );
    });
  }

  async function compressOne(it) {
    const gen = ++it.gen;
    const opts = settings();
    it.card.classList.add('busy');
    try {
      if (!it.bitmap) it.bitmap = await decode(it.file);
      const { blob, w, h } = await encode(it.bitmap, opts);
      if (gen !== it.gen) return; // settings changed mid-flight; a newer run owns the card
      if (it.outUrl) URL.revokeObjectURL(it.outUrl);
      it.outBlob = blob;
      it.outUrl = URL.createObjectURL(blob);
      it.outW = w; it.outH = h;
      it.outExt = EXT[opts.format];
      it.els.img.src = it.outUrl;
      it.els.after.textContent = fmtBytes(blob.size);
      const pct = (1 - blob.size / it.file.size) * 100;
      it.els.pct.textContent = (pct >= 0 ? '−' : '+') + Math.abs(pct).toFixed(0) + '%';
      it.els.pct.classList.toggle('worse', pct < 0);
      it.els.bar.style.width = Math.min(Math.max(pct, 0), 100) + '%';
      const srcW = it.bitmap.width || it.bitmap.naturalWidth;
      const srcH = it.bitmap.height || it.bitmap.naturalHeight;
      it.els.meta.textContent = srcW + '×' + srcH + ' → ' + w + '×' + h + ' ' + opts.format.toUpperCase();
    } catch (err) {
      if (gen !== it.gen) return;
      it.els.after.textContent = 'failed';
      it.els.meta.textContent = 'Couldn’t process this file.';
    } finally {
      if (gen === it.gen) it.card.classList.remove('busy');
      refreshTotals();
    }
  }

  function recompressAll() {
    clearTimeout(recompressTimer);
    recompressTimer = setTimeout(() => {
      items.forEach(compressOne);
    }, 250);
  }

  // ---- add files ----
  function addFiles(fileList) {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (!files.length) {
      showToast('No image files in that drop.', true);
      return;
    }
    for (const file of files) {
      const it = { id: ++uid, file, bitmap: null, outBlob: null, outUrl: null, gen: 0 };
      items.push(it);
      buildCard(it);
      compressOne(it);
    }
    refreshTotals();
    showToast(files.length + ' image' + (files.length > 1 ? 's' : '') + ' added.');
  }

  // ---- downloads ----
  function saveOne(it) {
    if (!it.outBlob) return;
    const a = document.createElement('a');
    a.href = it.outUrl;
    a.download = baseName(it.file.name) + '-pressed' + it.outExt;
    a.click();
  }

  downloadAll.addEventListener('click', async () => {
    const ready = items.filter((it) => it.outBlob);
    for (const it of ready) {
      saveOne(it);
      // stagger so the browser doesn't swallow rapid consecutive downloads
      await new Promise((r) => setTimeout(r, 350));
    }
    showToast(ready.length + ' file' + (ready.length > 1 ? 's' : '') + ' downloaded.');
  });

  clearBtn.addEventListener('click', () => {
    for (const it of items) {
      if (it.outUrl) URL.revokeObjectURL(it.outUrl);
      if (it.bitmap && it.bitmap.close) it.bitmap.close();
    }
    items = [];
    grid.innerHTML = '';
    refreshTotals();
  });

  // ---- wiring ----
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', () => { addFiles(fileInput.files); fileInput.value = ''; });

  ['dragover', 'dragenter'].forEach((ev) => document.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === 'drop' || e.target === document.documentElement) drop.classList.remove('over');
  }));
  document.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });

  formatSel.addEventListener('change', () => {
    formatDesc.textContent = FORMAT_DESC[formatSel.value];
    qualityRange.disabled = formatSel.value === 'png';
    recompressAll();
  });
  qualityRange.addEventListener('input', () => { sliderFill(); recompressAll(); });
  maxDimSel.addEventListener('change', recompressAll);

  sliderFill();
})();
