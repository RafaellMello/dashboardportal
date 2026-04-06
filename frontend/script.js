/**
 * script.js — Dashboard Analytics Portal do Contribuinte
 * Consome /api/analytics e renderiza gráficos com Chart.js
 */

/* ── Estado global ───────────────────────────────────────────────── */
const state = {
  period: '30days',
  startDate: null,
  endDate: null,
  charts: {},
  refreshInterval: null,
  countdownInterval: null,
  countdown: 10,
  firstLoad: true,
};

// Se aberto via file:// ou porta diferente, usa mock embutido
const IS_FILE_PROTOCOL = window.location.protocol === 'file:';
const API_BASE = window.location.origin;

/* ── Paleta compartilhada com o CSS ──────────────────────────────── */
const COLOR = {
  primary:  '#3b7eff',
  cyan:     '#00d4ff',
  green:    '#00e5a0',
  orange:   '#ff8c42',
  purple:   '#a855f7',
  red:      '#ff4d6d',
  muted:    '#3d4f72',
  surface:  '#121929',
  border:   'rgba(59,126,255,0.15)',
  text:     '#eef2ff',
  textSec:  '#7c8db5',
};

const SOURCE_COLORS = [COLOR.primary, COLOR.cyan, COLOR.green, COLOR.purple, COLOR.orange, COLOR.red];

/* ════════════════════════════════════════════════════════════════════
   INICIALIZAÇÃO
   ════════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date();

  switch(state.period) {
    case '7days':
      state.endDate = today.toISOString().slice(0,10);
      state.startDate = new Date(today.getTime() - 7*24*60*60*1000).toISOString().slice(0,10);
      break;
    case '30days':
      state.endDate = today.toISOString().slice(0,10);
      state.startDate = new Date(today.getTime() - 30*24*60*60*1000).toISOString().slice(0,10);
      break;
    case 'thisMonth':
      state.startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0,10);
      state.endDate = today.toISOString().slice(0,10);
      break;
  }

  // Chama fetch inicial
  fetchAndRender();
});

/* ── Filtro de período ────────────────────────────────────────────── */
function setupPeriodFilter() {
  const buttons = document.querySelectorAll('.period-btn');
  const customPicker = document.getElementById('customDatePicker');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const period = btn.dataset.period;

      if (period === 'custom') {
        customPicker.style.display = 'flex';
        return;
      }

      customPicker.style.display = 'none';
      state.period = period;
      state.startDate = null;
      state.endDate = null;
      fetchAndRender();
    });
  });

  document.getElementById('applyCustomDate').addEventListener('click', () => {
    const s = document.getElementById('startDate').value;
    const e = document.getElementById('endDate').value;
    if (!s || !e) return alert('Selecione data de início e fim.');
    if (s > e)    return alert('Data de início não pode ser maior que a data final.');
    state.period = 'custom';
    state.startDate = s;
    state.endDate   = e;
    fetchAndRender();
  });
}

/* ════════════════════════════════════════════════════════════════════
   FETCH PRINCIPAL
   ════════════════════════════════════════════════════════════════════ */
async function fetchAndRender() {
  if (state.firstLoad) showSkeleton(true);
  setRefreshRing(true);

  try {
    const body = { period: state.period };
if (state.startDate) body.startDate = state.startDate;
if (state.endDate)   body.endDate   = state.endDate;

const res = await fetch(`${API_BASE}/api/analytics`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    if (!json.success) throw new Error(json.error || 'Erro desconhecido');

    renderDashboard(json.data);
    updateFooter(json);
  } catch (err) {
    console.error('[Dashboard]', err);
    showError(err.message);
  } finally {
    if (state.firstLoad) {
      showSkeleton(false);
      state.firstLoad = false;
    }
    setRefreshRing(false);
  }
}

function buildQueryParams() {
  const p = new URLSearchParams({ period: state.period });
  if (state.startDate) p.set('startDate', state.startDate);
  if (state.endDate)   p.set('endDate',   state.endDate);
  return p.toString();
}

/* ════════════════════════════════════════════════════════════════════
   RENDER PRINCIPAL
   ════════════════════════════════════════════════════════════════════ */
function renderDashboard(data) {
  renderCards(data.summary);
  renderTrendChart(data.monthlyTrend);
  renderSourceChart(data.trafficSources);
  renderPagesChart(data.topPages);
  renderComparison(data.comparison);
}

/* ── Cards de métricas ───────────────────────────────────────────── */
function renderCards(summary) {
  countUp('totalAccesses', summary.totalAccesses); // 🔥 principal
  countUp('sessions',      summary.sessions);      // secundário
  document.getElementById('avgDuration').textContent = summary.avgSessionDuration || '—';

  // Taxa de crescimento com cor
  const growthEl = document.getElementById('growthRate');
  const growth   = parseFloat(summary.growthRate);
  growthEl.textContent = summary.growthRate;
  growthEl.className   = 'metric-growth ' + (growth >= 0 ? 'positive' : 'negative');
}

/* ── Gráfico de linha: tendência mensal ──────────────────────────── */
function renderTrendChart(monthlyData) {
  const labels   = monthlyData.map(d => `${d.month}/${String(d.year).slice(2)}`);
  const sessions = monthlyData.map(d => d.sessions);
  const users    = monthlyData.map(d => d.users);

  const cfg = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Sessões',
          data: sessions,
          borderColor: COLOR.primary,
          backgroundColor: createGradient('trendChart', COLOR.primary),
          borderWidth: 2.5,
          pointRadius: 3, pointHoverRadius: 6,
          pointBackgroundColor: COLOR.primary,
          tension: 0.4, fill: true,
        },
        {
          label: 'Usuários',
          data: users,
          borderColor: COLOR.cyan,
          backgroundColor: createGradient('trendChart', COLOR.cyan, true),
          borderWidth: 2,
          pointRadius: 3, pointHoverRadius: 6,
          pointBackgroundColor: COLOR.cyan,
          tension: 0.4, fill: true,
          borderDash: [4, 4],
        },
      ],
    },
    options: {
      ...defaultOptions(),
      scales: {
        x: xScale(),
        y: yScale(),
      },
    },
  };

  updateChart('trendChart', cfg);
}

/* ── Gráfico de pizza: origem de tráfego ─────────────────────────── */
function renderSourceChart(sources) {
  const labels = sources.map(s => s.source);
  const values = sources.map(s => s.sessions);
  const colors = sources.map((_, i) => SOURCE_COLORS[i % SOURCE_COLORS.length]);

  const cfg = {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + '99'),
        borderColor: colors,
        borderWidth: 2,
        hoverBorderWidth: 3,
        hoverOffset: 8,
      }],
    },
    options: {
      ...defaultOptions(),
      cutout: '68%',
      plugins: {
        ...defaultOptions().plugins,
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.label}: ${fmtNum(ctx.raw)} sessões`,
          },
        },
      },
    },
  };

  updateChart('sourceChart', cfg);

  // Legenda personalizada
  const legendEl = document.getElementById('sourceLegend');
  legendEl.innerHTML = sources.map((s, i) => `
    <div class="source-item">
      <div class="source-color" style="background:${SOURCE_COLORS[i % SOURCE_COLORS.length]}"></div>
      <span class="source-name">${s.source}</span>
      <span class="source-pct">${s.percentage}%</span>
    </div>
  `).join('');
}

/* ── Gráfico de barras: top páginas ──────────────────────────────── */
function renderPagesChart(pages) {
  const labels   = pages.map(p => p.page);
  const pageviews = pages.map(p => p.pageviews);

  const cfg = {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Visualizações',
        data: pageviews,
        backgroundColor: pageviews.map((_, i) => {
          const alpha = 1 - (i * 0.08);
          return `rgba(59,126,255,${alpha})`;
        }),
        borderColor: COLOR.primary,
        borderWidth: 0,
        borderRadius: 8,
        borderSkipped: false,
      }],
    },
    options: {
      ...defaultOptions(),
      indexAxis: 'y',
      scales: {
        x: { ...yScale(), ticks: { ...yScale().ticks, callback: v => fmtNum(v) } },
        y: xScale(),
      },
    },
  };

  updateChart('pagesChart', cfg);
}

/* ── Comparativo mês a mês ───────────────────────────────────────── */
function renderComparison(comparison) {
  if (!comparison?.current || !comparison?.previous) return;

  const { current, previous, growth } = comparison;
  const max = Math.max(current.value, previous.value);
  const pctCur  = ((current.value  / max) * 100).toFixed(1);
  const pctPrev = ((previous.value / max) * 100).toFixed(1);

  document.getElementById('curLabel').textContent  = current.label;
  document.getElementById('prevLabel').textContent = previous.label;
  document.getElementById('curVal').textContent    = fmtNum(current.value);
  document.getElementById('prevVal').textContent   = fmtNum(previous.value);

  // Animação nas barras
  setTimeout(() => {
    document.getElementById('curBar').style.width  = pctCur  + '%';
    document.getElementById('prevBar').style.width = pctPrev + '%';
  }, 100);

  const g = parseFloat(growth);
  const growEl = document.getElementById('compareGrowth');
  growEl.textContent = `${g >= 0 ? '↑ +' : '↓ '}${growth}% em relação ao mês anterior`;
  growEl.className   = 'compare-growth ' + (g < 0 ? 'negative' : '');
}

/* ════════════════════════════════════════════════════════════════════
   HELPERS DE CHARTS
   ════════════════════════════════════════════════════════════════════ */
function updateChart(id, cfg) {
  if (state.charts[id]) {
    state.charts[id].destroy();
  }
  const canvas = document.getElementById(id);
  if (!canvas) return;
  state.charts[id] = new Chart(canvas, cfg);
}

function createGradient(canvasId, color, light = false) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return color + '30';
  const ctx = canvas.getContext('2d');
  const h = canvas.parentElement?.offsetHeight || 200;
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  const hex = color.replace('#','');
  const r = parseInt(hex.slice(0,2),16);
  const g = parseInt(hex.slice(2,4),16);
  const b = parseInt(hex.slice(4,6),16);
  grad.addColorStop(0, `rgba(${r},${g},${b},${light ? 0.15 : 0.28})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0.01)`);
  return grad;
}

function defaultOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: 'easeInOutQuart' },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#121929',
        borderColor: 'rgba(59,126,255,.3)',
        borderWidth: 1,
        titleFont: { family: 'DM Sans', size: 12 },
        bodyFont:  { family: 'DM Sans', size: 12 },
        padding: 10,
        callbacks: {
          label: (ctx) => ` ${ctx.dataset.label}: ${fmtNum(ctx.raw)}`,
        },
      },
    },
  };
}

function xScale() {
  return {
    grid: { color: 'rgba(255,255,255,.04)', drawBorder: false },
    ticks: { color: COLOR.textSec, font: { family: 'DM Sans', size: 11 } },
    border: { display: false },
  };
}

function yScale() {
  return {
    grid: { color: 'rgba(255,255,255,.04)', drawBorder: false },
    ticks: {
      color: COLOR.textSec,
      font: { family: 'DM Sans', size: 11 },
      callback: (v) => fmtNum(v),
    },
    border: { display: false },
  };
}

/* ════════════════════════════════════════════════════════════════════
   REFRESH MANUAL — clique no botão para atualizar
   ════════════════════════════════════════════════════════════════════ */
function setupManualRefresh() {
  const btn = document.getElementById('refreshIndicator');
  if (!btn) return;
  btn.style.cursor = 'pointer';
  btn.title = 'Clique para atualizar os dados';
  btn.addEventListener('click', () => {
    if (state.isLoading) return;
    fetchAndRender();
  });
}


/* ════════════════════════════════════════════════════════════════════
   UI HELPERS
   ════════════════════════════════════════════════════════════════════ */

// Count-up animado
function countUp(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  const start    = 0;
  const duration = 900;
  const startTs  = performance.now();

  function step(ts) {
    const progress = Math.min((ts - startTs) / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = fmtNum(Math.floor(ease * target));
    if (progress < 1) requestAnimationFrame(step);
    else el.textContent = fmtNum(target);
  }
  requestAnimationFrame(step);
}

// Formata números: 1.234.567
function fmtNum(n) {
  if (typeof n !== 'number') return n ?? '—';
  return n.toLocaleString('pt-BR');
}

function showSkeleton(show) {
  document.getElementById('skeleton').style.display    = show ? 'grid' : 'none';
  document.getElementById('dashContent').style.display = show ? 'none' : 'block';
}

function setRefreshRing(loading) {
  const ring = document.querySelector('.refresh-ring');
  if (ring) ring.classList.toggle('spinning', loading);
}

function updateFooter(json) {
  const ts = new Date(json.generatedAt).toLocaleString('pt-BR');
  const src = json.data?.meta?.source === 'ga4' ? '✅ Google Analytics 4' : '⚠️ Dados Mockados';
  document.getElementById('lastUpdate').textContent  = `Última atualização: ${ts}`;
  document.getElementById('dataSource').textContent  = `Fonte: ${src}`;
}

function showError(msg) {
  console.error('[Dashboard Error]', msg);
  // Mostra um toast ou banner de erro sem quebrar o layout
  const footer = document.querySelector('.page-footer');
  if (footer) {
    footer.style.color = '#ff4d6d';
    document.getElementById('lastUpdate').textContent = `⚠️ Erro ao carregar: ${msg}`;
  }
}


console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS);