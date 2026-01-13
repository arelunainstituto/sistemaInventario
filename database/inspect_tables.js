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

async function inspectTables() {
    console.log('🔍 Listando tabelas do schema public...');

    // Note: accessing information_schema via Supabase JS client directly might be tricky with RLS/permissions or RPC.
    // However, we can try a raw SQL via an RPC if available, or just try to select from 'users' and see if it errors.

    // Attempt 1: Check if 'users' table exists by selecting from it
    const { data, error } = await supabase.from('users').select('count').limit(1);

    if (error) {
        console.log('❌ Tabela "users" (public) parece não existir ou não está acessível:', error.message);
    } else {
        console.log('✅ Tabela "users" (public) EXISTE.');
    }
}

inspectTables();
