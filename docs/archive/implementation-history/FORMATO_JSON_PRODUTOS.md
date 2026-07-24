# 📋 FORMATO JSON - CADASTRO DE PRODUTOS

**Sistema**: ProStoral Laboratório  
**Versão**: 1.0  
**Data**: 21 de outubro de 2025

---

## 🎯 ENDPOINT

```
POST /api/laboratorio/produtos
Content-Type: application/json
Authorization: Bearer {token}
```

---

## 📦 FORMATO JSON COMPLETO

### **Exemplo 1: Produto Básico (Mínimo Obrigatório)**

```json
{
  "qr_code": "LAB-A1B2C3D4",
  "nome_material": "Resina Acrílica Premium",
  "categoria": "Resinas",
  "unidade_medida": "kg",
  "quantidade_inicial": 5.0,
  "quantidade_minima": 2.0,
  "quantidade_maxima": 20.0
}
```

---

### **Exemplo 2: Produto Completo (Todos os Campos)**

```json
{
  "qr_code": "LAB-9D5FBA3B",
  "codigo_barras": "7891234567890",
  "categoria": "Cerâmicas",
  "nome_material": "Cera para Fundição Premium",
  "marca": "IvoclarVivadent",
  "fornecedor": "Dental Med Importadora Ltda",
  "referencia_lote": "LT-2024-10-001",
  "unidade_medida": "kg",
  "localizacao": "Armário B - Prateleira 3",
  "data_validade": "2025-12-31",
  "descricao": "Cera de alta precisão para fundição de próteses metálicas. Expansão controlada de 1.2%. Temperatura de fusão: 95°C.",
  "observacoes": "Armazenar em temperatura ambiente (20-25°C). Manter longe de fontes de calor direto.",
  "ativo": true,
  "quantidade_inicial": 10.5,
  "quantidade_minima": 3.0,
  "quantidade_maxima": 30.0,
  "preco_unitario": 250.50
}
```

---

## 📝 DESCRIÇÃO DOS CAMPOS

### **OBRIGATÓRIOS** ✅

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `qr_code` | String | Código QR único do produto | `"LAB-9D5FBA3B"` |
| `nome_material` | String | Nome do material/produto | `"Resina Acrílica"` |
| `categoria` | String | Categoria do produto | `"Resinas"` |
| `unidade_medida` | String | Unidade de medida | `"kg"`, `"L"`, `"un"` |
| `quantidade_inicial` | Number | Quantidade no estoque | `10.5` |
| `quantidade_minima` | Number | Estoque mínimo (alerta) | `2.0` |
| `quantidade_maxima` | Number | Estoque máximo | `50.0` |

### **OPCIONAIS** 📌

| Campo | Tipo | Descrição | Exemplo |
|-------|------|-----------|---------|
| `codigo_barras` | String | Código de barras (EAN/UPC) | `"7891234567890"` |
| `marca` | String | Marca do fabricante | `"3M"` |
| `fornecedor` | String | Nome do fornecedor | `"Dental Supply Co"` |
| `referencia_lote` | String | Número do lote | `"LT-2024-001"` |
| `localizacao` | String | Localização física | `"Armário A - Prateleira 2"` |
| `data_validade` | String (ISO 8601) | Data de validade | `"2025-12-31"` |
| `descricao` | Text | Descrição detalhada | `"Produto premium..."` |
| `observacoes` | Text | Observações gerais | `"Manter refrigerado"` |
| `ativo` | Boolean | Se está ativo | `true` / `false` |
| `preco_unitario` | Number | Preço por unidade | `150.75` |

---

## 🎨 CATEGORIAS SUGERIDAS

```json
[
  "Resinas",
  "Cerâmicas",
  "Metais",
  "Ceras",
  "Gesso",
  "Silicones",
  "Acrílicos",
  "Instrumentos",
  "Equipamentos",
  "Consumíveis",
  "Produtos Químicos",
  "Materiais de Acabamento",
  "Outros"
]
```

---

## 📏 UNIDADES DE MEDIDA SUGERIDAS

```json
[
  "kg",      // Quilogramas
  "g",       // Gramas
  "L",       // Litros
  "mL",      // Mililitros
  "un",      // Unidades
  "cx",      // Caixas
  "pct",     // Pacotes
  "m",       // Metros
  "cm",      // Centímetros
  "mm",      // Milímetros
  "m²",      // Metros quadrados
  "m³"       // Metros cúbicos
]
```

---

## ✅ VALIDAÇÕES

### **Regras de Negócio:**

```javascript
{
  "qr_code": {
    "type": "string",
    "required": true,
    "unique": true,
    "pattern": "^LAB-[A-Z0-9]{8}$",
    "example": "LAB-9D5FBA3B"
  },
  "codigo_barras": {
    "type": "string",
    "optional": true,
    "pattern": "^[0-9]{13}$",
    "example": "7891234567890"
  },
  "nome_material": {
    "type": "string",
    "required": true,
    "minLength": 3,
    "maxLength": 200,
    "example": "Resina Acrílica Premium"
  },
  "categoria": {
    "type": "string",
    "required": true,
    "enum": ["Resinas", "Cerâmicas", "Metais", "..."]
  },
  "unidade_medida": {
    "type": "string",
    "required": true,
    "enum": ["kg", "g", "L", "mL", "un", "..."]
  },
  "quantidade_inicial": {
    "type": "number",
    "required": true,
    "min": 0,
    "example": 10.5
  },
  "quantidade_minima": {
    "type": "number",
    "required": true,
    "min": 0,
    "validate": "quantidade_minima < quantidade_maxima"
  },
  "quantidade_maxima": {
    "type": "number",
    "required": true,
    "min": 0,
    "validate": "quantidade_maxima > quantidade_minima"
  },
  "data_validade": {
    "type": "date",
    "optional": true,
    "format": "YYYY-MM-DD",
    "validate": "data_validade > hoje"
  },
  "preco_unitario": {
    "type": "number",
    "optional": true,
    "min": 0,
    "precision": 2
  },
  "ativo": {
    "type": "boolean",
    "default": true
  }
}
```

---

## 🔄 EXEMPLOS DE USO

### **1. Resina Acrílica**

```json
{
  "qr_code": "LAB-BD593CBB",
  "codigo_barras": "7891234560001",
  "categoria": "Resinas",
  "nome_material": "Resina Acrílica Premium",
  "marca": "Angelus",
  "fornecedor": "Dental Supply Brasil",
  "referencia_lote": "LT-2024-10-100",
  "unidade_medida": "kg",
  "localizacao": "Armário A - Prateleira 2",
  "data_validade": "2026-06-30",
  "descricao": "Resina acrílica autopolimerizável para base de próteses removíveis. Alta resistência e durabilidade.",
  "observacoes": "Manter em local fresco e seco. Usar luvas ao manusear.",
  "ativo": true,
  "quantidade_inicial": 15.0,
  "quantidade_minima": 5.0,
  "quantidade_maxima": 50.0,
  "preco_unitario": 180.00
}
```

### **2. Gesso Tipo IV**

```json
{
  "qr_code": "LAB-32AF8038",
  "codigo_barras": "7891234560002",
  "categoria": "Gesso",
  "nome_material": "Gesso Tipo IV - Extra Duro",
  "marca": "Polidental",
  "fornecedor": "Odonto Center",
  "referencia_lote": "GS-2024-Q4-050",
  "unidade_medida": "kg",
  "localizacao": "Armário C - Prateleira 1",
  "data_validade": "2027-12-31",
  "descricao": "Gesso pedra tipo IV de alta resistência para modelos de trabalho. Expansão de presa: 0.05%.",
  "observacoes": "Proporção água/pó: 19mL/100g. Tempo de trabalho: 5min.",
  "ativo": true,
  "quantidade_inicial": 25.0,
  "quantidade_minima": 10.0,
  "quantidade_maxima": 100.0,
  "preco_unitario": 45.90
}
```

### **3. Liga Metálica CoCr**

```json
{
  "qr_code": "LAB-40C4A045",
  "codigo_barras": "7891234560003",
  "categoria": "Metais",
  "nome_material": "Liga Metálica CoCr",
  "marca": "Dentaurum",
  "fornecedor": "Importadora Dental Tech",
  "referencia_lote": "COCR-2024-500",
  "unidade_medida": "kg",
  "localizacao": "Cofre - Metais Preciosos",
  "data_validade": null,
  "descricao": "Liga de Cromo-Cobalto para estruturas metálicas de próteses. Composição: 60% Co, 28% Cr, 5% Mo.",
  "observacoes": "Temperatura de fusão: 1350°C. Armazenar em local seco e seguro.",
  "ativo": true,
  "quantidade_inicial": 5.0,
  "quantidade_minima": 1.0,
  "quantidade_maxima": 10.0,
  "preco_unitario": 850.00
}
```

### **4. Silicone de Moldagem**

```json
{
  "qr_code": "LAB-09BCCD43",
  "categoria": "Silicones",
  "nome_material": "Silicone de Moldagem",
  "marca": "Zhermack",
  "fornecedor": "Dental Med",
  "unidade_medida": "un",
  "localizacao": "Armário D - Gaveta 2",
  "data_validade": "2025-08-15",
  "descricao": "Silicone de adição para moldagens de precisão.",
  "ativo": true,
  "quantidade_inicial": 20,
  "quantidade_minima": 5,
  "quantidade_maxima": 50,
  "preco_unitario": 120.00
}
```

### **5. Produto Simples (Mínimo)**

```json
{
  "qr_code": "LAB-365F6823",
  "nome_material": "Disco de Polimento",
  "categoria": "Consumíveis",
  "unidade_medida": "un",
  "quantidade_inicial": 100,
  "quantidade_minima": 20,
  "quantidade_maxima": 200
}
```

---

## 📤 CADASTRO EM LOTE (MÚLTIPLOS PRODUTOS)

```json
{
  "produtos": [
    {
      "qr_code": "LAB-PROD001",
      "nome_material": "Resina A",
      "categoria": "Resinas",
      "unidade_medida": "kg",
      "quantidade_inicial": 10,
      "quantidade_minima": 2,
      "quantidade_maxima": 30
    },
    {
      "qr_code": "LAB-PROD002",
      "nome_material": "Gesso B",
      "categoria": "Gesso",
      "unidade_medida": "kg",
      "quantidade_inicial": 15,
      "quantidade_minima": 5,
      "quantidade_maxima": 50
    },
    {
      "qr_code": "LAB-PROD003",
      "nome_material": "Cera C",
      "categoria": "Ceras",
      "unidade_medida": "kg",
      "quantidade_inicial": 8,
      "quantidade_minima": 3,
      "quantidade_maxima": 25
    }
  ]
}
```

**Endpoint:**
```
POST /api/laboratorio/produtos/lote
```

---

## ⚠️ POSSÍVEIS ERROS

### **400 - Bad Request**

```json
{
  "error": "Dados inválidos",
  "details": {
    "qr_code": "QR Code já existe no sistema",
    "quantidade_minima": "Deve ser menor que quantidade_maxima",
    "data_validade": "Data deve estar no futuro"
  }
}
```

### **401 - Unauthorized**

```json
{
  "error": "Token de autenticação inválido ou expirado"
}
```

### **409 - Conflict**

```json
{
  "error": "Produto com este QR Code já existe",
  "existing_id": "uuid-do-produto-existente"
}
```

### **422 - Validation Error**

```json
{
  "error": "Erro de validação",
  "fields": {
    "nome_material": "Campo obrigatório",
    "quantidade_inicial": "Deve ser um número positivo",
    "categoria": "Categoria inválida"
  }
}
```

---

## ✅ RESPOSTA DE SUCESSO

### **201 - Created**

```json
{
  "success": true,
  "message": "Produto cadastrado com sucesso",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "qr_code": "LAB-9D5FBA3B",
    "nome_material": "Cera para Fundição Premium",
    "categoria": "Cerâmicas",
    "quantidade_atual": 10.5,
    "status": "ok",
    "created_at": "2025-10-21T10:30:00Z",
    "updated_at": "2025-10-21T10:30:00Z"
  }
}
```

---

## 🔧 FERRAMENTAS PARA TESTE

### **cURL**

```bash
curl -X POST http://localhost:3002/api/laboratorio/produtos \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -d '{
    "qr_code": "LAB-TEST001",
    "nome_material": "Produto Teste",
    "categoria": "Consumíveis",
    "unidade_medida": "un",
    "quantidade_inicial": 10,
    "quantidade_minima": 2,
    "quantidade_maxima": 30
  }'
```

### **JavaScript (Fetch)**

```javascript
const token = localStorage.getItem('sb-hvqckoajxhdqaxfawisd-auth-token');

fetch('http://localhost:3002/api/laboratorio/produtos', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${JSON.parse(token).access_token}`
  },
  body: JSON.stringify({
    qr_code: 'LAB-TEST001',
    nome_material: 'Produto Teste',
    categoria: 'Consumíveis',
    unidade_medida: 'un',
    quantidade_inicial: 10,
    quantidade_minima: 2,
    quantidade_maxima: 30
  })
})
.then(res => res.json())
.then(data => console.log('Sucesso:', data))
.catch(err => console.error('Erro:', err));
```

### **Postman Collection**

```json
{
  "info": {
    "name": "ProStoral API - Produtos",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Cadastrar Produto",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "Authorization",
            "value": "Bearer {{token}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"qr_code\": \"LAB-TEST001\",\n  \"nome_material\": \"Produto Teste\",\n  \"categoria\": \"Consumíveis\",\n  \"unidade_medida\": \"un\",\n  \"quantidade_inicial\": 10,\n  \"quantidade_minima\": 2,\n  \"quantidade_maxima\": 30\n}"
        },
        "url": {
          "raw": "http://localhost:3002/api/laboratorio/produtos",
          "protocol": "http",
          "host": ["localhost"],
          "port": "3002",
          "path": ["api", "laboratorio", "produtos"]
        }
      }
    }
  ]
}
```

---

## 📚 DOCUMENTAÇÃO ADICIONAL

- **Swagger/OpenAPI**: `/api/docs` (futuro)
- **Postman Collection**: Disponível acima
- **Exemplos GitHub**: `/examples/produtos.json`

---

## 💡 DICAS

1. **QR Code**: Use o formato `LAB-XXXXXXXX` (8 caracteres alfanuméricos)
2. **Código de Barras**: 13 dígitos (EAN-13) ou 12 (UPC-A)
3. **Datas**: Use formato ISO 8601 (`YYYY-MM-DD`)
4. **Decimais**: Use ponto (`.`) como separador decimal
5. **Quantidades**: Podem ter casas decimais (ex: `10.5`)
6. **Texto**: Use UTF-8 para caracteres especiais (á, é, ç, etc)

---

**Desenvolvido por**: Equipe ProStoral  
**Suporte**: suporte@prostoral.com  
**Última atualização**: 21/10/2025

