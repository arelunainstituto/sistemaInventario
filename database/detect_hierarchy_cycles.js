/**
 * Script para detectar ciclos na hierarquia de funcionários
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function detectCycles() {
    console.log('🔍 Verificando ciclos na hierarquia de funcionários...\n');

    // Buscar todos os funcionários
    const { data: employees, error } = await supabase
        .from('rh_employees')
        .select('id, name, supervisor_id')
        .order('name');

    if (error) {
        console.error('❌ Erro ao buscar funcionários:', error);
        return;
    }

    console.log(`📊 Total de funcionários: ${employees.length}\n`);

    // Detectar auto-referências
    const selfReferences = employees.filter(emp => emp.id === emp.supervisor_id);
    if (selfReferences.length > 0) {
        console.log('⚠️  CICLOS DETECTADOS - Auto-referências:');
        selfReferences.forEach(emp => {
            console.log(`   - ${emp.name} (ID: ${emp.id}) é supervisor de si mesmo`);
        });
        console.log('');
    }

    // Detectar ciclos em cadeias
    const detectChainCycle = (empId, visited = new Set(), path = []) => {
        if (visited.has(empId)) {
            return { hasCycle: true, path: [...path, empId] };
        }

        visited.add(empId);
        path.push(empId);

        const emp = employees.find(e => e.id === empId);
        if (emp && emp.supervisor_id && emp.supervisor_id !== emp.id) {
            // Check if supervisor_id points to someone in the current path
            if (path.includes(emp.supervisor_id)) {
                return { hasCycle: true, path: [...path, emp.supervisor_id] };
            }
            return detectChainCycle(emp.supervisor_id, visited, path);
        }

        return { hasCycle: false, path: [] };
    };

    const cycles = [];
    const checked = new Set();

    employees.forEach(emp => {
        if (!checked.has(emp.id) && emp.supervisor_id) {
            const result = detectChainCycle(emp.id);
            if (result.hasCycle) {
                cycles.push({
                    employee: emp,
                    cyclePath: result.path
                });
            }
            checked.add(emp.id);
        }
    });

    if (cycles.length > 0) {
        console.log('⚠️  CICLOS DETECTADOS - Cadeias circulares:');
        cycles.forEach(({ employee, cyclePath }) => {
            const names = cyclePath.map(id => {
                const e = employees.find(emp => emp.id === id);
                return e ? `${e.name} (${id})` : `ID: ${id}`;
            });
            console.log(`   - Ciclo iniciando em ${employee.name}:`);
            console.log(`     ${names.join(' → ')}`);
        });
        console.log('');
    }

    // Verificar supervisores inexistentes
    const invalidSupervisors = employees.filter(emp => {
        if (!emp.supervisor_id) return false;
        return !employees.find(e => e.id === emp.supervisor_id);
    });

    if (invalidSupervisors.length > 0) {
        console.log('⚠️  SUPERVISORES INEXISTENTES:');
        invalidSupervisors.forEach(emp => {
            console.log(`   - ${emp.name} aponta para supervisor ID ${emp.supervisor_id} que não existe`);
        });
        console.log('');
    }

    if (selfReferences.length === 0 && cycles.length === 0 && invalidSupervisors.length === 0) {
        console.log('✅ Nenhum ciclo detectado! A hierarquia está correta.');
    } else {
        console.log('📝 Recomendação: Execute o script de correção para resolver esses problemas.');
    }
}

detectCycles().catch(console.error);
