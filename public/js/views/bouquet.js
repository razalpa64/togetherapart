// DIGITAL BOUQUET STUDIO — Create, customize, arrange & send digital flower bouquets.
import { partner, store } from '../state.js';
import { storage } from '../storage.js';
import { h, icon, toast } from '../ui.js';
import { send } from '../ws.js';

export const FLOWERS = [
  { id: 'rose', name: 'Rose', image: '/color/flowers/rose.png', meaning: 'Passion and true love', color: '#e53e3e' },
  { id: 'sunflower', name: 'Sunflower', image: '/color/flowers/sunflower.png', meaning: 'Adoration and loyalty', color: '#ecc94b' },
  { id: 'tulip', name: 'Tulip', image: '/color/flowers/tulip.png', meaning: 'Perfect deep love', color: '#ed64a6' },
  { id: 'peony', name: 'Peony', image: '/color/flowers/peony.png', meaning: 'Romance and prosperity', color: '#f6ad55' },
  { id: 'orchid', name: 'Orchid', image: '/color/flowers/orchid.png', meaning: 'Refinement and rare beauty', color: '#9f7aea' },
  { id: 'lily', name: 'Lily', image: '/color/flowers/lily.png', meaning: 'Pure love and devotion', color: '#cbd5e0' },
  { id: 'dahlia', name: 'Dahlia', image: '/color/flowers/dahlia.png', meaning: 'Elegance and inner strength', color: '#dd6b20' },
  { id: 'daisy', name: 'Daisy', image: '/color/flowers/daisy.png', meaning: 'Innocence and purity', color: '#f6e05e' },
  { id: 'carnation', name: 'Carnation', image: '/color/flowers/carnation.png', meaning: 'Fascination and love', color: '#f687b3' },
  { id: 'anemone', name: 'Anemone', image: '/color/flowers/anemone.png', meaning: 'Anticipation and excitement', color: '#4fd1c5' },
  { id: 'ranunculus', name: 'Ranunculus', image: '/color/flowers/ranunculus.png', meaning: 'Charm and attractiveness', color: '#fc8181' },
  { id: 'zinnia', name: 'Zinnia', image: '/color/flowers/zinnia.png', meaning: 'Endurance and lasting affection', color: '#f66d9b' },
];

export const BUSHES = [
  { base: '/color/bush/bush-1.png', top: '/color/bush/bush-1-top.png', label: 'Lush Garden' },
  { base: '/color/bush/bush-2.png', top: '/color/bush/bush-2-top.png', label: 'Eucalyptus Leaves' },
  { base: '/color/bush/bush-3.png', top: '/color/bush/bush-3-top.png', label: 'Wild Ferns' },
];

export const WRAPPERS = [
  { id: 'wrap-rose', label: 'Blushing Rose', bg: 'linear-gradient(135deg, #fbcfe8 0%, #f472b6 100%)', border: '#f472b6' },
  { id: 'wrap-classic', label: 'Classic Cream', bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: '#fde68a' },
  { id: 'wrap-sage', label: 'Sage Garden', bg: 'linear-gradient(135deg, #dcfce7 0%, #86efac 100%)', border: '#86efac' },
  { id: 'wrap-slate', label: 'Midnight Slate', bg: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)', border: '#475569', dark: true },
  { id: 'vase-glass', label: 'Glass Vase 🏺', bg: 'rgba(255, 255, 255, 0.4)', border: 'rgba(255, 255, 255, 0.8)', glass: true },
];

export const TEMPLATES = [
  { id: 'anniversary', name: '💕 Anniversary', counts: { rose: 3, peony: 2, tulip: 2 }, wrap: 'wrap-rose' },
  { id: 'thinking', name: '💭 Thinking of You', counts: { orchid: 2, lily: 2, ranunculus: 3 }, wrap: 'wrap-classic' },
  { id: 'birthday', name: '🎂 Birthday Cheer', counts: { sunflower: 2, daisy: 3, dahlia: 2 }, wrap: 'wrap-sage' },
  { id: 'love', name: '❤️ Pure Romance', counts: { rose: 5, carnation: 2 }, wrap: 'wrap-rose' },
];

export function render(root) {
  let activeTab = 'studio'; // 'studio' | 'garden'
  let counts = { rose: 2, peony: 1, daisy: 2 };
  let selectedBush = 0;
  let selectedWrapper = 'wrap-rose';
  let cardNote = 'Sending you a bouquet of love and warm thoughts today! 💐';

  const viewContainer = h('div', {});

  function getTotalFlowers() {
    return Object.values(counts).reduce((a, b) => a + b, 0);
  }

  function draw() {
    viewContainer.replaceChildren();
    if (activeTab === 'studio') drawStudio();
    else drawGarden();
  }

  /* ---------------- Studio ---------------- */
  function drawStudio() {
    // Flower Grid
    const flowerGrid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginTop: '14px' } },
      FLOWERS.map(f => {
        const qty = counts[f.id] || 0;
        return h('div', {
          class: 'card card-pad',
          style: { padding: '14px', borderRadius: '16px', border: qty > 0 ? '2px solid var(--rose)' : '1px solid var(--border)', background: 'var(--bg-2)', textAlign: 'center', transition: 'all 0.2s' }
        },
          h('img', { src: f.image, alt: f.name, style: { width: '80px', height: '80px', objectFit: 'contain', margin: '0 auto 8px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' } }),
          h('div', { style: { fontWeight: 'bold', fontSize: '1rem' } }, f.name),
          h('div', { class: 'small faint', style: { fontSize: '0.75rem', fontStyle: 'italic', margin: '3px 0 10px', height: '2.2em', display: '-webkit-box', webkitLineClamp: 2, webkitBoxOrient: 'vertical', overflow: 'hidden' } }, f.meaning),
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' } },
            h('button', {
              class: 'btn btn-ghost btn-sm', style: { width: '28px', height: '28px', padding: 0, borderRadius: '50%' },
              onclick: () => { if (counts[f.id] > 0) { counts[f.id]--; draw(); } }
            }, '-'),
            h('span', { style: { fontWeight: 'bold', minWidth: '20px', fontSize: '1rem' } }, String(qty)),
            h('button', {
              class: 'btn btn-primary btn-sm', style: { width: '28px', height: '28px', padding: 0, borderRadius: '50%' },
              onclick: () => { if (getTotalFlowers() < 12) { counts[f.id] = (counts[f.id] || 0) + 1; draw(); } else toast('Maximum 12 flowers per bouquet'); }
            }, '+')
          )
        );
      })
    );

    // Canvas Arrangement
    const flowerList = [];
    Object.entries(counts).forEach(([id, num]) => {
      const fl = FLOWERS.find(x => x.id === id);
      for (let i = 0; i < num; i++) flowerList.push(fl);
    });

    const canvas = h('div', {
      style: {
        width: '340px', height: '420px', borderRadius: '24px', position: 'relative', overflow: 'hidden',
        background: 'radial-gradient(circle, var(--bg-2) 0%, var(--bg-3) 100%)', boxShadow: 'var(--shadow-s)',
        border: '1px solid var(--border)', margin: '0 auto'
      }
    });

    // Bush background
    const bush = BUSHES[selectedBush];
    canvas.append(h('img', { src: bush.base, style: { position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)', width: '280px', height: 'auto', opacity: 0.95 } }));

    // Flowers Stems
    flowerList.forEach((fl, idx) => {
      const total = flowerList.length;
      const spread = Math.min(total * 22, 220);
      const startX = 170 - spread / 2;
      const posX = startX + (idx / Math.max(total - 1, 1)) * spread + (idx % 2 === 0 ? -10 : 10);
      const posY = 100 + (idx % 3) * 25 + Math.sin(idx) * 15;
      const rot = -25 + (idx / Math.max(total - 1, 1)) * 50 + (idx % 2 === 0 ? -5 : 5);

      canvas.append(h('img', {
        src: fl.image,
        alt: fl.name,
        style: {
          position: 'absolute', left: `${posX - 40}px`, top: `${posY}px`, width: '90px', height: '90px',
          objectFit: 'contain', transform: `rotate(${rot}deg)`, filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.2))',
          transition: 'all 0.3s ease'
        }
      }));
    });

    // Bush Top
    canvas.append(h('img', { src: bush.top, style: { position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)', width: '280px', height: 'auto', zIndex: 10, pointerEvents: 'none' } }));

    // Wrapper Graphic
    const wr = WRAPPERS.find(w => w.id === selectedWrapper) || WRAPPERS[0];
    const wrapperOverlay = h('div', {
      style: {
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '180px', zIndex: 20,
        background: wr.bg, clipPath: 'polygon(15% 0%, 85% 0%, 100% 100%, 0% 100%)',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.15)', borderTop: `3px solid ${wr.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: wr.dark ? '#fff' : '#1e293b',
        padding: '20px'
      }
    },
      h('div', { style: { fontSize: '1.5rem', marginBottom: '4px' } }, '🎀'),
      h('span', { class: 'serif', style: { fontSize: '1rem', fontStyle: 'italic', fontWeight: 'bold' } }, wr.label)
    );
    canvas.append(wrapperOverlay);

    // Template selector
    const templateRow = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' } },
      TEMPLATES.map(t => h('button', {
        class: 'chip',
        onclick: () => {
          counts = { ...t.counts };
          selectedWrapper = t.wrap;
          draw();
          toast(`Loaded template: ${t.name}`);
        }
      }, t.name))
    );

    // Controls
    const wrapperSelect = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '14px 0' } },
      WRAPPERS.map(w => h('button', {
        class: 'chip' + (selectedWrapper === w.id ? ' on' : ''),
        onclick: () => { selectedWrapper = w.id; draw(); }
      }, w.label))
    );

    const bushSelect = h('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0' } },
      BUSHES.map((b, i) => h('button', {
        class: 'chip' + (selectedBush === i ? ' on' : ''),
        onclick: () => { selectedBush = i; draw(); }
      }, b.label))
    );

    // Note Input
    const noteArea = h('textarea', {
      class: 'input', placeholder: 'Write a romantic message for your partner...', rows: 3,
      style: { resize: 'vertical', fontFamily: 'var(--font-serif)', fontSize: '1.05rem' }
    }, cardNote);
    noteArea.oninput = (e) => { cardNote = e.target.value; };

    // Send Button
    const sendBtn = h('button', {
      class: 'btn btn-primary btn-lg',
      style: { width: '100%', marginTop: '16px' },
      onclick: async () => {
        if (getTotalFlowers() === 0) { toast('Pick at least one flower to build your bouquet! 🌸'); return; }
        const bData = {
          id: 'bq_' + Date.now(),
          counts, wrapper: selectedWrapper, bush: selectedBush,
          message: cardNote.trim(), from: store.me?.user?.name || 'You',
          date: new Date().toISOString()
        };
        const saved = storage.get('ta_bouquets') || [];
        saved.unshift(bData);
        storage.set('ta_bouquets', saved);

        // Send realtime float emoji
        send({ t: 'float', emoji: '💐' });
        toast('Bouquet sent to your partner! 💐💖');
        activeTab = 'garden';
        draw();
      }
    }, h('span', { html: icon('heart', 18) }), 'Send Bouquet to Partner 💐');

    const layout = h('div', { class: 'two-col', style: { gap: '28px', marginTop: '18px' } },
      h('div', {},
        h('span', { class: 'eyebrow' }, 'Step 1 — Pick Flowers'),
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0' } },
          h('h2', { class: 'h2' }, `Select Flowers (${getTotalFlowers()}/12)`),
          h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { counts = {}; draw(); } }, 'Clear all')),
        h('p', { class: 'small muted', style: { marginBottom: '12px' } }, 'Choose your flowers — each carries a romantic meaning.'),
        templateRow,
        flowerGrid
      ),
      h('div', {},
        h('span', { class: 'eyebrow' }, 'Step 2 & 3 — Arrange & Send'),
        h('h2', { class: 'h2', style: { margin: '8px 0 14px' } }, 'Bouquet Preview'),
        canvas,
        h('div', { class: 'card card-pad', style: { marginTop: '16px' } },
          h('label', { class: 'lbl' }, 'Wrapper & Vase Style'),
          wrapperSelect,
          h('label', { class: 'lbl', style: { marginTop: '12px' } }, 'Greenery Base'),
          bushSelect,
          h('label', { class: 'lbl', style: { marginTop: '12px' } }, 'Love Note Attachment'),
          noteArea,
          sendBtn
        )
      )
    );

    viewContainer.append(layout);
  }

  /* ---------------- Garden ---------------- */
  function drawGarden() {
    const bouquets = storage.get('ta_bouquets') || [
      {
        id: 'sample1',
        counts: { rose: 3, peony: 2, tulip: 2 },
        wrapper: 'wrap-rose', bush: 0,
        message: 'Happy Anniversary my love! Distance means nothing when someone means everything. ❤️',
        from: partner()?.displayName || 'Partner',
        date: new Date().toISOString()
      }
    ];

    if (!bouquets.length) {
      viewContainer.append(
        h('div', { class: 'card card-pad', style: { textAlign: 'center', padding: '60px 20px' } },
          h('span', { style: { fontSize: '3rem', display: 'block', marginBottom: '12px' } }, '🏡'),
          h('h2', { class: 'h2' }, 'Your Digital Garden is Empty'),
          h('p', { class: 'muted small', style: { marginTop: '6px', marginBottom: '16px' } }, 'Send a bouquet to your partner to start your shared garden!'),
          h('button', { class: 'btn btn-primary', onclick: () => { activeTab = 'studio'; draw(); } }, 'Create a Bouquet 💐'))
      );
      return;
    }

    const grid = h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', marginTop: '18px' } },
      bouquets.map(b => {
        const wr = WRAPPERS.find(w => w.id === b.wrapper) || WRAPPERS[0];
        const flList = [];
        Object.entries(b.counts || {}).forEach(([id, num]) => {
          const fl = FLOWERS.find(x => x.id === id);
          if (fl) flList.push(`${num}x ${fl.name}`);
        });

        return h('div', { class: 'card card-pad', style: { borderRadius: '20px', border: '1px solid var(--border)' } },
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' } },
            h('span', { class: 'tag', style: { background: wr.bg, color: wr.dark ? '#fff' : '#1e293b', fontWeight: 'bold' } }, wr.label),
            h('span', { class: 'small faint' }, new Date(b.date).toLocaleDateString([], { month: 'short', day: 'numeric' }))
          ),
          h('div', { style: { fontSize: '2.5rem', textAlign: 'center', margin: '14px 0' } }, '💐'),
          h('div', { class: 'serif', style: { fontSize: '1.05rem', fontStyle: 'italic', background: 'var(--bg-3)', padding: '14px', borderRadius: '12px', marginBottom: '12px' } }, `"${b.message}"`),
          h('div', { class: 'small muted', style: { marginBottom: '8px' } }, h('b', {}, 'Flowers: '), flList.join(', ')),
          h('div', { class: 'small faint', style: { textAlign: 'right', fontWeight: 'bold' } }, `— Sent by ${b.from}`)
        );
      })
    );

    viewContainer.append(
      h('div', {},
        h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
          h('h2', { class: 'h2' }, 'Shared Garden Gallery'),
          h('button', { class: 'btn btn-primary btn-sm', onclick: () => { activeTab = 'studio'; draw(); } }, '➕ New Bouquet')),
        grid
      )
    );
  }

  // Header and Tabs
  const header = h('div', { class: 'page-head' },
    h('div', { class: 't' },
      h('span', { class: 'eyebrow', style: { color: 'var(--rose)' } }, '🌸 Digital Flower Studio'),
      h('h1', { class: 'display-2' }, 'Digital Bouquet'),
      h('p', {}, 'Pick, arrange, and send custom flower bouquets with romantic meanings to your partner.')),
    h('div', { class: 'actions' },
      h('button', { class: 'btn ' + (activeTab === 'studio' ? 'btn-primary' : 'btn-ghost'), onclick: () => { activeTab = 'studio'; draw(); } }, '💐 Studio'),
      h('button', { class: 'btn ' + (activeTab === 'garden' ? 'btn-primary' : 'btn-ghost'), onclick: () => { activeTab = 'garden'; draw(); } }, '🏡 Our Garden'))
  );

  root.append(h('div', {}, header, viewContainer));
  draw();
  return {};
}
