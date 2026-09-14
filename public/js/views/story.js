// OUR STORY — the milestone timeline.
import { api } from '../api.js';
import { on } from '../bus.js';
import { h, icon, toast, modal, field, emptyState } from '../ui.js';

export function render(root) {
  let milestones = [];
  const offs = [];
  const bucketLine = h('div', { class: 'card card-pad', style: { marginTop: '28px' } });

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' },
        h('span', { class: 'eyebrow' }, 'How you got here'),
        h('h1', { class: 'display-2' }, 'Our Story'),
        h('p', {}, 'The moments that made you, us.'))),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary', onclick: () => edit() }, h('span', { html: icon('plus', 16) }), 'Add a milestone')),
    line,
    bucketLine));

  async function load() {
    try {
      const d = await api('GET', '/api/milestones');
      milestones = d.milestones;
      draw();
    } catch (e) { toast(e.message); }
  }
  function draw() {
    if (!milestones.length) {
      line.replaceChildren(emptyState('Every story starts somewhere.', 'Add your first milestone — the first message counts.'));
      return;
    }
    line.replaceChildren(...milestones.map(m => h('div', { class: 'story-item' },
      h('div', { class: 'when' }, fmtWhen(m.date)),
      h('h3', {}, (m.icon || '❤️') + '  ' + m.title),
      m.note ? h('p', {}, m.note) : '',
      h('div', { class: 'tools' },
        h('button', { class: 'icon-btn', style: { width: '30px', height: '30px' }, 'aria-label': 'Edit milestone', html: icon('edit', 14), onclick: () => edit(m) }),
        h('button', { class: 'icon-btn', style: { width: '30px', height: '30px' }, 'aria-label': 'Delete milestone', html: icon('trash', 14), onclick: async () => { await api('DELETE', '/api/milestones/' + m.id).catch(e => toast(e.message)); load(); } })))));
  }
  function fmtWhen(date) {
    const d = new Date(date + 'T12:00:00');
    return d.toLocaleDateString([], { day: '2-digit', month: 'short' }).toUpperCase() + ' · ' + d.getFullYear();
  }

  function edit(m = null) {
    const iconSel = h('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } }, ['❤️', '💬', '📞', '🌙', '✉️', '✈️', '🎂', '🏠', '💍', '⭐'].map(i =>
      h('button', { class: 'chip' + (m?.icon === i ? ' on' : ''), onclick: (e) => { iconSel.querySelectorAll('.chip').forEach(c => c.classList.remove('on')); e.currentTarget.classList.add('on'); } }, i)));
    const title = h('input', { class: 'input', placeholder: 'First real meeting', maxlength: '120', value: m?.title || '' });
    const date = h('input', { class: 'input', type: 'date', value: m?.date || new Date().toISOString().slice(0, 10) });
    const note = h('input', { class: 'input', placeholder: 'Airport arrivals, 11:40', maxlength: '500', value: m?.note || '' });
    modal({ title: m ? 'Edit milestone' : 'Add a milestone', body: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px' } },
      field('Title', title), field('When', date), field('A little detail (optional)', note), field('Icon', iconSel)),
      actions: [{ label: m ? 'Save' : 'Add to our story', class: 'btn-primary', onclick: async (close) => {
        const iconPick = iconSel.querySelector('.on')?.textContent || m?.icon || '❤️';
        try {
          if (m) await api('PATCH', '/api/milestones/' + m.id, { title: title.value, date: date.value, note: note.value, icon: iconPick });
          else await api('POST', '/api/milestones', { title: title.value, date: date.value, note: note.value, icon: iconPick });
          close(); load();
        } catch (e) { toast(e.message); }
      } }] });
  }

  function drawBucketList() {
    let items = JSON.parse(localStorage.getItem('ta_bucket_list') || 'null') || [
      { id: '1', text: 'Watch a sunset together in person', done: false, emoji: '🌅' },
      { id: '2', text: 'Cook a 3-course dinner together', done: false, emoji: '🍝' },
      { id: '3', text: 'Stargaze in a cozy mountain cabin', done: false, emoji: '🏕️' },
      { id: '4', text: 'Take a long road trip with no destination', done: false, emoji: '🚗' }
    ];

    const list = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '14px' } },
      items.map(it => h('div', {
        class: 'soft-card',
        style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderRadius: '12px' }
      },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px' } },
          h('button', {
            style: { fontSize: '1.2rem', background: 'none', border: 'none', cursor: 'pointer' },
            onclick: () => {
              it.done = !it.done;
              localStorage.setItem('ta_bucket_list', JSON.stringify(items));
              drawBucketList();
            }
          }, it.done ? '✅' : '⚪'),
          h('span', { style: { fontSize: '1.05rem', textDecoration: it.done ? 'line-through' : 'none', opacity: it.done ? 0.6 : 1 } }, it.emoji + ' ' + it.text)
        ),
        h('button', {
          class: 'icon-btn', style: { width: '28px', height: '28px' }, 'aria-label': 'Delete dream',
          html: icon('trash', 14),
          onclick: () => {
            items = items.filter(x => x.id !== it.id);
            localStorage.setItem('ta_bucket_list', JSON.stringify(items));
            drawBucketList();
          }
        })
      ))
    );

    const addBtn = h('button', {
      class: 'btn btn-ghost btn-sm',
      onclick: () => {
        const txt = prompt('Add a dream to your shared bucket list:');
        if (!txt || !txt.trim()) return;
        const emojis = ['🌟', '✈️', '🏝️', '🥐', '🎶', '🏰', '☕'];
        const em = emojis[Math.floor(Math.random() * emojis.length)];
        items.push({ id: String(Date.now()), text: txt.trim(), done: false, emoji: em });
        localStorage.setItem('ta_bucket_list', JSON.stringify(items));
        drawBucketList();
      }
    }, '➕ Add a dream');

    bucketLine.replaceChildren(
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        h('div', {},
          h('span', { class: 'eyebrow' }, 'Someday Together'),
          h('h2', { class: 'h2' }, 'Together Bucket List'),
          h('p', { class: 'muted small' }, 'Dreams and adventures waiting for the two of you.')),
        addBtn
      ),
      list
    );
  }

  offs.push(on('entity:milestones', () => load()));
  load();
  drawBucketList();
  return { destroy() { offs.forEach(off => off()); } };
}
