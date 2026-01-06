
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspect() {
    const authId = '3a0e0306-b1b4-47f1-9ae3-e72394cf46db'; // Known Auth ID for Tais
    // The ID reported in the error message, likely user_profile.id
    const userProfileId = '7d8bc6d5-e7a6-4135-9a34-632aad5889ca';

    console.log(`Checking profiles table...`);

    // 1. Check if profiles table exists and get sample data
    const { data: sampleProfiles, error: sampleError } = await supabase
        .from('profiles')
        .select('*')
        .limit(3);

    if (sampleError) {
        console.log('❌ Error accessing profiles table:', sampleError.message);
    } else {
        console.log('✅ Profiles table exists. Sample IDs:', sampleProfiles.map(p => p.id));
        if (sampleProfiles.length > 0) {
            console.log('Sample profile Record:', sampleProfiles[0]);
        }
    }

    // 2. Check for Auth ID in profiles
    const { data: profileByAuthId } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authId)
        .maybeSingle();

    if (profileByAuthId) {
        console.log(`✅ Found Tais in profiles by Auth ID (${authId})`);
    } else {
        console.log(`❌ Tais NOT found in profiles by Auth ID (${authId})`);
    }

    // 3. Check for User Profile ID in profiles
    const { data: profileByProfId } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userProfileId)
        .maybeSingle();

    if (profileByProfId) {
        console.log(`✅ Found Tais in profiles by UserProfile ID (${userProfileId})`);
    } else {
        console.log(`❌ Tais NOT found in profiles by UserProfile ID (${userProfileId})`);
    }
}

inspect();
