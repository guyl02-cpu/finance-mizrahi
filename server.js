const express = require('express');
const xlsx = require('xlsx');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DIR = __dirname;

// On Railway, DATA_DIR points to the persistent volume. Locally falls back to __dirname.
const DATA_DIR = process.env.DATA_DIR || DIR;
const EXCEL_DIR = path.join(DATA_DIR, '\u05D0\u05E9\u05E8\u05D0\u05D9');
const BANK_DIR  = path.join(DATA_DIR, '\u05E2\u05D5\u05E9');
const DATA_FILE = path.join(DATA_DIR, 'data.json');

const MONTH_HE = {'\u05D9\u05E0\u05D5\u05D0\u05E8':1,'\u05E4\u05D1\u05E8\u05D5\u05D0\u05E8':2,'\u05DE\u05E8\u05E5':3,'\u05D0\u05E4\u05E8\u05D9\u05DC':4,'\u05DE\u05D0\u05D9':5,'\u05D9\u05D5\u05E0\u05D9':6,'\u05D9\u05D5\u05DC\u05D9':7,'\u05D0\u05D5\u05D2\u05D5\u05E1\u05D8':8,'\u05E1\u05E4\u05D8\u05DE\u05D1\u05E8':9,'\u05D0\u05D5\u05E7\u05D8\u05D5\u05D1\u05E8':10,'\u05E0\u05D5\u05D1\u05DE\u05D1\u05E8':11,'\u05D3\u05E6\u05DE\u05D1\u05E8':12};

// Ensure directories exist
if (!fs.existsSync(EXCEL_DIR)) fs.mkdirSync(EXCEL_DIR, { recursive: true });
if (!fs.existsSync(BANK_DIR))  fs.mkdirSync(BANK_DIR,  { recursive: true });

// Multer: store uploaded files in memory, then save manually
const upload = multer({ storage: multer.memoryStorage() });

function parseBankFile(filepath) {
  const wb = xlsx.readFile(filepath, { raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  return rows.map(row => {
    let date = null;
    const raw = row['\u05EA\u05D0\u05E8\u05D9\u05DA'];
    if (typeof raw === 'number') {
      const d = xlsx.SSF.parse_date_code(raw);
      if (d) date = d.y + '-' + String(d.m).padStart(2,'0') + '-' + String(d.d).padStart(2,'0');
    }
    const toNum = v => (v !== '' && v !== null && v !== undefined) ? (isNaN(Number(v)) ? null : Number(v)) : null;
    return {
      date,
      type:        String(row['\u05E1\u05D5\u05D2 \u05EA\u05E0\u05D5\u05E2\u05D4'] || '').trim(),
      credit:      toNum(row['\u05D6\u05DB\u05D5\u05EA']),
      debit:       toNum(row['\u05D7\u05D5\u05D1\u05D4']),
      balance:     toNum(row['\u05D9\u05EA\u05E8\u05D4 \u05D1\u05E9"\u05D7']),
      reference:   String(row['\u05D0\u05E1\u05DE\u05DB\u05EA\u05D0'] || ''),
      description: String(row['\u05E4\u05D9\u05E8\u05D5\u05D8'] || '').trim()
    };
  }).filter(r => r.date);
}

function getBankFiles() {
  if (!fs.existsSync(BANK_DIR)) return [];
  return fs.readdirSync(BANK_DIR)
    .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
    .map(f => {
      const name = f.replace('.xlsx','');
      const parts = name.trim().split(' ');
      const monthHe = parts[0];
      const yr = parts[1] || '';
      const num = MONTH_HE[monthHe] || 0;
      const year = yr.length === 2 ? '20' + yr : yr;
      const sortKey = year + '-' + String(num).padStart(2,'0');
      return { filename: name, file: f, sortKey, monthLabel: monthHe + ' ' + year };
    })
    .sort((a,b) => a.sortKey.localeCompare(b.sortKey));
}

const COL_DATE = '\u05EA\u05D0\u05E8\u05D9\u05DA \u05D4\u05E2\u05E1\u05E7\u05D4';
const COL_BUSINESS = '\u05D1\u05D9\u05EA \u05D4\u05E2\u05E1\u05E7';
const COL_AMOUNT = '\u05E1\u05DB\u05D5\u05DD \u05D4\u05D7\u05D9\u05D5\u05D1';

function parseAmount(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const n = parseFloat(String(val).replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? null : n;
}

function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = xlsx.SSF.parse_date_code(val);
    if (d) return d.y+'-'+String(d.m).padStart(2,'0')+'-'+String(d.d).padStart(2,'0');
  }
  const s = String(val).trim();
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    let [,d,mo,y]=m;
    if(y.length===2) y='20'+y;
    return y+'-'+mo.padStart(2,'0')+'-'+d.padStart(2,'0');
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) { const[,y,mo,d]=iso; return y+'-'+mo.padStart(2,'0')+'-'+d.padStart(2,'0'); }
  return null;
}

function readAllFiles() {
  const files = fs.readdirSync(EXCEL_DIR).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  const allRows = [];
  const seen = new Set();
  for (const file of files) {
    try {
      const wb = xlsx.readFile(path.join(EXCEL_DIR, file), { raw: true });
      for (const sn of wb.SheetNames) {
        const rows = xlsx.utils.sheet_to_json(wb.Sheets[sn], { defval: '' });
        for (const row of rows) {
          const date = parseDate(row[COL_DATE]);
          const amount = parseAmount(row[COL_AMOUNT]);
          const business = String(row[COL_BUSINESS] || '').trim();
          if (!date || amount === null || !business) continue;
          const key = date+'|'+business+'|'+amount;
          if (seen.has(key)) continue;
          seen.add(key);
          allRows.push({ date, business, amount });
        }
      }
    } catch(e) { console.error('Error:', file, e.message); }
  }
  return allRows.sort((a,b) => a.date.localeCompare(b.date));
}

function updateData() {
  const rows = readAllFiles();
  fs.writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2), 'utf8');
  console.log(new Date().toLocaleTimeString('he-IL') + ' | data.json updated - ' + rows.length + ' transactions');
  return rows;
}

updateData();

const watcher = chokidar.watch(path.join(EXCEL_DIR, '*.xlsx'), {
  ignored: /~$/,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 }
});
watcher.on('add',    f => { console.log('New file: '  + path.basename(f)); updateData(); });
watcher.on('change', f => { console.log('Changed: '   + path.basename(f)); updateData(); });
watcher.on('unlink', f => { console.log('Deleted: '   + path.basename(f)); updateData(); });

app.use(express.static(DIR));
app.get('/data.json', (req, res) => { res.setHeader('Cache-Control','no-cache'); res.sendFile(DATA_FILE); });

app.get('/api/bank/list', (req, res) => {
  const files = getBankFiles();
  res.json(files.map(({ filename, sortKey, monthLabel }) => ({ filename, sortKey, monthLabel })));
});

app.get('/api/bank/:filename', (req, res) => {
  const name = decodeURIComponent(req.params.filename);
  const filepath = path.join(BANK_DIR, name + '.xlsx');
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'not found' });
  try {
    const transactions = parseBankFile(filepath);
    const info = getBankFiles().find(f => f.filename === name);
    res.json({ month: info ? info.monthLabel : name, transactions });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// List files endpoint: GET /api/files?type=credit|bank
app.get('/api/files', (req, res) => {
  const type = req.query.type;
  if (type !== 'credit' && type !== 'bank') return res.status(400).json({ error: 'type must be credit or bank' });
  const dir = type === 'credit' ? EXCEL_DIR : BANK_DIR;
  if (!fs.existsSync(dir)) return res.json([]);
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'));
  res.json(files);
});

// Delete file endpoint: POST /api/files/delete
app.post('/api/files/delete', express.json(), (req, res) => {
  const { type, filename } = req.body || {};
  if (type !== 'credit' && type !== 'bank') return res.status(400).json({ error: 'type must be credit or bank' });
  if (!filename) return res.status(400).json({ error: 'filename required' });
  // Prevent path traversal
  const safe = path.basename(filename);
  const dir = type === 'credit' ? EXCEL_DIR : BANK_DIR;
  const filepath = path.join(dir, safe);
  if (!fs.existsSync(filepath)) return res.status(404).json({ error: 'not found' });
  fs.unlinkSync(filepath);
  if (type === 'credit') updateData();
  console.log('Deleted: ' + safe);
  res.json({ ok: true });
});

// Upload endpoint: POST /api/upload?type=credit|bank
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const type = req.query.type;
  if (type !== 'credit' && type !== 'bank') return res.status(400).json({ error: 'type must be credit or bank' });
  const destDir = type === 'credit' ? EXCEL_DIR : BANK_DIR;
  const filename = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
  const dest = path.join(destDir, filename);
  fs.writeFileSync(dest, req.file.buffer);
  if (type === 'credit') updateData();
  res.json({ ok: true, filename });
});

// Upload page
app.get('/upload', (req, res) => {
  res.send(`<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <title>ניהול קבצים</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 600px; margin: 60px auto; padding: 20px; direction: rtl; }
    h2 { margin-bottom: 30px; }
    .card { border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .card h3 { margin: 0 0 16px; font-size: 15px; }
    label { display: block; margin-bottom: 8px; font-weight: bold; }
    input[type=file] { display: block; margin-bottom: 12px; }
    .btn-upload { background: #2563eb; color: white; border: none; padding: 8px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; }
    .btn-upload:hover { background: #1d4ed8; }
    .msg { margin-top: 10px; font-size: 13px; color: green; }
    .err { color: red; }
    .file-list { margin-top: 16px; border-top: 1px solid #eee; padding-top: 12px; }
    .file-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f3f3f3; font-size: 13px; }
    .file-row:last-child { border-bottom: none; }
    .file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .btn-del { background: #ef4444; color: white; border: none; padding: 4px 12px; border-radius: 5px; cursor: pointer; font-size: 12px; margin-right: 8px; flex-shrink: 0; }
    .btn-del:hover { background: #dc2626; }
    .empty { color: #999; font-size: 13px; margin-top: 8px; }
    a.back { display: block; margin-top: 30px; color: #2563eb; }
  </style>
</head>
<body>
  <h2>ניהול קבצי Excel</h2>

  <div class="card">
    <h3>אשראי (כרטיס אשראי)</h3>
    <input type="file" id="creditFile" accept=".xlsx">
    <button class="btn-upload" onclick="upload('credit')">העלה</button>
    <div class="msg" id="creditMsg"></div>
    <div class="file-list" id="creditList"></div>
  </div>

  <div class="card">
    <h3>עובר ושב (חשבון עו"ש)</h3>
    <input type="file" id="bankFile" accept=".xlsx">
    <button class="btn-upload" onclick="upload('bank')">העלה</button>
    <div class="msg" id="bankMsg"></div>
    <div class="file-list" id="bankList"></div>
  </div>

  <a class="back" href="/">חזרה לדשבורד</a>

  <script>
    async function loadFiles(type) {
      const list = document.getElementById(type + 'List');
      try {
        const r = await fetch('/api/files?type=' + type);
        const files = await r.json();
        if (!files.length) { list.innerHTML = '<div class="empty">אין קבצים</div>'; return; }
        list.innerHTML = files.map(f =>
          '<div class="file-row">' +
            '<span class="file-name">' + escHtml(f) + '</span>' +
            '<button class="btn-del" onclick="deleteFile(' + JSON.stringify(type) + ',' + JSON.stringify(f) + ')">מחק</button>' +
          '</div>'
        ).join('');
      } catch(e) { list.innerHTML = '<div class="empty err">שגיאה בטעינת קבצים</div>'; }
    }

    function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

    async function deleteFile(type, filename) {
      if (!confirm('למחוק את הקובץ "' + filename + '"?')) return;
      try {
        const r = await fetch('/api/files/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, filename })
        });
        const d = await r.json();
        if (d.ok) loadFiles(type);
        else alert('שגיאה: ' + d.error);
      } catch(e) { alert('שגיאה בחיבור'); }
    }

    async function upload(type) {
      const input = document.getElementById(type + 'File');
      const msg = document.getElementById(type + 'Msg');
      if (!input.files[0]) { msg.textContent = 'בחר קובץ'; msg.className = 'msg err'; return; }
      const fd = new FormData();
      fd.append('file', input.files[0]);
      msg.textContent = 'מעלה...';
      msg.className = 'msg';
      try {
        const r = await fetch('/api/upload?type=' + type, { method: 'POST', body: fd });
        const d = await r.json();
        if (d.ok) {
          msg.textContent = 'הועלה: ' + d.filename;
          msg.className = 'msg';
          input.value = '';
          loadFiles(type);
        } else { msg.textContent = 'שגיאה: ' + d.error; msg.className = 'msg err'; }
      } catch(e) { msg.textContent = 'שגיאה'; msg.className = 'msg err'; }
    }

    loadFiles('credit');
    loadFiles('bank');
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log('\nDashboard: http://localhost:' + PORT + '\n'));
