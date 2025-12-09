#!/usr/bin/env node
/**
 * Script para importar produtos do laboratório em lote
 * 
 * Uso:
 *   node scripts/importar-produtos-laboratorio.js
 * 
 * Este script lê o arquivo cadastro produtos.json e importa todos os produtos
 * para o sistema, gerando automaticamente IDs e QR codes.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Erro: Variáveis de ambiente SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas');
    console.error('Por favor, configure o arquivo .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Mapeamento de categorias (do JSON para o banco)
const CATEGORIA_MAP = {
    // Componentes e Implantes
    'Componentes Protéticos': 'instrumentos',
    'Análogos e Componentes Protéticos': 'instrumentos',
    'Implantologia / Componentes Protéticos': 'instrumentos',
    
    // Materiais de Laboratório
    'Materiais de Laboratório Protético': 'consumiveis',
    'Materiais de Laboratório': 'outros',
    'Materiais de Laboratório / Gengiva Artificial': 'silicone',
    'Materiais de Laboratório / Acessórios CAD': 'consumiveis',
    'Materiais Auxiliares de Laboratório': 'consumiveis',
    
    // Cerâmicas e Zircônia
    'Discos de Zircônia': 'ceramica',
    'Blocos de Cerâmica CAD/CAM': 'ceramica',
    'Cerâmicas de Revestimento': 'ceramica',
    'Materiais de Revestimento Cerâmico': 'ceramica',
    'Discos CAD/CAM e Ligas Metálicas': 'metais',
    'Discos CAD/CAM': 'ceramica',
    
    // Discos e Blocos
    'Discos de PMMA': 'acrilico',
    
    // Dentes e Próteses
    'Dentes Artificiais': 'acrilico',
    'Próteses Acrílicas': 'acrilico',
    
    // Resinas
    'Resinas de Impressão 3D': 'resinas',
    'Resinas e Acrílicos': 'resinas',
    'Resinas de Modelagem': 'resinas',
    
    // Ceras
    'Ceras Laboratoriais': 'ceras',
    
    // Gessos
    'Gessos Odontológicos': 'gesso',
    
    // Materiais de Moldagem e Silicones
    'Materiais de Moldagem': 'silicone',
    
    // Polimento e Acabamento
    'Materiais de Polimento': 'instrumentos',
    'Discos e Brocas de Acabamento': 'instrumentos',
    'Acessórios Técnicos / Polimento e Desbaste': 'instrumentos',
    
    // Brocas e Instrumentos
    'Brocas e Instrumentos Rotatórios': 'instrumentos',
    
    // Materiais de Proteção
    'Materiais de Proteção': 'consumiveis',
    'Materiais de Aspiração / Proteção': 'consumiveis',
    'Materiais de Embalagem / Proteção': 'consumiveis',
    
    // Materiais de Higiene
    'Materiais de Higiene / Algodão': 'consumiveis',
    
    // Adesivos e Colas
    'Adesivos e Colas Técnicas': 'consumiveis',
    'Adesivos Odontológicos': 'consumiveis',
    
    // Gases e Aerossóis
    'Gases e Aerossóis': 'consumiveis',
    
    // Equipamentos
    'Equipamentos / Acessórios': 'equipamentos',
    'Equipamentos / Maçaricos': 'equipamentos',
    'Componentes Técnicos / Equipamentos de Bancada': 'equipamentos',
    'Componentes / Acessórios Técnicos': 'equipamentos',
    
    // Default
    'outros': 'outros'
};

// Mapeamento de unidades de medida (do JSON para o banco)
const UNIDADE_MAP = {
    'un': 'un',
    'unidade': 'un',
    'cx': 'caixa',
    'caixa': 'caixa',
    'caixa 500g': 'caixa',
    'caixa 450g': 'caixa',
    'cx 25kg': 'caixa',
    'cx 100 un': 'caixa',
    'kit': 'caixa',
    'jogo': 'un',
    'conjunto': 'un',
    'disco': 'un',
    'cartucho 1L': 'l',
    'cartucho 2x50ml + 10ml ativador': 'ml',
    'balde 25kg': 'kg',
    'frasco 50g': 'g',
    'frasco 1L': 'l',
    'tubo 3g': 'g',
    'tubo 60 ml': 'ml',
    'pacote 100g': 'g',
    'pacote (10 unidades)': 'un',
    'frasco / saco 20 g': 'g',
    'saco': 'un',
    'peça': 'un',
    'barra': 'barra',
    'g': 'g',
    'kg': 'kg',
    'ml': 'ml',
    'l': 'l',
    'metro': 'metro',
    'frasco': 'frasco',
    'embalagem': 'embalagem',
    'outro': 'outro'
};

/**
 * Mapeia a categoria do JSON para a categoria do banco
 */
function mapearCategoria(categoriaOriginal) {
    if (!categoriaOriginal) return 'outros';
    
    const categoriaMap = CATEGORIA_MAP[categoriaOriginal];
    if (categoriaMap) return categoriaMap;
    
    // Tentar match parcial
    for (const [key, value] of Object.entries(CATEGORIA_MAP)) {
        if (categoriaOriginal.toLowerCase().includes(key.toLowerCase()) ||
            key.toLowerCase().includes(categoriaOriginal.toLowerCase())) {
            return value;
        }
    }
    
    return 'outros';
}

/**
 * Mapeia a unidade de medida do JSON para a unidade do banco
 */
function mapearUnidadeMedida(unidadeOriginal) {
    if (!unidadeOriginal) return 'un';
    
    const unidadeLower = unidadeOriginal.toLowerCase().trim();
    
    // Busca exata
    if (UNIDADE_MAP[unidadeLower]) {
        return UNIDADE_MAP[unidadeLower];
    }
    
    // Busca parcial
    for (const [key, value] of Object.entries(UNIDADE_MAP)) {
        if (unidadeLower.includes(key) || key.includes(unidadeLower)) {
            return value;
        }
    }
    
    return 'un';
}

/**
 * Limpa e valida os dados do produto
 */
function limparDadosProduto(produto) {
    return {
        codigo_barras: produto.codigo_barras || null,
        categoria: mapearCategoria(produto.categoria),
        nome_material: produto.nome_material?.trim(),
        marca: produto.marca?.trim() || null,
        fornecedor: produto.fornecedor?.trim() || null,
        referencia_lote: produto.referencia_lote?.trim() || null,
        unidade_medida: mapearUnidadeMedida(produto.unidade_medida),
        localizacao: produto.localizacao?.trim() || null,
        data_validade: produto.data_validade || null,
        descricao: produto.descricao?.trim() || null,
        observacoes: produto.observacoes?.trim() || null,
        ativo: produto.ativo !== false, // Default true
        quantidade_inicial: produto.quantidade_inicial || 0,
        quantidade_minima: produto.quantidade_minima || 0,
        quantidade_maxima: produto.quantidade_maxima || null
    };
}

/**
 * Verifica se o produto já existe no banco
 */
async function produtoJaExiste(nomeMaterial, marca) {
    try {
        let query = supabase
            .from('produtoslaboratorio')
            .select('id, nome_material, marca')
            .eq('nome_material', nomeMaterial);
        
        if (marca) {
            query = query.eq('marca', marca);
        }
        
        const { data, error } = await query.maybeSingle();
        
        if (error) {
            console.warn(`⚠️  Erro ao verificar produto existente: ${error.message}`);
            return false;
        }
        
        return !!data;
    } catch (error) {
        console.warn(`⚠️  Erro ao verificar produto: ${error.message}`);
        return false;
    }
}

/**
 * Insere um produto no banco de dados
 */
async function inserirProduto(produtoLimpo, userId) {
    try {
        // Verificar se já existe
        const existe = await produtoJaExiste(produtoLimpo.nome_material, produtoLimpo.marca);
        if (existe) {
            console.log(`  ⏭️  Produto já existe: ${produtoLimpo.nome_material}`);
            return { success: true, skipped: true };
        }
        
        // Inserir produto
        const { data: produto, error: produtoError } = await supabase
            .from('produtoslaboratorio')
            .insert({
                codigo_barras: produtoLimpo.codigo_barras,
                categoria: produtoLimpo.categoria,
                nome_material: produtoLimpo.nome_material,
                marca: produtoLimpo.marca,
                fornecedor: produtoLimpo.fornecedor,
                referencia_lote: produtoLimpo.referencia_lote,
                unidade_medida: produtoLimpo.unidade_medida,
                localizacao: produtoLimpo.localizacao,
                data_validade: produtoLimpo.data_validade,
                descricao: produtoLimpo.descricao,
                observacoes: produtoLimpo.observacoes,
                ativo: produtoLimpo.ativo,
                criado_por: userId,
                atualizado_por: userId
            })
            .select()
            .single();
        
        if (produtoError) {
            throw produtoError;
        }
        
        // Criar registro de estoque
        const { error: estoqueError } = await supabase
            .from('estoquelaboratorio')
            .insert({
                produto_id: produto.id,
                quantidade_atual: produtoLimpo.quantidade_inicial || 0,
                quantidade_minima: produtoLimpo.quantidade_minima || 0,
                quantidade_maxima: produtoLimpo.quantidade_maxima,
                atualizado_por: userId
            });
        
        if (estoqueError) {
            console.warn(`  ⚠️  Erro ao criar estoque: ${estoqueError.message}`);
        }
        
        // Registrar movimentação inicial se quantidade > 0
        if (produtoLimpo.quantidade_inicial > 0) {
            await supabase
                .from('movimentacoeslaboratorio')
                .insert({
                    produto_id: produto.id,
                    tipo_movimento: 'entrada',
                    quantidade: produtoLimpo.quantidade_inicial,
                    responsavel_id: userId,
                    responsavel_nome: 'Sistema - Importação',
                    motivo: 'Estoque inicial - Importação em lote',
                    data_movimento: new Date().toISOString()
                });
        }
        
        console.log(`  ✅ ${produtoLimpo.nome_material} [${produtoLimpo.categoria}]`);
        return { success: true, data: produto };
        
    } catch (error) {
        console.error(`  ❌ Erro: ${error.message}`);
        return { success: false, error: error.message };
    }
}

/**
 * Função principal
 */
async function main() {
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║  🧪 IMPORTAÇÃO DE PRODUTOS DO LABORATÓRIO                ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    
    // Ler arquivo JSON
    const jsonPath = path.join(__dirname, '..', 'cadastro produtos.json');
    console.log(`📁 Lendo arquivo: ${jsonPath}\n`);
    
    if (!fs.existsSync(jsonPath)) {
        console.error('❌ Erro: Arquivo "cadastro produtos.json" não encontrado!');
        console.error(`   Esperado em: ${jsonPath}`);
        process.exit(1);
    }
    
    let produtos;
    try {
        const jsonContent = fs.readFileSync(jsonPath, 'utf-8');
        produtos = JSON.parse(jsonContent);
    } catch (error) {
        console.error('❌ Erro ao ler/parsear JSON:', error.message);
        process.exit(1);
    }
    
    if (!Array.isArray(produtos)) {
        console.error('❌ Erro: O JSON deve conter um array de produtos');
        process.exit(1);
    }
    
    // Remover duplicatas (produtos com mesmo nome e marca)
    const produtosUnicos = [];
    const vistos = new Set();
    
    for (const produto of produtos) {
        const chave = `${produto.nome_material}|${produto.marca || ''}`.toLowerCase();
        if (!vistos.has(chave)) {
            vistos.add(chave);
            produtosUnicos.push(produto);
        }
    }
    
    console.log(`📦 Total de produtos no arquivo: ${produtos.length}`);
    console.log(`📦 Produtos únicos (sem duplicatas): ${produtosUnicos.length}\n`);
    
    // Obter ID do usuário admin (ou primeiro usuário)
    const { data: users, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();
    
    if (userError || !users) {
        console.error('❌ Erro ao obter usuário:', userError?.message);
        process.exit(1);
    }
    
    const userId = users.id;
    console.log(`👤 Usuário para registro: ${userId}\n`);
    
    // Processar produtos
    console.log('🚀 Iniciando importação...\n');
    
    const resultados = {
        sucesso: 0,
        ignorados: 0,
        erros: 0,
        detalhes: []
    };
    
    for (let i = 0; i < produtosUnicos.length; i++) {
        const produtoOriginal = produtosUnicos[i];
        console.log(`[${i + 1}/${produtosUnicos.length}] Processando: ${produtoOriginal.nome_material}`);
        
        try {
            const produtoLimpo = limparDadosProduto(produtoOriginal);
            
            // Validar campos obrigatórios
            if (!produtoLimpo.nome_material) {
                console.log('  ⚠️  Ignorado: nome_material vazio');
                resultados.ignorados++;
                continue;
            }
            
            const resultado = await inserirProduto(produtoLimpo, userId);
            
            if (resultado.skipped) {
                resultados.ignorados++;
            } else if (resultado.success) {
                resultados.sucesso++;
            } else {
                resultados.erros++;
                resultados.detalhes.push({
                    produto: produtoOriginal.nome_material,
                    erro: resultado.error
                });
            }
            
        } catch (error) {
            console.error(`  ❌ Erro inesperado: ${error.message}`);
            resultados.erros++;
            resultados.detalhes.push({
                produto: produtoOriginal.nome_material,
                erro: error.message
            });
        }
        
        // Pequeno delay para não sobrecarregar o banco
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Resumo final
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║  📊 RESUMO DA IMPORTAÇÃO                                 ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
    console.log(`✅ Produtos importados com sucesso: ${resultados.sucesso}`);
    console.log(`⏭️  Produtos ignorados (já existem): ${resultados.ignorados}`);
    console.log(`❌ Erros: ${resultados.erros}\n`);
    
    if (resultados.detalhes.length > 0) {
        console.log('📋 Detalhes dos erros:\n');
        resultados.detalhes.forEach((detalhe, idx) => {
            console.log(`${idx + 1}. ${detalhe.produto}`);
            console.log(`   Erro: ${detalhe.erro}\n`);
        });
    }
    
    console.log('✨ Importação concluída!\n');
}

// Executar
main().catch(error => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
});

