// OUR STORY — the milestone timeline.
import { api } from '../api.js';
import { on } from '../bus.js';
import { h, icon, toast, modal, field, emptyState } from '../ui.js';

export function render(root) {
  let milestones = [];
  const offs = [];
  const line = h('div', { class: 'story-line' });

  root.append(h('div', {},
    h('div', { class: 'page-head' },
      h('div', { class: 't' },
        h('span', { class: 'eyebrow' }, 'How you got here'),
        h('h1', { class: 'display-2' }, 'Our Story'),
        h('p', {}, 'The moments that made you, us.')),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-primary', onclick: () => edit() }, h('span', { html: icon('plus', 16) }), 'Add a milestone'))),
    line));

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

  offs.push(on('entity:milestones', () => load()));
  load();
  return { destroy() { offs.forEach(off => off()); } };
}
