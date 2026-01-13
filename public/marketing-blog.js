const BlogManager = {
    posts: [],
    currentPage: 1,
    limit: 12,
    isLoading: false,
    quill: null,

    async init() {
        // UI Updates
        this.updateUserProfile();

        // Load posts FIRST so user sees content even if editor fails
        this.loadPosts();

        try {
            this.bindEvents();
        } catch (e) {
            console.error('Error binding events:', e);
        }

        // Initialize editor safely
        this.initQuill();
    },

    async updateUserProfile() {
        if (typeof getCurrentUser !== 'function') return;

        const user = getCurrentUser();
        if (user) {
            const userNameElement = document.getElementById('userName');
            const userRoleElement = document.getElementById('userRole');

            if (userNameElement) {
                userNameElement.textContent = user.full_name || user.display_name || user.email || 'Usuário';
            }

            if (userRoleElement) {
                // Fetch valid roles from database via authManager
                try {
                    const roles = await authManager.getUserRoles();
                    const roleDisplay = roles.length > 0 ? roles.join(', ') : 'Membro';
                    userRoleElement.textContent = roleDisplay;
                } catch (e) {
                    console.error('Error fetching roles:', e);
                    userRoleElement.textContent = 'Membro';
                }
            }
        }
    },


    initQuill() {
        if (!document.getElementById('editor-container')) return;

        // Prevent re-initialization
        if (this.quill) return;

        // Check if Quill is loaded
        if (typeof Quill === 'undefined') {
            console.error('Quill library not loaded');
            const container = document.getElementById('editor-container');
            // Check if we already added the fallback
            if (!document.getElementById('fallback-textarea')) {
                container.innerHTML = '<textarea id="fallback-textarea" class="w-full h-full p-2 border border-gray-300 rounded" placeholder="Editor rico não carregou. Digite seu texto aqui em HTML ou texto simples."></textarea>';
            }
            return;
        }

        try {
            this.quill = new Quill('#editor-container', {
                theme: 'snow',
                placeholder: 'Escreva seu post aqui...',
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, false] }],
                        ['bold', 'italic', 'underline', 'strike'],
                        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                        [{ 'color': [] }, { 'background': [] }],
                        ['link', 'image', 'clean']
                    ]
                }
            });
        } catch (e) {
            console.error('Error initializing Quill:', e);
        }
    },

    bindEvents() {
        // Search and Filter
        const searchInput = document.getElementById('blogSearch');
        const statusFilter = document.getElementById('blogStatusFilter');

        // Debounce search
        let timeout;
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.currentPage = 1;
                this.loadPosts();
            }, 300);
        });

        statusFilter?.addEventListener('change', () => {
            this.currentPage = 1;
            this.loadPosts();
        });

        // New Post Button
        document.getElementById('btnNewPost')?.addEventListener('click', () => {
            this.openModal();
        });

        // Modal Controls
        document.getElementById('btnCloseModal')?.addEventListener('click', this.closeModal);
        document.getElementById('btnCancel')?.addEventListener('click', this.closeModal);

        // Form Submit
        document.getElementById('postForm')?.addEventListener('submit', (e) => this.handleSave(e));

        // Image Preview
        document.getElementById('postImage')?.addEventListener('change', (e) => {
            this.updateImagePreview(e.target.value);
        });
        document.getElementById('postImage')?.addEventListener('input', (e) => {
            this.updateImagePreview(e.target.value);
        });

        // File Input
        document.getElementById('postImageFile')?.addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });

        // Remove Image
        document.getElementById('btnRemoveImage')?.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent modal close or form submit
            this.clearImage();
        });
    },

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            // Clear URL input usage if file is selected (for preview purposes)
            // But we keep the input value in case they cancel.
            // Actually, let's clear it to avoid confusion in submission
            document.getElementById('postImage').value = '';

            const reader = new FileReader();
            reader.onload = (e) => {
                this.updateImagePreview(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    },

    clearImage() {
        document.getElementById('postImage').value = '';
        document.getElementById('postImageFile').value = '';
        this.updateImagePreview('');
    },

    updateImagePreview(url) {
        const preview = document.getElementById('imagePreview');
        if (!preview) return;

        if (url && url.trim() !== '') {
            preview.style.backgroundImage = `url('${url}')`;
            preview.classList.remove('hidden');
        } else {
            preview.classList.add('hidden');
            preview.style.backgroundImage = '';
        }
    },

    async loadAuthors() {
        try {
            const response = await authenticatedFetch('/api/admin/users');
            if (response.ok) {
                const result = await response.json();
                // Handle wrapped response { success: true, users: [...] } or direct array
                const authors = result.users || result || [];

                const select = document.getElementById('postAuthor');
                if (select && Array.isArray(authors)) {
                    select.innerHTML = authors.map(u => {
                        // API already formats full_name
                        const name = u.full_name || u.display_name || u.email;
                        // API returns id, but check user_id just in case
                        const uid = u.id || u.user_id;
                        return `<option value="${uid}">${name} (${u.email})</option>`;
                    }).join('');

                    // Show field since we successfully loaded authors (implies Admin)
                    document.getElementById('authorField').classList.remove('hidden');
                    return true;
                }
            } else {
                // Not admin, keep hidden
                document.getElementById('authorField').classList.add('hidden');
                return false;
            }
        } catch (e) {
            console.error('Failed to load authors:', e);
            document.getElementById('authorField').classList.add('hidden');
            return false;
        }
    },

    async loadPosts() {
        if (this.isLoading) return;
        this.isLoading = true;
        this.showLoading(true);

        try {
            const status = document.getElementById('blogStatusFilter')?.value;

            let url = `/api/marketing/posts?page=${this.currentPage}&limit=${this.limit}`;
            if (status) url += `&status=${status}`;

            // Check if authenticatedFetch is available
            if (typeof authenticatedFetch === 'undefined') {
                throw new Error('Sistema de autenticação não carregado.');
            }

            const response = await authenticatedFetch(url);

            if (!response.ok) throw new Error('Falha ao carregar posts');

            const result = await response.json();

            if (result.success) {
                this.posts = result.data;
                this.renderPosts(this.posts);
                this.updatePagination(result.pagination);
            } else {
                throw new Error(result.error || 'Erro desconhecido');
            }

        } catch (error) {
            console.error('Erro:', error);
            const grid = document.getElementById('postsGrid');
            if (grid) {
                grid.innerHTML = `
                    <div class="col-span-full text-center py-12 text-red-500">
                        <p>Erro ao carregar posts: ${error.message}</p>
                        <button onclick="BlogManager.loadPosts()" class="mt-4 text-pink-600 hover:text-pink-700 underline">Tentar novamente</button>
                    </div>
                `;
            }
        } finally {
            this.isLoading = false;
            this.showLoading(false);
        }
    },

    renderPosts(posts) {
        const grid = document.getElementById('postsGrid');
        if (!grid) return;

        if (posts.length === 0) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-100 p-8">
                    <i class="fas fa-newspaper text-4xl mb-3 text-gray-300"></i>
                    <p>Nenhum post encontrado.</p>
                </div>
            `;
            return;
        }

        const searchTerm = document.getElementById('blogSearch')?.value.toLowerCase() || '';
        const filteredPosts = searchTerm
            ? posts.filter(p => p.title.toLowerCase().includes(searchTerm) || p.content?.toLowerCase().includes(searchTerm))
            : posts;

        if (filteredPosts.length === 0 && searchTerm) {
            grid.innerHTML = `
                <div class="col-span-full text-center py-12 text-gray-500">
                    <p>Nenhum post encontrado com o termo "${searchTerm}".</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = filteredPosts.map(post => `
            <div class="post-card bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full group">
                <div class="h-48 bg-gray-100 relative overflow-hidden">
                    ${post.image_url
                ? `<img src="${post.image_url}" alt="${post.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">`
                : `<div class="w-full h-full flex items-center justify-center text-gray-300"><i class="fas fa-image text-4xl"></i></div>`
            }
                    <div class="absolute top-2 right-2">
                        <span class="px-2 py-1 rounded-md text-xs font-semibold ${post.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
            }">
                            ${post.status === 'published' ? 'Publicado' : 'Rascunho'}
                        </span>
                    </div>
                </div>
                <div class="p-5 flex-1 flex flex-col">
                    <div class="text-xs text-gray-400 mb-2 flex items-center gap-2">
                        <i class="far fa-calendar"></i> ${new Date(post.created_at).toLocaleDateString('pt-PT')}
                        ${post.author_name ? `<span class="mx-1">•</span> <i class="far fa-user"></i> ${post.author_name}` : ''}
                    </div>
                    <h3 class="text-lg font-bold text-gray-800 mb-2 line-clamp-2" title="${post.title}">${post.title}</h3>
                    <p class="text-gray-500 text-sm mb-4 line-clamp-3 flex-1">${post.excerpt || 'Sem resumo...'}</p>
                    
                    <div class="flex items-center justify-between pt-4 border-t border-gray-50">
                        <div class="flex gap-2">
                            ${(post.tags || []).slice(0, 2).map(tag =>
                `<span class="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">#${tag}</span>`
            ).join('')}
                        </div>
                        <div class="flex gap-2">
                            <button onclick="BlogManager.editPost('${post.id}')" class="text-blue-600 hover:text-blue-800 p-1" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button onclick="BlogManager.deletePost('${post.id}')" class="text-red-500 hover:text-red-700 p-1" title="Excluir">
                                <i class="fas fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    updatePagination(pagination) {
        const div = document.getElementById('pagination');
        if (!div) return;

        if (pagination.totalPages <= 1) {
            div.classList.add('hidden');
            return;
        }

        div.classList.remove('hidden');
        div.innerHTML = `
            <button ${pagination.page <= 1 ? 'disabled' : ''} 
                onclick="BlogManager.changePage(${pagination.page - 1})"
                class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
                Anterior
            </button>
            <span class="px-3 py-1 text-gray-600">Página ${pagination.page} de ${pagination.totalPages}</span>
            <button ${pagination.page >= pagination.totalPages ? 'disabled' : ''} 
                onclick="BlogManager.changePage(${pagination.page + 1})"
                class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">
                Próxima
            </button>
        `;
    },

    changePage(newPage) {
        this.currentPage = newPage;
        this.loadPosts();
    },

    async openModal(post = null) {
        const modal = document.getElementById('postModal');
        const form = document.getElementById('postForm');

        // Lazy init Quill if needed
        this.initQuill();

        // Clear file input always on open
        if (document.getElementById('postImageFile')) {
            document.getElementById('postImageFile').value = '';
        }

        // Load authors (will only show if Admin)
        const isAdmin = await this.loadAuthors();

        if (post) {
            document.getElementById('modalTitle').textContent = 'Editar Post';
            document.getElementById('postId').value = post.id;
            document.getElementById('postTitle').value = post.title;
            document.getElementById('postExcerpt').value = post.excerpt || '';

            if (this.quill) {
                // Determine if content is HTML or plain text (legacy)
                this.quill.root.innerHTML = post.content || '';
            } else if (document.getElementById('fallback-textarea')) {
                document.getElementById('fallback-textarea').value = post.content || '';
            }

            document.getElementById('postStatus').value = post.status;

            if (isAdmin && post.author_id) {
                document.getElementById('postAuthor').value = post.author_id;
            }
            if (isAdmin) {
                document.getElementById('postCustomAuthor').value = post.custom_author || '';
            }

            document.getElementById('postImage').value = post.image_url || '';
            document.getElementById('postTags').value = (post.tags || []).join(', ');
            this.updateImagePreview(post.image_url || '');
        } else {
            document.getElementById('modalTitle').textContent = 'Novo Post';
            form.reset();

            if (this.quill) {
                this.quill.root.innerHTML = '';
            } else if (document.getElementById('fallback-textarea')) {
                document.getElementById('fallback-textarea').value = '';
            }

            document.getElementById('postId').value = '';
            this.updateImagePreview('');

            // For new post, if admin, default to current user if possible or first in list
            // This logic is now handled by the loadAuthors function and the default selection of the select element.
            // For new post
            if (isAdmin) {
                document.getElementById('postCustomAuthor').value = '';
            }
        }

        modal.classList.remove('hidden');
    },

    closeModal() {
        document.getElementById('postModal').classList.add('hidden');
    },

    async editPost(id) {
        const post = this.posts.find(p => p.id === id);
        if (post) {
            this.openModal(post);
        }
    },

    async handleSave(e) {
        e.preventDefault();

        // Get content from Quill OR fallback
        let content = '';
        if (this.quill) {
            content = this.quill.root.innerHTML;
        } else if (document.getElementById('fallback-textarea')) {
            content = document.getElementById('fallback-textarea').value;
        }

        const id = document.getElementById('postId').value;

        // Use FormData for multipart/form-data support (File Upload)
        const formData = new FormData();
        formData.append('title', document.getElementById('postTitle').value);
        formData.append('excerpt', document.getElementById('postExcerpt').value);
        formData.append('content', content);
        formData.append('status', document.getElementById('postStatus').value);
        formData.append('image_url', document.getElementById('postImage').value); // Send URL if present

        // Append author if visible
        const authorSelect = document.getElementById('postAuthor');
        const customAuthorInput = document.getElementById('postCustomAuthor');

        if (authorSelect && !authorSelect.offsetParent === false) { // check visibility
            formData.append('author_id', authorSelect.value);
            formData.append('custom_author', customAuthorInput.value);
        } else if (document.getElementById('authorField') && !document.getElementById('authorField').classList.contains('hidden')) {
            formData.append('author_id', authorSelect.value);
            formData.append('custom_author', customAuthorInput.value);
        }

        // Handle Tags array
        const tags = document.getElementById('postTags').value.split(',').map(t => t.trim()).filter(t => t);
        formData.append('tags', JSON.stringify(tags));

        // Handle File
        const fileInput = document.getElementById('postImageFile');
        if (fileInput && fileInput.files.length > 0) {
            formData.append('image', fileInput.files[0]);
        }

        try {
            this.showLoading(true);
            const url = id
                ? `/api/marketing/posts/${id}`
                : '/api/marketing/posts';

            const method = id ? 'PUT' : 'POST';

            // IMPORTANT: do explicitly NOT set Content-Type header when sending FormData
            // The browser will set it to multipart/form-data with the correct boundary
            const response = await authenticatedFetch(url, {
                method,
                // headers: { 'Content-Type': 'application/json' }, // REMOVED
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.closeModal();
                this.loadPosts();
                alert('Post salvo com sucesso!');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao salvar:', error);
            alert('Erro ao salvar post: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    async deletePost(id) {
        if (!confirm('Tem certeza que deseja excluir este post?')) return;

        try {
            this.showLoading(true);
            const response = await authenticatedFetch(`/api/marketing/posts/${id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                this.loadPosts();
                alert('Post excluído com sucesso!');
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Erro ao deletar:', error);
            alert('Erro ao excluir post: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    },

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            if (show) overlay.classList.remove('hidden');
            else overlay.classList.add('hidden');
        }
    }
};

// Expose to window for inline HTML calls
window.BlogManager = BlogManager;
