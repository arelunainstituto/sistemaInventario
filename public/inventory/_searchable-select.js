// Combobox reutilizável que transforma um <select> nativo em campo
// de busca + dropdown com filtragem em tempo real.
//
// Uso típico:
//   makeSearchable('itemSelect', { placeholder: 'Buscar item por nome ou SKU…' });
//
// Como funciona:
//   • Mantém o <select> original (apenas oculto) para que os forms
//     existentes continuem a ler/escrever via .value.
//   • Disparo de change event no select continua a funcionar normalmente.
//   • Reage a mudanças dinâmicas das <option> via MutationObserver,
//     útil quando o select é repopulado em onChange de outro campo.
//
// Filtragem:
//   • Busca por substring case-insensitive em .textContent da option.
//   • Para enriquecer a busca (ex.: incluir categoria do item), passe
//     uma função getSearchText(option) que retorna o texto a indexar.
//
// Navegação:
//   • ↓ ↑  navegam entre resultados
//   • Enter seleciona o item realçado
//   • Esc fecha o dropdown

(function () {
    if (window.makeSearchable) return;  // idempotente quando o script é carregado em várias páginas

    function escapeHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    function makeSearchable(selectIdOrEl, opts = {}) {
        const select = typeof selectIdOrEl === 'string'
            ? document.getElementById(selectIdOrEl)
            : selectIdOrEl;
        if (!select || select.dataset.searchable === '1') return null;
        select.dataset.searchable = '1';

        const placeholder    = opts.placeholder    || 'Buscar…';
        const getSearchText  = opts.getSearchText  || (opt => opt.textContent);
        const maxResults     = opts.maxResults     || 50;

        // Wrapper relativo para posicionar o dropdown
        const wrapper = document.createElement('div');
        wrapper.className = 'relative';
        select.parentNode.insertBefore(wrapper, select);
        wrapper.appendChild(select);
        select.style.display = 'none';

        // Input de busca
        const input = document.createElement('input');
        input.type = 'text';
        input.autocomplete = 'off';
        input.placeholder = placeholder;
        input.className = select.className.replace('hidden','') || 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:outline-none transition';
        wrapper.appendChild(input);

        // Mini-ícone de "limpar" quando há valor selecionado
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.innerHTML = '<i class="fas fa-times text-gray-400 text-xs"></i>';
        clearBtn.className = 'hidden absolute right-2 top-1/2 -translate-y-1/2 px-1 hover:text-gray-600';
        clearBtn.addEventListener('mousedown', e => {
            e.preventDefault();
            setValue('');
            input.focus();
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        wrapper.appendChild(clearBtn);

        // Dropdown
        const dropdown = document.createElement('div');
        dropdown.className = 'absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto hidden';
        wrapper.appendChild(dropdown);

        let highlighted = -1;

        function syncDisplay() {
            const opt = [...select.options].find(o => o.value === select.value && o.value !== '');
            input.value = opt ? opt.textContent.trim() : '';
            clearBtn.classList.toggle('hidden', !opt);
        }

        function setValue(val) {
            if (select.value === val) return;
            select.value = val;
            syncDisplay();
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function buildResults(filter = '') {
            const lower = filter.toLowerCase().trim();
            const matches = [...select.options]
                .filter(o => o.value !== '')
                .map(o => ({ opt: o, text: getSearchText(o).toLowerCase() }))
                .filter(({ text }) => !lower || text.includes(lower))
                .slice(0, maxResults);

            if (!matches.length) {
                dropdown.innerHTML = '<div class="p-3 text-xs text-gray-400">Nenhum resultado para "' + escapeHtml(filter) + '"</div>';
                highlighted = -1;
                return;
            }
            dropdown.innerHTML = matches.map(({ opt }, i) => `
                <div class="px-3 py-2 hover:bg-sky-50 cursor-pointer text-sm ${i === highlighted ? 'bg-sky-50' : ''}"
                     data-value="${escapeHtml(opt.value)}" data-idx="${i}">${escapeHtml(opt.textContent.trim())}</div>
            `).join('');
            [...dropdown.querySelectorAll('[data-value]')].forEach(el => {
                el.addEventListener('mousedown', e => {
                    e.preventDefault();
                    setValue(el.dataset.value);
                    dropdown.classList.add('hidden');
                    input.blur();
                });
            });
        }

        function openDropdown() {
            buildResults(input.value);
            dropdown.classList.remove('hidden');
        }

        function closeDropdown() {
            dropdown.classList.add('hidden');
            highlighted = -1;
        }

        input.addEventListener('focus', () => { syncDisplay(); openDropdown(); });
        input.addEventListener('input', () => {
            // Quando o utilizador digita, limpa a seleção (até escolher novamente)
            if (select.value) {
                select.value = '';
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
            clearBtn.classList.add('hidden');
            highlighted = -1;
            openDropdown();
        });
        input.addEventListener('blur', () => setTimeout(closeDropdown, 150));
        input.addEventListener('keydown', e => {
            const items = dropdown.querySelectorAll('[data-value]');
            if (!items.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                highlighted = Math.min(highlighted + 1, items.length - 1);
                items.forEach((el, i) => el.classList.toggle('bg-sky-50', i === highlighted));
                items[highlighted].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                highlighted = Math.max(highlighted - 1, 0);
                items.forEach((el, i) => el.classList.toggle('bg-sky-50', i === highlighted));
                items[highlighted].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && highlighted >= 0) {
                e.preventDefault();
                setValue(items[highlighted].dataset.value);
                closeDropdown();
                input.blur();
            } else if (e.key === 'Escape') {
                closeDropdown();
                input.blur();
            }
        });

        // Sincroniza quando o select é repopulado de fora (ex.: encadeamento de filtros)
        const observer = new MutationObserver(syncDisplay);
        observer.observe(select, { childList: true });

        // Sync inicial
        syncDisplay();

        return { refresh: syncDisplay };
    }

    window.makeSearchable = makeSearchable;
})();
