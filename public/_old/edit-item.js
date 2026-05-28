// Get item ID from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('id');

// DOM elements
const loadingState = document.getElementById('loadingState');
const errorState = document.getElementById('errorState');
const editForm = document.getElementById('editForm');
const itemForm = document.getElementById('itemForm');
const viewButton = document.getElementById('viewButton');
const successMessage = document.getElementById('successMessage');
const continueEditingBtn = document.getElementById('continueEditingBtn');

let currentItem = null;// Variáveis globais
let categories = [];
let collaborators = [];
let selectedPdfs = []; // Array para armazenar múltiplos PDFs
let existingPdfs = [];
let existingPdfsToRemove = [];

// Initialize Supabase client (usando configurações globais)
const supabase = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey);

// Image and PDF upload functions
function updateImageProgressBar(percent, text) {
    const progressBar = document.getElementById('imageProgressBar');
    const progressText = document.getElementById('imageProgressMessage');
    const progressPercent = document.getElementById('imageProgressText');
    
    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.textContent = text;
    if (progressPercent) progressPercent.textContent = percent + '%';
}

function updateProgressBar(percent, text) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressMessage');
    const progressPercent = document.getElementById('progressText');
    
    if (progressBar) progressBar.style.width = percent + '%';
    if (progressText) progressText.textContent = text;
    if (progressPercent) progressPercent.textContent = percent + '%';
}

function handleImagePreview(event) {
    // Obter o input do evento
    const input = event.target;
    const file = input.files && input.files[0];
    
    if (file) {
        // Validar tamanho do arquivo (máximo 10MB)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            alert(`A imagem é muito grande (${(file.size / 1024 / 1024).toFixed(2)}MB). O tamanho máximo permitido é 10MB. Por favor, selecione uma imagem menor.`);
            input.value = ''; // Limpar seleção
            return;
        }
        
        // Obter elementos DOM
        const progressDiv = document.getElementById('imageUploadProgress');
        const preview = document.getElementById('imagePreview');
        const buttonText = document.getElementById('imageButtonText');
        const previewImg = document.getElementById('previewImg');
        const imageFileName = document.getElementById('imageFileName');
        
        // Esconder preview e mostrar progresso
        if (preview) preview.classList.add('hidden');
        if (progressDiv) progressDiv.classList.remove('hidden');
        if (buttonText) buttonText.textContent = 'Processando...';
        
        // Simular progresso de carregamento
        updateImageProgressBar(0, 'Arquivo selecionado...');
        
        setTimeout(() => {
            updateImageProgressBar(30, 'Validando imagem...');
            
            setTimeout(() => {
                updateImageProgressBar(60, 'Processando imagem...');
                
                setTimeout(() => {
                    updateImageProgressBar(100, 'Pronto para upload!');
                    
                    // Após completar o progresso, mostrar o preview
                    setTimeout(() => {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            if (previewImg) previewImg.src = e.target.result;
                            if (imageFileName) imageFileName.textContent = file.name;
                            if (preview) preview.classList.remove('hidden');
                            if (progressDiv) progressDiv.classList.add('hidden');
                            if (buttonText) buttonText.textContent = file.name;
                        };
                        reader.onerror = function() {
                            console.error('Erro ao ler arquivo');
                            if (progressDiv) progressDiv.classList.add('hidden');
                            if (buttonText) buttonText.textContent = 'Selecionar Imagem';
                            alert('Erro ao carregar a imagem. Por favor, tente novamente.');
                        };
                        reader.readAsDataURL(file);
                    }, 500);
                }, 800);
            }, 600);
        }, 400);
    } else {
        // Se não há arquivo, limpar preview
        const preview = document.getElementById('imagePreview');
        const buttonText = document.getElementById('imageButtonText');
        if (preview) preview.classList.add('hidden');
        if (buttonText) buttonText.textContent = 'Selecionar Imagem';
    }
}

function handlePdfPreview(event) {
    const input = event.target;
    const files = Array.from(input.files);
    
    if (files.length > 0) {
        // Adicionar novos PDFs ao array
        files.forEach(file => {
            if (file.type === 'application/pdf') {
                selectedPdfs.push(file);
            }
        });
        
        // Atualizar a exibição dos PDFs
        updatePdfPreviews();
        
        // Limpar o input para permitir selecionar os mesmos arquivos novamente
        input.value = '';
    }
}

function updatePdfPreviews() {
    const container = document.getElementById('pdfPreviewsContainer');
    container.innerHTML = '';
    
    selectedPdfs.forEach((file, index) => {
        const pdfPreview = document.createElement('div');
        pdfPreview.className = 'p-4 bg-gray-50 dark:bg-gray-700 rounded-lg';
        pdfPreview.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
                    <i class="fas fa-file-pdf mr-1"></i>
                    Documento ${index + 1}
                </span>
                <button type="button" data-pdf-index="${index}" class="remove-pdf-btn text-red-600 hover:text-red-700 text-sm">
                    <i class="fas fa-times mr-1"></i>
                    Remover
                </button>
            </div>
            <div class="flex items-center space-x-3 p-3 bg-white dark:bg-gray-600 rounded-lg">
                <div class="flex-shrink-0">
                    <i class="fas fa-file-pdf text-red-600 text-2xl"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium text-gray-900 dark:text-white truncate">${file.name}</p>
                    <p class="text-sm text-gray-500 dark:text-gray-400">Documento PDF</p>
                </div>
            </div>
        `;
        container.appendChild(pdfPreview);
    });
}

function removePdf(index) {
    selectedPdfs.splice(index, 1);
    updatePdfPreviews();
}

function displayExistingPdfs(pdfs) {
    if (!pdfs || pdfs.length === 0) return;
    
    const container = document.getElementById('pdfPreviewsContainer');
    if (!container) return;
    
    pdfs.forEach((pdfUrl, index) => {
        const fileName = pdfUrl.split('/').pop() || `documento_${index + 1}.pdf`;
        
        const pdfPreview = document.createElement('div');
        pdfPreview.className = 'relative bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4';
        pdfPreview.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                    <div class="flex-shrink-0">
                        <i class="fas fa-file-pdf text-red-500 text-2xl"></i>
                    </div>
                    <div>
                        <p class="text-sm font-medium text-gray-900 dark:text-white">${fileName}</p>
                        <p class="text-sm text-gray-500 dark:text-gray-400">Documento PDF Existente</p>
                    </div>
                </div>
                <button type="button" data-pdf-url="${pdfUrl}" class="remove-existing-pdf-btn text-red-500 hover:text-red-700">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        container.appendChild(pdfPreview);
    });
}

function removeExistingPdf(pdfUrl) {
    existingPdfsToRemove.push(pdfUrl);
    // Remover o elemento da interface
    const container = document.getElementById('pdfPreviewsContainer');
    const pdfElements = container.querySelectorAll('div');
    pdfElements.forEach(element => {
        if (element.innerHTML.includes(pdfUrl)) {
            element.remove();
        }
    });
}

// Load categories and collaborators
async function loadDropdownData() {
    try {
        const [categoriesResponse, collaboratorsResponse] = await Promise.all([
            authenticatedFetch('/api/categories'),
            authenticatedFetch('/api/collaborators')
        ]);

        const categoriesData = await categoriesResponse.json();
        const collaboratorsData = await collaboratorsResponse.json();

        if (categoriesData.success) {
            categories = categoriesData.data;
            populateCategoriesDropdown();
        }

        if (collaboratorsData.success) {
            collaborators = collaboratorsData.data;
            populateCollaboratorsDropdown();
        }
    } catch (error) {
        console.error('Erro ao carregar dados dos dropdowns:', error);
    }
}

function populateCategoriesDropdown() {
    const select = document.getElementById('itemCategory');
    select.innerHTML = '<option value="">Selecione uma categoria</option>';
    
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.id;
        option.textContent = category.nome;
        select.appendChild(option);
    });

    // Add "Create new" option
    const createOption = document.createElement('option');
    createOption.value = 'create_new';
    createOption.textContent = '+ Criar nova categoria';
    createOption.style.fontStyle = 'italic';
    createOption.style.color = '#3B82F6';
    select.appendChild(createOption);
}

function populateCollaboratorsDropdown() {
    const select = document.getElementById('itemCollaborator');
    select.innerHTML = '<option value="">Selecione um colaborador</option>';
    
    collaborators.forEach(collaborator => {
        const option = document.createElement('option');
        option.value = collaborator.id;
        option.textContent = collaborator.nome;
        select.appendChild(option);
    });

    // Add "Create new" option
    const createOption = document.createElement('option');
    createOption.value = 'create_new';
    createOption.textContent = '+ Criar novo colaborador';
    createOption.style.fontStyle = 'italic';
    createOption.style.color = '#3B82F6';
    select.appendChild(createOption);
}

// Handle dropdown changes
document.getElementById('itemCategory').addEventListener('change', function() {
    if (this.value === 'create_new') {
        document.getElementById('categoryModal').classList.remove('hidden');
        this.value = ''; // Reset selection
    }
});

document.getElementById('itemCollaborator').addEventListener('change', function() {
    if (this.value === 'create_new') {
        document.getElementById('collaboratorModal').classList.remove('hidden');
        this.value = ''; // Reset selection
    }
});

// Modal handlers
document.getElementById('closeCategoryModal').addEventListener('click', () => {
    document.getElementById('categoryModal').classList.add('hidden');
});

document.getElementById('cancelCategoryBtn').addEventListener('click', () => {
    document.getElementById('categoryModal').classList.add('hidden');
});

document.getElementById('closeCollaboratorModal').addEventListener('click', () => {
    document.getElementById('collaboratorModal').classList.add('hidden');
});

document.getElementById('cancelCollaboratorBtn').addEventListener('click', () => {
    document.getElementById('collaboratorModal').classList.add('hidden');
});

// Category form submission
document.getElementById('categoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const categoryData = {
        nome: formData.get('nome')
    };

    try {
        const response = await authenticatedFetch('/api/categories', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(categoryData)
        });

        const result = await response.json();

        if (result.success) {
            // Add new category to the list
            categories.push(result.data);
            populateCategoriesDropdown();
            
            // Select the new category
            document.getElementById('itemCategory').value = result.data.id;
            
            // Close modal and reset form
            document.getElementById('categoryModal').classList.add('hidden');
            document.getElementById('categoryForm').reset();
        } else {
            alert('Erro ao criar categoria: ' + result.message);
        }
    } catch (error) {
        console.error('Erro ao criar categoria:', error);
        alert('Erro ao criar categoria');
    }
});

// Collaborator form submission
document.getElementById('collaboratorForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const collaboratorData = {
        nome: formData.get('nome'),
        email: formData.get('email'),
        cargo: formData.get('cargo')
    };

    try {
        const response = await authenticatedFetch('/api/collaborators', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(collaboratorData)
        });

        const result = await response.json();

        if (result.success) {
            // Add new collaborator to the list
            collaborators.push(result.data);
            populateCollaboratorsDropdown();
            
            // Select the new collaborator
            document.getElementById('itemCollaborator').value = result.data.id;
            
            // Close modal and reset form
            document.getElementById('collaboratorModal').classList.add('hidden');
            document.getElementById('collaboratorForm').reset();
        } else {
            alert('Erro ao criar colaborador: ' + result.message);
        }
    } catch (error) {
        console.error('Erro ao criar colaborador:', error);
        alert('Erro ao criar colaborador');
    }
});

// Load item data
async function loadItem() {
    if (!itemId) {
        showError('ID do item não fornecido');
        return;
    }

    try {
        const response = await authenticatedFetch(`/api/items/${itemId}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Erro ao carregar item');
        }

        currentItem = data.data;
        populateForm(currentItem);
    } catch (error) {
        console.error('Erro ao carregar item:', error);
        showError('Erro ao carregar item: ' + error.message);
    }
}

function showError(message) {
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    document.getElementById('errorMessage').textContent = message;
}

function populateForm(item) {
    loadingState.classList.add('hidden');
    editForm.classList.remove('hidden');

    // Set title
    document.getElementById('itemTitle').textContent = item.module_data?.name || item.name || 'Item';

    // Set view button link
    viewButton.onclick = () => window.location.href = `view-item.html?id=${item.id}`;

    // Populate form fields
    document.getElementById('itemName').value = item.module_data?.name || item.name || '';
    document.getElementById('itemDescription').value = item.module_data?.description || item.description || '';
    document.getElementById('itemCompany').value = item.module_data?.company || '';
    document.getElementById('itemLocation').value = item.module_data?.location || item.location || '';
    document.getElementById('itemStatus').value = item.module_data?.status || item.status || 'Ativo';
    document.getElementById('itemBrand').value = item.module_data?.brand || '';
    document.getElementById('itemModel').value = item.module_data?.model || '';
    document.getElementById('itemSerial').value = item.module_data?.serial_number || '';
    document.getElementById('itemValue').value = item.module_data?.value || item.unit_price || '';

    // Set category and collaborator - corrigindo para usar os campos corretos
    if (item.categoria_id) {
        document.getElementById('itemCategory').value = item.categoria_id;
    }
    if (item.colaborador_id) {
        document.getElementById('itemCollaborator').value = item.colaborador_id;
    }

    // Handle dates
    if (item.module_data?.purchase_date) {
        document.getElementById('itemPurchaseDate').value = item.module_data.purchase_date.split('T')[0];
    }
    if (item.module_data?.warranty_date) {
        document.getElementById('itemWarrantyDate').value = item.module_data.warranty_date.split('T')[0];
    }

    // Show current image if exists
    if (item.module_data?.image) {
        document.getElementById('currentImageContainer').classList.remove('hidden');
        document.getElementById('currentImage').src = item.module_data.image;
    }

    // Show current PDFs if exists
    if (item.pdfs && Array.isArray(item.pdfs) && item.pdfs.length > 0) {
        displayExistingPdfs(item.pdfs);
    } else if (item.module_data?.pdf) {
        // Backward compatibility for single PDF
        displayExistingPdfs([item.module_data.pdf]);
    }
}

// Event listeners para os botões de seleção de arquivo
document.getElementById('selectImageBtn')?.addEventListener('click', () => {
    document.getElementById('itemImage').click();
});

document.getElementById('selectPdfBtn')?.addEventListener('click', () => {
    document.getElementById('itemPdf').click();
});

// Event listeners para os inputs de arquivo
document.getElementById('itemImage')?.addEventListener('change', handleImagePreview);
document.getElementById('itemPdf')?.addEventListener('change', handlePdfPreview);

// Event listeners para remover arquivos selecionados
document.getElementById('removeImageBtn')?.addEventListener('click', () => {
    const imageInput = document.getElementById('itemImage');
    const imagePreview = document.getElementById('imagePreview');
    const imageButtonText = document.getElementById('imageButtonText');
    
    if (imageInput) imageInput.value = '';
    if (imagePreview) imagePreview.classList.add('hidden');
    if (imageButtonText) imageButtonText.textContent = 'Selecionar Imagem';
});

document.getElementById('removePdfBtn')?.addEventListener('click', () => {
    const pdfInput = document.getElementById('itemPdf');
    const pdfPreview = document.getElementById('pdfPreview');
    const pdfButtonText = document.getElementById('pdfButtonText');
    
    if (pdfInput) pdfInput.value = '';
    if (pdfPreview) pdfPreview.classList.add('hidden');
    if (pdfButtonText) pdfButtonText.textContent = 'Selecionar PDF';
});

// Função para salvar o item
async function saveItem() {
    const formData = new FormData();
    
    // Debug logs
    console.log('saveItem - selectedPdfs:', selectedPdfs);
    console.log('saveItem - existingPdfsToRemove:', existingPdfsToRemove);
    
    // Adicionar dados básicos
    formData.append('name', document.getElementById('itemName').value);
    formData.append('description', document.getElementById('itemDescription').value);
    formData.append('category', document.getElementById('itemCategory').value);
    formData.append('company', document.getElementById('itemCompany').value);
    formData.append('location', document.getElementById('itemLocation').value);
    formData.append('status', document.getElementById('itemStatus').value);
    formData.append('value', document.getElementById('itemValue').value);
    formData.append('brand', document.getElementById('itemBrand').value);
    formData.append('model', document.getElementById('itemModel').value);
    formData.append('serial_number', document.getElementById('itemSerial').value);
    formData.append('purchase_date', document.getElementById('itemPurchaseDate').value);
    formData.append('warranty_date', document.getElementById('itemWarrantyDate').value);
    formData.append('categoria_id', document.getElementById('itemCategory').value);
    formData.append('colaborador_id', document.getElementById('itemCollaborator').value);

    // Adicionar nova imagem se selecionada - fazer upload para Supabase Storage primeiro
    const imageFile = document.getElementById('itemImage')?.files[0];
    console.log('imageFile:', imageFile);
    if (imageFile) {
        // Validar tamanho do arquivo (máximo 10MB para evitar erro 413)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (imageFile.size > maxSize) {
            throw new Error(`A imagem é muito grande (${(imageFile.size / 1024 / 1024).toFixed(2)}MB). O tamanho máximo permitido é 10MB.`);
        }

        // Mostrar progresso do upload da imagem
        const imageUploadProgress = document.getElementById('imageUploadProgress');
        const imagePreview = document.getElementById('imagePreview');
        
        if (imagePreview) imagePreview.classList.add('hidden');
        if (imageUploadProgress) imageUploadProgress.classList.remove('hidden');
        
        updateImageProgressBar(0, 'Iniciando upload da imagem...');
        
        // Upload da imagem para o Supabase Storage
        const sanitizedFileName = imageFile.name
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\w\s.-]/g, '')
            .replace(/\s+/g, '_')
            .toLowerCase();
        
        const imageFileName = `${Date.now()}_${sanitizedFileName}`;
        
        updateImageProgressBar(25, 'Enviando imagem...');
        
        const { data: imageUploadData, error: imageUploadError } = await supabase.storage
            .from('item-images')
            .upload(imageFileName, imageFile);
        
        if (imageUploadError) {
            if (imageUploadProgress) imageUploadProgress.classList.add('hidden');
            if (imagePreview) imagePreview.classList.remove('hidden');
            throw new Error('Erro ao fazer upload da imagem: ' + imageUploadError.message);
        }
        
        updateImageProgressBar(75, 'Upload da imagem concluído!');
        
        // Adicionar o caminho da imagem ao FormData
        formData.append('image_path', imageFileName);
        
        updateImageProgressBar(100, 'Processando imagem...');
        
        // Esconder barra de progresso após um momento
        setTimeout(() => {
            if (imageUploadProgress) imageUploadProgress.classList.add('hidden');
        }, 1000);

        console.log('formData:', formData.image_path);
    }

    // Fazer upload dos novos PDFs para o Supabase Storage primeiro
    if (selectedPdfs && selectedPdfs.length > 0) {
        console.log('Fazendo upload de PDFs para Supabase Storage:', selectedPdfs.length);
        
        for (let i = 0; i < selectedPdfs.length; i++) {
            const pdfFile = selectedPdfs[i];
            const sanitizedName = pdfFile.name.replace(/[^a-z0-9_.-]/gi, '_').toLowerCase();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${sanitizedName}`;
            
            console.log(`Uploading PDF ${i + 1}/${selectedPdfs.length}: ${fileName}`);
            
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('item-pdfs')
                .upload(fileName, pdfFile, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: 'application/pdf'
                });
            
            if (uploadError) {
                console.error('Erro no upload do PDF:', uploadError);
                throw new Error(`Erro ao fazer upload do PDF: ${uploadError.message}`);
            }
            
            console.log('PDF uploaded:', uploadData.path);
            formData.append('pdf_paths', uploadData.path);
        }
        
        console.log('Upload de PDFs concluído. Caminhos:', Array.from(formData.getAll('pdf_paths')));
    }

    // Adicionar lista de PDFs para remover se houver
    if (existingPdfsToRemove.length > 0) {
        console.log('PDFs para remover:', existingPdfsToRemove);
        formData.append('removePdfs', JSON.stringify(existingPdfsToRemove));
    }

    try {
        console.log('Enviando FormData para API...');
        const response = await authenticatedFetch(`/api/items/${itemId}`, {
            method: 'PUT',
            body: formData
        });

        // Ler resposta como texto primeiro (só pode ser lido uma vez)
        const responseText = await response.text();
        
        // Verificar se a resposta foi bem-sucedida antes de tentar parsear JSON
        if (!response.ok) {
            // Tentar obter mensagem de erro do response
            let errorMessage = `Erro ${response.status}: ${response.statusText}`;
            
            // Verificar se é erro 413 (Content Too Large)
            if (response.status === 413) {
                errorMessage = 'Arquivo muito grande. O tamanho máximo permitido é 10MB para imagens.';
            } else if (responseText) {
                // Tentar parsear como JSON
                try {
                    const json = JSON.parse(responseText);
                    errorMessage = json.error || json.message || errorMessage;
                    if (json.details) {
                        errorMessage += ` - ${json.details}`;
                    }
                } catch {
                    // Se não for JSON, usar o texto (limitado a 200 caracteres)
                    if (responseText.length < 200) {
                        errorMessage = responseText;
                    }
                }
            }
            
            throw new Error(errorMessage);
        }

        // Se chegou aqui, response.ok é true, então tentar parsear JSON
        let result;
        if (responseText) {
            try {
                result = JSON.parse(responseText);
            } catch (jsonError) {
                console.error('Erro ao parsear JSON:', jsonError, 'Response:', responseText.substring(0, 100));
                throw new Error('Resposta inválida do servidor');
            }
        } else {
            result = { success: true };
        }

        console.log('Resposta da API:', result);

        if (result.success) {
            successMessage.classList.remove('hidden');
        } else {
            throw new Error(result.message || result.error || 'Erro ao salvar item');
        }
    } catch (error) {
        console.error('Erro ao salvar item:', error);
        
        // Esconder progresso em caso de erro
        const imageUploadProgress = document.getElementById('imageUploadProgress');
        const imagePreview = document.getElementById('imagePreview');
        if (imageUploadProgress) imageUploadProgress.classList.add('hidden');
        if (imagePreview && imageFile) imagePreview.classList.remove('hidden');
        
        alert('Erro ao salvar item: ' + error.message);
    }
}

// Handle form submission
itemForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const saveButton = document.getElementById('saveButton');
    const originalText = saveButton.innerHTML;
    saveButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Salvando...';
    saveButton.disabled = true;

    try {
        await saveItem();
    } finally {
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
    }
});

// Handle continue editing
continueEditingBtn.addEventListener('click', () => {
    successMessage.classList.add('hidden');
    // Reload the item to get updated data
    loadItem();
});

// Event delegation para botões de remover PDF e imagem
document.addEventListener('click', function(e) {
    // Botão de remover imagem do preview
    if (e.target.closest('[data-action="remove-image-preview"]')) {
        const imageInput = document.getElementById('itemImage');
        const imagePreview = document.getElementById('imagePreview');
        const imageButtonText = document.getElementById('imageButtonText');
        const imageUploadProgress = document.getElementById('imageUploadProgress');
        
        if (imageInput) imageInput.value = '';
        if (imagePreview) imagePreview.classList.add('hidden');
        if (imageUploadProgress) imageUploadProgress.classList.add('hidden');
        if (imageButtonText) imageButtonText.textContent = 'Selecionar Imagem';
    }
    
    // Botão de remover PDF novo
    if (e.target.closest('.remove-pdf-btn')) {
        const button = e.target.closest('.remove-pdf-btn');
        const index = parseInt(button.getAttribute('data-pdf-index'));
        if (!isNaN(index)) {
            removePdf(index);
        }
    }
    
    // Botão de remover PDF existente
    if (e.target.closest('.remove-existing-pdf-btn')) {
        const button = e.target.closest('.remove-existing-pdf-btn');
        const pdfUrl = button.getAttribute('data-pdf-url');
        if (pdfUrl) {
            removeExistingPdf(pdfUrl);
        }
    }
});

// Initialize
async function init() {
    await loadDropdownData();
    await loadItem();
}

// Aguardar o DOM e o authManager estarem prontos antes de inicializar
document.addEventListener('DOMContentLoaded', async () => {
    // Aguardar o authManager estar pronto
    if (window.authManager) {
        // Aguardar a inicialização completa do authManager
        await window.authManager.init();
        
        // Verificar se está autenticado
        if (!window.authManager.isUserAuthenticated()) {
            console.log('Usuário não autenticado, redirecionando para login');
            window.location.href = 'login.html';
            return;
        }
        
        // Usuário autenticado, inicializar a página
        await init();
    } else {
        console.error('AuthManager não encontrado');
        window.location.href = 'login.html';
    }
});