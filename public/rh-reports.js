// RH Reports Module

const reportsTemplate = `
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Employee Report -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div class="flex items-center gap-4 mb-6">
                <div class="p-3 bg-blue-50 rounded-lg text-blue-600">
                    <i class="fas fa-users text-xl"></i>
                </div>
                <div>
                    <h3 class="font-bold text-gray-800">Relatório de Funcionários</h3>
                    <p class="text-sm text-gray-500">Lista completa com dados cadastrais</p>
                </div>
            </div>
            
            <div class="space-y-4">
                <div>
                    <label class="form-label">Status</label>
                    <select id="reportEmpStatus" class="form-input">
                        <option value="">Todos</option>
                        <option value="ACTIVE">Ativos</option>
                        <option value="INACTIVE">Inativos</option>
                    </select>
                </div>
                <div>
                    <label class="form-label">Departamento</label>
                    <select id="reportEmpDept" class="form-input">
                        <option value="">Todos</option>
                        <option value="TI">TI</option>
                        <option value="RH">RH</option>
                        <option value="Vendas">Vendas</option>
                    </select>
                </div>
                <button onclick="generateEmployeeReport()" class="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2">
                    <i class="fas fa-download"></i>
                    Baixar Relatório
                </button>
            </div>
        </div>

        <!-- Payroll Report -->
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <div class="flex items-center gap-4 mb-6">
                <div class="p-3 bg-green-50 rounded-lg text-green-600">
                    <i class="fas fa-file-invoice-dollar text-xl"></i>
                </div>
                <div>
                    <h3 class="font-bold text-gray-800">Relatório de Folha</h3>
                    <p class="text-sm text-gray-500">Consolidado de pagamentos</p>
                </div>
            </div>
            
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="form-label">Mês</label>
                        <select id="reportPayrollMonth" class="form-input">
                            <option value="">Todos</option>
                            <option value="1">Janeiro</option>
                            <option value="2">Fevereiro</option>
                            <option value="3">Março</option>
                            <option value="4">Abril</option>
                            <option value="5">Maio</option>
                            <option value="6">Junho</option>
                            <option value="7">Julho</option>
                            <option value="8">Agosto</option>
                            <option value="9">Setembro</option>
                            <option value="10">Outubro</option>
                            <option value="11">Novembro</option>
                            <option value="12">Dezembro</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Ano</label>
                        <input type="number" id="reportPayrollYear" value="2025" class="form-input">
                    </div>
                </div>
                <button onclick="generatePayrollReport()" class="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2">
                    <i class="fas fa-download"></i>
                    Baixar Relatório
                </button>
            </div>
        </div>
    </div>
`;

window.loadReports = function () {
    const container = document.getElementById('reports-tab');
    if (!container.innerHTML.includes('Relatório de Funcionários')) {
        container.innerHTML = reportsTemplate;
    }
};

window.generateEmployeeReport = async function () {
    window.showLoading();
    try {
        const status = document.getElementById('reportEmpStatus').value;
        const department = document.getElementById('reportEmpDept').value;

        const params = new URLSearchParams({ status, department });
        const response = await window.authenticatedFetch(`/api/rh/reports/employees?${params}`);

        if (!response.ok) throw new Error('Erro ao gerar relatório');

        const data = await response.json();
        downloadJSON(data, 'relatorio_funcionarios.json');

    } catch (error) {
        console.error(error);
        alert('Erro ao gerar relatório');
    } finally {
        window.hideLoading();
    }
};

window.generatePayrollReport = async function () {
    window.showLoading();
    try {
        const month = document.getElementById('reportPayrollMonth').value;
        const year = document.getElementById('reportPayrollYear').value;

        const params = new URLSearchParams({ month, year });
        const response = await window.authenticatedFetch(`/api/rh/reports/payroll?${params}`);

        if (!response.ok) throw new Error('Erro ao gerar relatório');

        const data = await response.json();
        downloadJSON(data, 'relatorio_folha.json');

    } catch (error) {
        console.error(error);
        alert('Erro ao gerar relatório');
    } finally {
        window.hideLoading();
    }
};

function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}
