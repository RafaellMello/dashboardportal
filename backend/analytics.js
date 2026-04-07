/**
 * analytics.js — Integração segura com Google Analytics Data API (GA4)
 */

'use strict';

const fs                     = require('fs');
const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const USE_MOCK = !process.env.GA4_PROPERTY_ID;

// ── Dados Mockados ─────────────────────────────────────────────────────────────
function getMockData(dateRange) {
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const now    = new Date();

  const monthlyData = Array.from({ length: 12 }, (_, i) => {
    const d    = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const base = 18000 + Math.floor(Math.random() * 12000);
    return {
      month:    months[d.getMonth()],
      year:     d.getFullYear(),
      accesses: base,
      sessions: base,
      users:    Math.floor(base * 0.74),
    };
  });

  const currentMonth = monthlyData[monthlyData.length - 1];
  const prevMonth    = monthlyData[monthlyData.length - 2];
  const growthRate   = (((currentMonth.accesses - prevMonth.accesses) / prevMonth.accesses) * 100).toFixed(1);

  return {
    summary: {
      totalAccesses: currentMonth.accesses,
      sessions:      currentMonth.sessions,
      growthRate:    `${Number(growthRate) > 0 ? '+' : ''}${growthRate}%`,
    },
    monthlyTrend,
    topPages: [
      { page: 'IPTU', pageviews: 14830, sessions: 9241 },
      { page: 'Home', pageviews: 12540, sessions: 8102 },
      { page: 'NFSe', pageviews:  9870, sessions: 6730 },
    ],
    trafficSources: [
      { source: 'Orgânico', sessions: 12840, percentage: 43.2 },
      { source: 'Direto',   sessions:  8910, percentage: 30.0 },
    ],
    comparison: {
      current:  { label: currentMonth.month, value: currentMonth.accesses },
      previous: { label: prevMonth.month,    value: prevMonth.accesses },
      growth,
    },
    meta: { source: 'mock', dateRange },
  };
}

// ── Integração Real com GA4 ────────────────────────────────────────────────────
async function getRealData(dateRange) {
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) throw new Error('GA4_PROPERTY_ID não está definido');

  const keyFile = JSON.parse(fs.readFileSync('/etc/secrets/credentials.json', 'utf8'));
  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: keyFile.client_email,
      private_key:  keyFile.private_key,
    },
  });

  const prop = `properties/${propertyId}`;

  // ── Resumo geral (somente métricas seguras) ────────────────────────────────
  const [summaryRes] = await client.runReport({
    property:   prop,
    dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
    metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }],
  });

  const row      = summaryRes.rows?.[0]?.metricValues || [];
  const sessions = parseInt(row[0]?.value || 0);
  const pageviews = parseInt(row[1]?.value || 0);

  // ── Tendência mensal ───────────────────────────────────────────────────────
  const [trendRes] = await client.runReport({
    property:   prop,
    dateRanges: [{ startDate: '365daysAgo', endDate: 'today' }],
    dimensions: [{ name: 'yearMonth' }],
    metrics:    [{ name: 'screenPageViews' }],
    orderBys:   [{ dimension: { dimensionName: 'yearMonth' } }],
  });

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const monthlyTrend = (trendRes.rows || []).map((r) => {
    const ym = r.dimensionValues[0].value;
    return {
      month:    months[parseInt(ym.slice(4, 6)) - 1],
      year:     parseInt(ym.slice(0, 4)),
      accesses: parseInt(r.metricValues[0].value),
    };
  });

  // ── Top páginas ────────────────────────────────────────────────────────────
  const [pagesRes] = await client.runReport({
    property:   prop,
    dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
    dimensions: [{ name: 'pageTitle' }],
    metrics:    [{ name: 'screenPageViews' }, { name: 'sessions' }],
    orderBys:   [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 8,
  });

  const topPages = (pagesRes.rows || []).map((r) => ({
    page:      r.dimensionValues[0].value,
    pageviews: parseInt(r.metricValues[0].value),
    sessions:  parseInt(r.metricValues[1].value),
  }));

  // ── Origem de tráfego ──────────────────────────────────────────────────────
  const [sourceRes] = await client.runReport({
    property:   prop,
    dateRanges: [{ startDate: dateRange.startDate, endDate: dateRange.endDate }],
    dimensions: [{ name: 'sessionDefaultChannelGroup' }],
    metrics:    [{ name: 'sessions' }],
    orderBys:   [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 6,
  });

  const totalSessions = (sourceRes.rows || []).reduce((s, r) => s + parseInt(r.metricValues[0].value), 0);
  const trafficSources = (sourceRes.rows || []).map((r) => ({
    source:     r.dimensionValues[0].value,
    sessions:   parseInt(r.metricValues[0].value),
    percentage: parseFloat(((parseInt(r.metricValues[0].value) / totalSessions) * 100).toFixed(1)),
  }));

  // ── Comparativo ───────────────────────────────────────────────────────────
  const last = monthlyTrend[monthlyTrend.length - 1];
  const prev = monthlyTrend[monthlyTrend.length - 2];
  const growth = prev ? (((last.accesses - prev.accesses) / prev.accesses) * 100).toFixed(1) : '0';

  return {
    summary: {
      totalAccesses: pageviews,
      sessions,
      growthRate: `${Number(growth) > 0 ? '+' : ''}${growth}%`,
    },
    monthlyTrend,
    topPages,
    trafficSources,
    comparison: {
      current:  { label: last?.month, value: last?.accesses },
      previous: { label: prev?.month, value: prev?.accesses },
      growth,
    },
    meta: { source: 'ga4', dateRange },
  };
}

// ── Exportação principal ───────────────────────────────────────────────────────
async function getAnalyticsData(dateRange) {
  if (USE_MOCK) {
    console.log('[Analytics] ⚠️  Usando dados MOCKADOS');
    return getMockData(dateRange);
  }
  console.log('[Analytics] ✅  Buscando dados reais do GA4...');
  return getRealData(dateRange);
}

module.exports = { getAnalyticsData };