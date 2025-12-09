// RH Documents Module

const documentsTemplate = `
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Employee List (Sidebar) -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-[calc(100vh-200px)] flex flex-col">
            <div class="p-4 border-b border-gray-200 bg-gray-50">
                <h3 class="font-bold text-gray-700">Funcionários</h3>
                <input type="text" id="docEmployeeSearch" placeholder="Buscar..." class="mt-2 w-full text-sm border border-gray-300 rounded-lg px-3 py-2">
            </div>
            <div class="overflow-y-auto flex-1 p-2 space-y-1" id="docEmployeeList">
                <!-- List injected by JS -->
            </div>
        </div>

        <!-- Documents Area -->
        <div class="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-[calc(100vh-200px)] flex flex-col">
            <div class="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h3 class="font-bold text-gray-700" id="selectedEmployeeName">Selecione um funcionário</h3>
                <button onclick="openUploadModal()" id="uploadBtn" class="hidden bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm flex items-center gap-2">
                    <i class="fas fa-upload"></i>
                    Upload
                </button>
            </div>
            
            <div class="flex-1 overflow-y-auto p-6" id="documentsContainer">
                <div class="text-center text-gray-500 mt-20">
                    <i class="fas fa-folder-open text-4xl mb-4 text-gray-300"></i>
                    <p>Selecione um funcionário para ver seus documentos</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Upload Modal -->
    <div id="uploadModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md m-4">
            <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 class="text-xl font-bold text-gray-800">Upload de Documento</h3>
                <button onclick="closeUploadModal()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <form id="uploadForm" onsubmit="handleUploadSubmit(event)" class="p-6 space-y-4">
                <input type="hidden" name="employee_id" id="uploadEmployeeId">
                
                <div>
                    <label class="form-label">Arquivo *</label>
                    <input type="file" name="file" required class="form-input">
                </div>

                <div>
                    <label class="form-label">Categoria *</label>
                    <select name="category" required class="form-input">
                        <option value="RG">RG/CC</option>
                        <option value="CPF">NIF</option>
                        <option value="CONTRATO">Contrato</option>
                        <option value="ATESTADO">Atestado</option>
                        <option value="OUTRO">Outro</option>
                    </select>
                </div>

                <div>
                    <label class="form-label">Nome (Opcional)</label>
                    <input type="text" name="name" class="form-input" placeholder="Nome personalizado">
                </div>

                <div>
                    <label class="form-label">Validade (Opcional)</label>
                    <input type="date" name="expiry_date" class="form-input">
                </div>

                <div class="pt-4 border-t border-gray-200 flex justify-end gap-3">
                    <button type="button" onclick="closeUploadModal()" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">Cancelar</button>
                    <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">Enviar</button>
                </div>
            </form>
        </div>
    </div>
`;

let selectedEmployeeId = null;

window.loadDocuments = async function () {
    const container = document.getElementById('documents-tab');
    if (!container.innerHTML.includes('docEmployeeList')) {
        container.innerHTML = documentsTemplate;
        await loadDocEmployees();
    }
};

async function loadDocEmployees() {
    try {
        const response = await window.authenticatedFetch('/api/rh/employees?status=ACTIVE');
        const { data } = await response.json();

        const list = document.getElementById('docEmployeeList');
        list.innerHTML = data.map(emp => `
            <button onclick="selectDocEmployee('${emp.id}', '${emp.name}')" class="w-full text-left px-4 py-3 rounded-lg hover:bg-purple-50 transition-colors flex items-center gap-3 group">
                <div class="h-8 w-8 rounded-full bg-gray-100 group-hover:bg-purple-100 flex items-center justify-center text-gray-600 group-hover:text-purple-600 text-xs font-bold">
                    ${emp.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                    <div class="text-sm font-medium text-gray-700 group-hover:text-purple-700">${emp.name}</div>
                    <div class="text-xs text-gray-500">${emp.role}</div>
                </div>
            </button>
        `).join('');

    } catch (error) {
        console.error(error);
    }
}

window.selectDocEmployee = async function (id, name) {
    selectedEmployeeId = id;
    document.getElementById('selectedEmployeeName').textContent = name;
    document.getElementById('uploadBtn').classList.remove('hidden');
    document.getElementById('uploadEmployeeId').value = id;

    await loadEmployeeDocuments(id);
};

async function loadEmployeeDocuments(id) {
    window.showLoading();
    try {
        const response = await window.authenticatedFetch(`/api/rh/documents/${id}`);
        const data = await response.json();

        const container = document.getElementById('documentsContainer');

        if (data.length === 0) {
            container.innerHTML = `
                <div class="text-center text-gray-500 mt-20">
                    <i class="fas fa-file text-4xl mb-4 text-gray-300"></i>
                    <p>Nenhum documento encontrado</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                ${data.map(doc => `
                    <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow relative group">
                        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button data-doc-id="${doc.id}" class="delete-doc-btn text-red-500 hover:text-red-700 p-1">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                        <div class="flex items-center gap-3 mb-3">
                            <div class="text-purple-600 text-2xl">
                                <i class="fas ${getFileIcon(doc.type)}"></i>
                            </div>
                            <div class="overflow-hidden">
                                <h4 class="font-medium text-gray-800 truncate" title="${doc.name}">${doc.name}</h4>
                                <span class="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">${doc.category}</span>
                            </div>
                        </div>
                        <div class="text-xs text-gray-500 flex justify-between mt-2">
                            <span>${new Date(doc.created_at).toLocaleDateString()}</span>
                            <span>${formatFileSize(doc.size)}</span>
                        </div>
                        <a href="${doc.url}" target="_blank" class="mt-3 block text-center text-sm text-purple-600 hover:text-purple-800 font-medium bg-purple-50 py-1 rounded hover:bg-purple-100 transition-colors">
                            Visualizar
                        </a>
                    </div>
                `).join('')}
            </div>
        `;

        // Use event delegation to avoid duplicate listeners
        // Remove any existing listener first
        const newContainer = container.cloneNode(false);
        newContainer.innerHTML = container.innerHTML;
        container.parentNode.replaceChild(newContainer, container);

        // Add single delegated event listener
        newContainer.addEventListener('click', function (e) {
            const deleteBtn = e.target.closest('.delete-doc-btn');
            if (deleteBtn) {
                const docId = deleteBtn.getAttribute('data-doc-id');
                console.log('Delete button clicked for docId:', docId);
                window.deleteDocument(docId);
            }
        });

    } catch (error) {
        console.error(error);
        alert('Erro ao carregar documentos');
    } finally {
        window.hideLoading();
    }
}

window.openUploadModal = function () {
    document.getElementById('uploadModal').classList.remove('hidden');
};

window.closeUploadModal = function () {
    document.getElementById('uploadModal').classList.add('hidden');
};

window.handleUploadSubmit = async function (e) {
    e.preventDefault();
    window.showLoading();

    const form = e.target;
    const formData = new FormData(form);

    try {
        const response = await window.authenticatedFetch('/api/rh/documents/upload', {
            method: 'POST',
            body: formData // Content-Type is automatic for FormData
        });

        if (!response.ok) throw new Error('Erro no upload');

        window.closeUploadModal();
        await loadEmployeeDocuments(selectedEmployeeId);
        alert('Upload realizado com sucesso!');

    } catch (error) {
        console.error(error);
        alert('Erro ao fazer upload');
    } finally {
        window.hideLoading();
    }
};

window.deleteDocument = async function (id) {
    console.log('deleteDocument called with id:', id);

    // Create custom confirmation modal
    const confirmDelete = await new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center';
        modal.innerHTML = `
            <div class="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4">
                <h3 class="text-xl font-bold text-gray-800 mb-4">Confirmar Exclusão</h3>
                <p class="text-gray-600 mb-6">Tem certeza que deseja excluir este documento? Esta ação não pode ser desfeita.</p>
                <div class="flex gap-3 justify-end">
                    <button id="cancelDeleteBtn" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                        Cancelar
                    </button>
                    <button id="confirmDeleteBtn" class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                        Excluir
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        document.getElementById('confirmDeleteBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve(true);
        };

        document.getElementById('cancelDeleteBtn').onclick = () => {
            document.body.removeChild(modal);
            resolve(false);
        };

        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
                resolve(false);
            }
        };
    });

    if (!confirmDelete) {
        console.log('User cancelled deletion');
        return;
    }

    console.log('User confirmed deletion, proceeding...');
    window.showLoading();

    try {
        console.log('Sending DELETE request to:', `/api/rh/documents/${id}`);
        const response = await window.authenticatedFetch(`/api/rh/documents/${id}`, {
            method: 'DELETE'
        });

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Delete failed with error:', errorText);
            throw new Error('Erro ao excluir');
        }

        console.log('Document deleted successfully, reloading list...');
        await loadEmployeeDocuments(selectedEmployeeId);
        alert('Documento excluído com sucesso!');

    } catch (error) {
        console.error('Error in deleteDocument:', error);
        alert('Erro ao excluir documento: ' + error.message);
    } finally {
        console.log('Hiding loading indicator');
        window.hideLoading();
    }
};

function getFileIcon(mimeType) {
    if (mimeType.includes('pdf')) return 'fa-file-pdf';
    if (mimeType.includes('image')) return 'fa-file-image';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'fa-file-word';
    return 'fa-file';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
