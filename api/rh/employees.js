const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usar Service Role para operações administrativas
const supabase = createClient(supabaseUrl, supabaseKey);

// GET /clients - Listar todos os clientes disponíveis para vinculação
router.get('/clients', requirePermission('HR', 'read'), async (req, res) => {
    console.log('[RH] GET /clients endpoint hit');
    try {
        console.log('[RH] Fetching clients from prostoral_clients table...');
        const { data, error } = await supabase
            .from('prostoral_clients')
            .select('id, name, user_id')
            .order('name');

        if (error) {
            console.error('[RH] Supabase error fetching clients:', error);
            throw error;
        }

        console.log(`[RH] Found ${data ? data.length : 0} clients`);
        res.json(data);
    } catch (error) {
        console.error('Erro detalhado ao listar clientes:', error);
        res.status(500).json({ error: 'Erro interno ao listar clientes', details: error.message });
    }
});

// GET / - Listar funcionários
router.get('/', requirePermission('HR', 'read_own'), async (req, res) => {
    try {
        const { page = 1, limit = 50, search = '', department = '', status = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = supabase
            .from('rh_employees')
            .select('*', { count: 'exact' });

        // Filtros
        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,nif.ilike.%${search}%`);
        }
        if (department) {
            query = query.eq('department', department);
        }
        if (status) {
            query = query.eq('status', status);
        }

        // Paginação e Ordenação
        query = query
            .order('name', { ascending: true })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) throw error;

        res.json({
            data,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count,
                totalPages: Math.ceil(count / limit)
            }
        });
    } catch (error) {
        console.error('Erro ao listar funcionários:', error);
        res.status(500).json({ error: 'Erro interno ao listar funcionários' });
    }
});



// GET /:id - Detalhes do funcionário
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const requestingUserId = req.user.id;
        const userRoles = req.user.roles || [];
        const isManager = userRoles.includes('Admin') || userRoles.includes('rh_manager');

        // Verificar permissão: Gerente vê tudo, Funcionário vê apenas o seu
        if (!isManager) {
            // Verificar se o ID solicitado pertence ao usuário logado
            const { data: profile } = await supabase
                .from('rh_profiles')
                .select('employee_id')
                .eq('id', requestingUserId)
                .single();

            if (!profile || profile.employee_id !== id) {
                return res.status(403).json({ error: 'Acesso negado' });
            }
        }

        // Buscar funcionário com dados relacionados
        const { data, error } = await supabase
            .from('rh_employees')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Funcionário não encontrado' });

        // Buscar módulos atribuídos ao funcionário
        if (data.user_id) {
            const { data: moduleAccess } = await supabase
                .from('user_module_access')
                .select('module_id')
                .eq('user_id', data.user_id)
                .eq('is_active', true);

            data.modules = moduleAccess ? moduleAccess.map(m => m.module_id) : [];
        } else {
            data.modules = [];
        }

        // Buscar contactos de emergência
        const { data: emergencyContacts } = await supabase
            .from('rh_emergency_contacts')
            .select('*')
            .eq('employee_id', id)
            .order('is_primary', { ascending: false });

        data.emergency_contacts = emergencyContacts || [];

        // Buscar dados de folha de pagamento (apenas para managers)
        if (isManager) {
            const { data: payrollData } = await supabase
                .from('rh_payroll_data')
                .select('*')
                .eq('employee_id', id)
                .single();

            data.payroll = payrollData || null;
        }

        // Buscar documentos
        const { data: documents } = await supabase
            .from('rh_documents')
            .select('*')
            .eq('employee_id', id)
            .order('created_at', { ascending: false });

        data.documents = documents || [];

        // Buscar informações do supervisor
        if (data.supervisor_id) {
            const { data: supervisor } = await supabase
                .from('rh_employees')
                .select('id, name, email, role, department')
                .eq('id', data.supervisor_id)
                .single();

            data.supervisor = supervisor || null;
        }

        // Buscar cliente vinculado
        if (data.user_id) {
            const { data: linkedClient } = await supabase
                .from('prostoral_clients')
                .select('id, name')
                .eq('user_id', data.user_id)
                .single();

            data.linked_client = linkedClient || null;
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar funcionário:', error);
        res.status(500).json({ error: 'Erro interno ao buscar funcionário' });
    }
});

// POST / - Criar funcionário
router.post('/', requirePermission('HR', 'create'), async (req, res) => {
    try {
        const {
            // Existing fields
            name, email, nif, mobile, address, department, role, status, hire_date,

            // New personal data
            birth_date, nationality, marital_status, id_document_type,
            id_document_number, niss, personal_email,

            // New professional data
            contract_type, work_schedule, work_location, employee_number,
            supervisor_id, professional_category,

            // Corporate data
            corporate_email, uniform_size, has_access_card, has_keys, notes,
            show_in_orgchart, // New field
            avatar_url, // New field

            // Related data
            emergency_contacts, // Array of emergency contacts
            payroll_data, // Object with payroll information
            modules, // Array of module IDs
            password, // Optional initial password
            linked_client_id // ID do cliente para vincular
        } = req.body;

        // Validações básicas
        if (!name || !email || !nif) {
            return res.status(400).json({ error: 'Campos obrigatórios: Nome, Email, NIF' });
        }

        // 1. Verificar/Criar Usuário no Supabase Auth
        let userId = null;

        // Verificar se usuário já existe
        const { data: existingUsers, error: searchError } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users.find(u => u.email === email);

        if (existingUser) {
            userId = existingUser.id;
            console.log(`[RH] Usuário existente encontrado para ${email}: ${userId}`);
        } else {
            // Criar novo usuário
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: email,
                password: password || 'Mudar123!', // Use provided password or default
                email_confirm: true,
                user_metadata: {
                    full_name: name,
                    department: department
                }
            });

            if (createError) {
                console.error('Erro ao criar usuário Auth:', createError);
                return res.status(400).json({ error: 'Erro ao criar conta de usuário', details: createError.message });
            }

            userId = newUser.user.id;
            console.log(`[RH] Novo usuário criado para ${email}: ${userId}`);
        }

        // 2. Criar funcionário na tabela rh_employees
        const { data: employee, error: empError } = await supabase
            .from('rh_employees')
            .insert([{
                name,
                email,
                nif,
                mobile,
                address,
                department,
                role,
                status: status || 'ACTIVE',
                hire_date: hire_date || new Date(),
                user_id: userId, // Vincular ao usuário Auth

                // New Personal Data
                birth_date,
                nationality,
                marital_status,
                id_document_type,
                id_document_number,
                niss,
                personal_email,

                // New Professional Data
                contract_type,
                work_schedule,
                work_location,
                work_location,
                employee_number: employee_number || null, // Ensure null if empty to avoid UNIQUE constraint violation
                supervisor_id: supervisor_id || null, // Ensure null if empty
                professional_category,
                professional_category,

                // New Corporate Data
                corporate_email,
                uniform_size,
                has_access_card: has_access_card || false,
                has_keys: has_keys || false,
                show_in_orgchart: show_in_orgchart !== false, // Default true
                avatar_url,
                notes
            }])
            .select()
            .single();

        if (empError) throw empError;

        // 3. Inserir Contactos de Emergência
        if (emergency_contacts && Array.isArray(emergency_contacts) && emergency_contacts.length > 0) {
            const contactsToInsert = emergency_contacts.map(contact => ({
                employee_id: employee.id,
                name: contact.name,
                relationship: contact.relationship,
                phone: contact.phone,
                alternative_phone: contact.alternative_phone,
                is_primary: contact.is_primary || false,
                medical_notes: contact.medical_notes
            }));

            const { error: contactsError } = await supabase
                .from('rh_emergency_contacts')
                .insert(contactsToInsert);

            if (contactsError) console.error('Erro ao inserir contactos de emergência:', contactsError);
        }

        // 4. Inserir Dados de Folha de Pagamento
        if (payroll_data) {
            const { error: payrollError } = await supabase
                .from('rh_payroll_data')
                .insert([{
                    employee_id: employee.id,
                    iban: payroll_data.iban,
                    bank_name: payroll_data.bank_name,
                    base_salary: payroll_data.base_salary,
                    variable_compensation: payroll_data.variable_compensation,
                    allowances: payroll_data.allowances,
                    meal_allowance: payroll_data.meal_allowance,
                    transport_allowance: payroll_data.transport_allowance,
                    social_security_number: payroll_data.social_security_number || niss, // Use NISS if not provided separately
                    tax_number: payroll_data.tax_number || nif, // Use NIF if not provided separately
                    tax_dependents: payroll_data.tax_dependents,
                    tax_withholding_option: payroll_data.tax_withholding_option,
                    professional_category: payroll_data.professional_category || professional_category,

                    // New Banking Fields
                    bank_country: payroll_data.bank_country || 'PT',
                    bank_agency: payroll_data.bank_agency,
                    bank_account_number: payroll_data.bank_account_number,
                    pix_key: payroll_data.pix_key,
                    pix_key_type: payroll_data.pix_key_type,

                    // Salary Currency
                    salary_currency: payroll_data.salary_currency || 'EUR'
                }]);

            if (payrollError) console.error('Erro ao inserir dados de folha de pagamento:', payrollError);
        }

        // 5. Registrar salário inicial no histórico (se base_salary estiver em payroll_data)
        if (payroll_data && payroll_data.base_salary) {
            await supabase
                .from('rh_salary_history')
                .insert([{
                    employee_id: employee.id,
                    new_salary: payroll_data.base_salary,
                    change_reason: 'Admissão',
                    effective_date: hire_date || new Date(),
                    changed_by: req.user.id
                }]);
        }

        // 6. Atribuir Acesso aos Módulos
        if (modules && Array.isArray(modules) && modules.length > 0) {
            console.log(`[RH] Atribuindo ${modules.length} módulos ao usuário ${userId}`);

            const moduleAccessInserts = modules.map(moduleId => ({
                user_id: userId,
                module_id: moduleId,
                is_active: true,
                granted_by: req.user.id
            }));

            const { error: modulesError } = await supabase
                .from('user_module_access')
                .upsert(moduleAccessInserts, { onConflict: 'user_id, module_id' });

            if (modulesError) console.error('Erro ao atribuir módulos:', modulesError);

            // --- AUTOMATIC ROLE ASSIGNMENT LOGIC ---
            try {
                // 1. Get IDs for HR module and rh_manager role
                const { data: hrModule } = await supabase.from('modules').select('id').eq('code', 'HR').single();
                const { data: rhManagerRole } = await supabase.from('roles').select('id').eq('name', 'rh_manager').single();
                const { data: empRole } = await supabase.from('roles').select('id').eq('name', 'employee').single();

                if (hrModule && rhManagerRole) {
                    const hasHRAccess = modules.includes(hrModule.id);

                    // Fetch tenant_id from current user (admin/manager) or the new user's profile if created
                    // Better to fetch from the creator's profile to propagate correct tenant
                    const { data: creatorProfile } = await supabase
                        .from('user_profiles')
                        .select('tenant_id')
                        .eq('user_id', req.user.id)
                        .single();

                    const tenantId = creatorProfile?.tenant_id;

                    if (hasHRAccess) {
                        console.log(`[RH] Auto-assigning 'rh_manager' to ${userId}`);
                        const rolePayload = {
                            user_id: userId,
                            role_id: rhManagerRole.id
                        };
                        if (tenantId) rolePayload.tenant_id = tenantId;

                        await supabase.from('user_roles').insert([rolePayload]);
                    } else if (empRole) {
                        // Default to employee if not HR
                        console.log(`[RH] Auto-assigning 'employee' to ${userId}`);
                        const rolePayload = {
                            user_id: userId,
                            role_id: empRole.id
                        };
                        if (tenantId) rolePayload.tenant_id = tenantId;

                        await supabase.from('user_roles').insert([rolePayload]);
                    }
                }
            } catch (roleAutoError) {
                console.error('Erro na atribuição automática de role (POST):', roleAutoError);
            }
            // ---------------------------------------
        } else {
            // Default to employee role if no modules selected
            try {
                const { data: empRole } = await supabase.from('roles').select('id').eq('name', 'employee').single();
                if (empRole) {
                    // Fetch tenant_id
                    const { data: creatorProfile } = await supabase
                        .from('user_profiles')
                        .select('tenant_id')
                        .eq('user_id', req.user.id)
                        .single();
                    const tenantId = creatorProfile?.tenant_id;

                    const rolePayload = {
                        user_id: userId,
                        role_id: empRole.id
                    };
                    if (tenantId) rolePayload.tenant_id = tenantId;

                    await supabase.from('user_roles').insert([rolePayload]);
                }
            } catch (e) { console.error(e); }
        }

        // 7. Vincular a cliente (se fornecido)
        if (linked_client_id && userId) {
            console.log(`[RH] Vinculando usuário ${userId} ao cliente ${linked_client_id}`);

            // Primeiro, garantir que este usuário não esteja vinculado a outros clientes
            await supabase
                .from('prostoral_clients')
                .update({ user_id: null })
                .eq('user_id', userId);

            // Vincular ao cliente selecionado
            const { error: linkError } = await supabase
                .from('prostoral_clients')
                .update({ user_id: userId })
                .eq('id', linked_client_id);

            if (linkError) console.error('Erro ao vincular cliente:', linkError);
        }

        res.status(201).json(employee);
    } catch (error) {
        console.error('Erro ao criar funcionário:', error);
        res.status(500).json({ error: 'Erro interno ao criar funcionário', details: error.message });
    }
});

// PUT /:id - Atualizar funcionário
router.put('/:id', requirePermission('HR', 'update'), async (req, res) => {
    try {
        const { id } = req.params;
        const updates = { ...req.body };

        // Sanitize fields
        if (updates.employee_number === '') updates.employee_number = null;
        if (updates.supervisor_id === '') updates.supervisor_id = null;

        // Extrair campos especiais para processamento separado
        const modules = updates.modules;
        const newSalary = updates.salary_base;
        const emergency_contacts = updates.emergency_contacts;
        const payroll_data = updates.payroll_data;
        const password = updates.password;

        delete updates.modules;
        delete updates.salary_base; // Não atualizar diretamente
        delete updates.emergency_contacts;
        delete updates.payroll_data;
        delete updates.password;
        delete updates.linked_client_id; // Processar separadamente

        // Remover campos que não devem ser atualizados diretamente
        delete updates.id;
        delete updates.created_at;
        delete updates.user_id; // Não permitir alterar user_id

        // Buscar dados atuais do funcionário
        const { data: currentEmployee, error: fetchError } = await supabase
            .from('rh_employees')
            .select('salary_base, user_id')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // Atualizar dados do funcionário (exceto salary_base)
        // Atualizar dados do funcionário (exceto salary_base)
        let data, error;

        if (Object.keys(updates).length > 0) {
            const result = await supabase
                .from('rh_employees')
                .update(updates)
                .eq('id', id)
                .select()
                .single();
            data = result.data;
            error = result.error;
        } else {
            const result = await supabase
                .from('rh_employees')
                .select('*')
                .eq('id', id)
                .single();
            data = result.data;
            error = result.error;
        }

        if (error) throw error;

        // Processar mudança de salário se fornecido e diferente do atual
        if (newSalary && parseFloat(newSalary) !== parseFloat(currentEmployee.salary_base || 0)) {
            console.log(`[RH] Atualizando salário de ${currentEmployee.salary_base} para ${newSalary}`);

            // Registrar no histórico salarial
            await supabase
                .from('rh_salary_history')
                .insert([{
                    employee_id: id,
                    old_salary: currentEmployee.salary_base,
                    new_salary: parseFloat(newSalary),
                    change_reason: 'Atualização manual',
                    effective_date: new Date(),
                    changed_by: req.user.id
                }]);

            // Atualizar o salário base na tabela de funcionários
            await supabase
                .from('rh_employees')
                .update({ salary_base: parseFloat(newSalary) })
                .eq('id', id);

            // Atualizar o objeto de resposta
            data.salary_base = parseFloat(newSalary);
        }

        // Atualizar Contactos de Emergência
        if (emergency_contacts && Array.isArray(emergency_contacts)) {
            // Remove existing contacts (simplest strategy for full update)
            await supabase
                .from('rh_emergency_contacts')
                .delete()
                .eq('employee_id', id);

            // Insert new ones
            if (emergency_contacts.length > 0) {
                const contactsToInsert = emergency_contacts.map(contact => ({
                    employee_id: id,
                    name: contact.name,
                    relationship: contact.relationship,
                    phone: contact.phone,
                    alternative_phone: contact.alternative_phone,
                    is_primary: contact.is_primary || false,
                    medical_notes: contact.medical_notes
                }));

                const { error: contactsError } = await supabase
                    .from('rh_emergency_contacts')
                    .insert(contactsToInsert);

                if (contactsError) console.error('Erro ao atualizar contactos de emergência:', contactsError);
            }
        }

        // Atualizar Dados de Folha de Pagamento
        if (payroll_data) {
            const payrollUpdate = {
                employee_id: id,
                iban: payroll_data.iban,
                bank_name: payroll_data.bank_name,
                base_salary: payroll_data.base_salary,
                variable_compensation: payroll_data.variable_compensation,
                allowances: payroll_data.allowances,
                meal_allowance: payroll_data.meal_allowance,
                transport_allowance: payroll_data.transport_allowance,
                social_security_number: payroll_data.social_security_number,
                tax_number: payroll_data.tax_number,
                tax_dependents: payroll_data.tax_dependents,
                tax_withholding_option: payroll_data.tax_withholding_option,
                professional_category: payroll_data.professional_category,

                // New Banking Fields
                bank_country: payroll_data.bank_country,
                bank_agency: payroll_data.bank_agency,
                bank_account_number: payroll_data.bank_account_number,
                pix_key: payroll_data.pix_key,
                pix_key_type: payroll_data.pix_key_type,

                // Salary Currency
                salary_currency: payroll_data.salary_currency
            };

            // Upsert (update if exists, insert if not)
            const { error: payrollError } = await supabase
                .from('rh_payroll_data')
                .upsert(payrollUpdate, { onConflict: 'employee_id' });

            if (payrollError) console.error('Erro ao atualizar folha de pagamento:', payrollError);

            // Se o salário base foi atualizado via payroll_data, atualizar também no rh_employees para manter consistência
            if (payroll_data.base_salary) {
                await supabase
                    .from('rh_employees')
                    .update({ salary_base: payroll_data.base_salary })
                    .eq('id', id);

                data.salary_base = payroll_data.base_salary;
            }
        }

        // Atualizar módulos se fornecidos
        if (modules && Array.isArray(modules) && currentEmployee.user_id) {
            console.log(`[RH] Atualizando ${modules.length} módulos para usuário ${currentEmployee.user_id}`);

            // Primeiro, desativar todos os módulos existentes
            await supabase
                .from('user_module_access')
                .update({ is_active: false })
                .eq('user_id', currentEmployee.user_id);

            // Depois, ativar/criar os módulos selecionados
            if (modules.length > 0) {
                const moduleAccessInserts = modules.map(moduleId => ({
                    user_id: currentEmployee.user_id,
                    module_id: moduleId,
                    is_active: true,
                    granted_by: req.user.id
                }));

                const { error: modulesError } = await supabase
                    .from('user_module_access')
                    .upsert(moduleAccessInserts, { onConflict: 'user_id, module_id' });

                if (modulesError) {
                    console.error('Erro ao atualizar módulos:', modulesError);
                }

                // --- AUTOMATIC ROLE ASSIGNMENT LOGIC ---
                try {
                    // 1. Get IDs for HR module and rh_manager role
                    const { data: hrModule } = await supabase.from('modules').select('id').eq('code', 'HR').single();
                    const { data: rhManagerRole } = await supabase.from('roles').select('id').eq('name', 'rh_manager').single();

                    if (hrModule && rhManagerRole) {
                        const hasHRAccess = modules.includes(hrModule.id);

                        if (hasHRAccess) {
                            // IF user has HR access -> Ensure they have rh_manager role
                            const { data: existingRole } = await supabase
                                .from('user_roles')
                                .select('*')
                                .eq('user_id', currentEmployee.user_id)
                                .eq('role_id', rhManagerRole.id)
                                .single();

                            if (!existingRole) {
                                console.log(`[RH] Auto-assigning 'rh_manager' to ${currentEmployee.user_id}`);

                                // Fetch tenant_id from current user
                                const { data: creatorProfile } = await supabase
                                    .from('user_profiles')
                                    .select('tenant_id')
                                    .eq('user_id', req.user.id)
                                    .single();
                                const tenantId = creatorProfile?.tenant_id;

                                const rolePayload = {
                                    user_id: currentEmployee.user_id,
                                    role_id: rhManagerRole.id
                                };
                                if (tenantId) rolePayload.tenant_id = tenantId;

                                await supabase.from('user_roles').insert([rolePayload]);
                            }
                        } else {
                            // IF user does NOT have HR access -> Remove rh_manager role (if exists)
                            // Crucial: Do NOT remove if they are Admin. But here we only target rh_manager role row.
                            console.log(`[RH] Auto-removing 'rh_manager' from ${currentEmployee.user_id}`);
                            await supabase
                                .from('user_roles')
                                .delete()
                                .eq('user_id', currentEmployee.user_id)
                                .eq('role_id', rhManagerRole.id);
                        }
                    }
                } catch (roleAutoError) {
                    console.error('Erro na atribuição automática de role:', roleAutoError);
                }
                // ---------------------------------------
            }
        }

        // Atualizar Senha (se fornecida e usuário existir)
        if (password && currentEmployee.user_id) {
            console.log(`[RH] Atualizando senha do usuário ${currentEmployee.user_id}`);
            const { error: passwordError } = await supabase.auth.admin.updateUserById(
                currentEmployee.user_id,
                { password: password }
            );

            if (passwordError) {
                console.error('Erro ao atualizar senha:', passwordError);
            }
        }

        // Atualizar Vinculação com Cliente
        const linked_client_id = req.body.linked_client_id;

        // Se linked_client_id foi enviado (mesmo que seja null para desvincular)
        if (currentEmployee.user_id && req.body.hasOwnProperty('linked_client_id')) {
            console.log(`[RH] Atualizando vínculo de cliente para usuário ${currentEmployee.user_id}`);

            // 1. Remover vínculo existente deste usuário com qualquer cliente
            await supabase
                .from('prostoral_clients')
                .update({ user_id: null })
                .eq('user_id', currentEmployee.user_id);

            // 2. Se houver novo ID, criar vínculo
            if (linked_client_id) {
                const { error: linkError } = await supabase
                    .from('prostoral_clients')
                    .update({ user_id: currentEmployee.user_id })
                    .eq('id', linked_client_id);

                if (linkError) console.error('Erro ao vincular cliente:', linkError);
            }
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao atualizar funcionário:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar funcionário', details: error.message });
    }
});

module.exports = router;
