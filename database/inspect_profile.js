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

async function inspectProfile() {
    console.log('🔍 Inspecionando tabela user_profiles...');

    const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .limit(1);

    if (error) {
        console.error('❌ Erro:', error);
    } else {
        console.log('✅ Estrutura encontrada (primeira linha):');
        if (data.length > 0) {
            console.log(JSON.stringify(data[0], null, 2));
            console.log('Chaves:', Object.keys(data[0]));
        } else {
            console.log('⚠️ Tabela vazia.');
        }
    }
}

inspectProfile();
