# 📷 Scanner QR Code para Ordens de Serviço

## 🎯 Funcionalidade Implementada

**Botão "Ler OS"** ao lado de "Nova OS" que permite escanear o QR code impresso nas ordens de serviço para abri-las rapidamente.

---

## ✅ Arquivos Modificados

### 1. **`public/prostoral.html`**

#### Adicionado Biblioteca Html5-QRCode
```html
<!-- QR Code Scanner -->
<script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
```

#### Botão "Ler OS"
```html
<div class="flex gap-3">
    <button id="btn-scan-qr" class="bg-gradient-to-r from-blue-500 to-blue-600 ...">
        <i class="fas fa-qrcode"></i>
        Ler OS
    </button>
    <button id="btn-new-order" class="bg-gradient-to-r from-emerald-500 to-emerald-600 ...">
        <i class="fas fa-plus"></i>
        Nova OS
    </button>
</div>
```

#### Modal do Scanner
```html
<!-- Modal: Scanner QR Code -->
<div id="modal-qr-scanner" class="hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-50 ...">
    <div class="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-2xl w-full">
        <!-- Cabeçalho -->
        <div class="p-6 border-b ...">
            <h3 class="text-2xl font-bold ...">
                <i class="fas fa-qrcode text-blue-600 mr-2"></i>
                Ler QR Code da OS
            </h3>
        </div>
        
        <!-- Área da câmera -->
        <div class="p-6">
            <div id="qr-reader" class="w-full rounded-lg overflow-hidden bg-black" 
                 style="min-height: 300px;"></div>
            
            <!-- Instruções -->
            <div class="mt-4 bg-blue-50 dark:bg-blue-900/20 ...">
                <p class="text-sm text-blue-800 dark:text-blue-300">
                    <i class="fas fa-info-circle mr-2"></i>
                    Posicione o QR code da ordem de serviço na frente da câmera. 
                    O sistema abrirá automaticamente os detalhes da OS quando detectado.
                </p>
            </div>
            
            <!-- Status -->
            <div id="qr-scanner-status" class="mt-3 text-center text-sm ...">
                Aguardando câmera...
            </div>
        </div>
        
        <!-- Botão Fechar -->
        <div class="p-6 border-t ... flex justify-end">
            <button type="button" id="btn-close-qr-scanner" class="...">
                <i class="fas fa-times mr-2"></i>Fechar
            </button>
        </div>
    </div>
</div>
```

---

### 2. **`public/prostoral-ordens.js`**

#### Event Listeners Adicionados

```javascript
// Botão Scanner QR
const btnScanQr = document.getElementById('btn-scan-qr');
if (btnScanQr) {
    btnScanQr.addEventListener('click', () => this.openQrScanner());
}

const btnCloseQrScanner = document.getElementById('btn-close-qr-scanner');
if (btnCloseQrScanner) {
    btnCloseQrScanner.addEventListener('click', () => this.closeQrScanner());
}
```

#### Funções Implementadas

##### **`openQrScanner()`**
- Abre o modal do scanner
- Solicita permissão de câmera
- Inicia a detecção de QR codes
- Usa câmera traseira por padrão (`facingMode: "environment"`)
- Configurado para 10 FPS com caixa de 250x250px

```javascript
async openQrScanner() {
    const modal = document.getElementById('modal-qr-scanner');
    modal.classList.remove('hidden');
    
    // Inicializar scanner
    this.html5QrcodeScanner = new Html5Qrcode("qr-reader");
    
    await this.html5QrcodeScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => this.handleQrCodeDetected(decodedText),
        (errorMessage) => { /* Erro normal de scanning */ }
    );
}
```

##### **`closeQrScanner()`**
- Para a câmera
- Limpa o scanner
- Fecha o modal
- Reseta o status

```javascript
async closeQrScanner() {
    if (this.html5QrcodeScanner) {
        await this.html5QrcodeScanner.stop();
        this.html5QrcodeScanner.clear();
        this.html5QrcodeScanner = null;
    }
    
    modal.classList.add('hidden');
}
```

##### **`handleQrCodeDetected(qrData)`**
- Fecha o scanner automaticamente
- Extrai o ID da OS do QR code
- Suporta 3 formatos:
  1. **URL completa:** `https://prostoral.app/os/{uuid}`
  2. **UUID direto:** `a1b2c3d4-e5f6-...`
  3. **Código WO:** `WO-OS-1761125928818`
- Abre os detalhes da OS automaticamente
- Mostra mensagem de sucesso

```javascript
async handleQrCodeDetected(qrData) {
    await this.closeQrScanner();
    
    let orderId = null;
    
    // Detectar formato e extrair ID
    if (qrData.includes('/os/')) {
        const match = qrData.match(/\/os\/([a-f0-9-]+)/i);
        if (match) orderId = match[1];
    }
    else if (qrData.match(/^[a-f0-9]{8}-[a-f0-9]{4}-...$/i)) {
        orderId = qrData;
    }
    else if (qrData.startsWith('WO-OS-')) {
        const orderNumber = qrData.replace('WO-OS-', '');
        const order = this.orders.find(o => o.order_number === `OS-${orderNumber}`);
        if (order) orderId = order.id;
    }
    
    if (orderId) {
        await this.showOrderDetails(orderId);
        this.showSuccess('✅ Ordem de serviço encontrada!');
    }
}
```

---

## 🎬 Fluxo de Uso

1. **Usuário clica** em "Ler OS"
2. **Modal abre** e solicita permissão de câmera
3. **Câmera ativa** - Status: "📷 Câmera ativa. Posicione o QR code..."
4. **Usuário posiciona** o QR code da OS na frente da câmera
5. **Sistema detecta** o código automaticamente
6. **Scanner fecha** automaticamente
7. **Detalhes da OS abrem** automaticamente
8. **Mensagem de sucesso:** "✅ Ordem de serviço encontrada!"

---

## 📱 Suporte a Formatos de QR Code

| Formato | Exemplo | Descrição |
|---------|---------|-----------|
| **URL Completa** | `https://prostoral.app/os/uuid` | Link direto para a OS |
| **UUID** | `0ee87bc6-2a9f-432e-85b6-...` | ID direto da OS |
| **Código WO** | `WO-OS-1761125928818` | Número da OS (busca na lista) |

---

## ✅ Permissões Necessárias

O navegador solicitará permissão para acessar a câmera na primeira vez. O usuário deve:

1. ✅ **Permitir** acesso à câmera
2. 📱 **Mobile:** Usar HTTPS (ou localhost)
3. 🖥️ **Desktop:** Funciona em HTTP local

---

## 🔧 Tratamento de Erros

| Erro | Mensagem | Solução |
|------|----------|---------|
| **Câmera bloqueada** | "Não foi possível acessar a câmera" | Verificar permissões do navegador |
| **QR inválido** | "QR Code não reconhecido" | Usar QR code válido de uma OS |
| **OS não encontrada** | "Erro ao abrir a ordem" | Verificar se a OS existe |

---

## 🎨 Design

- **Botão azul** com ícone de QR code
- **Modal responsivo** com câmera centralizada
- **Status visual** em tempo real
- **Tema dark/light** suportado
- **Mobile-friendly** com botões grandes

---

## 📝 Notas Técnicas

- **Biblioteca:** `html5-qrcode@2.3.8`
- **FPS:** 10 (equilíbrio entre performance e precisão)
- **Caixa de detecção:** 250x250px
- **Câmera padrão:** Traseira (`facingMode: "environment"`)
- **Auto-close:** Scanner fecha após detecção bem-sucedida

---

## 🎯 Benefícios

✅ **Identificação rápida** de OS físicas  
✅ **Menos erros** de digitação  
✅ **Melhor UX** para técnicos no laboratório  
✅ **Acesso imediato** aos detalhes da OS  
✅ **Compatível** com QR codes já impressos

