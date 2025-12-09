# 🦷 Sistema de Inventário e Gestão - Grupo AreLuna

> Sistema unificado de catalogação patrimonial e gestão de ordens de serviço para laboratórios dentários

[![Status](https://img.shields.io/badge/status-produção-success)]()
[![Node](https://img.shields.io/badge/node-20.x-green)]()
[![Supabase](https://img.shields.io/badge/supabase-2.75-blue)]()

---

## 🚀 Início Rápido

```bash
# Instalar dependências
npm install

# Iniciar servidor
npm start

# Acessar aplicação
http://localhost:3002
```

---

## 📚 Documentação Completa

Toda a documentação do sistema foi organizada na pasta **`documentacao/`**:

### 📖 [**Índice da Documentação**](documentacao/INDEX.md)

Acesse o índice completo com todas as 73 documentações organizadas por categoria.

### 🎯 Documentos Principais

| Documento | Descrição |
|-----------|-----------|
| [README Principal](documentacao/README.md) | Documentação completa do sistema |
| [Sistema de OS](documentacao/README_SISTEMA_OS.md) | Ordens de Serviço |
| [Real-Time](documentacao/REALTIME_SISTEMA.md) | Sistema de atualizações em tempo real |
| [Sistema de Reparos](documentacao/SISTEMA_OS_REPARO.md) | OS de Reparo vinculadas |
| [Laboratório](documentacao/LABORATORIO_README.md) | Módulo de laboratório |
| [Kits](documentacao/KITS_README.md) | Sistema de kits de materiais |

---

## 🏗️ Estrutura do Projeto

```
sistemaInventario/
├── api/                    # Backend Node.js + Express
│   ├── index.js           # Servidor principal
│   ├── middleware/        # Middlewares (autenticação, etc)
│   └── prostoral-ordens.js # Rotas de OS
├── database/              # Scripts SQL e schemas
├── public/                # Frontend (HTML/CSS/JS)
│   ├── prostoral.html     # Página principal
│   ├── prostoral-ordens.js # Lógica de OS
│   └── laboratorio.js     # Módulo laboratório
├── documentacao/          # 📚 Toda a documentação
│   └── INDEX.md          # Índice completo
└── package.json           # Dependências do projeto
```

---

## ✨ Funcionalidades Principais

### 🔧 Ordens de Serviço (OS)
- ✅ Criação e gestão de OS
- ✅ Workflow completo (Recebido → Design → Produção → Acabamento → QC → Entregue)
- ✅ Histórico completo de alterações
- ✅ QR Code para cada OS
- ✅ Scanner de QR Code integrado
- ✅ **Atualizações em tempo real** (Supabase Realtime)
- ✅ **Sistema de OS de Reparo** vinculadas

### 📦 Laboratório
- ✅ Gestão de produtos e materiais
- ✅ Controle de estoque
- ✅ Movimentações de entrada/saída
- ✅ Alertas de estoque baixo
- ✅ Importação de produtos em lote

### 🎁 Kits de Materiais
- ✅ Criação de kits pré-configurados
- ✅ Adição rápida de múltiplos materiais
- ✅ Gestão de custos por kit

### ⚠️ Intercorrências
- ✅ Registro de problemas durante produção
- ✅ Sistema de severidade (Baixa, Média, Alta, Crítica)
- ✅ Notificações automáticas
- ✅ Filtros e organização

### ⏱️ Controle de Tempo
- ✅ Registro de tempo de trabalho por etapa
- ✅ Etapas customizáveis pelo usuário
- ✅ Cálculo automático de custos de mão de obra
- ✅ **Taxa horária: 70€/hora**
- ✅ Tempo total em produção (em andamento ou finalizado)

### 📊 Relatórios e Dashboards
- ✅ KPIs em tempo real
- ✅ Relatórios de custos
- ✅ Análise de produtividade
- ✅ Gráficos e estatísticas

### 🔔 Real-Time
- ✅ **Atualizações automáticas** sem recarregar página
- ✅ Notificações visuais de mudanças
- ✅ Sincronização entre múltiplos usuários
- ✅ WebSocket do Supabase

---

## 🛠️ Tecnologias

### Backend
- **Node.js** 20.x
- **Express** 4.x
- **Supabase** (PostgreSQL + Real-Time)
- **JWT** para autenticação

### Frontend
- **HTML5** + **CSS3** (Tailwind CSS)
- **JavaScript** (Vanilla ES6+)
- **Supabase Client** (Real-Time WebSocket)
- **QRCode.js** para geração de QR Codes
- **html5-qrcode** para scanner

### Database
- **PostgreSQL** (via Supabase)
- **Row Level Security (RLS)**
- **Real-Time subscriptions**
- **PostgREST** API

---

## 📝 Scripts Disponíveis

```bash
# Desenvolvimento com auto-reload
npm run dev

# Produção
npm start

# Build (se necessário)
npm run build
```

---

## 🔐 Autenticação

O sistema usa autenticação via **Supabase Auth**:
- Login por email/senha
- JWT tokens
- Sessões persistentes
- Controle de permissões por roles

---

## 🌐 Deployment

### Variáveis de Ambiente Necessárias

Crie um arquivo `.env` na raiz:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-anon
SUPABASE_SERVICE_ROLE_KEY=sua-chave-service
PORT=3002
```

### Vercel (Recomendado)

O projeto está configurado para deploy na Vercel via `vercel.json`.

---

## 📖 Documentação Adicional

### Por Módulo
- [Backend Completo](documentacao/BACKEND_OS_COMPLETO.md)
- [Guia de Implementação de Kits](documentacao/GUIA_IMPLEMENTACAO_KITS.md)
- [Guia de Importação de Produtos](documentacao/GUIA_IMPORTACAO_PRODUTOS.md)
- [Sistema de Histórico](documentacao/GUIA_IMPLEMENTACAO_HISTORICO.md)

### Por Funcionalidade
- [QR Code](documentacao/QR_CODE_FIX.md)
- [Scanner QR](documentacao/SCANNER_QR_OS.md)
- [Real-Time](documentacao/REALTIME_SISTEMA.md)
- [Intercorrências](documentacao/IMPLEMENTACAO_INTERCORRENCIAS_PERMISSOES.md)
- [Sistema de Reparos](documentacao/SISTEMA_OS_REPARO.md)

### Troubleshooting
- [Guia Rápido de Correções](documentacao/QUICK_FIX_GUIDE.md)
- [Debug Erro 404](documentacao/DEBUG_ERRO_404.md)
- [Solução de Cache](documentacao/SOLUCAO_CACHE_NAVEGADOR.md)

---

## 🤝 Suporte

Para dúvidas ou problemas:
1. Consulte a [documentação completa](documentacao/INDEX.md)
2. Verifique o [guia de troubleshooting](documentacao/QUICK_FIX_GUIDE.md)
3. Entre em contato com a equipe técnica

---

## 📜 Licença

MIT License - © 2025 Grupo AreLuna

---

## 🎯 Status das Funcionalidades

| Funcionalidade | Status |
|----------------|--------|
| Ordens de Serviço | ✅ Completo |
| Laboratório/Estoque | ✅ Completo |
| Kits de Materiais | ✅ Completo |
| QR Code | ✅ Completo |
| Scanner QR | ✅ Completo |
| Intercorrências | ✅ Completo |
| Histórico | ✅ Completo |
| Real-Time | ✅ Completo |
| Sistema de Reparos | ✅ Completo |
| Controle de Tempo | ✅ Completo |
| Dashboards | ✅ Completo |

---

**Desenvolvido com ❤️ para o Grupo AreLuna**

