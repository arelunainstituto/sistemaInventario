require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não definidos no .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupStorage() {
    console.log('🔧 Configurando Supabase Storage...');

    const bucketName = 'rh-documents';

    // 1. Verificar se bucket existe
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();

    if (listError) {
        console.error('❌ Erro ao listar buckets:', listError);
        return;
    }

    const bucketExists = buckets.find(b => b.name === bucketName);

    if (bucketExists) {
        console.log(`✅ Bucket '${bucketName}' já existe.`);
    } else {
        console.log(`🔨 Criando bucket '${bucketName}'...`);

        const { data, error } = await supabase.storage.createBucket(bucketName, {
            public: false,
            fileSizeLimit: 10485760, // 10MB
            allowedMimeTypes: null // All types
        });

        if (error) {
            console.error(`❌ Erro ao criar bucket '${bucketName}':`, error);
        } else {
            console.log(`✅ Bucket '${bucketName}' criado com sucesso!`);
        }
    }

    console.log('\n🎉 Configuração concluída! Tente fazer o upload novamente.');
}

setupStorage();
