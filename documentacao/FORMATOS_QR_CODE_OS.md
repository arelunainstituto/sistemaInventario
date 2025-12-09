# 📱 Formatos de QR Code Aceitos pelo Sistema

## ✅ Formatos Válidos

O sistema ProStoral aceita **3 formatos** de QR Code para identificar Ordens de Serviço:

---

## 1️⃣ **URL Completa** (Recomendado)
```
https://prostoral.app/os/f12f3b8b-6c0c-4e41-a5de-c1d10f3d7123
```

**Exemplo de uso:**
- QR code impresso no documento da OS
- Link compartilhado com cliente
- **Este é o formato gerado automaticamente pelo sistema!**

**Como funciona:**
```javascript
// Sistema extrai o UUID da URL
const match = qrData.match(/\/os\/([a-f0-9-]+)/i);
orderId = match[1]; // f12f3b8b-6c0c-4e41-a5de-c1d10f3d7123
```

---

## 2️⃣ **Código WO-OS-{número}**
```
WO-OS-1761151769001
```

**Exemplo de uso:**
- Etiquetas físicas
- Tags de identificação
- Códigos curtos

**Como funciona:**
```javascript
// Sistema busca pelo order_number
const orderNumber = qrData.replace('WO-OS-', ''); // 1761151769001
// Busca: OS-1761151769001
const order = orders.find(o => o.order_number === `OS-${orderNumber}`);
```

---

## 3️⃣ **UUID Direto**
```
f12f3b8b-6c0c-4e41-a5de-c1d10f3d7123
```

**Exemplo de uso:**
- Integração com sistemas externos
- APIs
- Bancos de dados

**Como funciona:**
```javascript
// Sistema valida formato UUID e usa diretamente
if (qrData.match(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)) {
    orderId = qrData;
}
```

---

## 📊 Comparação

| Formato | Tamanho QR | Facilidade | Uso Recomendado |
|---------|-----------|------------|-----------------|
| **URL Completa** | Grande | ⭐⭐⭐⭐⭐ | **Impressão em documentos** |
| **WO-OS-{número}** | Médio | ⭐⭐⭐⭐ | Etiquetas físicas |
| **UUID Direto** | Pequeno | ⭐⭐⭐ | Integrações técnicas |

---

## 🎯 Formato Gerado pelo Sistema

Quando você cria uma OS e visualiza os detalhes, o sistema **gera automaticamente** um QR code no formato:

```
https://prostoral.app/os/{UUID_DA_ORDEM}
```

**Exemplo real:**
- OS criada: `OS-1761151769001`
- UUID interno: `f12f3b8b-6c0c-4e41-a5de-c1d10f3d7123`
- **QR Code gerado:** `https://prostoral.app/os/f12f3b8b-6c0c-4e41-a5de-c1d10f3d7123`

---

## 🔍 Como o Scanner Processa

```javascript
async handleQrCodeDetected(qrData) {
    let orderId = null;

    // 1. Tenta extrair de URL
    if (qrData.includes('/os/')) {
        orderId = qrData.match(/\/os\/([a-f0-9-]+)/i)[1];
    }
    // 2. Tenta UUID direto
    else if (qrData.match(/^[a-f0-9]{8}-[a-f0-9]{4}/i)) {
        orderId = qrData;
    }
    // 3. Tenta código WO-OS
    else if (qrData.startsWith('WO-OS-')) {
        const orderNumber = qrData.replace('WO-OS-', '');
        orderId = buscarPorNumero(`OS-${orderNumber}`);
    }

    // Abre a ordem
    await this.loadOrderDetails(orderId);
}
```

---

## 💡 Exemplos de QR Codes Válidos

### Para OS-1761151769001:
1. ✅ `https://prostoral.app/os/f12f3b8b-6c0c-4e41-a5de-c1d10f3d7123`
2. ✅ `WO-OS-1761151769001`
3. ✅ `f12f3b8b-6c0c-4e41-a5de-c1d10f3d7123`

### Para OS-1761125928818:
1. ✅ `https://prostoral.app/os/0ee87bc6-2a9f-432e-85b6-21452a21563d`
2. ✅ `WO-OS-1761125928818`
3. ✅ `0ee87bc6-2a9f-432e-85b6-21452a21563d`

---

## ❌ Formatos NÃO Aceitos

```
❌ OS-1761151769001           (falta prefixo WO-)
❌ ordem/f12f3b8b...           (URL errada)
❌ prostoral.app/ordem/...     (caminho errado)
❌ 1761151769001               (só número, sem contexto)
```

---

## 🖨️ Como Imprimir QR Code

Ao visualizar os detalhes de uma OS:
1. Clique em **"Ver Detalhes"**
2. Role até a seção **"QR Code"**
3. O QR code é exibido automaticamente
4. Use **Ctrl+P** para imprimir
5. Ou clique com botão direito → **"Salvar imagem como..."**

---

## 📷 Como Usar o Scanner

1. **Abra** a tela de Ordens de Serviço
2. **Clique** no botão azul **"🔷 Ler OS"**
3. **Permita** acesso à câmera (primeira vez)
4. **Posicione** o QR code na frente da câmera
5. **Sistema detecta automaticamente** e abre a OS!

---

## ✨ Benefícios do QR Code

- ⚡ **Abertura instantânea** da OS
- 🔍 **Identificação rápida** no chão de fábrica
- 📱 **Compatível** com qualquer smartphone
- 🖨️ **Fácil de imprimir** em etiquetas
- 🔗 **Rastreamento** completo do processo

