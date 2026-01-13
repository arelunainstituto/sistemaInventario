const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Erro: SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function repairProfile() {
    const email = 'tais.souza@institutoareluna.pt';
    // User ID from logs (Auth User ID)
    const knownUserId = '3a0e0306-b1b4-47f1-9ae3-e72394cf46db';
    const tenantId = '00000000-0000-0000-0000-000000000002';

    console.log(`🔍 Buscando/Reparando perfil para: ${email} (ID: ${knownUserId})`);

    // 1. Verificar/Inserir na tabela public.users
    const { data: existingPublicUser, error: publicUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', knownUserId)
        .single();

    if (existingPublicUser) {
        console.log('✅ Usuário já existe em public.users');
    } else {
        console.log('⚠️ Usuário não encontrado em public.users. Criando...');

        const { error: insertUserError } = await supabase
            .from('users')
            .insert([{
                id: knownUserId,
                name: 'Tais Souza',
                email: email,
                email_verified: new Date().toISOString()
            }]);

        if (insertUserError) {
            console.error('❌ Erro ao inserir em public.users:', insertUserError);
            return;
        }
        console.log('✅ Usuário inserido em public.users com sucesso.');
    }

    // 2. Verificar se já existe perfil em user_profiles
    const { data: existingProfile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', knownUserId)
        .single();

    if (existingProfile) {
        console.log('⚠️ Perfil já existe em user_profiles:', existingProfile);
        return;
    }

    if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = 0 rows
        console.error('❌ Erro ao verificar user_profiles:', profileError);
        return;
    }

    console.log('🛠️ Criando user_profile...');

    // 3. Criar perfil
    const { data: newProfile, error: createError } = await supabase
        .from('user_profiles')
        .insert([{
            user_id: knownUserId, // FK para public.users.id
            first_name: 'Tais',
            last_name: 'Souza',
            display_name: 'Tais Souza',
            is_active: true,
            tenant_id: tenantId
        }])
        .select()
        .single();

    if (createError) {
        console.error('❌ Erro ao criar user_profile:', createError);
    } else {
        console.log('✅ Perfil criado com sucesso em user_profiles:', newProfile);
    }
}

repairProfile();
