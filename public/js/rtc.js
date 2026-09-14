// Optional voice/video — real WebRTC peer-to-peer, signaled over our WebSocket.
// Video is a bonus; the product works fully without it. If the browser or embed
// denies camera/mic access we fail gracefully with a friendly note.
import { send } from './ws.js';
import { on } from './bus.js';
import { h, icon, toast } from './ui.js';
import { store } from './state.js';

let pc = null, localStream = null, panel = null, pendingOffer = null, ringing = null;

function cleanup(silent = false) {
  clearInterval(ringing); ringing = null;
  if (pc) { try { pc.close(); } catch {} pc = null; }
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (panel) { panel.remove(); panel = null; }
  if (pendingOffer) pendingOffer = null;
  if (!silent) toast('Call ended.');
}

async function getMedia(video) {
  return navigator.mediaDevices.getUserMedia({ audio: true, video: !!video });
}

function buildPC() {
  pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] });
  pc.onicecandidate = (e) => { if (e.candidate) send({ t: 'call:signal', data: { kind: 'ice', cand: e.candidate } }); };
  pc.ontrack = (e) => { if (panel) { const v = panel.querySelector('.remote'); if (v && e.track.kind === 'video') { v.srcObject = e.streams[0]; v.style.display = 'block'; } else if (panel) { const a = panel.querySelector('audio.remote'); a.srcObject = e.streams[0]; a.play().catch(() => {}); } } };
  pc.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) cleanup(); };
  return pc;
}

function uiPanel(status, withVideo) {
  if (panel) panel.remove();
  const partner = store.partner();
  const name = partner?.displayName || partner?.name || 'Your partner';
  const remoteVid = h('video', { class: 'remote', autoplay: true, playsinline: true, style: { display: 'none' } });
  const remoteAud = h('audio', { class: 'remote', autoplay: true });
  const localVid = h('video', { class: 'cp-local', autoplay: true, playsinline: true, muted: true });
  const micBtn = h('button', { class: 'icon-btn', 'aria-label': 'Mute microphone', onclick: (e) => { const t = localStream?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; e.currentTarget.classList.toggle('on', !t.enabled); } }, html: icon('mic', 19) });
  const camBtn = h('button', { class: 'icon-btn', 'aria-label': 'Toggle camera', onclick: async (e) => { try { if (!localStream.getVideoTracks().length) { toast('This call started without video. Start a video call to use the camera.'); return; } const t = localStream.getVideoTracks()[0]; t.enabled = !t.enabled; e.currentTarget.classList.toggle('on', !t.enabled); } catch {} }, html: icon('video', 19) });
  const endBtn = h('button', { class: 'icon-btn', 'aria-label': 'Leave call', onclick: () => { send({ t: 'call:signal', data: { kind: 'bye' } }); cleanup(); }, html: icon('phoneoff', 19) });
  panel = h('div', { class: 'call-panel', role: 'dialog', 'aria-label': 'Call with ' + name },
    h('div', { class: 'cp-wrap' }, remoteVid, remoteAud, withVideo ? localVid : '', h('div', { class: 'cp-status' }, status)),
    h('div', { class: 'cp-foot' }, micBtn, camBtn, endBtn));
  document.body.append(panel);
  return panel;
}

export async function startCall({ video = false } = {}) {
  if (pc) { toast('You\'re already on a call.'); return; }
  try {
    localStream = await getMedia(video);
  } catch {
    toast('We couldn\'t reach your ' + (video ? 'camera' : 'microphone') + ' — check browser permissions, or enjoy the room without it.');
    return;
  }
  uiPanel('calling ' + (store.partner()?.displayName || 'them') + '…', video);
  panel.querySelector('.cp-local').srcObject = localStream;
  const peer = buildPC();
  localStream.getTracks().forEach(t => peer.addTrack(t, localStream));
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  send({ t: 'call:signal', data: { kind: 'offer', sdp: offer.sdp, video } });
  ringing = setInterval(() => { /* subtle ring while waiting */ }, 2500);
}

export function initRtc() {
  on('ws:call:signal', async ({ data }) => {
    if (!data || !data.kind) return;
    if (data.kind === 'offer') {
      if (pc) { send({ t: 'call:signal', data: { kind: 'busy' } }); return; }
      const partner = store.partner();
      const name = partner?.displayName || partner?.name || 'Your partner';
      toast(name + ' is calling. One moment — connecting you.', { actionLabel: 'Answer', onAction: async () => {
        try {
          localStream = await getMedia(data.video);
        } catch { toast('Couldn\'t access your mic — call declined.'); send({ t: 'call:signal', data: { kind: 'bye' } }); return; }
        uiPanel('on call with ' + name, data.video);
        if (data.video) panel.querySelector('.cp-local').srcObject = localStream;
        const peer = buildPC();
        localStream.getTracks().forEach(t => peer.addTrack(t, localStream));
        await peer.setRemoteDescription({ type: 'offer', sdp: data.sdp });
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        send({ t: 'call:signal', data: { kind: 'answer', sdp: answer.sdp } });
      }, dur: 12000 });
      return;
    }
    if (data.kind === 'answer' && pc) { await pc.setRemoteDescription({ type: 'answer', sdp: data.sdp }); if (panel) panel.querySelector('.cp-status').textContent = 'connected'; clearInterval(ringing); return; }
    if (data.kind === 'ice' && pc) { try { await pc.addIceCandidate(data.cand); } catch {} return; }
    if (data.kind === 'bye' || data.kind === 'busy') { cleanup(true); if (data.kind === 'busy') toast('They\'re already on a call.'); }
  });
}
