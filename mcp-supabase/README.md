# Configuração MCP Supabase

Este diretório contém a configuração para usar o servidor MCP oficial do Supabase com o Claude Desktop.

## O que é este MCP?

O `@supabase/mcp-server-supabase` é um servidor MCP oficial que permite ao Claude interagir diretamente com seu banco de dados Supabase, incluindo:

- Consultar tabelas e dados
- Executar queries SQL
- Gerenciar schemas
- Interagir com funções do banco de dados
- E muito mais!

## Configuração

### Suas Credenciais

- **Project ID**: `hvqckoajxhdqaxfawisd`
- **Schema**: `public`
- **Access Token**: Configurado (mantenha seguro!)

### Como Configurar no Claude Desktop

1. **Localize o arquivo de configuração do Claude Desktop:**

   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`

2. **Abra o arquivo e adicione/mescle a configuração:**

```json
{
  "mcpServers": {
    "mcpsupabaseOminipublicREAL": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase"
      ],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "sbp_f0f0898fbeeaa606cc5a293a9f2f2ae60e6c5ee8",
        "SUPABASE_PROJECT_ID": "hvqckoajxhdqaxfawisd",
        "SUPABASE_SCHEMA": "public"
      }
    }
  }
}
```

3. **Reinicie o Claude Desktop**

4. **Verifique se o MCP está ativo:**
   - Procure pelo ícone de ferramentas (🔌) na interface do Claude
   - Você deve ver "mcpsupabaseOminipublicREAL" listado

## Como Usar

Após configurar, você pode pedir ao Claude para:

### Exemplos de Comandos

```
"Liste todas as tabelas no meu banco de dados Supabase"

"Mostre os dados da tabela users"

"Execute esta query SQL: SELECT * FROM products WHERE price > 100"

"Crie uma nova tabela chamada orders com as colunas id, user_id, total"

"Mostre a estrutura da tabela customers"

"Quantos registros existem na tabela posts?"
```

## Funcionalidades Disponíveis

O MCP Supabase oferece ferramentas para:

- ✅ Listar tabelas e schemas
- ✅ Executar queries SQL (SELECT, INSERT, UPDATE, DELETE)
- ✅ Visualizar estrutura de tabelas
- ✅ Gerenciar dados
- ✅ Executar funções do banco de dados
- ✅ Visualizar relacionamentos entre tabelas

## Segurança

⚠️ **IMPORTANTE**: 

- O `SUPABASE_ACCESS_TOKEN` é uma credencial sensível
- Não compartilhe este arquivo publicamente
- Não faça commit deste arquivo em repositórios públicos
- Considere usar variáveis de ambiente do sistema para maior segurança

### Alternativa Mais Segura

Em vez de colocar o token diretamente no arquivo, você pode:

1. Definir variáveis de ambiente no sistema:
   ```bash
   export SUPABASE_ACCESS_TOKEN="sbp_f0f0898fbeeaa606cc5a293a9f2f2ae60e6c5ee8"
   export SUPABASE_PROJECT_ID="hvqckoajxhdqaxfawisd"
   ```

2. Modificar a configuração para usar as variáveis:
   ```json
   {
     "mcpServers": {
       "mcpsupabaseOminipublicREAL": {
         "command": "npx",
         "args": ["-y", "@supabase/mcp-server-supabase"],
         "env": {
           "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}",
           "SUPABASE_PROJECT_ID": "${SUPABASE_PROJECT_ID}",
           "SUPABASE_SCHEMA": "public"
         }
       }
     }
   }
   ```

## Troubleshooting

### MCP não aparece no Claude

1. Verifique se o arquivo de configuração está no local correto
2. Verifique se o JSON está válido (sem erros de sintaxe)
3. Reinicie completamente o Claude Desktop
4. Verifique os logs do Claude Desktop

### Erros de Conexão

1. Verifique se o `SUPABASE_ACCESS_TOKEN` está correto
2. Verifique se o `SUPABASE_PROJECT_ID` está correto
3. Verifique se você tem permissões adequadas no projeto Supabase
4. Verifique sua conexão com a internet

### Permissões Negadas

- Verifique as permissões do seu token de acesso no Supabase
- Certifique-se de que o token tem acesso ao schema `public`

## Recursos Adicionais

- [Documentação MCP](https://modelcontextprotocol.io/)
- [Documentação Supabase](https://supabase.com/docs)
- [GitHub do MCP Supabase](https://github.com/supabase/mcp-server-supabase)

## Testando a Conexão

Após configurar, teste com comandos simples:

1. "Liste as tabelas do meu banco Supabase"
2. "Mostre a estrutura do banco de dados"
3. "Quantas tabelas existem no schema public?"

Se tudo estiver funcionando, o Claude conseguirá responder essas perguntas consultando seu banco de dados diretamente!
