# Instruções de Instalação Rápida

## Passo a Passo

### 1. Localize o arquivo de configuração do Claude Desktop

Dependendo do seu sistema operacional:

**macOS:**
```bash
open ~/Library/Application\ Support/Claude/
```

**Windows:**
```powershell
explorer %APPDATA%\Claude\
```

**Linux:**
```bash
cd ~/.config/Claude/
```

### 2. Edite ou crie o arquivo `claude_desktop_config.json`

Se o arquivo não existir, crie-o. Se já existir, adicione a configuração do MCP.

### 3. Copie a configuração

Copie o conteúdo do arquivo `claude_desktop_config.json` deste diretório para o arquivo de configuração do Claude Desktop.

Se você já tem outros MCPs configurados, adicione apenas a seção `mcpsupabaseOminipublicREAL` dentro de `mcpServers`.

### 4. Reinicie o Claude Desktop

Feche completamente o Claude Desktop e abra novamente.

### 5. Verifique a instalação

No Claude Desktop, procure pelo ícone de ferramentas (🔌) ou mencione "Supabase" em uma conversa. O Claude deve reconhecer que tem acesso ao seu banco de dados.

## Teste Rápido

Após configurar, envie esta mensagem ao Claude:

```
Liste todas as tabelas do meu banco de dados Supabase
```

Se funcionar, você verá a lista de tabelas do seu projeto!

## Problemas?

Consulte a seção "Troubleshooting" no README.md
