// Shared layout for inventory module: sidebar + header.
// Each page calls renderInventoryLayout({ activePage, title, subtitle }).

const INVENTORY_NAV = [
    { id: 'dashboard',   label: 'Dashboard',         icon: 'fa-chart-pie',  href: 'index.html' },
    { id: 'items',       label: 'Itens',             icon: 'fa-boxes-stacked', href: 'items.html' },
    { id: 'entries',     label: 'Entradas',          icon: 'fa-arrow-right-to-bracket', href: 'entries.html' },
    { id: 'exits',       label: 'Saídas',            icon: 'fa-arrow-right-from-bracket', href: 'exits.html' },
    { id: 'transfers',   label: 'Transferências',    icon: 'fa-right-left',  href: 'transfers.html' },
    { id: 'adjustments', label: 'Ajustes',           icon: 'fa-sliders',     href: 'adjustments.html' },
    { id: 'inventory-session', label: 'Inventário Físico', icon: 'fa-list-check', href: 'inventory-session.html' },
    { id: 'depreciation', label: 'Depreciação',       icon: 'fa-arrow-trend-down', href: 'depreciation.html' },
    { id: 'reports',     label: 'Relatórios',        icon: 'fa-chart-line',  href: 'reports.html' },
    { id: 'kardex',      label: 'Kardex',            icon: 'fa-clipboard-list', href: 'kardex.html' },
    { id: 'movements',   label: 'Histórico',         icon: 'fa-history',     href: 'movements.html' },
    { id: 'scan',        label: 'Ler QR Code',       icon: 'fa-qrcode',      href: 'scan.html' },
];

const INVENTORY_NAV_SETUP = [
    { id: 'locations',   label: 'Localizações',      icon: 'fa-map-marker-alt', href: 'locations.html' },
    { id: 'categories',  label: 'Categorias',        icon: 'fa-tags',           href: 'categories.html' },
    { id: 'suppliers',   label: 'Fornecedores',      icon: 'fa-truck',          href: 'suppliers.html' },
    { id: 'uoms',        label: 'Unidades de medida', icon: 'fa-ruler',         href: 'uoms.html' },
];

function navItemHtml(item, active) {
    const isActive = item.id === active;
    const base = 'w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors';
    const state = isActive
        ? 'text-blue-600 bg-blue-50'
        : item.disabled
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-50';
    const onclick = item.disabled ? '' : `onclick="window.location.href='${item.href}'"`;
    const badge = item.badge ? `<span class="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">${item.badge}</span>` : '';
    return `<button ${onclick} class="${base} ${state}">
        <i class="fas ${item.icon} w-5"></i>
        <span class="flex-1 text-left">${item.label}</span>
        ${badge}
    </button>`;
}

function renderInventoryLayout({ activePage = 'dashboard', title = 'Inventário', subtitle = '' } = {}) {
    const sidebar = `
        <aside class="w-64 bg-white border-r border-gray-200 flex flex-col z-10">
            <div class="p-6 border-b border-gray-100 flex items-center gap-3">
                <div class="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <i class="fas fa-warehouse text-xl"></i>
                </div>
                <div>
                    <h1 class="text-lg font-bold text-gray-800">Inventário</h1>
                    <p class="text-xs text-gray-500">Gestão de Estoques</p>
                </div>
            </div>

            <nav class="flex-1 overflow-y-auto p-4 space-y-1">
                <p class="text-[10px] uppercase font-bold text-gray-400 px-3 mt-2 mb-1">Operações</p>
                ${INVENTORY_NAV.map(i => navItemHtml(i, activePage)).join('')}

                <p class="text-[10px] uppercase font-bold text-gray-400 px-3 mt-4 mb-1">Cadastros</p>
                ${INVENTORY_NAV_SETUP.map(i => navItemHtml(i, activePage)).join('')}
            </nav>

            <div class="p-4 border-t border-gray-100">
                <button onclick="window.location.href='/module-selection.html'"
                    class="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                    <i class="fas fa-arrow-left w-5"></i>
                    Voltar ao Menu
                </button>
            </div>
        </aside>`;

    const header = `
        <header class="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
            <div class="flex-shrink-0">
                <h2 class="text-xl font-bold text-gray-800">${title}</h2>
                <p class="text-sm text-gray-500">${subtitle}</p>
            </div>

            <!-- Busca global (§16) -->
            <div class="relative flex-1 max-w-md mx-8">
                <div class="relative">
                    <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                    <input id="globalSearch" type="text"
                           placeholder="Buscar item, lote, fornecedor…"
                           autocomplete="off"
                           class="w-full pl-8 pr-3 py-2 border border-gray-200 bg-gray-50 rounded-lg text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                </div>
                <div id="searchDropdown" class="hidden absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-[480px] overflow-y-auto z-30">
                    <div id="searchResults" class="p-2 text-sm"></div>
                </div>
            </div>

            <div class="flex items-center gap-4 flex-shrink-0">
                <!-- Badge global de alertas (§16) -->
                <div class="relative">
                    <button id="alertsBell" onclick="toggleAlertsPanel()"
                            class="relative w-10 h-10 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600">
                        <i class="fas fa-bell"></i>
                        <span id="alertsBadge" class="hidden absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
                              rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">0</span>
                    </button>
                    <div id="alertsPanel" class="hidden absolute right-0 mt-2 w-80 bg-white border border-gray-200
                         rounded-lg shadow-lg z-20 max-h-[480px] overflow-y-auto">
                        <div class="p-3 border-b border-gray-100 flex justify-between items-center">
                            <p class="font-bold text-gray-800 text-sm">Alertas</p>
                            <button onclick="toggleAlertsPanel()" class="text-gray-400 hover:text-gray-600 text-xs"><i class="fas fa-times"></i></button>
                        </div>
                        <div id="alertsContent" class="p-3 text-sm text-gray-500">Carregando…</div>
                    </div>
                </div>

                <div id="userAvatarBox" class="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div class="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold" id="userAvatar">U</div>
                    <span class="text-sm text-gray-700" id="userName">Utilizador</span>
                </div>
                <button onclick="logout()" class="text-sm text-gray-500 hover:text-gray-700">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        </header>`;

    const layoutRoot = document.getElementById('layoutRoot');
    if (!layoutRoot) {
        console.error('renderInventoryLayout: <div id="layoutRoot"> não encontrado');
        return;
    }
    layoutRoot.innerHTML = `<div class="flex h-screen overflow-hidden">${sidebar}
        <main class="flex-1 overflow-y-auto bg-gray-50">${header}
            <div id="pageContent" class="p-8"></div>
        </main></div>`;

    // Popula user avatar a partir do localStorage
    try {
        const profile = JSON.parse(localStorage.getItem('user_profile') || '{}');
        const display = profile.display_name || profile.first_name || profile.email || 'Utilizador';
        const avatar = (display.match(/\b\w/g) || ['U']).slice(0, 2).join('').toUpperCase();
        document.getElementById('userAvatar').textContent = avatar;
        document.getElementById('userName').textContent = display;
    } catch {}
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_profile');
    window.location.href = '/login.html';
}

// Helper API call wrapper
async function apiCall(path, options = {}) {
    const token = localStorage.getItem('access_token');
    const headers = options.headers || {};
    headers['Authorization'] = `Bearer ${token}`;
    if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(path, { ...options, headers });
    const ct = res.headers.get('content-type') || '';
    const data = ct.includes('application/json') ? await res.json() : await res.text();
    if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
    return data;
}

// Toast helper
function toast(message, type = 'success') {
    const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-blue-500', warn: 'bg-yellow-500' };
    const el = document.createElement('div');
    el.className = `fixed top-6 right-6 z-50 px-5 py-3 rounded-lg text-white text-sm shadow-lg ${colors[type] || colors.info}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => { el.classList.add('opacity-0'); setTimeout(() => el.remove(), 300); }, 3000);
}

// =====================================================
// Badge global de alertas (§16)
// =====================================================
// Atualiza a cada 60 segundos. Lê do endpoint /stats/summary
// que já agrupa itens abaixo do mínimo e lotes vencendo em 30 dias.

let alertsCache = null;

function toggleAlertsPanel() {
    const panel = document.getElementById('alertsPanel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) {
        panel.classList.remove('hidden');
        renderAlertsContent();
    } else {
        panel.classList.add('hidden');
    }
}

async function loadAlerts() {
    try {
        const r = await apiCall('/api/inventory/stats/summary');
        alertsCache = r.data;
        const total = (r.data.below_min || 0) + (r.data.expiring_count || 0);
        const badge = document.getElementById('alertsBadge');
        if (!badge) return;
        if (total > 0) {
            badge.textContent = total > 99 ? '99+' : String(total);
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    } catch (err) {
        // Silencioso: badge fica em estado anterior
    }
}

function renderAlertsContent() {
    const el = document.getElementById('alertsContent');
    if (!el || !alertsCache) return;

    const critical = alertsCache.critical_items || [];
    const expiring = alertsCache.expiring_lots  || [];

    let html = '';

    if (critical.length === 0 && expiring.length === 0) {
        html = '<p class="text-green-600 py-4 text-center"><i class="fas fa-check-circle"></i> Tudo em ordem.</p>';
    } else {
        if (critical.length > 0) {
            html += `<div class="mb-3">
                <p class="text-[10px] uppercase font-bold text-red-600 mb-1">Stock abaixo do mínimo</p>
                ${critical.slice(0, 5).map(i => `
                    <div class="flex justify-between py-1 border-b border-gray-50 last:border-0 text-xs">
                        <span class="text-gray-800 truncate">${escapeAlerts(i.internal_code)} · ${escapeAlerts(i.name)}</span>
                        <span class="${i.stock === 0 ? 'text-red-600 font-bold' : 'text-yellow-600'} ml-2 flex-shrink-0">${parseFloat(i.stock).toFixed(0)} / ${parseFloat(i.min_stock).toFixed(0)}</span>
                    </div>`).join('')}
                ${critical.length > 5 ? `<a href="/inventory/reports.html" class="text-xs text-blue-600 hover:underline mt-1 inline-block">+ ${critical.length - 5} → ver relatório completo</a>` : ''}
            </div>`;
        }
        if (expiring.length > 0) {
            html += `<div>
                <p class="text-[10px] uppercase font-bold text-orange-600 mb-1">Lotes vencendo (30 dias)</p>
                ${expiring.slice(0, 5).map(l => `
                    <div class="flex justify-between py-1 border-b border-gray-50 last:border-0 text-xs">
                        <span class="text-gray-800 truncate">${escapeAlerts(l.item?.name || '')} · <span class="font-mono">${escapeAlerts(l.lot_number)}</span></span>
                        <span class="text-orange-600 ml-2 flex-shrink-0">${l.expiry_date}</span>
                    </div>`).join('')}
                ${expiring.length > 5 ? `<a href="/inventory/index.html" class="text-xs text-blue-600 hover:underline mt-1 inline-block">+ ${expiring.length - 5} → ver dashboard</a>` : ''}
            </div>`;
        }
    }
    el.innerHTML = html;
}

function escapeAlerts(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// Fecha o painel ao clicar fora dele
document.addEventListener('click', (e) => {
    const panel = document.getElementById('alertsPanel');
    const bell  = document.getElementById('alertsBell');
    if (!panel || !bell) return;
    if (panel.classList.contains('hidden')) return;
    if (panel.contains(e.target) || bell.contains(e.target)) return;
    panel.classList.add('hidden');
});

// Inicia carregamento + refresh a cada 60s (defer para garantir que apiCall existe)
setTimeout(() => {
    loadAlerts();
    setInterval(loadAlerts, 60000);
    setupGlobalSearch();
    injectActionPanel();
}, 500);

// =====================================================
// Busca global (§16) — debounced cross-entity
// =====================================================

function setupGlobalSearch() {
    const input = document.getElementById('globalSearch');
    if (!input) return;

    let timer = null;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        if (q.length < 2) {
            document.getElementById('searchDropdown').classList.add('hidden');
            return;
        }
        timer = setTimeout(() => runGlobalSearch(q), 250);
    });
    input.addEventListener('focus', () => {
        if (input.value.trim().length >= 2) runGlobalSearch(input.value.trim());
    });

    // Atalho Ctrl/Cmd+K
    document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            input.focus();
            input.select();
        }
        if (e.key === 'Escape') {
            document.getElementById('searchDropdown').classList.add('hidden');
        }
    });

    // Fecha ao clicar fora
    document.addEventListener('click', e => {
        const dd = document.getElementById('searchDropdown');
        if (!dd) return;
        if (dd.contains(e.target) || input.contains(e.target)) return;
        dd.classList.add('hidden');
    });
}

async function runGlobalSearch(q) {
    const resultsEl = document.getElementById('searchResults');
    const dd = document.getElementById('searchDropdown');
    dd.classList.remove('hidden');
    resultsEl.innerHTML = '<p class="text-xs text-gray-400 p-2">Buscando…</p>';

    try {
        const r = await apiCall(`/api/inventory/search?q=${encodeURIComponent(q)}`);
        const { items, lots, suppliers } = r.data;
        const total = items.length + lots.length + suppliers.length;

        if (total === 0) {
            resultsEl.innerHTML = '<p class="text-xs text-gray-400 p-3 text-center">Nenhum resultado.</p>';
            return;
        }

        let html = '';
        if (items.length) {
            html += '<p class="text-[10px] uppercase font-bold text-gray-400 px-2 mt-1 mb-1">Itens</p>';
            html += items.map(i => `
                <button onclick='openActionPanel(${JSON.stringify({kind:"item", ...i}).replace(/'/g,"&#39;")})'
                        class="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 rounded text-xs">
                    <i class="fas fa-box ${i.macro_category === "patrimonial" ? "text-purple-500" : "text-blue-500"}"></i>
                    <span class="font-mono text-gray-500">${escapeAlerts(i.internal_code)}</span>
                    <span class="text-gray-800 truncate">${escapeAlerts(i.name)}</span>
                    ${!i.is_active ? '<span class="text-[10px] text-gray-400">(inativo)</span>' : ''}
                </button>`).join('');
        }
        if (lots.length) {
            html += '<p class="text-[10px] uppercase font-bold text-gray-400 px-2 mt-2 mb-1">Lotes</p>';
            html += lots.map(l => `
                <button onclick='openActionPanel(${JSON.stringify({kind:"lot", id:l.id, lot_number:l.lot_number, expiry_date:l.expiry_date, item:l.item}).replace(/'/g,"&#39;")})'
                        class="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-yellow-50 rounded text-xs">
                    <i class="fas fa-flask text-yellow-600"></i>
                    <span class="font-mono">${escapeAlerts(l.lot_number)}</span>
                    <span class="text-gray-600 truncate">${escapeAlerts(l.item?.name || '')}</span>
                    ${l.expiry_date ? `<span class="text-[10px] text-gray-400 ml-auto">val ${l.expiry_date}</span>` : ''}
                </button>`).join('');
        }
        if (suppliers.length) {
            html += '<p class="text-[10px] uppercase font-bold text-gray-400 px-2 mt-2 mb-1">Fornecedores</p>';
            html += suppliers.map(s => `
                <button onclick='openActionPanel(${JSON.stringify({kind:"supplier", ...s}).replace(/'/g,"&#39;")})'
                        class="w-full text-left flex items-center gap-2 px-2 py-1.5 hover:bg-green-50 rounded text-xs">
                    <i class="fas fa-truck text-green-600"></i>
                    <span class="text-gray-800 truncate">${escapeAlerts(s.name)}</span>
                    ${s.tax_id ? `<span class="text-[10px] text-gray-400">${escapeAlerts(s.tax_id)}</span>` : ''}
                </button>`).join('');
        }
        resultsEl.innerHTML = html;
    } catch (err) {
        resultsEl.innerHTML = `<p class="text-xs text-red-500 p-2">${escapeAlerts(err.message)}</p>`;
    }
}

// =====================================================
// Painel lateral de ações (resultado da busca clicado)
// =====================================================

function injectActionPanel() {
    if (document.getElementById('actionPanel')) return;
    const panel = document.createElement('div');
    panel.id = 'actionPanel';
    panel.className = 'hidden fixed inset-0 z-40';
    panel.innerHTML = `
        <div class="absolute inset-0 bg-black/30" onclick="closeActionPanel()"></div>
        <div class="absolute right-0 top-0 bottom-0 w-96 bg-white shadow-xl overflow-y-auto">
            <div class="p-4 border-b flex justify-between items-center">
                <h3 id="actionPanelTitle" class="font-bold text-gray-800">—</h3>
                <button onclick="closeActionPanel()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
            </div>
            <div id="actionPanelBody" class="p-4 space-y-3"></div>
        </div>`;
    document.body.appendChild(panel);
}

function openActionPanel(entity) {
    document.getElementById('searchDropdown').classList.add('hidden');
    document.getElementById('globalSearch').value = '';

    const panel = document.getElementById('actionPanel');
    const title = document.getElementById('actionPanelTitle');
    const body  = document.getElementById('actionPanelBody');
    panel.classList.remove('hidden');

    if (entity.kind === 'item') {
        title.innerHTML = `<span class="text-xs text-gray-400 font-mono">${escapeAlerts(entity.internal_code)}</span> · ${escapeAlerts(entity.name)}`;
        body.innerHTML = `
            <p class="text-xs text-gray-500">Categoria: <span class="font-medium">${escapeAlerts(entity.macro_category)}</span></p>
            ${entity.image_url ? `<img src="${entity.image_url}" class="w-full h-32 object-cover rounded">` : ''}
            <div class="grid grid-cols-2 gap-2 pt-2">
                <a href="/inventory/item-form.html?id=${entity.id}" class="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs text-center"><i class="fas fa-edit"></i> Editar</a>
                <a href="/inventory/kardex.html?item=${entity.id}" class="px-3 py-2 bg-teal-100 hover:bg-teal-200 text-teal-800 rounded text-xs text-center"><i class="fas fa-clipboard-list"></i> Kardex</a>
                <a href="/inventory/item-label.html?id=${entity.id}" class="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-xs text-center"><i class="fas fa-qrcode"></i> Etiqueta</a>
                <a href="/inventory/movements.html?item_id=${entity.id}" class="px-3 py-2 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded text-xs text-center"><i class="fas fa-list"></i> Histórico</a>
                <a href="/inventory/entries.html" class="px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-xs text-center"><i class="fas fa-arrow-right-to-bracket"></i> Nova entrada</a>
                <a href="/inventory/exits.html" class="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded text-xs text-center"><i class="fas fa-arrow-right-from-bracket"></i> Nova saída</a>
            </div>`;
    } else if (entity.kind === 'lot') {
        title.innerHTML = `Lote <span class="font-mono">${escapeAlerts(entity.lot_number)}</span>`;
        body.innerHTML = `
            <p class="text-xs text-gray-500">Item: <span class="font-medium">${escapeAlerts(entity.item?.internal_code || '')} · ${escapeAlerts(entity.item?.name || '')}</span></p>
            ${entity.expiry_date ? `<p class="text-xs text-gray-500">Validade: <span class="font-medium">${entity.expiry_date}</span></p>` : ''}
            <div class="pt-2 space-y-2">
                <a href="/inventory/kardex.html?item=${entity.item?.id}" class="block px-3 py-2 bg-teal-100 hover:bg-teal-200 text-teal-800 rounded text-xs text-center"><i class="fas fa-clipboard-list"></i> Kardex do item</a>
                <a href="/inventory/item-form.html?id=${entity.item?.id}" class="block px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs text-center"><i class="fas fa-edit"></i> Editar item</a>
            </div>`;
    } else if (entity.kind === 'supplier') {
        title.innerHTML = escapeAlerts(entity.name);
        body.innerHTML = `
            ${entity.tax_id ? `<p class="text-xs text-gray-500">NIF: <span class="font-medium">${escapeAlerts(entity.tax_id)}</span></p>` : ''}
            ${entity.email  ? `<p class="text-xs text-gray-500">Email: ${escapeAlerts(entity.email)}</p>` : ''}
            <div class="pt-2 space-y-2">
                <a href="/inventory/suppliers.html" class="block px-3 py-2 bg-green-100 hover:bg-green-200 text-green-800 rounded text-xs text-center"><i class="fas fa-list"></i> Ver lista de fornecedores</a>
                <a href="/inventory/entries.html" class="block px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded text-xs text-center"><i class="fas fa-arrow-right-to-bracket"></i> Nova entrada</a>
            </div>`;
    }
}

function closeActionPanel() {
    const p = document.getElementById('actionPanel');
    if (p) p.classList.add('hidden');
}
