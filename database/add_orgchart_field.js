// Script para adicionar campo show_in_orgchart
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addShowInOrgchartField() {
    console.log('🔄 Adicionando campo show_in_orgchart...\n');

    try {
        // Executar SQL para adicionar campo
        const { data, error } = await supabase.rpc('exec_sql', {
            sql_query: `
                ALTER TABLE rh_employees
                ADD COLUMN IF NOT EXISTS show_in_orgchart BOOLEAN DEFAULT true;
                
                UPDATE rh_employees
                SET show_in_orgchart = true
                WHERE show_in_orgchart IS NULL;
            `
        });

        if (error) {
            console.error('❌ Erro ao adicionar campo:', error);

            // Tentar via query direta
            console.log('Tentando abordagem alternativa...');

            const { error: error2 } = await supabase
                .from('rh_employees')
                .update({ show_in_orgchart: true })
                .is('show_in_orgchart', null);

            if (error2) {
                console.error('❌ Erro na abordagem alternativa:', error2);
            } else {
                console.log('✅ Campo atualizado via abordagem alternativa');
            }
        } else {
            console.log('✅ Campo show_in_orgchart adicionado com sucesso!');
        }

        // Verificar alguns registros
        console.log('\n📊 Verificando registros:\n');
        const { data: employees, error: error3 } = await supabase
            .from('rh_employees')
            .select('id, name, role, show_in_orgchart')
            .limit(10);

        if (error3) {
            console.error('❌ Erro ao verificar:', error3);
        } else {
            console.table(employees);
        }

        console.log('\n✅ Processo concluído!');

    } catch (error) {
        console.error('❌ Erro geral:', error);
    }
}

addShowInOrgchartField();
