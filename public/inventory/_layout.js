// Shared layout for inventory module: sidebar + header.
// Each page calls renderInventoryLayout({ activePage, title, subtitle }).

const INVENTORY_NAV = [
    { id: 'dashboard',   label: 'Dashboard',         icon: 'fa-chart-pie',  href: 'index.html' },
    { id: 'items',       label: 'Itens',             icon: 'fa-boxes-stacked', href: 'items.html' },
    { id: 'entries',     label: 'Entradas',          icon: 'fa-arrow-right-to-bracket', href: 'entries.html' },
    { id: 'exits',       label: 'Saídas',            icon: 'fa-arrow-right-from-bracket', href: 'exits.html' },
    { id: 'transfers',   label: 'Transferências',    icon: 'fa-right-left',  href: 'transfers.html' },
    { id: 'adjustments', label: 'Ajustes',           icon: 'fa-sliders',     href: 'adjustments.html' },
    { id: 'inventory-session', label: 'Inventário Físico', icon: 'fa-list-check', href: 'inventory-session.html', disabled: true, badge: 'F3' },
    { id: 'reports',     label: 'Relatórios',        icon: 'fa-chart-line',  href: 'reports.html',   disabled: true, badge: 'F3' },
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
