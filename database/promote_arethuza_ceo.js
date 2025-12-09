// Script para promover Dra. Arethuza a Co-CEO
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function promoteArethuza() {
    console.log('🔄 Promovendo Dra. Arethuza a Co-CEO...\n');

    try {
        // 1. Atualizar Dra. Arethuza
        const { data: arethuza, error: error1 } = await supabase
            .from('rh_employees')
            .update({
                role: 'Co-CEO',
                supervisor_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('email', 'draarethuza@institutoareluna.pt')
            .select();

        if (error1) {
            console.error('❌ Erro ao atualizar Dra. Arethuza:', error1);
        } else {
            console.log('✅ Dra. Arethuza promovida a Co-CEO');
            console.log(arethuza);
        }

        // 2. Atualizar Dr. Leonardo (garantir consistência)
        const { data: leonardo, error: error2 } = await supabase
            .from('rh_employees')
            .update({
                role: 'Co-CEO',
                supervisor_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('email', 'drsaraiva@institutoareluna.pt')
            .select();

        if (error2) {
            console.error('❌ Erro ao atualizar Dr. Leonardo:', error2);
        } else {
            console.log('✅ Dr. Leonardo atualizado para Co-CEO');
            console.log(leonardo);
        }

        // 3. Verificar os Co-CEOs
        console.log('\n📊 Verificando Co-CEOs:\n');
        const { data: ceos, error: error3 } = await supabase
            .from('rh_employees')
            .select('id, name, email, department, role, supervisor_id, status')
            .in('email', ['draarethuza@institutoareluna.pt', 'drsaraiva@institutoareluna.pt'])
            .order('name');

        if (error3) {
            console.error('❌ Erro ao verificar CEOs:', error3);
        } else {
            console.table(ceos);
        }

        // 4. Contar reportes diretos
        console.log('\n📈 Reportes diretos aos Co-CEOs:\n');

        const drLeoId = ceos?.find(c => c.email === 'drsaraiva@institutoareluna.pt')?.id;
        const draArethuzaId = ceos?.find(c => c.email === 'draarethuza@institutoareluna.pt')?.id;

        if (drLeoId) {
            const { count: leoCount } = await supabase
                .from('rh_employees')
                .select('*', { count: 'exact', head: true })
                .eq('supervisor_id', drLeoId);
            console.log(`Dr. Leonardo: ${leoCount} reportes diretos`);
        }

        if (draArethuzaId) {
            const { count: arethuzaCount } = await supabase
                .from('rh_employees')
                .select('*', { count: 'exact', head: true })
                .eq('supervisor_id', draArethuzaId);
            console.log(`Dra. Arethuza: ${arethuzaCount} reportes diretos`);
        }

        console.log('\n✅ Atualização concluída com sucesso!');

    } catch (error) {
        console.error('❌ Erro geral:', error);
    }
}

promoteArethuza();
