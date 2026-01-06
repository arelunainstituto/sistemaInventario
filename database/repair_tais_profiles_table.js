
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function repair() {
    const authId = '3a0e0306-b1b4-47f1-9ae3-e72394cf46db';
    const email = 'tais.souza@institutoareluna.pt';
    const fullName = 'Tais Souza';

    console.log(`Repairing profile for ${email} (${authId})...`);

    // 1. Check if already exists
    const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authId)
        .maybeSingle();

    if (checkError) {
        console.error('❌ Error checking profile:', checkError);
        return;
    }

    if (existing) {
        console.log('⚠️ Profile already exists:', existing);
        return;
    }

    // 2. Insert profile
    const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert([{
            id: authId,
            email: email,
            full_name: fullName,
            updated_at: new Date().toISOString()
        }])
        .select()
        .single();

    if (insertError) {
        console.error('❌ Error inserting profile:', insertError);
    } else {
        console.log('✅ Profile inserted successfully:', inserted);
    }
}

repair();
