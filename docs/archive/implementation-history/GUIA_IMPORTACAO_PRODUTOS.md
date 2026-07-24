# 📦 Guia de Importação de Produtos do Laboratório

Este guia explica como importar os produtos do arquivo `cadastro produtos.json` para o sistema de estoque do laboratório.

## 🎯 Objetivo

Cadastrar todos os produtos reais do laboratório de prótese dental no sistema, gerando automaticamente:
- ✅ IDs únicos (UUID)
- ✅ QR Codes automáticos
- ✅ Registros de estoque
- ✅ Movimentações iniciais

## 📋 Pré-requisitos

1. Arquivo `cadastro produtos.json` na raiz do projeto
2. Variáveis de ambiente configuradas no `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Node.js instalado
4. Dependências do projeto instaladas (`npm install`)

## 🚀 Como Executar

### Passo 1: Verificar o arquivo JSON

Certifique-se de que o arquivo `cadastro produtos.json` está na raiz do projeto e contém um array válido de produtos.

### Passo 2: Executar o script

```bash
node scripts/importar-produtos-laboratorio.js
```

### Passo 3: Acompanhar o progresso

O script mostrará em tempo real:
- Produtos sendo processados
- Produtos importados com sucesso ✅
- Produtos ignorados (duplicados) ⏭️
- Erros encontrados ❌

### Passo 4: Verificar o resumo

Ao final, será exibido um resumo completo:
```
╔═══════════════════════════════════════════════════════════╗
║  📊 RESUMO DA IMPORTAÇÃO                                 ║
╚═══════════════════════════════════════════════════════════╝

✅ Produtos importados com sucesso: XX
⏭️  Produtos ignorados (já existem): XX
❌ Erros: XX
```

## 🔧 O Que o Script Faz

### 1. Leitura e Validação
- Lê o arquivo JSON
- Remove duplicatas (mesmo nome + marca)
- Valida campos obrigatórios

### 2. Mapeamento Automático

#### Categorias
O script mapeia automaticamente as categorias do JSON para as categorias válidas do banco:

```javascript
"Componentes Protéticos" → "instrumentos"
"Discos de Zircônia" → "ceramica"
"Resinas de Impressão 3D" → "resinas"
"Ceras Laboratoriais" → "ceras"
"Gessos Odontológicos" → "gesso"
// ... e mais
```

#### Unidades de Medida
Converte unidades do JSON para o formato do banco:

```javascript
"cx" → "caixa"
"un" → "un"
"cartucho 1L" → "l"
"frasco 50g" → "g"
// ... e mais
```

### 3. Cadastro no Banco

Para cada produto:
1. **Insere na tabela `produtoslaboratorio`**
   - Gera ID automático (UUID)
   - Trigger gera QR code automático
   
2. **Cria registro em `estoquelaboratorio`**
   - quantidade_atual
   - quantidade_minima
   - quantidade_maxima

3. **Registra movimentação inicial** (se quantidade > 0)
   - Tipo: entrada
   - Motivo: "Estoque inicial - Importação em lote"

### 4. Prevenção de Duplicatas

O script verifica se cada produto já existe (nome + marca) antes de inserir, evitando cadastros duplicados.

## 📝 Formato dos Dados

### Campos do JSON

```json
{
  "codigo_barras": "string ou null",
  "categoria": "string",
  "nome_material": "string (obrigatório)",
  "marca": "string ou null",
  "fornecedor": "string ou null",
  "referencia_lote": "string ou null",
  "unidade_medida": "string (obrigatório)",
  "localizacao": "string ou null",
  "data_validade": "YYYY-MM-DD ou null",
  "descricao": "string ou null",
  "observacoes": "string ou null",
  "ativo": true/false,
  "quantidade_inicial": number,
  "quantidade_minima": number,
  "quantidade_maxima": number
}
```

### Campos Ignorados

- `id` - será gerado automaticamente pelo banco
- `qr_code` - será gerado automaticamente pelo trigger
- `preco_unitario` - não usado no cadastro inicial

## ⚠️ Observações Importantes

1. **IDs no JSON**: Os IDs no arquivo são apenas para organização e serão ignorados. O banco gerará novos UUIDs.

2. **QR Codes**: São gerados automaticamente a partir do UUID do produto.

3. **Duplicatas**: O script identifica e ignora produtos duplicados (mesmo nome e marca).

4. **Estoque Inicial**: Se `quantidade_inicial` for informada, será criada uma movimentação de entrada.

5. **Categorias**: Se uma categoria não for mapeada, será usada a categoria "outros".

6. **Unidades**: Se uma unidade não for mapeada, será usada "un" (unidade).

## 🔍 Troubleshooting

### Erro: "Arquivo não encontrado"
```bash
❌ Erro: Arquivo "cadastro produtos.json" não encontrado!
```
**Solução**: Certifique-se de que o arquivo está na raiz do projeto.

### Erro: "Variáveis de ambiente não configuradas"
```bash
❌ Erro: Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas
```
**Solução**: Configure o arquivo `.env` com as credenciais do Supabase.

### Erro: "O JSON deve conter um array"
```bash
❌ Erro: O JSON deve conter um array de produtos
```
**Solução**: Verifique se o JSON começa com `[` e termina com `]`.

### Produtos sendo ignorados
```bash
⏭️  Produto já existe: Nome do Produto
```
**Solução**: Este é o comportamento esperado. Produtos já cadastrados não serão duplicados.

## 📊 Após a Importação

1. **Verificar no sistema**: Acesse a tela de produtos do laboratório
2. **Conferir estatísticas**: Veja o painel de estatísticas
3. **Imprimir QR Codes**: Use a funcão de impressão de etiquetas
4. **Ajustar quantidades**: Se necessário, faça ajustes manuais de estoque

## 🔄 Re-executar o Script

Você pode executar o script várias vezes sem problemas:
- Produtos já cadastrados serão ignorados
- Apenas novos produtos serão importados
- Nenhum dado será duplicado

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs de erro detalhados
2. Confira se o arquivo JSON está bem formatado
3. Valide as credenciais do Supabase
4. Revise as permissões de acesso ao banco

---

**Data**: Outubro 2025  
**Versão**: 1.0

