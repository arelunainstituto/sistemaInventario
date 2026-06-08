const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Usar Service Role para operações administrativas
const supabase = createClient(supabaseUrl, supabaseKey);

// Roles do módulo Inventário que o modal HR sabe atribuir.
// Mantenha em sync com database/inventory-refactor/01-roles-permissions.sql.
const INVENTORY_ROLE_NAMES = ['Inventory_Admin', 'Inventory_Operador', 'Inventory_Consulta', 'Inventory_Contabilidade'];

/**
 * Helper: Garante que um employee tenha uma conta Auth + public.users + user_profiles.
 * Chamado quando o admin configura senha/módulos para um employee sem user_id.
 *
 * Retorna { userId, tenantId, error }. `error` é uma string descritiva quando
 * NÃO foi possível garantir um perfil utilizável (ex.: tenant_id do criador
 * ausente, sem o qual o usuário ficaria sem user_profiles e seria trancado
 * pelo middleware de auth no primeiro login). Nesse caso, `userId` pode estar
 * preenchido com o auth.users criado mas a operação como um todo deve ser
 * tratada como falha pelo caller.
 */
async function ensureAuthUserAndProfile(email, name, password, creatorUserId) {
    try {
        let userId = null;

        // 1. Tentar criar usuário Auth
        const { data: newAuthUser, error: createAuthErr } = await supabase.auth.admin.createUser({
            email: email,
            password: password || 'Mudar@' + Math.random().toString(36).slice(2, 10),
            email_confirm: true,
            user_metadata: { full_name: name }
        });

        if (createAuthErr) {
            if (createAuthErr.code === 'email_exists') {
                // Usuário já existe no Auth — obter seu ID via generateLink
                console.log(`[RH] Auth user já existe para ${email}, obtendo ID via generateLink...`);
                const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
                    type: 'magiclink',
                    email: email,
                });
                if (linkErr || !linkData?.user?.id) {
                    console.error('[RH] Falha ao obter user_id via generateLink:', linkErr?.message);
                    return { userId: null, tenantId: null, error: 'Falha ao localizar usuário Auth existente: ' + (linkErr?.message || 'erro desconhecido') };
                }
                userId = linkData.user.id;
                console.log(`[RH] user_id obtido via generateLink: ${userId}`);

                // Se foi fornecida nova senha, atualizar
                if (password) {
                    await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
                }
            } else {
                console.error('[RH] Erro ao criar Auth user:', createAuthErr.message);
                return { userId: null, tenantId: null, error: 'Erro ao criar conta Auth: ' + createAuthErr.message };
            }
        } else {
            userId = newAuthUser.user.id;
            console.log(`[RH] Novo Auth user criado para ${email}: ${userId}`);
        }

        // 2. Garantir entrada em public.users (referenciada por FK de user_profiles)
        const { data: existPublicUser } = await supabase
            .from('users')
            .select('id')
            .eq('id', userId)
            .maybeSingle();

        if (!existPublicUser) {
            const { error: pubUserErr } = await supabase.from('users').insert([{
                id: userId,
                name: name,
                email: email
            }]);
            if (pubUserErr) console.error('[RH] Erro ao criar public.users:', pubUserErr.message);
            else console.log(`[RH] Inserido em public.users: ${userId}`);
        }

        // 3. Obter tenant_id do criador
        const { data: creatorProfile } = await supabase
            .from('user_profiles')
            .select('tenant_id')
            .eq('user_id', creatorUserId)
            .maybeSingle();
        const tenantId = creatorProfile?.tenant_id || null;

        // 4. Criar user_profiles se não existir
        const { data: existProfile } = await supabase
            .from('user_profiles')
            .select('user_id')
            .eq('user_id', userId)
            .maybeSingle();

        if (!existProfile) {
            if (!tenantId) {
                // FATAL: sem tenant_id não cria profile, e sem profile o usuário
                // será 403'd pelo middleware no primeiro login. Falhar a operação.
                const msg = 'tenant_id do criador é NULL — impossível criar user_profiles. O usuário criado em auth.users ficaria trancado. Garanta que o admin que está criando o usuário tem tenant_id em seu próprio user_profiles.';
                console.error('[RH] ' + msg);
                return { userId, tenantId: null, error: msg };
            }
            const { error: profileErr } = await supabase.from('user_profiles').insert([{
                user_id: userId,
                display_name: name,
                first_name: name.split(' ')[0],
                tenant_id: tenantId,
                is_active: true
            }]);
            if (profileErr) {
                console.error('[RH] Erro ao criar user_profiles:', profileErr.message);
                return { userId, tenantId, error: 'Erro ao criar user_profiles: ' + profileErr.message };
            }
            console.log(`[RH] user_profiles criado para ${userId}`);
        } else {
            console.log(`[RH] user_profiles já existia para ${userId}`);
        }

        return { userId, tenantId, error: null };
    } catch (err) {
        console.error('[RH] Erro inesperado em ensureAuthUserAndProfile:', err.message);
        return { userId: null, tenantId: null, error: 'Erro inesperado: ' + err.message };
    }
}

/**
 * Helper: aplica a role do Inventário a um usuário. Substitui qualquer role
 * Inventory_* existente (um usuário tem no máximo UMA role inventário).
 *
 * @param {string} userId
 * @param {string|null} roleName - Nome da role (ex.: 'Inventory_Admin') ou null/'' para remover.
 * @param {string|null} tenantId - tenant_id a vincular ao user_role (opcional, depende do schema).
 * @returns {Promise<{ok: boolean, applied: string|null, error: string|null}>}
 */
async function assignInventoryRole(userId, roleName, tenantId) {
    if (!userId) return { ok: false, applied: null, error: 'userId vazio' };

    // Validar role: só aceita as 4 oficiais ou vazio (remove)
    const wantsRemove = !roleName || roleName === '' || roleName === 'none';
    if (!wantsRemove && !INVENTORY_ROLE_NAMES.includes(roleName)) {
        return { ok: false, applied: null, error: `Role inválida: "${roleName}" (esperado: ${INVENTORY_ROLE_NAMES.join('|')} ou vazio)` };
    }

    try {
        // 1) Buscar IDs de todas as roles Inventory_* — para remover as outras
        const { data: invRoles, error: rolesErr } = await supabase
            .from('roles')
            .select('id, name')
            .in('name', INVENTORY_ROLE_NAMES);
        if (rolesErr) return { ok: false, applied: null, error: 'Erro ao listar roles inventário: ' + rolesErr.message };

        const invRoleIds = (invRoles || []).map(r => r.id);
        if (invRoleIds.length === 0) {
            return { ok: false, applied: null, error: 'Nenhuma role Inventory_* encontrada no DB — aplique database/inventory-refactor/01-roles-permissions.sql' };
        }

        // 2) Remover qualquer role inventário atual
        const { error: delErr } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .in('role_id', invRoleIds);
        if (delErr) return { ok: false, applied: null, error: 'Erro ao remover roles antigas: ' + delErr.message };

        if (wantsRemove) {
            return { ok: true, applied: null, error: null };
        }

        // 3) Inserir a nova
        const newRole = (invRoles || []).find(r => r.name === roleName);
        if (!newRole) return { ok: false, applied: null, error: `Role "${roleName}" não encontrada no DB` };

        const payload = { user_id: userId, role_id: newRole.id, is_active: true };
        if (tenantId) payload.tenant_id = tenantId;

        const { error: insErr } = await supabase.from('user_roles').insert([payload]);
        if (insErr) return { ok: false, applied: null, error: 'Erro ao inserir role: ' + insErr.message };

        return { ok: true, applied: roleName, error: null };
    } catch (err) {
        return { ok: false, applied: null, error: 'Erro inesperado: ' + err.message };
    }
}

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




// GET /export - Exportar todos os funcionários (CSV friendly data)
router.get('/export', requirePermission('HR', 'read'), async (req, res) => {
    try {
        console.log('[RH] Exporting employees...');

        // 1. Fetch Employees
        const { data: employees, error: empError } = await supabase
            .from('rh_employees')
            .select('*')
            .order('name');

        if (empError) throw empError;

        // 2. Fetch Related Data (Payroll, Emergency Contacts, Modules, Clients, Documents)
        // We fetch all and map in memory to avoid N+1 queries

        const { data: payrolls } = await supabase.from('rh_payroll_data').select('*');
        const { data: contacts } = await supabase.from('rh_emergency_contacts').select('*');
        const { data: clients } = await supabase.from('prostoral_clients').select('id, name, user_id');
        const { data: documents } = await supabase.from('rh_documents').select('employee_id, document_type');

        // Map for quick lookup
        const payrollMap = new Map(payrolls?.map(p => [p.employee_id, p]) || []);
        const contactsMap = new Map(); // employee_id -> [contacts]
        (contacts || []).forEach(c => {
            if (!contactsMap.has(c.employee_id)) contactsMap.set(c.employee_id, []);
            contactsMap.get(c.employee_id).push(c);
        });

        // Create user_id -> client_name map
        const clientMap = new Map(clients?.filter(c => c.user_id).map(c => [c.user_id, c.name]) || []);

        // Create employee_id -> documents map (set of types)
        const documentsMap = new Map(); // employee_id -> Set(document_types)
        (documents || []).forEach(d => {
            if (!documentsMap.has(d.employee_id)) documentsMap.set(d.employee_id, new Set());
            documentsMap.get(d.employee_id).add(d.document_type);
        });

        // Create ID -> Name map for supervisors
        const employeeNameMap = new Map(employees.map(e => [e.id, e.name]));

        // 3. Merge Data
        const exportData = employees.map(emp => {
            const payroll = payrollMap.get(emp.id) || {};
            const empContacts = contactsMap.get(emp.id) || [];
            const linkedClient = emp.user_id ? clientMap.get(emp.user_id) : '';
            const empDocs = documentsMap.get(emp.id) || new Set();

            // Supervisor Name
            const supervisorName = emp.supervisor_id ? employeeNameMap.get(emp.supervisor_id) : '';

            // Format contacts as string
            const contactsString = empContacts.map(c =>
                `${c.name} (${c.relationship}): ${c.phone}${c.is_primary ? ' [Principal]' : ''}`
            ).join(' | ');

            // Checklist Status
            const hasCC = empDocs.has('Identificação') || empDocs.has('CC') ? 'Sim' : 'Não';
            const hasAddress = empDocs.has('Comprovativo de Morada') ? 'Sim' : 'Não';
            const hasIBAN = empDocs.has('Comprovativo de IBAN') ? 'Sim' : 'Não';
            const hasNIF = empDocs.has('NIF') ? 'Sim' : 'Não';
            const hasNISS = empDocs.has('NISS') ? 'Sim' : 'Não';

            return {
                // ID & Status
                id: emp.id,
                status: emp.status,

                // Personal
                name: emp.name,
                email: emp.email,
                nif: emp.nif,
                birth_date: emp.birth_date,
                nationality: emp.nationality,
                marital_status: emp.marital_status,
                id_document_type: emp.id_document_type,
                id_document_number: emp.id_document_number,
                niss: emp.niss,
                personal_email: emp.personal_email,
                mobile: emp.mobile,
                address: emp.address,

                // Professional
                department: emp.department,
                role: emp.role,
                professional_category: emp.professional_category,
                employee_number: emp.employee_number,
                contract_type: emp.contract_type,
                hire_date: emp.hire_date,
                work_schedule: emp.work_schedule,
                work_location: emp.work_location,
                supervisor: supervisorName, // Added

                // Corporate
                corporate_email: emp.corporate_email,
                uniform_size: emp.uniform_size,
                has_access_card: emp.has_access_card ? 'Sim' : 'Não',
                has_keys: emp.has_keys ? 'Sim' : 'Não',
                linked_client: linkedClient,

                // Financial (Payroll)
                iban: payroll.iban,
                bank_name: payroll.bank_name,
                salary_currency: payroll.salary_currency || 'EUR',
                base_salary: payroll.base_salary,
                variable_compensation: payroll.variable_compensation,
                meal_allowance: payroll.meal_allowance,
                allowances: payroll.allowances,
                transport_allowance: payroll.transport_allowance,
                tax_dependents: payroll.tax_dependents,
                tax_withholding_option: payroll.tax_withholding_option,

                // Banking (International/Pix)
                bank_country: payroll.bank_country,
                bank_agency: payroll.bank_agency,
                bank_account_number: payroll.bank_account_number,
                pix_key: payroll.pix_key,

                // Emergency
                emergency_contacts: contactsString,

                // Documents Checklist
                doc_cc: hasCC,
                doc_address: hasAddress,
                doc_iban: hasIBAN,
                doc_nif: hasNIF,
                doc_niss: hasNISS,

                notes: emp.notes
            };
        });

        res.json(exportData);

    } catch (error) {
        console.error('Erro ao exportar funcionários:', error);
        res.status(500).json({ error: 'Erro interno ao exportar dados' });
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

        // Buscar role atual do módulo Inventário (no máximo uma Inventory_*)
        data.inventory_role = null;
        if (data.user_id) {
            const { data: userInvRoles } = await supabase
                .from('user_roles')
                .select('roles(name)')
                .eq('user_id', data.user_id)
                .eq('is_active', true);
            const found = (userInvRoles || [])
                .map(ur => ur.roles?.name)
                .find(n => n && INVENTORY_ROLE_NAMES.includes(n));
            if (found) data.inventory_role = found;
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
            linked_client_id, // ID do cliente para vincular
            inventory_role // Optional: 'Inventory_Admin' | 'Inventory_Operador' | 'Inventory_Consulta' | 'Inventory_Contabilidade' | '' (none)
        } = req.body;

        // warnings: avisos não-bloqueantes que voltam no response para o admin ver
        const warnings = [];

        // Validações básicas
        if (!name || !email || !nif) {
            return res.status(400).json({ error: 'Campos obrigatórios: Nome, Email, NIF' });
        }

        // 1. Verificar/Criar Usuário no Supabase Auth + public.users + user_profiles
        const { userId, tenantId, error: authErr } = await ensureAuthUserAndProfile(
            email, name, password || 'Mudar123!', req.user.id
        );

        if (authErr || !userId) {
            return res.status(400).json({
                error: 'Erro ao criar conta de usuário',
                details: authErr || 'userId não retornado'
            });
        }
        console.log(`[RH] userId obtido para ${email}: ${userId}`);

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

            if (modulesError) {
                console.error('Erro ao atribuir módulos:', modulesError);
                warnings.push(`Erro ao atribuir módulos: ${modulesError.message}`);
            }

            // --- Atribuição automática de role baseado em módulo HR ---
            const { data: hrModule } = await supabase.from('modules').select('id').eq('code', 'HR').single();
            const { data: rhManagerRole } = await supabase.from('roles').select('id').eq('name', 'rh_manager').single();
            const { data: empRole } = await supabase.from('roles').select('id').eq('name', 'employee').single();

            if (hrModule && rhManagerRole) {
                const hasHRAccess = modules.includes(hrModule.id);
                const targetRole = hasHRAccess ? rhManagerRole : empRole;
                if (targetRole) {
                    const rolePayload = { user_id: userId, role_id: targetRole.id, is_active: true };
                    if (tenantId) rolePayload.tenant_id = tenantId;
                    const { error: roleErr } = await supabase.from('user_roles').insert([rolePayload]);
                    if (roleErr && roleErr.code !== '23505') {
                        console.error('Erro na atribuição automática de role:', roleErr);
                        warnings.push(`Role base não atribuída: ${roleErr.message}`);
                    }
                }
            }
        } else {
            // Sem módulos: atribuir role 'employee' como padrão
            const { data: empRole } = await supabase.from('roles').select('id').eq('name', 'employee').single();
            if (empRole) {
                const rolePayload = { user_id: userId, role_id: empRole.id, is_active: true };
                if (tenantId) rolePayload.tenant_id = tenantId;
                const { error: roleErr } = await supabase.from('user_roles').insert([rolePayload]);
                if (roleErr && roleErr.code !== '23505') {
                    console.error('Erro ao atribuir role employee:', roleErr);
                    warnings.push(`Role 'employee' não atribuída: ${roleErr.message}`);
                }
            }
        }

        // 6b. Atribuir role do módulo Inventário (se fornecida no modal)
        if (inventory_role !== undefined) {
            const invRes = await assignInventoryRole(userId, inventory_role, tenantId);
            if (!invRes.ok) {
                console.error('Erro ao atribuir role inventário:', invRes.error);
                warnings.push(`Role inventário não aplicada: ${invRes.error}`);
            } else if (invRes.applied) {
                console.log(`[RH] Role inventário "${invRes.applied}" atribuída a ${userId}`);
            }
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

            if (linkError) {
                console.error('Erro ao vincular cliente:', linkError);
                warnings.push(`Cliente não vinculado: ${linkError.message}`);
            }
        }

        res.status(201).json({ ...employee, warnings });
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
        const warnings = [];

        // Sanitize fields
        if (updates.employee_number === '') updates.employee_number = null;
        if (updates.supervisor_id === '') updates.supervisor_id = null;

        // Extrair campos especiais para processamento separado
        const modules = updates.modules;
        const newSalary = updates.salary_base;
        const emergency_contacts = updates.emergency_contacts;
        const payroll_data = updates.payroll_data;
        const password = updates.password;
        const inventoryRoleInput = updates.inventory_role; // pode ser string vazia (remover) ou role válida

        delete updates.modules;
        delete updates.salary_base; // Não atualizar diretamente
        delete updates.emergency_contacts;
        delete updates.payroll_data;
        delete updates.password;
        delete updates.inventory_role;
        delete updates.linked_client_id; // Processar separadamente

        // Remover campos que não devem ser atualizados diretamente
        delete updates.id;
        delete updates.created_at;
        delete updates.user_id; // Não permitir alterar user_id

        // Buscar dados atuais do funcionário
        const { data: currentEmployee, error: fetchError } = await supabase
            .from('rh_employees')
            .select('salary_base, user_id, email, name')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // =====================================================================
        // CORREÇÃO CRÍTICA: Se o employee não tem user_id mas admin está
        // definindo senha ou módulos, criar a conta Auth + profile agora.
        // =====================================================================
        const wantsAccess = (password && password.length >= 6) ||
                            (modules && Array.isArray(modules) && modules.length > 0);

        if (wantsAccess && !currentEmployee.user_id) {
            const employeeEmail = req.body.email || req.body.corporate_email || currentEmployee.email;
            const employeeName = req.body.name || currentEmployee.name;

            console.log(`[RH] Employee ${id} não tem user_id. Criando conta Auth para ${employeeEmail}...`);
            const { userId: newUserId, tenantId: putTenantId, error: authErr } =
                await ensureAuthUserAndProfile(employeeEmail, employeeName, password, req.user.id);

            if (authErr || !newUserId) {
                return res.status(400).json({
                    error: 'Erro ao criar conta de usuário (no UPDATE)',
                    details: authErr || 'userId não retornado'
                });
            }
            // Salvar user_id no employee
            await supabase.from('rh_employees').update({ user_id: newUserId }).eq('id', id);
            currentEmployee.user_id = newUserId;
            console.log(`[RH] user_id ${newUserId} vinculado ao employee ${id}`);

            // Atribuir role base 'employee' se ainda não tiver nenhuma
            const { data: empRole } = await supabase.from('roles').select('id').eq('name', 'employee').single();
            if (empRole) {
                const { data: existRole } = await supabase
                    .from('user_roles').select('id').eq('user_id', newUserId).maybeSingle();
                if (!existRole) {
                    const rolePayload = { user_id: newUserId, role_id: empRole.id, is_active: true };
                    if (putTenantId) rolePayload.tenant_id = putTenantId;
                    const { error: roleErr } = await supabase.from('user_roles').insert([rolePayload]);
                    if (roleErr && roleErr.code !== '23505') {
                        console.error('[RH] Erro ao atribuir role padrão:', roleErr);
                        warnings.push(`Role 'employee' não atribuída: ${roleErr.message}`);
                    }
                }
            }
        }

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
                    warnings.push(`Erro ao atualizar módulos: ${modulesError.message}`);
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
                                    role_id: rhManagerRole.id,
                                    is_active: true
                                };
                                if (tenantId) rolePayload.tenant_id = tenantId;

                                const { error: roleErr } = await supabase.from('user_roles').insert([rolePayload]);
                                if (roleErr && roleErr.code !== '23505') {
                                    console.error('Erro ao atribuir rh_manager:', roleErr);
                                    warnings.push(`Role rh_manager não atribuída: ${roleErr.message}`);
                                }
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

                if (linkError) {
                    console.error('Erro ao vincular cliente:', linkError);
                    warnings.push(`Cliente não vinculado: ${linkError.message}`);
                }
            }
        }

        // Atualizar role do módulo Inventário (se fornecida)
        if (inventoryRoleInput !== undefined && currentEmployee.user_id) {
            // tenant_id do criador para o user_role
            const { data: creatorProfile } = await supabase
                .from('user_profiles').select('tenant_id').eq('user_id', req.user.id).maybeSingle();
            const invRes = await assignInventoryRole(currentEmployee.user_id, inventoryRoleInput, creatorProfile?.tenant_id);
            if (!invRes.ok) {
                console.error('Erro ao atualizar role inventário:', invRes.error);
                warnings.push(`Role inventário não atualizada: ${invRes.error}`);
            } else {
                console.log(`[RH] Role inventário ${invRes.applied ? `definida como "${invRes.applied}"` : 'removida'} para ${currentEmployee.user_id}`);
            }
        }

        res.json({ ...data, warnings });
    } catch (error) {
        console.error('Erro ao atualizar funcionário:', error);
        res.status(500).json({ error: 'Erro interno ao atualizar funcionário', details: error.message });
    }
});

module.exports = router;
