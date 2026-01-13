
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspect() {
    const email = 'tais.souza@institutoareluna.pt';
    console.log(`Searching for ${email}...`);

    // 1. Check auth.users (via listUsers or direct query if possible, but listUsers is safer with admin)
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    const authUser = users.find(u => u.email === email);

    if (authUser) {
        console.log('✅ Found in auth.users:', authUser.id);
    } else {
        console.log('❌ Not found in auth.users');
        return;
    }

    // 2. Check public.profiles
    console.log('\nChecking public.profiles...');
    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

    if (profileError) {
        console.log('Error checking profiles table (might not exist):', profileError.message);
    } else if (profile) {
        console.log('✅ Found in profiles:', profile);
    } else {
        console.log('❌ Not found in profiles table (ID matches auth_id?)');

        // Try searching by email if id doesn't match
        const { data: profileByEmail } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (profileByEmail) {
            console.log('⚠️ Found in profiles by email, but ID differs:', profileByEmail);
        } else {
            console.log('❌ Not found in profiles by email either.');
        }
    }

    // 3. Check public.user_profiles
    console.log('\nChecking public.user_profiles...');
    const { data: userProfile, error: userProfileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', authUser.id)
        .maybeSingle();

    if (userProfile) {
        console.log('✅ Found in user_profiles:', userProfile);
    } else {
        console.log('❌ Not found in user_profiles');
    }
}

inspect();
