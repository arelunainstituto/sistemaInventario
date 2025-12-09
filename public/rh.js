// Main HR Module Logic

// State
let currentTab = 'dashboard';
let currentUser = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[RH] DOMContentLoaded fired');

    // Wait for AuthManager to initialize
    console.log('[RH] Checking authManager...');
    if (window.authManager && window.authManager.ready) {
        console.log('[RH] Waiting for authManager.ready...');
        try {
            await window.authManager.ready;
            console.log('[RH] authManager ready!');
        } catch (error) {
            console.error('[RH] Error waiting for authManager:', error);
        }
    } else {
        console.warn('[RH] authManager or authManager.ready not found');
    }

    // 1. Check Auth
    console.log('[RH] Checking authentication...');
    if (!window.isAuthenticated()) {
        console.log('[RH] Not authenticated, redirecting to login');
        window.location.href = '/login.html';
        return;
    }
    console.log('[RH] User is authenticated');

    // 2. Load User Info
    try {
        const response = await window.authenticatedFetch('/api/auth/me');
        if (response.ok) {
            currentUser = await response.json();
            updateUserInterface(currentUser);
            checkPermissions(currentUser);
        } else {
            throw new Error('Failed to fetch user');
        }
    } catch (error) {
        console.error('Auth Error:', error);
        window.location.href = '/login.html';
        return;
    }

    // 3. Load Initial Tab (Dashboard)
    loadDashboard();

    // 4. Setup Tab Listeners
    console.log('Setting up tab listeners...');
    const tabButtons = document.querySelectorAll('[data-tab]');
    console.log('Found tab buttons:', tabButtons.length);

    tabButtons.forEach((button, index) => {
        const tabName = button.dataset.tab;
        console.log(`Attaching listener to button ${index}: ${tabName}`);

        button.addEventListener('click', (e) => {
            console.log(`Tab clicked: ${tabName}`);
            e.preventDefault();
            switchTab(tabName);
        });
    });

    console.log('Tab listeners setup complete');
});

// Update User UI
function updateUserInterface(user) {
    document.getElementById('userName').textContent = user.full_name || user.email;
    document.getElementById('userRole').textContent = (user.roles || []).join(', ') || 'Funcionário';

    // Avatar initials
    const initials = (user.full_name || user.email).substring(0, 2).toUpperCase();
    document.getElementById('userAvatar').textContent = initials;
}

// Check Permissions and Hide/Show Tabs
function checkPermissions(user) {
    const roles = user.roles || [];
    const permissions = user.permissions || [];
    const isAdmin = roles.includes('Admin') || roles.includes('rh_manager');

    document.querySelectorAll('[data-permission]').forEach(el => {
        const requiredPermission = el.dataset.permission;
        if (!isAdmin && !permissions.includes(requiredPermission)) {
            el.style.display = 'none';
        }
    });
}

// Tab Switching
window.switchTab = function (tabName) {
    // Update Sidebar
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active', 'bg-purple-50', 'text-purple-600');
        btn.classList.add('text-gray-600');
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active', 'bg-purple-50', 'text-purple-600');
            btn.classList.remove('text-gray-600');
        }
    });

    // Update Content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tabName}-tab`).classList.remove('hidden');

    // Update Header
    const titles = {
        'dashboard': ['Dashboard', 'Visão geral do departamento'],
        'employees': ['Funcionários', 'Gestão de colaboradores'],
        'payroll': ['Folha de Pagamento', 'Processamento mensal'],
        'documents': ['Documentos', 'Arquivo digital'],
        'absences': ['Férias e Ausências', 'Controle de frequência'],
        'performance': ['Avaliações', 'Gestão de desempenho'],
        'reports': ['Relatórios', 'Dados e estatísticas'],
        'orgchart': ['Organograma', 'Estrutura Hierárquica']
    };
    const [title, subtitle] = titles[tabName] || ['Recursos Humanos', 'Gestão'];
    document.getElementById('pageTitle').textContent = title;
    document.getElementById('pageSubtitle').textContent = subtitle;

    currentTab = tabName;

    // Load Tab Data
    loadTabData(tabName);
};

// Load Data for Specific Tab
async function loadTabData(tab) {
    switch (tab) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'employees':
            if (window.loadEmployees) window.loadEmployees();
            break;
        case 'payroll':
            if (window.loadPayroll) window.loadPayroll();
            break;
        case 'documents':
            if (window.loadDocuments) window.loadDocuments();
            break;
        case 'absences':
            if (window.loadAbsences) window.loadAbsences();
            break;
        case 'performance':
            if (window.loadPerformance) window.loadPerformance();
            break;
        case 'reports':
            if (window.loadReports) window.loadReports();
            break;
        case 'orgchart':
            if (window.loadOrgChart) window.loadOrgChart();
            break;
    }
}

// Load Dashboard Data
async function loadDashboard() {
    try {
        const response = await window.authenticatedFetch('/api/rh/dashboard/kpis');
        if (!response.ok) throw new Error('Failed to load KPIs');

        const data = await response.json();

        // Update KPIs
        document.getElementById('kpi-total-employees').textContent = data.totalEmployees;
        document.getElementById('kpi-pending-absences').textContent = data.pendingAbsences;
        document.getElementById('kpi-payroll-cost').textContent = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(data.totalPayrollCost);
        document.getElementById('kpi-expiring-docs').textContent = data.expiringDocuments;

        // Load Charts
        loadCharts();

    } catch (error) {
        console.error('Dashboard Error:', error);
    }
}

async function loadCharts() {
    try {
        const response = await window.authenticatedFetch('/api/rh/dashboard/charts');
        if (!response.ok) throw new Error('Failed to load charts');

        const data = await response.json();

        // Department Chart
        const ctx = document.getElementById('departmentChart').getContext('2d');
        if (window.deptChart) window.deptChart.destroy();

        window.deptChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(data.departmentDistribution),
                datasets: [{
                    data: Object.values(data.departmentDistribution),
                    backgroundColor: [
                        '#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });

    } catch (error) {
        console.error('Charts Error:', error);
    }
}

// Utility: Show Loading
window.showLoading = function () {
    document.getElementById('loadingOverlay').classList.remove('hidden');
};

window.hideLoading = function () {
    document.getElementById('loadingOverlay').classList.add('hidden');
};
