# 🦷 Como Usar o Sistema de Kits - ProStoral

## 🚀 Sistema Pronto Para Uso!

O sistema de Kits de Procedimentos está 100% funcional e pronto para você criar seus próprios kits!

---

## 📋 O Que Você Pode Fazer

### ✅ **Criar Kits Personalizados**
1. Dê um nome ao seu kit (ex: "Kit Zircônia Completo")
2. Escolha o tipo de procedimento
3. Adicione os produtos do estoque
4. Defina a quantidade de cada produto

### ✅ **Gerenciar Kits**
- Ver todos os kits criados
- Editar kits existentes
- Excluir kits
- Buscar e filtrar kits

### ✅ **Organizar Produtos**
- Adicionar produtos do inventário aos kits
- Definir quantidades específicas
- Remover produtos dos kits
- Visualizar estoque disponível

---

## 🎯 Como Acessar

### **Passo 1: Abra o Sistema**
```
http://localhost:3002/prostoral.html
```

### **Passo 2: Vá para Kits**
1. Faça login
2. Clique na aba **"Kits"**
3. Clique em **"Gerenciar Kits"**

### **Passo 3: Criar Seu Primeiro Kit**
1. Clique em **"Criar Novo Kit"**
2. Preencha:
   - **Nome**: Ex: "Kit Zircônia Básico"
   - **Tipo**: Escolha entre:
     - 🦷 Zircônia
     - 💎 Dissilicato de Lítio
     - 🔧 Híbridas
     - 🔨 Provisórias para Capturas
     - 📋 Outro
   - **Descrição**: Opcional, mas recomendado
3. Clique em **"Adicionar Produto"**
4. Busque o produto no estoque
5. Selecione e informe a quantidade
6. Clique em **"Adicionar ao Kit"**
7. Repita para adicionar mais produtos
8. Clique em **"Salvar Kit"**

---

## 📦 Produtos Disponíveis no Inventário

Você pode usar qualquer um dos 21 produtos já cadastrados no sistema:

1. Álcool Isopropílico
2. Broca Diamantada FG
3. Cerâmica Feldspática IPS e.max
4. Cerâmica VITA VM 9
5. Disco de Corte
6. Gesso Comum Tipo II
7. Gesso Pedra Tipo III
8. Gesso Pedra Tipo IV
9. Liga Metálica Co-Cr
10. Liga Metálica Ni-Cr
11. Lixa de Papel
12. Ouro Tipo III
13. Pedra Montada
14. Porcelana VITA VMK Master
15. Resina Acrílica Jet
16. Resina Fotopolimerizável
17. Resina para Base Rosa
18. Silicone de Adição
19. Silicone de Condensação
20. Spray Separador
21. Zircônia Branca

**Importante**: Se precisar de mais produtos, cadastre-os primeiro no inventário (`prostoral_inventory`) antes de adicionar aos kits!

---

## 💡 Exemplos de Kits

### Exemplo 1: Kit Zircônia Básico
```
Nome: Kit Zircônia Básico
Tipo: Zircônia
Produtos:
  - Zircônia Branca: 1 unidade
  - Broca Diamantada FG: 5 unidades
```

### Exemplo 2: Kit Gesso Simples
```
Nome: Kit Gesso para Modelos
Tipo: Outro
Produtos:
  - Gesso Pedra Tipo III: 1 kg
  - Gesso Pedra Tipo IV: 0.5 kg
```

---

## 🔧 Funcionalidades Disponíveis

### ✅ Interface Completa
- Design moderno e responsivo
- Cards visuais para cada kit
- Modals para formulários
- Notificações de ações
- Busca e filtros em tempo real

### ✅ Operações CRUD
- **Create**: Criar novos kits
- **Read**: Visualizar kits e detalhes
- **Update**: Editar kits existentes
- **Delete**: Excluir kits

### ✅ Integração com Estoque
- Busca produtos em tempo real
- Visualiza quantidade disponível
- Valida se produto existe
- Mostra código e unidade de medida

### ✅ Segurança
- Autenticação obrigatória
- RLS (Row Level Security) habilitado
- Políticas de acesso configuradas

---

## 📊 Estrutura do Banco de Dados

### Tabelas Criadas

#### `kits`
- **id**: Identificador único
- **nome**: Nome do kit
- **tipo**: zirconia, dissilicato, hibrida, provisoria, outro
- **descricao**: Descrição detalhada
- **created_at**: Data de criação
- **updated_at**: Data de atualização

#### `kit_produtos`
- **id**: Identificador único
- **kit_id**: Referência ao kit
- **produto_id**: Referência ao produto (`prostoral_inventory`)
- **quantidade**: Quantidade necessária
- **created_at**: Data de criação

---

## 🐛 Solução de Problemas

### Problema: Não consigo ver os kits
**Solução**: Verifique se está logado no sistema

### Problema: Produtos não aparecem na busca
**Solução**: Certifique-se de que os produtos têm quantidade > 0 no estoque

### Problema: Erro ao salvar kit
**Solução**: 
- Preencha todos os campos obrigatórios (Nome e Tipo)
- Adicione pelo menos 1 produto ao kit
- Verifique se a quantidade é maior que 0

---

## 📝 Dicas de Uso

1. **Organize por Tipo**: Use os tipos de kit para facilitar a busca
2. **Descrições Claras**: Adicione descrições detalhadas para facilitar o entendimento
3. **Quantidades Realistas**: Defina quantidades baseadas no uso real
4. **Mantenha Atualizado**: Edite os kits conforme o processo evolui
5. **Revise Periodicamente**: Verifique se os produtos ainda estão disponíveis

---

## 🎯 Próximos Passos (Futuro)

### Planejado para Fase 2
- ⏳ Usar kit em ordem de serviço
- ⏳ Baixa automática no estoque ao usar kit
- ⏳ Modificar produtos durante o uso
- ⏳ Histórico de uso de kits
- ⏳ Relatórios de consumo

---

## ✅ Sistema Pronto!

O sistema está 100% funcional e pronto para você criar quantos kits precisar!

**Comece agora**:
1. Acesse `http://localhost:3002/prostoral.html`
2. Vá para a aba "Kits"
3. Clique em "Gerenciar Kits"
4. Crie seu primeiro kit!

---

**Data**: 21 de Outubro de 2025  
**Status**: ✅ Operacional  
**Versão**: 1.0.0

