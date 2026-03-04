'use strict';

/* ─── State ───────────────────────────────────────────────────── */
const STORAGE_KEY  = 'formulae_v1';
const DARKROOM_KEY = 'formulae_darkroom';
const LAST_EXPORT_KEY = 'formulae_last_export';
const LAST_REMINDER_KEY = 'formulae_last_reminder';
const VIEW_MODE_KEY = 'formulae_view_mode';
let db            = [];
let editingId     = null;
let confirmCallback = null;
let dragSrcIdx    = null;
let viewMode      = 'grid';
let currentDetailId = null;
let backupReminderShown = false;

/* ─── Utilities ──────────────────────────────────────────────── */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function processClass(p) {
  const map = {
    'B&W':'bw','C-41':'c41','ECN-2':'ecn2',
    'E-6':'e6','Ambrotype':'ambrotype','Tintype':'tintype','Dryplate':'dryplate','Fixer':'fixer'
  };
  return 'badge-' + (map[p] || 'other');
}

function statusClass(s) {
  const map = { Tested:'tested', Experimental:'experimental', Archived:'archived' };
  return 'status-' + (map[s] || 'experimental');
}

/* ─── Seed data (inside a function so uid() is defined first) ── */
function makeSeed() {
  return [
    {
      id: uid(), name: "D-76 Stock",
      process: "B&W", category: "Developer", status: "Tested", version: "1.0",
      desc: "Kodak's classic general-purpose film developer. Gives full emulsion speed with fine grain.",
      ingredients: [
        { name: "Water (52°C / 125°F)", qty: "750", unit: "ml" },
        { name: "Metol", qty: "2", unit: "g" },
        { name: "Sodium Sulfite (anhydrous)", qty: "100", unit: "g" },
        { name: "Hydroquinone", qty: "5", unit: "g" },
        { name: "Borax", qty: "2", unit: "g" },
        { name: "Water to make", qty: "1000", unit: "ml" },
      ],
      temp: "20°C / 68°F", time: "8 min (stock), 11 min (1:1)",
      notes: "Mix in the order listed. Metol dissolves before adding Hydroquinone. Store in a full, tightly capped bottle.",
      updatedAt: Date.now() - 86400000 * 2,
    },
    {
      id: uid(), name: "Kodak C-41 Developer",
      process: "C-41", category: "Developer", status: "Experimental", version: "1.2",
      desc: "Color negative process CD-4 based developer formula for C-41 compatible films.",
      ingredients: [
        { name: "Water (38°C)", qty: "800", unit: "ml" },
        { name: "Hydroxylamine Sulfate", qty: "1.9", unit: "g" },
        { name: "Sodium Sulfite", qty: "4.25", unit: "g" },
        { name: "CD-4 (color developer)", qty: "4.75", unit: "g" },
        { name: "Sodium Carbonate (anhydrous)", qty: "37.5", unit: "g" },
        { name: "Potassium Bromide", qty: "1.2", unit: "g" },
        { name: "Water to make", qty: "1000", unit: "ml" },
      ],
      temp: "38°C ± 0.15°C / 100.4°F", time: "3:15 min",
      notes: "Extremely temperature sensitive. Use a water bath. Adjust pH to 10.03 with sodium hydroxide or acetic acid.",
      updatedAt: Date.now() - 86400000 * 5,
    },
    {
      id: uid(), name: "TF-4 Alkaline Fixer",
      process: "B&W", category: "Fixer", status: "Tested", version: "2.0",
      desc: "Rapid archival alkaline fixer for film and paper. Ammonium thiosulfate based.",
      ingredients: [
        { name: "Water", qty: "800", unit: "ml" },
        { name: "Ammonium Thiosulfate (60% sol.)", qty: "200", unit: "ml" },
        { name: "Sodium Sulfite", qty: "15", unit: "g" },
        { name: "Sodium Bicarbonate", qty: "8.5", unit: "g" },
        { name: "Water to make", qty: "1000", unit: "ml" },
      ],
      temp: "18–24°C", time: "2–4 min (film), 1–2 min (RC paper)",
      notes: "pH should be 7.5–8.0. Non-hardening, safe for rapid washing. Discard when grey or fixes slowly.",
      updatedAt: Date.now() - 86400000 * 1,
    },
    {
      id: uid(), name: "E-6 First Developer",
      process: "E-6", category: "Developer", status: "Experimental", version: "1.0",
      desc: "First developer for the E-6 reversal slide process. Critical step — controls overall density.",
      ingredients: [
        { name: "Water (38°C)", qty: "700", unit: "ml" },
        { name: "Sodium Sulfite", qty: "30", unit: "g" },
        { name: "Phenidone", qty: "0.3", unit: "g" },
        { name: "Hydroquinone", qty: "6", unit: "g" },
        { name: "Sodium Carbonate", qty: "18", unit: "g" },
        { name: "Potassium Bromide", qty: "1.5", unit: "g" },
        { name: "Potassium Thiocyanate", qty: "1.0", unit: "g" },
        { name: "Water to make", qty: "1000", unit: "ml" },
      ],
      temp: "38°C ± 0.15°C", time: "6 min",
      notes: "Do not expose to light after this step. Temperature control is critical. Replenish at 11 ml/roll.",
      updatedAt: Date.now() - 86400000 * 10,
    },
    {
      id: uid(), name: "Ambrotype Collodion Developer",
      process: "Ambrotype", category: "Developer", status: "Tested", version: "3.1",
      desc: "Pyrogallic acid developer for collodion ambrotypes and tintypes.",
      ingredients: [
        { name: "Distilled Water", qty: "1000", unit: "ml" },
        { name: "Pyrogallic Acid", qty: "1", unit: "g" },
        { name: "Glacial Acetic Acid", qty: "30", unit: "ml" },
      ],
      temp: "Ambient (18–22°C recommended)", time: "10–30 seconds (to taste)",
      notes: "Develop in strong raking light. Pyrogallol stains skin — use gloves. Discard after each plate.",
      updatedAt: Date.now(),
    },
  ];
}

/* ─── Persistence ────────────────────────────────────────────── */
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) { db = makeSeed(); save(); return; }
    db = JSON.parse(raw);
  } catch { db = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

/* ─── Darkroom ───────────────────────────────────────────────── */
function updateDarkroomBtn(on) {
  document.getElementById('dr-icon').textContent  = on ? '💡' : '��';
  document.getElementById('dr-label').textContent = on ? 'Normal' : 'Darkroom';
}

function toggleDarkroom() {
  document.body.classList.toggle('darkroom');
  const on = document.body.classList.contains('darkroom');
  updateDarkroomBtn(on);
  localStorage.setItem(DARKROOM_KEY, on ? '1' : '');
}

/* ─── View toggle ────────────────────────────────────────────── */
function toggleView() {
  viewMode = viewMode === 'grid' ? 'list' : 'grid';
  localStorage.setItem(VIEW_MODE_KEY, viewMode);
  const btn = document.getElementById('view-toggle-btn');
  btn.textContent = viewMode === 'grid' ? '⊞ Grid' : '☰ List';
  renderCards();
}

/* ─── Stats bar ──────────────────────────────────────────────── */
function renderStats() {
  const total     = db.length;
  const tested    = db.filter(f => f.status === 'Tested').length;
  const processes = [...new Set(db.map(f => f.process))].length;
  document.getElementById('stats-bar').innerHTML =
    `<div class="stat-card" title="Total formulas stored locally in this browser."><span class="stat-icon">🎞</span><span class="stat-num">${total}</span><span class="stat-label">Formula${total !== 1 ? 's' : ''}</span></div>` +
    `<div class="stat-card"><span class="stat-icon">✅</span><span class="stat-num">${tested}</span><span class="stat-label">Tested</span></div>` +
    `<div class="stat-card"><span class="stat-icon">🧪</span><span class="stat-num">${processes}</span><span class="stat-label">Process${processes !== 1 ? 'es' : ''}</span></div>`;
}

/* ─── Cards rendering ────────────────────────────────────────── */
function getFiltered() {
  const q    = (document.getElementById('search-input').value || '').toLowerCase();
  const proc = document.getElementById('filter-process').value;
  const cat  = document.getElementById('filter-category').value;
  const stat = document.getElementById('filter-status').value;
  const sort = document.getElementById('sort-select').value;

  let list = db.filter(f => {
    if (proc && f.process  !== proc) return false;
    if (cat  && f.category !== cat)  return false;
    if (stat && f.status   !== stat) return false;
    if (q) {
      const blob = [
        f.name, f.process, f.category, f.desc, f.notes, f.temp, f.time,
        ...(f.ingredients || []).map(i => i.name),
      ].join(' ').toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });

  list.sort((a, b) => {
    if (sort === 'name')    return a.name.localeCompare(b.name);
    if (sort === 'process') return a.process.localeCompare(b.process);
    if (sort === 'version') return parseFloat(b.version||0) - parseFloat(a.version||0);
    return (b.updatedAt||0) - (a.updatedAt||0);
  });

  return list;
}

function renderCards() {
  renderStats();
  const list  = getFiltered();
  const grid  = document.getElementById('cards-grid');
  const empty = document.getElementById('empty-state');
  const rc    = document.getElementById('results-count');

  // Results count
  if (list.length < db.length) {
    rc.innerHTML = `<strong>${list.length}</strong> of ${db.length} formula${db.length !== 1 ? 's' : ''}`;
  } else {
    rc.textContent = '';
  }

  if (!list.length) {
    grid.innerHTML = '';
    empty.style.display = '';
    empty.innerHTML = db.length
      ? `<div class="empty-icon">🔍</div>
         <h2>No formulas match</h2>
         <p>Try adjusting your search or filters.</p>
         <button class="btn btn-secondary" onclick="clearFilters()">Clear filters</button>`
      : `<div class="empty-icon">⬛</div>
         <h2>No formulas yet</h2>
         <p>Create your first chemical formula to get started.</p>
         <button class="btn btn-primary" onclick="openModal()">+ New Formula</button>`;
    return;
  }

  empty.style.display = 'none';
  grid.className = viewMode === 'list' ? 'cards-list' : 'cards-grid';
  grid.innerHTML = list.map(f => cardHTML(f)).join('');
}

function cardHTML(f) {
  const ings   = f.ingredients || [];
  const preview = ings.slice(0, 4);
  const more    = ings.length - preview.length;

  const ingHTML = ings.length
    ? `<div class="ing-list">
         <div class="ing-list-title">Ingredients (${ings.length})</div>
         ${preview.map(i =>
           `<div class="ing-row">
              <span class="ing-name">${esc(i.name)}</span>
              <span class="ing-qty">${esc(i.qty)}${i.unit ? ' ' + esc(i.unit) : ''}</span>
            </div>`
         ).join('')}
         ${more > 0 ? `<div class="ing-more">+ ${more} more ingredient${more > 1 ? 's' : ''}</div>` : ''}
       </div>` : '';

  const colorStyle = f.color ? ` style="--card-accent: ${esc(f.color)}"` : '';
  return `<div class="card" data-process="${esc(f.process)}" id="card-${esc(f.id)}"${colorStyle} onclick="openDetail('${esc(f.id)}')">
    <div class="card-header">
      <div>
        <div class="card-title">${esc(f.name)}</div>
        <div class="card-version">v${esc(f.version||'1.0')} · ${esc(f.category)}</div>
      </div>
      <div class="card-actions" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" title="View details" onclick="openDetail('${esc(f.id)}')">↗</button>
        <button class="btn btn-ghost btn-sm" title="Edit" onclick="openModal('${esc(f.id)}')">✏</button>
        <button class="btn btn-ghost btn-sm" title="Duplicate" onclick="duplicate('${esc(f.id)}')">⧉</button>
        <button class="btn btn-ghost btn-sm" title="Delete" style="color:var(--danger)"
          onclick="confirmDelete('${esc(f.id)}')">✕</button>
      </div>
    </div>
    <div class="card-meta">
      <span class="badge ${processClass(f.process)}">${esc(f.process)}</span>
      <span class="status-badge ${statusClass(f.status)}">${esc(f.status)}</span>
      ${f.temp ? `<span style="font-size:.75rem;color:var(--muted)">🌡 ${esc(f.temp)}</span>` : ''}
    </div>
    ${f.desc ? `<div class="card-desc">${esc(f.desc)}</div>` : ''}
    ${ingHTML}
    ${f.notes ? `<div class="card-notes">${esc(f.notes)}</div>` : ''}
  </div>`;
}

/* ─── Build ingredient tables grouped by part ────────────────── */
function buildIngredientTables(ings) {
  const partA = ings.filter(i => i.part === 'A');
  const partB = ings.filter(i => i.part === 'B');
  const noPart = ings.filter(i => !i.part || (i.part !== 'A' && i.part !== 'B'));
  const hasParts = partA.length > 0 || partB.length > 0;

  let html = '';
  if (!hasParts) {
    html += `<table class="ing-table" id="ing-table-main">
      <thead><tr>
        <th>#</th><th>Chemical</th><th>Quantity</th><th>Unit</th><th class="scaled-col" id="scaled-header" style="display:none">Scaled</th>
      </tr></thead>
      <tbody id="ing-tbody">
        ${ings.map((i, idx) => `<tr>
          <td style="color:var(--muted)">${idx + 1}</td>
          <td>${esc(i.name)}</td>
          <td id="qty-${idx}">${esc(i.qty)}</td>
          <td style="color:var(--muted)">${esc(i.unit)}</td>
          <td class="scaled-col" id="scaled-${idx}" style="display:none">—</td>
        </tr>`).join('')}
      </tbody>
    </table>`;
  } else {
    // We use the original index in the ings array for scaling
    function tableByOrigIndex(items) {
      return items.map(i => {
        const idx = ings.indexOf(i);
        return `<tr>
          <td style="color:var(--muted)">${idx + 1}</td>
          <td>${esc(i.name)}</td>
          <td id="qty-${idx}">${esc(i.qty)}</td>
          <td style="color:var(--muted)">${esc(i.unit)}</td>
          <td class="scaled-col" id="scaled-${idx}" style="display:none">—</td>
        </tr>`;
      }).join('');
    }
    const thRow = `<thead><tr>
      <th>#</th><th>Chemical</th><th>Quantity</th><th>Unit</th><th class="scaled-col" id="scaled-header" style="display:none">Scaled</th>
    </tr></thead>`;

    if (noPart.length) {
      html += `<table class="ing-table" id="ing-table-main">${thRow}<tbody id="ing-tbody">${tableByOrigIndex(noPart)}</tbody></table>`;
    }
    if (partA.length) {
      html += `<div class="detail-section-title" style="margin-top:1rem">PART A</div>
        <table class="ing-table"${!noPart.length ? ' id="ing-table-main"' : ''}>${!noPart.length ? thRow : `<thead><tr><th>#</th><th>Chemical</th><th>Quantity</th><th>Unit</th><th class="scaled-col" style="display:none">Scaled</th></tr></thead>`}<tbody>${tableByOrigIndex(partA)}</tbody></table>`;
    }
    if (partB.length) {
      html += `<div class="detail-section-title" style="margin-top:1rem">PART B</div>
        <table class="ing-table"><thead><tr><th>#</th><th>Chemical</th><th>Quantity</th><th>Unit</th><th class="scaled-col" style="display:none">Scaled</th></tr></thead><tbody>${tableByOrigIndex(partB)}</tbody></table>`;
    }
  }
  return html;
}

/* ─── Detail panel ───────────────────────────────────────────── */
function openDetail(id) {
  const f = db.find(x => x.id === id);
  if (!f) return;
  currentDetailId = id;
  const ings = f.ingredients || [];

  document.getElementById('detail-content').innerHTML = `
    <div class="detail-actions">
      <button class="btn btn-secondary btn-sm" onclick="openModal('${esc(f.id)}')">✏ Edit</button>
      <button class="btn btn-secondary btn-sm" onclick="duplicate('${esc(f.id)}');closeDetail()">⧉ Duplicate</button>
      <button class="btn btn-danger btn-sm" onclick="confirmDelete('${esc(f.id)}',true)">✕ Delete</button>
    </div>
    <h1 class="detail-title">${esc(f.name)}</h1>
    <div class="detail-meta">
      <span class="badge ${processClass(f.process)}">${esc(f.process)}</span>
      <span class="status-badge ${statusClass(f.status)}">${esc(f.status)}</span>
      <span style="color:var(--muted);font-size:.85rem">v${esc(f.version||'1.0')}</span>
      <span style="color:var(--muted);font-size:.85rem">· ${esc(f.category)}</span>
    </div>
    ${f.desc ? `<div class="detail-section"><p class="detail-desc">${esc(f.desc)}</p></div>` : ''}

    ${f.temp || f.time ? `
    <div class="detail-section">
      <div class="detail-section-title">Process Parameters</div>
      ${f.temp ? `<p style="font-size:.9rem;margin-bottom:.35rem">🌡 <strong>Temperature:</strong> ${esc(f.temp)}</p>` : ''}
      ${f.time ? `<p style="font-size:.9rem">⏱ <strong>Time:</strong> ${esc(f.time)}</p>` : ''}
    </div>` : ''}

    ${ings.length ? `
    <div class="detail-section">
      <div class="detail-section-title">Ingredients (${ings.length})</div>
      ${buildIngredientTables(ings)}
    </div>

    <div class="detail-section" id="scale-section">
      <div class="detail-section-title">Scale Recipe</div>
      <div class="scale-row">
        <label for="scale-volume" style="font-weight:500;margin:0">Scale to</label>
        <input id="scale-volume" type="number" min="1" placeholder="e.g. 500"
          oninput="scaleRecipe()" style="width:130px" />
        <span style="font-size:.875rem;color:var(--muted)">ml total volume</span>
        <button class="btn btn-ghost btn-sm" onclick="clearScale()" title="Clear scaling">✕ Reset</button>
      </div>
    </div>` : ''}

    ${f.notes ? `
    <div class="detail-section">
      <div class="detail-section-title">Notes</div>
      <div class="detail-notes">${esc(f.notes)}</div>
    </div>` : ''}

    <p style="font-size:.75rem;color:var(--muted);margin-top:1rem">
      Last updated: ${new Date(f.updatedAt||Date.now()).toLocaleString()}
    </p>
  `;
  document.getElementById('detail-panel').classList.add('open');
  document.getElementById('main-page').style.visibility = 'hidden';
}

function closeDetail() {
  document.getElementById('detail-panel').classList.remove('open');
  document.getElementById('main-page').style.visibility = '';
  currentDetailId = null;
}

/* ─── Scale Recipe ───────────────────────────────────────────── */
function scaleRecipe() {
  const targetVol = parseFloat(document.getElementById('scale-volume').value);
  const f = currentDetailId ? db.find(x => x.id === currentDetailId) : null;
  if (!f) return;

  const ings = f.ingredients || [];
  const scaledHeader = document.getElementById('scaled-header');
  if (!scaledHeader) return;

  if (!targetVol || targetVol <= 0) {
    clearScale();
    return;
  }

  // Calculate base volume: sum of all ml quantities
  let baseMl = ings.reduce((sum, i) => {
    if ((i.unit || '').toLowerCase() === 'ml') {
      const n = parseFloat(i.qty);
      if (!isNaN(n)) sum += n;
    }
    return sum;
  }, 0);
  // Fall back to 1000ml if no ml-based ingredients were found (e.g. all in grams).
  // This gives a relative scale factor rather than an absolute volume conversion.
  if (baseMl <= 0) baseMl = 1000;

  const factor = targetVol / baseMl;

  // Show all scaled columns (across all ingredient tables)
  document.querySelectorAll('.scaled-col').forEach(el => el.style.display = '');

  ings.forEach((i, idx) => {
    const cell = document.getElementById('scaled-' + idx);
    if (!cell) return;
    cell.style.display = '';
    const n = parseFloat(i.qty);
    if (!isNaN(n)) {
      const scaled = n * factor;
      // Show up to 4 significant figures, strip unnecessary trailing zeros
      cell.textContent = parseFloat(scaled.toPrecision(4)) + ' ' + (i.unit || '');
    } else {
      cell.textContent = i.qty; // non-numeric, leave as-is
    }
  });
}

function clearScale() {
  document.querySelectorAll('.scaled-col').forEach(el => {
    el.style.display = 'none';
    if (el.tagName !== 'TH') el.textContent = '—';
  });
  const inp = document.getElementById('scale-volume');
  if (inp) inp.value = '';
}

/* ─── Shared canvas rendering for PDF & JPEG exports ─────────── */
function renderFormulaCanvas(f) {
  const ings = f.ingredients || [];
  const scale = 2;
  const W = 800 * scale;
  const pad = 48 * scale;
  const lineH = 22 * scale;

  // Helper: wrap text using a measurement canvas
  const measure = document.createElement('canvas').getContext('2d');
  function wrapText(text, maxW, fontSize) {
    measure.font = `${fontSize}px Inter, sans-serif`;
    const words = text.split(' ');
    let line = '';
    const lines = [];
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (measure.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  const contentW = W - (pad + 8 * scale) * 2;

  // Pre-calculate height using actual text wrapping
  let estH = pad; // top margin
  estH += 36 * scale; // title
  estH += 12 * scale; // gap after title
  estH += lineH; // meta line (process / category / version / status)
  if (f.desc) estH += 12 * scale + wrapText(f.desc, contentW, 13 * scale).length * lineH;
  if (f.temp || f.time) estH += 28 * scale + lineH + (f.temp && f.time ? lineH : 0);
  if (ings.length) {
    const hasPartsEst = ings.some(i => i.part === 'A' || i.part === 'B');
    const partAEst = ings.filter(i => i.part === 'A');
    const partBEst = ings.filter(i => i.part === 'B');
    const noPartEst = ings.filter(i => !i.part || (i.part !== 'A' && i.part !== 'B'));
    let groupCount = 0;
    if (hasPartsEst) {
      if (noPartEst.length) groupCount++;
      if (partAEst.length) groupCount++;
      if (partBEst.length) groupCount++;
    }
    estH += 28 * scale + lineH + ings.length * lineH + 8 * scale;
    if (hasPartsEst) estH += groupCount * (lineH + lineH); // group headers + extra table headers
  }
  if (f.notes) estH += 28 * scale + wrapText(f.notes, contentW, 13 * scale).length * lineH + 12 * scale;
  estH += 24 * scale; // timestamp
  estH += pad; // bottom margin
  const H = Math.max(estH, 500 * scale);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#f8f9fc';
  ctx.fillRect(0, 0, W, H);

  // Card area with white background and subtle border
  const cardX = 24 * scale, cardY = 24 * scale;
  const cardW = W - 48 * scale, cardH = H - 48 * scale;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  const r = 12 * scale;
  ctx.moveTo(cardX + r, cardY);
  ctx.arcTo(cardX + cardW, cardY, cardX + cardW, cardY + cardH, r);
  ctx.arcTo(cardX + cardW, cardY + cardH, cardX, cardY + cardH, r);
  ctx.arcTo(cardX, cardY + cardH, cardX, cardY, r);
  ctx.arcTo(cardX, cardY, cardX + cardW, cardY, r);
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1 * scale;
  ctx.stroke();

  let y = pad + 16 * scale;
  const left = pad + 8 * scale;
  const right = W - pad - 8 * scale;

  // Helper: draw section heading
  function sectionTitle(text) {
    y += 18 * scale;
    ctx.fillStyle = '#2563eb';
    ctx.font = `bold ${13 * scale}px Inter, sans-serif`;
    ctx.fillText(text.toUpperCase(), left, y);
    y += 6 * scale;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    y += 14 * scale;
  }

  // Title
  ctx.fillStyle = '#0f172a';
  ctx.font = `bold ${28 * scale}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(f.name, W / 2, y);
  ctx.textAlign = 'left';
  y += 10 * scale;

  // Accent underline below title
  const titleUnderW = Math.min(ctx.measureText(f.name).width + 24 * scale, contentW);
  ctx.strokeStyle = '#2563eb';
  ctx.lineWidth = 3 * scale;
  ctx.beginPath();
  ctx.moveTo((W - titleUnderW) / 2, y);
  ctx.lineTo((W + titleUnderW) / 2, y);
  ctx.stroke();
  y += 16 * scale;

  // Meta line: process · category · version · status
  ctx.font = `${13 * scale}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748b';
  const meta = [f.process, f.category, 'v' + (f.version || '1.0'), f.status].filter(Boolean).join('  ·  ');
  ctx.fillText(meta, W / 2, y);
  ctx.textAlign = 'left';
  y += 8 * scale;

  // Description
  if (f.desc) {
    y += 10 * scale;
    ctx.fillStyle = '#334155';
    const descLines = wrapText(f.desc, contentW, 13 * scale);
    for (const ln of descLines) {
      ctx.font = `italic ${13 * scale}px Inter, sans-serif`;
      ctx.fillText(ln, left, y);
      y += lineH;
    }
  }

  // Process Parameters
  if (f.temp || f.time) {
    sectionTitle('Process Parameters');
    ctx.fillStyle = '#0f172a';
    ctx.font = `${14 * scale}px Inter, sans-serif`;
    if (f.temp) {
      ctx.font = `bold ${14 * scale}px Inter, sans-serif`;
      ctx.fillText('Temperature:', left, y);
      ctx.font = `${14 * scale}px Inter, sans-serif`;
      ctx.fillText(f.temp, left + ctx.measureText('Temperature:  ').width, y);
      y += lineH;
    }
    if (f.time) {
      ctx.font = `bold ${14 * scale}px Inter, sans-serif`;
      ctx.fillText('Time:', left, y);
      ctx.font = `${14 * scale}px Inter, sans-serif`;
      ctx.fillText(f.time, left + ctx.measureText('Time:  ').width, y);
      y += lineH;
    }
  }

  // Ingredients
  if (ings.length) {
    sectionTitle('Ingredients (' + ings.length + ')');

    const colNum = left;
    const colName = left + 36 * scale;
    const colQty = right - 140 * scale;
    const colUnit = right - 60 * scale;

    const partA = ings.filter(i => i.part === 'A');
    const partB = ings.filter(i => i.part === 'B');
    const noPart = ings.filter(i => !i.part || (i.part !== 'A' && i.part !== 'B'));
    const hasParts = partA.length > 0 || partB.length > 0;

    function drawTableHeader() {
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(left, y - 12 * scale, contentW, lineH);
      ctx.fillStyle = '#64748b';
      ctx.font = `bold ${12 * scale}px Inter, sans-serif`;
      ctx.fillText('#', colNum, y);
      ctx.fillText('Chemical', colName, y);
      ctx.fillText('Qty', colQty, y);
      ctx.fillText('Unit', colUnit, y);
      y += lineH;
    }

    function drawRows(items) {
      items.forEach(function(ing, localIdx) {
        var idx = ings.indexOf(ing);
        if (localIdx % 2 === 1) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(left, y - 12 * scale, contentW, lineH);
        }
        ctx.fillStyle = '#94a3b8';
        ctx.font = `${12 * scale}px Inter, sans-serif`;
        ctx.fillText(String(idx + 1), colNum, y);
        ctx.fillStyle = '#0f172a';
        ctx.font = `${13 * scale}px Inter, sans-serif`;
        ctx.fillText(ing.name || '', colName, y);
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${13 * scale}px Inter, sans-serif`;
        ctx.fillText(ing.qty || '', colQty, y);
        ctx.fillStyle = '#64748b';
        ctx.font = `${12 * scale}px Inter, sans-serif`;
        ctx.fillText(ing.unit || '', colUnit, y);
        y += lineH;
      });
    }

    function drawGroupLabel(label) {
      y += 6 * scale;
      ctx.fillStyle = '#2563eb';
      ctx.font = `bold ${13 * scale}px Inter, sans-serif`;
      ctx.fillText(label, left, y);
      y += lineH;
    }

    if (!hasParts) {
      drawTableHeader();
      drawRows(ings);
    } else {
      if (noPart.length) {
        drawTableHeader();
        drawRows(noPart);
      }
      if (partA.length) {
        drawGroupLabel('PART A');
        drawTableHeader();
        drawRows(partA);
      }
      if (partB.length) {
        drawGroupLabel('PART B');
        drawTableHeader();
        drawRows(partB);
      }
    }
  }

  // Notes
  if (f.notes) {
    sectionTitle('Notes');
    ctx.fillStyle = '#334155';
    const noteLines = wrapText(f.notes, contentW, 13 * scale);
    for (const ln of noteLines) {
      ctx.font = `${13 * scale}px Inter, sans-serif`;
      ctx.fillText(ln, left, y);
      y += lineH;
    }
  }

  // Timestamp
  y += 12 * scale;
  ctx.fillStyle = '#94a3b8';
  ctx.font = `${11 * scale}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('Last updated: ' + new Date(f.updatedAt || Date.now()).toLocaleString(), W / 2, y);
  ctx.textAlign = 'left';

  return canvas;
}

/* ─── PDF / Print ────────────────────────────────────────────── */
function downloadDetailPDF() {
  const f = db.find(x => x.id === currentDetailId);
  if (!f) { toast('No formula selected', 'error'); return; }

  try {
    const canvas = renderFormulaCanvas(f);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usable = pageW - margin * 2;

    const imgData = canvas.toDataURL('image/png');
    const ratio = canvas.height / canvas.width;
    const imgW = usable;
    const imgH = imgW * ratio;
    const availH = pageH - margin * 2;

    if (imgH <= availH) {
      pdf.addImage(imgData, 'PNG', margin, margin, imgW, imgH);
    } else {
      const scale = availH / imgH;
      pdf.addImage(imgData, 'PNG', margin, margin, imgW * scale, availH);
    }

    const safeName = f.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    pdf.save(safeName + '.pdf');
    toast('PDF downloaded ✓', 'success');
  } catch (err) {
    console.error('PDF generation error:', err);
    toast('PDF generation failed', 'error');
  }
}

function downloadDetailJPEG() {
  const f = db.find(x => x.id === currentDetailId);
  if (!f) { toast('No formula selected', 'error'); return; }

  const canvas = renderFormulaCanvas(f);

  // Download
  const link = document.createElement('a');
  const safeName = f.name.replace(/[^a-zA-Z0-9_-]/g, '_');
  link.download = safeName + '.jpeg';
  link.href = canvas.toDataURL('image/jpeg', 0.95);
  link.click();
  toast('JPEG downloaded ✓', 'success');
}

function printDetail() {
  window.print();
}

function printAll() {
  // Collect currently visible (filtered) formulas and open a print window
  const list = getFiltered();
  if (!list.length) { toast('No formulas to print', 'error'); return; }

  const esc2 = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  const formulaHTML = list.map(f => {
    const ings = f.ingredients || [];
    return `
      <div class="formula" style="page-break-inside:avoid;margin-bottom:2rem;padding-bottom:1.5rem;border-bottom:1px solid #ccc">
        <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:.25rem">${esc2(f.name)}</h2>
        <p style="font-size:.85rem;color:#555;margin-bottom:.5rem">
          ${esc2(f.process)} · ${esc2(f.category)} · v${esc2(f.version||'1.0')} · ${esc2(f.status)}
        </p>
        ${f.desc ? `<p style="font-size:.875rem;margin-bottom:.5rem">${esc2(f.desc)}</p>` : ''}
        ${f.temp ? `<p style="font-size:.875rem;margin-bottom:.25rem">🌡 ${esc2(f.temp)}</p>` : ''}
        ${f.time ? `<p style="font-size:.875rem;margin-bottom:.5rem">⏱ ${esc2(f.time)}</p>` : ''}
        ${ings.length ? `
        <table style="width:100%;border-collapse:collapse;font-size:.875rem;margin-top:.5rem">
          <thead><tr>
            <th style="text-align:left;padding:.3rem .5rem;border-bottom:1px solid #ccc;font-size:.75rem;text-transform:uppercase">#</th>
            <th style="text-align:left;padding:.3rem .5rem;border-bottom:1px solid #ccc;font-size:.75rem;text-transform:uppercase">Chemical</th>
            <th style="text-align:left;padding:.3rem .5rem;border-bottom:1px solid #ccc;font-size:.75rem;text-transform:uppercase">Qty</th>
            <th style="text-align:left;padding:.3rem .5rem;border-bottom:1px solid #ccc;font-size:.75rem;text-transform:uppercase">Unit</th>
          </tr></thead>
          <tbody>${ings.map((i,n)=>`
            <tr>
              <td style="padding:.3rem .5rem;border-bottom:1px solid #eee;color:#777">${n+1}</td>
              <td style="padding:.3rem .5rem;border-bottom:1px solid #eee">${esc2(i.name)}</td>
              <td style="padding:.3rem .5rem;border-bottom:1px solid #eee">${esc2(i.qty)}</td>
              <td style="padding:.3rem .5rem;border-bottom:1px solid #eee;color:#777">${esc2(i.unit)}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : ''}
        ${f.notes ? `<p style="font-size:.8rem;color:#666;margin-top:.5rem;font-style:italic">${esc2(f.notes)}</p>` : ''}
      </div>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Formulae Export — ${new Date().toISOString().slice(0,10)}</title>
    <style>
      body { font-family: system-ui, sans-serif; padding: 2rem; color: #111; max-width: 800px; margin: 0 auto; }
      h1 { font-size: 1.5rem; margin-bottom: .5rem; }
      p.sub { color: #666; font-size: .875rem; margin-bottom: 1.5rem; }
      @media print { .no-print { display: none; } }
    </style></head><body>
    <h1>Formulae — Chemical Database</h1>
    <p class="sub">Exported ${list.length} formula${list.length!==1?'s':''} · ${new Date().toLocaleString()}</p>
    <button class="no-print" onclick="window.print()" style="margin-bottom:1.5rem;padding:.5rem 1rem;cursor:pointer">🖨 Print / Save PDF</button>
    ${formulaHTML}
  </body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) { toast('Allow pop-ups to use PDF export', 'error'); URL.revokeObjectURL(url); return; }
  win.addEventListener('load', function() { URL.revokeObjectURL(url); });
  setTimeout(function() { URL.revokeObjectURL(url); }, 60000);
}

/* ─── Modal ──────────────────────────────────────────────────── */
function openModal(id) {
  editingId = id || null;
  const backdrop = document.getElementById('modal-backdrop');
  const title    = document.getElementById('modal-title');

  clearIngEditor();

  if (id) {
    const f = db.find(x => x.id === id);
    if (!f) return;
    title.textContent = 'Edit Formula';
    document.getElementById('edit-id').value    = f.id;
    document.getElementById('f-name').value     = f.name    || '';
    document.getElementById('f-process').value  = f.process || '';
    document.getElementById('f-category').value = f.category|| '';
    document.getElementById('f-status').value   = f.status  || 'Experimental';
    document.getElementById('f-version').value  = f.version || '1.0';
    document.getElementById('f-color').value    = f.color   || '#2563eb';
    document.getElementById('f-desc').value     = f.desc    || '';
    document.getElementById('f-temp').value     = f.temp    || '';
    document.getElementById('f-time').value     = f.time    || '';
    document.getElementById('f-notes').value    = f.notes   || '';
    (f.ingredients || []).forEach(i => addIngRow(i));
  } else {
    title.textContent = 'New Formula';
    document.getElementById('edit-id').value    = '';
    document.getElementById('f-name').value     = '';
    document.getElementById('f-process').value  = '';
    document.getElementById('f-category').value = '';
    document.getElementById('f-status').value   = 'Experimental';
    document.getElementById('f-version').value  = '1.0';
    document.getElementById('f-color').value    = '#2563eb';
    document.getElementById('f-desc').value     = '';
    document.getElementById('f-temp').value     = '';
    document.getElementById('f-time').value     = '';
    document.getElementById('f-notes').value    = '';
    addIngRow();
  }

  backdrop.classList.add('open');
  document.getElementById('f-name').focus();
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  editingId = null;
}

function backdropClose(e) {
  if (e.target === document.getElementById('modal-backdrop')) closeModal();
}

function saveFormula() {
  const name     = document.getElementById('f-name').value.trim();
  const process  = document.getElementById('f-process').value;
  const category = document.getElementById('f-category').value;

  if (!name)     { toast('Formula name is required', 'error'); document.getElementById('f-name').focus(); return; }
  if (!process)  { toast('Please select a process', 'error'); return; }
  if (!category) { toast('Please select a category', 'error'); return; }

  // Duplicate name warning
  const dupExists = db.some(f => f.name.toLowerCase() === name.toLowerCase() && f.id !== editingId);
  if (dupExists) {
    toast('A formula with this name already exists.');
  }

  const ingredients = readIngredients();
  const color = document.getElementById('f-color').value || '';
  const now = Date.now();

  if (editingId) {
    const idx = db.findIndex(x => x.id === editingId);
    if (idx === -1) return;
    db[idx] = {
      ...db[idx],
      name, process, category, color,
      status:  document.getElementById('f-status').value,
      version: document.getElementById('f-version').value.trim() || '1.0',
      desc:    document.getElementById('f-desc').value.trim(),
      temp:    document.getElementById('f-temp').value.trim(),
      time:    document.getElementById('f-time').value.trim(),
      notes:   document.getElementById('f-notes').value.trim(),
      ingredients, updatedAt: now,
    };
    toast('Formula updated ✓', 'success');
  } else {
    db.unshift({
      id: uid(), name, process, category, color,
      status:  document.getElementById('f-status').value,
      version: document.getElementById('f-version').value.trim() || '1.0',
      desc:    document.getElementById('f-desc').value.trim(),
      temp:    document.getElementById('f-temp').value.trim(),
      time:    document.getElementById('f-time').value.trim(),
      notes:   document.getElementById('f-notes').value.trim(),
      ingredients, createdAt: now, updatedAt: now,
    });
    toast('Formula created ✓', 'success');
  }

  save();
  closeModal();
  renderCards();
}

/* ─── Ingredient editor ──────────────────────────────────────── */
function clearIngEditor() {
  const editor = document.getElementById('ing-editor');
  editor.innerHTML = '';
  const h = document.createElement('div');
  h.className = 'ing-editor-header';
  h.innerHTML = '<span>Chemical name</span><span>Quantity</span><span>Unit</span><span>Part</span><span></span>';
  editor.appendChild(h);
}

function addIngRow(ing) {
  const editor = document.getElementById('ing-editor');
  const row = document.createElement('div');
  row.className = 'ing-editor-row';
  row.draggable = true;
  const partVal = ing?.part || '';
  row.innerHTML = `
    <input type="text" placeholder="e.g. Sodium Sulfite" value="${esc(ing?.name||'')}" />
    <input type="text" placeholder="e.g. 100" value="${esc(ing?.qty||'')}" />
    <input type="text" placeholder="g / ml / oz" value="${esc(ing?.unit||'g')}" list="unit-suggestions" />
    <select>
      <option value=""${partVal === '' ? ' selected' : ''}>—</option>
      <option value="A"${partVal === 'A' ? ' selected' : ''}>A</option>
      <option value="B"${partVal === 'B' ? ' selected' : ''}>B</option>
    </select>
    <button class="btn btn-ghost btn-sm drag-handle" title="Remove" onclick="removeIngRow(this)">✕</button>
  `;

  row.addEventListener('dragstart', e => {
    dragSrcIdx = rowIndex(row);
    e.dataTransfer.effectAllowed = 'move';
  });
  row.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.ing-editor-row').forEach(r => r.classList.remove('drag-over'));
    row.classList.add('drag-over');
  });
  row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
  row.addEventListener('drop', e => {
    e.preventDefault();
    row.classList.remove('drag-over');
    const targetIdx = rowIndex(row);
    if (dragSrcIdx === null || dragSrcIdx === targetIdx) return;
    const rows = [...editor.querySelectorAll('.ing-editor-row')];
    const srcEl = rows[dragSrcIdx];
    if (dragSrcIdx < targetIdx) row.after(srcEl);
    else row.before(srcEl);
    dragSrcIdx = null;
  });

  editor.appendChild(row);
}

function rowIndex(row) {
  return [...document.querySelectorAll('.ing-editor-row')].indexOf(row);
}

function removeIngRow(btn) {
  const row = btn.closest('.ing-editor-row');
  if (document.querySelectorAll('.ing-editor-row').length > 1) row.remove();
  else {
    row.querySelectorAll('input').forEach(i => i.value = '');
    const sel = row.querySelector('select');
    if (sel) sel.value = '';
  }
}

function readIngredients() {
  return [...document.querySelectorAll('.ing-editor-row')].map(row => {
    const inputs = row.querySelectorAll('input');
    const select = row.querySelector('select');
    const part = select ? select.value : '';
    return {
      name: inputs[0].value.trim(),
      qty:  inputs[1].value.trim(),
      unit: inputs[2].value.trim(),
      part: part || undefined,
    };
  }).filter(i => i.name);
}

/* ─── Duplicate ──────────────────────────────────────────────── */
function duplicate(id) {
  const f = db.find(x => x.id === id);
  if (!f) return;
  const vNum = parseFloat(f.version || '1') + 0.1;
  db.unshift({
    ...JSON.parse(JSON.stringify(f)),
    id: uid(),
    name: f.name + ' (copy)',
    version: vNum.toFixed(1),
    status: 'Experimental',
    updatedAt: Date.now(),
    createdAt: Date.now(),
  });
  save();
  renderCards();
  toast('Formula duplicated ✓', 'success');
}

/* ─── Delete ─────────────────────────────────────────────────── */
function confirmDelete(id, fromDetail) {
  const f = db.find(x => x.id === id);
  if (!f) return;
  document.getElementById('confirm-title').textContent = `Delete "${f.name}"?`;
  document.getElementById('confirm-msg').textContent   = 'This action cannot be undone.';
  document.getElementById('confirm-backdrop').classList.add('open');
  confirmCallback = () => {
    db = db.filter(x => x.id !== id);
    save();
    renderCards();
    if (fromDetail) closeDetail();
    toast('Formula deleted', 'success');
  };
  document.getElementById('confirm-ok-btn').onclick = () => {
    confirmCallback && confirmCallback();
    closeConfirm();
  };
}

function closeConfirm() {
  document.getElementById('confirm-backdrop').classList.remove('open');
  confirmCallback = null;
}

/* ─── Clear filters ──────────────────────────────────────────── */
function clearFilters() {
  document.getElementById('search-input').value    = '';
  document.getElementById('filter-process').value  = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-status').value   = '';
  document.getElementById('sort-select').value     = 'updated';
  renderCards();
}

/* ─── Export / Import ────────────────────────────────────────── */
function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = 'formulae-backup-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  const now = Date.now();
  localStorage.setItem(LAST_EXPORT_KEY, String(now));
  updateLastBackup(now);
  toast('Exported ✓', 'success');
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const imported = JSON.parse(evt.target.result);
      if (!Array.isArray(imported)) throw new Error();
      const merged = [...db];
      let added = 0;
      imported.forEach(f => {
        if (!merged.find(x => x.id === f.id)) {
          merged.push(f); added++;
        }
      });
      db = merged;
      save();
      renderCards();
      toast(`Imported ${added} new formula${added !== 1 ? 's' : ''} ✓`, 'success');
    } catch {
      toast('Invalid JSON file', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ─── Last Backup indicator ───────────────────────────────────── */
function updateLastBackup(ts) {
  const el = document.getElementById('last-backup');
  if (!el) return;
  if (ts) {
    el.textContent = 'Last Backup: ' + new Date(Number(ts)).toLocaleDateString();
  } else {
    el.textContent = 'Last Backup: Never';
  }
}

/* ─── Backup reminder ────────────────────────────────────────── */
function checkBackupReminder() {
  if (backupReminderShown) return;
  if (db.length <= 5) return;
  const lastExport = localStorage.getItem(LAST_EXPORT_KEY);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  if (lastExport && (Date.now() - Number(lastExport)) < sevenDays) return;
  backupReminderShown = true;
  localStorage.setItem(LAST_REMINDER_KEY, String(Date.now()));
  toast('Remember to export your formulas as a backup.');
}

/* ─── Toast ──────────────────────────────────────────────────── */
function toast(msg, type) {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s';
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

/* ─── Keyboard shortcuts ─────────────────────────────────────── */
document.addEventListener('keydown', e => {
  const tag = document.activeElement && document.activeElement.tagName;

  // Escape in search input clears search
  if (e.key === 'Escape' && document.activeElement === document.getElementById('search-input')) {
    document.getElementById('search-input').value = '';
    document.getElementById('search-input').blur();
    renderCards();
    return;
  }

  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (e.key === 'Escape') {
    if (document.getElementById('modal-backdrop').classList.contains('open'))    closeModal();
    else if (document.getElementById('detail-panel').classList.contains('open')) closeDetail();
    else if (document.getElementById('confirm-backdrop').classList.contains('open')) closeConfirm();
    return;
  }
  if ((e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
    if (!document.getElementById('modal-backdrop').classList.contains('open') &&
        !document.getElementById('detail-panel').classList.contains('open')) {
      openModal();
    }
    return;
  }
  if (e.key === '/') {
    e.preventDefault();
    document.getElementById('search-input').focus();
  }
});

/* ─── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  load();

  // Restore darkroom preference
  if (localStorage.getItem(DARKROOM_KEY)) {
    document.body.classList.add('darkroom');
    updateDarkroomBtn(true);
  }

  // Restore view mode preference
  const savedViewMode = localStorage.getItem(VIEW_MODE_KEY);
  if (savedViewMode === 'list' || savedViewMode === 'grid') {
    viewMode = savedViewMode;
    const btn = document.getElementById('view-toggle-btn');
    btn.textContent = viewMode === 'grid' ? '⊞ Grid' : '☰ List';
  }

  // Initialize last backup indicator
  updateLastBackup(localStorage.getItem(LAST_EXPORT_KEY));

  renderCards();

  // Check backup reminder after render
  checkBackupReminder();

  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
