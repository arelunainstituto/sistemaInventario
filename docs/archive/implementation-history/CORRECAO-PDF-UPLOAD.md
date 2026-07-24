# 🔧 Correção de Upload de PDFs - Sistema de Inventário

## 📋 Índice
1. [Problema Original](#problema-original)
2. [Causa Raiz](#causa-raiz)
3. [Correções Aplicadas](#correções-aplicadas)
4. [Testes Realizados](#testes-realizados)
5. [Commits](#commits)

---

## 🐛 Problema Original

### Sintomas:
- ✅ Itens eram criados/editados com **sucesso (Status 200)**
- ❌ **PDFs NÃO apareciam** na visualização do item
- ✅ PDFs eram **enviados ao Supabase Storage** corretamente
- ❌ **Caminhos dos PDFs NÃO eram salvos** no banco de dados

### Erros Encontrados Durante a Investigação:
1. `MulterError: File too large` (limite de 5MB)
2. `ReferenceError: pdfFile is not defined` (frontend)
3. Erro 413 (Content Too Large) na Vercel
4. PDFs salvos mas não aparecendo na visualização

---

## 🎯 Causa Raiz

### Problema Principal: Mismatch de Nome de Campo

O **frontend** enviava o campo com um nome:
```javascript
// FormData enviado pelo frontend:
formData.append('pdf_paths', fileName);  // ← SEM colchetes []
```

Mas o **backend** procurava com outro nome:
```javascript
// Backend procurava:
const pdfPaths = req.body['pdf_paths[]'];  // ← COM colchetes []
// Resultado: undefined → PDFs não salvos!
```

**Fluxo do problema:**
1. Frontend envia PDF para Supabase Storage ✅
2. Frontend envia caminho via `pdf_paths` ✅
3. Backend procura `pdf_paths[]` → **não encontra** ❌
4. Backend salva item com `pdfs: []` (array vazio) ❌
5. Item aparece sem PDF na visualização ❌

---

## 🔧 Correções Aplicadas

### Correção 1: Aumentar Limite de Upload (Ambiente Local)

**Arquivo:** `api/index.js`  
**Localização:** Configuração do multer (~linha 70-85)

```javascript
// ANTES:
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB - muito pequeno
    },
    // ...
});

// DEPOIS:
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB - aumentado para PDFs maiores
    },
    // ...
});
```

---

### Correção 2: Adicionar Função `updatePdfProgressBar`

**Arquivo:** `public/app.js`  
**Localização:** Após a função `updateImageProgressBar` (~linha 904)

```javascript
// ADICIONAR esta função:
function updatePdfProgressBar(percent, text) {
    const progressBar = document.getElementById('pdfProgressBar');
    const progressText = document.getElementById('pdfProgressText');
    const progressPercent = document.getElementById('pdfProgressPercent');
    
    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.textContent = text;
    if (progressPercent) progressPercent.textContent = percent + '%';
}
```

**Motivo:** O código chamava esta função mas ela não existia, causando `ReferenceError`.

---

### Correção 3: Upload Direto para Supabase Storage (Contornar Limite da Vercel)

**Problema:** Vercel Hobby tem limite de 4.5MB para o body da requisição.

**Solução:** Frontend faz upload direto para Supabase Storage, envia apenas o caminho para a API.

#### Frontend - Arquivo: `public/app.js`

**Localização:** Dentro do handler do formulário de criação (~linhas 220-260)

```javascript
// ADICIONAR: Upload de PDFs diretamente para o Supabase Storage
const pdfFiles = document.getElementById('itemPdf')?.files;

if (pdfFiles && pdfFiles.length > 0) {
    const pdfUploadProgress = document.getElementById('pdfUploadProgress');
    const pdfPreview = document.getElementById('pdfPreview');
    
    if (pdfUploadProgress) pdfUploadProgress.classList.remove('hidden');
    if (pdfPreview) pdfPreview.classList.add('hidden');
    
    updatePdfProgressBar(0, 'Preparando upload de PDFs...');
    
    console.log('Fazendo upload de PDFs para Supabase Storage:', pdfFiles.length);
    
    for (let i = 0; i < pdfFiles.length; i++) {
        const pdfFile = pdfFiles[i];
        const sanitizedName = pdfFile.name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${sanitizedName}`;
        
        updatePdfProgressBar((i / pdfFiles.length) * 50, `Uploading PDF ${i + 1}/${pdfFiles.length}...`);
        console.log(`Uploading PDF ${i + 1}/${pdfFiles.length}: ${fileName}`);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('item-pdfs')
            .upload(fileName, pdfFile, {
                cacheControl: '3600',
                upsert: false,
                contentType: 'application/pdf'
            });
        
        if (uploadError) {
            console.error('Erro no upload do PDF:', uploadError);
            throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
        }
        
        console.log('PDF uploaded:', uploadData.path);
        formData.append('pdf_paths', uploadData.path);
    }
    
    updatePdfProgressBar(100, 'PDFs enviados com sucesso!');
    console.log('Upload de PDFs concluído. Caminhos:', Array.from(formData.getAll('pdf_paths')));
}
```

#### Frontend - Arquivo: `public/edit-item.js`

**Localização:** Dentro da função `saveItem` (~linhas 515-555)

```javascript
// ADICIONAR: Upload de PDFs diretamente para o Supabase Storage (mesmo código do app.js)
if (selectedPdfs && selectedPdfs.length > 0) {
    console.log('Fazendo upload de PDFs para Supabase Storage:', selectedPdfs.length);
    
    for (let i = 0; i < selectedPdfs.length; i++) {
        const pdfFile = selectedPdfs[i];
        const sanitizedName = pdfFile.name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${sanitizedName}`;
        
        console.log(`Uploading PDF ${i + 1}/${selectedPdfs.length}: ${fileName}`);
        
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('item-pdfs')
            .upload(fileName, pdfFile, {
                cacheControl: '3600',
                upsert: false,
                contentType: 'application/pdf'
            });
        
        if (uploadError) {
            console.error('Erro no upload do PDF:', uploadError);
            throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
        }
        
        console.log('PDF uploaded:', uploadData.path);
        formData.append('pdf_paths', uploadData.path);
    }
    
    console.log('Upload de PDFs concluído. Caminhos:', Array.from(formData.getAll('pdf_paths')));
}
```

#### Backend - Arquivo: `api/index.js`

**Localização:** Endpoint POST `/api/items` (~linhas 426-450)

```javascript
// MODIFICAR: Processar PDFs - aceita caminhos pré-enviados
console.log('=== DEBUG PDF PATHS (POST) ===');
console.log('req.body:', req.body);
console.log('req.body["pdf_paths[]"]:', req.body['pdf_paths[]']);
console.log('req.body.pdf_paths:', req.body.pdf_paths);
console.log('req.files:', req.files);

// Aceita tanto pdf_paths[] quanto pdf_paths (com ou sem colchetes)
const pdfPaths = req.body['pdf_paths[]'] || req.body.pdf_paths;

if (pdfPaths) {
    // PDFs já foram enviados para o Supabase Storage pelo frontend
    console.log('PDF paths encontrados:', pdfPaths);
    const paths = Array.isArray(pdfPaths) ? pdfPaths : [pdfPaths];
    pdfUrls = paths.map(path => `${supabaseUrl}/storage/v1/object/public/item-pdfs/${path}`);
} else if (req.files && req.files.pdf && req.files.pdf.length > 0) {
    // Fallback: upload tradicional via multer (ambiente local)
    for (const pdfFile of req.files.pdf) {
        const sanitizedName = sanitizeFileName(pdfFile.originalname);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${sanitizedName}`;
        try {
            const pdfUrl = await uploadPdfToStorage(pdfFile, fileName);
            pdfUrls.push(pdfUrl);
        } catch (uploadError) {
            console.error('Erro no upload do PDF:', uploadError);
            return res.status(500).json({
                error: 'Erro ao fazer upload do PDF',
                details: uploadError.message
            });
        }
    }
}
```

**Localização:** Endpoint PUT `/api/items/:id` (~linhas 664-695)

```javascript
// MODIFICAR: Processar PDFs - aceita caminhos pré-enviados (mesmo código do POST)
console.log('req.files:', req.files);
console.log('req.files.pdf:', req.files ? req.files.pdf : 'undefined');
console.log('req.body["pdf_paths[]"]:', req.body['pdf_paths[]']);
console.log('req.body.pdf_paths:', req.body.pdf_paths);

// Processar PDFs - pode vir como arquivo (multer) ou como caminhos já enviados
// Aceita tanto pdf_paths[] quanto pdf_paths (com ou sem colchetes)
const pdfPaths = req.body['pdf_paths[]'] || req.body.pdf_paths;

if (pdfPaths) {
    // PDFs já foram enviados para o Supabase Storage pelo frontend
    console.log('Processando PDFs já enviados ao Storage:', pdfPaths);
    const paths = Array.isArray(pdfPaths) ? pdfPaths : [pdfPaths];
    const newPdfUrls = paths.map(path => `${supabaseUrl}/storage/v1/object/public/item-pdfs/${path}`);
    pdfUrls.push(...newPdfUrls);
    console.log('PDFs adicionados ao array:', newPdfUrls);
} else if (req.files && req.files.pdf && req.files.pdf.length > 0) {
    // Fallback: upload tradicional via multer (ambiente local)
    console.log('Fazendo upload de novos PDFs via multer:', req.files.pdf.length);
    for (const pdfFile of req.files.pdf) {
        const sanitizedName = sanitizeFileName(pdfFile.originalname);
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${sanitizedName}`;
        try {
            const newPdfUrl = await uploadPdfToStorage(pdfFile, fileName);
            console.log('PDF uploaded:', newPdfUrl);
            pdfUrls.push(newPdfUrl);
        } catch (uploadError) {
            console.error('Erro no upload do PDF:', uploadError);
            return res.status(500).json({
                error: 'Erro ao fazer upload do PDF',
                details: uploadError.message
            });
        }
    }
}
```

---

### Correção 4: Corrigir Estrutura de Dados no Endpoint PUT

**Problema:** O endpoint PUT salvava dados na estrutura incorreta.

**Arquivo:** `api/index.js`  
**Localização:** Endpoint PUT `/api/items/:id` (~linhas 700-750)

```javascript
// ANTES (ERRADO):
const itemData = {
    pdfs: pdfUrls,
    module_data: {
        name: name.trim(),        // ❌ ERRADO - name dentro de module_data
        description: description, // ❌ ERRADO
        company: company,         // ❌ ERRADO
        status: status,          // ❌ ERRADO
        location: location,
        value: value,
        brand: brand,
        model: model,
        serial_number: serial_number,
        purchase_date: purchase_date,
        warranty_date: warranty_date,
        image: imageUrl,
        pdf: pdfUrls.length > 0 ? pdfUrls[0] : null
    },
    categoria_id: categoria_id || null,
    colaborador_id: colaborador_id || null,
    updated_at: new Date().toISOString()
};

// DEPOIS (CORRETO):
const itemData = {
    name: name.trim(),           // ✅ CORRETO - name no nível superior
    description: description?.trim() || null,
    category: category?.trim() || null,
    location: location?.trim() || null,
    status: status.trim(),
    categoria_id: categoria_id || null,
    colaborador_id: colaborador_id || null,
    pdfs: pdfUrls,              // ✅ CORRETO - pdfs no nível superior
    module_data: {              // ✅ Apenas dados específicos do módulo
        company: company.trim(),
        value: value ? parseFloat(value) : null,
        brand: brand?.trim() || null,
        model: model?.trim() || null,
        serial_number: serial_number?.trim() || null,
        purchase_date: purchase_date || null,
        warranty_date: warranty_date || null,
        image: imageUrl,
        pdf: pdfUrls.length > 0 ? pdfUrls[0] : null
    },
    updated_at: new Date().toISOString()
};
```

**Motivo:** A estrutura errada fazia com que os campos principais (`name`, `description`, etc.) não fossem atualizados corretamente no banco.

---

### ⭐ Correção 5: Aceitar `pdf_paths` com ou sem colchetes (CORREÇÃO FINAL)

**Esta é a correção mais importante que resolveu o problema principal!**

**Arquivo:** `api/index.js`

#### POST `/api/items` (~linha 434):

```javascript
// ANTES:
const pdfPaths = req.body['pdf_paths[]'];  // ← Só aceitava COM colchetes

// DEPOIS:
// Aceita tanto pdf_paths[] quanto pdf_paths (com ou sem colchetes)
const pdfPaths = req.body['pdf_paths[]'] || req.body.pdf_paths;
```

#### PUT `/api/items/:id` (~linha 672):

```javascript
// ANTES:
const pdfPaths = req.body['pdf_paths[]'];  // ← Só aceitava COM colchetes

// DEPOIS:
// Aceita tanto pdf_paths[] quanto pdf_paths (com ou sem colchetes)
const pdfPaths = req.body['pdf_paths[]'] || req.body.pdf_paths;
```

**Por que isso resolve:**
- Frontend envia `pdf_paths` (sem colchetes)
- Backend agora aceita **ambos os formatos**
- PDFs são encontrados e salvos corretamente no banco
- PDFs aparecem na visualização ✅

---

### Correção 6: Remover Referência a `styles-backup.css`

**Arquivo:** `public/index.html`  
**Localização:** `<head>` (~linha 10)

```html
<!-- REMOVER esta linha: -->
<link rel="stylesheet" href="styles-backup.css">
```

**Motivo:** Arquivo não existe, causava erro 404.

---

### Correção 7: Adicionar Suporte para Múltiplos PDFs

**Arquivo:** `public/index.html`  
**Localização:** Input de PDF (~linha 250)

```html
<!-- ANTES: -->
<input type="file" id="itemPdf" name="pdf" accept=".pdf" class="hidden">

<!-- DEPOIS: -->
<input type="file" id="itemPdf" name="pdf" accept=".pdf" multiple class="hidden">
```

**Motivo:** Permitir seleção de múltiplos arquivos PDF.

---

## 📊 Testes Realizados

### ✅ Teste 1: Criar Item com PDF (POST)

**Resultado:**
```
✅ Item criado: "Teste Criação com PDF via Chrome"
✅ PDF enviado: teste-criacao-novo.pdf
✅ PDF salvo no Supabase Storage
✅ Caminho salvo no banco: pdfs: [URL_completa]
✅ PDF aparece na visualização com botão "Visualizar"
```

**Logs do servidor:**
```javascript
req.body.pdf_paths: [ '1761228953455-r8emvd-teste-criacao-novo.pdf' ]
PDF paths encontrados: [ '1761228953455-r8emvd-teste-criacao-novo.pdf' ]
pdfUrls: [
  'https://hvqckoajxhdqaxfawisd.supabase.co/storage/v1/object/public/item-pdfs/1761228953455-r8emvd-teste-criacao-novo.pdf'
]
Item data before insert: {
  ...
  "pdfs": ["https://..."],  // ✅ PDFs no array
  ...
}
```

### ✅ Teste 2: Editar Item e Adicionar PDF (PUT)

**Resultado:**
```
✅ Item editado: "teste q"
✅ PDF enviado: teste-chrome-v2.pdf
✅ PDF salvo no Supabase Storage
✅ Caminho salvo no banco: pdfs: [URL_completa]
✅ PDF aparece na visualização com botão "Visualizar"
```

---

## 📝 Commits

Lista de commits aplicados (em ordem cronológica):

1. **8a9ace4** - fix: aumentar limite de upload para 50MB e corrigir erro de upload de PDF
2. **afdbfea** - fix: resolver erro 413 na criação com PDF (Vercel)
3. **88c81d6** - fix: adicionar função updatePdfProgressBar faltante
4. **75123a9** - fix: resolver erro 413 na edição de itens com PDF (Vercel)
5. **987e696** - debug: adicionar logs detalhados para diagnosticar problema de salvamento
6. **651e1db** - fix: corrigir estrutura de dados no endpoint PUT de edição
7. **45471b3** - debug: adicionar logs detalhados para pdf_paths no POST
8. **2739263** - ⭐ fix: aceitar pdf_paths com ou sem colchetes no backend (CORREÇÃO FINAL)

---

## ✅ Checklist de Implementação

Use este checklist ao aplicar as correções em outra branch:

- [ ] 1. Aumentar limite do multer de 5MB para 50MB (`api/index.js`)
- [ ] 2. Adicionar função `updatePdfProgressBar` (`public/app.js`)
- [ ] 3. Modificar upload de PDF no frontend para enviar direto ao Supabase Storage (`public/app.js`)
- [ ] 4. Modificar upload de PDF no frontend para enviar direto ao Supabase Storage (`public/edit-item.js`)
- [ ] 5. Modificar endpoint POST para aceitar `pdf_paths` com ou sem colchetes (`api/index.js`)
- [ ] 6. Modificar endpoint PUT para aceitar `pdf_paths` com ou sem colchetes (`api/index.js`)
- [ ] 7. Corrigir estrutura de dados no endpoint PUT (`api/index.js`)
- [ ] 8. Remover referência a `styles-backup.css` (`public/index.html`)
- [ ] 9. Adicionar atributo `multiple` ao input de PDF (`public/index.html`)
- [ ] 10. Adicionar `maxDuration` no `vercel.json`
- [ ] 11. Testar criação de item com PDF
- [ ] 12. Testar edição de item com PDF
- [ ] 13. Verificar se PDFs aparecem na visualização

---

## 🎉 Resultado Final

**Status:** ✅ **TUDO FUNCIONANDO**

- ✅ Criação de itens com PDF (POST)
- ✅ Edição de itens com PDF (PUT)
- ✅ PDFs aparecem na visualização
- ✅ Funciona localmente (porta 3002)
- ✅ Funciona na Vercel (produção)
- ✅ Suporta múltiplos PDFs
- ✅ Suporta arquivos até 50MB (local) / ilimitado (Vercel com upload direto)

---

## 🔍 Como Verificar se Está Funcionando

### 1. Verificar logs do servidor:
```bash
tail -f server.log | grep "pdf_paths"
```

**Deve aparecer:**
```
req.body.pdf_paths: [ 'nome-do-arquivo.pdf' ]
PDF paths encontrados: [ 'nome-do-arquivo.pdf' ]
pdfUrls: [ 'https://...supabase.co/.../nome-do-arquivo.pdf' ]
```

### 2. Verificar no banco de dados:
```sql
SELECT id, name, pdfs FROM sistemainventario 
WHERE created_at > NOW() - INTERVAL '1 day'
ORDER BY created_at DESC
LIMIT 5;
```

**Deve retornar:**
```json
{
  "id": "...",
  "name": "Nome do Item",
  "pdfs": [
    "https://hvqckoajxhdqaxfawisd.supabase.co/storage/v1/object/public/item-pdfs/arquivo.pdf"
  ]
}
```

### 3. Verificar na interface:
- Criar/editar item com PDF
- Abrir visualização do item
- Deve aparecer seção "📄 Documentos" com o PDF e botão "Visualizar"

---

## 📞 Suporte

Se encontrar problemas ao aplicar estas correções:

1. Verifique os logs do servidor (`tail -f server.log`)
2. Verifique o console do navegador (F12)
3. Compare o código com os exemplos acima
4. Certifique-se de que todas as correções foram aplicadas

**Última atualização:** 23/10/2025

