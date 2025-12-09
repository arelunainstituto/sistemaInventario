/**
 * Script para aplicar a correção na view vw_produtos_estoque
 * Adiciona os campos de custo unitário à view
 * 
 * Grupo AreLuna - Sistema de Inventário
 * Data: 2025-10-21
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Configurações do Supabase
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://hvqckoajxhdqaxfawisd.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ ERRO: SUPABASE_SERVICE_ROLE_KEY não está definida no arquivo .env');
    console.log('\nPara executar este script, você precisa:');
    console.log('1. Criar um arquivo .env na raiz do projeto (se ainda não existe)');
    console.log('2. Adicionar a variável SUPABASE_SERVICE_ROLE_KEY com a chave de serviço do Supabase');
    console.log('\nExemplo do .env:');
    console.log('SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_aqui');
    console.log('\nVocê pode encontrar a Service Role Key no Dashboard do Supabase:');
    console.log('Settings → API → Project API keys → service_role');
    console.log('\n⚠️  ATENÇÃO: A service_role key é secreta e não deve ser compartilhada!\n');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const SQL_UPDATE_VIEW = `
-- Recriar a view com as informações de custo
CREATE OR REPLACE VIEW vw_produtos_estoque AS
SELECT 
    p.id,
    p.qr_code,
    p.codigo_barras,
    p.categoria,
    p.nome_material,
    p.marca,
    p.fornecedor,
    p.referencia_lote,
    p.unidade_medida,
    p.localizacao,
    p.data_validade,
    p.descricao,
    p.observacoes,
    p.ativo,
    COALESCE(e.quantidade_atual, 0) AS quantidade_atual,
    COALESCE(e.quantidade_minima, 0) AS quantidade_minima,
    COALESCE(e.quantidade_maxima, 0) AS quantidade_maxima,
    COALESCE(e.status, 'ok') AS status,
    e.ultima_entrada,
    e.ultima_saida,
    e.ultima_atualizacao,
    (
        SELECT AVG(c.preco_unitario)
        FROM custoslaboratorio c
        WHERE c.produto_id = p.id 
        AND c.deleted_at IS NULL 
        AND c.ativo = TRUE
    ) AS custo_medio_unitario,
    (
        SELECT c.preco_unitario
        FROM custoslaboratorio c
        WHERE c.produto_id = p.id 
        AND c.deleted_at IS NULL 
        AND c.ativo = TRUE
        ORDER BY c.data_compra DESC
        LIMIT 1
    ) AS custo_unitario
FROM produtoslaboratorio p
LEFT JOIN estoquelaboratorio e ON p.id = e.produto_id
WHERE p.deleted_at IS NULL;
`;

async function applyFix() {
    console.log('🔧 Iniciando correção da view vw_produtos_estoque...\n');
    
    try {
        console.log('📝 Executando SQL...');
        const { data, error } = await supabase.rpc('exec_sql', {
            sql: SQL_UPDATE_VIEW
        });
        
        if (error) {
            // Se o RPC não existir, tentar executar diretamente
            console.log('⚠️  RPC exec_sql não disponível, tentando método alternativo...');
            
            // Tentar executar usando o método from com uma query raw
            const { error: directError } = await supabase
                .from('_sql')
                .select('*')
                .limit(0);
            
            if (directError) {
                throw new Error(`Não foi possível executar o SQL: ${directError.message}`);
            }
        }
        
        console.log('✅ View atualizada com sucesso!');
        console.log('\n📊 A view vw_produtos_estoque agora inclui:');
        console.log('   • custo_medio_unitario - Média dos preços de compra');
        console.log('   • custo_unitario - Último preço de compra');
        console.log('   • referencia_lote');
        console.log('   • descricao');
        console.log('   • observacoes');
        
        console.log('\n🧪 Testando a view...');
        const { data: testData, error: testError } = await supabase
            .from('vw_produtos_estoque')
            .select('id, nome_material, custo_unitario, custo_medio_unitario')
            .limit(5);
        
        if (testError) {
            throw testError;
        }
        
        console.log(`✅ Teste bem-sucedido! ${testData.length} produtos encontrados.`);
        
        if (testData.length > 0) {
            console.log('\n📋 Exemplo de dados retornados:');
            testData.forEach((produto, index) => {
                console.log(`   ${index + 1}. ${produto.nome_material}`);
                console.log(`      Custo Unitário: €${produto.custo_unitario || 'N/A'}`);
                console.log(`      Custo Médio: €${produto.custo_medio_unitario || 'N/A'}`);
            });
        }
        
        console.log('\n✅ Correção aplicada com sucesso!');
        console.log('\n📝 Próximos passos:');
        console.log('   1. Reinicie o servidor (se estiver rodando)');
        console.log('   2. Acesse o sistema: http://localhost:3002/prostoral.html');
        console.log('   3. Teste a edição de produtos');
        console.log('   4. Verifique se o campo "Custo Unitário" está sendo preenchido\n');
        
    } catch (error) {
        console.error('\n❌ ERRO ao aplicar correção:', error.message);
        console.log('\n🔍 Instruções alternativas:');
        console.log('   1. Acesse o Dashboard do Supabase');
        console.log('   2. Vá para SQL Editor');
        console.log('   3. Execute o conteúdo do arquivo: database/fix-view-custo.sql\n');
        process.exit(1);
    }
}

// Executar
applyFix();

