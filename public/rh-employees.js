// RH Employees Module

// HTML Template for Employees Tab
const employeesTemplate = `
    <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <!-- Toolbar -->
        <div class="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between gap-4 bg-gray-50">
            <div class="flex gap-2 flex-1">
                <div class="relative flex-1 max-w-md">
                    <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    <input type="text" id="employeeSearch" placeholder="Buscar por nome, email ou NIF..." 
                        class="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500">
                </div>
                <select id="employeeDeptFilter" class="border border-gray-300 rounded-lg px-3 py-2 bg-white">
                    <option value="">Todos Departamentos</option>
                    <option value="TI">TI</option>
                    <option value="RH">RH</option>
                    <option value="Vendas">Vendas</option>
                    <option value="Operações">Operações</option>
                </select>
            </div>
            <button onclick="openEmployeeModal()" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2">
                <i class="fas fa-plus"></i>
                Novo Funcionário
            </button>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
            <table class="w-full rh-table">
                <thead>
                    <tr>
                        <th class="px-6 py-3 text-left">Funcionário</th>
                        <th class="px-6 py-3 text-left">Cargo/Depto</th>
                        <th class="px-6 py-3 text-left">Contato</th>
                        <th class="px-6 py-3 text-left">Status</th>
                        <th class="px-6 py-3 text-left">Admissão</th>
                        <th class="px-6 py-3 text-right">Ações</th>
                    </tr>
                </thead>
                <tbody id="employeesTableBody" class="divide-y divide-gray-200 bg-white">
                    <!-- Rows injected by JS -->
                </tbody>
            </table>
        </div>

        <!-- Pagination -->
        <div class="p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50" id="employeesPagination">
            <!-- Info -->
            <div class="text-sm text-gray-600">
                Mostrando <span class="font-medium text-gray-900" id="paginationStart">0</span> a 
                <span class="font-medium text-gray-900" id="paginationEnd">0</span> de 
                <span class="font-medium text-gray-900" id="paginationTotal">0</span> funcionários
            </div>
            
            <!-- Controls -->
            <div class="flex items-center gap-2" id="paginationControls">
                <!-- Injected by JS -->
            </div>
        </div>
    </div>

    <!-- Employee Modal -->
    <div id="employeeModal" class="fixed inset-0 bg-black bg-opacity-50 z-50 hidden flex items-center justify-center">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] m-4 flex flex-col">
            <!-- Header -->
            <div class="p-6 border-b border-gray-200 flex justify-between items-center bg-white flex-none">
                <h3 class="text-xl font-bold text-gray-800" id="employeeModalTitle">Novo Funcionário</h3>
                <button onclick="closeEmployeeModal()" class="text-gray-400 hover:text-gray-600">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            
            <!-- Tabs -->
            <div class="border-b border-gray-200 px-6 bg-gray-50 flex-none">
                <nav class="-mb-px flex space-x-8 overflow-x-auto" aria-label="Tabs">
                    <button type="button" onclick="switchModalTab('personal')" id="tab-btn-personal" class="modal-tab-btn active whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-purple-500 text-purple-600">
                        Dados Pessoais
                    </button>
                    <button type="button" onclick="switchModalTab('emergency')" id="tab-btn-emergency" class="modal-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">
                        Emergência
                    </button>
                    <button type="button" onclick="switchModalTab('professional')" id="tab-btn-professional" class="modal-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">
                        Profissional
                    </button>
                    <button type="button" onclick="switchModalTab('payroll')" id="tab-btn-payroll" class="modal-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">
                        Financeiro
                    </button>
                    <button type="button" onclick="switchModalTab('documents')" id="tab-btn-documents" class="modal-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">
                        Documentos
                    </button>
                    <button type="button" onclick="switchModalTab('access')" id="tab-btn-access" class="modal-tab-btn whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300">
                        Acessos
                    </button>
                </nav>
            </div>
            
            <form id="employeeForm" onsubmit="handleEmployeeSubmit(event)" class="flex-1 overflow-y-auto p-6" novalidate>
                <input type="hidden" id="employeeId">
                
                <!-- 1. DADOS PESSOAIS -->
                <div id="tab-content-personal" class="tab-content-panel space-y-6">
                    <!-- Foto do Funcionário -->
                    <div class="col-span-2 flex justify-center mb-6">
                        <div class="relative group">
                            <div class="w-32 h-32 rounded-full overflow-hidden border-4 border-gray-100 shadow-lg bg-gray-100 flex items-center justify-center">
                                <img id="employeePhotoPreview" src="" alt="Foto do Funcionário" class="w-full h-full object-cover hidden">
                                <i id="employeePhotoPlaceholder" class="fas fa-user text-4xl text-gray-300"></i>
                            </div>
                            <label for="employeePhotoInput" class="absolute bottom-0 right-0 bg-purple-600 text-white p-2 rounded-full cursor-pointer shadow-md hover:bg-purple-700 transition-colors">
                                <i class="fas fa-camera text-sm"></i>
                            </label>
                            <input type="file" id="employeePhotoInput" accept="image/*" class="hidden" onchange="handlePhotoPreview(event)">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="col-span-2">
                            <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Identificação</h4>
                        </div>
                        
                        <div>
                            <label class="form-label">Nome Completo *</label>
                            <input type="text" name="name" required class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">Data de Nascimento</label>
                            <input type="date" name="birth_date" class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">Nacionalidade</label>
                            <select name="nationality" class="form-input">
                                <option value="Portuguesa">Portuguesa</option>
                                <option value="Brasileira">Brasileira</option>
                                <option value="Angolana">Angolana</option>
                                <option value="Moçambicana">Moçambicana</option>
                                <option value="Cabo-Verdiana">Cabo-Verdiana</option>
                                <option value="Outra">Outra</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="form-label">Estado Civil</label>
                            <select name="marital_status" class="form-input">
                                <option value="">Selecione...</option>
                                <option value="Solteiro(a)">Solteiro(a)</option>
                                <option value="Casado(a)">Casado(a)</option>
                                <option value="Divorciado(a)">Divorciado(a)</option>
                                <option value="Viúvo(a)">Viúvo(a)</option>
                                <option value="União de Facto">União de Facto</option>
                            </select>
                        </div>
                        
                        <div class="col-span-2">
                            <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 mt-2">Documentos de Identificação</h4>
                        </div>
                        
                        <div>
                            <label class="form-label">Tipo de Documento</label>
                            <select name="id_document_type" class="form-input">
                                <option value="CC">Cartão de Cidadão</option>
                                <option value="BI">Bilhete de Identidade</option>
                                <option value="Passaporte">Passaporte</option>
                                <option value="Autorização de Residência">Autorização de Residência</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="form-label">Número do Documento</label>
                            <input type="text" name="id_document_number" class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">NIF *</label>
                            <input type="text" name="nif" required class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">NISS (Segurança Social)</label>
                            <input type="text" name="niss" class="form-input">
                        </div>
                        
                        <div class="col-span-2">
                            <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 mt-2">Contactos</h4>
                        </div>
                        
                        <div>
                            <label class="form-label">Email Pessoal</label>
                            <input type="email" name="personal_email" class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">Telemóvel</label>
                            <input type="tel" name="mobile" class="form-input">
                        </div>
                        
                        <div class="col-span-2">
                            <label class="form-label">Morada Completa</label>
                            <textarea name="address" rows="2" class="form-input"></textarea>
                        </div>
                    </div>
                </div>
                
                <!-- 1.5 EMERGÊNCIA -->
                <div id="tab-content-emergency" class="tab-content-panel hidden space-y-6">
                    <div class="flex justify-between items-center mb-4">
                        <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider">Contactos de Emergência</h4>
                        <button type="button" onclick="addEmergencyContact()" class="text-sm text-purple-600 hover:text-purple-800 font-medium">
                            <i class="fas fa-plus mr-1"></i> Adicionar Contacto
                        </button>
                    </div>
                    
                    <div id="emergencyContactsList" class="space-y-4">
                        <!-- Dynamic list -->
                        <div class="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                            Nenhum contacto adicionado. Clique em "Adicionar Contacto".
                        </div>
                    </div>
                </div>
                
                <!-- 2. DADOS PROFISSIONAIS -->
                <div id="tab-content-professional" class="tab-content-panel hidden space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="form-label">Departamento *</label>
                            <select name="department" required class="form-input">
                                <option value="">Selecione...</option>
                                <option value="TI">TI</option>
                                <option value="RH">RH</option>
                                <option value="Vendas">Vendas</option>
                                <option value="Operações">Operações</option>
                                <option value="Financeiro">Financeiro</option>
                                <option value="Administração">Administração</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="form-label">Cargo / Função *</label>
                            <input type="text" name="role" required class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">Categoria Profissional</label>
                            <input type="text" name="professional_category" class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">Número de Colaborador</label>
                            <input type="text" name="employee_number" class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">Tipo de Contrato</label>
                            <select name="contract_type" class="form-input">
                                <option value="">Selecione...</option>
                                <option value="Sem Termo">Sem Termo (Efetivo)</option>
                                <option value="Termo Certo">Termo Certo</option>
                                <option value="Termo Incerto">Termo Incerto</option>
                                <option value="Prestação de Serviços">Prestação de Serviços</option>
                                <option value="Estágio">Estágio</option>
                            </select>
                        </div>
                        
                        <div>
                            <label class="form-label">Data de Admissão</label>
                            <input type="date" name="hire_date" class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">Horário de Trabalho</label>
                            <div class="grid grid-cols-2 gap-2">
                                <select name="work_schedule_start" class="form-input">
                                    <option value="">Entrada</option>
                                    ${generateTimeOptions()}
                                </select>
                                <select name="work_schedule_end" class="form-input">
                                    <option value="">Saída</option>
                                    ${generateTimeOptions()}
                                </select>
                            </div>
                        </div>
                        
                        <div>
                            <label class="form-label">Local de Trabalho</label>
                            <input type="text" name="work_location" value="Porto – Instituto AreLuna" class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">Supervisor Direto</label>
                            <select name="supervisor_id" id="supervisorSelect" class="form-input">
                                <option value="">Nenhum</option>
                                <!-- Populated by JS -->
                            </select>
                        </div>
                        
                        <div>
                            <label class="form-label">Status</label>
                            <select name="status" class="form-input">
                                <option value="ACTIVE">Ativo</option>
                                <option value="VACATION">Férias</option>
                                <option value="LEAVE">Licença</option>
                                <option value="INACTIVE">Inativo</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- 3. FINANCEIRO / FOLHA DE PAGAMENTO -->
                <div id="tab-content-payroll" class="tab-content-panel hidden space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="col-span-2 flex justify-between items-center mb-4">
                            <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider">Dados Bancários</h4>
                            <div class="flex bg-gray-100 rounded-lg p-1">
                                <button type="button" onclick="toggleBankingRegion('PT')" id="btn-region-pt" class="px-3 py-1 text-sm font-medium rounded-md transition-all shadow-sm bg-white text-gray-800">
                                    🇪🇺 Europa
                                </button>
                                <button type="button" onclick="toggleBankingRegion('BR')" id="btn-region-br" class="px-3 py-1 text-sm font-medium rounded-md transition-all text-gray-500 hover:text-gray-700">
                                    🇧🇷 Brasil
                                </button>
                            </div>
                            <input type="hidden" name="bank_country" id="bank_country" value="PT">
                        </div>
                        
                        <div class="col-span-2" id="field-iban-container">
                            <label class="form-label">IBAN</label>
                            <input type="text" name="iban" placeholder="PT50..." class="form-input font-mono">
                        </div>

                        <!-- Brazilian Fields -->
                        <div class="hidden col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6" id="field-br-container">
                            <div>
                                <label class="form-label">Agência</label>
                                <input type="text" name="bank_agency" class="form-input">
                            </div>
                            <div>
                                <label class="form-label">Conta Corrente</label>
                                <input type="text" name="bank_account_number" class="form-input">
                            </div>
                            <div class="col-span-2">
                                <label class="form-label">Chave PIX</label>
                                <div class="flex gap-2">
                                    <select name="pix_key_type" class="form-input w-1/3">
                                        <option value="cpf">CPF/CNPJ</option>
                                        <option value="email">Email</option>
                                        <option value="phone">Telefone</option>
                                        <option value="random">Chave Aleatória</option>
                                    </select>
                                    <input type="text" name="pix_key" class="form-input w-2/3">
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-span-2">
                            <label class="form-label">Nome do Banco</label>
                            <input type="text" name="bank_name" class="form-input">
                        </div>
                        
                        <div class="col-span-2 flex justify-between items-center mb-4 mt-2">
                            <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider">Remuneração</h4>
                            <div class="flex bg-gray-100 rounded-lg p-1">
                                <button type="button" onclick="toggleSalaryCurrency('EUR')" id="btn-currency-eur" class="px-3 py-1 text-sm font-medium rounded-md transition-all shadow-sm bg-white text-gray-800">
                                    🇪🇺 Euro (€)
                                </button>
                                <button type="button" onclick="toggleSalaryCurrency('BRL')" id="btn-currency-brl" class="px-3 py-1 text-sm font-medium rounded-md transition-all text-gray-500 hover:text-gray-700">
                                    🇧🇷 Real (R$)
                                </button>
                            </div>
                            <input type="hidden" name="salary_currency" id="salary_currency" value="EUR">
                        </div>
                        
                        <div>
                            <label class="form-label" id="label-base-salary">Salário Base (€)</label>
                            <input type="number" name="base_salary" step="0.01" class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label" id="label-variable-compensation">Remuneração Variável (€)</label>
                            <input type="number" name="variable_compensation" step="0.01" class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">Subsídio Alimentação (€/dia)</label>
                            <input type="number" name="meal_allowance" step="0.01" class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label" id="label-allowances">Outros Subsídios (€)</label>
                            <input type="number" name="allowances" step="0.01" class="form-input">
                        </div>
                        
                        <div class="col-span-2">
                            <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 mt-2">Dados Fiscais</h4>
                        </div>
                        
                        <div>
                            <label class="form-label">Dependentes (IRS)</label>
                            <input type="number" name="tax_dependents" min="0" class="form-input">
                        </div>
                        
                        <div>
                            <label class="form-label">Tabela de Retenção</label>
                            <select name="tax_withholding_option" class="form-input">
                                <option value="nao_casado">Não Casado</option>
                                <option value="casado_unico_titular">Casado - Único Titular</option>
                                <option value="casado_dois_titulares">Casado - Dois Titulares</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <!-- 4. DOCUMENTOS -->
                <div id="tab-content-documents" class="tab-content-panel hidden space-y-6">
                    <div class="bg-blue-50 p-4 rounded-lg text-blue-700 text-sm mb-4">
                        <i class="fas fa-info-circle mr-2"></i>
                        A gestão completa de documentos deve ser feita após a criação do funcionário.
                    </div>
                    
                    <div class="space-y-4">
                        <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider">Checklist de Documentos Obrigatórios</h4>
                        
                        <div class="space-y-2" id="documentsChecklist">
                            <!-- Injected by JS -->
                            <div class="flex items-center gap-2 text-gray-500">
                                <i class="far fa-square"></i> Cartão de Cidadão / Passaporte
                            </div>
                            <div class="flex items-center gap-2 text-gray-500">
                                <i class="far fa-square"></i> Comprovativo de Morada
                            </div>
                            <div class="flex items-center gap-2 text-gray-500">
                                <i class="far fa-square"></i> Comprovativo de IBAN
                            </div>
                            <div class="flex items-center gap-2 text-gray-500">
                                <i class="far fa-square"></i> NIF
                            </div>
                            <div class="flex items-center gap-2 text-gray-500">
                                <i class="far fa-square"></i> NISS
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- 5. ACESSOS E CORPORATIVO -->
                <div id="tab-content-access" class="tab-content-panel hidden space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="col-span-2">
                            <label class="form-label">Email Corporativo</label>
                            <input type="email" name="corporate_email" class="form-input">
                        </div>
                        
                        <div class="col-span-2">
                            <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Acesso ao Sistema</h4>
                            <div class="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                <p class="text-sm text-gray-600 mb-3">Selecione os módulos que este funcionário poderá acessar:</p>
                                <div id="modulesList" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div class="text-center py-4 text-gray-500">
                                        <i class="fas fa-spinner fa-spin mr-2"></i> Carregando módulos...
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-span-2">
                            <h4 class="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 mt-2">Recursos Físicos</h4>
                        </div>
                        
                        <div>
                            <label class="form-label">Tamanho de Uniforme</label>
                            <select name="uniform_size" class="form-input">
                                <option value="">N/A</option>
                                <option value="XS">XS</option>
                                <option value="S">S</option>
                                <option value="M">M</option>
                                <option value="L">L</option>
                                <option value="XL">XL</option>
                                <option value="XXL">XXL</option>
                            </select>
                        </div>
                        
                        <div class="flex flex-col gap-2 pt-6">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="has_access_card" class="rounded text-purple-600 focus:ring-purple-500">
                                <span class="text-gray-700">Possui Cartão de Acesso/Ponto</span>
                            </label>
                            
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="has_keys" class="rounded text-purple-600 focus:ring-purple-500">
                                <span class="text-gray-700">Possui Chaves</span>
                            </label>
                            
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" name="show_in_orgchart" class="rounded text-purple-600 focus:ring-purple-500" checked>
                                <span class="text-gray-700">Exibir no Organograma</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div class="pt-6 border-t border-gray-200 flex justify-end gap-3 mt-6">
                    <button type="button" onclick="closeEmployeeModal()" class="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
                        Cancelar
                    </button>
                    <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                        Salvar Funcionário
                    </button>
                </div>
            </form>
        </div>
    </div>
`;

// Pagination State
let currentPage = 1;
let itemsPerPage = 15;
let totalEmployees = 0;
let allEmployees = [];

// Initialize Module
window.loadEmployees = async function () {
    const container = document.getElementById('employees-tab');
    if (!container.innerHTML.includes('employeesTableBody')) {
        container.innerHTML = employeesTemplate;

        // Setup Search Listeners
        document.getElementById('employeeSearch').addEventListener('input', debounce(() => {
            currentPage = 1; // Reset to first page on search
            loadEmployeesList();
        }, 500));
        document.getElementById('employeeDeptFilter').addEventListener('change', () => {
            currentPage = 1; // Reset to first page on filter
            loadEmployeesList();
        });
    }

    await loadEmployeesList();
};

// Load List
async function loadEmployeesList() {
    window.showLoading();
    try {
        const search = document.getElementById('employeeSearch').value;
        const department = document.getElementById('employeeDeptFilter').value;

        const params = new URLSearchParams({ search, department });
        const response = await window.authenticatedFetch(`/api/rh/employees?${params}`);

        if (!response.ok) throw new Error('Erro ao carregar funcionários');

        const { data } = await response.json();

        // Store all employees for pagination
        allEmployees = data;
        totalEmployees = data.length;

        // Render current page
        renderCurrentPage();

    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao carregar lista de funcionários');
    } finally {
        window.hideLoading();
    }
}

// Render Current Page
function renderCurrentPage() {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageEmployees = allEmployees.slice(startIndex, endIndex);

    renderEmployeesTable(pageEmployees);
    renderPaginationControls();
}

// Render Table
function renderEmployeesTable(employees) {
    const tbody = document.getElementById('employeesTableBody');
    tbody.innerHTML = employees.map(emp => `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-6 py-4">
                <div class="flex items-center">
                    <div class="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold mr-3 overflow-hidden">
                        ${emp.avatar_url
            ? `<img src="${emp.avatar_url}" alt="${emp.name}" class="h-full w-full object-cover">`
            : emp.name.substring(0, 2).toUpperCase()
        }
                    </div>
                    <div>
                        <div class="font-medium text-gray-900">${emp.name}</div>
                        <div class="text-sm text-gray-500">${emp.email}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-sm text-gray-900">${emp.role}</div>
                <div class="text-xs text-gray-500">${emp.department}</div>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                <div>${emp.mobile || '-'}</div>
                <div class="text-xs">NIF: ${emp.nif}</div>
            </td>
            <td class="px-6 py-4">
                <span class="badge ${getStatusBadgeClass(emp.status)}">
                    ${getStatusLabel(emp.status)}
                </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                ${new Date(emp.hire_date).toLocaleDateString('pt-PT')}
            </td>
            <td class="px-6 py-4 text-right text-sm font-medium">
                <button onclick="editEmployee('${emp.id}')" class="text-purple-600 hover:text-purple-900 mr-3">
                    <i class="fas fa-edit"></i>
                </button>
            </td>
        </tr>
    `).join('');

    if (employees.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Nenhum funcionário encontrado</td></tr>`;
    }
}

// Render Pagination Controls
function renderPaginationControls() {
    const totalPages = Math.ceil(totalEmployees / itemsPerPage);
    const startItem = totalEmployees === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalEmployees);

    // Update info
    document.getElementById('paginationStart').textContent = startItem;
    document.getElementById('paginationEnd').textContent = endItem;
    document.getElementById('paginationTotal').textContent = totalEmployees;

    // Build controls
    const controls = document.getElementById('paginationControls');

    if (totalPages <= 1) {
        controls.innerHTML = '';
        return;
    }

    let html = '';

    // First button
    html += `
        <button onclick="goToPage(1)" ${currentPage === 1 ? 'disabled' : ''} 
            class="px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                   ${currentPage === 1
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
            title="Primeira página">
            <i class="fas fa-angle-double-left"></i>
        </button>
    `;

    // Previous button
    html += `
        <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}
            class="px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                   ${currentPage === 1
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
            title="Página anterior">
            <i class="fas fa-angle-left"></i>
        </button>
    `;

    // Page numbers
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust start if we're near the end
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    // Add ellipsis at start if needed
    if (startPage > 1) {
        html += `
            <button onclick="goToPage(1)" 
                class="px-3 py-2 text-sm font-medium rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 transition-colors">
                1
            </button>
        `;
        if (startPage > 2) {
            html += `<span class="px-2 text-gray-500">...</span>`;
        }
    }

    // Page number buttons
    for (let i = startPage; i <= endPage; i++) {
        html += `
            <button onclick="goToPage(${i})" 
                class="px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                       ${i === currentPage
                ? 'bg-purple-600 text-white border-purple-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}">
                ${i}
            </button>
        `;
    }

    // Add ellipsis at end if needed
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="px-2 text-gray-500">...</span>`;
        }
        html += `
            <button onclick="goToPage(${totalPages})" 
                class="px-3 py-2 text-sm font-medium rounded-lg border bg-white text-gray-700 border-gray-300 hover:bg-gray-50 transition-colors">
                ${totalPages}
            </button>
        `;
    }

    // Next button
    html += `
        <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}
            class="px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                   ${currentPage === totalPages
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
            title="Próxima página">
            <i class="fas fa-angle-right"></i>
        </button>
    `;

    // Last button
    html += `
        <button onclick="goToPage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}
            class="px-3 py-2 text-sm font-medium rounded-lg border transition-colors
                   ${currentPage === totalPages
            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}"
            title="Última página">
            <i class="fas fa-angle-double-right"></i>
        </button>
    `;

    controls.innerHTML = html;
}

// Navigate to specific page
window.goToPage = function (page) {
    const totalPages = Math.ceil(totalEmployees / itemsPerPage);
    if (page < 1 || page > totalPages) return;

    currentPage = page;
    renderCurrentPage();

    // Scroll to top of table
    document.getElementById('employeesTableBody').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Modal Functions
window.openEmployeeModal = async function (employee = null) {
    const modal = document.getElementById('employeeModal');
    const form = document.getElementById('employeeForm');
    const title = document.getElementById('employeeModalTitle');

    form.reset();
    document.getElementById('employeeId').value = '';

    // Reset photo preview
    const preview = document.getElementById('employeePhotoPreview');
    const placeholder = document.getElementById('employeePhotoPlaceholder');
    if (preview && placeholder) {
        preview.src = '';
        preview.classList.add('hidden');
        placeholder.classList.remove('hidden');
    }

    // Reset tabs
    if (window.switchModalTab) window.switchModalTab('personal');

    // Reset Emergency Contacts List
    const ecList = document.getElementById('emergencyContactsList');
    if (ecList) {
        ecList.innerHTML = '<div class="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">Nenhum contacto adicionado. Clique em "Adicionar Contacto".</div>';
    }

    // Carregar dependências
    await Promise.all([
        loadAvailableModules(),
        window.loadSupervisors ? window.loadSupervisors() : Promise.resolve()
    ]);

    if (employee) {
        title.textContent = 'Editar Funcionário';
        document.getElementById('employeeId').value = employee.id;

        // Load photo
        if (employee.avatar_url) {
            const preview = document.getElementById('employeePhotoPreview');
            const placeholder = document.getElementById('employeePhotoPlaceholder');
            if (preview && placeholder) {
                preview.src = employee.avatar_url;
                preview.classList.remove('hidden');
                placeholder.classList.add('hidden');
            }
        }

        // Mapeamento de campos diretos
        const fields = [
            'name', 'email', 'nif', 'mobile', 'address', 'department', 'role', 'status',
            'birth_date', 'nationality', 'marital_status', 'id_document_type', 'id_document_number', 'niss', 'personal_email',
            'professional_category', 'employee_number', 'contract_type', 'work_location', 'supervisor_id',
            'corporate_email', 'uniform_size'
        ];

        fields.forEach(field => {
            if (form[field] && employee[field]) {
                if (field === 'birth_date' || field === 'hire_date') {
                    form[field].value = employee[field].split('T')[0];
                } else {
                    form[field].value = employee[field];
                }
            }
        });

        if (employee.hire_date) form.hire_date.value = employee.hire_date.split('T')[0];

        // Handle Work Schedule Split
        if (employee.work_schedule) {
            const parts = employee.work_schedule.split(' - ');
            if (parts.length === 2) {
                if (form.work_schedule_start) form.work_schedule_start.value = parts[0].trim();
                if (form.work_schedule_end) form.work_schedule_end.value = parts[1].trim();
            }
        }

        // Checkboxes booleanos
        if (form.has_access_card) form.has_access_card.checked = employee.has_access_card;
        if (form.has_keys) form.has_keys.checked = employee.has_keys;
        if (form.show_in_orgchart) form.show_in_orgchart.checked = employee.show_in_orgchart !== false; // Default true

        // Preencher salário base (pode vir de rh_employees ou payroll)
        if (employee.salary_base) {
            form.base_salary.value = employee.salary_base;
        }

        // Marcar módulos
        if (employee.modules && Array.isArray(employee.modules)) {
            employee.modules.forEach(moduleCode => {
                const checkbox = form.querySelector(`input[name="modules"][value="${moduleCode}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }

        // Preencher Contactos de Emergência
        if (employee.emergency_contacts && Array.isArray(employee.emergency_contacts) && employee.emergency_contacts.length > 0) {
            if (ecList) ecList.innerHTML = ''; // Limpar mensagem de vazio
            employee.emergency_contacts.forEach(contact => {
                if (window.addEmergencyContact) window.addEmergencyContact(contact);
            });
        }

        // Preencher Dados de Folha de Pagamento
        if (employee.payroll) {
            const p = employee.payroll;
            if (form.iban) form.iban.value = p.iban || '';
            if (form.bank_name) form.bank_name.value = p.bank_name || '';
            if (form.base_salary) form.base_salary.value = p.base_salary || form.base_salary.value; // Prioridade ao payroll
            if (form.variable_compensation) form.variable_compensation.value = p.variable_compensation || '';
            if (form.allowances) form.allowances.value = p.allowances || '';
            if (form.meal_allowance) form.meal_allowance.value = p.meal_allowance || '';
            if (form.tax_dependents) form.tax_dependents.value = p.tax_dependents || 0;
            if (form.tax_withholding_option) form.tax_withholding_option.value = p.tax_withholding_option || '';

            // Banking Data
            const country = p.bank_country || 'PT';
            toggleBankingRegion(country);

            if (country === 'PT') {
                if (form.iban) form.iban.value = p.iban || '';
            } else {
                if (form.bank_agency) form.bank_agency.value = p.bank_agency || '';
                if (form.bank_account_number) form.bank_account_number.value = p.bank_account_number || '';
                if (form.pix_key) form.pix_key.value = p.pix_key || '';
                if (form.pix_key_type) form.pix_key_type.value = p.pix_key_type || 'cpf';
            }

            // Salary Currency
            const currency = p.salary_currency || 'EUR';
            if (window.toggleSalaryCurrency) window.toggleSalaryCurrency(currency);
        } else {
            toggleBankingRegion('PT'); // Default to PT if no payroll data
            if (window.toggleSalaryCurrency) window.toggleSalaryCurrency('EUR'); // Default to EUR
        }

    } else {
        title.textContent = 'Novo Funcionário';
        form.status.value = 'ACTIVE';
        form.nationality.value = 'Portuguesa'; // Default
        toggleBankingRegion('PT');
    }

    modal.classList.remove('hidden');
};

async function loadAvailableModules() {
    const modulesList = document.getElementById('modulesList');
    try {
        // Usar /api/modules para obter TODOS os módulos (Admin precisa ver todos para atribuir)
        const response = await window.authenticatedFetch('/api/modules');

        let modules = [];
        if (response.ok) {
            const data = await response.json();
            // A resposta pode ser { modules: [...] } ou diretamente [...]
            modules = data.modules || data;

            // Filtrar apenas módulos ativos (mesmo que em desenvolvimento)
            modules = modules.filter(m => m.is_active);
        } else {
            // Fallback se falhar
            console.warn('Falha ao carregar módulos, usando lista estática de fallback');
            modules = [
                { id: 'inventory', name: 'Inventário', code: 'inventory' },
                { id: 'HR', name: 'Recursos Humanos', code: 'HR' },
                { id: 'rh_employee', name: 'RH - Colaborador', code: 'rh_employee' },
                { id: 'crm', name: 'CRM', code: 'crm' },
                { id: 'financial', name: 'Financeiro', code: 'financial' }
            ];
        }

        modulesList.innerHTML = modules.map(mod => `
            <label class="flex items-center p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                <input type="checkbox" name="modules" value="${mod.id}" class="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500">
                <span class="ml-3 text-sm font-medium text-gray-700">${mod.name}</span>
                ${mod.in_development ? '<span class="ml-2 text-xs text-orange-600">(Em Desenvolvimento)</span>' : ''}
            </label>
        `).join('');

    } catch (error) {
        console.error('Erro ao carregar módulos:', error);
        modulesList.innerHTML = '<div class="text-red-500 text-sm">Erro ao carregar módulos.</div>';
    }
}

window.closeEmployeeModal = function () {
    document.getElementById('employeeModal').classList.add('hidden');
};

window.editEmployee = async function (id) {
    window.showLoading();
    try {
        const response = await window.authenticatedFetch(`/api/rh/employees/${id}`);
        if (!response.ok) throw new Error('Erro ao buscar funcionário');
        const employee = await response.json();
        window.openEmployeeModal(employee);
    } catch (error) {
        console.error(error);
        alert('Erro ao carregar dados do funcionário');
    } finally {
        window.hideLoading();
    }
};

window.handleEmployeeSubmit = async function (e) {
    e.preventDefault();

    // Manual Validation
    const form = e.target;

    // Required Fields Validation
    const requiredFields = [
        { name: 'name', label: 'Nome Completo', tab: 'personal' },
        { name: 'nif', label: 'NIF', tab: 'personal' },
        { name: 'department', label: 'Departamento', tab: 'professional' },
        { name: 'role', label: 'Cargo / Função', tab: 'professional' }
    ];

    for (const field of requiredFields) {
        const input = form.elements[field.name];
        if (!input || !input.value.trim()) {
            // Switch to tab
            if (window.switchModalTab) {
                window.switchModalTab(field.tab);
            }

            // Show alert
            alert(`O campo ${field.label} é obrigatório.`);

            // Focus field
            if (input) {
                setTimeout(() => input.focus(), 100);
            }

            return; // Stop submission
        }
    }

    window.showLoading();

    const id = document.getElementById('employeeId').value;
    const formData = new FormData(form);
    const rawData = Object.fromEntries(formData.entries());

    // Upload Photo if selected
    const photoInput = document.getElementById('employeePhotoInput');
    let avatarUrl = null;

    if (photoInput && photoInput.files && photoInput.files[0]) {
        const file = photoInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `employees/${fileName}`;

        try {
            // Use authManager.supabase
            const { data: uploadData, error: uploadError } = await window.authManager.supabase.storage
                .from('employee-photos')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = window.authManager.supabase.storage
                .from('employee-photos')
                .getPublicUrl(filePath);

            avatarUrl = publicUrl;
        } catch (error) {
            console.error('Erro ao fazer upload da foto:', error);
            alert('Erro ao fazer upload da foto: ' + error.message);
            window.hideLoading();
            return;
        }
    }

    // Construir objeto estruturado
    const employeeData = {
        // Dados Pessoais
        name: rawData.name,
        email: rawData.email,
        nif: rawData.nif,
        birth_date: rawData.birth_date || null,
        nationality: rawData.nationality,
        marital_status: rawData.marital_status,
        id_document_type: rawData.id_document_type,
        id_document_number: rawData.id_document_number,
        niss: rawData.niss,
        personal_email: rawData.personal_email,
        mobile: rawData.mobile,
        address: rawData.address,

        // Dados Profissionais
        department: rawData.department,
        role: rawData.role,
        professional_category: rawData.professional_category,
        employee_number: rawData.employee_number,
        contract_type: rawData.contract_type,
        hire_date: rawData.hire_date || null,
        hire_date: rawData.hire_date || null,
        work_schedule: (rawData.work_schedule_start && rawData.work_schedule_end)
            ? `${rawData.work_schedule_start} - ${rawData.work_schedule_end}`
            : null,
        work_location: rawData.work_location,
        supervisor_id: rawData.supervisor_id || null,
        status: rawData.status,

        // Dados Corporativos
        corporate_email: rawData.corporate_email,
        uniform_size: rawData.uniform_size,
        has_access_card: form.has_access_card.checked,
        has_keys: form.has_keys.checked,
        show_in_orgchart: form.show_in_orgchart.checked,
        ...(avatarUrl && { avatar_url: avatarUrl }), // Add avatar_url only if new photo uploaded

        // Dados Financeiros (Payroll)
        payroll_data: {
            iban: rawData.iban,
            bank_name: rawData.bank_name,
            base_salary: rawData.base_salary ? parseFloat(rawData.base_salary) : null,
            variable_compensation: rawData.variable_compensation ? parseFloat(rawData.variable_compensation) : 0,
            allowances: rawData.allowances ? parseFloat(rawData.allowances) : 0,
            meal_allowance: rawData.meal_allowance ? parseFloat(rawData.meal_allowance) : 0,
            tax_dependents: rawData.tax_dependents ? parseInt(rawData.tax_dependents) : 0,
            tax_withholding_option: rawData.tax_withholding_option,
            social_security_number: rawData.niss, // Redundância útil
            tax_number: rawData.nif, // Redundância útil

            // Banking
            bank_country: rawData.bank_country,
            bank_agency: rawData.bank_agency,
            bank_account_number: rawData.bank_account_number,
            pix_key: rawData.pix_key,
            pix_key_type: rawData.pix_key_type,

            // Salary Currency
            salary_currency: rawData.salary_currency || 'EUR'
        },

        // Módulos
        modules: Array.from(document.querySelectorAll('input[name="modules"]:checked')).map(cb => cb.value)
    };

    // Coletar Contactos de Emergência
    const emergency_contacts = [];
    document.querySelectorAll('.emergency-contact-item').forEach(item => {
        // Encontrar inputs dentro deste item específico
        // Usamos querySelector com prefixo de name, mas precisamos garantir que pegamos o input certo
        // Como os names têm índices (ec_name_0, ec_name_1), podemos iterar sobre os inputs

        const nameInput = item.querySelector('input[name^="ec_name"]');
        if (nameInput && nameInput.value) {
            emergency_contacts.push({
                name: nameInput.value,
                relationship: item.querySelector('input[name^="ec_relationship"]').value,
                phone: item.querySelector('input[name^="ec_phone"]').value,
                alternative_phone: item.querySelector('input[name^="ec_alt_phone"]').value,
                medical_notes: item.querySelector('input[name^="ec_medical"]').value,
                is_primary: item.querySelector('input[name^="ec_primary"]').checked
            });
        }
    });

    employeeData.emergency_contacts = emergency_contacts;

    try {
        const url = id ? `/api/rh/employees/${id}` : '/api/rh/employees';
        const method = id ? 'PUT' : 'POST';

        const response = await window.authenticatedFetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(employeeData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Erro ao salvar');
        }

        window.closeEmployeeModal();
        await loadEmployeesList();
        alert('Funcionário salvo com sucesso!');

    } catch (error) {
        console.error(error);
        alert(`Erro ao salvar funcionário: ${error.message}`);
    } finally {
        window.hideLoading();
    }
};

// Utils
function getStatusBadgeClass(status) {
    switch (status) {
        case 'ACTIVE': return 'badge-success';
        case 'VACATION': return 'badge-info';
        case 'LEAVE': return 'badge-warning';
        case 'INACTIVE': return 'badge-gray';
        default: return 'badge-gray';
    }
}

function getStatusLabel(status) {
    switch (status) {
        case 'ACTIVE': return 'Ativo';
        case 'VACATION': return 'Férias';
        case 'LEAVE': return 'Licença';
        case 'INACTIVE': return 'Inativo';
        default: return status;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

window.toggleBankingRegion = function (region) {
    const btnPt = document.getElementById('btn-region-pt');
    const btnBr = document.getElementById('btn-region-br');
    const containerPt = document.getElementById('field-iban-container');
    const containerBr = document.getElementById('field-br-container');
    const inputCountry = document.getElementById('bank_country');

    if (!btnPt || !btnBr) return;

    inputCountry.value = region;

    if (region === 'PT') {
        // Activate PT
        btnPt.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
        btnPt.classList.remove('text-gray-500');

        btnBr.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
        btnBr.classList.add('text-gray-500');

        containerPt.classList.remove('hidden');
        containerBr.classList.add('hidden');
        containerBr.classList.remove('grid'); // Remove grid when hidden
    } else {
        // Activate BR
        btnBr.classList.add('bg-white', 'text-gray-800', 'shadow-sm');
        btnBr.classList.remove('text-gray-500');

        btnPt.classList.remove('bg-white', 'text-gray-800', 'shadow-sm');
        btnPt.classList.add('text-gray-500');

        containerPt.classList.add('hidden');
        containerBr.classList.remove('hidden');
        containerBr.classList.add('grid'); // Add grid when visible
    }
};

function generateTimeOptions() {
    let options = '';
    for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0');
        options += `<option value="${hour}:00">${hour}:00</option>`;
        options += `<option value="${hour}:30">${hour}:30</option>`;
    }
    return options;
}

// --- New Helper Functions ---

window.switchModalTab = function (tabId) {
    // Update buttons
    document.querySelectorAll('.modal-tab-btn').forEach(btn => {
        btn.classList.remove('active', 'border-purple-500', 'text-purple-600');
        btn.classList.add('border-transparent', 'text-gray-500');
        if (btn.id === `tab-btn-${tabId}`) {
            btn.classList.add('active', 'border-purple-500', 'text-purple-600');
            btn.classList.remove('border-transparent', 'text-gray-500');
        }
    });

    // Update content
    document.querySelectorAll('.tab-content-panel').forEach(panel => {
        panel.classList.add('hidden');
        if (panel.id === `tab-content-${tabId}`) {
            panel.classList.remove('hidden');
        }
    });
};

window.loadSupervisors = async function () {
    const select = document.getElementById('supervisorSelect');
    if (!select) return;

    try {
        const response = await window.authenticatedFetch('/api/rh/employees?status=ACTIVE');
        if (response.ok) {
            const { data } = await response.json();
            const currentId = document.getElementById('employeeId').value;

            select.innerHTML = '<option value="">Nenhum</option>' +
                data
                    .filter(emp => emp.id !== currentId) // Avoid self-selection
                    .map(emp => `<option value="${emp.id}">${emp.name} (${emp.role})</option>`)
                    .join('');
        }
    } catch (error) {
        console.error('Erro ao carregar supervisores:', error);
    }
};

window.addEmergencyContact = function (contact = null) {
    const list = document.getElementById('emergencyContactsList');

    // Remove "empty" message if it exists
    if (list.children.length === 1 && list.children[0].classList.contains('text-center')) {
        list.innerHTML = '';
    }

    const index = list.children.length;
    const div = document.createElement('div');
    div.className = 'bg-gray-50 p-4 rounded-lg border border-gray-200 relative emergency-contact-item';
    div.innerHTML = `
        <button type="button" onclick="this.closest('.emergency-contact-item').remove()" class="absolute top-2 right-2 text-gray-400 hover:text-red-500">
            <i class="fas fa-trash"></i>
        </button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label class="form-label text-xs">Nome *</label>
                <input type="text" name="ec_name_${index}" value="${contact?.name || ''}" required class="form-input text-sm">
            </div>
            <div>
                <label class="form-label text-xs">Parentesco *</label>
                <input type="text" name="ec_relationship_${index}" value="${contact?.relationship || ''}" required class="form-input text-sm">
            </div>
            <div>
                <label class="form-label text-xs">Telefone *</label>
                <input type="tel" name="ec_phone_${index}" value="${contact?.phone || ''}" required class="form-input text-sm">
            </div>
            <div>
                <label class="form-label text-xs">Telefone Alternativo</label>
                <input type="tel" name="ec_alt_phone_${index}" value="${contact?.alternative_phone || ''}" class="form-input text-sm">
            </div>
            <div class="col-span-2">
                <label class="form-label text-xs">Observações Médicas</label>
                <input type="text" name="ec_medical_${index}" value="${contact?.medical_notes || ''}" class="form-input text-sm">
            </div>
            <div class="col-span-2">
                <label class="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="ec_primary_${index}" ${contact?.is_primary ? 'checked' : ''} class="rounded text-purple-600 focus:ring-purple-500">
                    <span class="text-sm text-gray-700">Contacto Principal</span>
                </label>
            </div>
        </div>
    `;
    list.appendChild(div);
};

window.handlePhotoPreview = function (event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById('employeePhotoPreview');
            const placeholder = document.getElementById('employeePhotoPlaceholder');

            preview.src = e.target.result;
            preview.classList.remove('hidden');
            placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
    }
};

// Toggle Salary Currency (EUR/BRL)
window.toggleSalaryCurrency = function (currency) {
    const hiddenInput = document.getElementById('salary_currency');
    const btnEur = document.getElementById('btn-currency-eur');
    const btnBrl = document.getElementById('btn-currency-brl');

    const labelBaseSalary = document.getElementById('label-base-salary');
    const labelVariableComp = document.getElementById('label-variable-compensation');
    const labelAllowances = document.getElementById('label-allowances');

    if (currency === 'EUR') {
        hiddenInput.value = 'EUR';

        // Update button styles
        btnEur.className = 'px-3 py-1 text-sm font-medium rounded-md transition-all shadow-sm bg-white text-gray-800';
        btnBrl.className = 'px-3 py-1 text-sm font-medium rounded-md transition-all text-gray-500 hover:text-gray-700';

        // Update labels
        labelBaseSalary.textContent = 'Salário Base (€)';
        labelVariableComp.textContent = 'Remuneração Variável (€)';
        labelAllowances.textContent = 'Outros Subsídios (€)';
    } else if (currency === 'BRL') {
        hiddenInput.value = 'BRL';

        // Update button styles
        btnBrl.className = 'px-3 py-1 text-sm font-medium rounded-md transition-all shadow-sm bg-white text-gray-800';
        btnEur.className = 'px-3 py-1 text-sm font-medium rounded-md transition-all text-gray-500 hover:text-gray-700';

        // Update labels
        labelBaseSalary.textContent = 'Salário Base (R$)';
        labelVariableComp.textContent = 'Remuneração Variável (R$)';
        labelAllowances.textContent = 'Outros Subsídios (R$)';
    }
};
