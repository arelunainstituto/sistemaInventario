# 📦 Sistema de Inventário - Grupo AreLuna

Sistema unificado de catalogação patrimonial para o Grupo AreLuna, desenvolvido com Node.js, Express e Supabase.

## 🚀 Deploy na Vercel

### Pré-requisitos
- Conta na [Vercel](https://vercel.com)
- Conta no [Supabase](https://supabase.com)
- Node.js 18+ instalado localmente

### Passos para Deploy

1. **Clone o repositório**
   ```bash
   git clone <seu-repositorio>
   cd sistema-inventario-areluna
   ```

2. **Instale as dependências**
   ```bash
   npm install
   ```

3. **Configure as variáveis de ambiente**
   - Copie o arquivo `.env.example` para `.env`
   - Preencha com suas credenciais do Supabase:
     ```
     SUPABASE_URL=sua_url_do_supabase
     SUPABASE_ANON_KEY=sua_chave_anonima
     SUPABASE_SERVICE_ROLE_KEY=sua_chave_service_role
     PORT=3002
     NODE_ENV=production
     ```

4. **Deploy na Vercel**
   
   **Opção 1: Via CLI da Vercel**
   ```bash
   npm install -g vercel
   vercel login
   vercel
   ```
   
   **Opção 2: Via GitHub**
   - Conecte seu repositório ao GitHub
   - Importe o projeto na Vercel
   - Configure as variáveis de ambiente no painel da Vercel

5. **Configure as variáveis de ambiente na Vercel**
   No painel da Vercel, vá em Settings > Environment Variables e adicione:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NODE_ENV=production`

## 🛠️ Desenvolvimento Local

1. **Instale as dependências**
   ```bash
   npm install
   ```

2. **Configure o arquivo .env**
   ```bash
   cp .env.example .env
   # Edite o .env com suas credenciais
   ```

3. **Execute o servidor**
   ```bash
   npm run dev
   ```

4. **Acesse a aplicação**
   ```
   http://localhost:3002
   ```

## 📁 Estrutura do Projeto

```
├── public/           # Arquivos estáticos (HTML, CSS, JS)
├── server.js         # Servidor Express principal
├── package.json      # Dependências e scripts
├── vercel.json       # Configurações da Vercel
├── .env.example      # Template de variáveis de ambiente
└── README.md         # Este arquivo
```

## 🔧 Funcionalidades

- ✅ Cadastro e gerenciamento de itens
- ✅ Upload de imagens
- ✅ Geração automática de QR Codes
- ✅ Sistema de busca e filtros avançados
- ✅ Categorização de itens
- ✅ Relatórios e estatísticas
- ✅ Interface responsiva

## 🔒 Segurança

- Helmet.js para headers de segurança
- CORS configurado
- Validação de uploads de arquivo
- Sanitização de dados de entrada

## 📊 Banco de Dados

O projeto utiliza Supabase como backend, com as seguintes tabelas principais:
- `items` - Itens do inventário
- `categories` - Categorias dos itens
- `collaborators` - Colaboradores

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

## 📞 Suporte

Para suporte, entre em contato com a equipe do Grupo AreLuna.