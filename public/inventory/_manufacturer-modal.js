// Modal de cadastro/edição de fabricante, partilhado entre páginas.
//
// Uso:
//   openManufacturerModal();                            // novo fabricante
//   openManufacturerModal({ manufacturer: m });         // edição
//   openManufacturerModal({ onSaved: m => { ... } });   // callback com o registo salvo
//
// O DOM é injetado uma única vez no <body> e fica em z-[60] para poder abrir
// por cima de outros modais (ex.: formulário de cadastro de item, z-50).
// Depende de apiCall() e toast() definidos em _layout.js.

(function () {
    if (window.openManufacturerModal) return;  // idempotente entre páginas

    function ensureModal() {
        let modal = document.getElementById('manufacturerFormModal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'manufacturerFormModal';
        modal.className = 'hidden fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-[60] flex items-center justify-center';
        modal.innerHTML = `
            <div class="bg-white rounded-xl border border-gray-200 shadow-2xl max-w-lg w-full mx-4">
                <div class="flex justify-between items-center p-4 border-b">
                    <h3 id="manufacturerFormModalTitle" class="font-bold text-gray-800">—</h3>
                    <button type="button" onclick="closeManufacturerModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
                </div>
                <form id="manufacturerFormModalForm" class="p-6 space-y-3">
                    <div><label class="text-xs text-gray-500">Nome *</label><input name="name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"></div>
                    <div><label class="text-xs text-gray-500">Website</label><input name="website" placeholder="https://…" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"></div>
                    <div><label class="text-xs text-gray-500">Notas</label><textarea name="notes" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"></textarea></div>
                    <label class="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active"> Ativo</label>
                    <button type="submit" class="w-full bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-lg text-sm font-medium shadow-sm shadow-sky-500/20 transition">Salvar</button>
                </form>
            </div>`;
        document.body.appendChild(modal);
        return modal;
    }

    function openManufacturerModal(opts = {}) {
        const { manufacturer = null, onSaved = null } = opts;
        const modal = ensureModal();
        document.getElementById('manufacturerFormModalTitle').textContent = manufacturer ? 'Editar Fabricante' : 'Novo Fabricante';
        const form = document.getElementById('manufacturerFormModalForm');
        form.reset();
        form.elements.name.value    = manufacturer?.name || '';
        form.elements.website.value = manufacturer?.website || '';
        form.elements.notes.value   = manufacturer?.notes || '';
        form.elements.is_active.checked = !manufacturer || !!manufacturer.is_active;
        form.onsubmit = async e => {
            e.preventDefault();
            const fd = Object.fromEntries(new FormData(form));
            fd.is_active = form.elements.is_active.checked;
            try {
                const r = manufacturer
                    ? await apiCall(`/api/inventory/manufacturers/${manufacturer.id}`, { method: 'PUT',  body: JSON.stringify(fd) })
                    : await apiCall('/api/inventory/manufacturers',                    { method: 'POST', body: JSON.stringify(fd) });
                closeManufacturerModal();
                toast('Fabricante salvo');
                if (onSaved) onSaved(r.data);
            } catch (err) { toast(err.message, 'error'); }
        };
        modal.classList.remove('hidden');
        form.elements.name.focus();
    }

    function closeManufacturerModal() { document.getElementById('manufacturerFormModal')?.classList.add('hidden'); }

    window.openManufacturerModal = openManufacturerModal;
    window.closeManufacturerModal = closeManufacturerModal;
})();
