-- Script SQL para vincular usuários Auth existentes à tabela rh_employees
-- Execute este script no Supabase SQL Editor

-- IMPORTANTE: Este script cria registros em rh_employees para usuários Auth que já existem
-- mas ainda não têm registro de funcionário

DO $$
DECLARE
    supervisor_id_dr_leo UUID := 'eea871de-8303-42d3-965c-ed5d80a97b99';
    default_nif VARCHAR := '999999999';
    default_mobile VARCHAR := '000000000';
    v_user_id UUID;
    v_email VARCHAR;
    v_name VARCHAR;
    v_department VARCHAR;
    v_role VARCHAR;
    v_count INT := 0;
    employee_record RECORD;
BEGIN
    -- Lista de funcionários a criar
    -- Para cada email, buscar o ID do usuário Auth e criar o registro de funcionário
    
    -- Array de funcionários (email, nome, departamento, cargo)
    FOR employee_record IN 
        SELECT * FROM (VALUES 
            ('analyce.silva@institutoareluna.pt', 'Analyce da Silva', 'Operações', 'Funcionário'),
            ('caroline.gomez@institutoareluna.pt', 'Caroline Gomez', 'Operações', 'Funcionário'),
            ('contasareceber@institutoareluna.pt', 'Contas a Receber', 'Financeiro', 'Sistema'),
            ('diego.costa@institutoareluna.pt', 'Diego dos Santos Costa', 'Operações', 'Funcionário'),
            ('draarethuza@institutoareluna.pt', 'Dra. Arethuza', 'Administração', 'Diretora'),
            ('elsa.brilhante@institutoareluna.pt', 'Elsa Brilhante', 'Operações', 'Funcionário'),
            ('erickson.carmo@pinklegion.com', 'Erickson Mendes do Carmo', 'TI', 'Desenvolvedor'),
            ('federica.laporta@institutoareluna.pt', 'Federica Laporta', 'Operações', 'Funcionário'),
            ('gabrielle.fernandez@institutoareluna.pt', 'Gabrielle Fernandez', 'Operações', 'Funcionário'),
            ('gisele.prudencio@institutoareluna.pt', 'Gisele Prudêncio', 'Operações', 'Funcionário'),
            ('graziele.bassi@institutoareluna.pt', 'Graziele Bassi', 'Operações', 'Funcionário'),
            ('julia.cavazini@institutoareluna.pt', 'Júlia Cavazini', 'Operações', 'Funcionário'),
            ('julia.nara@institutoareluna.pt', 'Julia Nara', 'Operações', 'Funcionário'),
            ('kenya.lampert@institutoareluna.pt', 'Kenya Lampert', 'Operações', 'Funcionário'),
            ('leticia.bastos@institutoareluna.pt', 'Letícia Bastos', 'Operações', 'Funcionário'),
            ('liana.hoeller@institutoareluna.pt', 'Liana Hoeller', 'Operações', 'Funcionário'),
            ('lucilene.xavier@institutoareluna.pt', 'Lucilene Xavier', 'Operações', 'Funcionário'),
            ('maria.carolina@institutoareluna.pt', 'Maria Carolina dos Santos Pimentel de Almeida', 'Operações', 'Funcionário'),
            ('maria.ferreira@institutoareluna.pt', 'Maria Júlia Ferreira', 'Operações', 'Funcionário'),
            ('roberta.justino@institutoareluna.pt', 'Roberta Justino', 'Operações', 'Funcionário'),
            ('sofia.falcato@institutoareluna.pt', 'Sofia Falcato', 'Operações', 'Funcionário'),
            ('suzan.silva@institutoareluna.pt', 'Suzan Silva', 'Operações', 'Funcionário'),
            ('tais.souza@institutoareluna.pt', 'Tais Valeria Souza', 'Operações', 'Funcionário'),
            ('zaira.barros@institutoareluna.pt', 'Zaira Barros', 'Operações', 'Funcionário')
        ) AS t(email, name, department, role)
    LOOP
        v_email := employee_record.email;
        v_name := employee_record.name;
        v_department := employee_record.department;
        v_role := employee_record.role;
        -- Buscar o ID do usuário Auth
        SELECT id INTO v_user_id
        FROM auth.users
        WHERE email = v_email
        LIMIT 1;
        
        IF v_user_id IS NOT NULL THEN
            -- Verificar se já existe em rh_employees
            IF NOT EXISTS (SELECT 1 FROM rh_employees WHERE id = v_user_id) THEN
                -- Inserir o funcionário com NIF único
                INSERT INTO rh_employees (
                    id,
                    name,
                    email,
                    nif,
                    mobile,
                    department,
                    role,
                    status,
                    supervisor_id,
                    hire_date
                ) VALUES (
                    v_user_id,
                    v_name,
                    v_email,
                    '99999' || LPAD(v_count::TEXT, 4, '0'), -- NIF único: 999990000, 999990001, etc
                    default_mobile,
                    v_department,
                    v_role,
                    'ACTIVE',
                    supervisor_id_dr_leo,
                    CURRENT_DATE
                );
                
                v_count := v_count + 1;
                RAISE NOTICE '✅ Criado: % (%)', v_name, v_email;
            ELSE
                RAISE NOTICE '⏭️  Já existe: % (%)', v_name, v_email;
            END IF;
        ELSE
            RAISE NOTICE '❌ Usuário Auth não encontrado: %', v_email;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESUMO: % funcionários vinculados com sucesso!', v_count;
END $$;

-- Verificar o resultado
SELECT 
    COUNT(*) as total_funcionarios,
    COUNT(CASE WHEN supervisor_id = 'eea871de-8303-42d3-965c-ed5d80a97b99' THEN 1 END) as com_dr_leo_supervisor
FROM rh_employees;
