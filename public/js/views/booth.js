// COUPLE PHOTO BOOTH — avatars or your own camera, framed and kept.
import { api, uploadMedia } from '../api.js';
import { store } from '../state.js';
import { h, icon, toast, field, avatarSvg, hashStr } from '../ui.js';
import { STAY_ENVS } from '../stay.js';

const FRAMES = [
  { id: 'classic', label: 'Classic', draw: (ctx, w, h) => { ctx.fillStyle = '#FBF7EE'; const b = Math.min(w, h) * 0.055; ctx.fillRect(0, 0, w, b); ctx.fillRect(0, h - b * 1.7, w, b * 1.7); ctx.fillRect(0, 0, b, h); ctx.fillRect(w - b, 0, b, h); } },
  { id: 'film', label: 'Film', draw: (ctx, w, h) => {
    ctx.fillStyle = '#211C16'; ctx.fillRect(0, 0, w, h * 0.09); ctx.fillRect(0, h * 0.91, w, h * 0.09);
    ctx.fillStyle = '#F4EEE2';
    for (let i = 0; i < Math.floor(w / 46); i++) { ctx.fillRect(i * 46 + 14, h * 0.02, 20, h * 0.05); ctx.fillRect(i * 46 + 14, h * 0.93, 20, h * 0.05); }
  } },
  { id: 'none', label: 'None', draw: () => {} },
];

export function render(root) {
  const envs = [{ id: 'moment-dinner', label: 'Candlelit', img: '/img/moment-dinner.jpg' }, { id: 'hero-room', label: 'Our room', img: '/img/hero-room.jpg' },
    { id: 'stay-balcony', label: 'Balcony', img: '/img/stay-balcony.jpg' }, { id: 'stay-beach', label: 'Sunset', img: '/img/stay-beach.jpg' },
    { id: 'stay-cabin', label: 'Cabin', img: '/img/stay-cabin.jpg' }, { id: 'stay-rain', label: 'Rain', img: '/img/stay-rain.jpg' }];
  let env = envs[0], frame = FRAMES[0], caption = '', useCam = false, camStream = null;
  const me = store.me;
  const p = store.me.partner;

  const canvas = h('canvas', { width: 800, height: 600, 'aria-label': 'Photo preview' });
  const video = h('video', { autoplay: true, playsinline: true, muted: true, style: { display: 'none' } });
  const stage = h('div', { class: 'booth-stage' }, canvas, video);
  const capInput = h('input', { class: 'input', placeholder: 'a caption, a date, an inside joke', maxlength: '80', oninput: () => { caption = capInput.value; render(); } });

  const envRow = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } }, envs.map(e => h('button', { class: 'chip' + (e.id === env.id ? ' on' : ''), onclick: (ev) => { env = e; envRow.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); ev.currentTarget.classList.add('on'); render(); } }, e.label)));
  const frameRow = h('div', { class: 'seg' }, FRAMES.map(f => h('button', { class: f.id === frame.id ? 'on' : '', onclick: (e) => { frame = f; frameRow.querySelectorAll('button').forEach(b => b.classList.remove('on')); e.currentTarget.classList.add('on'); render(); } }, f.label)));

  async function startCam() {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = camStream;
      video.style.display = '';
      useCam = true;
      camBtn.replaceChildren(h('span', { html: icon('videooff', 15) }), 'Stop camera');
      render();
    } catch { toast('No camera here — the illustrated version is just as you.'); }
  }
  function stopCam() {
    if (camStream) camStream.getTracks().forEach(t => t.stop());
    camStream = null; useCam = false; video.style.display = 'none';
    camBtn.replaceChildren(h('span', { html: icon('video', 15) }), 'Use camera');
    render();
  }
  const camBtn = h('button', { class: 'btn btn-ghost', onclick: () => useCam ? stopCam() : startCam() }, h('span', { html: icon('video', 15) }), 'Use camera');

  const captureBtn = h('button', { class: 'btn btn-primary btn-lg', onclick: capture }, h('span', { html: icon('camera', 17) }), 'Take the photo');

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' }, h('span', { class: 'eyebrow' }, 'Three seconds, no redoing'), h('h1', { class: 'display-2' }, 'Photo Booth')),
      h('div', { class: 'actions' }, camBtn, captureBtn)),
    stage,
    h('div', { style: { maxWidth: '640px', margin: '18px auto 0', display: 'flex', flexDirection: 'column', gap: '16px' } },
      field('Where are we?', envRow),
      field('Frame', frameRow),
      field('Caption', capInput))));

  function render() {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, hgt = canvas.height;
    ctx.clearRect(0, 0, w, hgt);
    // background
    if (useCam && video.videoWidth) {
      const vr = video.videoWidth / video.videoHeight, cr = w / hgt;
      let sw, sh, sx, sy;
      if (vr > cr) { sh = video.videoHeight; sw = sh * cr; sx = (video.videoWidth - sw) / 2; sy = 0; }
      else { sw = video.videoWidth; sh = sw / cr; sx = 0; sy = (video.videoHeight - sh) / 2; }
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, hgt);
    } else {
      const im = new Image();
      im.onload = () => { ctx.drawImage(im, 0, 0, w, hgt); after(); };
      im.src = env.img;
      ctx.fillStyle = '#2A241C'; ctx.fillRect(0, 0, w, hgt);
      after(true);
      return;
    }
    after();
    function after(skipAvatars) {
      if (!useCam && !skipAvatars) drawAvatars(ctx, w, hgt);
      if (useCam) drawAvatars(ctx, w, hgt, true);
      // vignette + caption + stamp
      const vg = ctx.createRadialGradient(w / 2, hgt / 2, hgt * 0.3, w / 2, hgt / 2, hgt * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(15,11,8,0.38)');
      ctx.fillStyle = vg; ctx.fillRect(0, 0, w, hgt);
      frame.draw(ctx, w, hgt);
      if (caption) {
        ctx.font = 'italic 30px Georgia, serif';
        ctx.fillStyle = '#F6F0E4'; ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10;
        ctx.fillText(caption, w / 2, hgt - 34);
        ctx.shadowBlur = 0;
      }
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(246,240,228,0.85)'; ctx.textAlign = 'right';
      ctx.fillText(new Date().toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }), w - 26, 40);
    }
  }

  function drawAvatars(ctx, w, hgt, small = false) {
    const size = small ? 110 : 190;
    const draw = (svg, x, y, rot) => {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(rot);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.restore();
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    };
    const meSvg = avatarSvg(me.user.member?.accent || 'rose', me.user.member?.hair || 'short', hashStr(me.user.name), 200);
    draw(meSvg, w / 2 - 70, hgt * 0.58, -0.06);
    if (p) {
      const pSvg = avatarSvg(p.accent || 'amber', p.hair || 'long', hashStr(p.name || 'p'), 200);
      draw(pSvg, w / 2 + 70, hgt * 0.58, 0.06);
    }
  }

  async function capture() {
    // let pending avatar images paint first
    await new Promise(r => setTimeout(r, 120));
    render();
    await new Promise(r => setTimeout(r, 220));
    try {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.9));
      const media = await uploadMedia(new File([blob], 'booth.jpg', { type: 'image/jpeg' }));
      await api('POST', '/api/memories', { type: 'photo', title: caption || 'Photo booth night', body: '', media: media.id, happenedOn: new Date().toISOString().slice(0, 10) });
      toast('Kept. It\'s on your wall in Memories.');
    } catch (e) { toast(e.message); }
  }

  render();
  return { destroy() { if (camStream) camStream.getTracks().forEach(t => t.stop()); } };
}
