require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: perms } = await supabase.from('permissions').select('*').ilike('name', 'marketing%');
  console.log("Marketing permissions:", perms);
}
run();
