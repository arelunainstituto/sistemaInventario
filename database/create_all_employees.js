/**
 * Script para criar todos os funcionários no Supabase
 * - Cria usuários no Supabase Auth com senha padrão
 * - Cria registros na tabela rh_employees
 * - Vincula auth.users com rh_employees
 * 
 * Uso: node database/create_all_employees.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Configuração do Supabase (usando Service Role Key para admin operations)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ ERRO: Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// ID do supervisor (Dr. Leonardo)
const SUPERVISOR_ID = 'eea871de-8303-42d3-965c-ed5d80a97b99';
const DEFAULT_PASSWORD = 'Mudar123!';
const DEFAULT_NIF = '999999999'; // NIF temporário

// Lista de todos os funcionários
const employees = [
    { name: 'Ana Claudia Moraes', email: 'ana.moraes@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Analyce da Silva', email: 'analyce.silva@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Awais Bashir', email: 'awais.bashir@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Caroline Gomez', email: 'caroline.gomez@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Cleiton Uchoa Prata', email: 'cleiton.prata@institutoareluna.pt', department: 'Geral', role: 'Funcionário' },
    { name: 'Contas a Receber', email: 'contasareceber@institutoareluna.pt', department: 'Financeiro', role: 'Sistema' },
    { name: 'Danielly Motta', email: 'danielly.motta@institutoareluna.pt', department: 'Geral', role: 'Funcionário' },
    { name: 'Diego dos Santos Costa', email: 'diego.costa@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Dr. Leonardo Saraiva', email: 'drsaraiva@institutoareluna.pt', department: 'Administração', role: 'CEO' },
    { name: 'Dra. Arethuza', email: 'draarethuza@institutoareluna.pt', department: 'Administração', role: 'Diretora' },
    { name: 'Eduardo Souza', email: 'eduardo.souza@institutoareluna.pt', department: 'Geral', role: 'Funcionário' },
    { name: 'Eliane Almeida', email: 'eliane.almeida@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Elsa Brilhante', email: 'elsa.brilhante@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Erickson Mendes do Carmo', email: 'erickson.carmo@pinklegion.com', department: 'TI', role: 'Desenvolvedor' },
    { name: 'Federica Laporta', email: 'federica.laporta@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Gabrielle Fernandez', email: 'gabrielle.fernandez@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Gisele Prudêncio', email: 'gisele.prudencio@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Graziele Bassi', email: 'graziele.bassi@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Helda Natal', email: 'helda.natal@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Ian Thives', email: 'ian.thives@institutoareluna.pt', department: 'TI', role: 'Funcionário' },
    { name: 'Igor Santos', email: 'igor.santos@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Júlia Cavazini', email: 'julia.cavazini@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Julia Nara', email: 'julia.nara@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Juliana Brito', email: 'juliana.brito@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Kenya Lampert', email: 'kenya.lampert@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Letícia Bastos', email: 'leticia.bastos@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Liana Hoeller', email: 'liana.hoeller@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Lucilene Xavier', email: 'lucilene.xavier@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Maria Carolina dos Santos Pimentel de Almeida', email: 'maria.carolina@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Maria Júlia Ferreira', email: 'maria.ferreira@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Nelson Silva', email: 'nelson.silva@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Nicaela Cabral', email: 'nicaela.cabral@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Pedro Silva', email: 'pedro.silva@pinklegion.com', department: 'TI', role: 'Desenvolvedor' },
    { name: 'Raphael Santana', email: 'raphael.santana@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Rebeca Ribeiro Alves', email: 'rebeca.alves@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Roberta Justino', email: 'roberta.justino@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Sofia Falcato', email: 'sofia.falcato@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Suzan Silva', email: 'suzan.silva@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Tais Valeria Souza', email: 'tais.souza@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Talita Alves', email: 'talita.alves@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Vinicius Novato', email: 'vinicius.novato@institutoareluna.pt', department: 'Administração', role: 'Admin' },
    { name: 'Wellen Novato', email: 'wellen.novato@institutoareluna.pt', department: 'Operações', role: 'Funcionário' },
    { name: 'Zaira Barros', email: 'zaira.barros@institutoareluna.pt', department: 'Operações', role: 'Funcionário' }
];

async function createEmployee(employeeData) {
    const { name, email, department, role } = employeeData;

    try {
        // 1. Verificar se o funcionário já existe
        const { data: existingEmployee } = await supabase
            .from('rh_employees')
            .select('id, email')
            .eq('email', email)
            .single();

        if (existingEmployee) {
            console.log(`⏭️  ${name} já existe (${email})`);
            return { success: true, skipped: true };
        }

        // 2. Criar usuário no Supabase Auth
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: DEFAULT_PASSWORD,
            email_confirm: true, // Auto-confirmar email
            user_metadata: {
                name: name
            }
        });

        if (authError) {
            // Se o usuário já existe no Auth, buscar e criar apenas o registro de funcionário
            if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
                console.log(`⚠️  Usuário Auth já existe para ${email}, buscando ID...`);

                // Buscar o usuário usando o método admin
                const { data: userData, error: getUserError } = await supabase.auth.admin.getUserByEmail(email);

                if (getUserError || !userData || !userData.user) {
                    console.error(`❌ Não foi possível encontrar usuário Auth para ${email}:`, getUserError?.message);
                    return { success: false, error: `Usuário Auth não encontrado: ${getUserError?.message}` };
                }

                // Criar apenas o registro de funcionário
                const { data: employee, error: empError } = await supabase
                    .from('rh_employees')
                    .insert([{
                        id: userData.user.id,
                        name: name,
                        email: email,
                        nif: DEFAULT_NIF,
                        mobile: '000000000', // Telefone temporário
                        department: department,
                        role: role,
                        status: 'ACTIVE',
                        supervisor_id: email === 'drsaraiva@institutoareluna.pt' ? null : SUPERVISOR_ID,
                        hire_date: new Date().toISOString().split('T')[0]
                    }])
                    .select()
                    .single();

                if (empError) {
                    console.error(`❌ Erro ao criar funcionário para ${email}:`, empError.message);
                    return { success: false, error: empError.message };
                }

                console.log(`✅ ${name} - Funcionário vinculado ao Auth existente`);
                return { success: true, created: true };
            }

            console.error(`❌ Erro ao criar Auth user para ${email}:`, authError.message);
            return { success: false, error: authError.message };
        }

        // 3. Criar registro na tabela rh_employees com o mesmo ID do Auth
        const { data: employee, error: employeeError } = await supabase
            .from('rh_employees')
            .insert([{
                id: authUser.user.id,
                name: name,
                email: email,
                nif: DEFAULT_NIF,
                mobile: '000000000', // Telefone temporário
                department: department,
                role: role,
                status: 'ACTIVE',
                supervisor_id: email === 'drsaraiva@institutoareluna.pt' ? null : SUPERVISOR_ID,
                hire_date: new Date().toISOString().split('T')[0]
            }])
            .select()
            .single();

        if (employeeError) throw employeeError;

        console.log(`✅ ${name} - Criado com sucesso (${email})`);
        return { success: true, created: true };

    } catch (error) {
        console.error(`❌ Erro ao criar ${name}:`, error.message);
        return { success: false, error: error.message };
    }
}

async function main() {
    console.log('🚀 Iniciando criação de funcionários...\n');
    console.log(`📊 Total de funcionários a processar: ${employees.length}`);
    console.log(`👤 Supervisor padrão: ${SUPERVISOR_ID}`);
    console.log(`🔑 Senha padrão: ${DEFAULT_PASSWORD}\n`);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (const employee of employees) {
        const result = await createEmployee(employee);

        if (result.success) {
            if (result.skipped) {
                skipped++;
            } else {
                created++;
            }
        } else {
            failed++;
        }

        // Pequeno delay para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log('\n📈 RESUMO:');
    console.log(`✅ Criados: ${created}`);
    console.log(`⏭️  Já existiam: ${skipped}`);
    console.log(`❌ Falhas: ${failed}`);
    console.log(`📊 Total: ${employees.length}`);

    if (failed === 0) {
        console.log('\n🎉 Todos os funcionários foram processados com sucesso!');
    } else {
        console.log('\n⚠️  Alguns funcionários não puderam ser criados. Verifique os erros acima.');
    }
}

// Executar
main().catch(console.error);
