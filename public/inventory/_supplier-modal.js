// Modal de cadastro/edição de fornecedor, partilhado entre páginas.
//
// Uso:
//   openSupplierModal();                              // novo fornecedor
//   openSupplierModal({ supplier: s });               // edição
//   openSupplierModal({ onSaved: s => { ... } });     // callback com o registo salvo
//
// O DOM é injetado uma única vez no <body> e fica em z-[60] para poder
// abrir por cima de outros modais (ex.: formulário de Nova Entrada, z-50).
// Depende de apiCall() e toast() definidos em _layout.js.

(function () {
    if (window.openSupplierModal) return;  // idempotente entre páginas

    function ensureModal() {
        let modal = document.getElementById('supplierFormModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'supplierFormModal';
        modal.className = 'hidden fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[60] flex items-center justify-center';
        modal.innerHTML = `
            <div class="bg-white rounded-xl border border-gray-200 shadow-2xl max-w-lg w-full mx-4">
                <div class="flex justify-between items-center p-4 border-b">
                    <h3 id="supplierFormModalTitle" class="font-bold text-gray-800">—</h3>
                    <button type="button" onclick="closeSupplierModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="supplierFormModalForm" class="p-6 space-y-3">
                    <div><label class="text-xs text-gray-500">Nome *</label><input name="name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"></div>
                    <div><label class="text-xs text-gray-500">NIF / Tax ID</label><input name="tax_id" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"></div>
                    <div class="grid grid-cols-2 gap-3">
                        <div><label class="text-xs text-gray-500">Email</label><input name="email" type="email" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"></div>
                        <div><label class="text-xs text-gray-500">Telefone</label><input name="phone" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"></div>
                    </div>
                    <div><label class="text-xs text-gray-500">Morada</label><textarea name="address" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"></textarea></div>
                    <div><label class="text-xs text-gray-500">Notas</label><textarea name="notes" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"></textarea></div>
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active"> Ativo</label>
                    <button type="submit" class="w-full bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-lg text-sm font-medium shadow-sm shadow-sky-500/20 transition">Salvar</button>
                </form>
            </div>`;
        document.body.appendChild(modal);
        return modal;
    }

    function openSupplierModal(opts = {}) {
        const { supplier = null, onSaved = null } = opts;
        const modal = ensureModal();
        document.getElementById('supplierFormModalTitle').textContent = supplier ? 'Editar Fornecedor' : 'Novo Fornecedor';
        const form = document.getElementById('supplierFormModalForm');
        form.reset();
        // Valores via .elements em vez de interpolação no HTML — nomes com
        // aspas/HTML não quebram o markup do formulário.
        form.elements.name.value    = supplier?.name || '';
        form.elements.tax_id.value  = supplier?.tax_id || '';
        form.elements.email.value   = supplier?.email || '';
        form.elements.phone.value   = supplier?.phone || '';
        form.elements.address.value = supplier?.address || '';
        form.elements.notes.value   = supplier?.notes || '';
        form.elements.is_active.checked = !supplier || !!supplier.is_active;
        form.onsubmit = async e => {
            e.preventDefault();
            const fd = Object.fromEntries(new FormData(form));
            fd.is_active = form.elements.is_active.checked;
            try {
                const r = supplier
                    ? await apiCall(`/api/inventory/suppliers/${supplier.id}`, { method: 'PUT',  body: JSON.stringify(fd) })
                    : await apiCall('/api/inventory/suppliers',               { method: 'POST', body: JSON.stringify(fd) });
                closeSupplierModal();
                toast('Fornecedor salvo');
                if (onSaved) onSaved(r.data);
            } catch (err) { toast(err.message, 'error'); }
        };
        modal.classList.remove('hidden');
        form.elements.name.focus();
    }

    function closeSupplierModal() { document.getElementById('supplierFormModal')?.classList.add('hidden'); }

    window.openSupplierModal = openSupplierModal;
    window.closeSupplierModal = closeSupplierModal;
})();
