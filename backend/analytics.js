/**
 * analytics.js — Integração com Google Analytics Data API (GA4)
 *
 * Se GA4_PROPERTY_ID e GOOGLE_APPLICATION_CREDENTIALS estiverem configurados,
 * usa a API real. Caso contrário, retorna dados mockados para desenvolvimento.
 */

const fs = require('fs');

console.log('EXISTE JSON?', fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS));

const USE_MOCK = !process.env.GA4_PROPERTY_ID; // troca para false quando configurar o GA4

// ── Dados Mockados ─────────────────────────────────────────────────────────────
function getMockData(dateRange) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now = new Date();

  // Gera série temporal dos últimos 12 meses
  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const base = 18000 + Math.floor(Math.random() * 12000);
    return {
      month: months[d.getMonth()],
      year: d.getFullYear(),
      sessions: base,
      users: Math.floor(base * 0.74),
      pageviews: Math.floor(base * 2.3),
    };
  });

  const currentMonth = monthlyData[monthlyData.length - 1];
  const prevMonth    = monthlyData[monthlyData.length - 2];
  const growthRate   = (((currentMonth.sessions - prevMonth.sessions) / prevMonth.sessions) * 100).toFixed(1);

  return {
    // Cards do topo
    summary: {
      totalSessions:   currentMonth.sessions,
      uniqueUsers:     currentMonth.users,
      pageviews:       currentMonth.pageviews,
      avgSessionDuration: '3m 42s',
      bounceRate:      '38.4%',
      growthRate:      `${growthRate > 0 ? '+' : ''}${growthRate}%`,
    },

    // Gráfico de linha — mês a mês
    monthlyTrend: monthlyData,

    // Gráfico de barras — páginas mais acessadas
    topPages: [
      { page: 'IPTU',             pageviews: 14830, sessions: 9241 },
      { page: 'Home',             pageviews: 12540, sessions: 8102 },
      { page: 'NFSe',             pageviews:  9870, sessions: 6730 },
      { page: 'ISS',              pageviews:  7650, sessions: 5210 },
      { page: 'Certidões',        pageviews:  6320, sessions: 4180 },
      { page: 'ITBI',             pageviews:  5140, sessions: 3420 },
      { page: 'Alvará',           pageviews:  3980, sessions: 2760 },
      { page: 'Taxa de Licença',  pageviews:  2710, sessions: 1930 },
    ],

    // Gráfico de pizza — origem de tráfego
    trafficSources: [
      { source: 'Orgânico',  sessions: 12840, percentage: 43.2 },
      { source: 'Direto',    sessions:  8910, percentage: 30.0 },
      { source: 'Referência',sessions:  4320, percentage: 14.5 },
      { source: 'Social',    sessions:  2180, percentage:  7.3 },
      { source: 'E-mail',    sessions:  1510, percentage:  5.0 },
    ],

    // Comparativo mês anterior
    comparison: {
      current:  { label: months[now.getMonth()],       value: currentMonth.sessions },
      previous: { label: months[(now.getMonth() + 11) % 12], value: prevMonth.sessions },
      growth:   growthRate,
    },

    meta: { source: 'mock', dateRange },
  };
}

// ── Integração Real com GA4 ────────────────────────────────────────────────────
async function getRealData(dateRange) {
  const { BetaAnalyticsDataClient } = require('@google-analytics/data');

  // Autenticação via GOOGLE_APPLICATION_CREDENTIALS (variável de ambiente)
  const analyticsDataClient = new BetaAnalyticsDataClient();
  const propertyId = process.env.GA4_PROPERTY_ID;

  // ── Requisição 1: Métricas gerais ──────────────────────────────────────────
  const [summaryResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
    ],
  });

  const summaryRow = summaryResponse.rows?.[0]?.metricValues || [];
  const sessions   = parseInt(summaryRow[0]?.value || 0);
  const users      = parseInt(summaryRow[1]?.value || 0);
  const pageviews  = parseInt(summaryRow[2]?.value || 0);
  const avgDur     = parseFloat(summaryRow[3]?.value || 0);
  const bounce     = parseFloat(summaryRow[4]?.value || 0);

  const avgDurMin  = `${Math.floor(avgDur / 60)}m ${Math.floor(avgDur % 60)}s`;

  // ── Requisição 2: Tendência mensal ─────────────────────────────────────────
  const [trendResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: '365daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'yearMonth' }],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'screenPageViews' },
    ],
    orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
  });

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthlyTrend = (trendResponse.rows || []).map((row) => {
    const ym    = row.dimensionValues[0].value; // "202401"
    const month = months[parseInt(ym.slice(4, 6)) - 1];
    const year  = parseInt(ym.slice(0, 4));
    return {
      month,
      year,
      sessions:  parseInt(row.metricValues[0].value),
      users:     parseInt(row.metricValues[1].value),
      pageviews: parseInt(row.metricValues[2].value),
    };
  });

  // ── Requisição 3: Top páginas ──────────────────────────────────────────────
  const [pagesResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
    dimensions: [{ name: 'pageTitle' }],
    metrics: [{ name: 'screenPageViews' }, { name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 8,
  });

  const topPages = (pagesResponse.rows || []).map((row) => ({
    page:      row.dimensionValues[0].value,
    pageviews: parseInt(row.metricValues[0].value),
    sessions:  parseInt(row.metricValues[1].value),
  }));

  // ── Requisição 4: Origem de tráfego ───────────────────────────────────────
  const [sourceResponse] = await analyticsDataClient.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 6,
  });

  const totalSessions = (sourceResponse.rows || []).reduce((s, r) => s + parseInt(r.metricValues[0].value), 0);
  const trafficSources = (sourceResponse.rows || []).map((row) => {
    const s = parseInt(row.metricValues[0].value);
    return {
      source:     row.dimensionValues[0].value,
      sessions:   s,
      percentage: parseFloat(((s / totalSessions) * 100).toFixed(1)),
    };
  });

  // ── Comparativo com mês anterior ──────────────────────────────────────────
  const last   = monthlyTrend[monthlyTrend.length - 1];
  const prev   = monthlyTrend[monthlyTrend.length - 2];
  const growth = prev ? (((last.sessions - prev.sessions) / prev.sessions) * 100).toFixed(1) : '0';

  return {
    summary: {
      totalSessions: sessions,
      uniqueUsers:   users,
      pageviews,
      avgSessionDuration: avgDurMin,
      bounceRate:    `${(bounce * 100).toFixed(1)}%`,
      growthRate:    `${growth > 0 ? '+' : ''}${growth}%`,
    },
    monthlyTrend,
    topPages,
    trafficSources,
    comparison: {
      current:  { label: last?.month,  value: last?.sessions },
      previous: { label: prev?.month,  value: prev?.sessions },
      growth,
    },
    meta: { source: 'ga4', dateRange },
  };
}

// ── Exportação principal ───────────────────────────────────────────────────────
async function getAnalyticsData(dateRange) {
  if (USE_MOCK) {
    console.log('[Analytics] ⚠️  Usando dados MOCKADOS (configure GA4_PROPERTY_ID para dados reais)');
    return getMockData(dateRange);
  }
  console.log('[Analytics] ✅  Buscando dados reais do GA4...');
  return getRealData(dateRange);
}

module.exports = { getAnalyticsData };
