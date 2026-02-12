require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function enableMarketing() {
    console.log('Enabling Marketing module...');

    // Update modules table
    const { data, error } = await supabase
        .from('modules')
        .update({ in_development: false })
        .eq('code', 'marketing')
        .select();

    if (error) {
        console.error('Error updating module:', error);
        process.exit(1);
    }

    console.log('Success! Marketing module updated:', data);
}

enableMarketing();
