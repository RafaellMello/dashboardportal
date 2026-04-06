# 📊 Portal do Contribuinte — Analytics Dashboard

Dashboard premium de análise de acessos com integração ao Google Analytics 4.

---

## 🚀 Instalação e execução rápida

### 1. Pré-requisitos
- Node.js 18+
- npm 9+

### 2. Instalar dependências
```bash
cd portal-contribuinte-dashboard
npm install
```

### 3. Rodar com dados mockados (sem configurar GA4)
```bash
npm start
```
Acesse: **http://localhost:3000**

O dashboard já funciona com dados mockados realistas sem nenhuma configuração adicional.

---

## 🔐 Configurar Google Analytics 4 (dados reais)

### Passo 1 — Criar Service Account no Google Cloud

1. Acesse https://console.cloud.google.com
2. Crie um projeto (ou use um existente)
3. Ative a API **Google Analytics Data API**:
   - Menu → APIs e Serviços → Biblioteca → busque "Google Analytics Data API" → Ativar
4. Crie uma **Service Account**:
   - Menu → APIs e Serviços → Credenciais → Criar credenciais → Conta de serviço
   - Dê um nome (ex: `dashboard-analytics`)
   - Clique em "Concluído"
5. Gere a chave JSON:
   - Clique na Service Account criada
   - Aba "Chaves" → Adicionar chave → Criar nova chave → JSON
   - Salve o arquivo como `credentials.json` na raiz do projeto

### Passo 2 — Adicionar Service Account ao GA4

1. Acesse https://analytics.google.com
2. Admin → Acesso à conta / Propriedade
3. Clique em "+" e adicione o e-mail da Service Account (formato: `nome@projeto.iam.gserviceaccount.com`)
4. Conceda a permissão **Leitor** (Viewer)

### Passo 3 — Obter o Property ID

1. No GA4 → Admin → Detalhes da Propriedade
2. Copie o **ID da Propriedade** (somente os números, ex: `123456789`)

### Passo 4 — Configurar variáveis de ambiente

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o .env
nano .env
```

Preencha:
```
GA4_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=./credentials.json
```

### Passo 5 — Rodar com dados reais

```bash
npm start
```

---

## 📁 Estrutura do projeto

```
portal-contribuinte-dashboard/
├── backend/
│   ├── server.js       # Express + rotas da API
│   └── analytics.js    # Integração GA4 + dados mock
├── frontend/
│   ├── index.html      # Estrutura do dashboard
│   ├── style.css       # Design premium dark mode
│   └── script.js       # Charts + fetch + animações
├── credentials.json    # ⚠️ NÃO commitar — Service Account
├── .env                # ⚠️ NÃO commitar — variáveis de ambiente
├── .env.example        # Modelo de configuração
├── .gitignore
└── package.json
```

---

## 🔗 Endpoints da API

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/analytics` | Retorna todos os dados de analytics |
| GET | `/api/health` | Health check do servidor |

### Parâmetros de `/api/analytics`

| Parâmetro | Valores | Padrão |
|-----------|---------|--------|
| `period` | `7days`, `30days`, `thisMonth`, `custom` | `30days` |
| `startDate` | `YYYY-MM-DD` | — (obrigatório se `custom`) |
| `endDate` | `YYYY-MM-DD` | — (obrigatório se `custom`) |

### Exemplo de resposta
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalSessions": 28430,
      "uniqueUsers": 21040,
      "pageviews": 65390,
      "avgSessionDuration": "3m 42s",
      "bounceRate": "38.4%",
      "growthRate": "+12.3%"
    },
    "monthlyTrend": [...],
    "topPages": [...],
    "trafficSources": [...],
    "comparison": {...},
    "meta": { "source": "ga4" }
  },
  "generatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

## 🎨 Features do dashboard

- ✅ Dark mode premium com glassmorphism
- ✅ 4 cards de métricas com count-up animado
- ✅ Gráfico de linha: tendência mensal (12 meses)
- ✅ Gráfico de pizza: origem de tráfego
- ✅ Gráfico de barras horizontal: top páginas
- ✅ Comparativo mês a mês com barra animada
- ✅ Filtro por período (7d, 30d, mês atual, personalizado)
- ✅ Atualização automática a cada 10 segundos
- ✅ Skeleton loading na primeira carga
- ✅ Indicador visual de próxima atualização
- ✅ Responsive (mobile/tablet/desktop)
- ✅ Dados mockados para desenvolvimento sem GA4

---

## 🛠️ Desenvolvimento

```bash
# Instalar nodemon para hot-reload
npm install -g nodemon

# Rodar em modo dev
npm run dev
```

---

## ⚠️ Segurança

- O arquivo `credentials.json` **nunca** deve ser commitado no Git
- As credenciais ficam **somente no backend** — o frontend nunca as acessa
- Em produção, use variáveis de ambiente do servidor (Heroku Config Vars, AWS Secrets Manager, etc.)
