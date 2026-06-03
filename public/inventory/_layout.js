// Shared layout for inventory module: sidebar + header.
// Each page calls renderInventoryLayout({ activePage, title, subtitle }).

const INVENTORY_NAV = [
    { id: 'dashboard',   label: 'Dashboard',         icon: 'fa-chart-pie',  href: 'index.html' },
    { id: 'items',       label: 'Itens',             icon: 'fa-boxes-stacked', href: 'items.html' },
    { id: 'entries',     label: 'Entradas',          icon: 'fa-arrow-right-to-bracket', href: 'entries.html' },
    { id: 'exits',       label: 'Saídas',            icon: 'fa-arrow-right-from-bracket', href: 'exits.html' },
    { id: 'transfers',   label: 'Transferências',    icon: 'fa-right-left',  href: 'transfers.html' },
    { id: 'adjustments', label: 'Ajustes',           icon: 'fa-sliders',     href: 'adjustments.html', adminOnly: true },
    { id: 'inventory-session', label: 'Inventário Físico', icon: 'fa-list-check', href: 'inventory-session.html' },
    { id: 'depreciation', label: 'Depreciação',       icon: 'fa-arrow-trend-down', href: 'depreciation.html' },
    { id: 'reports',     label: 'Relatórios',        icon: 'fa-chart-line',  href: 'reports.html' },
    { id: 'kardex',      label: 'Kardex',            icon: 'fa-clipboard-list', href: 'kardex.html' },
    { id: 'movements',   label: 'Histórico',         icon: 'fa-history',     href: 'movements.html' },
    { id: 'access-log',  label: 'Log de Acesso',     icon: 'fa-shield-halved', href: 'access-log.html' },
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
    const base = 'sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors relative';
    const state = isActive
        ? 'text-sky-700 bg-sky-50'
        : item.disabled
            ? 'text-gray-400 cursor-not-allowed'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900';
    const activeBar = isActive
        ? '<span class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r bg-sky-500"></span>'
        : '';
    const onclick = item.disabled ? '' : `onclick="window.location.href='${item.href}'"`;
    const badge = item.badge ? `<span class="sidebar-label ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-600">${item.badge}</span>` : '';
    // adminOnly: item começa oculto e é revelado em populateUserHeader se a role conferir
    const adminAttr = item.adminOnly ? ` data-admin-only="1" style="display:none"` : '';
    return `<button ${onclick} class="${base} ${state}" title="${item.label}"${adminAttr}>
        ${activeBar}
        <i class="fas ${item.icon} w-5 text-center ${isActive ? 'text-sky-600' : ''}"></i>
        <span class="sidebar-label flex-1 text-left whitespace-nowrap overflow-hidden">${item.label}</span>
        ${badge}
    </button>`;
}

function renderInventoryLayout({ activePage = 'dashboard', title = 'Inventário', subtitle = '' } = {}) {
    const sidebar = `
        <aside id="inventorySidebar" class="bg-white border-r border-gray-200 flex flex-col z-10 transition-[width] duration-200" style="width: 256px;">
            <div class="p-5 border-b border-gray-100 flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center text-white shadow-sm shadow-sky-500/30 flex-shrink-0">
                    <i class="fas fa-warehouse text-base"></i>
                </div>
                <div class="sidebar-label overflow-hidden">
                    <h1 class="text-base font-bold text-gray-900 leading-tight whitespace-nowrap">Inventário</h1>
                    <p class="text-[11px] text-gray-500 leading-tight whitespace-nowrap">Areluna · Gestão de Estoques</p>
                </div>
            </div>

            <nav class="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-0.5">
                <p class="sidebar-label text-[10px] uppercase font-bold text-gray-400 tracking-wider px-3 mt-2 mb-2">Operações</p>
                ${INVENTORY_NAV.map(i => navItemHtml(i, activePage)).join('')}

                <p class="sidebar-label text-[10px] uppercase font-bold text-gray-400 tracking-wider px-3 mt-5 mb-2">Cadastros</p>
                ${INVENTORY_NAV_SETUP.map(i => navItemHtml(i, activePage)).join('')}
            </nav>

            <div class="p-3 border-t border-gray-100 space-y-1">
                <button onclick="toggleSidebar()" id="sidebarToggleBtn" title="Recolher menu"
                    class="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 rounded-lg transition-colors">
                    <i id="sidebarToggleIcon" class="fas fa-chevron-left w-5 text-center"></i>
                    <span class="sidebar-label flex-1 text-left whitespace-nowrap text-[11px] uppercase tracking-wider">Recolher</span>
                </button>
                <button onclick="window.location.href='/dashboard.html'" title="Voltar ao Menu"
                    class="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 hover:text-gray-700 rounded-lg transition-colors">
                    <i class="fas fa-arrow-left w-5 text-center"></i>
                    <span class="sidebar-label flex-1 text-left whitespace-nowrap">Voltar ao Menu</span>
                </button>
            </div>
        </aside>`;

    const header = `
        <header class="bg-white/80 backdrop-blur border-b border-gray-200/80 px-8 py-3.5 flex justify-between items-center sticky top-0 z-10">
            <div class="flex-shrink-0">
                <h2 class="text-[19px] font-bold text-gray-900 leading-tight">${title}</h2>
                <p class="text-[13px] text-gray-500 leading-tight mt-0.5">${subtitle}</p>
            </div>

            <!-- Busca global -->
            <div class="relative flex-1 max-w-md mx-8">
                <div class="relative">
                    <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
                    <input id="globalSearch" type="text"
                           placeholder="Buscar item, lote, fornecedor…"
                           autocomplete="off"
                           class="w-full pl-9 pr-3 py-2 border border-gray-200 bg-gray-50/80 rounded-lg text-sm placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:outline-none transition">
                    <kbd class="hidden md:inline-flex absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-mono bg-white border border-gray-200 rounded px-1.5 py-0.5">⌘K</kbd>
                </div>
                <div id="searchDropdown" class="hidden absolute left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg max-h-[480px] overflow-y-auto z-30">
                    <div id="searchResults" class="p-2 text-sm"></div>
                </div>
            </div>

            <div class="flex items-center gap-3 flex-shrink-0">
                <!-- Badge global de alertas -->
                <div class="relative">
                    <button id="alertsBell" onclick="toggleAlertsPanel()"
                            class="relative w-9 h-9 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-600 transition">
                        <i class="fas fa-bell text-sm"></i>
                        <span id="alertsBadge" class="hidden absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1
                              rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">0</span>
                    </button>
                    <div id="alertsPanel" class="hidden absolute right-0 mt-2 w-80 bg-white border border-gray-200
                         rounded-xl shadow-lg z-20 max-h-[480px] overflow-y-auto">
                        <div class="p-3 border-b border-gray-100 flex justify-between items-center">
                            <p class="font-bold text-gray-800 text-sm">Alertas</p>
                            <button onclick="toggleAlertsPanel()" class="text-gray-400 hover:text-gray-600 w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100"><i class="fas fa-times text-xs"></i></button>
                        </div>
                        <div id="alertsContent" class="p-3 text-sm text-gray-500">Carregando…</div>
                    </div>
                </div>

                <div id="userAvatarBox" class="flex items-center gap-3 pl-1 pr-3 py-1 bg-gray-50 rounded-lg border border-gray-200">
                    <div class="w-8 h-8 rounded-md bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center text-white text-xs font-bold" id="userAvatar">U</div>
                    <span class="text-sm font-medium text-gray-700" id="userName">Utilizador</span>
                </div>
                <button onclick="logout()" title="Sair" class="w-9 h-9 rounded-lg bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 hover:text-red-600 flex items-center justify-center text-gray-500 transition">
                    <i class="fas fa-sign-out-alt text-sm"></i>
                </button>
            </div>
        </header>`;

    const layoutRoot = document.getElementById('layoutRoot');
    if (!layoutRoot) {
        console.error('renderInventoryLayout: <div id="layoutRoot"> não encontrado');
        return;
    }
    layoutRoot.innerHTML = `<div class="flex h-screen overflow-hidden">${sidebar}
        <main class="flex-1 overflow-y-auto bg-gradient-to-b from-sky-50 via-blue-50 to-white">${header}
            <div id="pageContent" class="p-8"></div>
        </main></div>`;

    // Popula user info: tenta localStorage primeiro (fast path), depois /api/auth/me
    populateUserHeader();
    restoreSidebarState();
}

async function populateUserHeader() {
    // Fast path: localStorage.user (objeto auth.users do Supabase)
    let display = null;
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        display = user.user_metadata?.full_name || user.user_metadata?.display_name || user.email || null;
    } catch {}

    if (display) renderUserAvatar(display);

    // Slow path: /api/auth/me devolve roles + full_name (mais autoritativo)
    try {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        const r = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
        if (!r.ok) return;
        const data = await r.json();
        const full = data.full_name || data.display_name || data.email;
        if (full && full !== display) renderUserAvatar(full);

        // F5.4: revela itens marcados como adminOnly se a role for de admin
        const roles  = Array.isArray(data.roles) ? data.roles : [];
        const isAdmin = roles.some(r => ['Inventory_Admin','Admin','admin'].includes(r));
        if (isAdmin) {
            document.querySelectorAll('[data-admin-only]').forEach(el => { el.style.display = ''; });
        }
    } catch {}
}

function renderUserAvatar(display) {
    const avatar = (display.match(/\b\w/g) || ['U']).slice(0, 2).join('').toUpperCase();
    const avEl = document.getElementById('userAvatar');
    const nmEl = document.getElementById('userName');
    if (avEl) avEl.textContent = avatar;
    if (nmEl) nmEl.textContent = display;
}

// =====================================================
// Sidebar retrátil (estado persistido em localStorage)
// =====================================================

const SIDEBAR_STATE_KEY = 'inventory_sidebar_collapsed';

function toggleSidebar() {
    const collapsed = document.documentElement.classList.toggle('sidebar-collapsed');
    try { localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? '1' : '0'); } catch {}
    applySidebarState(collapsed);
}

function restoreSidebarState() {
    let collapsed = false;
    try { collapsed = localStorage.getItem(SIDEBAR_STATE_KEY) === '1'; } catch {}
    document.documentElement.classList.toggle('sidebar-collapsed', collapsed);
    applySidebarState(collapsed);

    // Injecta CSS uma vez (controla as larguras e visibilidade dos labels)
    if (!document.getElementById('sidebarCollapsedStyle')) {
        const style = document.createElement('style');
        style.id = 'sidebarCollapsedStyle';
        style.textContent = `
            html.sidebar-collapsed #inventorySidebar { width: 72px !important; }
            html.sidebar-collapsed #inventorySidebar .sidebar-label { display: none; }
            html.sidebar-collapsed #inventorySidebar .sidebar-nav-item { justify-content: center; padding-left: 0; padding-right: 0; }
            html.sidebar-collapsed #inventorySidebar nav { padding-left: 0.5rem; padding-right: 0.5rem; }
        `;
        document.head.appendChild(style);
    }
}

function applySidebarState(collapsed) {
    const icon = document.getElementById('sidebarToggleIcon');
    const btn  = document.getElementById('sidebarToggleBtn');
    if (icon) icon.className = `fas ${collapsed ? 'fa-chevron-right' : 'fa-chevron-left'} w-5 text-center`;
    if (btn)  btn.title = collapsed ? 'Expandir menu' : 'Recolher menu';
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_profile');
    redirectToLogin();
}

// Redireciona para o login preservando a URL atual em ?redirect=, para que
// o login.html possa voltar à página de origem após autenticação.
function redirectToLogin() {
    const here = window.location.pathname + window.location.search;
    const skip = ['/login.html', '/'];
    const target = skip.includes(window.location.pathname)
        ? '/login.html'
        : `/login.html?redirect=${encodeURIComponent(here)}`;
    window.location.href = target;
}

// Helper API call wrapper.
// Detecta token expirado/inválido (401, ou 403 com mensagem mencionando token)
// e redireciona para o login mantendo a URL atual em ?redirect=.
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

    if (res.status === 401 ||
        (res.status === 403 && /token|perfil de usuário/i.test((data && data.error) || ''))) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        redirectToLogin();
        throw new Error('Sessão expirada — redirecionando para login');
    }

    if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
    return data;
}

// Toast helper
function toast(message, type = 'success') {
    const variants = {
        success: { bg: 'bg-sky-500',    icon: 'fa-check-circle' },
        error:   { bg: 'bg-red-500',    icon: 'fa-circle-xmark' },
        info:    { bg: 'bg-blue-500',   icon: 'fa-circle-info' },
        warn:    { bg: 'bg-amber-500',  icon: 'fa-triangle-exclamation' }
    };
    const v = variants[type] || variants.info;
    const el = document.createElement('div');
    el.className = `fixed top-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-lg text-white text-sm shadow-lg ${v.bg} transition-opacity duration-300`;
    el.innerHTML = `<i class="fas ${v.icon}"></i><span>${message}</span>`;
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

    const critical    = alertsCache.critical_items || [];
    const expiring    = alertsCache.expiring_lots  || [];
    const byLocation  = alertsCache.by_location     || [];

    let html = '';

    if (critical.length === 0 && expiring.length === 0) {
        html = `<div class="py-6 text-center">
            <div class="inline-flex w-10 h-10 rounded-full bg-sky-100 items-center justify-center text-sky-600 mb-2">
                <i class="fas fa-check"></i>
            </div>
            <p class="text-sm text-gray-700 font-medium">Tudo em ordem</p>
            <p class="text-xs text-gray-500 mt-1">Sem alertas no momento.</p>
        </div>`;
    } else {
        // Resumo por localização (F4.4) — quando o backend fornece breakdown
        const withAlerts = byLocation.filter(g => g.below_min > 0);
        if (withAlerts.length > 0) {
            html += `<div class="mb-3 pb-3 border-b border-gray-100">
                <p class="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-2">Por localização</p>
                <div class="flex flex-col gap-1.5">
                    ${withAlerts.map(g => `
                        <a href="/inventory/index.html" class="flex justify-between items-center text-xs px-2 py-1.5 rounded border border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition">
                            <span class="text-gray-700 truncate">${escapeAlerts(g.unit_name || '')} · ${escapeAlerts(g.location_name)}</span>
                            <span class="ml-2 font-bold text-amber-700 flex-shrink-0">${g.below_min}</span>
                        </a>
                    `).join('')}
                </div>
            </div>`;
        }
        if (critical.length > 0) {
            html += `<div class="mb-3">
                <p class="text-[10px] uppercase font-bold text-red-600 tracking-wider mb-2 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> Stock abaixo do mínimo</p>
                ${critical.slice(0, 5).map(i => `
                    <div class="flex justify-between py-1.5 border-b border-gray-50 last:border-0 text-xs">
                        <span class="text-gray-800 truncate"><span class="font-mono text-gray-400">${escapeAlerts(i.internal_code)}</span> ${escapeAlerts(i.name)}${i.location_name ? ' <span class="text-gray-400">· ' + escapeAlerts(i.location_name) + '</span>' : ''}</span>
                        <span class="${i.stock === 0 ? 'text-red-600 font-bold' : 'text-amber-600'} ml-2 flex-shrink-0 tabular-nums">${parseFloat(i.stock).toFixed(0)} / ${parseFloat(i.min_stock).toFixed(0)}</span>
                    </div>`).join('')}
                ${critical.length > 5 ? `<a href="/inventory/reports.html" class="text-xs text-sky-600 hover:text-sky-700 hover:underline mt-2 inline-flex items-center gap-1">+ ${critical.length - 5} mais <i class="fas fa-arrow-right text-[10px]"></i></a>` : ''}
            </div>`;
        }
        if (expiring.length > 0) {
            html += `<div>
                <p class="text-[10px] uppercase font-bold text-amber-600 tracking-wider mb-2 flex items-center gap-1.5"><span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Lotes vencendo (30 dias)</p>
                ${expiring.slice(0, 5).map(l => `
                    <div class="flex justify-between py-1.5 border-b border-gray-50 last:border-0 text-xs">
                        <span class="text-gray-800 truncate">${escapeAlerts(l.item?.name || '')} · <span class="font-mono text-gray-400">${escapeAlerts(l.lot_number)}</span></span>
                        <span class="text-amber-600 ml-2 flex-shrink-0 tabular-nums">${l.expiry_date}</span>
                    </div>`).join('')}
                ${expiring.length > 5 ? `<a href="/inventory/index.html" class="text-xs text-sky-600 hover:text-sky-700 hover:underline mt-2 inline-flex items-center gap-1">+ ${expiring.length - 5} mais <i class="fas fa-arrow-right text-[10px]"></i></a>` : ''}
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
            html += '<p class="text-[10px] uppercase font-bold text-gray-400 tracking-wider px-2 mt-1 mb-1">Itens</p>';
            html += items.map(i => `
                <button onclick='openActionPanel(${JSON.stringify({kind:"item", ...i}).replace(/'/g,"&#39;")})'
                        class="w-full text-left flex items-center gap-2.5 px-2 py-1.5 hover:bg-sky-50 rounded-md text-xs transition">
                    <i class="fas fa-box ${i.macro_category === "patrimonial" ? "text-purple-500" : "text-sky-500"} w-4 text-center"></i>
                    <span class="font-mono text-gray-400">${escapeAlerts(i.internal_code)}</span>
                    <span class="text-gray-800 truncate flex-1">${escapeAlerts(i.name)}</span>
                    ${!i.is_active ? '<span class="text-[10px] text-gray-400">(inativo)</span>' : ''}
                </button>`).join('');
        }
        if (lots.length) {
            html += '<p class="text-[10px] uppercase font-bold text-gray-400 tracking-wider px-2 mt-3 mb-1">Lotes</p>';
            html += lots.map(l => `
                <button onclick='openActionPanel(${JSON.stringify({kind:"lot", id:l.id, lot_number:l.lot_number, expiry_date:l.expiry_date, item:l.item}).replace(/'/g,"&#39;")})'
                        class="w-full text-left flex items-center gap-2.5 px-2 py-1.5 hover:bg-amber-50 rounded-md text-xs transition">
                    <i class="fas fa-flask text-amber-600 w-4 text-center"></i>
                    <span class="font-mono">${escapeAlerts(l.lot_number)}</span>
                    <span class="text-gray-600 truncate flex-1">${escapeAlerts(l.item?.name || '')}</span>
                    ${l.expiry_date ? `<span class="text-[10px] text-gray-400">val ${l.expiry_date}</span>` : ''}
                </button>`).join('');
        }
        if (suppliers.length) {
            html += '<p class="text-[10px] uppercase font-bold text-gray-400 tracking-wider px-2 mt-3 mb-1">Fornecedores</p>';
            html += suppliers.map(s => `
                <button onclick='openActionPanel(${JSON.stringify({kind:"supplier", ...s}).replace(/'/g,"&#39;")})'
                        class="w-full text-left flex items-center gap-2.5 px-2 py-1.5 hover:bg-indigo-50 rounded-md text-xs transition">
                    <i class="fas fa-truck text-indigo-500 w-4 text-center"></i>
                    <span class="text-gray-800 truncate flex-1">${escapeAlerts(s.name)}</span>
                    ${s.tax_id ? `<span class="text-[10px] text-gray-400 font-mono">${escapeAlerts(s.tax_id)}</span>` : ''}
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
        <div class="absolute inset-0 bg-gray-900/30 backdrop-blur-[2px]" onclick="closeActionPanel()"></div>
        <div class="absolute right-0 top-0 bottom-0 w-[400px] bg-white shadow-2xl overflow-y-auto border-l border-gray-200">
            <div class="px-5 py-4 border-b border-gray-100 flex justify-between items-start gap-2 sticky top-0 bg-white z-10">
                <h3 id="actionPanelTitle" class="font-bold text-gray-900 text-sm">—</h3>
                <button onclick="closeActionPanel()" class="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 flex-shrink-0"><i class="fas fa-times text-xs"></i></button>
            </div>
            <div id="actionPanelBody" class="p-5 space-y-4"></div>
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

    // Helper para criar action button consistente
    const actionBtn = (href, color, icon, label) =>
        `<a href="${href}" class="px-3 py-2.5 bg-${color}-50 hover:bg-${color}-100 text-${color}-700 border border-${color}-100 rounded-lg text-xs text-center font-medium transition flex items-center justify-center gap-1.5"><i class="fas ${icon}"></i> ${label}</a>`;

    if (entity.kind === 'item') {
        const macroColor = entity.macro_category === 'patrimonial' ? 'purple' : 'sky';
        title.innerHTML = `<div class="flex items-center gap-2">
            <span class="font-mono text-[11px] text-gray-400">${escapeAlerts(entity.internal_code)}</span>
            <span class="text-gray-900">${escapeAlerts(entity.name)}</span>
        </div>`;
        body.innerHTML = `
            <div class="flex items-center gap-2 text-xs">
                <span class="px-2 py-0.5 rounded bg-${macroColor}-100 text-${macroColor}-700 font-medium capitalize">${escapeAlerts(entity.macro_category)}</span>
                ${!entity.is_active ? '<span class="px-2 py-0.5 rounded bg-gray-100 text-gray-500">inativo</span>' : ''}
            </div>
            ${entity.image_url ? `<img src="${entity.image_url}" class="w-full h-36 object-cover rounded-lg border border-gray-100">` : ''}
            <div class="grid grid-cols-2 gap-2 pt-1">
                ${actionBtn(`/inventory/item-form.html?id=${entity.id}`,    'sky',    'fa-edit',                    'Editar')}
                ${actionBtn(`/inventory/kardex.html?item=${entity.id}`,    'cyan',   'fa-clipboard-list',          'Kardex')}
                ${actionBtn(`/inventory/item-label.html?id=${entity.id}`,  'gray',   'fa-qrcode',                  'Etiqueta')}
                ${actionBtn(`/inventory/movements.html?item_id=${entity.id}`, 'purple', 'fa-history',              'Histórico')}
                ${actionBtn(`/inventory/entries.html`,                      'sky',    'fa-arrow-right-to-bracket',  'Nova entrada')}
                ${actionBtn(`/inventory/exits.html`,                        'red',    'fa-arrow-right-from-bracket','Nova saída')}
            </div>`;
    } else if (entity.kind === 'lot') {
        title.innerHTML = `<div class="flex items-center gap-2"><i class="fas fa-flask text-amber-500"></i>Lote <span class="font-mono">${escapeAlerts(entity.lot_number)}</span></div>`;
        body.innerHTML = `
            <div class="bg-gray-50 rounded-lg p-3 space-y-1.5">
                <p class="text-xs text-gray-500">Item</p>
                <p class="text-sm font-medium text-gray-800"><span class="font-mono text-xs text-gray-400">${escapeAlerts(entity.item?.internal_code || '')}</span> ${escapeAlerts(entity.item?.name || '')}</p>
                ${entity.expiry_date ? `<p class="text-xs text-gray-500 pt-2">Validade <span class="text-amber-600 font-medium ml-1">${entity.expiry_date}</span></p>` : ''}
            </div>
            <div class="space-y-2 pt-1">
                ${actionBtn(`/inventory/kardex.html?item=${entity.item?.id}`,   'cyan', 'fa-clipboard-list', 'Kardex do item')}
                ${actionBtn(`/inventory/item-form.html?id=${entity.item?.id}`, 'sky',  'fa-edit',           'Editar item')}
            </div>`;
    } else if (entity.kind === 'supplier') {
        title.innerHTML = `<div class="flex items-center gap-2"><i class="fas fa-truck text-indigo-500"></i>${escapeAlerts(entity.name)}</div>`;
        body.innerHTML = `
            <div class="bg-gray-50 rounded-lg p-3 space-y-1.5">
                ${entity.tax_id ? `<p class="text-xs text-gray-500">NIF <span class="font-mono text-gray-700 ml-1">${escapeAlerts(entity.tax_id)}</span></p>` : ''}
                ${entity.email  ? `<p class="text-xs text-gray-500">Email <span class="text-gray-700 ml-1">${escapeAlerts(entity.email)}</span></p>` : ''}
                ${!entity.tax_id && !entity.email ? '<p class="text-xs text-gray-400 italic">Sem dados de contacto cadastrados.</p>' : ''}
            </div>
            <div class="space-y-2 pt-1">
                ${actionBtn(`/inventory/suppliers.html`, 'sky', 'fa-list',                     'Ver lista de fornecedores')}
                ${actionBtn(`/inventory/entries.html`,  'sky', 'fa-arrow-right-to-bracket',   'Nova entrada')}
            </div>`;
    }
}

function closeActionPanel() {
    const p = document.getElementById('actionPanel');
    if (p) p.classList.add('hidden');
}

// =====================================================
// Modal de visualização genérico (read-only)
// =====================================================
// Uso: showViewModal({ title, sections: [{ title, rows: [[label, value], …] }, …] })

function showViewModal({ title, sections = [] }) {
    let modal = document.getElementById('genericViewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'genericViewModal';
        modal.className = 'hidden fixed inset-0 bg-gray-900/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200">
                <div class="flex justify-between items-start p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <h3 id="genericViewTitle" class="font-bold text-gray-900 text-base">—</h3>
                    <button onclick="closeViewModal()" class="text-gray-400 hover:text-gray-600 w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 flex-shrink-0"><i class="fas fa-times text-xs"></i></button>
                </div>
                <div id="genericViewBody" class="p-6"></div>
            </div>`;
        document.body.appendChild(modal);
    }
    document.getElementById('genericViewTitle').textContent = title;
    document.getElementById('genericViewBody').innerHTML = sections.map(sec => `
        <div class="mb-5 last:mb-0">
            ${sec.title ? `<h4 class="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">${escapeAlerts(sec.title)}</h4>` : ''}
            <div class="bg-gray-50/50 border border-gray-100 rounded-lg divide-y divide-gray-100">
                ${sec.rows.map(([label, value, opts = {}]) => `
                    <div class="flex justify-between items-center gap-3 px-3.5 py-2.5">
                        <span class="text-xs text-gray-500 flex-shrink-0">${escapeAlerts(label)}</span>
                        <span class="text-sm ${opts.mono ? 'font-mono text-xs' : ''} ${opts.bold ? 'font-bold' : ''} text-gray-800 text-right tabular-nums">${value === null || value === undefined || value === '' ? '<span class="text-gray-300">—</span>' : escapeAlerts(String(value))}</span>
                    </div>`).join('')}
            </div>
        </div>`).join('');
    modal.classList.remove('hidden');
}

function closeViewModal() {
    const m = document.getElementById('genericViewModal');
    if (m) m.classList.add('hidden');
}
