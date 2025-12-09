// RH Organizational Chart Module
// Uses d3-org-chart

window.loadOrgChart = async function () {
    const container = document.getElementById('orgchart-tab');

    // Clear previous content if needed or just ensure structure
    if (!container.querySelector('#org-chart-viz')) {
        container.innerHTML = `
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-[calc(100vh-140px)] flex flex-col">
                <div class="flex justify-between items-center mb-4">
                    <h3 class="text-lg font-bold text-gray-800">Organograma da Empresa</h3>
                    <div class="flex gap-2">
                        <button onclick="chart.expandAll()" class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700">
                            <i class="fas fa-expand-alt mr-1"></i> Expandir Tudo
                        </button>
                        <button onclick="chart.collapseAll()" class="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded text-gray-700">
                            <i class="fas fa-compress-alt mr-1"></i> Recolher Tudo
                        </button>
                        <button onclick="chart.fit()" class="px-3 py-1 text-sm bg-purple-100 hover:bg-purple-200 rounded text-purple-700">
                            <i class="fas fa-search-plus mr-1"></i> Ajustar Zoom
                        </button>
                        <div class="border-l border-gray-300 mx-2"></div>
                        <button onclick="exportOrgChartAsJPG()" class="px-3 py-1 text-sm bg-blue-100 hover:bg-blue-200 rounded text-blue-700">
                            <i class="fas fa-image mr-1"></i> Exportar JPG
                        </button>
                        <button onclick="exportOrgChartAsPDF()" class="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 rounded text-red-700">
                            <i class="fas fa-file-pdf mr-1"></i> Exportar PDF
                        </button>
                    </div>
                </div>
                <div id="org-chart-viz" class="flex-1 bg-gray-50 rounded-lg overflow-hidden border border-gray-200"></div>
            </div>
        `;
    }

    window.showLoading();
    try {
        // Fetch employees
        const response = await window.authenticatedFetch('/api/rh/employees?limit=1000'); // Get all
        if (!response.ok) throw new Error('Erro ao carregar funcionários');

        const { data } = await response.json();

        if (!data || data.length === 0) {
            document.getElementById('org-chart-viz').innerHTML = '<div class="p-8 text-center text-gray-500">Nenhum funcionário encontrado.</div>';
            return;
        }

        renderOrgChart(data);

    } catch (error) {
        console.error('Erro ao carregar organograma:', error);
        container.innerHTML = `<div class="p-8 text-center text-red-500">Erro ao carregar organograma: ${error.message}</div>`;
    } finally {
        window.hideLoading();
    }
};

let chart;

function renderOrgChart(employees) {
    // Transform data for d3-org-chart
    // It expects a flat array with id and parentId

    // 0. Filter hidden employees
    // If show_in_orgchart is explicitly false, exclude them. Default is true.
    const visibleEmployees = employees.filter(emp => emp.show_in_orgchart !== false);

    // 1. Identify employees without supervisors (potential roots)
    const rootEmployees = visibleEmployees.filter(emp => !emp.supervisor_id);

    let data = visibleEmployees.map(emp => ({
        id: emp.id,
        parentId: emp.supervisor_id || '', // Empty string for root
        name: emp.name,
        role: emp.role,
        department: emp.department,
        imageUrl: emp.avatar_url || null,
        email: emp.email
    }));

    // 1.5. Detect and fix cycles (circular references)
    const detectCycle = (nodeId, visited = new Set(), path = new Set()) => {
        if (path.has(nodeId)) return true; // Cycle detected
        if (visited.has(nodeId)) return false; // Already checked, no cycle

        visited.add(nodeId);
        path.add(nodeId);

        const node = data.find(d => d.id === nodeId);
        if (node && node.parentId && node.parentId !== '') {
            if (detectCycle(node.parentId, visited, path)) return true;
        }

        path.delete(nodeId);
        return false;
    };

    // Remove cycles by breaking the parent link
    data = data.map(emp => {
        if (emp.id === emp.parentId) {
            // Self-reference: remove parent
            console.warn(`Ciclo detectado: ${emp.name} é supervisor de si mesmo. Removendo referência.`);
            return { ...emp, parentId: '' };
        }

        // Check for circular chains
        if (emp.parentId && detectCycle(emp.id)) {
            console.warn(`Ciclo detectado na hierarquia de ${emp.name}. Removendo referência ao supervisor.`);
            return { ...emp, parentId: '' };
        }

        return emp;
    });

    // 2. If multiple roots exist, create a virtual root to connect them
    if (rootEmployees.length > 1) {
        const virtualRootId = 'virtual-root';

        // Add virtual root node
        data.unshift({
            id: virtualRootId,
            parentId: '',
            name: 'Instituto AreLuna',
            role: 'Organização',
            department: '',
            imageUrl: null,
            email: ''
        });

        // Update all root employees to point to virtual root
        data = data.map(emp => {
            if (rootEmployees.find(root => root.id === emp.id)) {
                return { ...emp, parentId: virtualRootId };
            }
            return emp;
        });
    }

    if (!chart) {
        chart = new d3.OrgChart()
            .container('#org-chart-viz')
            .data(data)
            .nodeHeight(d => 85)
            .nodeWidth(d => 220)
            // Configurações para layout hierárquico (não compacto)
            .childrenMargin(d => 80)           // Espaço vertical entre níveis
            .compactMarginBetween(d => 40)     // Espaço entre nós
            .compactMarginPair(d => 80)        // Espaço entre pares
            .neighbourMargin((a, b) => 40)     // Margem entre vizinhos
            .siblingsMargin(d => 40)           // Espaço horizontal entre irmãos
            // IMPORTANTE: Modo compacto DESATIVADO para layout hierárquico
            .compact(false)                    // Layout hierárquico (líderes separados)
            .buttonContent(({ node, state }) => {
                return `<div style="px-1 py-1 rounded-full bg-white border border-gray-300 flex items-center justify-center text-xs text-gray-600 shadow-sm cursor-pointer hover:bg-gray-50">
                    <span style="font-size: 9px">${node.children ? `<i class="fas fa-chevron-up"></i>` : `<i class="fas fa-chevron-down"></i>`}</span>
                    <span style="font-size: 9px; margin-left: 2px"> ${node.data._directSubordinates} </span>
                </div>`;
            })
            .nodeContent(function (d, i, arr, state) {
                const color = '#7e22ce'; // Purple-600
                const initials = d.data.name.substring(0, 2).toUpperCase();
                const imageHtml = d.data.imageUrl
                    ? `<img src="${d.data.imageUrl}" class="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover" />`
                    : `<div class="w-10 h-10 rounded-full bg-purple-100 border-2 border-white shadow-sm flex items-center justify-center text-purple-600 font-bold text-xs">${initials}</div>`;

                return `
                    <div style="font-family: 'Inter', sans-serif; background-color:white; position:absolute;margin-top:-1px; margin-left:-1px;width:${d.width}px;height:${d.height}px;border-radius:10px;border: 1px solid #E4E2E9; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                        <div style="background-color:${color};position:absolute;margin-top:-25px;margin-left:${15}px;border-radius:100px;width:50px;height:50px;" ></div>
                        <div style="position:absolute;margin-top:-20px;margin-left:${20}px;">
                            ${imageHtml}
                        </div>
                        <div style="font-size:15px;color:#08011E;margin-left:20px;margin-top:32px"> ${d.data.name} </div>
                        <div style="color:#716E7B;margin-left:20px;margin-top:3px;font-size:10px;"> ${d.data.role} </div>
                        <div style="color:#716E7B;margin-left:20px;margin-top:3px;font-size:10px; font-weight:bold; color: #9333ea"> ${d.data.department} </div>
                    </div>
                `;
            })
            .render()
            .fit();
    } else {
        chart.data(data).render().fit();
    }
}

// Export Functions

window.exportOrgChartAsJPG = async function () {
    try {
        if (!chart) {
            alert('Organograma não está carregado');
            return;
        }

        window.showLoading();

        // Expand all nodes before export
        chart.expandAll();
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Use d3-org-chart's built-in export with custom options
        chart.exportImg({
            save: false,
            full: true,
            onLoad: (base64) => {
                // Convert PNG to JPG for smaller file size
                const img = new Image();
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;

                    const ctx = canvas.getContext('2d');
                    // White background for JPG
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);

                    // Convert to JPG
                    const jpgData = canvas.toDataURL('image/jpeg', 0.95);

                    // Download
                    const link = document.createElement('a');
                    link.download = `organograma-${new Date().toISOString().split('T')[0]}.jpg`;
                    link.href = jpgData;
                    link.click();

                    window.hideLoading();
                    alert('Organograma exportado como JPG com sucesso!');
                };
                img.src = base64;
            }
        });

    } catch (error) {
        console.error('Erro ao exportar JPG:', error);
        alert('Erro ao exportar organograma como JPG: ' + error.message);
        window.hideLoading();
    }
};

window.exportOrgChartAsPDF = async function () {
    try {
        if (!chart) {
            alert('Organograma não está carregado');
            return;
        }

        window.showLoading();

        // Expand all nodes before export
        chart.expandAll();
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Use d3-org-chart's built-in PDF export
        chart.exportImg({
            save: false,
            full: true,
            onLoad: (base64) => {
                const img = new Image();
                img.onload = function () {
                    try {
                        const { jsPDF } = window.jspdf;

                        // Get image dimensions
                        const imgWidth = img.width;
                        const imgHeight = img.height;

                        // Convert pixels to mm (assuming 96 DPI)
                        const mmWidth = imgWidth * 0.264583;
                        const mmHeight = imgHeight * 0.264583;

                        // Determine orientation
                        const orientation = mmWidth > mmHeight ? 'landscape' : 'portrait';

                        // Create PDF with exact dimensions
                        const pdf = new jsPDF({
                            orientation: orientation,
                            unit: 'mm',
                            format: [mmWidth, mmHeight]
                        });

                        // Add image to fill entire page
                        pdf.addImage(base64, 'PNG', 0, 0, mmWidth, mmHeight);

                        // Save
                        pdf.save(`organograma-${new Date().toISOString().split('T')[0]}.pdf`);

                        window.hideLoading();
                        alert('Organograma exportado como PDF com sucesso!');
                    } catch (pdfError) {
                        console.error('Erro ao criar PDF:', pdfError);
                        alert('Erro ao criar PDF: ' + pdfError.message);
                        window.hideLoading();
                    }
                };
                img.src = base64;
            }
        });

    } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        alert('Erro ao exportar organograma como PDF: ' + error.message);
        window.hideLoading();
    }
};
