/**
 * Script para corrigir ciclos na hierarquia de funcionários
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixCycles() {
    console.log('🔧 Corrigindo ciclos na hierarquia de funcionários...\n');

    // Buscar todos os funcionários
    const { data: employees, error } = await supabase
        .from('rh_employees')
        .select('id, name, supervisor_id')
        .order('name');

    if (error) {
        console.error('❌ Erro ao buscar funcionários:', error);
        return;
    }

    let fixedCount = 0;

    // Corrigir auto-referências
    for (const emp of employees) {
        if (emp.id === emp.supervisor_id) {
            console.log(`🔧 Corrigindo: ${emp.name} (removendo auto-referência)`);

            const { error: updateError } = await supabase
                .from('rh_employees')
                .update({ supervisor_id: null })
                .eq('id', emp.id);

            if (updateError) {
                console.error(`   ❌ Erro ao atualizar ${emp.name}:`, updateError);
            } else {
                console.log(`   ✅ ${emp.name} agora não tem supervisor (root)`);
                fixedCount++;
            }
        }
    }

    console.log(`\n✅ Correção concluída! ${fixedCount} problema(s) resolvido(s).`);
    console.log('🔄 Recarregue a página do organograma para ver as mudanças.');
}

fixCycles().catch(console.error);
