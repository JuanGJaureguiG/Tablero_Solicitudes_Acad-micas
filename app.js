/* Tablero de Solicitudes Académicas — UNIMINUTO Sede Tolima - Huila
   Lee data.json (generado por build_data.py). Datos agregados, sin información personal. */

const BUCKETS = ['Vencida', '0 a 7 días', '8 a 15 días', '16 a 30 días', 'Más de 30 días'];
const BUCKET_COLOR = ['#6E3325', '#A8553F', '#E2962B', '#EEC47F', '#2F7A6D'];
const BUCKET_DARK_TEXT = [false, false, false, true, false];
const CU_COLOR = { 'Ibagué':'#16324F', 'Neiva':'#2F7A6D', 'Garzón':'#E2962B', 'Pitalito':'#6C8EB0', 'Lérida':'#7A5C9E', 'La Dorada':'#A8553F', 'Planadas':'#9CCBBE' };
// Códigos de estado de SAP. Ajuste la descripción si es necesario.
const EST_LABEL = { 'TR':'TR · En trámite', 'PF':'PF', 'PC':'PC' };
const EST_COLOR = { 'TR':'#16324F', 'PF':'#E2962B', 'PC':'#2F7A6D' };
const NIVEL_ORDER = ['Pregrado', 'Especialización', 'Maestría'];
const MES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

let DATA, META, DICTS, DIMS, PLAZOS, CORTE;
const state = { cu:new Set(), tipo:new Set(), est:new Set(), niv:new Set(), mes:new Set(), prog:'', q:'', sortKey:'sol', sortDir:-1 };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Number(n).toLocaleString('es-CO');
const pct = (a,b) => b ? a/b*100 : 0;
const fmtPct = v => v.toFixed(1).replace('.',',') + '%';
const fmt1 = v => v.toFixed(1).replace('.',',');
const sum = (rows, f) => rows.reduce((s,r) => s + (f ? (f(r) ? r.n : 0) : r.n), 0);
const dayNum = iso => { const [y,m,d] = iso.split('-').map(Number); return Date.UTC(y, m-1, d) / 864e5; };
const isoOf = dn => new Date(dn * 864e5).toISOString().slice(0,10);
const weekStart = dn => dn - ((new Date(dn * 864e5).getUTCDay() + 6) % 7);
const fmtDate = dn => { const d = new Date(dn * 864e5); return `${d.getUTCDate()} ${MES[d.getUTCMonth()]}`; };
const fmtDateLong = dn => { const d = new Date(dn * 864e5); return `${d.getUTCDate()} ${MES[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const bucketOf = dr => dr < 0 ? 0 : dr <= 7 ? 1 : dr <= 15 ? 2 : dr <= 30 ? 3 : 4;
const urgClass = dr => dr <= 7 ? 'u0' : dr <= 15 ? 'u1' : dr <= 30 ? 'u2' : 'u3';
const wavg = (rows, f) => { const t = sum(rows); return t ? rows.reduce((s,r) => s + f(r) * r.n, 0) / t : 0; };
const wrap = (s, w) => { const out = []; let line = ''; s.split(' ').forEach(word => { if((line + ' ' + word).trim().length > w && line){ out.push(line); line = word; } else line = (line + ' ' + word).trim(); }); if(line) out.push(line); return out; };

/* ---------- Filtros ---------- */
function matches(r, exclude){
  return DIMS.every(d => d.key === exclude || state[d.key].size === 0 || state[d.key].has(r[d.key]))
    && (exclude === 'prog' || !state.prog || r.prog === state.prog);
}
const filtered = exclude => DATA.filter(r => matches(r, exclude));
const anyFilter = () => DIMS.some(d => state[d.key].size > 0) || state.prog;

function renderFilters(){
  const host = document.getElementById('filters');
  host.innerHTML = '';
  DIMS.forEach(d => {
    const base = filtered(d.key);
    const sel = state[d.key].size;
    const g = document.createElement('div');
    g.className = 'fgroup';
    g.innerHTML = `<h2>${d.label}<small>${sel ? sel + ' seleccionado' + (sel > 1 ? 's' : '') : 'Todos'}</small></h2><div class="chips"></div>`;
    const chips = g.querySelector('.chips');
    d.order.forEach(val => {
      const n = sum(base, r => r[d.key] === val);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (n === 0 ? ' zero' : '');
      b.setAttribute('aria-pressed', state[d.key].has(val) ? 'true' : 'false');
      b.innerHTML = `${esc(d.label_of ? d.label_of(val) : val)} <span class="n">${fmt(n)}</span>`;
      b.onclick = () => { state[d.key].has(val) ? state[d.key].delete(val) : state[d.key].add(val); render(); };
      chips.appendChild(b);
    });
    host.appendChild(g);
  });

  const pBase = filtered('prog');
  const ps = document.getElementById('progFilter');
  let html = `<option value="">Todos los programas (${fmt(sum(pBase))})</option>`;
  NIVEL_ORDER.forEach(nv => {
    const progs = DICTS.prog.filter(p => DATA.some(r => r.prog === p && r.niv === nv)).sort((a,b) => a.localeCompare(b,'es'));
    if(!progs.length) return;
    html += `<optgroup label="${esc(nv)}">` + progs.map(p =>
      `<option value="${esc(p)}"${state.prog === p ? ' selected' : ''}>${esc(p)} (${fmt(sum(pBase, r => r.prog === p))})</option>`).join('') + '</optgroup>';
  });
  ps.innerHTML = html;
  ps.classList.toggle('on', !!state.prog);
  document.getElementById('progSel').textContent = state.prog ? '1 seleccionado' : 'Todos';
  document.getElementById('resetBtn').disabled = !anyFilter();
}

/* ---------- KPIs ---------- */
function renderKPIs(rows){
  const tot = sum(rows), all = sum(DATA);
  const venc = sum(rows, r => r.dr < 0);
  const prox = sum(rows, r => r.dr >= 0 && r.dr <= 7);
  const dias = wavg(rows, r => r.dt);
  const oldest = rows.length ? Math.max(...rows.map(r => r.dt)) : 0;
  const cons = wavg(rows, r => r.cons);
  const limite = fmtDate(CORTE + 7);
  document.getElementById('kpis').innerHTML = `
    <div class="kpi"><div class="l">Solicitudes abiertas</div><div class="v">${fmt(tot)}</div><div class="s">de ${fmt(all)} en total a la fecha de corte</div></div>
    <div class="kpi"><div class="l">Dentro del plazo</div><div class="v">${fmtPct(pct(tot - venc, tot))}</div><div class="s">${venc ? fmt(venc) + ' vencidas' : 'ninguna solicitud vencida'}</div></div>
    <div class="kpi"><div class="l">Días promedio en gestión</div><div class="v">${tot ? fmt1(dias) : '0'}</div><div class="s">la más antigua lleva ${fmt(oldest)} días</div></div>
    <div class="kpi"><div class="l">Vencen en 7 días o menos</div><div class="v">${fmt(prox)}</div><div class="s">hasta el ${limite}; respuesta prioritaria</div></div>
    <div class="kpi"><div class="l">Plazo consumido</div><div class="v">${fmtPct(cons)}</div><div class="s">promedio del tiempo disponible ya usado</div></div>`;
  document.getElementById('showing').innerHTML = `Mostrando <b>${fmt(tot)}</b> de ${fmt(all)} solicitudes`;
}

/* ---------- Semáforo ---------- */
function renderBuckets(rows){
  const tot = sum(rows);
  const counts = BUCKETS.map((_,i) => sum(rows, r => r.bk === i));
  document.getElementById('stageBar').innerHTML = tot ? counts.map((c,i) => {
    if(!c) return '';
    const p = pct(c, tot);
    return `<div style="flex-grow:${c};background:${BUCKET_COLOR[i]};${BUCKET_DARK_TEXT[i] ? 'color:#3B2A12' : ''}" title="${BUCKETS[i]}: ${fmt(c)} (${fmtPct(p)})">${p >= 5 ? fmt(c) : ''}</div>`;
  }).join('') : '';
  document.getElementById('stageLegend').innerHTML = BUCKETS.map((b,i) => `
    <div class="bk" style="border-left-color:${BUCKET_COLOR[i]}">
      <div class="t">${i === 0 ? 'Vencidas' : 'Vencen en ' + b.toLowerCase().replace('más de', 'más de')}</div>
      <div class="v">${fmt(counts[i])}<small>${fmtPct(pct(counts[i], tot))}</small></div>
    </div>`).join('');
}

/* ---------- Puntos de atención ---------- */
function renderAlerts(rows){
  const tot = sum(rows);
  const ul = document.getElementById('alerts');
  if(!tot){ ul.innerHTML = '<li>No hay solicitudes con los filtros seleccionados.</li>'; return; }
  const items = [];
  const venc = rows.filter(r => r.dr < 0);
  if(venc.length) items.push(['hi', `<b>${fmt(sum(venc))}</b> solicitudes ya superaron su fecha de vencimiento.`]);
  else items.push(['ok', `<b>Ninguna solicitud vencida</b> a la fecha de corte.`]);

  const prox = rows.filter(r => r.dr >= 0 && r.dr <= 7);
  if(prox.length){
    const byCu = DICTS.cu.map(c => [c, sum(prox, r => r.cu === c)]).filter(x => x[1]).sort((a,b) => b[1] - a[1]);
    const first = [...prox].sort((a,b) => a.dr - b.dr)[0];
    items.push(['hi', `<b>${fmt(sum(prox))}</b> vencen en los próximos 7 días (${byCu.map(x => `${esc(x[0])} ${fmt(x[1])}`).join(', ')}). La más próxima es <b>${esc(first.tipo)}</b> en ${esc(first.cu)}, que vence el ${fmtDate(first.venN)}.`]);
  }

  const soon = rows.filter(r => r.dr >= 8 && r.dr <= 15);
  if(soon.length) items.push(['md', `<b>${fmt(sum(soon))}</b> vencen entre 8 y 15 días; conviene priorizarlas en la siguiente semana.`]);

  const cuTop = DICTS.cu.map(c => [c, sum(rows, r => r.cu === c)]).sort((a,b) => b[1] - a[1])[0];
  if(cuTop && cuTop[1] && (state.cu.size !== 1)) items.push(['', `<b>${esc(cuTop[0])}</b> concentra el ${fmtPct(pct(cuTop[1], tot))} de las solicitudes abiertas (${fmt(cuTop[1])}).`]);

  const tipoTop = DICTS.tipo.map(t => [t, sum(rows, r => r.tipo === t)]).sort((a,b) => b[1] - a[1])[0];
  if(tipoTop && tipoTop[1]){
    const pl = PLAZOS[tipoTop[0]];
    items.push(['', `<b>${esc(tipoTop[0])}</b> representa el ${fmtPct(pct(tipoTop[1], tot))} de las solicitudes${pl ? `; su plazo de respuesta es de ${pl.dias} días hábiles` : ''}.`]);
  }

  const late = sum(rows, r => r.cons >= 75);
  if(late) items.push(['md', `<b>${fmt(late)}</b> solicitudes ya consumieron el 75% o más de su plazo.`]);

  const weeks = {};
  rows.forEach(r => { const w = weekStart(r.venN); weeks[w] = (weeks[w] || 0) + r.n; });
  const peak = Object.entries(weeks).sort((a,b) => b[1] - a[1])[0];
  if(peak) items.push(['', `La semana del <b>${fmtDate(+peak[0])}</b> concentra la mayor carga de vencimientos: ${fmt(peak[1])} solicitudes.`]);

  const col = { hi:'#A8553F', md:'#E2962B', ok:'#2F7A6D', '':'#6C8EB0' };
  ul.innerHTML = items.slice(0,6).map(([c,t]) => `<li class="${c}"><span class="dot" style="background:${col[c]}"></span><span>${t}</span></li>`).join('');
}

/* ---------- Plugins de Chart.js (inline, sin dependencias externas) ---------- */
const valueLabels = {
  id:'valueLabels',
  afterDatasetsDraw(chart, args, opts){
    if(!opts || !opts.mode) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.font = '600 11.5px "Space Grotesk", sans-serif';
    ctx.textBaseline = 'middle';
    const ends = {};
    chart.data.datasets.forEach((ds, di) => {
      const meta = chart.getDatasetMeta(di);
      if(meta.hidden || meta.type === 'line') return;
      meta.data.forEach((el, i) => {
        const v = ds.data[i];
        if(!v) return;
        if(opts.mode === 'stack'){
          const w = Math.abs(el.x - el.base);
          ends[i] = Math.max(ends[i] || 0, el.x);
          if(w >= 26){ ctx.fillStyle = BUCKET_DARK_TEXT[di] ? '#3B2A12' : '#fff'; ctx.textAlign = 'center'; ctx.fillText(fmt(v), (el.x + el.base)/2, el.y); }
        } else if(opts.mode === 'vstack'){
          ends[i] = Math.min(ends[i] ?? Infinity, el.y);
        } else if(opts.mode === 'right'){
          ctx.fillStyle = '#16324F'; ctx.textAlign = 'left'; ctx.fillText(fmt(v), el.x + 6, el.y);
        } else if(opts.mode === 'top'){
          ctx.fillStyle = '#16324F'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(fmt(v), el.x, el.y - 3);
        } else if(opts.mode === 'arc'){
          const p = el.tooltipPosition();
          if((el.endAngle - el.startAngle) > 0.3){ ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(fmt(v), p.x, p.y); }
        }
      });
    });
    const meta0 = chart.getDatasetMeta(0);
    const totalAt = i => chart.data.datasets.reduce((s, ds, di) => s + (chart.getDatasetMeta(di).hidden ? 0 : (ds.data[i] || 0)), 0);
    if(opts.mode === 'stack'){
      ctx.fillStyle = '#16324F'; ctx.textAlign = 'left';
      Object.keys(ends).forEach(i => ctx.fillText(fmt(totalAt(i)), ends[i] + 8, meta0.data[i].y));
    }
    if(opts.mode === 'vstack'){
      ctx.fillStyle = '#16324F'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      Object.keys(ends).forEach(i => ctx.fillText(fmt(totalAt(i)), meta0.data[i].x, ends[i] - 3));
    }
    ctx.restore();
  }
};
const centerText = {
  id:'centerText',
  afterDraw(chart, args, opts){
    if(!opts || opts.text == null) return;
    const { ctx, chartArea:a } = chart;
    const cx = (a.left + a.right)/2, cy = (a.top + a.bottom)/2;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#16324F'; ctx.font = '700 26px "Space Grotesk", sans-serif';
    ctx.fillText(opts.text, cx, cy - 8);
    ctx.fillStyle = '#66768A'; ctx.font = '400 12px "IBM Plex Sans", sans-serif';
    ctx.fillText('solicitudes', cx, cy + 14);
    ctx.restore();
  }
};

const gridColor = '#E8ECF1';
const charts = {};
const legendBottom = { position:'bottom', labels:{ boxWidth:12, boxHeight:12 } };

function initCharts(){
  Chart.register(valueLabels, centerText);
  Chart.defaults.font.family = '"IBM Plex Sans", system-ui, sans-serif';
  Chart.defaults.color = '#66768A';

  charts.cu = new Chart(document.getElementById('cuChart'), {
    type:'bar',
    data:{ labels:[], datasets: BUCKETS.map((b,i) => ({ label:b, data:[], backgroundColor:BUCKET_COLOR[i], borderRadius:3, maxBarThickness:30 })) },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{ padding:{ right:44 } },
      plugins:{ legend:{ ...legendBottom, labels:{ ...legendBottom.labels, filter: (item, data) => data.datasets[item.datasetIndex].data.some(v => v) } },
        valueLabels:{ mode:'stack' },
        tooltip:{ callbacks:{ label: c => ` ${c.dataset.label}: ${fmt(c.raw)}`,
          footer: items => { const i = items[0].dataIndex; const t = items[0].chart.data.datasets.reduce((s,d) => s + d.data[i], 0); return `Total: ${fmt(t)}`; } } } },
      scales:{ x:{ stacked:true, beginAtZero:true, ticks:{ precision:0, callback:v => fmt(v) }, grid:{ color:gridColor } },
               y:{ stacked:true, grid:{ display:false }, ticks:{ color:'#1B2733', font:{ size:12.5 } } } } }
  });

  charts.ven = new Chart(document.getElementById('venChart'), {
    type:'bar',
    data:{ labels:[], datasets: DICTS.cu.map(c => ({ label:c, data:[], backgroundColor:CU_COLOR[c] || '#8FA3B8', borderRadius:2, maxBarThickness:34 })) },
    options:{ responsive:true, maintainAspectRatio:false, layout:{ padding:{ top:18 } }, interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{ ...legendBottom, labels:{ ...legendBottom.labels, filter: (item, data) => data.datasets[item.datasetIndex].data.some(v => v) } },
        valueLabels:{ mode:'vstack' },
        tooltip:{ filter: c => c.raw > 0, callbacks:{ title: items => 'Semana del ' + items[0].label, label: c => ` ${c.dataset.label}: ${fmt(c.raw)}`,
          footer: items => { const i = items[0].dataIndex; return 'Total: ' + fmt(items[0].chart.data.datasets.reduce((s,d) => s + d.data[i], 0)); } } } },
      scales:{ x:{ stacked:true, grid:{ display:false }, ticks:{ maxRotation:0, autoSkip:true, autoSkipPadding:8 } },
               y:{ stacked:true, beginAtZero:true, grace:'8%', title:{ display:true, text:'Solicitudes que vencen' }, ticks:{ precision:0 }, grid:{ color:gridColor } } } }
  });

  charts.tipo = new Chart(document.getElementById('tipoChart'), {
    type:'bar',
    data:{ labels:[], datasets:[{ label:'Solicitudes', data:[], backgroundColor:'#16324F', borderRadius:3, maxBarThickness:28 }] },
    options:{ indexAxis:'y', responsive:true, maintainAspectRatio:false, layout:{ padding:{ right:40 } },
      plugins:{ legend:{ display:false }, valueLabels:{ mode:'right' },
        tooltip:{ callbacks:{ title: items => items[0].chart.$names[items[0].dataIndex], label: c => ` Solicitudes: ${fmt(c.raw)}`, afterLabel: c => c.chart.$extra[c.dataIndex] } } },
      scales:{ x:{ beginAtZero:true, ticks:{ precision:0 }, grid:{ color:gridColor } },
               y:{ grid:{ display:false }, ticks:{ color:'#1B2733', font:{ size:12 } } } } }
  });

  charts.est = new Chart(document.getElementById('estChart'), {
    type:'doughnut',
    data:{ labels:DICTS.est.map(e => EST_LABEL[e] || e), datasets:[{ data:[], backgroundColor:DICTS.est.map(e => EST_COLOR[e] || '#8FA3B8'), borderColor:'#fff', borderWidth:3 }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{ legend:{ position:'bottom', labels:{ boxWidth:11, boxHeight:11, font:{ size:11.5 } } }, valueLabels:{ mode:'arc' }, centerText:{ text:0 },
        tooltip:{ callbacks:{ label: c => { const t = c.dataset.data.reduce((a,b) => a+b, 0); return ` ${c.label}: ${fmt(c.raw)} (${fmtPct(pct(c.raw,t))})`; } } } } }
  });

  charts.rec = new Chart(document.getElementById('recChart'), {
    data:{ labels:[], datasets:[
      { type:'bar', label:'Solicitudes recibidas', data:[], backgroundColor:'#6C8EB0', yAxisID:'y', borderRadius:2, maxBarThickness:30, order:2 },
      { type:'line', label:'Acumulado', data:[], borderColor:'#E2962B', backgroundColor:'#E2962B', yAxisID:'y1', tension:.25, pointRadius:0, pointHoverRadius:4, borderWidth:2, order:1 }
    ] },
    options:{ responsive:true, maintainAspectRatio:false, layout:{ padding:{ top:16 } }, interaction:{ mode:'index', intersect:false },
      plugins:{ legend:legendBottom, valueLabels:{ mode:'top' }, tooltip:{ callbacks:{ title: items => 'Semana del ' + items[0].label, label: c => ` ${c.dataset.label}: ${fmt(c.raw)}` } } },
      scales:{ x:{ grid:{ display:false }, ticks:{ maxRotation:0, autoSkip:true, autoSkipPadding:10 } },
               y:{ beginAtZero:true, grace:'10%', title:{ display:true, text:'Solicitudes por semana' }, ticks:{ precision:0 }, grid:{ color:gridColor } },
               y1:{ position:'right', beginAtZero:true, title:{ display:true, text:'Acumulado' }, ticks:{ callback:v => fmt(v) }, grid:{ display:false } } } }
  });
}

function weekRange(rows, key){
  if(!rows.length) return [];
  const ws = rows.map(r => weekStart(r[key]));
  const a = Math.min(...ws), b = Math.max(...ws), out = [];
  for(let w = a; w <= b; w += 7) out.push(w);
  return out;
}

function updateCharts(rows){
  const cus = DICTS.cu.filter(c => rows.some(r => r.cu === c));
  charts.cu.data.labels = cus;
  BUCKETS.forEach((_,i) => charts.cu.data.datasets[i].data = cus.map(c => sum(rows, r => r.cu === c && r.bk === i)));
  charts.cu.update();

  const vw = weekRange(rows, 'venN');
  charts.ven.data.labels = vw.map(fmtDate);
  DICTS.cu.forEach((c,i) => charts.ven.data.datasets[i].data = vw.map(w => sum(rows, r => r.cu === c && weekStart(r.venN) === w)));
  charts.ven.update();

  const tipos = DICTS.tipo.map(t => [t, sum(rows, r => r.tipo === t)]).filter(x => x[1]).sort((a,b) => b[1] - a[1]);
  charts.tipo.$names = tipos.map(x => x[0]);
  charts.tipo.data.labels = tipos.map(x => wrap(x[0], 30));
  charts.tipo.data.datasets[0].data = tipos.map(x => x[1]);
  charts.tipo.$extra = tipos.map(x => { const p = PLAZOS[x[0]]; return p ? ` Plazo de respuesta: ${p.dias} días hábiles (gestión ${p.gestion.toLowerCase()})` : ''; });
  charts.tipo.update();

  const tot = sum(rows);
  charts.est.data.datasets[0].data = DICTS.est.map(e => sum(rows, r => r.est === e));
  charts.est.options.plugins.centerText.text = fmt(tot);
  charts.est.update();

  const rw = weekRange(rows, 'recN');
  charts.rec.data.labels = rw.map(fmtDate);
  charts.rec.data.datasets[0].data = rw.map(w => sum(rows, r => weekStart(r.recN) === w));
  let acc = 0;
  charts.rec.data.datasets[1].data = charts.rec.data.datasets[0].data.map(v => acc += v);
  charts.rec.update();
}

/* ---------- Matriz programa x CU ---------- */
function progList(rows){
  const m = new Map();
  rows.forEach(r => { if(!m.has(r.prog)) m.set(r.prog, r.niv); });
  return [...m.entries()].map(([prog,niv]) => ({ prog, niv }))
    .sort((a,b) => NIVEL_ORDER.indexOf(a.niv) - NIVEL_ORDER.indexOf(b.niv) || sum(rows, r => r.prog === b.prog) - sum(rows, r => r.prog === a.prog));
}
function renderMatrix(rows){
  const cus = DICTS.cu.filter(c => rows.some(r => r.cu === c));
  const progs = progList(rows);
  const t = document.getElementById('matrix');
  if(!progs.length){ t.innerHTML = '<tbody><tr><td class="empty">No hay solicitudes con los filtros seleccionados.</td></tr></tbody>'; return; }
  let html = `<thead><tr><th>Programa</th>${cus.map(c => `<th class="center">${esc(c)}</th>`).join('')}<th class="center">Total</th><th class="r">Próximo vencimiento</th></tr></thead><tbody>`;
  let last = null;
  progs.forEach(p => {
    if(p.niv !== last){ html += `<tr class="nivel-row"><td colspan="${cus.length + 3}">${esc(p.niv)}</td></tr>`; last = p.niv; }
    const mine = rows.filter(r => r.prog === p.prog);
    html += `<tr><td class="prog">${esc(p.prog)}</td>`;
    cus.forEach(c => {
      const cell = mine.filter(r => r.cu === c);
      const n = sum(cell);
      if(!n){ html += `<td class="center" style="color:#C5CDD8">·</td>`; return; }
      const mn = Math.min(...cell.map(r => r.dr));
      html += `<td class="center"><span class="cell ${urgClass(mn)}" title="${esc(c)}: ${fmt(n)} solicitudes; la más próxima vence en ${fmt(mn)} días">${fmt(n)}</span></td>`;
    });
    const mn = Math.min(...mine.map(r => r.dr)), nx = Math.min(...mine.map(r => r.venN));
    html += `<td class="center tot">${fmt(sum(mine))}</td><td class="r"><span class="pill ${urgClass(mn)}">${fmtDate(nx)} · ${fmt(mn)} d</span></td></tr>`;
  });
  t.innerHTML = html + '</tbody>';
}

/* ---------- Tabla de detalle ---------- */
const COLS = [
  { key:'prog', label:'Programa' }, { key:'niv', label:'Nivel' },
  { key:'sol', label:'Solicitudes', num:true }, { key:'b7', label:'≤ 7 días', num:true },
  { key:'b30', label:'8 a 30 días', num:true }, { key:'b31', label:'> 30 días', num:true },
  { key:'rap', label:'RAP', num:true }, { key:'dias', label:'Días prom. en gestión', num:true },
  { key:'prox', label:'Próximo vencimiento', num:true }, { key:'cons', label:'Plazo consumido', num:true }
];
const RAP = () => DICTS.tipo.find(t => t.includes('RAP'));
function detailRows(rows){
  const q = state.q.trim().toLowerCase();
  const rap = RAP();
  let out = progList(rows).map(p => {
    const mine = rows.filter(r => r.prog === p.prog);
    return { prog:p.prog, niv:p.niv, sol:sum(mine),
      b7:sum(mine, r => r.dr <= 7), b30:sum(mine, r => r.dr > 7 && r.dr <= 30), b31:sum(mine, r => r.dr > 30),
      rap:sum(mine, r => r.tipo === rap), dias:+wavg(mine, r => r.dt).toFixed(1),
      prox:Math.min(...mine.map(r => r.venN)), pdr:Math.min(...mine.map(r => r.dr)),
      cons:+wavg(mine, r => r.cons).toFixed(1) };
  });
  if(q) out = out.filter(r => r.prog.toLowerCase().includes(q));
  const k = state.sortKey;
  out.sort((a,b) => {
    const av = a[k], bv = b[k];
    const c = (typeof av === 'number') ? av - bv : String(av).localeCompare(String(bv),'es');
    return c * state.sortDir;
  });
  return out;
}
function renderDetail(rows){
  const list = detailRows(rows);
  const t = document.getElementById('detail');
  const head = COLS.map(c => {
    const arr = state.sortKey === c.key ? `<span class="arr">${state.sortDir === 1 ? '▲' : '▼'}</span>` : '';
    return `<th class="sortable${c.num ? ' r' : ''}" data-k="${c.key}" tabindex="0">${c.label}${arr}</th>`;
  }).join('');
  t.innerHTML = `<thead><tr>${head}</tr></thead><tbody>` + (list.length ? list.map(r => `<tr>
      <td class="prog">${esc(r.prog)}</td><td>${esc(r.niv)}</td>
      <td class="r tot">${fmt(r.sol)}</td><td class="r">${r.b7 ? `<span class="pill u0">${fmt(r.b7)}</span>` : '0'}</td>
      <td class="r">${fmt(r.b30)}</td><td class="r">${fmt(r.b31)}</td><td class="r">${fmt(r.rap)}</td>
      <td class="r">${fmt1(r.dias)}</td><td class="r"><span class="pill ${urgClass(r.pdr)}">${fmtDate(r.prox)}</span></td>
      <td><div class="conv"><span class="bar"><i style="width:${Math.min(r.cons,100)}%;background:${r.cons >= 75 ? '#A8553F' : r.cons >= 50 ? '#E2962B' : '#2F7A6D'}"></i></span><b>${fmtPct(r.cons)}</b></div></td></tr>`).join('')
    : `<tr><td colspan="${COLS.length}" class="empty">No hay programas con los filtros y la búsqueda actuales.</td></tr>`) + '</tbody>';
  t.querySelectorAll('th.sortable').forEach(th => {
    const go = () => {
      const k = th.dataset.k, col = COLS.find(c => c.key === k);
      if(state.sortKey === k) state.sortDir *= -1; else { state.sortKey = k; state.sortDir = (col.num && k !== 'prox') ? -1 : 1; }
      renderDetail(filtered());
    };
    th.onclick = go;
    th.onkeydown = e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } };
  });
}
function downloadCSV(){
  const list = detailRows(filtered());
  const q = v => '"' + String(v ?? '').replace(/"/g,'""') + '"';
  const val = (r,k) => k === 'prox' ? isoOf(r.prox) : (k === 'dias' || k === 'cons') ? String(r[k]).replace('.',',') : r[k];
  const lines = [COLS.map(c => q(c.label)).join(';')].concat(list.map(r => COLS.map(c => q(val(r, c.key))).join(';')));
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `solicitudes_academicas_programas_corte_${META.corte}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- Render ---------- */
function render(){
  const rows = filtered();
  renderFilters();
  renderKPIs(rows);
  renderBuckets(rows);
  renderAlerts(rows);
  updateCharts(rows);
  renderMatrix(rows);
  renderDetail(rows);
}

function boot(raw){
  META = raw.meta; DICTS = raw.dicts; PLAZOS = raw.plazos || {};
  CORTE = dayNum(META.corte);
  const cols = raw.cols;
  DATA = raw.rows.map(a => {
    const o = {};
    cols.forEach((c,i) => { o[c] = c === 'n' ? a[i] : DICTS[c][a[i]]; });
    o.recN = dayNum(o.rec); o.venN = dayNum(o.ven);
    o.dr = o.venN - CORTE;                       // días que faltan para vencer
    o.dt = Math.max(0, CORTE - o.recN);          // días en gestión
    const total = Math.max(1, o.venN - o.recN);
    o.cons = Math.min(100, Math.max(0, o.dt / total * 100));
    o.bk = bucketOf(o.dr);
    o.mes = String(new Date(o.recN * 864e5).getUTCMonth());
    return o;
  });
  const meses = [...new Set(DATA.map(r => +r.mes))].sort((a,b) => a-b).map(String);
  DIMS = [
    { key:'cu',   label:'Centro Universitario', order:DICTS.cu },
    { key:'tipo', label:'Tipo de solicitud',    order:DICTS.tipo },
    { key:'est',  label:'Estado en SAP',        order:DICTS.est.slice().sort((a,b) => (b === 'TR') - (a === 'TR')), label_of: e => EST_LABEL[e] || e },
    { key:'niv',  label:'Nivel de formación',   order:NIVEL_ORDER.filter(n => DICTS.niv.includes(n)) },
    { key:'mes',  label:'Mes de radicación',    order:meses, label_of: m => MES_LARGO[+m] }
  ];
  document.getElementById('corte').innerHTML = `<i></i>Corte ${fmtDateLong(CORTE)}`;
  document.getElementById('footer').textContent =
    `Fuente: ${META.fuente}, corte ${fmtDateLong(CORTE)}. ${fmt(META.registros)} solicitudes abiertas. ` +
    `Los días restantes y el plazo consumido se calculan en días calendario frente a la fecha de vencimiento registrada en SAP. ` +
    `No incluye Centros Universitarios de otras sedes. Datos agregados, sin información personal.`;

  document.getElementById('progFilter').onchange = e => { state.prog = e.target.value; render(); };
  document.getElementById('resetBtn').onclick = () => { DIMS.forEach(d => state[d.key].clear()); state.prog = ''; render(); };
  document.getElementById('search').oninput = e => { state.q = e.target.value; renderDetail(filtered()); };
  document.getElementById('csvBtn').onclick = downloadCSV;

  initCharts();
  render();
}

if(window.__DATA__) boot(window.__DATA__);
else fetch('data.json', { cache:'no-cache' })
  .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
  .then(boot)
  .catch(() => {
    document.querySelector('.main').innerHTML = `<div class="load-error"><h3>No se pudieron cargar los datos</h3>
      <p style="margin-top:8px;color:#66768A">El tablero necesita el archivo <b>data.json</b> en la misma carpeta que index.html. Si abrió el archivo directamente desde su equipo, use <b>preview_standalone.html</b> o publíquelo en GitHub Pages.</p></div>`;
  });
