(function () {
  'use strict';

  // ---- elements ----
  const $ = (s) => document.querySelector(s);
  const drop = $('#drop'), fileInput = $('#file');
  const studio = $('#studio'), video = $('#video'), slideCanvas = $('#slideCanvas');
  const playBtn = $('#playBtn'), playIcon = $('#playIcon'), ejectBtn = $('#ejectBtn');
  const tcNow = $('#tcNow'), tcTotal = $('#tcTotal'), videoName = $('#videoName');
  const timeline = $('#timeline'), film = $('#film'), timelineNote = $('#timelineNote');
  const shadeL = $('#shadeL'), shadeR = $('#shadeR'), range = $('#range');
  const handleIn = $('#handleIn'), handleOut = $('#handleOut');
  const flagIn = $('#flagIn'), flagOut = $('#flagOut');
  const playhead = $('#playhead');
  const slides = $('#slides');
  const overlay = $('#overlay'), cropbox = $('#cropbox');
  const addCaptionBtn = $('#addCaption'), cropToggle = $('#cropToggle');
  const widthSel = $('#width'), fpsSel = $('#fps'), qualitySel = $('#quality'), speedSel = $('#speed');
  const secPerSel = $('#secPer'), loopSel = $('#loopStyle');
  const presetSel = $('#preset'), presetDesc = $('#presetDesc');
  const fname = $('#fname'), fnamePreview = $('#fnamePreview');
  const frameDesc = $('#frameDesc'), estimate = $('#estimate');
  const renderBtn = $('#render'), cancelBtn = $('#cancel'), againBtn = $('#again');
  const progress = $('#progress'), bar = $('#bar'), progText = $('#progText'), progPct = $('#progPct');
  const result = $('#result'), resultImg = $('#resultImg'), resultMeta = $('#resultMeta');
  const download = $('#download'), clipLenEl = $('#clipLen');
  const exportVideoBtn = $('#exportVideo');
  const miniPreview = $('#miniPreview'), miniImg = $('#miniImg');
  const toast = $('#toast'), toastMsg = $('#toastMsg');

  // ---- state ----
  let mode = null;                // 'video' | 'images'
  let duration = 0;
  let tIn = 0, tOut = 0;          // video selection in seconds
  const MIN_CLIP = 0.2, MAX_CLIP = 30;
  let images = [];                // { file, bitmap, url }
  let slideIdx = 0, slideTimer = null, slidePlaying = false;
  let previewing = false;
  let rendering = false, exporting = false;
  let cancelled = false;
  let objectUrl = null;
  let resultUrl = null;
  let workerBlobUrl = null;
  let lastRender = null;          // { frames: ImageData[], delay, outW, outH } for video export
  let captions = [];              // { id, text, x, y, size, el } — x/y/size are fractions of the frame
  let capUid = 0;
  let crop = null;                // { x, y, w, h } as fractions of the frame, or null
  let contentW = 0, contentH = 0; // displayed picture area inside the letterboxed element
  const MIN_CROP = 0.08;

  const PRESETS = {
    custom:  { cap: Infinity },
    post:    { cap: 10 * 1024 * 1024 * 0.97 },
    emote:   { cap: 256 * 1024 * 0.97, square: 128 },
    sticker: { cap: 512 * 1024 * 0.97, square: 320 }
  };
  const PRESET_DESC = {
    custom: 'Renders exactly what you set above.',
    post: 'Auto-shrinks until it fits Discord’s 10 MB upload cap.',
    emote: 'Square-cropped, 128 px, auto-shrunk under the 256 KB emote cap.',
    sticker: 'Square-cropped, 320 px, auto-shrunk under the 512 KB sticker cap.'
  };

  // gif.js loads its encoder in a Web Worker; the CDN script can't be used
  // cross-origin as a worker, so it is fetched once and served from a blob URL.
  const WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js';
  function getWorkerUrl() {
    if (workerBlobUrl) return Promise.resolve(workerBlobUrl);
    return fetch(WORKER_SRC)
      .then((r) => { if (!r.ok) throw new Error('worker fetch failed'); return r.blob(); })
      .then((b) => (workerBlobUrl = URL.createObjectURL(b)));
  }

  // ---- helpers ----
  function showToast(msg, isErr) {
    toastMsg.textContent = msg;
    toast.classList.toggle('err', !!isErr);
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 3200);
  }

  function fmt(t) {
    const m = Math.floor(t / 60);
    const s = (t - m * 60).toFixed(1).padStart(4, '0');
    return m + ':' + s;
  }

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  }

  function clipSeconds() { return Math.max(0, tOut - tIn); }
  function speed() { return Number(speedSel.value); }
  function secPer() { return Number(secPerSel.value); }

  function frameW() { return mode === 'images' ? (images[0] ? images[0].bitmap.width : 0) : video.videoWidth; }
  function frameH() { return mode === 'images' ? (images[0] ? images[0].bitmap.height : 0) : video.videoHeight; }
  function mediaEl() { return mode === 'images' ? slideCanvas : video; }
  function loaded() { return mode === 'images' ? images.length > 0 : duration > 0; }

  function baseFrameCount() {
    if (mode === 'images') return images.length;
    return Math.max(1, Math.round(clipSeconds() / speed() * Number(fpsSel.value)));
  }
  function effFrameCount() {
    const n = baseFrameCount();
    return loopSel.value === 'boomerang' ? Math.max(1, n * 2 - 2) : n;
  }

  function refreshReadouts() {
    if (!loaded()) { estimate.textContent = ''; return; }
    const fw = frameW(), fh = frameH();
    if (mode === 'images') {
      clipLenEl.textContent = (images.length * secPer()).toFixed(1) + 's';
    } else {
      clipLenEl.textContent = clipSeconds().toFixed(1) + 's';
      flagIn.textContent = fmt(tIn);
      flagOut.textContent = fmt(tOut);
      frameDesc.textContent = '~' + baseFrameCount() + ' frames to capture.';
    }
    const preset = PRESETS[presetSel.value];
    let w, h;
    if (preset.square) {
      w = h = preset.square;
    } else {
      w = Number(widthSel.value);
      const asp = crop ? (crop.h * fh) / (crop.w * fw) : fh / fw;
      h = Math.round(w * asp);
    }
    const bits = [w + '×' + h, effFrameCount() + ' frames'];
    if (mode === 'video') {
      bits[1] += ' @ ' + fpsSel.value + ' fps';
      if (speed() !== 1) bits.push(speed() + '×');
    }
    if (loopSel.value !== 'normal') bits.push(loopSel.value);
    if (crop) bits.push('cropped');
    if (captions.some((c) => c.text.trim())) bits.push(captions.length + ' caption' + (captions.length > 1 ? 's' : ''));
    estimate.textContent = bits.join(' · ');
  }

  function layoutTimeline() {
    if (mode !== 'video') return;
    const W = timeline.clientWidth;
    if (!duration || !W) return;
    const xIn = (tIn / duration) * W;
    const xOut = (tOut / duration) * W;
    handleIn.style.left = (xIn - 14) < 0 ? '0px' : (xIn - 14) + 'px';
    handleOut.style.left = Math.min(xOut, W - 14) + 'px';
    range.style.left = xIn + 'px';
    range.style.width = (xOut - xIn) + 'px';
    shadeL.style.width = xIn + 'px';
    shadeR.style.width = (W - xOut) + 'px';
    const t = video.currentTime || 0;
    playhead.style.left = Math.min((t / duration) * W, W - 2) + 'px';
    refreshReadouts();
  }

  // ---- overlay (captions + crop) ----
  // the media letterboxes with object-fit:contain; the overlay is pinned to
  // the actual picture area so fractional coordinates map 1:1 onto the frame
  function layoutOverlay() {
    if (!loaded() || studio.hidden) return;
    const el = mediaEl();
    const ew = el.clientWidth, eh = el.clientHeight;
    if (!ew || !frameW()) return;
    const va = frameW() / frameH();
    let cw = ew, chh = ew / va;
    if (chh > eh + 0.5) { chh = eh; cw = eh * va; }
    contentW = cw; contentH = chh;
    overlay.style.left = (ew - cw) / 2 + 'px';
    overlay.style.top = (eh - chh) / 2 + 'px';
    overlay.style.width = cw + 'px';
    overlay.style.height = chh + 'px';
    renderCaptions();
    layoutCrop();
  }
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(layoutOverlay);
    ro.observe(video);
    ro.observe(slideCanvas);
  }

  function renderCaptions() {
    for (const cap of captions) {
      cap.el.style.left = cap.x * 100 + '%';
      cap.el.style.top = cap.y * 100 + '%';
      cap.el.querySelector('.cap-text').style.fontSize = Math.max(10, cap.size * contentH) + 'px';
    }
  }

  function buildCaptionEl(cap) {
    const el = document.createElement('div');
    el.className = 'caption';
    el.innerHTML =
      '<div class="cap-tools">' +
        '<button class="cap-btn grip" title="Drag to move">✥</button>' +
        '<button class="cap-btn" data-a="smaller" title="Smaller text">A−</button>' +
        '<button class="cap-btn" data-a="bigger" title="Bigger text">A+</button>' +
        '<button class="cap-btn del" data-a="del" title="Remove caption">✕</button>' +
      '</div>' +
      '<div class="cap-text" contenteditable="true" spellcheck="false"></div>';
    const txt = el.querySelector('.cap-text');
    txt.textContent = cap.text;
    txt.addEventListener('input', () => { cap.text = txt.innerText; refreshReadouts(); });
    txt.addEventListener('keydown', (e) => e.stopPropagation()); // typing must not trigger the space-preview shortcut
    el.querySelector('.cap-tools').addEventListener('click', (e) => {
      const btn = e.target.closest('.cap-btn');
      const a = btn && btn.dataset.a;
      if (a === 'del') { captions = captions.filter((c) => c !== cap); el.remove(); refreshReadouts(); return; }
      if (a === 'smaller') cap.size = Math.max(0.04, cap.size / 1.18);
      if (a === 'bigger') cap.size = Math.min(0.3, cap.size * 1.18);
      renderCaptions();
    });
    const grip = el.querySelector('.cap-btn.grip');
    grip.addEventListener('pointerdown', (e) => {
      grip.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, ox = cap.x, oy = cap.y;
      const move = (ev) => {
        cap.x = Math.min(Math.max(ox + (ev.clientX - sx) / contentW, 0), 1);
        cap.y = Math.min(Math.max(oy + (ev.clientY - sy) / contentH, 0), 1);
        renderCaptions();
      };
      const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
      e.preventDefault();
    });
    overlay.appendChild(el);
    cap.el = el;
  }

  addCaptionBtn.addEventListener('click', () => {
    if (!loaded()) return;
    const cap = { id: ++capUid, text: 'Your caption', x: 0.5, y: 0.12, size: 0.09, el: null };
    captions.push(cap);
    buildCaptionEl(cap);
    renderCaptions();
    refreshReadouts();
    const txt = cap.el.querySelector('.cap-text');
    txt.focus();
    const sel = window.getSelection();
    const rng = document.createRange();
    rng.selectNodeContents(txt);
    sel.removeAllRanges();
    sel.addRange(rng);
  });

  function drawCaptions(ctx, cs, scale) {
    for (const cap of captions) {
      const text = cap.text.trim();
      if (!text) continue;
      const px = cap.size * frameH() * scale;
      const cx = (cap.x * frameW() - cs.x) * scale;
      const lines = text.toUpperCase().split('\n');
      const lh = px * 1.05;
      const y0 = (cap.y * frameH() - cs.y) * scale - (lines.length - 1) * lh / 2;
      ctx.font = '400 ' + px + 'px Anton, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(2, px * 0.11);
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#fff';
      lines.forEach((ln, i) => {
        ctx.strokeText(ln, cx, y0 + i * lh);
        ctx.fillText(ln, cx, y0 + i * lh);
      });
    }
  }

  // ---- crop ----
  function layoutCrop() {
    if (!crop) return;
    cropbox.style.left = crop.x * 100 + '%';
    cropbox.style.top = crop.y * 100 + '%';
    cropbox.style.width = crop.w * 100 + '%';
    cropbox.style.height = crop.h * 100 + '%';
  }

  cropToggle.addEventListener('click', () => {
    if (!loaded()) return;
    if (crop) {
      crop = null;
      cropbox.hidden = true;
      cropToggle.classList.remove('active');
      showToast('Crop removed — full frame.');
    } else {
      crop = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 };
      cropbox.hidden = false;
      cropToggle.classList.add('active');
      layoutCrop();
      showToast('Drag the box to frame your crop.');
    }
    refreshReadouts();
  });

  cropbox.addEventListener('pointerdown', (e) => {
    if (!crop) return;
    const corner = e.target.dataset.c || null;
    cropbox.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY;
    const o = { x: crop.x, y: crop.y, w: crop.w, h: crop.h };
    const move = (ev) => {
      const dx = (ev.clientX - sx) / contentW;
      const dy = (ev.clientY - sy) / contentH;
      if (!corner) {
        crop.x = Math.min(Math.max(o.x + dx, 0), 1 - o.w);
        crop.y = Math.min(Math.max(o.y + dy, 0), 1 - o.h);
      } else {
        let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
        if (corner.includes('l')) x1 = Math.min(Math.max(o.x + dx, 0), x2 - MIN_CROP);
        if (corner.includes('r')) x2 = Math.max(Math.min(o.x + o.w + dx, 1), x1 + MIN_CROP);
        if (corner.includes('t')) y1 = Math.min(Math.max(o.y + dy, 0), y2 - MIN_CROP);
        if (corner.includes('b')) y2 = Math.max(Math.min(o.y + o.h + dy, 1), y1 + MIN_CROP);
        crop.x = x1; crop.y = y1; crop.w = x2 - x1; crop.h = y2 - y1;
      }
      layoutCrop();
      refreshReadouts();
    };
    const up = () => { cropbox.removeEventListener('pointermove', move); cropbox.removeEventListener('pointerup', up); };
    cropbox.addEventListener('pointermove', move);
    cropbox.addEventListener('pointerup', up);
    e.preventDefault();
  });

  function clearOverlays() {
    for (const cap of captions) cap.el.remove();
    captions = [];
    crop = null;
    cropbox.hidden = true;
    cropToggle.classList.remove('active');
  }

  // ---- filmstrip thumbnails (video mode) ----
  async function buildFilmstrip() {
    film.innerHTML = '';
    const COUNT = 12;
    const thumbH = 64;
    const aspect = video.videoWidth / video.videoHeight || 16 / 9;
    const canvases = [];
    for (let i = 0; i < COUNT; i++) {
      const c = document.createElement('canvas');
      c.width = Math.round(thumbH * aspect);
      c.height = thumbH;
      film.appendChild(c);
      canvases.push(c);
    }
    const keep = video.currentTime;
    for (let i = 0; i < COUNT; i++) {
      const t = ((i + 0.5) / COUNT) * duration;
      try {
        await seekTo(t);
        const c = canvases[i];
        c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
      } catch (_) { /* skip a bad frame, keep going */ }
    }
    await seekTo(keep);
  }

  function seekTo(t) {
    return new Promise((resolve, reject) => {
      const onSeek = () => { cleanup(); resolve(); };
      const onErr = () => { cleanup(); reject(new Error('seek failed')); };
      const cleanup = () => {
        video.removeEventListener('seeked', onSeek);
        video.removeEventListener('error', onErr);
        clearTimeout(timer);
      };
      const timer = setTimeout(onErr, 5000);
      video.addEventListener('seeked', onSeek);
      video.addEventListener('error', onErr);
      video.currentTime = Math.min(Math.max(t, 0), Math.max(duration - 0.001, 0));
    });
  }

  // ---- mode switching ----
  function setMode(m) {
    mode = m;
    const isVid = m === 'video';
    video.hidden = !isVid;
    slideCanvas.hidden = isVid;
    timeline.hidden = !isVid;
    timelineNote.hidden = !isVid;
    slides.hidden = isVid;
    document.querySelectorAll('.field.video-only').forEach((f) => { f.hidden = !isVid; });
    document.querySelectorAll('.field.image-only').forEach((f) => { f.hidden = isVid; });
    drop.classList.add('loaded');
    studio.hidden = false;
  }

  function ejectAll() {
    stopPreview();
    stopSlides();
    video.removeAttribute('src');
    video.load();
    if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null; }
    duration = 0;
    for (const im of images) {
      URL.revokeObjectURL(im.url);
      if (im.bitmap && im.bitmap.close) im.bitmap.close();
    }
    images = [];
    slides.innerHTML = '';
    lastRender = null;
    mode = null;
    studio.hidden = true;
    drop.classList.remove('loaded');
    clearOverlays();
    resetResult();
  }
  ejectBtn.addEventListener('click', ejectAll);

  // ---- video loading ----
  function loadVideo(file) {
    ejectAll();
    resetResult();
    objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    videoName.textContent = file.name;
    const base = file.name.replace(/\.[^.]+$/, '').replace(/[^\w\- ]+/g, '').trim();
    if (base) { fname.value = base; syncFname(); }

    video.addEventListener('loadedmetadata', async function once() {
      video.removeEventListener('loadedmetadata', once);
      duration = video.duration;
      if (!isFinite(duration) || duration <= 0) {
        showToast('Couldn’t read this video’s length.', true);
        return;
      }
      tIn = 0;
      tOut = Math.min(duration, 4);
      setMode('video');
      tcTotal.textContent = fmt(duration);
      video.playbackRate = speed();
      layoutTimeline();
      layoutOverlay();
      await buildFilmstrip();
      layoutTimeline();
      layoutOverlay();
      showToast('Loaded — mark your in and out points.');
    });
    video.addEventListener('error', function once() {
      video.removeEventListener('error', once);
      showToast('This browser can’t decode that video format.', true);
    });
  }

  // ---- image loading (slideshow mode) ----
  async function decodeImage(file) {
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

  async function addImages(files) {
    if (mode !== 'images') {
      ejectAll();
      resetResult();
    }
    let added = 0;
    for (const file of files) {
      try {
        const bitmap = await decodeImage(file);
        images.push({ file, bitmap, url: URL.createObjectURL(file) });
        added++;
      } catch (_) { /* skip undecodable files */ }
    }
    if (!images.length) {
      showToast('Couldn’t read any of those images.', true);
      return;
    }
    if (mode !== 'images') {
      setMode('images');
      fname.value = 'slideshow';
      syncFname();
    }
    videoName.textContent = images.length + ' image' + (images.length > 1 ? 's' : '');
    renderSlides();
    slideIdx = Math.min(slideIdx, images.length - 1);
    drawSlide(slideIdx);
    layoutOverlay();
    refreshReadouts();
    if (added) showToast(added + ' image' + (added > 1 ? 's' : '') + ' added — frames play in order.');
  }

  function drawCover(ctx, bmp, fw, fh) {
    const bw = bmp.width || bmp.naturalWidth;
    const bh = bmp.height || bmp.naturalHeight;
    const s = Math.max(fw / bw, fh / bh);
    const dw = bw * s, dh = bh * s;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, fw, fh);
    ctx.drawImage(bmp, (fw - dw) / 2, (fh - dh) / 2, dw, dh);
  }

  function drawSlide(i) {
    if (!images.length) return;
    slideIdx = ((i % images.length) + images.length) % images.length;
    const ctx = slideCanvas.getContext('2d');
    drawCover(ctx, images[slideIdx].bitmap, slideCanvas.width, slideCanvas.height);
    tcNow.textContent = String(slideIdx + 1);
    tcTotal.textContent = images.length + ' imgs';
  }

  function startSlides() {
    if (!images.length) return;
    slidePlaying = true;
    playIcon.innerHTML = '<rect x="5" y="4" width="5" height="16"/><rect x="14" y="4" width="5" height="16"/>';
    clearInterval(slideTimer);
    slideTimer = setInterval(() => drawSlide(slideIdx + 1), secPer() * 1000);
  }
  function stopSlides() {
    slidePlaying = false;
    clearInterval(slideTimer);
    slideTimer = null;
    playIcon.innerHTML = '<polygon points="6 3 20 12 6 21 6 3"/>';
  }

  function renderSlides() {
    // the first image defines the frame — keep the preview canvas matched to it
    const fw = frameW(), fh = frameH();
    if (fw) {
      const k = Math.min(1, 1280 / fw);
      slideCanvas.width = Math.round(fw * k);
      slideCanvas.height = Math.round(fh * k);
    }
    slides.innerHTML = '';
    images.forEach((im, i) => {
      const d = document.createElement('div');
      d.className = 'slide';
      d.innerHTML =
        '<img alt=""><span class="slide-num">' + (i + 1) + '</span>' +
        '<div class="slide-tools">' +
          '<button class="sleft" title="Move earlier"' + (i === 0 ? ' disabled' : '') + '>◀</button>' +
          '<button class="sright" title="Move later"' + (i === images.length - 1 ? ' disabled' : '') + '>▶</button>' +
          '<button class="sdel" title="Remove">✕</button>' +
        '</div>';
      d.querySelector('img').src = im.url;
      d.querySelector('img').addEventListener('click', () => { stopSlides(); drawSlide(i); });
      d.querySelector('.sleft').addEventListener('click', () => swapImages(i, i - 1));
      d.querySelector('.sright').addEventListener('click', () => swapImages(i, i + 1));
      d.querySelector('.sdel').addEventListener('click', () => removeImage(i));
      slides.appendChild(d);
    });
  }

  function swapImages(a, b) {
    if (b < 0 || b >= images.length) return;
    [images[a], images[b]] = [images[b], images[a]];
    renderSlides();
    drawSlide(slideIdx);
    refreshReadouts();
  }

  function removeImage(i) {
    const [im] = images.splice(i, 1);
    URL.revokeObjectURL(im.url);
    if (im.bitmap && im.bitmap.close) im.bitmap.close();
    if (!images.length) { ejectAll(); return; }
    renderSlides();
    drawSlide(Math.min(slideIdx, images.length - 1));
    videoName.textContent = images.length + ' image' + (images.length > 1 ? 's' : '');
    refreshReadouts();
  }

  // ---- file intake ----
  function addInput(fileList) {
    const files = Array.from(fileList);
    const vid = files.find((f) => f.type.startsWith('video/') || /\.(mp4|webm|mov|m4v|ogv)$/i.test(f.name));
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (vid) loadVideo(vid);
    else if (imgs.length) addImages(imgs);
    else showToast('Drop a video or some images.', true);
  }

  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', () => { addInput(fileInput.files); fileInput.value = ''; });

  ['dragover', 'dragenter'].forEach((ev) => document.addEventListener(ev, (e) => {
    e.preventDefault();
    drop.classList.add('over');
  }));
  ['dragleave', 'drop'].forEach((ev) => document.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === 'drop' || e.target === document.documentElement) drop.classList.remove('over');
  }));
  document.addEventListener('drop', (e) => {
    if (e.dataTransfer && e.dataTransfer.files.length) addInput(e.dataTransfer.files);
  });

  // ---- timeline dragging (video mode) ----
  let dragMode = null; // 'in' | 'out' | 'window'
  let dragStartX = 0, dragStartIn = 0, dragStartOut = 0;

  function posToTime(clientX) {
    const r = timeline.getBoundingClientRect();
    return Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * duration;
  }

  function startDrag(m, e) {
    dragMode = m;
    dragStartX = e.clientX;
    dragStartIn = tIn;
    dragStartOut = tOut;
    stopPreview();
    e.preventDefault();
  }

  handleIn.addEventListener('pointerdown', (e) => { handleIn.setPointerCapture(e.pointerId); startDrag('in', e); });
  handleOut.addEventListener('pointerdown', (e) => { handleOut.setPointerCapture(e.pointerId); startDrag('out', e); });
  range.addEventListener('pointerdown', (e) => { range.setPointerCapture(e.pointerId); startDrag('window', e); });

  document.addEventListener('pointermove', (e) => {
    if (!dragMode || !duration) return;
    if (dragMode === 'in') {
      tIn = Math.min(posToTime(e.clientX), tOut - MIN_CLIP);
      tIn = Math.max(tIn, tOut - MAX_CLIP, 0);
      seekQuiet(tIn);
    } else if (dragMode === 'out') {
      tOut = Math.max(posToTime(e.clientX), tIn + MIN_CLIP);
      tOut = Math.min(tOut, tIn + MAX_CLIP, duration);
      seekQuiet(tOut);
    } else {
      const dt = ((e.clientX - dragStartX) / timeline.clientWidth) * duration;
      const len = dragStartOut - dragStartIn;
      tIn = Math.min(Math.max(dragStartIn + dt, 0), duration - len);
      tOut = tIn + len;
      seekQuiet(tIn);
    }
    layoutTimeline();
  });
  document.addEventListener('pointerup', () => { dragMode = null; });

  let seekQuietPending = false;
  function seekQuiet(t) {
    if (seekQuietPending) return;
    seekQuietPending = true;
    requestAnimationFrame(() => {
      seekQuietPending = false;
      try { video.currentTime = t; } catch (_) {}
    });
  }

  function nudge(which, dir, big) {
    const step = (big ? 1 : 0.1) * dir;
    if (which === 'in') tIn = Math.min(Math.max(tIn + step, 0), tOut - MIN_CLIP);
    else tOut = Math.max(Math.min(tOut + step, duration, tIn + MAX_CLIP), tIn + MIN_CLIP);
    layoutTimeline();
  }
  handleIn.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { nudge('in', -1, e.shiftKey); e.preventDefault(); }
    if (e.key === 'ArrowRight') { nudge('in', 1, e.shiftKey); e.preventDefault(); }
  });
  handleOut.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { nudge('out', -1, e.shiftKey); e.preventDefault(); }
    if (e.key === 'ArrowRight') { nudge('out', 1, e.shiftKey); e.preventDefault(); }
  });

  // ---- preview ----
  function startPreview() {
    if (mode === 'images') { startSlides(); return; }
    if (!duration) return;
    previewing = true;
    playIcon.innerHTML = '<rect x="5" y="4" width="5" height="16"/><rect x="14" y="4" width="5" height="16"/>';
    video.currentTime = tIn;
    video.play().catch(() => { previewing = false; });
  }
  function stopPreview() {
    if (mode === 'images') { stopSlides(); return; }
    previewing = false;
    playIcon.innerHTML = '<polygon points="6 3 20 12 6 21 6 3"/>';
    video.pause();
  }
  function previewActive() { return mode === 'images' ? slidePlaying : previewing; }
  playBtn.addEventListener('click', () => (previewActive() ? stopPreview() : startPreview()));
  document.addEventListener('keydown', (e) => {
    const ae = document.activeElement;
    if (e.key === ' ' && !studio.hidden && !/INPUT|SELECT|TEXTAREA/.test(ae.tagName) && !ae.isContentEditable) {
      e.preventDefault();
      previewActive() ? stopPreview() : startPreview();
    }
  });
  video.addEventListener('timeupdate', () => {
    if (mode !== 'video') return;
    tcNow.textContent = fmt(video.currentTime);
    if (previewing && video.currentTime >= tOut) video.currentTime = tIn;
    layoutTimeline();
  });

  // ---- settings wiring ----
  function syncFname() {
    const clean = (fname.value.trim() || 'clip').replace(/[\\/:*?"<>|]/g, '');
    fnamePreview.textContent = clean + '.gif';
    return clean;
  }
  fname.addEventListener('input', syncFname);
  [widthSel, fpsSel, loopSel].forEach((el) => el.addEventListener('change', refreshReadouts));
  speedSel.addEventListener('change', () => {
    video.playbackRate = speed();
    refreshReadouts();
  });
  secPerSel.addEventListener('change', () => {
    if (slidePlaying) startSlides(); // restart the ticker at the new pace
    refreshReadouts();
  });
  presetSel.addEventListener('change', () => {
    presetDesc.textContent = PRESET_DESC[presetSel.value];
    refreshReadouts();
  });

  // ---- render pipeline ----
  function setProgress(pct, label) {
    bar.style.width = pct + '%';
    progPct.textContent = Math.round(pct) + '%';
    if (label) progText.textContent = label;
  }

  function resetResult() {
    result.hidden = true;
    miniPreview.hidden = true;
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
  }

  // shrink schedule for auto-fit presets: each attempt trades quality for bytes
  function makePlan(attempt) {
    const preset = PRESETS[presetSel.value];
    const fw = frameW(), fh = frameH();
    const stages = [
      { q: Number(qualitySel.value), fps: Number(fpsSel.value), k: 1 },
      { q: Math.max(Number(qualitySel.value), 16), fps: Math.min(Number(fpsSel.value), 12), k: 1 },
      { q: 20, fps: 10, k: 0.85 },
      { q: 24, fps: 8, k: 0.7 },
      { q: 30, fps: 6, k: 0.55 }
    ];
    const s = stages[Math.min(attempt, stages.length - 1)];
    let cs = crop
      ? { x: crop.x * fw, y: crop.y * fh, w: crop.w * fw, h: crop.h * fh }
      : { x: 0, y: 0, w: fw, h: fh };
    let outW, outH;
    if (preset.square) {
      // shrink the crop region to a centered square, output a square GIF
      const side = Math.min(cs.w, cs.h);
      cs = { x: cs.x + (cs.w - side) / 2, y: cs.y + (cs.h - side) / 2, w: side, h: side };
      outW = outH = Math.max(32, Math.round(preset.square * s.k / 2) * 2);
    } else {
      outW = Math.max(48, Math.round(Number(widthSel.value) * s.k / 2) * 2);
      outH = Math.max(2, Math.round(outW * cs.h / cs.w / 2) * 2);
    }
    return { outW, outH, fps: s.fps, q: s.q, cs };
  }

  async function captureFrames(plan) {
    const frames = [];
    const canvas = document.createElement('canvas');
    canvas.width = plan.outW;
    canvas.height = plan.outH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (mode === 'video') {
      const spd = speed();
      const n = Math.max(1, Math.round(clipSeconds() / spd * plan.fps));
      for (let i = 0; i < n; i++) {
        if (cancelled) throw new Error('cancelled');
        await seekTo(tIn + (i * spd) / plan.fps);
        ctx.drawImage(video, plan.cs.x, plan.cs.y, plan.cs.w, plan.cs.h, 0, 0, plan.outW, plan.outH);
        drawCaptions(ctx, plan.cs, plan.outW / plan.cs.w);
        frames.push(ctx.getImageData(0, 0, plan.outW, plan.outH));
        setProgress((i + 1) / n * 55, 'Capturing frame ' + (i + 1) + ' / ' + n);
      }
      return { frames, delay: Math.round(1000 / plan.fps) };
    }
    // image mode — every image becomes one frame, composed "cover" onto the first image's aspect
    const fw = frameW(), fh = frameH();
    const full = document.createElement('canvas');
    full.width = fw; full.height = fh;
    const fctx = full.getContext('2d');
    for (let i = 0; i < images.length; i++) {
      if (cancelled) throw new Error('cancelled');
      drawCover(fctx, images[i].bitmap, fw, fh);
      ctx.drawImage(full, plan.cs.x, plan.cs.y, plan.cs.w, plan.cs.h, 0, 0, plan.outW, plan.outH);
      drawCaptions(ctx, plan.cs, plan.outW / plan.cs.w);
      frames.push(ctx.getImageData(0, 0, plan.outW, plan.outH));
      setProgress((i + 1) / images.length * 55, 'Composing image ' + (i + 1) + ' / ' + images.length);
    }
    return { frames, delay: Math.round(secPer() * 1000) };
  }

  function orderFrames(frames) {
    if (loopSel.value === 'reverse') return frames.slice().reverse();
    if (loopSel.value === 'boomerang' && frames.length > 2) {
      return frames.concat(frames.slice(1, -1).reverse());
    }
    return frames;
  }

  function encodeGif(frames, delay, w, h, q, workerUrl) {
    return new Promise((resolve, reject) => {
      const gif = new GIF({ workers: 2, workerScript: workerUrl, quality: q, width: w, height: h });
      for (const f of frames) gif.addFrame(f, { delay });
      gif.on('progress', (p) => {
        if (cancelled) { gif.abort(); reject(new Error('cancelled')); return; }
        setProgress(55 + p * 45, 'Encoding GIF…');
      });
      gif.on('finished', resolve);
      gif.render();
    });
  }

  renderBtn.addEventListener('click', async () => {
    if (rendering || !loaded()) return;
    rendering = true;
    cancelled = false;
    stopPreview();
    resetResult();
    renderBtn.disabled = true;
    cancelBtn.hidden = false;
    progress.classList.add('show');
    setProgress(0, 'Preparing…');

    try {
      const workerUrl = await getWorkerUrl();
      const preset = PRESETS[presetSel.value];
      if (captions.some((c) => c.text.trim())) {
        try { await document.fonts.load('80px Anton'); } catch (_) { /* Impact fallback */ }
      }

      let attempt = 0, blob, plan, ordered, delay;
      for (;;) {
        plan = makePlan(attempt);
        if (attempt > 0) setProgress(0, 'Attempt ' + (attempt + 1) + ' — shrinking to fit…');
        const cap = await captureFrames(plan);
        ordered = orderFrames(cap.frames);
        delay = cap.delay;
        blob = await encodeGif(ordered, delay, plan.outW, plan.outH, plan.q, workerUrl);
        if (blob.size <= preset.cap || attempt >= 4) break;
        attempt++;
      }

      lastRender = { frames: ordered, delay, outW: plan.outW, outH: plan.outH };
      resultUrl = URL.createObjectURL(blob);
      resultImg.src = resultUrl;
      download.href = resultUrl;
      download.download = syncFname() + '.gif';
      resultMeta.textContent = plan.outW + '×' + plan.outH + ' · ' + ordered.length + ' frames · ' + fmtBytes(blob.size);
      miniPreview.hidden = presetSel.value !== 'emote';
      if (presetSel.value === 'emote') miniImg.src = resultUrl;
      result.hidden = false;
      setProgress(100, 'Done');
      if (blob.size > preset.cap) {
        showToast('Best effort: ' + fmtBytes(blob.size) + ' — still over the cap. Try a shorter clip.', true);
      } else if (attempt > 0) {
        showToast('Fit under the cap on attempt ' + (attempt + 1) + ' — ' + fmtBytes(blob.size));
      } else {
        showToast('GIF rendered — ' + fmtBytes(blob.size));
      }
      result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      if (err.message === 'cancelled') showToast('Render cancelled.');
      else showToast('Render failed: ' + err.message, true);
    } finally {
      rendering = false;
      renderBtn.disabled = false;
      cancelBtn.hidden = true;
      setTimeout(() => progress.classList.remove('show'), 800);
    }
  });

  cancelBtn.addEventListener('click', () => { cancelled = true; });
  againBtn.addEventListener('click', () => {
    result.hidden = true;
    studio.scrollIntoView({ behavior: 'smooth' });
  });

  // ---- video (MP4/WebM) export of the last render ----
  exportVideoBtn.addEventListener('click', async () => {
    if (!lastRender || exporting) return;
    if (!window.MediaRecorder) { showToast('This browser can’t record video.', true); return; }
    const types = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const type = types.find((t) => MediaRecorder.isTypeSupported(t));
    if (!type) { showToast('No supported video format found.', true); return; }

    exporting = true;
    exportVideoBtn.disabled = true;
    progress.classList.add('show');
    try {
      const { frames, delay, outW, outH } = lastRender;
      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 4000000 });
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      const stopped = new Promise((r) => (rec.onstop = r));
      ctx.putImageData(frames[0], 0, 0);
      rec.start();
      // the recording is real-time, so frames are shown for their actual delay
      for (let i = 0; i < frames.length; i++) {
        ctx.putImageData(frames[i], 0, 0);
        setProgress((i + 1) / frames.length * 100, 'Recording video ' + (i + 1) + ' / ' + frames.length);
        await new Promise((r) => setTimeout(r, delay));
      }
      rec.stop();
      await stopped;
      const blob = new Blob(chunks, { type: type.split(';')[0] });
      const ext = type.startsWith('video/mp4') ? '.mp4' : '.webm';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = syncFname() + ext;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setProgress(100, 'Done');
      showToast('Video saved — ' + fmtBytes(blob.size) + ' (vs ' + resultMeta.textContent.split('·').pop().trim() + ' as GIF)');
    } catch (err) {
      showToast('Video export failed: ' + err.message, true);
    } finally {
      exporting = false;
      exportVideoBtn.disabled = false;
      setTimeout(() => progress.classList.remove('show'), 800);
    }
  });

  window.addEventListener('resize', () => { layoutTimeline(); layoutOverlay(); });
})();
