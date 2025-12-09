-- Script para INSERIR funcionários faltantes
-- IMPORTANTE: Este script insere APENAS na tabela rh_employees
-- Para criar usuários no Supabase Auth, use o endpoint da API ou o script Node.js

-- ATENÇÃO: Antes de executar, rode o script check_missing_employees.sql
-- para ver quais funcionários realmente precisam ser cadastrados

-- Buscar o ID do Dr. Leonardo para usar como supervisor padrão
DO $$
DECLARE
    dr_leo_id UUID;
    default_nif VARCHAR := '999999999'; -- NIF temporário, deve ser atualizado depois
BEGIN
    -- Buscar ID do Dr. Leonardo
    SELECT id INTO dr_leo_id
    FROM rh_employees
    WHERE email = 'drsaraiva@institutoareluna.pt'
    LIMIT 1;

    -- Inserir funcionários que não existem
    -- Ana Claudia Moraes
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Ana Claudia Moraes', 'ana.moraes@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'ana.moraes@institutoareluna.pt');

    -- Analyce da Silva
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Analyce da Silva', 'analyce.silva@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'analyce.silva@institutoareluna.pt');

    -- Awais Bashir
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Awais Bashir', 'awais.bashir@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'awais.bashir@institutoareluna.pt');

    -- Caroline Gomez
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Caroline Gomez', 'caroline.gomez@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'caroline.gomez@institutoareluna.pt');

    -- Cleiton Uchoa Prata
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Cleiton Uchoa Prata', 'cleiton.prata@institutoareluna.pt', default_nif, 'Geral', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'cleiton.prata@institutoareluna.pt');

    -- Contas a Receber (conta funcional)
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Contas a Receber', 'contasareceber@institutoareluna.pt', default_nif, 'Financeiro', 'Sistema', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'contasareceber@institutoareluna.pt');

    -- Danielly Motta
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Danielly Motta', 'danielly.motta@institutoareluna.pt', default_nif, 'Geral', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'danielly.motta@institutoareluna.pt');

    -- Diego dos Santos Costa
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Diego dos Santos Costa', 'diego.costa@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'diego.costa@institutoareluna.pt');

    -- Dr. Leonardo (já deve existir, mas incluído para completude)
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Dr. Leonardo Saraiva', 'drsaraiva@institutoareluna.pt', default_nif, 'Administração', 'CEO', 'ACTIVE', NULL, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'drsaraiva@institutoareluna.pt');

    -- Dra. Arethuza
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Dra. Arethuza', 'draarethuza@institutoareluna.pt', default_nif, 'Administração', 'Diretora', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'draarethuza@institutoareluna.pt');

    -- Eduardo Souza
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Eduardo Souza', 'eduardo.souza@institutoareluna.pt', default_nif, 'Geral', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'eduardo.souza@institutoareluna.pt');

    -- Eliane Almeida
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Eliane Almeida', 'eliane.almeida@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'eliane.almeida@institutoareluna.pt');

    -- Elsa Brilhante
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Elsa Brilhante', 'elsa.brilhante@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'elsa.brilhante@institutoareluna.pt');

    -- Erickson Mendes do Carmo
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Erickson Mendes do Carmo', 'erickson.carmo@pinklegion.com', default_nif, 'TI', 'Desenvolvedor', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'erickson.carmo@pinklegion.com');

    -- Federica Laporta
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Federica Laporta', 'federica.laporta@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'federica.laporta@institutoareluna.pt');

    -- Gabrielle Fernandez
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Gabrielle Fernandez', 'gabrielle.fernandez@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'gabrielle.fernandez@institutoareluna.pt');

    -- Gisele Prudêncio
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Gisele Prudêncio', 'gisele.prudencio@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'gisele.prudencio@institutoareluna.pt');

    -- Graziele Bassi
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Graziele Bassi', 'graziele.bassi@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'graziele.bassi@institutoareluna.pt');

    -- Helda Natal
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Helda Natal', 'helda.natal@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'helda.natal@institutoareluna.pt');

    -- Ian Thives
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Ian Thives', 'ian.thives@institutoareluna.pt', default_nif, 'TI', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'ian.thives@institutoareluna.pt');

    -- Igor Santos
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Igor Santos', 'igor.santos@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'igor.santos@institutoareluna.pt');

    -- Júlia Cavazini
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Júlia Cavazini', 'julia.cavazini@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'julia.cavazini@institutoareluna.pt');

    -- Julia Nara
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Julia Nara', 'julia.nara@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'julia.nara@institutoareluna.pt');

    -- Juliana Brito
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Juliana Brito', 'juliana.brito@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'juliana.brito@institutoareluna.pt');

    -- Kenya Lampert
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Kenya Lampert', 'kenya.lampert@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'kenya.lampert@institutoareluna.pt');

    -- Letícia Bastos
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Letícia Bastos', 'leticia.bastos@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'leticia.bastos@institutoareluna.pt');

    -- Liana Hoeller
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Liana Hoeller', 'liana.hoeller@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'liana.hoeller@institutoareluna.pt');

    -- Lucilene Xavier
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Lucilene Xavier', 'lucilene.xavier@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'lucilene.xavier@institutoareluna.pt');

    -- Maria Carolina dos Santos Pimentel de Almeida
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Maria Carolina dos Santos Pimentel de Almeida', 'maria.carolina@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'maria.carolina@institutoareluna.pt');

    -- Maria Júlia Ferreira
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Maria Júlia Ferreira', 'maria.ferreira@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'maria.ferreira@institutoareluna.pt');

    -- Nelson Silva
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Nelson Silva', 'nelson.silva@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'nelson.silva@institutoareluna.pt');

    -- Nicaela Cabral
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Nicaela Cabral', 'nicaela.cabral@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'nicaela.cabral@institutoareluna.pt');

    -- Pedro Silva
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Pedro Silva', 'pedro.silva@pinklegion.com', default_nif, 'TI', 'Desenvolvedor', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'pedro.silva@pinklegion.com');

    -- Raphael Santana
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Raphael Santana', 'raphael.santana@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'raphael.santana@institutoareluna.pt');

    -- Rebeca Ribeiro Alves
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Rebeca Ribeiro Alves', 'rebeca.alves@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'rebeca.alves@institutoareluna.pt');

    -- Roberta Justino
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Roberta Justino', 'roberta.justino@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'roberta.justino@institutoareluna.pt');

    -- Sofia Falcato
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Sofia Falcato', 'sofia.falcato@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'sofia.falcato@institutoareluna.pt');

    -- Suzan Silva
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Suzan Silva', 'suzan.silva@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'suzan.silva@institutoareluna.pt');

    -- Tais Valeria Souza
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Tais Valeria Souza', 'tais.souza@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'tais.souza@institutoareluna.pt');

    -- Talita Alves
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Talita Alves', 'talita.alves@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'talita.alves@institutoareluna.pt');

    -- Vinicius Novato
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Vinicius Novato', 'vinicius.novato@institutoareluna.pt', default_nif, 'Administração', 'Admin', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'vinicius.novato@institutoareluna.pt');

    -- Wellen Novato
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Wellen Novato', 'wellen.novato@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'wellen.novato@institutoareluna.pt');

    -- Zaira Barros
    INSERT INTO rh_employees (name, email, nif, department, role, status, supervisor_id, hire_date)
    SELECT 'Zaira Barros', 'zaira.barros@institutoareluna.pt', default_nif, 'Operações', 'Funcionário', 'ACTIVE', dr_leo_id, CURRENT_DATE
    WHERE NOT EXISTS (SELECT 1 FROM rh_employees WHERE email = 'zaira.barros@institutoareluna.pt');

    RAISE NOTICE 'Funcionários inseridos com sucesso!';
END $$;

-- Verificar quantos foram inseridos
SELECT COUNT(*) as total_funcionarios FROM rh_employees;
