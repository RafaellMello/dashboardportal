/**
 * Portal do Contribuinte — Analytics Dashboard
 * Backend: Express + Google Analytics Data API (GA4)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');
const { getAnalyticsData } = require('./analytics');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve o frontend estático
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Handler principal de analytics ───────────────────────────────────────────
async function handleAnalytics(req, res) {
  try {
    const { period = '30days', startDate, endDate } = { ...req.query, ...req.body };
    const dateRange = resolveDateRange(period, startDate, endDate);
    const data = await getAnalyticsData(dateRange);
    res.json({ success: true, data, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[API Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}

app.get('/api/analytics',  handleAnalytics);
app.post('/api/analytics', handleAnalytics);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Debug ─────────────────────────────────────────────────────────────────────
app.get('/api/debug', (req, res) => {
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  let fileInfo = { exists: false, content: null, error: null };
  try {
    fileInfo.exists = fs.existsSync(credPath);
    if (fileInfo.exists) {
      const parsed = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      fileInfo.content = {
        type:         parsed.type,
        client_email: parsed.client_email,
        project_id:   parsed.project_id,
      };
    }
  } catch (e) {
    fileInfo.error = e.message;
  }

  res.json({
    credPath,
    ga4PropertyId: process.env.GA4_PROPERTY_ID,
    ...fileInfo,
  });
});

// ── Helper: resolve datas a partir do período ─────────────────────────────────
function resolveDateRange(period, startDate, endDate) {
  const today = new Date();
  const fmt   = (d) => d.toISOString().split('T')[0];

  switch (period) {
    case '7days': {
      const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000);
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case '30days': {
      const start = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case 'thisMonth': {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      return { startDate: fmt(first), endDate: fmt(today) };
    }
    case 'custom':
      if (!startDate || !endDate) {
        throw new Error('startDate e endDate são obrigatórios para period=custom');
      }
      return { startDate, endDate };
    default: {
      const start = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
      return { startDate: fmt(start), endDate: fmt(today) };
    }
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Dashboard rodando em http://localhost:${PORT}`);
  console.log(`📊 API disponível em http://localhost:${PORT}/api/analytics\n`);
});