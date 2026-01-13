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

async function inspectUsersSchema() {
    console.log('🔍 Inspecionando tabela users (public)...');

    const { data, error } = await supabase
        .from('users')
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
            // Se vazia, talvez não consiga ver chaves. Mas assumiremos id e email por enquanto se vazia.
        }
    }
}

inspectUsersSchema();
