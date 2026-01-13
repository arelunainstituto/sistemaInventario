document.addEventListener('DOMContentLoaded', async () => {
    // Inicializar Auth
    const authManager = new AuthManager();
    window.authManager = authManager; // Make accessible

    const init = async () => {
        try {
            await authManager.init();

            // Check Access
            if (!authManager.hasPermission('marketing:read') && !authManager.userRoles.includes('Marketing') && !authManager.userRoles.includes('admin')) {
                alert('Acesso negado. Você não tem permissão para acessar este módulo.');
                window.location.href = '/dashboard.html';
                return;
            }

            // Load initial tab (Blog)
            setupTabs();

            // Initial load of blog posts matches the active tab
            if (window.BlogManager) {
                window.BlogManager.init();
            }

        } catch (error) {
            console.error('Erro na inicialização:', error);
            // window.location.href = '/login.html';
        }
    };

    const setupTabs = () => {
        const tabButtons = document.querySelectorAll('[data-tab]');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Remove active class from all
                tabButtons.forEach(btn => btn.classList.remove('nav-item', 'active', 'bg-pink-50', 'text-pink-600'));
                tabButtons.forEach(btn => btn.classList.add('text-gray-600', 'hover:bg-gray-50'));

                // Add active class to clicked
                button.classList.remove('text-gray-600', 'hover:bg-gray-50');
                button.classList.add('nav-item', 'active', 'bg-pink-50', 'text-pink-600');

                // Show content
                const tabId = button.dataset.tab;
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(`${tabId}-tab`).classList.add('active');

                // Update Header
                const title = button.innerText.trim();
                document.getElementById('pageTitle').textContent = title;

                if (tabId === 'blog') {
                    document.getElementById('pageSubtitle').textContent = 'Gerenciar postagens do site';
                    if (window.BlogManager) window.BlogManager.loadPosts();
                }
            });
        });
    };

    init();
});
