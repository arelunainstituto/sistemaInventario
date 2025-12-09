# 🦷 Sistema de Kits de Procedimentos - ProStoral

## 📋 Visão Geral

O Sistema de Kits de Procedimentos permite organizar e gerenciar conjuntos predefinidos de produtos necessários para diferentes tipos de procedimentos odontológicos. Isso facilita o planejamento de trabalho, controle de estoque e padronização de processos.

## ✨ Funcionalidades

### 1. Gerenciamento de Kits
- ✅ Criar kits personalizados
- ✅ Editar kits existentes
- ✅ Visualizar detalhes dos kits
- ✅ Excluir kits
- ✅ Buscar e filtrar kits

### 2. Tipos de Kits Suportados

#### 🔹 Zircônia
Materiais típicos:
- Modelo impresso com resinas Formlabs
- Bloco de zircônia Dentsply
- Interface sobre implante
- Stains de maquiagem glaze
- Polimento mecânico com pasta grigia
- Escova de pelos de cabra

#### 🔹 Dissilicato de Lítio
Materiais típicos:
- Bloco de dissilicato
- Stains de maquiagem glaze
- Polimento mecânico com pasta grigia
- Escova de pelos de cabra

#### 🔹 Híbridas
Materiais típicos:
- Gessos comuns branco e especiais tipo IV
- Análogos
- Gengivas
- Dentes
- Ceras
- Acrílicos caracterizados
- Líquido termo
- Acrílico termo
- Pedra pomes
- Pasta de polimento
- Barra de titânio
- Brocas variadas
- Espátulas
- Pincéis
- Articuladores
- Zetalabor

#### 🔹 Provisórias para Capturas
Materiais típicos:
- Gesso tipo 2
- Articulador
- Dentes
- Cera
- Acrílico auto
- Líquido auto
- Pedra pomes
- Pasta de polimento
- Brocas variadas
- Espátulas
- Quick up
- Transfers
- Zetalabor

## 🚀 Como Usar

### Criar um Novo Kit

1. Acesse a página de Kits pelo menu principal
2. Clique em "Criar Novo Kit"
3. Preencha as informações:
   - **Nome do Kit**: Nome identificador (ex: "Kit Zircônia Completo")
   - **Tipo**: Selecione o tipo de procedimento
   - **Descrição**: Descreva o kit e sua finalidade
4. Adicione produtos ao kit:
   - Clique em "Adicionar Produto"
   - Busque pelo nome ou código do produto
   - Selecione o produto
   - Informe a quantidade necessária
   - Clique em "Adicionar ao Kit"
5. Repita para todos os produtos necessários
6. Clique em "Salvar Kit"

### Editar um Kit Existente

1. Na lista de kits, clique no ícone de edição (✏️)
2. Modifique as informações desejadas
3. Adicione ou remova produtos conforme necessário
4. Clique em "Salvar Kit"

### Visualizar Detalhes

1. Clique no ícone de visualização (👁️) ou em "Ver detalhes"
2. Veja todas as informações do kit e produtos incluídos

### Excluir um Kit

1. Clique no ícone de exclusão (🗑️)
2. Confirme a exclusão

### Buscar e Filtrar

- **Busca por nome**: Digite no campo de busca para filtrar kits pelo nome
- **Filtrar por tipo**: Selecione um tipo específico no dropdown de filtros

## 🗄️ Estrutura do Banco de Dados

### Tabela: `kits`
```sql
- id (UUID, PK)
- nome (VARCHAR)
- tipo (VARCHAR) - zirconia, dissilicato, hibrida, provisoria, outro
- descricao (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
```

### Tabela: `kit_produtos`
```sql
- id (UUID, PK)
- kit_id (UUID, FK -> kits.id)
- produto_id (UUID, FK -> laboratorio_produtos.id)
- quantidade (DECIMAL)
- created_at (TIMESTAMP)
```

## 📊 Funcionalidades Futuras

### Em Desenvolvimento
- ⏳ Usar kit em uma ordem de serviço
- ⏳ Dar baixa automática no estoque ao usar kit
- ⏳ Modificar produtos do kit durante o uso
- ⏳ Histórico de uso de kits
- ⏳ Relatórios de kits mais utilizados
- ⏳ Custo total do kit
- ⏳ Verificação de disponibilidade de estoque

### Planejado
- 📌 Duplicar kit
- 📌 Exportar/Importar kits
- 📌 Templates de kits por fornecedor
- 📌 Sugestões de produtos complementares
- 📌 Validação de compatibilidade de produtos

## 🔧 Implementação Técnica

### Arquivos Principais

- **Frontend**:
  - `public/prostoral-kits.html` - Interface principal
  - `public/prostoral-kits.js` - Lógica e funcionalidades
  - `public/prostoral.css` - Estilos compartilhados

- **Backend/Database**:
  - `database/kits-schema.sql` - Schema das tabelas
  - `database/seed-kits.sql` - Dados de exemplo (opcional)

### Dependências

- Supabase (autenticação e banco de dados)
- Tailwind CSS (estilização)
- Font Awesome (ícones)

## 🔐 Segurança

### Row Level Security (RLS)

Todas as operações são protegidas por políticas RLS:
- ✅ Apenas usuários autenticados podem acessar kits
- ✅ Todas as operações (SELECT, INSERT, UPDATE, DELETE) requerem autenticação
- ✅ Políticas aplicadas nas tabelas `kits` e `kit_produtos`

## 📝 Exemplos de Uso

### Exemplo 1: Kit Básico de Zircônia
```
Nome: Kit Zircônia Básico
Tipo: Zircônia
Produtos:
  - Bloco de Zircônia Dentsply (1 unidade)
  - Stains de Maquiagem (1 set)
  - Pasta de Polimento Grigia (50g)
```

### Exemplo 2: Kit Completo de Provisórias
```
Nome: Kit Provisórias Completo
Tipo: Provisórias
Produtos:
  - Gesso Tipo 2 (500g)
  - Acrílico Autopolimerizável (100g)
  - Líquido Auto (50ml)
  - Dentes Pré-fabricados (1 set)
  - Quick Up (1 unidade)
```

## 🐛 Troubleshooting

### Kit não aparece na lista
- Verifique se está conectado à internet
- Atualize a página (F5)
- Verifique o console do navegador para erros

### Erro ao adicionar produtos
- Verifique se o produto existe no estoque
- Verifique se a quantidade informada é válida (> 0)
- Certifique-se de que o produto não foi adicionado anteriormente

### Erro ao salvar kit
- Preencha todos os campos obrigatórios (Nome e Tipo)
- Adicione pelo menos um produto ao kit
- Verifique sua conexão com o banco de dados

## 📞 Suporte

Em caso de dúvidas ou problemas:
1. Consulte esta documentação
2. Verifique os logs do navegador (F12 -> Console)
3. Entre em contato com o suporte técnico

---

**Última atualização**: Outubro de 2025
**Versão**: 1.0.0

