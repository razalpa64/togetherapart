// COUPLE PHOTO BOOTH — Live Webcam & Illustrated Couple Framed Memories.
import { api, uploadMedia } from '../api.js';
import { store } from '../state.js';
import { h, icon, toast, field, avatarSvg, hashStr } from '../ui.js';

const FRAMES = [
  { id: 'classic', label: 'Polaroid Classic', draw: (ctx, w, h) => { ctx.fillStyle = '#FAF6EE'; const b = Math.min(w, h) * 0.055; ctx.fillRect(0, 0, w, b); ctx.fillRect(0, h - b * 1.8, w, b * 1.8); ctx.fillRect(0, 0, b, h); ctx.fillRect(w - b, 0, b, h); } },
  { id: 'film', label: 'Vintage Film', draw: (ctx, w, h) => {
    ctx.fillStyle = '#1C1613'; ctx.fillRect(0, 0, w, h * 0.09); ctx.fillRect(0, h * 0.91, w, h * 0.09);
    ctx.fillStyle = '#FAF6EE';
    for (let i = 0; i < Math.floor(w / 46); i++) { ctx.fillRect(i * 46 + 14, h * 0.02, 20, h * 0.05); ctx.fillRect(i * 46 + 14, h * 0.93, 20, h * 0.05); }
  } },
  { id: 'rose', label: 'Romantic Rose', draw: (ctx, w, h) => { ctx.strokeStyle = 'rgba(200, 125, 112, 0.7)'; ctx.lineWidth = 14; ctx.strokeRect(16, 16, w - 32, h - 32); } },
  { id: 'none', label: 'Minimal', draw: () => {} },
];

const FILTERS = [
  { id: 'normal', label: 'Original', css: 'none' },
  { id: 'warm', label: 'Warm Glow', css: 'sepia(0.3) saturate(1.25) contrast(1.05)' },
  { id: 'vintage', label: 'Vintage Sepia', css: 'sepia(0.65) contrast(0.95)' },
  { id: 'bw', label: 'Noir B&W', css: 'grayscale(1) contrast(1.15)' }
];

export function render(root) {
  const envs = [
    { id: 'moment-dinner', label: 'Candlelit Dinner', img: '/img/moment-dinner.jpg' },
    { id: 'hero-room', label: 'Our Cozy Room', img: '/img/hero-room.jpg' },
    { id: 'stay-balcony', label: 'Sunset Balcony', img: '/img/stay-balcony.jpg' },
    { id: 'stay-beach', label: 'Beach Sunset', img: '/img/stay-beach.jpg' },
    { id: 'stay-cabin', label: 'Cozy Cabin', img: '/img/stay-cabin.jpg' },
    { id: 'stay-rain', label: 'Rainy Night', img: '/img/stay-rain.jpg' }
  ];

  let currentEnv = envs[0];
  let currentFrame = FRAMES[0];
  let currentFilter = FILTERS[0];
  let captionText = '';
  let useCamera = false;
  let mediaStream = null;
  let animLoopId = null;

  const me = store.me;
  const partnerUser = store.me?.partner;

  // Pre-load images
  const backdropCache = {};
  function getBackdropImage(src) {
    if (!backdropCache[src]) {
      const img = new Image();
      img.src = src;
      backdropCache[src] = img;
    }
    return backdropCache[src];
  }
  envs.forEach(e => getBackdropImage(e.img));

  let meAvatarImg = null;
  let partnerAvatarImg = null;

  if (me?.user) {
    const meSvg = avatarSvg(me.user.member?.accent || 'rose', me.user.member?.hair || 'short', hashStr(me.user.name), 220);
    meAvatarImg = new Image();
    meAvatarImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(meSvg);
  }
  if (partnerUser) {
    const pSvg = avatarSvg(partnerUser.accent || 'amber', partnerUser.hair || 'long', hashStr(partnerUser.name || 'partner'), 220);
    partnerAvatarImg = new Image();
    partnerAvatarImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(pSvg);
  }

  // DOM Elements
  const canvas = h('canvas', { width: 800, height: 600, class: 'booth-canvas', style: { width: '100%', borderRadius: '18px', display: 'block', background: '#1C1613', boxShadow: 'var(--shadow)' } });
  const video = h('video', { autoplay: true, playsinline: true, muted: true, style: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: '18px', display: 'none' } });
  const flashOverlay = h('div', { style: { position: 'absolute', inset: 0, background: '#fff', opacity: 0, pointerEvents: 'none', transition: 'opacity 0.4s ease', borderRadius: '18px', zIndex: 50 } });
  
  const stage = h('div', { class: 'booth-stage', style: { maxWidth: '640px', margin: '0 auto', position: 'relative', overflow: 'hidden', borderRadius: '18px' } }, canvas, video, flashOverlay);

  const capInput = h('input', {
    class: 'input',
    placeholder: 'a caption, a date, an inside joke...',
    maxlength: '80',
    oninput: (e) => { captionText = e.target.value; }
  });

  const envRow = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
    envs.map(e => h('button', {
      class: 'chip' + (e.id === currentEnv.id ? ' on' : ''),
      onclick: (ev) => {
        currentEnv = e;
        envRow.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
        ev.currentTarget.classList.add('on');
      }
    }, e.label))
  );

  const frameRow = h('div', { class: 'seg' },
    FRAMES.map(f => h('button', {
      class: f.id === currentFrame.id ? 'on' : '',
      onclick: (e) => {
        currentFrame = f;
        frameRow.querySelectorAll('button').forEach(b => b.classList.remove('on'));
        e.currentTarget.classList.add('on');
      }
    }, f.label))
  );

  const filterRow = h('div', { class: 'seg' },
    FILTERS.map(fl => h('button', {
      class: fl.id === currentFilter.id ? 'on' : '',
      onclick: (e) => {
        currentFilter = fl;
        filterRow.querySelectorAll('button').forEach(b => b.classList.remove('on'));
        e.currentTarget.classList.add('on');
      }
    }, fl.label))
  );

  const camBtn = h('button', { class: 'btn btn-ghost', onclick: toggleCamera },
    h('span', { html: icon('video', 16) }), 'Use Camera'
  );

  const captureBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: takePhoto },
    h('span', { html: icon('camera', 18) }), 'Snap & Save Photo 📸'
  );

  const downloadBtn = h('button', { class: 'btn btn-ghost btn-lg', onclick: downloadCurrentPhoto },
    h('span', { html: icon('download', 18) }), 'Download'
  );

  const view = h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' },
        h('span', { class: 'eyebrow' }, '📷 Couple\'s Photo Booth'),
        h('h1', { class: 'display-2' }, 'Photo Booth'),
        h('p', {}, 'Snap framed pictures together, customize locations & vintage filters, and save memories.')),
      h('div', { class: 'actions' }, camBtn, downloadBtn, captureBtn)),
    stage,
    h('div', { style: { maxWidth: '640px', margin: '20px auto 0', display: 'flex', flexDirection: 'column', gap: '16px' } },
      field('Location Backdrop', envRow),
      field('Frame Style', frameRow),
      field('Photo Filter', filterRow),
      field('Love Note / Caption', capInput))
  );

  root.append(view);

  // Render Loop
  function startRenderLoop() {
    stopRenderLoop();
    function loop() {
      renderCanvasFrame();
      animLoopId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopRenderLoop() {
    if (animLoopId) {
      cancelAnimationFrame(animLoopId);
      animLoopId = null;
    }
  }

  function renderCanvasFrame() {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, hgt = canvas.height;

    ctx.clearRect(0, 0, w, hgt);

    // Apply Filter
    ctx.filter = currentFilter.css;

    if (useCamera && video.readyState >= 2) {
      const vr = video.videoWidth / video.videoHeight, cr = w / hgt;
      let sw, sh, sx, sy;
      if (vr > cr) { sh = video.videoHeight; sw = sh * cr; sx = (video.videoWidth - sw) / 2; sy = 0; }
      else { sw = video.videoWidth; sh = sw / cr; sx = 0; sy = (video.videoHeight - sh) / 2; }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, hgt);
      renderCanvasOverlays(ctx, w, hgt, true);
    } else {
      const bgImg = getBackdropImage(currentEnv.img);
      if (bgImg && bgImg.complete && bgImg.naturalWidth) {
        ctx.drawImage(bgImg, 0, 0, w, hgt);
      } else {
        // Fallback warm gradient
        const grad = ctx.createLinearGradient(0, 0, w, hgt);
        grad.addColorStop(0, '#382E27');
        grad.addColorStop(1, '#1C1613');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, hgt);
      }
      renderCanvasOverlays(ctx, w, hgt, false);
    }
  }

  function renderCanvasOverlays(ctx, w, hgt, isCam) {
    const avatarSize = isCam ? 115 : 195;

    // Draw Avatars
    if (meAvatarImg && meAvatarImg.complete) {
      ctx.save();
      ctx.translate(w / 2 - (partnerUser ? 75 : 0), hgt * 0.62);
      ctx.rotate(-0.06);
      ctx.drawImage(meAvatarImg, -avatarSize / 2, -avatarSize / 2, avatarSize, avatarSize);
      ctx.restore();
    }
    if (partnerAvatarImg && partnerAvatarImg.complete) {
      ctx.save();
      ctx.translate(w / 2 + 75, hgt * 0.62);
      ctx.rotate(0.06);
      ctx.drawImage(partnerAvatarImg, -avatarSize / 2, -avatarSize / 2, avatarSize, avatarSize);
      ctx.restore();
    }

    // Vignette
    const vg = ctx.createRadialGradient(w / 2, hgt / 2, hgt * 0.35, w / 2, hgt / 2, hgt * 0.88);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(20,15,12,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, hgt);

    // Frame (Reset filter so frame color stays crisp)
    ctx.filter = 'none';
    currentFrame.draw(ctx, w, hgt);

    // Caption
    if (captionText) {
      ctx.font = 'italic 28px Georgia, serif';
      ctx.fillStyle = '#FAF6EE';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 10;
      ctx.fillText(captionText, w / 2, hgt - 36);
      ctx.shadowBlur = 0;
    }

    // Date Stamp
    ctx.font = '600 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(250,246,238,0.85)';
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }), w - 24, 38);
  }

  async function toggleCamera() {
    if (useCamera) {
      stopCamera();
    } else {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } });
        video.srcObject = mediaStream;
        await video.play();
        useCamera = true;
        video.style.display = 'block';
        camBtn.replaceChildren(h('span', { html: icon('videooff', 16) }), 'Use Illustrated Stage');
        toast('Camera connected! 🎥');
      } catch (err) {
        toast('Could not access camera — enjoying Illustrated Couple Backdrop mode!');
        stopCamera();
      }
    }
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null;
    }
    useCamera = false;
    video.style.display = 'none';
    camBtn.replaceChildren(h('span', { html: icon('video', 16) }), 'Use Camera');
  }

  function downloadCurrentPhoto() {
    triggerFlash();
    setTimeout(() => {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `together-apart-photo-${Date.now()}.jpg`;
      a.click();
      toast('Photo downloaded to your device! 📸');
    }, 120);
  }

  function triggerFlash() {
    flashOverlay.style.opacity = '0.9';
    setTimeout(() => { flashOverlay.style.opacity = '0'; }, 300);
  }

  async function takePhoto() {
    triggerFlash();
    await new Promise(r => setTimeout(r, 150));
    try {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Failed to generate image blob');
      
      let mediaId = null;
      try {
        const media = await uploadMedia(new File([blob], 'photo-booth.jpg', { type: 'image/jpeg' }));
        mediaId = media.id;
      } catch {}

      await api('POST', '/api/memories', {
        type: 'photo',
        title: captionText || 'Photo booth moment',
        body: 'Framed in our Photo Booth',
        media: mediaId,
        happenedOn: new Date().toISOString().slice(0, 10)
      });
      toast('Photo saved to your Memories wall! 📸❤️');
    } catch (e) {
      downloadCurrentPhoto();
    }
  }

  startRenderLoop();

  return {
    destroy() {
      stopRenderLoop();
      stopCamera();
    }
  };
}
