const MONTH_NAMES = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
const PIE_COLORS = ['#5b6af0','#22d3a5','#f59e0b','#ec4899','#8b5cf6','#06b6d4','#f97316','#84cc16','#e11d48','#0ea5e9','#a78bfa','#34d399'];

function fmt(n) { return '₪' + n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(iso) { const [y, m, d] = iso.split('-'); return d + '/' + m + '/' + y; }
function getMonthKey(iso) { return iso.slice(0, 7); }
function monthLabel(key) { const [y, m] = key.split('-'); return MONTH_NAMES[parseInt(m, 10) - 1] + ' ' + y; }

let barChart, pieChart;

function renderSummary(data) {
  const total = data.reduce((s, r) => s + r.amount, 0);
  const months = new Set(data.map(r => getMonthKey(r.date)));
  const avg = months.size > 0 ? total / months.size : 0;
  const maxRow = data.reduce((b, r) => r.amount > b.amount ? r : b, data[0]);
  document.getElementById('total').textContent = fmt(total);
  document.getElementById('monthly-avg').textContent = fmt(avg);
  document.getElementById('tx-count').textContent = data.length.toLocaleString('he-IL');
  document.getElementById('max-expense').textContent = maxRow ? fmt(maxRow.amount) : '—';
  document.getElementById('last-updated').textContent = 'עודכן: ' + new Date().toLocaleString('he-IL');
}

function renderBarChart(data) {
  const map = {};
  data.forEach(r => { const k = getMonthKey(r.date); map[k] = (map[k] || 0) + r.amount; });
  const keys = Object.keys(map).sort();
  const ctx = document.getElementById('barChart').getContext('2d');
  if (barChart) barChart.destroy();
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: keys.map(monthLabel),
      datasets: [{
        label: 'הוצאות (₪)',
        data: keys.map(k => +map[k].toFixed(2)),
        backgroundColor: 'rgba(91,106,240,0.75)',
        borderColor: '#5b6af0',
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed.y) } }
      },
      scales: {
        x: { grid: { color: '#2e3250' } },
        y: { grid: { color: '#2e3250' }, ticks: { callback: v => '₪' + v.toLocaleString('he-IL') } }
      }
    }
  });
}

function renderPieChart(data) {
  const total = data.reduce((s, r) => s + r.amount, 0);
  const biz = {};
  data.forEach(r => { biz[r.business] = (biz[r.business] || 0) + r.amount; });
  const thr = total * 0.05;
  let other = 0;
  const fil = {};
  for (const [k, v] of Object.entries(biz)) {
    if (v >= thr) fil[k] = v; else other += v;
  }
  if (other > 0) fil['אחר'] = other;
  const sorted = Object.entries(fil).sort((a, b) => b[1] - a[1]);
  const ctx = document.getElementById('pieChart').getContext('2d');
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(e => e[0]),
      datasets: [{
        data: sorted.map(e => +e[1].toFixed(2)),
        backgroundColor: sorted.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
        borderColor: '#1a1d27',
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 14, boxWidth: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ' ' + fmt(c.parsed) + ' (' + ((c.parsed / total) * 100).toFixed(1) + '%)' } }
      }
    }
  });
}

function renderTable(data) {
  const top = [...data].sort((a, b) => b.amount - a.amount).slice(0, 10);
  const tbody = document.querySelector('#top-table tbody');
  tbody.innerHTML = '';
  top.forEach((r, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + (i + 1) + '</td><td>' + formatDate(r.date) + '</td><td>' + r.business + '</td><td>' + fmt(r.amount) + '</td>';
    tbody.appendChild(tr);
  });
}

async function loadAndRender() {
  try {
    const res = await fetch('/data.json?t=' + Date.now());
    if (!res.ok) throw new Error('Failed');
    const data = await res.json();
    if (!data.length) { document.getElementById('last-updated').textContent = 'לא נמצאו נתונים'; return; }
    renderSummary(data);
    renderBarChart(data);
    renderPieChart(data);
    renderTable(data);
  } catch (e) { console.error(e); }
}

Chart.defaults.color = '#8b90b8';
Chart.defaults.borderColor = '#2e3250';
Chart.defaults.font.family = "Segoe UI, Arial, sans-serif";
loadAndRender();
setInterval(loadAndRender, 5 * 60 * 1000);
