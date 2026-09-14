// COUPLE PHOTO BOOTH — avatars or your own camera, framed and kept.
import { api, uploadMedia } from '../api.js';
import { store } from '../state.js';
import { h, icon, toast, field, avatarSvg, hashStr } from '../ui.js';

const FRAMES = [
  { id: 'classic', label: 'Polaroid Classic', draw: (ctx, w, h) => { ctx.fillStyle = '#FBF7EE'; const b = Math.min(w, h) * 0.055; ctx.fillRect(0, 0, w, b); ctx.fillRect(0, h - b * 1.8, w, b * 1.8); ctx.fillRect(0, 0, b, h); ctx.fillRect(w - b, 0, b, h); } },
  { id: 'film', label: 'Vintage Film', draw: (ctx, w, h) => {
    ctx.fillStyle = '#1A1412'; ctx.fillRect(0, 0, w, h * 0.09); ctx.fillRect(0, h * 0.91, w, h * 0.09);
    ctx.fillStyle = '#F4EEE2';
    for (let i = 0; i < Math.floor(w / 46); i++) { ctx.fillRect(i * 46 + 14, h * 0.02, 20, h * 0.05); ctx.fillRect(i * 46 + 14, h * 0.93, 20, h * 0.05); }
  } },
  { id: 'rose', label: 'Romantic Rose', draw: (ctx, w, h) => { ctx.strokeStyle = 'rgba(180, 118, 107, 0.6)'; ctx.lineWidth = 12; ctx.strokeRect(16, 16, w - 32, h - 32); } },
  { id: 'none', label: 'Minimal', draw: () => {} },
];

const FILTERS = [
  { id: 'normal', label: 'Original', css: 'none' },
  { id: 'warm', label: 'Warm Glow', css: 'sepia(0.25) saturate(1.2) contrast(1.05)' },
  { id: 'vintage', label: 'Vintage', css: 'sepia(0.55) contrast(0.95)' },
  { id: 'bw', label: 'Noir B&W', css: 'grayscale(1) contrast(1.1)' }
];

export function render(root) {
  const envs = [
    { id: 'moment-dinner', label: 'Candlelit', img: '/img/moment-dinner.jpg' },
    { id: 'hero-room', label: 'Our room', img: '/img/hero-room.jpg' },
    { id: 'stay-balcony', label: 'Balcony', img: '/img/stay-balcony.jpg' },
    { id: 'stay-beach', label: 'Sunset', img: '/img/stay-beach.jpg' },
    { id: 'stay-cabin', label: 'Cabin', img: '/img/stay-cabin.jpg' },
    { id: 'stay-rain', label: 'Rain', img: '/img/stay-rain.jpg' }
  ];

  let env = envs[0];
  let frame = FRAMES[0];
  let filter = FILTERS[0];
  let caption = '';
  let useCam = false;
  let camStream = null;
  let animFrameId = null;

  const me = store.me;
  const p = store.me?.partner;

  // Pre-load SVG avatar images for smooth canvas painting
  let meAvatarImg = null;
  let pAvatarImg = null;

  function loadAvatarImages() {
    if (me?.user) {
      const meSvg = avatarSvg(me.user.member?.accent || 'rose', me.user.member?.hair || 'short', hashStr(me.user.name), 200);
      meAvatarImg = new Image();
      meAvatarImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(meSvg);
    }
    if (p) {
      const pSvg = avatarSvg(p.accent || 'amber', p.hair || 'long', hashStr(p.name || 'partner'), 200);
      pAvatarImg = new Image();
      pAvatarImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pSvg);
    }
  }
  loadAvatarImages();

  // Background environment image cache
  const envImgCache = {};
  function getEnvImage(src, cb) {
    if (envImgCache[src] && envImgCache[src].complete) return cb(envImgCache[src]);
    const img = new Image();
    img.onload = () => { envImgCache[src] = img; cb(img); };
    img.src = src;
  }

  const canvas = h('canvas', { width: 800, height: 600, class: 'booth-canvas', style: { width: '100%', borderRadius: '16px', display: 'block', background: '#1A1412' } });
  const video = h('video', { autoplay: true, playsinline: true, muted: true, style: { display: 'none' } });
  const stage = h('div', { class: 'booth-stage', style: { maxWidth: '640px', margin: '0 auto', position: 'relative' } }, canvas, video);

  const capInput = h('input', {
    class: 'input',
    placeholder: 'a caption, a date, an inside joke',
    maxlength: '80',
    oninput: () => { caption = capInput.value; drawOnce(); }
  });

  const envRow = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
    envs.map(e => h('button', {
      class: 'chip' + (e.id === env.id ? ' on' : ''),
      onclick: (ev) => {
        env = e;
        envRow.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
        ev.currentTarget.classList.add('on');
        drawOnce();
      }
    }, e.label))
  );

  const frameRow = h('div', { class: 'seg' },
    FRAMES.map(f => h('button', {
      class: f.id === frame.id ? 'on' : '',
      onclick: (e) => {
        frame = f;
        frameRow.querySelectorAll('button').forEach(b => b.classList.remove('on'));
        e.currentTarget.classList.add('on');
        drawOnce();
      }
    }, f.label))
  );

  const filterRow = h('div', { class: 'seg' },
    FILTERS.map(fl => h('button', {
      class: fl.id === filter.id ? 'on' : '',
      onclick: (e) => {
        filter = fl;
        filterRow.querySelectorAll('button').forEach(b => b.classList.remove('on'));
        e.currentTarget.classList.add('on');
        drawOnce();
      }
    }, fl.label))
  );

  const camBtn = h('button', { class: 'btn btn-ghost', onclick: () => useCam ? stopCam() : startCam() },
    h('span', { html: icon('video', 15) }), 'Use camera'
  );

  const captureBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: capture },
    h('span', { html: icon('camera', 17) }), 'Take & Save Photo'
  );

  const downloadBtn = h('button', { class: 'btn btn-ghost btn-lg', onclick: downloadPhoto },
    h('span', { html: icon('download', 17) }), 'Download'
  );

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' },
        h('span', { class: 'eyebrow' }, '📷 Couple\'s Photo Booth'),
        h('h1', { class: 'display-2' }, 'Photo Booth'),
        h('p', {}, 'Frame a moment together, apply filters, and keep it in your Memories.')),
      h('div', { class: 'actions' }, camBtn, downloadBtn, captureBtn)),
    stage,
    h('div', { style: { maxWidth: '640px', margin: '18px auto 0', display: 'flex', flexDirection: 'column', gap: '16px' } },
      field('Where are we?', envRow),
      field('Frame Style', frameRow),
      field('Filter', filterRow),
      field('Caption', capInput))
  ));

  async function startCam() {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
      video.srcObject = camStream;
      await video.play();
      useCam = true;
      camBtn.replaceChildren(h('span', { html: icon('videooff', 15) }), 'Stop camera');
      startAnimLoop();
    } catch (e) {
      toast('Could not access camera — using illustrated backdrop mode!');
    }
  }

  function stopCam() {
    stopAnimLoop();
    if (camStream) {
      camStream.getTracks().forEach(t => t.stop());
      camStream = null;
    }
    useCam = false;
    camBtn.replaceChildren(h('span', { html: icon('video', 15) }), 'Use camera');
    drawOnce();
  }

  function startAnimLoop() {
    stopAnimLoop();
    const renderLoop = () => {
      drawCanvas();
      if (useCam) animFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();
  }

  function stopAnimLoop() {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function drawOnce() {
    if (useCam) return;
    drawCanvas();
  }

  function drawCanvas() {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, hgt = canvas.height;

    ctx.clearRect(0, 0, w, hgt);

    // Apply CSS filter
    ctx.filter = filter.css;

    if (useCam && video.readyState >= 2) {
      const vr = video.videoWidth / video.videoHeight, cr = w / hgt;
      let sw, sh, sx, sy;
      if (vr > cr) { sh = video.videoHeight; sw = sh * cr; sx = (video.videoWidth - sw) / 2; sy = 0; }
      else { sw = video.videoWidth; sh = sw / cr; sx = 0; sy = (video.videoHeight - sh) / 2; }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, hgt);
      renderOverlay(ctx, w, hgt, true);
    } else {
      getEnvImage(env.img, (bgImg) => {
        ctx.drawImage(bgImg, 0, 0, w, hgt);
        renderOverlay(ctx, w, hgt, false);
      });
    }
  }

  function renderOverlay(ctx, w, hgt, smallAvatars) {
    // Draw avatars
    const size = smallAvatars ? 110 : 190;
    if (meAvatarImg && meAvatarImg.complete) {
      ctx.save();
      ctx.translate(w / 2 - (p ? 70 : 0), hgt * 0.62);
      ctx.rotate(-0.06);
      ctx.drawImage(meAvatarImg, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    if (pAvatarImg && pAvatarImg.complete) {
      ctx.save();
      ctx.translate(w / 2 + 70, hgt * 0.62);
      ctx.rotate(0.06);
      ctx.drawImage(pAvatarImg, -size / 2, -size / 2, size, size);
      ctx.restore();
    }

    // Vignette
    const vg = ctx.createRadialGradient(w / 2, hgt / 2, hgt * 0.3, w / 2, hgt / 2, hgt * 0.85);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(15,11,8,0.4)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, hgt);

    // Frame
    ctx.filter = 'none'; // reset filter before frame drawing
    frame.draw(ctx, w, hgt);

    // Caption
    if (caption) {
      ctx.font = 'italic 28px Georgia, serif';
      ctx.fillStyle = '#F6F0E4';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 8;
      ctx.fillText(caption, w / 2, hgt - 36);
      ctx.shadowBlur = 0;
    }

    // Date Stamp
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(246,240,228,0.85)';
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }), w - 24, 38);
  }

  function downloadPhoto() {
    drawCanvas();
    setTimeout(() => {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `photo-booth-${Date.now()}.jpg`;
      a.click();
      toast('Photo downloaded to your device! 📸');
    }, 100);
  }

  async function capture() {
    drawCanvas();
    await new Promise(r => setTimeout(r, 150));
    try {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      if (!blob) throw new Error('Could not create photo blob');
      let mediaId = null;
      try {
        const media = await uploadMedia(new File([blob], 'booth.jpg', { type: 'image/jpeg' }));
        mediaId = media.id;
      } catch {}

      await api('POST', '/api/memories', {
        type: 'photo',
        title: caption || 'Photo booth night',
        body: 'Captured in our Photo Booth',
        media: mediaId,
        happenedOn: new Date().toISOString().slice(0, 10)
      });
      toast('Kept! Saved in your Memories wall.');
    } catch (e) {
      downloadPhoto();
    }
  }

  drawOnce();
  return {
    destroy() {
      stopCam();
    }
  };
}
