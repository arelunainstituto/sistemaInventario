// Picker de etiqueta QR, partilhado entre páginas.
//
// openLabelPicker(itemId): pergunta QUAL lote (consumo com lote) ou número de
// SÉRIE (patrimônio) imprimir e navega para item-label.html?qr=<token>.
// Consumo SEM lote não tem o que escolher → vai direto ao QR do item (fallback).
//
// Depende de apiCall() e toast() de _layout.js.

(function () {
    if (window.openLabelPicker) return;  // idempotente entre páginas

    function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
    const STATUS = { em_uso: 'Em uso', inativo: 'Inativo', baixado: 'Baixado' };

    function ensureModal() {
        let modal = document.getElementById('labelPickerModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'labelPickerModal';
        modal.className = 'hidden fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[60] flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-xl border border-gray-200 shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col">
                <div class="flex justify-between items-center p-4 border-b">
                    <h3 id="labelPickerTitle" class="font-bold text-gray-800">Imprimir etiqueta</h3>
                    <button type="button" onclick="closeLabelPicker()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <div id="labelPickerBody" class="p-4 space-y-2 overflow-y-auto"></div>
            </div>`;
        modal.addEventListener('click', e => { if (e.target === modal) closeLabelPicker(); });
        document.body.appendChild(modal);
        return modal;
    }

    function row(token, primary, secondary) {
        return `<button type="button" onclick="__labelPickerGo('${token}')"
            class="w-full flex items-center justify-between gap-3 px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-sky-50 hover:border-sky-300 transition text-left">
            <span><span class="font-medium text-gray-900 text-sm">${esc(primary)}</span>${secondary ? `<span class="block text-[11px] text-gray-400">${esc(secondary)}</span>` : ''}</span>
            <i class="fas fa-qrcode text-gray-400"></i>
        </button>`;
    }

    async function openLabelPicker(itemId) {
        let it;
        try { it = (await apiCall(`/api/inventory/items/${itemId}`)).data; }
        catch (e) { toast(e.message, 'error'); return; }

        // Consumo sem controle de lote → não há lote/série a escolher: QR do item.
        if (it.macro_category === 'consumo' && !it.controls_lot) { __labelPickerGo(it.qr_code); return; }

        const modal = ensureModal();
        const title = document.getElementById('labelPickerTitle');
        const body  = document.getElementById('labelPickerBody');

        if (it.macro_category === 'patrimonial') {
            title.textContent = 'Etiqueta — escolha a unidade (nº de série)';
            const units = it.serial_units || [];
            body.innerHTML = units.length
                ? units.map(u => row(u.qr_code, u.serial_number, STATUS[u.status] || u.status)).join('')
                : '<p class="text-sm text-gray-400 text-center py-4">Nenhuma unidade cadastrada. Faça uma entrada em Patrimônio › Entrada.</p>';
        } else {
            title.textContent = 'Etiqueta — escolha o lote';
            const lots = it.lots || [];
            body.innerHTML = lots.length
                ? lots.map(l => row(l.qr_code, l.lot_number, [l.expiry_date ? 'val. ' + l.expiry_date : '', l.is_active === false ? 'inativo' : ''].filter(Boolean).join(' · '))).join('')
                : `<p class="text-sm text-gray-400 text-center py-2">Nenhum lote registrado ainda.</p>
                   <button type="button" onclick="__labelPickerGo('${it.qr_code}')" class="w-full px-3 py-2.5 border border-gray-200 rounded-lg hover:bg-sky-50 hover:border-sky-300 transition text-sm text-sky-700 font-medium"><i class="fas fa-qrcode mr-1.5"></i> Imprimir etiqueta do item</button>`;
        }
        modal.classList.remove('hidden');
    }

    function __labelPickerGo(token) { location.href = `item-label.html?qr=${encodeURIComponent(token)}`; }
    function closeLabelPicker() { document.getElementById('labelPickerModal')?.classList.add('hidden'); }

    window.openLabelPicker  = openLabelPicker;
    window.closeLabelPicker = closeLabelPicker;
    window.__labelPickerGo  = __labelPickerGo;
})();
