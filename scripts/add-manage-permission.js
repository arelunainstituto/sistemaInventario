/**
 * Script para adicionar permissão inventory:manage à danielly.motta
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function addManagePermission() {
    try {
        const userEmail = 'danielly.motta@institutoareluna.pt';
        
        console.log('\n🔍 Buscando usuário...\n');
        
        // 1. Buscar usuário
        const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers();
        const user = authUsers.users.find(u => u.email === userEmail);
        
        if (!user) {
            console.error('❌ Usuário não encontrado');
            return;
        }
        
        console.log('✅ Usuário encontrado:', user.email);
        
        // 2. Criar permissão inventory:manage se não existir
        console.log('\n🔧 Verificando permissão inventory:manage...\n');
        
        let managePermission = await supabaseAdmin
            .from('permissions')
            .select('id')
            .eq('name', 'inventory:manage')
            .maybeSingle();
        
        if (!managePermission.data) {
            console.log('   ⚠️  Permissão não existe, criando...');
            const { data, error } = await supabaseAdmin
                .from('permissions')
                .insert([{
                    name: 'inventory:manage',
                    module_name: 'inventory',
                    action: 'manage',
                    description: 'Gerenciar inventário (acesso total)',
                    resource: 'inventory'
                }])
                .select()
                .single();
            
            if (error) {
                console.error('   ❌ Erro ao criar permissão:', error.message);
                return;
            }
            
            managePermission.data = data;
            console.log('   ✅ Permissão criada com sucesso');
        } else {
            console.log('   ✅ Permissão já existe');
        }
        
        // 3. Buscar role customizada do usuário
        console.log('\n🔍 Buscando role customizada...\n');
        
        const { data: userRoles } = await supabaseAdmin
            .from('user_roles')
            .select('role_id, roles(name)')
            .eq('user_id', user.id)
            .eq('is_active', true);
        
        const customRole = userRoles?.find(ur => ur.roles.name.startsWith('user_'));
        
        if (!customRole) {
            console.error('❌ Role customizada não encontrada');
            return;
        }
        
        console.log('✅ Role encontrada:', customRole.roles.name);
        
        // 4. Verificar se a permissão já está vinculada
        const { data: existingLink } = await supabaseAdmin
            .from('role_permissions')
            .select('id')
            .eq('role_id', customRole.role_id)
            .eq('permission_id', managePermission.data.id)
            .maybeSingle();
        
        if (existingLink) {
            console.log('\n✅ Permissão inventory:manage já está vinculada!\n');
            return;
        }
        
        // 5. Vincular permissão à role
        console.log('\n🔗 Vinculando inventory:manage à role...\n');
        
        const { error: linkError } = await supabaseAdmin
            .from('role_permissions')
            .insert([{
                role_id: customRole.role_id,
                permission_id: managePermission.data.id
            }]);
        
        if (linkError) {
            console.error('❌ Erro ao vincular:', linkError.message);
            return;
        }
        
        console.log('✅ Permissão vinculada com sucesso!\n');
        
        // 6. Verificar permissões finais
        const { data: finalPerms } = await supabaseAdmin
            .from('user_roles')
            .select(`
                roles(
                    name,
                    role_permissions(
                        permissions(name)
                    )
                )
            `)
            .eq('user_id', user.id)
            .eq('role_id', customRole.role_id)
            .single();
        
        console.log('📋 Permissões finais da danielly.motta:\n');
        finalPerms.roles.role_permissions.forEach(rp => {
            console.log(`   ✅ ${rp.permissions.name}`);
        });
        
        console.log('\n\n💡 Próximos passos:');
        console.log('   1. Peça ao usuário para RECARREGAR a página (F5)');
        console.log('   2. Tentar editar um item novamente');
        console.log('   3. Agora deve funcionar!\n');
        
    } catch (error) {
        console.error('💥 Erro:', error);
    }
}

addManagePermission().then(() => {
    console.log('🏁 Script finalizado');
    process.exit(0);
}).catch(error => {
    console.error('💥 Erro fatal:', error);
    process.exit(1);
});

