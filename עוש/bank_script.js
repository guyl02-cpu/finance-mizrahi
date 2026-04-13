'use strict';

const PIE_COLORS_BANK = ['#5b6af0','#22d3a5','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#f97316','#84cc16','#e11d48','#0ea5e9'];

let bankLineChart, bankPieChart, bankWeekChart, bankYearChart;
let currentTxData = [];
let allMonthsData = null;

function fmtBank(n) {
  if (n === null || n === undefined) return '\u2014';
  return '\u20AA' + Math.abs(n).toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateBank(iso) {
  if (!iso) return '\u2014';
  const [y, m, d] = iso.split('-');
  return d + '/' + m + '/' + y;
}

function categorize(type, desc) {
  const s = (type + ' ' + desc).toLowerCase();
  if (/\u05D9\u05E9\u05E8\u05D0\u05DB\u05E8\u05D8|\u05D0\u05E9\u05E8\u05D0\u05D9|\u05DB\u05E8\u05D8\u05D9\u05E1/.test(s)) return '\u05D0\u05E9\u05E8\u05D0\u05D9';
  if (/\u05E8\u05D5\u05E4\u05D0|\u05E7\u05D5\u05E4\u05EA \u05D7\u05D5\u05DC\u05D9\u05DD|\u05DE\u05E7\u05E4\u05EA|\u05D3\u05E0\u05D8\u05DC|\u05D1\u05D9\u05EA \u05D7\u05D5\u05DC\u05D9\u05DD|\u05DE\u05E8\u05E4\u05D0\u05D4/.test(s)) return '\u05D1\u05E8\u05D9\u05D0\u05D5\u05EA';
  if (/netflix|icloud|google|youtube|chatgpt|spotify|apple/.test(s)) return '\u05DE\u05E0\u05D5\u05D9\u05D9\u05DD \u05D3\u05D9\u05D2\u05D9\u05D8\u05DC\u05D9\u05D9\u05DD';
  if (/\u05DE\u05D6\u05D5\u05DE\u05DF|\u05D1\u05E0\u05E7.\u05E7\u05D8|\u05DB\u05E1\u05E4\u05D5\u05DE\u05D8/.test(s)) return '\u05DE\u05D6\u05D5\u05DE\u05DF';
  if (/\u05E4\u05E0\u05E1\u05D9\u05D4|\u05D4\u05E1\u05EA\u05D3\u05E8\u05D5\u05EA|\u05D1\u05D9\u05D8\u05D5\u05D7 \u05DC\u05D0\u05D5\u05DE\u05D9|\u05D2\u05DE\u05DC|\u05D4\u05E9\u05EA\u05DC\u05DE\u05D5\u05EA|\u05E4\u05E7\u05DE/.test(s)) return '\u05D1\u05D9\u05D8\u05D5\u05D7 \u05D5\u05D7\u05D9\u05E1\u05DB\u05D5\u05DF';
  if (/\u05D1\u05D9\u05D8|\u05E9\u05D9\u05E7|\u05D4\u05E2\u05D1\u05E8\u05D4|\u05D4\u05E4\u05E7\u05D3/.test(s)) return '\u05D4\u05E2\u05D1\u05E8\u05D5\u05EA';
  return '\u05DB\u05DC\u05DC\u05D9';
}

/* ---- טעינת רשימת חודשים ---- */
async function loadBankMonthList() {
  const res = await fetch('/api/bank/list');
  const list = await res.json();
  const select = document.getElementById('bank-month-select');
  select.innerHTML = '';

  // אפשרות ראשונה: תצוגה כוללת של כל החודשים
  const allOpt = document.createElement('option');
  allOpt.value = '__all__';
  allOpt.textContent = '\u25C4 \u05DB\u05DC \u05D4\u05D7\u05D5\u05D3\u05E9\u05D9\u05DD \u2014 \u05EA\u05E6\u05D5\u05D2\u05D4 \u05DB\u05D5\u05DC\u05DC\u05EA';
  select.appendChild(allOpt);

  list.forEach(item => {
    const opt = document.createElement('option');
    opt.value = item.filename;
    opt.textContent = item.monthLabel;
    select.appendChild(opt);
  });
  if (list.length > 0) select.value = list[list.length - 1].filename;
  return list;
}

/* ---- טעינת חודש בודד ---- */
async function loadBankMonth(filename) {
  // אפס כותרות לתצוגה חודשית
  document.getElementById('label-credits').textContent = '\u05E1\u05DA \u05D4\u05DB\u05E0\u05E1\u05D5\u05EA \u05D4\u05D7\u05D5\u05D3\u05E9';
  document.getElementById('label-debits').textContent  = '\u05E1\u05DA \u05D4\u05D5\u05E6\u05D0\u05D5\u05EA \u05D4\u05D7\u05D5\u05D3\u05E9';
  document.getElementById('week-chart-title').textContent = '\u05D4\u05DB\u05E0\u05E1\u05D5\u05EA \u05DE\u05D5\u05DC \u05D4\u05D5\u05E6\u05D0\u05D5\u05EA \u05DC\u05E4\u05D9 \u05E9\u05D1\u05D5\u05E2';
  const res = await fetch('/api/bank/' + encodeURIComponent(filename));
  const data = await res.json();
  currentTxData = data.transactions;
  renderMonthlySummary(currentTxData);
  renderBankLineChart(currentTxData);
  renderBankWeekChart(currentTxData);
  renderBankPieChart(currentTxData);
  populateTypeFilter(currentTxData);
  renderBankTable(currentTxData);
  renderTop3(currentTxData);
}

/* ---- תצוגה כוללת – כל החודשים ---- */
function renderAllView() {
  if (!allMonthsData || !allMonthsData.length) return;
  const allTxs = allMonthsData.flatMap(m => m.transactions);
  currentTxData = allTxs;

  // עדכן כותרות כרטיסים
  document.getElementById('label-credits').textContent = '\u05E1\u05DA \u05DB\u05DC \u05D4\u05D6\u05DB\u05D5\u05D9\u05D5\u05EA';
  document.getElementById('label-debits').textContent  = '\u05E1\u05DA \u05DB\u05DC \u05D4\u05D7\u05D5\u05D1\u05D5\u05EA';
  document.getElementById('week-chart-title').textContent = '\u05D4\u05DB\u05E0\u05E1\u05D5\u05EA \u05DE\u05D5\u05DC \u05D4\u05D5\u05E6\u05D0\u05D5\u05EA \u05DC\u05E4\u05D9 \u05D7\u05D5\u05D3\u05E9';

  renderMonthlySummary(allTxs);
  renderBankLineChart(allTxs);
  renderMonthlyBarChart(allMonthsData);   // גרף עמודות לפי חודש
  renderBankPieChart(allTxs);
  populateTypeFilter(allTxs);
  renderBankTable(allTxs);
  renderTop3(allTxs);
}

/* ---- טעינת כל החודשים (לסיכום התחתון ולתצוגה הכוללת) ---- */
async function loadAllMonths(list) {
  const allMonths = [];
  for (const item of list) {
    const res = await fetch('/api/bank/' + encodeURIComponent(item.filename));
    const data = await res.json();
    allMonths.push({ ...item, transactions: data.transactions });
  }
  allMonthsData = allMonths;
  renderOverallSummary(allMonths);
  renderYearChart(allMonths);
  renderMonthlyTable(allMonths);
}

/* ---- כרטיסי סיכום חודשי ---- */
function renderMonthlySummary(txs) {
  const totalCredit = txs.reduce((s, r) => s + (r.credit || 0), 0);
  const totalDebit  = txs.reduce((s, r) => s + (r.debit  || 0), 0);
  const net = totalCredit - totalDebit;
  const lastTx = [...txs].reverse().find(r => r.balance !== null);
  const balance = lastTx ? lastTx.balance : null;

  const balEl = document.getElementById('bank-balance');
  balEl.textContent = balance !== null ? fmtBank(balance) : '\u2014';
  balEl.style.color = (balance !== null && balance >= 0) ? 'var(--green)' : '#ef4444';

  document.getElementById('bank-credits').textContent = fmtBank(totalCredit);
  document.getElementById('bank-debits').textContent  = fmtBank(totalDebit);

  const netEl = document.getElementById('bank-net');
  netEl.textContent = fmtBank(Math.abs(net));
  netEl.style.color = net >= 0 ? 'var(--green)' : '#ef4444';
}

/* ---- גרף קו: מגמת יתרה ---- */
function renderBankLineChart(txs) {
  const ctx = document.getElementById('bankLineChart').getContext('2d');
  if (bankLineChart) bankLineChart.destroy();
  const byDate = {};
  txs.forEach(r => { if (r.date && r.balance !== null) byDate[r.date] = r.balance; });
  const dates = Object.keys(byDate).sort();
  bankLineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(formatDateBank),
      datasets: [{
        label: '\u05D9\u05EA\u05E8\u05D4 (\u20AA)',
        data: dates.map(d => byDate[d]),
        borderColor: '#5b6af0', backgroundColor: 'rgba(91,106,240,0.1)',
        fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmtBank(c.parsed.y) } } },
      scales: {
        x: { grid: { color: '#2e3250' } },
        y: { grid: { color: '#2e3250' }, ticks: { callback: v => '\u20AA' + v.toLocaleString('he-IL') } }
      }
    }
  });
}

/* ---- גרף עמודות: לפי שבוע (חודש בודד) ---- */
function renderBankWeekChart(txs) {
  const ctx = document.getElementById('bankWeekChart').getContext('2d');
  if (bankWeekChart) bankWeekChart.destroy();
  const weeks = {};
  txs.forEach(r => {
    if (!r.date) return;
    const day = parseInt(r.date.split('-')[2], 10);
    const key = '\u05E9\u05D1\u05D5\u05E2 ' + Math.ceil(day / 7);
    if (!weeks[key]) weeks[key] = { credit: 0, debit: 0 };
    if (r.credit) weeks[key].credit += r.credit;
    if (r.debit)  weeks[key].debit  += r.debit;
  });
  const labels = Object.keys(weeks);
  bankWeekChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '\u05D6\u05DB\u05D5\u05D9\u05D5\u05EA', data: labels.map(k => +weeks[k].credit.toFixed(2)), backgroundColor: 'rgba(34,211,165,0.75)', borderColor: '#22d3a5', borderWidth: 1.5, borderRadius: 6 },
        { label: '\u05D7\u05D5\u05D1\u05D5\u05EA',  data: labels.map(k => +weeks[k].debit.toFixed(2)),  backgroundColor: 'rgba(239,68,68,0.75)',   borderColor: '#ef4444', borderWidth: 1.5, borderRadius: 6 }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', labels: { padding: 14, boxWidth: 12 } },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmtBank(c.parsed.y) } }
      },
      scales: {
        x: { grid: { color: '#2e3250' } },
        y: { grid: { color: '#2e3250' }, ticks: { callback: v => '\u20AA' + v.toLocaleString('he-IL') } }
      }
    }
  });
}

/* ---- גרף עמודות: לפי חודש (תצוגה כוללת) ---- */
function renderMonthlyBarChart(months) {
  const ctx = document.getElementById('bankWeekChart').getContext('2d');
  if (bankWeekChart) bankWeekChart.destroy();
  bankWeekChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.monthLabel),
      datasets: [
        {
          label: '\u05D6\u05DB\u05D5\u05D9\u05D5\u05EA',
          data: months.map(m => +m.transactions.reduce((s, r) => s + (r.credit || 0), 0).toFixed(2)),
          backgroundColor: 'rgba(34,211,165,0.75)', borderColor: '#22d3a5', borderWidth: 1.5, borderRadius: 6
        },
        {
          label: '\u05D7\u05D5\u05D1\u05D5\u05EA',
          data: months.map(m => +m.transactions.reduce((s, r) => s + (r.debit  || 0), 0).toFixed(2)),
          backgroundColor: 'rgba(239,68,68,0.75)', borderColor: '#ef4444', borderWidth: 1.5, borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'top', labels: { padding: 14, boxWidth: 12 } },
        tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ': ' + fmtBank(c.parsed.y) } }
      },
      scales: {
        x: { grid: { color: '#2e3250' } },
        y: { grid: { color: '#2e3250' }, ticks: { callback: v => '\u20AA' + v.toLocaleString('he-IL') } }
      }
    }
  });
}

/* ---- גרף עוגה: קטגוריות ---- */
function renderBankPieChart(txs) {
  const ctx = document.getElementById('bankPieChart').getContext('2d');
  if (bankPieChart) bankPieChart.destroy();
  const cats = {};
  txs.filter(r => r.debit).forEach(r => {
    const cat = categorize(r.type, r.description);
    cats[cat] = (cats[cat] || 0) + r.debit;
  });
  if (!Object.keys(cats).length) return;
  const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
  const total  = sorted.reduce((s, [, v]) => s + v, 0);
  bankPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(e => e[0]),
      datasets: [{
        data: sorted.map(e => +e[1].toFixed(2)),
        backgroundColor: sorted.map((_, i) => PIE_COLORS_BANK[i % PIE_COLORS_BANK.length]),
        borderColor: '#1a1d27', borderWidth: 2, hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ' ' + fmtBank(c.parsed) + ' (' + ((c.parsed / total) * 100).toFixed(1) + '%)' } }
      }
    }
  });
}

/* ---- סינון סוג תנועה ---- */
function populateTypeFilter(txs) {
  const types = [...new Set(txs.map(r => r.type).filter(Boolean))].sort();
  const select = document.getElementById('bank-type-filter');
  select.innerHTML = '<option value="">\u05DB\u05DC \u05D4\u05E1\u05D5\u05D2\u05D9\u05DD</option>';
  types.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t; opt.textContent = t;
    select.appendChild(opt);
  });
}

/* ---- טבלת תנועות ---- */
function renderBankTable(txs) {
  const tbody  = document.querySelector('#bank-tx-table tbody');
  const search = (document.getElementById('bank-search').value || '').toLowerCase();
  const filter = document.getElementById('bank-type-filter').value;
  tbody.innerHTML = '';
  txs.filter(r => {
    if (filter && r.type !== filter) return false;
    if (search && !(r.description || '').toLowerCase().includes(search) && !r.type.toLowerCase().includes(search)) return false;
    return true;
  }).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + formatDateBank(r.date) + '</td>' +
      '<td>' + (r.description || '\u2014') + '</td>' +
      '<td>' + r.type + '</td>' +
      '<td class="' + (r.debit  ? 'debit-cell'  : '') + '">' + (r.debit  ? fmtBank(r.debit)  : '\u2014') + '</td>' +
      '<td class="' + (r.credit ? 'credit-cell' : '') + '">' + (r.credit ? fmtBank(r.credit) : '\u2014') + '</td>' +
      '<td>' + (r.balance !== null ? fmtBank(r.balance) : '\u2014') + '</td>';
    tbody.appendChild(tr);
  });
}

/* ---- 3 הוצאות גדולות ---- */
function renderTop3(txs) {
  const top3 = txs.filter(r => r.debit).sort((a, b) => b.debit - a.debit).slice(0, 3);
  const el = document.getElementById('bank-top3');
  if (!top3.length) {
    el.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">\u05D0\u05D9\u05DF \u05D4\u05D5\u05E6\u05D0\u05D5\u05EA</p>';
    return;
  }
  el.innerHTML = top3.map((r, i) =>
    '<div class="top3-item">' +
    '<span class="top3-rank">' + (i + 1) + '</span>' +
    '<div class="top3-info">' +
    '<div class="top3-desc">' + (r.description || r.type) + '</div>' +
    '<div class="top3-date">' + formatDateBank(r.date) + '</div>' +
    '</div>' +
    '<span class="top3-amount">' + fmtBank(r.debit) + '</span>' +
    '</div>'
  ).join('');
}

/* ---- סיכום כולל (חלק ב) ---- */
function renderOverallSummary(months) {
  const totalCredit = months.reduce((s, m) => s + m.transactions.reduce((ss, r) => ss + (r.credit || 0), 0), 0);
  const totalDebit  = months.reduce((s, m) => s + m.transactions.reduce((ss, r) => ss + (r.debit  || 0), 0), 0);
  const lastM  = months[months.length - 1];
  const lastTx = lastM ? [...lastM.transactions].reverse().find(r => r.balance !== null) : null;
  const lastBal = lastTx ? lastTx.balance : null;
  document.getElementById('overall-credits').textContent = fmtBank(totalCredit);
  document.getElementById('overall-debits').textContent  = fmtBank(totalDebit);
  const balEl = document.getElementById('overall-balance');
  balEl.textContent = lastBal !== null ? fmtBank(lastBal) : '\u2014';
  if (lastBal !== null) balEl.style.color = lastBal >= 0 ? 'var(--green)' : '#ef4444';
}

/* ---- גרף קו שנתי ---- */
function renderYearChart(months) {
  const ctx = document.getElementById('bankYearChart').getContext('2d');
  if (bankYearChart) bankYearChart.destroy();
  bankYearChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: months.map(m => m.monthLabel),
      datasets: [{
        label: '\u05D9\u05EA\u05E8\u05D4 \u05E1\u05D5\u05E3 \u05D7\u05D5\u05D3\u05E9 (\u20AA)',
        data: months.map(m => {
          const tx = [...m.transactions].reverse().find(r => r.balance !== null);
          return tx ? tx.balance : null;
        }),
        borderColor: '#22d3a5', backgroundColor: 'rgba(34,211,165,0.1)',
        fill: true, tension: 0.3, pointRadius: 5, pointHoverRadius: 7
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => ' ' + fmtBank(c.parsed.y) } } },
      scales: {
        x: { grid: { color: '#2e3250' } },
        y: { grid: { color: '#2e3250' }, ticks: { callback: v => '\u20AA' + v.toLocaleString('he-IL') } }
      }
    }
  });
}

/* ---- טבלת סיכום חודשי ---- */
function renderMonthlyTable(months) {
  const tbody = document.querySelector('#bank-monthly-table tbody');
  tbody.innerHTML = '';
  let totalCredit = 0, totalDebit = 0;
  months.forEach(m => {
    const credits = m.transactions.reduce((s, r) => s + (r.credit || 0), 0);
    const debits  = m.transactions.reduce((s, r) => s + (r.debit  || 0), 0);
    const net     = credits - debits;
    const lastTx  = [...m.transactions].reverse().find(r => r.balance !== null);
    const balance = lastTx ? lastTx.balance : null;
    totalCredit += credits; totalDebit += debits;
    const tr = document.createElement('tr');
    if (debits > credits) tr.classList.add('deficit-row');
    tr.innerHTML =
      '<td>' + m.monthLabel + '</td>' +
      '<td class="credit-cell">' + fmtBank(credits) + '</td>' +
      '<td class="debit-cell">'  + fmtBank(debits)  + '</td>' +
      '<td class="' + (net >= 0 ? 'credit-cell' : 'debit-cell') + '">' + fmtBank(Math.abs(net)) + '</td>' +
      '<td>' + (balance !== null ? fmtBank(balance) : '\u2014') + '</td>';
    tbody.appendChild(tr);
  });
  const totalNet = totalCredit - totalDebit;
  document.getElementById('ft-credits').textContent = fmtBank(totalCredit);
  document.getElementById('ft-debits').textContent  = fmtBank(totalDebit);
  document.getElementById('ft-net').textContent     = fmtBank(Math.abs(totalNet));
  const lastM  = months[months.length - 1];
  const lastTx = lastM ? [...lastM.transactions].reverse().find(r => r.balance !== null) : null;
  document.getElementById('ft-balance').textContent = lastTx ? fmtBank(lastTx.balance) : '\u2014';
}

/* ---- ייצוא PDF ---- */
async function exportBankPDF() {
  const btn = document.getElementById('bank-export-pdf');
  btn.disabled = true; btn.textContent = '\u05DE\u05D9\u05D9\u05E6\u05E8...';
  try {
    const { jsPDF } = window.jspdf;
    const pdf   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const section = document.getElementById('section-bank');
    const canvas  = await html2canvas(section, {
      backgroundColor: '#0f1117', scale: 1.5, useCORS: true,
      ignoreElements: el => el.id === 'bank-export-pdf'
    });
    const ratio  = canvas.width / pageW;
    const sliceH = Math.floor(pageH * ratio);
    let offsetY = 0, first = true;
    while (offsetY < canvas.height) {
      const chunk = Math.min(sliceH, canvas.height - offsetY);
      const pc = document.createElement('canvas');
      pc.width = canvas.width; pc.height = chunk;
      pc.getContext('2d').drawImage(canvas, 0, offsetY, canvas.width, chunk, 0, 0, canvas.width, chunk);
      if (!first) pdf.addPage();
      pdf.addImage(pc.toDataURL('image/png'), 'PNG', 0, 0, pageW, chunk / ratio);
      offsetY += sliceH; first = false;
    }
    const sel = document.getElementById('bank-month-select');
    const mn  = sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].textContent.replace(/[◀ —]/g, '').trim() : '';
    pdf.save('\u05E2\u05D5\u05E9_' + mn + '.pdf');
  } catch(e) { alert('\u05E9\u05D2\u05D9\u05D0\u05D4 \u05D1\u05D9\u05D9\u05E6\u05D5\u05D0: ' + e.message); console.error(e); }
  btn.disabled = false; btn.textContent = '\u05D9\u05D9\u05E6\u05D5\u05D0 PDF \u2193';
}

/* ---- אתחול ---- */
async function initBank() {
  try {
    const list = await loadBankMonthList();
    if (list.length > 0) await loadBankMonth(list[list.length - 1].filename);
    await loadAllMonths(list);
  } catch(e) { console.error('Bank init error:', e); }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('bank-month-select').addEventListener('change', function() {
    if (this.value === '__all__') {
      renderAllView();
    } else {
      loadBankMonth(this.value);
    }
  });
  document.getElementById('bank-search').addEventListener('input', function() { renderBankTable(currentTxData); });
  document.getElementById('bank-type-filter').addEventListener('change', function() { renderBankTable(currentTxData); });
});
