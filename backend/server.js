/**
 * Portal do Contribuinte — Analytics Dashboard
 * Backend: Express + Google Analytics Data API (GA4)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const { getAnalyticsData } = require('./analytics');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve o frontend estático
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Endpoint principal de analytics ──────────────────────────────────────────
/**
 * GET /api/analytics
 * Query params:
 *   period: '7days' | '30days' | 'thisMonth' | 'custom'
 *   startDate: 'YYYY-MM-DD'  (obrigatório se period=custom)
 *   endDate:   'YYYY-MM-DD'  (obrigatório se period=custom)
 */
app.get('/api/analytics', async (req, res) => {
  try {
    const { period = '30days', startDate, endDate } = req.query;

    // Mapeia período para datas do GA4
    const dateRange = resolveDateRange(period, startDate, endDate);

    const data = await getAnalyticsData(dateRange);
    res.json({ success: true, data, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[API Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Endpoint de health check ──────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Helper: resolve datas a partir do período ─────────────────────────────────
function resolveDateRange(period, startDate, endDate) {
  const today = new Date();
  const fmt = (d) => d.toISOString().split('T')[0];

  switch (period) {
    case '7days': {
      const start = new Date(today.getTime() - 6 * 24 * 60 * 60 * 1000); // últimos 7 dias
      return { startDate: fmt(start), endDate: fmt(today) };
    }
    case '30days': {
      const start = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000); // últimos 30 dias
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
    default:
      const defaultStart = new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000);
      return { startDate: fmt(defaultStart), endDate: fmt(today) };
  }
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Dashboard rodando em http://localhost:${PORT}`);
  console.log(`📊 API disponível em http://localhost:${PORT}/api/analytics\n`);
});