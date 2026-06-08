const BlogManager = {
    posts: [],
    currentPage: 1,
    limit: 12,
    isLoading: false,
    quill: null,
    sourceMode: false,

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


    // Detecta HTML "rico" que o Quill estripa ao normalizar:
    //   • <figure> (galeria)
    //   • <table>  (tabelas comparativas)
    //   • <aside>  (Leia também inline, blocos auxiliares)
    //   • <ul>/<ol>  (listas — Quill mangle quando <li> contém <a> ou emoji)
    //   • classes article-/blog-  (article-cta, blog-tabela-wrapper, etc.)
    // Quando QUALQUER um aparece, o modal abre DIRETO no Modo HTML —
    // nunca passa pelo innerHTML do Quill.
    COMPLEX_HTML_RE: /<(figure|table|aside|ul|ol)\b|class\s*=\s*"[^"]*(?:article-|blog-)/i,

    hasComplexHtml(html) {
        return this.COMPLEX_HTML_RE.test(String(html || ''));
    },

    /**
     * Coloca o editor em Modo HTML diretamente, com um HTML inicial fornecido.
     * Usado pelo openModal quando detecta conteúdo rico — evita o caminho
     * `quill.root.innerHTML = …` que sanitiza/perde tags.
     */
    enterSourceMode(initialHtml) {
        const editor = document.getElementById('editor-container');
        const source = document.getElementById('postContentSource');
        const label  = document.getElementById('toggleSourceLabel');
        if (!editor || !source) return;
        source.value = initialHtml != null
            ? initialHtml
            : (this.quill ? this.quill.root.innerHTML
                          : (document.getElementById('fallback-textarea')?.value || ''));
        editor.classList.add('hidden');
        source.classList.remove('hidden');
        if (label) label.textContent = 'Modo Editor';
        this.sourceMode = true;
    },

    /**
     * Alterna entre o editor visual (Quill) e o modo HTML cru (textarea).
     */
    toggleSourceMode() {
        const editor = document.getElementById('editor-container');
        const source = document.getElementById('postContentSource');
        const label  = document.getElementById('toggleSourceLabel');
        if (!editor || !source) return;

        if (!this.sourceMode) {
            this.enterSourceMode();
        } else {
            // Voltar para Quill — AVISA se o source tem blocos que Quill vai estripar
            const sourceHtml = source.value || '';
            if (this.hasComplexHtml(sourceHtml)) {
                const ok = confirm(
                    'Atenção: o conteúdo contém <figure>, <table>, <aside>, <ul>/<ol> ou classes custom ' +
                    '(article-/blog-) que o Modo Editor (Quill) vai estripar.\n\n' +
                    'Recomendo manter no Modo HTML.\n\nContinuar mesmo assim?'
                );
                if (!ok) return;
            }
            if (this.quill) this.quill.root.innerHTML = sourceHtml;
            editor.classList.remove('hidden');
            source.classList.add('hidden');
            if (label) label.textContent = 'Modo HTML';
            this.sourceMode = false;
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
        document.getElementById('btnToggleSource')?.addEventListener('click', () => this.toggleSourceMode());

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

        // Cropper (modal + botão de recortar)
        this.initCropper();

        // Galeria — upload de imagem para a galeria do post atual
        document.getElementById('galleryUploadInput')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            const postId = document.getElementById('postId').value;
            if (!file) return;
            if (!postId) {
                alert('Salve o post primeiro antes de subir imagens da galeria.');
                e.target.value = '';
                return;
            }
            this.uploadGalleryFile(postId, file);
            e.target.value = '';
        });
    },

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        // Clear URL input usage to evitar duplicidade no submit
        document.getElementById('postImage').value = '';

        // Abre direto o cropper com o arquivo escolhido. O usuário ajusta
        // o enquadramento (16:9 por padrão) e, ao aplicar, o blob recortado
        // substitui o arquivo no input — depois o submit envia o cropped.
        const reader = new FileReader();
        reader.onload = (ev) => {
            this.openCropper(ev.target.result);
        };
        reader.readAsDataURL(file);
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
                        <i class="far fa-calendar"></i> ${new Date(post.published_at || post.created_at).toLocaleDateString('pt-PT')}
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

        // Reset source mode (sempre abre em modo editor)
        if (this.sourceMode) this.toggleSourceMode();
        const srcArea = document.getElementById('postContentSource');
        if (srcArea) srcArea.value = '';

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
            document.getElementById('postSubtitle').value = post.subtitle || '';
            document.getElementById('postSlug').value = post.slug || '';
            document.getElementById('postExcerpt').value = post.excerpt || '';
            document.getElementById('postImageCaption').value = post.image_caption || '';
            document.getElementById('postImageObjectPosition').value = post.image_object_position || '';

            // v1.8.2: se o content tem blocos ricos (figure/table/aside ou
            // classes article-*/blog-*), abre DIRETO no Modo HTML — sem deixar
            // Quill sanitizar via innerHTML. Caso contrário, fluxo normal.
            const _content = post.content || '';
            if (this.hasComplexHtml(_content)) {
                this.enterSourceMode(_content);
            } else if (this.quill) {
                this.quill.root.innerHTML = _content;
            } else if (document.getElementById('fallback-textarea')) {
                document.getElementById('fallback-textarea').value = _content;
            }

            document.getElementById('postStatus').value = post.status;
            // Data de publicação — yyyy-mm-dd, com max = hoje
            const dateInput = document.getElementById('postPublishedAt');
            const todayStr = new Date().toISOString().slice(0, 10);
            dateInput.max = todayStr;
            dateInput.value = post.published_at ? new Date(post.published_at).toISOString().slice(0, 10) : todayStr;

            if (isAdmin && post.author_id) {
                document.getElementById('postAuthor').value = post.author_id;
            }
            if (isAdmin) {
                document.getElementById('postCustomAuthor').value = post.custom_author || '';
            }

            document.getElementById('postImage').value = post.image_url || '';
            document.getElementById('postTags').value = (post.tags || []).join(', ');
            this.updateImagePreview(post.image_url || '');

            // Galeria + Related Posts (edit-mode)
            this.loadGallery(post.id);
            this.renderRelatedSelector(post.id, post.related_post_ids || []);
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

            // Data de publicação — default hoje, sem futuro permitido
            const dateInput = document.getElementById('postPublishedAt');
            const todayStr = new Date().toISOString().slice(0, 10);
            dateInput.max = todayStr;
            dateInput.value = todayStr;

            // For new post, if admin, default to current user if possible or first in list
            // This logic is now handled by the loadAuthors function and the default selection of the select element.
            // For new post
            if (isAdmin) {
                document.getElementById('postCustomAuthor').value = '';
            }

            // Galeria + Related Posts (new-mode — galeria desabilitada até salvar)
            this.loadGallery(null);
            this.renderRelatedSelector(null, []);
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

        // Content vem do editor ATIVO no momento (source mode tem prioridade)
        let content = '';
        if (this.sourceMode) {
            content = document.getElementById('postContentSource').value;
        } else if (this.quill) {
            content = this.quill.root.innerHTML;
        } else if (document.getElementById('fallback-textarea')) {
            content = document.getElementById('fallback-textarea').value;
        }

        const id = document.getElementById('postId').value;

        // Use FormData for multipart/form-data support (File Upload)
        const formData = new FormData();
        formData.append('title', document.getElementById('postTitle').value);
        formData.append('subtitle', document.getElementById('postSubtitle').value);
        formData.append('slug', document.getElementById('postSlug').value);
        formData.append('excerpt', document.getElementById('postExcerpt').value);
        formData.append('content', content);
        formData.append('status', document.getElementById('postStatus').value);
        formData.append('image_url', document.getElementById('postImage').value); // Send URL if present
        formData.append('image_caption', document.getElementById('postImageCaption').value);
        formData.append('image_object_position', document.getElementById('postImageObjectPosition').value);

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

        // Related posts (v1.8) — array de UUIDs como string JSON
        formData.append('related_post_ids', JSON.stringify([...this.selectedRelatedIds]));

        // Data de publicação (v1.8.1) — sempre enviada; backend valida não-futuro
        const pubDate = document.getElementById('postPublishedAt')?.value;
        if (pubDate) formData.append('published_at', pubDate);

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
    },

    // =====================================================
    // CROPPER (imagem de capa)
    // =====================================================
    cropper: null,
    cropperRatios: { '16/9': 16/9, '4/3': 4/3, '1/1': 1, 'free': NaN },

    initCropper() {
        if (this._cropperBound) return;
        this._cropperBound = true;

        document.getElementById('btnCropperClose')?.addEventListener('click', () => this.closeCropper());
        document.getElementById('btnCropperCancel')?.addEventListener('click', () => this.closeCropper());
        document.getElementById('btnCropperApply')?.addEventListener('click', () => this.applyCrop());
        document.getElementById('btnRecrop')?.addEventListener('click', (e) => {
            e.preventDefault();
            const url = document.getElementById('postImage').value
                     || (document.getElementById('imagePreview').style.backgroundImage || '').replace(/^url\(["']?|["']?\)$/g, '');
            if (url) this.openCropper(url);
        });
        document.querySelectorAll('.cropper-ar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ar = this.cropperRatios[btn.dataset.ar];
                if (this.cropper) this.cropper.setAspectRatio(ar);
                document.querySelectorAll('.cropper-ar-btn').forEach(b => {
                    b.classList.remove('bg-pink-600','text-white');
                    b.classList.add('bg-gray-100','text-gray-700');
                });
                btn.classList.add('bg-pink-600','text-white');
                btn.classList.remove('bg-gray-100','text-gray-700');
            });
        });
    },

    openCropper(srcUrl) {
        const modal = document.getElementById('cropperModal');
        const img   = document.getElementById('cropperImage');
        if (!modal || !img) return;
        img.src = srcUrl;
        modal.classList.remove('hidden');
        if (this.cropper) { try { this.cropper.destroy(); } catch (_) {} this.cropper = null; }
        this.cropper = new Cropper(img, {
            aspectRatio: 16/9,
            viewMode: 1,
            autoCropArea: 0.95,
            background: false
        });
    },

    closeCropper() {
        if (this.cropper) { try { this.cropper.destroy(); } catch (_) {} this.cropper = null; }
        document.getElementById('cropperModal')?.classList.add('hidden');
    },

    applyCrop() {
        if (!this.cropper) return;
        this.cropper.getCroppedCanvas({ maxWidth: 1600, imageSmoothingQuality: 'high' })
            .toBlob((blob) => {
                if (!blob) return;
                const fileName = 'cover-' + Date.now() + '.jpg';
                const file = new File([blob], fileName, { type: 'image/jpeg' });
                try {
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    document.getElementById('postImageFile').files = dt.files;
                } catch (e) {
                    console.warn('DataTransfer não suportado — usando blob URL como preview', e);
                }
                const reader = new FileReader();
                reader.onload = (ev) => this.updateImagePreview(ev.target.result);
                reader.readAsDataURL(blob);
                this.closeCropper();
            }, 'image/jpeg', 0.92);
    },

    // =====================================================
    // GALERIA DE IMAGENS DO POST
    // =====================================================
    async loadGallery(postId) {
        const list = document.getElementById('galleryList');
        const hint = document.getElementById('galleryHint');
        if (!list) return;

        if (!postId) {
            list.innerHTML = '';
            hint?.classList.remove('hidden');
            return;
        }
        hint?.classList.add('hidden');

        try {
            const r = await authenticatedFetch(`/api/marketing/post-images/${postId}`);
            const data = await r.json();
            this.renderGallery(postId, data.data || []);
        } catch (err) {
            console.error('Erro ao carregar galeria:', err);
            list.innerHTML = '<p class="text-xs text-red-600 col-span-full">Falha ao carregar galeria.</p>';
        }
    },

    renderGallery(postId, images) {
        const list = document.getElementById('galleryList');
        if (!list) return;
        if (!images.length) {
            list.innerHTML = '<p class="text-xs text-gray-400 italic col-span-full">Galeria vazia. Clique em "Subir imagem" acima.</p>';
            return;
        }
        list.innerHTML = images.map((img, i) => `
            <div class="relative group border border-gray-200 rounded-lg overflow-hidden bg-gray-50">
                <img src="${escapeHtml(img.url)}" alt="${escapeHtml(img.alt || '')}" class="w-full h-32 object-cover">
                <div class="p-2 space-y-1">
                    <input type="text" data-gallery-alt="${img.id}" value="${escapeHtml(img.alt || '')}"
                        placeholder="Texto alternativo (alt)" class="w-full text-[11px] px-1.5 py-1 border border-gray-200 rounded">
                    <input type="text" data-gallery-caption="${img.id}" value="${escapeHtml(img.caption || '')}"
                        placeholder="Legenda (italic)" class="w-full text-[11px] px-1.5 py-1 border border-gray-200 rounded">
                    <div class="flex gap-1">
                        <button type="button" data-gallery-insert="${img.id}"
                            class="flex-1 text-[10px] bg-pink-100 hover:bg-pink-200 text-pink-700 px-1.5 py-1 rounded font-semibold flex items-center justify-center gap-1">
                            <i class="fas fa-plus text-[9px]"></i> Inserir
                        </button>
                        <button type="button" data-gallery-delete="${img.id}"
                            class="text-[10px] bg-red-50 hover:bg-red-100 text-red-700 px-1.5 py-1 rounded">
                            <i class="fas fa-trash text-[9px]"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        // Wire actions
        list.querySelectorAll('[data-gallery-insert]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id  = btn.dataset.galleryInsert;
                const img = images.find(x => x.id === id);
                const alt = list.querySelector(`[data-gallery-alt="${id}"]`)?.value || img.alt || '';
                const cap = list.querySelector(`[data-gallery-caption="${id}"]`)?.value || img.caption || '';
                this.insertFigureIntoContent(img.url, alt, cap);
                // Salva alt/caption no DB também (best-effort, idempotente)
                this.updateGalleryMeta(postId, id, { alt, caption: cap });
            });
        });
        list.querySelectorAll('[data-gallery-delete]').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('Apagar essa imagem da galeria?')) return;
                const id = btn.dataset.galleryDelete;
                await authenticatedFetch(`/api/marketing/post-images/${postId}/${id}`, { method: 'DELETE' });
                this.loadGallery(postId);
            });
        });
    },

    async updateGalleryMeta(postId, imageId, patch) {
        try {
            await authenticatedFetch(`/api/marketing/post-images/${postId}/${imageId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch)
            });
        } catch (_) {}
    },

    async uploadGalleryFile(postId, file) {
        const fd = new FormData();
        fd.append('image', file);
        try {
            this.showLoading(true);
            const r = await authenticatedFetch(`/api/marketing/post-images/${postId}`, { method: 'POST', body: fd });
            const data = await r.json();
            if (!data.success) throw new Error(data.error || 'Falha no upload');
            this.loadGallery(postId);
        } catch (err) {
            alert('Erro ao subir imagem: ' + err.message);
        } finally {
            this.showLoading(false);
        }
    },

    insertFigureIntoContent(url, alt, caption) {
        // Garante modo HTML (raw textarea) — Quill striparia <figure>
        if (!this.sourceMode) this.toggleSourceMode();
        const ta = document.getElementById('postContentSource');
        if (!ta) return;
        const snippet = `\n<figure>\n  <img src="${url}" alt="${escapeHtml(alt || '')}" loading="lazy" decoding="async" />\n  ${caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''}\n</figure>\n`;
        // Insere na posição do cursor (ou no final)
        const start = ta.selectionStart ?? ta.value.length;
        const end   = ta.selectionEnd   ?? ta.value.length;
        ta.value = ta.value.slice(0, start) + snippet + ta.value.slice(end);
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + snippet.length;
    },

    // =====================================================
    // POSTS RELACIONADOS ("Leia também")
    // =====================================================
    selectedRelatedIds: new Set(),

    renderRelatedSelector(currentPostId, selectedIds = []) {
        this.selectedRelatedIds = new Set(selectedIds);
        const list = document.getElementById('relatedList');
        const search = document.getElementById('relatedSearch');
        if (!list) return;

        const all = (this.posts || []).filter(p => p.id !== currentPostId);
        const renderList = (term = '') => {
            const t = (term || '').toLowerCase().trim();
            const filtered = t ? all.filter(p => (p.title || '').toLowerCase().includes(t)) : all;
            list.innerHTML = filtered.map(p => {
                const checked = this.selectedRelatedIds.has(p.id) ? 'checked' : '';
                return `
                <label class="flex items-start gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" data-related-id="${p.id}" ${checked}
                        class="mt-0.5 rounded text-pink-600 focus:ring-pink-500">
                    <div class="flex-1 min-w-0">
                        <p class="text-sm text-gray-800 truncate">${escapeHtml(p.title || '(sem título)')}</p>
                        <p class="text-[11px] text-gray-500">${p.status === 'published' ? '🟢 Publicado' : '⚪ Rascunho'}${p.slug ? ' · /' + escapeHtml(p.slug) : ''}</p>
                    </div>
                </label>`;
            }).join('') || '<p class="text-xs text-gray-400 italic px-3 py-3">Nenhum post encontrado.</p>';

            list.querySelectorAll('[data-related-id]').forEach(cb => {
                cb.addEventListener('change', () => {
                    const id = cb.dataset.relatedId;
                    if (cb.checked) this.selectedRelatedIds.add(id);
                    else this.selectedRelatedIds.delete(id);
                    document.getElementById('relatedCount').textContent = this.selectedRelatedIds.size;
                });
            });
        };

        renderList();
        document.getElementById('relatedCount').textContent = this.selectedRelatedIds.size;
        search.oninput = (e) => renderList(e.target.value);
    }
};

// Helper global (já existe versão na inventory; aqui usamos a local pra
// não depender de _layout.js que não é carregado em /marketing.html)
function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Expose to window for inline HTML calls
window.BlogManager = BlogManager;
