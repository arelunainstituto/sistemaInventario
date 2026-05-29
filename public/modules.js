/**
 * Sistema de Módulos Baseado em Permissões
 * Grupo AreLuna - Sistema de Inventário
 */

/**
 * Classe para gerenciar módulos e permissões
 */
class ModuleManager {
    constructor() {
        this.userPermissions = [];
        this.userRoles = [];
        this.availableModules = [
            {
                id: 'inventory',
                name: 'Inventário',
                icon: 'fas fa-warehouse',
                emoji: '📦',
                url: 'inventory/index.html',
                tabs: [
                    { id: 'dashboard',   name: 'Dashboard',       icon: 'fas fa-chart-pie',              permission: 'read' },
                    { id: 'items',       name: 'Itens',           icon: 'fas fa-boxes-stacked',          permission: 'read' },
                    { id: 'entries',     name: 'Entradas',        icon: 'fas fa-arrow-right-to-bracket', permission: 'entry' },
                    { id: 'exits',       name: 'Saídas',          icon: 'fas fa-arrow-right-from-bracket', permission: 'exit' },
                    { id: 'transfers',   name: 'Transferências',  icon: 'fas fa-right-left',             permission: 'transfer' },
                    { id: 'adjustments', name: 'Ajustes',         icon: 'fas fa-sliders',                permission: 'adjust' },
                    { id: 'scan',        name: 'Ler QR Code',     icon: 'fas fa-qrcode',                 permission: 'read' },
                    { id: 'locations',   name: 'Localizações',    icon: 'fas fa-map-marker-alt',         permission: 'read' },
                    { id: 'categories',  name: 'Subcategorias',   icon: 'fas fa-tags',                   permission: 'read' },
                    { id: 'suppliers',   name: 'Fornecedores',    icon: 'fas fa-truck',                  permission: 'read' },
                    { id: 'uoms',        name: 'Un. medida',      icon: 'fas fa-ruler',                  permission: 'read' }
                ]
            },
            {
                id: 'prostoral',
                name: 'Prostoral',
                icon: 'fas fa-tooth',
                emoji: '🦷',
                url: 'prostoral.html',
                tabs: []
            },
            {
                id: 'laboratory',
                name: 'Laboratório',
                icon: 'fas fa-flask',
                emoji: '🧪',
                url: 'laboratorio-produtos.html',
                tabs: []
            },
            {
                id: 'marketing',
                name: 'Marketing',
                icon: 'fas fa-bullhorn',
                emoji: '📢',
                url: 'marketing.html',
                tabs: [
                    { id: 'blog', name: 'Blog', icon: 'fas fa-newspaper', permission: 'read' }
                ]
            }
        ];
        this.init();
    }

    /**
     * Inicializa o gerenciador de módulos
     */
    async init() {
        try {
            await this.loadUserPermissions();
            this.renderModuleNavigation();
        } catch (error) {
            console.error('Erro ao inicializar módulos:', error);
        }
    }

    /**
     * Carrega as permissões do usuário atual
     */
    async loadUserPermissions() {
        try {
            const response = await authenticatedFetch('/api/auth/me');
            if (response.ok) {
                const userData = await response.json();

                // Extrair permissões e roles do objeto user
                const user = userData.user || userData;
                this.userPermissions = user.permissions || [];
                this.userRoles = user.roles || [];

                console.log('Permissões carregadas:', this.userPermissions);
                console.log('Roles carregadas:', this.userRoles);
            } else {
                console.error('Erro ao carregar permissões do usuário');
            }
        } catch (error) {
            console.error('Erro ao carregar permissões:', error);
        }
    }

    /**
     * Verifica se o usuário tem uma permissão específica
     */
    hasPermission(module, action) {
        // Admin tem acesso total
        if (this.userRoles.includes('admin')) {
            return true;
        }

        // Verifica permissão específica no formato string "module:action"
        const permissionString = `${module}:${action}`;
        return this.userPermissions.includes(permissionString);
    }

    /**
     * Define o módulo ativo baseado na seleção do usuário
     */
    setActiveModule(moduleId) {
        console.log(`Definindo módulo ativo: ${moduleId}`);

        // Encontra o módulo selecionado
        const selectedModule = this.availableModules.find(module => module.id === moduleId);
        if (!selectedModule) {
            console.error(`Módulo não encontrado: ${moduleId}`);
            return;
        }

        // Verifica se o usuário tem acesso ao módulo
        if (!this.hasModuleAccess(moduleId)) {
            console.error(`Usuário não tem acesso ao módulo: ${moduleId}`);
            this.showNoAccessMessage();
            return;
        }

        // Renderiza apenas o módulo selecionado
        this.renderSingleModule(selectedModule);
    }

    /**
     * Renderiza apenas um módulo específico
     */
    renderSingleModule(module) {
        const moduleNav = document.getElementById('module-navigation');
        if (!moduleNav) return;

        const accessibleTabs = this.getAccessibleTabs(module);
        if (accessibleTabs.length === 0) {
            this.showNoAccessMessage();
            return;
        }

        // Limpa a navegação atual
        moduleNav.innerHTML = '';

        // Cria o container do módulo
        const moduleContainer = document.createElement('div');
        moduleContainer.className = 'module-container';
        moduleContainer.innerHTML = `
            <div class="module-header mb-4">
                <h2 class="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <i class="${module.icon}"></i>
                    ${module.name}
                </h2>
            </div>
            <div class="tabs-container">
                <div class="flex flex-wrap gap-2 mb-4" id="tabs-${module.id}">
                    ${accessibleTabs.map(tab => this.createTabButton(tab, tab.id === accessibleTabs[0].id ? 'active' : '')).join('')}
                </div>
            </div>
        `;

        moduleNav.appendChild(moduleContainer);

        // Ativa a primeira aba disponível
        if (accessibleTabs.length > 0) {
            this.switchTab(accessibleTabs[0].id);
        }

        // Anexa event listeners
        this.attachTabEventListeners();
    }

    /**
     * Mostra mensagem quando o usuário não tem acesso
     */
    showNoAccessMessage() {
        const moduleNav = document.getElementById('module-navigation');
        if (!moduleNav) return;

        moduleNav.innerHTML = `
            <div class="text-center py-8">
                <div class="text-6xl mb-4">🔒</div>
                <h3 class="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Acesso Negado
                </h3>
                <p class="text-gray-600 dark:text-gray-400">
                    Você não tem permissão para acessar este módulo.
                </p>
                <button onclick="window.location.href='module-selection.html'" 
                        class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
                    Voltar à Seleção de Módulos
                </button>
            </div>
        `;
    }

    /**
     * Verifica se o usuário tem acesso a pelo menos um módulo
     */
    hasModuleAccess(moduleId) {
        // Admin tem acesso total
        if (this.userRoles.includes('admin')) {
            return true;
        }

        // Verifica se tem pelo menos uma permissão no módulo (formato "module:action")
        return this.userPermissions.some(permission =>
            permission.startsWith(`${moduleId}:`)
        );
    }

    /**
     * Filtra as abas baseado nas permissões do usuário
     */
    getAccessibleTabs(module) {
        return module.tabs.filter(tab =>
            this.hasPermission(module.id, tab.permission)
        );
    }

    /**
     * Renderiza a navegação de módulos baseada nas permissões
     */
    renderModuleNavigation() {
        const navContainer = document.querySelector('nav .grid');
        if (!navContainer) {
            console.error('Container de navegação não encontrado');
            return;
        }

        // Limpa navegação atual
        navContainer.innerHTML = '';

        // Filtra módulos acessíveis
        const accessibleModules = this.availableModules
            .filter(module => this.hasModuleAccess(module.id))
            .map(module => ({
                module,
                tabs: this.getAccessibleTabs(module)
            }))
            .filter(entry => entry.tabs.length > 0);

        if (accessibleModules.length === 0) {
            navContainer.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <p class="text-gray-500 dark:text-gray-400">
                        Nenhum módulo disponível para seu perfil.
                    </p>
                </div>
            `;
            return;
        }

        // Ajusta grid baseado no número total de abas geradas
        const totalTabs = accessibleModules.reduce((sum, entry) => {
            if (entry.module.id === 'inventory') {
                return sum + entry.tabs.length;
            }
            return sum + 1;
        }, 0);

        const gridCols = Math.min(Math.max(totalTabs, 1), 4);
        navContainer.className = `grid grid-cols-1 md:grid-cols-${gridCols} gap-3`;

        // Renderiza cada módulo acessível
        accessibleModules.forEach(({ module, tabs }, moduleIndex) => {
            if (module.id === 'inventory') {
                tabs.forEach((tab, tabIndex) => {
                    const isActive = tabIndex === 0 && moduleIndex === 0 ? 'active' : '';
                    const button = this.createTabButton(tab, isActive);
                    navContainer.appendChild(button);
                });
            } else {
                const isActive = moduleIndex === 0 && !this.hasModuleAccess('inventory') ? 'active' : '';
                const mainTab = {
                    id: module.id,
                    name: module.name,
                    icon: module.icon,
                    emoji: module.emoji
                };
                const button = this.createTabButton(mainTab, isActive);
                if (module.url) {
                    button.setAttribute('data-url', module.url);
                }
                navContainer.appendChild(button);
            }
        });

        // Reaplica event listeners
        this.attachTabEventListeners();
    }

    /**
     * Cria um botão de aba
     */
    createTabButton(tab, activeClass = '') {
        const button = document.createElement('button');
        button.className = `nav-tab ${activeClass} group flex flex-col md:flex-row items-center justify-center gap-2 px-6 py-4 rounded-2xl font-semibold transition-all duration-300 hover:scale-105 text-center`;
        button.setAttribute('data-tab', tab.id);

        button.innerHTML = `
            <i class="${tab.icon} text-lg group-hover:rotate-12 transition-transform duration-300"></i>
            <span class="text-sm md:text-base">${tab.emoji ? `${tab.emoji} ` : ''}${tab.name}</span>
        `;

        return button;
    }

    /**
     * Anexa event listeners para as abas
     */
    attachTabEventListeners() {
        const navTabs = document.querySelectorAll('.nav-tab');
        navTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = tab.getAttribute('data-tab');
                const url = tab.getAttribute('data-url');

                if (url) {
                    window.location.href = url;
                } else {
                    this.switchTab(tabId);
                }
            });
        });
    }

    /**
     * Troca de aba
     */
    switchTab(tabId) {
        // Encontrar se o ID corresponde a um módulo com URL
        const module = this.availableModules.find(m => m.id === tabId);
        if (module && module.url) {
            window.location.href = module.url;
            return;
        }

        // Remove classe active de todas as abas
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.remove('active');
        });

        // Adiciona classe active na aba clicada
        const activeTab = document.querySelector(`[data-tab="${tabId}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Esconde todos os conteúdos
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        // Mostra conteúdo da aba ativa
        const activeContent = document.getElementById(tabId);
        if (activeContent) {
            activeContent.classList.add('active');
        } else {
            // Se não existe conteúdo específico, mostra mensagem
            this.showModulePlaceholder(tabId);
        }
    }

    /**
     * Mostra placeholder para módulos não implementados
     */
    showModulePlaceholder(moduleId) {
        const module = this.availableModules.find(m => m.id === moduleId);
        if (!module) return;

        // Cria ou atualiza placeholder
        let placeholder = document.getElementById('module-placeholder');
        if (!placeholder) {
            placeholder = document.createElement('div');
            placeholder.id = 'module-placeholder';
            placeholder.className = 'tab-content';
            document.querySelector('.max-w-7xl').appendChild(placeholder);
        }

        placeholder.innerHTML = `
            <div class="bg-white/80 dark:bg-gray-800/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 dark:border-gray-700/20 p-12 text-center animate-fade-in">
                <div class="mb-6">
                    <i class="${module.icon} text-6xl text-primary-600 dark:text-primary-400 mb-4"></i>
                    <h2 class="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                        ${module.emoji} ${module.name}
                    </h2>
                </div>
                <p class="text-gray-600 dark:text-gray-300 text-lg mb-8">
                    Este módulo está em desenvolvimento e será disponibilizado em breve.
                </p>
                <div class="bg-primary-50 dark:bg-primary-900/20 rounded-2xl p-6">
                    <h3 class="font-semibold text-primary-800 dark:text-primary-200 mb-3">
                        Funcionalidades Planejadas:
                    </h3>
                    <ul class="text-primary-700 dark:text-primary-300 space-y-2">
                        ${module.tabs.map(tab => `
                            <li class="flex items-center justify-center space-x-2">
                                <i class="${tab.icon}"></i>
                                <span>${tab.emoji} ${tab.name}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;

        placeholder.classList.add('active');
    }

    /**
     * Atualiza permissões do usuário
     */
    async refreshPermissions() {
        await this.loadUserPermissions();
        this.renderModuleNavigation();
    }
}

// Inicializa o gerenciador de módulos quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
    // Aguarda a autenticação estar pronta
    if (window.authManager && window.authManager.isAuthenticated) {
        window.moduleManager = new ModuleManager();
    } else {
        // Escuta mudanças de autenticação
        const checkAuth = setInterval(() => {
            if (window.authManager && window.authManager.isAuthenticated) {
                window.moduleManager = new ModuleManager();
                clearInterval(checkAuth);
            }
        }, 100);
    }
});