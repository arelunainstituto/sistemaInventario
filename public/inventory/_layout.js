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
            <div>
                <h2 class="text-xl font-bold text-gray-800">${title}</h2>
                <p class="text-sm text-gray-500">${subtitle}</p>
            </div>
            <div class="flex items-center gap-4">
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
}, 500);
