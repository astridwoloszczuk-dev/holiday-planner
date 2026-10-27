// ── Config ────────────────────────────────────────────────────────────────────
const SUPABASE_URL  = 'https://mezayharkjyvnnhvdlww.supabase.co';
const SUPABASE_ANON = 'sb_publishable_bw3Kcni9Yc88BWLp6G93Gg_HIGbqOKF';
const EDGE_FN_URL   = `${SUPABASE_URL}/functions/v1/holiday-ai`;

const SLOT_SLOTS = ['morning', 'lunch', 'afternoon', 'evening'];
const SLOT_ICONS = { morning: '🌅', lunch: '🍽️', afternoon: '☀️', evening: '🌙' };
const CAT_EMOJIS = { clothing: '👗', toiletries: '🧴', documents: '📄', gear: '🎒', beach: '🏖️', health: '💊', kids: '👧', misc: '📦' };
const ANC_ICONS  = { restaurant: '🍽️', activity: '🎯', spa: '💆', transfer: '🚗', hotel: '🏨', flight: '✈️', other: '📌' };
const PEOPLE     = ['Astrid', 'Niko', 'Max', 'Alex', 'Vicky'];

// ── Supabase ──────────────────────────────────────────────────────────────────
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── State ─────────────────────────────────────────────────────────────────────
const state = {
  screen: 'home',
  tab: 'plan',
  holidayId: null,
  holidays: [],
  holiday: null,
  days: [],
  docs: [],
  packing: [],
  ancillaries: [],
};

// ── DOM ───────────────────────────────────────────────────────────────────────
const screenHome   = document.getElementById('screen-home');
const screenDetail = document.getElementById('screen-detail');

// ── Utilities ─────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today  = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function wmoIcon(code) {
  if (code === 0)  return '☀️';
  if (code <= 2)   return '🌤️';
  if (code <= 3)   return '☁️';
  if (code <= 48)  return '🌫️';
  if (code <= 67)  return '🌧️';
  if (code <= 77)  return '❄️';
  if (code <= 82)  return '🌦️';
  return '⛈️';
}

// ── Router ────────────────────────────────────────────────────────────────────

function route() {
  const hash = location.hash;
  if (hash.startsWith('#/h/')) {
    showDetail(hash.slice(4));
  } else {
    showHome();
  }
}

window.addEventListener('hashchange', route);

// ── HOME SCREEN ───────────────────────────────────────────────────────────────

async function showHome() {
  state.screen = 'home';
  screenHome.classList.remove('hidden');
  screenDetail.classList.add('hidden');
  document.body.classList.remove('has-tabs');
  await loadHolidays();
}

async function loadHolidays() {
  const { data } = await db.from('holidays').select('*').order('depart_date', { ascending: true, nullsFirst: false });
  state.holidays = data || [];
  renderHome();
}

// Booked holidays sort themselves by date: nobody has to flip upcoming → now → past.
// 'idea' stays an idea until it gets dates and is marked booked.
function effectiveStatus(h) {
  if (h.status === 'idea' || !h.depart_date) return h.status;
  const start = daysUntil(h.depart_date);
  const end   = daysUntil(h.return_date || h.depart_date);
  if (end < 0)    return 'past';
  if (start <= 0) return 'current';
  return 'upcoming';
}

function renderHome() {
  const list = document.getElementById('holiday-list');
  list.innerHTML = '';

  const active = state.holidays.filter(h => effectiveStatus(h) === 'current');
  const upcoming = state.holidays.filter(h => effectiveStatus(h) === 'upcoming');
  const ideas  = state.holidays.filter(h => effectiveStatus(h) === 'idea');
  const past   = state.holidays.filter(h => effectiveStatus(h) === 'past').reverse();

  if (active.length) {
    const lbl = document.createElement('div');
    lbl.className = 'home-section-label';
    lbl.textContent = '🌴 Happening now';
    list.appendChild(lbl);
    active.forEach(h => list.appendChild(buildBanner(h)));
  }

  if (upcoming.length) {
    const lbl = document.createElement('div');
    lbl.className = 'home-section-label';
    lbl.textContent = '✈️ Upcoming';
    list.appendChild(lbl);
    upcoming.forEach(h => list.appendChild(buildBanner(h)));
  }

  if (ideas.length) {
    const lbl = document.createElement('div');
    lbl.className = 'home-section-label';
    lbl.textContent = '💡 Ideas';
    list.appendChild(lbl);
    ideas.forEach(h => list.appendChild(buildBanner(h)));
  }

  if (past.length) {
    const lbl = document.createElement('div');
    lbl.className = 'home-section-label';
    lbl.textContent = '📷 Past';
    list.appendChild(lbl);
    past.forEach(h => list.appendChild(buildBanner(h)));
  }

  if (!state.holidays.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌍</div>
        <p>No holidays yet — tap + to add one</p>
      </div>`;
  }
}

function buildBanner(h) {
  const status = effectiveStatus(h);
  const card = document.createElement('div');
  card.className = `holiday-banner ${status}`;

  const days = h.depart_date ? daysUntil(h.depart_date) : null;
  let badge = '';
  if (status === 'upcoming' && days !== null) {
    const label = days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days} days`;
    const cls   = days <= 1 ? 'today' : '';
    badge = `<span class="countdown-badge ${cls}">${label}</span>`;
  }
  if (status === 'idea')    badge = `<span class="status-badge idea">Idea</span>`;
  if (status === 'current') badge = `<span class="status-badge current">Now</span>`;

  const dateStr = h.depart_date
    ? `${formatDateShort(h.depart_date)}${h.return_date ? ' – ' + formatDateShort(h.return_date) : ''}`
    : '';

  card.innerHTML = `
    <span class="banner-emoji">${h.emoji || '✈️'}</span>
    <div class="banner-info">
      <div class="banner-name">${escHtml(h.name)}</div>
      <div class="banner-dest">${escHtml(h.destination)}${h.country ? ', ' + escHtml(h.country) : ''}</div>
      ${dateStr ? `<div class="banner-dates">${dateStr}</div>` : ''}
    </div>
    <div class="banner-right">
      ${badge}
      <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>`;

  card.addEventListener('click', () => { location.hash = `#/h/${h.id}`; });
  return card;
}

// ── DETAIL SCREEN ─────────────────────────────────────────────────────────────

async function showDetail(id) {
  state.screen   = 'detail';
  state.holidayId = id;
  state.tab       = 'plan';

  screenHome.classList.add('hidden');
  screenDetail.classList.remove('hidden');
  document.body.classList.add('has-tabs');

  document.getElementById('panel-plan').innerHTML    = '<div class="loading">Loading…</div>';
  document.getElementById('detail-title').textContent = '…';

  const [hRes, dRes, docRes, packRes, ancRes] = await Promise.all([
    db.from('holidays').select('*').eq('id', id).single(),
    db.from('holiday_days').select('*').eq('holiday_id', id).order('day_date'),
    db.from('holiday_documents').select('*').eq('holiday_id', id),
    db.from('holiday_packing').select('*').eq('holiday_id', id).order('category').order('item'),
    db.from('holiday_ancillaries').select('*').eq('holiday_id', id).order('day_date', { nullsFirst: false }),
  ]);

  state.holiday     = hRes.data;
  state.days        = dRes.data  || [];
  state.docs        = docRes.data || [];
  state.packing     = packRes.data || [];
  state.ancillaries = ancRes.data  || [];

  document.getElementById('detail-title').textContent = `${state.holiday.emoji || '✈️'} ${state.holiday.name}`;

  setDetailTab('plan');
}

function setDetailTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.detail-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('hidden', p.dataset.tab !== tab));
  if (tab === 'plan')    renderPlan();
  if (tab === 'docs')    renderDocs();
  if (tab === 'packing') renderPacking();
  if (tab === 'todo')    renderTodo();
  if (tab === 'weather') renderWeather();
}

// ── PLAN TAB ──────────────────────────────────────────────────────────────────

// Notes are the trip's "one place": a short offline-readable summary with the links
// out (artifact, travel agent's Drive folder, hotel). Plain text; URLs become links,
// "- " lines become bullets, blank lines separate paragraphs.
function renderNotes(text) {
  if (!text) return '';
  const link = s => escHtml(s).replace(/https?:\/\/[^\s<]+/g, u => {
    const label = u.replace(/^https?:\/\//, '').replace(/\/$/, '');
    return `<a href="${u}" target="_blank" rel="noopener">${label.length > 48 ? label.slice(0, 45) + '…' : label}</a>`;
  });
  return text.split(/\n{2,}/).map(block => {
    // Within a block: runs of "- " lines become a list, the other lines a paragraph.
    // A single plain line right before a list reads as its heading.
    const lines = block.split('\n');
    let out = '', para = [], list = [];
    const flushPara = () => { if (para.length) { out += `<p>${para.map(link).join('<br>')}</p>`; para = []; } };
    const flushList = () => { if (list.length) { out += `<ul>${list.map(l => `<li>${link(l)}</li>`).join('')}</ul>`; list = []; } };
    lines.forEach(l => {
      const m = l.match(/^\s*-\s+(.*)$/);
      if (m) { if (para.length === 1 && !list.length) { out += `<p class="notes-head">${link(para[0])}</p>`; para = []; } flushPara(); list.push(m[1]); }
      else   { flushList(); para.push(l); }
    });
    flushPara(); flushList();
    return out;
  }).join('');
}

function renderPlan() {
  const panel = document.getElementById('panel-plan');
  const h = state.holiday;
  const dates = h.depart_date
    ? `${formatDate(h.depart_date)}${h.return_date ? ' – ' + formatDate(h.return_date) : ''}`
    : 'No dates yet';

  const infoHtml = `
    <div class="trip-info">
      <div class="trip-info-head">
        <div>
          <div class="trip-info-dest">${escHtml(h.destination)}${h.country ? ', ' + escHtml(h.country) : ''}</div>
          <div class="trip-info-dates">${dates}</div>
        </div>
        <button class="fab-inline" onclick="openNotes()">✏️ Edit</button>
      </div>
      ${h.notes ? `<div class="trip-notes">${renderNotes(h.notes)}</div>`
                : `<div class="slot-empty">No notes yet — add the links and the essentials here.</div>`}
    </div>`;

  if (!state.days.length) {
    panel.innerHTML = infoHtml + `
      <div class="empty-state small">
        <p>No day-by-day plan. Paste an itinerary and Claude will structure it.</p>
        <button class="btn-secondary" onclick="openModal('modal-paste')">Paste itinerary</button>
      </div>`;
    return;
  }

  panel.innerHTML = infoHtml + `
    <div class="plan-actions">
      <button class="btn-secondary" onclick="openModal('modal-paste')">Re-paste itinerary</button>
      <span class="plan-legend"><i class="tl-dot planned"></i> booked <i class="tl-dot to_book"></i> idea / to book</span>
    </div>
    <div id="day-cards"></div>`;

  const container = document.getElementById('day-cards');
  let prevAccom = null;
  state.days.forEach((day, i) => {
    const accomChanged = day.accommodation !== prevAccom;
    prevAccom = day.accommodation;
    let nights = 0;
    for (let j = i; j < state.days.length && state.days[j].accommodation === day.accommodation; j++) nights++;
    container.appendChild(buildDayCard(day, accomChanged, nights));
  });
}

// A day is one compact box: date, where we sleep (only when it changes), then
// the filled slots as a timeline — a coloured dot per slot = its status (tap to
// cycle), URLs in a slot or in the day notes become link chips at the foot
// (a claude.ai artifact shows as "Artifact"). ✎ opens the day for editing.
const URL_RE = /https?:\/\/[^\s<)]+/g;

function linkChip(u) {
  const label = /claude\.ai\//.test(u) ? '📎 Artifact'
              : u.replace(/^https?:\/\/(www\.)?/, '').split(/[/?#]/)[0];
  return `<a class="link-chip" href="${escHtml(u)}" target="_blank" rel="noopener">${escHtml(label)}</a>`;
}

function stripUrls(text) { return (text || '').replace(URL_RE, '').replace(/\s{2,}/g, ' ').trim(); }

function buildDayCard(day, accomChanged, nights) {
  const d = new Date(day.day_date + 'T00:00:00');
  const dow  = d.toLocaleDateString('en-GB', { weekday: 'short' });
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const urls = [];
  const rows = SLOT_SLOTS.filter(s => day[s]).map(slot => {
    const status = day[`${slot}_status`] || 'free';
    (day[slot].match(URL_RE) || []).forEach(u => urls.push(u));
    return `
      <div class="tl-row">
        <button class="tl-dot ${status}" title="${status.replace('_', ' ')}" onclick="cycleSlotStatus('${day.id}','${slot}')"></button>
        <span class="tl-icon">${SLOT_ICONS[slot]}</span>
        <span class="tl-text">${escHtml(stripUrls(day[slot]))}</span>
      </div>`;
  }).join('');
  ((day.notes || '').match(URL_RE) || []).forEach(u => urls.push(u));
  const noteText = stripUrls(day.notes);

  const card = document.createElement('div');
  card.className = 'day-card';
  card.innerHTML = `
    <div class="day-header">
      <span class="day-date"><span class="day-dow">${dow}</span> ${date}</span>
      <span class="day-label">Day ${day.day_number}</span>
      <button class="day-edit" onclick="openDayEdit('${day.id}')" aria-label="Edit day">✎</button>
    </div>
    ${day.accommodation && accomChanged ? `<div class="day-accom">🏨 ${escHtml(day.accommodation)}${day.accommodation_city ? ' · ' + escHtml(day.accommodation_city) : ''}${nights > 1 ? ` <span class="day-nights">${nights} nights</span>` : ''}</div>` : ''}
    ${rows || `<div class="tl-empty">Nothing planned yet</div>`}
    ${noteText ? `<div class="day-note">${escHtml(noteText)}</div>` : ''}
    ${urls.length ? `<div class="day-links">${[...new Set(urls)].map(linkChip).join('')}</div>` : ''}`;
  return card;
}

async function cycleSlotStatus(dayId, slot) {
  const day = state.days.find(d => d.id === dayId);
  if (!day) return;
  const cycle = ['free', 'to_book', 'planned'];
  const next  = cycle[(cycle.indexOf(day[`${slot}_status`] || 'free') + 1) % 3];
  await db.from('holiday_days').update({ [`${slot}_status`]: next }).eq('id', dayId);
  day[`${slot}_status`] = next;
  renderPlan();
}

// ── EDIT DAY ──────────────────────────────────────────────────────────────────

function openDayEdit(dayId) {
  const day = state.days.find(d => d.id === dayId);
  if (!day) return;
  state.editDayId = dayId;
  document.getElementById('day-edit-title').textContent =
    new Date(day.day_date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  document.getElementById('de-accom').value = day.accommodation || '';
  document.getElementById('de-city').value  = day.accommodation_city || '';
  SLOT_SLOTS.forEach(s => { document.getElementById(`de-${s}`).value = day[s] || ''; });
  document.getElementById('de-notes').value = day.notes || '';
  openModal('modal-day-edit');
}

async function saveDayEdit() {
  const day = state.days.find(d => d.id === state.editDayId);
  if (!day) return;
  const patch = {
    accommodation:      document.getElementById('de-accom').value.trim() || null,
    accommodation_city: document.getElementById('de-city').value.trim()  || null,
    notes:              document.getElementById('de-notes').value.trim() || null,
  };
  SLOT_SLOTS.forEach(s => {
    const v = document.getElementById(`de-${s}`).value.trim() || null;
    patch[s] = v;
    // a slot that gets text for the first time starts as "to book" until she says otherwise
    if (v && !day[s] && (day[`${s}_status`] || 'free') === 'free') patch[`${s}_status`] = 'to_book';
    if (!v) patch[`${s}_status`] = 'free';
  });
  const { error } = await db.from('holiday_days').update(patch).eq('id', day.id);
  if (error) { alert('Could not save — ' + (error.message || 'are you online?')); return; }
  Object.assign(day, patch);
  closeModal('modal-day-edit');
  renderPlan();
}

// ── NOTES ─────────────────────────────────────────────────────────────────────

function openNotes() {
  document.getElementById('notes-textarea').value = state.holiday.notes || '';
  openModal('modal-notes');
}

async function saveNotes() {
  const notes = document.getElementById('notes-textarea').value.trim() || null;
  const { error } = await db.from('holidays').update({ notes }).eq('id', state.holidayId);
  if (error) { alert('Could not save — are you online?'); return; }
  state.holiday.notes = notes;
  closeModal('modal-notes');
  renderPlan();
}

// ── PASTE + PARSE ─────────────────────────────────────────────────────────────

async function submitPaste() {
  const text = document.getElementById('itinerary-textarea').value.trim();
  if (!text) return;

  const btn = document.getElementById('parse-btn');
  btn.textContent = '✨ Parsing…';
  btn.disabled = true;

  await db.from('holidays').update({ itinerary_raw: text }).eq('id', state.holidayId);
  state.holiday.itinerary_raw = text;

  try {
    const res = await fetch(EDGE_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON}` },
      body: JSON.stringify({ action: 'parse_itinerary', holiday_id: state.holidayId }),
    });
    if (!res.ok) throw new Error();

    const { data } = await db.from('holiday_days').select('*').eq('holiday_id', state.holidayId).order('day_date');
    state.days = data || [];
    closeModal('modal-paste');
    renderPlan();
  } catch {
    alert('Could not parse itinerary — please try again.');
  } finally {
    btn.textContent = '✨ Parse with Claude';
    btn.disabled = false;
  }
}

// ── DOCS TAB ──────────────────────────────────────────────────────────────────

function renderDocs() {
  const panel = document.getElementById('panel-docs');
  const DOC_ICONS = { have: '✅', needed: '⚠️', na: '➖' };

  const byPerson = {};
  state.docs.forEach(d => {
    const key = d.person || 'all';
    if (!byPerson[key]) byPerson[key] = [];
    byPerson[key].push(d);
  });

  let html = `<div style="margin-bottom:4px"><button class="fab-inline" onclick="openModal('modal-add-doc')">+ Add document</button></div>`;

  if (!state.docs.length) {
    html += `<div class="empty-state small"><p>No documents added yet</p></div>`;
  } else {
    const order = ['all', ...['Astrid','Niko','Max','Alex','Vicky'].filter(m => byPerson[m])];
    order.forEach(person => {
      if (!byPerson[person]) return;
      html += `<div class="section-label">${person === 'all' ? 'Everyone' : person}</div>`;
      byPerson[person].forEach(doc => {
        html += `
          <div class="list-card">
            <div class="card-main">
              <span class="status-icon">${DOC_ICONS[doc.status] || '❓'}</span>
              <div class="card-info">
                <div class="card-title">${escHtml(doc.title)}</div>
                ${doc.notes    ? `<div class="card-meta">${escHtml(doc.notes)}</div>` : ''}
                ${doc.deadline ? `<div class="card-meta">By ${formatDate(doc.deadline)}</div>` : ''}
              </div>
              <div class="card-actions">
                <select class="status-select" onchange="updateDocStatus('${doc.id}',this.value)">
                  <option value="needed" ${doc.status==='needed'?'selected':''}>Needed</option>
                  <option value="have"   ${doc.status==='have'  ?'selected':''}>Have ✅</option>
                  <option value="na"     ${doc.status==='na'    ?'selected':''}>N/A</option>
                </select>
                <button class="del-btn-sm" onclick="deleteDoc('${doc.id}')">🗑</button>
              </div>
            </div>
          </div>`;
      });
    });
  }
  panel.innerHTML = html;
}

async function updateDocStatus(id, status) {
  await db.from('holiday_documents').update({ status }).eq('id', id);
  const doc = state.docs.find(d => d.id === id);
  if (doc) { doc.status = status; renderDocs(); }
}

async function deleteDoc(id) {
  await db.from('holiday_documents').delete().eq('id', id);
  state.docs = state.docs.filter(d => d.id !== id);
  renderDocs();
}

async function saveDoc() {
  const title    = document.getElementById('doc-title').value.trim();
  const doc_type = document.getElementById('doc-type').value;
  const person   = document.getElementById('doc-person').value;
  const notes    = document.getElementById('doc-notes').value.trim();
  const deadline = document.getElementById('doc-deadline').value;
  if (!title) return;

  const { data } = await db.from('holiday_documents').insert({
    holiday_id: state.holidayId, title, doc_type, person,
    notes: notes || null, deadline: deadline || null, status: 'needed',
  }).select().single();

  if (data) {
    state.docs.push(data);
    renderDocs();
    closeModal('modal-add-doc');
    ['doc-title','doc-notes','doc-deadline'].forEach(id => { document.getElementById(id).value = ''; });
  }
}

// ── PACKING TAB ───────────────────────────────────────────────────────────────
// One list per person (plus "Shared" for household things). Each person ticks
// what is packed, adds what is missing from the list, marks what they do not own
// (🛒 → the To-buy view = the shopping list) and removes what does not apply —
// a removed item stays visible under "Removed" so it can be brought back.
// Lists come from Astrid or from Claude in a session, never generated here.

const PACK_LS_KEY = 'hp-pack-person';
state.packPerson = (() => { try { return localStorage.getItem(PACK_LS_KEY) || 'Astrid'; } catch { return 'Astrid'; } })();

function setPackPerson(p) {
  state.packPerson = p;
  try { localStorage.setItem(PACK_LS_KEY, p); } catch {}
  renderPacking();
}

function renderPacking() {
  const panel = document.getElementById('panel-packing');
  const live  = state.packing.filter(p => !p.deleted);
  const toBuy = live.filter(p => p.to_buy);
  const who   = state.packPerson;

  const chips = [...PEOPLE.map(p => [p, p]), ['all', 'Shared'], ['buy', `🛒 To buy${toBuy.length ? ' ' + toBuy.length : ''}`]];
  let html = `<div class="chip-row">${chips.map(([id, label]) =>
    `<button class="chip ${who === id ? 'active' : ''} ${id === 'buy' && toBuy.length ? 'buy' : ''}" onclick="setPackPerson('${id}')">${label}</button>`).join('')}</div>`;

  if (who === 'buy') {
    html += `<p class="pack-hint">Everything anyone marked 🛒 as not owned. Tap “Got it” once bought.</p>`;
    if (!toBuy.length) html += `<div class="empty-state small"><p>Nothing to buy.</p></div>`;
    ['all', ...PEOPLE].forEach(person => {
      const items = toBuy.filter(p => (p.person || 'all') === person);
      if (!items.length) return;
      html += `<div class="section-label">${person === 'all' ? 'Shared' : person}</div>`;
      items.forEach(item => { html += `
        <div class="packing-card">
          <div class="packing-info"><span class="packing-name">${escHtml(item.item)}</span></div>
          <button class="pill-btn" onclick="setToBuy('${item.id}', false)">Got it ✓</button>
        </div>`; });
    });
    panel.innerHTML = html;
    return;
  }

  const mine    = live.filter(p => (p.person || 'all') === who);
  const removed = state.packing.filter(p => p.deleted && (p.person || 'all') === who);
  const done    = mine.filter(p => p.checked).length;

  html += `
    <div class="packing-actions">
      <button class="btn-primary" onclick="openPackingAdd()">+ Add items</button>
      <span class="pack-progress">${mine.length ? `${done}/${mine.length} packed` : ''}</span>
    </div>`;

  if (!mine.length && !removed.length) {
    html += `<div class="empty-state small"><p>No list for ${who === 'all' ? 'shared items' : who} yet — add items, or ask Claude for a starter list.</p></div>`;
  }

  const byCat = {};
  mine.forEach(item => { (byCat[item.category] = byCat[item.category] || []).push(item); });
  Object.keys(CAT_EMOJIS).filter(c => byCat[c]).concat(Object.keys(byCat).filter(c => !CAT_EMOJIS[c])).forEach(cat => {
    html += `<div class="section-label">${CAT_EMOJIS[cat] || '📦'} ${cat.charAt(0).toUpperCase() + cat.slice(1)}</div>`;
    byCat[cat].forEach(item => { html += packingCard(item); });
  });

  if (removed.length) {
    html += `<details class="removed-group"><summary>Removed (${removed.length})</summary>${removed.map(item => `
      <div class="packing-card removed">
        <div class="packing-info"><span class="packing-name strikethrough">${escHtml(item.item)}</span></div>
        <button class="pill-btn" onclick="setDeleted('${item.id}', false)">Bring back</button>
      </div>`).join('')}</details>`;
  }

  panel.innerHTML = html;
}

function packingCard(item) {
  return `
    <div class="packing-card ${item.checked ? 'checked' : ''} ${item.to_buy ? 'to-buy' : ''}">
      <button class="check-circle ${item.checked ? 'done' : ''}" onclick="togglePacking('${item.id}')">${item.checked ? '✓' : ''}</button>
      <div class="packing-info">
        <span class="packing-name ${item.checked ? 'strikethrough' : ''}">${escHtml(item.item)}</span>
        ${item.to_buy ? `<span class="packing-buy">🛒 not owned — on the shopping list</span>` : ''}
      </div>
      <button class="icon-btn ${item.to_buy ? 'active' : ''}" title="Don't own it" onclick="setToBuy('${item.id}', ${!item.to_buy})">🛒</button>
      <button class="icon-btn" title="Remove from my list" onclick="setDeleted('${item.id}', true)">✕</button>
    </div>`;
}

async function patchPacking(id, patch) {
  const item = state.packing.find(p => p.id === id);
  if (!item) return;
  const { error } = await db.from('holiday_packing').update(patch).eq('id', id);
  if (error) { alert('Could not save — ' + (error.message || 'are you online?')); return; }
  Object.assign(item, patch);
  renderPacking();
}
const togglePacking = id => patchPacking(id, { checked: !state.packing.find(p => p.id === id)?.checked });
const setToBuy      = (id, v) => patchPacking(id, { to_buy: v });
const setDeleted    = (id, v) => patchPacking(id, { deleted: v });

function openPackingAdd() {
  const sel = document.getElementById('pack-person');
  sel.value = state.packPerson === 'buy' ? 'all' : state.packPerson;
  openModal('modal-add-packing');
}

// One item per line, into the list of the person chosen in the modal.
async function savePacking() {
  const lines    = document.getElementById('pack-items').value.split('\n').map(s => s.trim()).filter(Boolean);
  const category = document.getElementById('pack-category').value;
  const person   = document.getElementById('pack-person').value;
  if (!lines.length) return;

  const rows = lines.map(item => ({
    holiday_id: state.holidayId, item, category, person,
    reason: null, is_obvious: true, checked: false, ai_generated: false, to_buy: false, deleted: false,
  }));
  const { data, error } = await db.from('holiday_packing').insert(rows).select();
  if (error) { alert('Could not save — ' + (error.message || 'are you online?')); return; }

  state.packing.push(...data);
  closeModal('modal-add-packing');
  document.getElementById('pack-items').value = '';
  setPackPerson(person);
}

// ── TO-DO TAB ─────────────────────────────────────────────────────────────────

function renderTodo() {
  const panel = document.getElementById('panel-todo');
  const toBook      = state.ancillaries.filter(a => a.status === 'to_book');
  const considering = state.ancillaries.filter(a => a.status === 'considering');
  const booked      = state.ancillaries.filter(a => a.status === 'booked');

  let html = `<div style="margin-bottom:4px"><button class="fab-inline" onclick="openModal('modal-add-ancillary')">+ Add item</button></div>`;

  if (!state.ancillaries.length) {
    html += `<div class="empty-state small"><p>Nothing to track yet — add restaurants, activities, transfers…</p></div>`;
  } else {
    if (toBook.length) {
      html += `<div class="section-label urgent">⚠️ Still to book</div>`;
      toBook.forEach(a => { html += ancillaryCard(a); });
    }
    if (considering.length) {
      html += `<div class="section-label">🤔 Considering</div>`;
      considering.forEach(a => { html += ancillaryCard(a); });
    }
    if (booked.length) {
      html += `<div class="section-label">✅ Booked</div>`;
      booked.forEach(a => { html += ancillaryCard(a); });
    }
  }
  panel.innerHTML = html;
}

function ancillaryCard(a) {
  return `
    <div class="list-card">
      <div class="card-main">
        <span class="type-icon">${ANC_ICONS[a.type] || '📌'}</span>
        <div class="card-info">
          <div class="card-title">${escHtml(a.name)}</div>
          ${a.day_date ? `<div class="card-meta">${formatDate(a.day_date)}</div>` : ''}
          ${a.notes    ? `<div class="card-meta">${escHtml(a.notes)}</div>` : ''}
        </div>
        <div class="card-actions">
          <select class="status-select" onchange="updateAncillaryStatus('${a.id}',this.value)">
            <option value="to_book"     ${a.status==='to_book'    ?'selected':''}>To book</option>
            <option value="considering" ${a.status==='considering'?'selected':''}>Considering</option>
            <option value="booked"      ${a.status==='booked'     ?'selected':''}>Booked ✅</option>
          </select>
          <button class="del-btn-sm" onclick="deleteAncillary('${a.id}')">🗑</button>
        </div>
      </div>
    </div>`;
}

async function updateAncillaryStatus(id, status) {
  await db.from('holiday_ancillaries').update({ status }).eq('id', id);
  const a = state.ancillaries.find(a => a.id === id);
  if (a) { a.status = status; renderTodo(); }
}

async function deleteAncillary(id) {
  await db.from('holiday_ancillaries').delete().eq('id', id);
  state.ancillaries = state.ancillaries.filter(a => a.id !== id);
  renderTodo();
}

async function saveAncillary() {
  const name     = document.getElementById('anc-name').value.trim();
  const type     = document.getElementById('anc-type').value;
  const day_date = document.getElementById('anc-date').value;
  const status   = document.getElementById('anc-status').value;
  const notes    = document.getElementById('anc-notes').value.trim();
  if (!name) return;

  const { data } = await db.from('holiday_ancillaries').insert({
    holiday_id: state.holidayId, name, type,
    day_date: day_date || null, status, notes: notes || null,
  }).select().single();

  if (data) {
    state.ancillaries.push(data);
    renderTodo();
    closeModal('modal-add-ancillary');
    ['anc-name','anc-notes','anc-date'].forEach(id => { document.getElementById(id).value = ''; });
  }
}

// ── WEATHER TAB ───────────────────────────────────────────────────────────────

async function renderWeather() {
  const panel = document.getElementById('panel-weather');
  if (!state.holiday.depart_date) {
    panel.innerHTML = `<div class="empty-state"><p>Set a departure date to see weather</p></div>`;
    return;
  }

  panel.innerHTML = '<div class="loading">Fetching weather…</div>';

  try {
    const geoRes  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(state.holiday.destination)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();

    if (!geoData.results?.length) {
      panel.innerHTML = `<div class="empty-state"><p>Couldn't find "${state.holiday.destination}" — try a nearby major city</p></div>`;
      return;
    }

    const { latitude, longitude, name, country } = geoData.results[0];
    const daysAway = daysUntil(state.holiday.depart_date);

    if (daysAway > 16) {
      panel.innerHTML = `
        <div class="weather-unavailable">
          <div class="weather-icon-big">🌍</div>
          <div class="weather-unavailable-msg">
            <strong>${escHtml(name)}, ${escHtml(country)}</strong><br><br>
            Forecast available in <strong>${daysAway - 16} days</strong><br>
            <span class="muted">Weather forecasts only go 16 days ahead</span>
          </div>
        </div>`;
      return;
    }

    const start = state.holiday.depart_date;
    const end   = state.holiday.return_date || state.holiday.depart_date;
    const fRes  = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode` +
      `&timezone=auto&start_date=${start}&end_date=${end}&forecast_days=16`
    );
    const f = await fRes.json();
    const { time, temperature_2m_max, temperature_2m_min, precipitation_sum, weathercode } = f.daily;

    let html = `<div class="weather-location">📍 ${escHtml(name)}, ${escHtml(country)}</div><div class="weather-days">`;
    time.forEach((date, i) => {
      const dayName = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      html += `
        <div class="weather-day">
          <div class="weather-day-name">${dayName}</div>
          <div class="weather-day-icon">${wmoIcon(weathercode[i])}</div>
          <div class="weather-temps">
            <span class="temp-max">${Math.round(temperature_2m_max[i])}°</span>
            <span class="temp-min">${Math.round(temperature_2m_min[i])}°</span>
          </div>
          ${precipitation_sum[i] > 0.5 ? `<div class="weather-rain">💧 ${precipitation_sum[i].toFixed(1)}mm</div>` : ''}
        </div>`;
    });
    html += '</div>';
    panel.innerHTML = html;
  } catch {
    panel.innerHTML = `<div class="empty-state"><p>Couldn't load weather — check your connection</p></div>`;
  }
}

// ── MODALS ────────────────────────────────────────────────────────────────────

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

async function saveHoliday() {
  const name    = document.getElementById('h-name').value.trim();
  const dest    = document.getElementById('h-dest').value.trim();
  const country = document.getElementById('h-country').value.trim();
  const emoji   = document.getElementById('h-emoji').value.trim() || '✈️';
  const status  = document.getElementById('h-status').value;
  const depart  = document.getElementById('h-depart').value;
  const ret     = document.getElementById('h-return').value;
  if (!name || !dest) return;

  const { data } = await db.from('holidays').insert({
    name, destination: dest, country: country || null, emoji, status,
    depart_date: depart || null, return_date: ret || null,
  }).select().single();

  if (data) {
    state.holidays.push(data);
    renderHome();
    closeModal('modal-add-holiday');
    ['h-name','h-dest','h-country','h-emoji','h-depart','h-return'].forEach(id => { document.getElementById(id).value = ''; });
  }
}

// ── BOOT ──────────────────────────────────────────────────────────────────────

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');

// Build detail tab bar
[
  { id: 'plan',    icon: '🧭', label: 'Trip' },
  { id: 'packing', icon: '🎒', label: 'Packing' },
  { id: 'todo',    icon: '✅', label: 'To-Do' },
  { id: 'docs',    icon: '📋', label: 'Docs' },
  { id: 'weather', icon: '☀️', label: 'Weather' },
].forEach(t => {
  const btn = document.createElement('button');
  btn.className = 'detail-tab-btn';
  btn.dataset.tab = t.id;
  btn.innerHTML = `<span class="tab-icon">${t.icon}</span><span>${t.label}</span>`;
  btn.addEventListener('click', () => setDetailTab(t.id));
  document.getElementById('detail-tab-bar').appendChild(btn);
});

// Back button
document.getElementById('back-btn').addEventListener('click', () => { location.hash = '#/'; });

// FAB
document.getElementById('fab-home').addEventListener('click', () => openModal('modal-add-holiday'));

// Close modals on backdrop click
['modal-add-holiday','modal-paste','modal-notes','modal-add-doc','modal-add-packing','modal-add-ancillary','modal-day-edit'].forEach(id => {
  document.getElementById(id).addEventListener('click', e => { if (e.target.id === id) closeModal(id); });
});

// Start
window.addEventListener('hashchange', route);
route();
