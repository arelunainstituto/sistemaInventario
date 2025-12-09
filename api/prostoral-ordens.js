// =====================================================
// API - SISTEMA DE ORDENS DE SERVIÇO - PROSTORAL
// =====================================================

console.log('🔧 Carregando módulo prostoral-ordens.js...');

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// =====================================================
// HELPER: Get User Tenant
// =====================================================
async function getUserTenant(userId) {
    const { data, error } = await supabase
        .from('user_profiles')
        .select('tenant_id')
        .eq('user_id', userId)
        .single();
    
    if (error || !data) {
        throw new Error('Tenant não encontrado para o usuário');
    }
    
    return data.tenant_id;
}

// =====================================================
// HELPER: Get User Names
// =====================================================
async function getUserNames(userIds) {
    if (!userIds || userIds.length === 0) return {};
    
    const uniqueIds = [...new Set(userIds.filter(id => id))];
    
    // Buscar profiles
    const { data: profiles, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id, display_name, first_name, last_name')
        .in('user_id', uniqueIds);
    
    if (profileError) {
        console.error('Erro ao buscar profiles:', profileError);
    }
    
    // Buscar emails do auth.users usando service role
    const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
    
    const userMap = {};
    
    uniqueIds.forEach(userId => {
        const profile = profiles?.find(p => p.user_id === userId);
        const authUser = users?.find(u => u.id === userId);
        
        // Tentar nome do profile primeiro, depois email
        const name = profile?.display_name || 
                    (profile?.first_name && profile?.last_name ? `${profile.first_name} ${profile.last_name}` : null) ||
                    profile?.first_name ||
                    authUser?.email ||
                    'Usuário';
        
        userMap[userId] = name;
    });
    
    return userMap;
}

// =====================================================
// LISTA DE ORDENS DE SERVIÇO
// GET /api/prostoral/orders
// =====================================================
async function listOrders(req, res) {
    try {
        const userId = req.user.id;
        const tenantId = await getUserTenant(userId);
        
        // Parâmetros de query
        const {
            page = 1,
            limit = 20,
            search = '',
            status = '',
            technician_id = '',
            date_from = '',
            date_to = ''
        } = req.query;

        const offset = (page - 1) * limit;

        // Query base
        let query = supabase
            .from('prostoral_work_orders')
            .select(`
                *,
                client:prostoral_clients(id, name, email, phone)
            `, { count: 'exact' })
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        // Aplicar filtros
        if (search) {
            query = query.or(`order_number.ilike.%${search}%,patient_name.ilike.%${search}%`);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (technician_id) {
            query = query.eq('technician_id', technician_id);
        }

        if (date_from) {
            query = query.gte('created_at', date_from);
        }

        if (date_to) {
            query = query.lte('created_at', date_to);
        }

        // Paginação
        query = query.range(offset, offset + limit - 1);

        const { data: orders, error, count } = await query;

        if (error) {
            console.error('Erro ao listar ordens:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.json({
            success: true,
            orders: orders || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });

    } catch (error) {
        console.error('Erro ao listar ordens:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// DETALHES DE UMA ORDEM
// GET /api/prostoral/orders/:id
// =====================================================
async function getOrderDetails(req, res) {
    try {
        console.log('🔍 getOrderDetails chamado para ID:', req.params.id);
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = await getUserTenant(userId);
        console.log('🔍 Tenant ID:', tenantId);

        const { data: order, error } = await supabase
            .from('prostoral_work_orders')
            .select(`
                *,
                client:prostoral_clients(id, name, email, phone),
                materials:prostoral_work_order_materials(
                    *,
                    inventory_item:prostoral_inventory(id, name, code, unit)
                ),
                time_tracking:prostoral_work_order_time_tracking(*),
                issues:prostoral_work_order_issues(*),
                history:prostoral_work_order_status_history(*)
            `)
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();

        if (error) {
            console.error('Erro ao buscar ordem:', error);
            return res.status(404).json({ success: false, error: 'Ordem não encontrada' });
        }

        // Buscar nomes de usuários envolvidos
        const userIds = [];
        if (order.created_by) userIds.push(order.created_by);
        if (order.technician_id) userIds.push(order.technician_id);
        if (order.time_tracking) {
            order.time_tracking.forEach(t => {
                if (t.technician_id) userIds.push(t.technician_id);
            });
        }
        if (order.issues) {
            order.issues.forEach(i => {
                if (i.reported_by) userIds.push(i.reported_by);
                if (i.responded_by) userIds.push(i.responded_by);
            });
        }
        if (order.history) {
            order.history.forEach(h => {
                if (h.changed_by) userIds.push(h.changed_by);
            });
        }

        const userNames = await getUserNames(userIds);

        return res.json({ success: true, order, userNames });

    } catch (error) {
        console.error('Erro ao buscar detalhes da ordem:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// CRIAR ORDEM DE SERVIÇO
// POST /api/prostoral/orders
// =====================================================
async function createOrder(req, res) {
    try {
        const userId = req.user.id;
        const tenantId = await getUserTenant(userId);

        const {
            client_id,
            patient_name,
            work_type,
            work_description,
            technician_id,
            due_date,
            final_price,
            status = 'received'
        } = req.body;

        // Validações
        if (!client_id || !patient_name || !work_description) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: client_id, patient_name, work_description'
            });
        }

        // Criar ordem diretamente na tabela (não via RPC) para aceitar work_type
        const orderNumber = `OS-${Date.now()}`;
        
        const { data: order, error } = await supabase
            .from('prostoral_work_orders')
            .insert({
                order_number: orderNumber,
                client_id: client_id,
                patient_name: patient_name,
                work_type: work_type || null,
                work_description: work_description,
                technician_id: technician_id || null,
                due_date: due_date || null,
                final_price: final_price || null,
                status: status || 'received',
                tenant_id: tenantId,
                created_by: userId
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar ordem:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(201).json({ success: true, order });

    } catch (error) {
        console.error('Erro ao criar ordem:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// ATUALIZAR ORDEM DE SERVIÇO
// PUT /api/prostoral/orders/:id
// =====================================================
async function updateOrder(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = await getUserTenant(userId);

        // Buscar ordem atual para verificar status
        const { data: currentOrder, error: fetchError } = await supabase
            .from('prostoral_work_orders')
            .select('status')
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .single();

        if (fetchError) {
            console.error('Erro ao buscar ordem:', fetchError);
            return res.status(404).json({ 
                success: false, 
                error: 'Ordem não encontrada' 
            });
        }

        // Bloquear edição de ordem finalizada ou cancelada
        if (currentOrder.status === 'delivered' || currentOrder.status === 'cancelled') {
            console.log('🔒 Tentativa de editar ordem finalizada/cancelada:', id);
            return res.status(403).json({ 
                success: false, 
                error: 'Não é possível editar uma ordem finalizada ou cancelada',
                details: 'Ordens finalizadas ou canceladas estão bloqueadas para edição'
            });
        }

        // Limpar campos que não podem ser atualizados
        const updateData = { ...req.body };
        delete updateData.id;
        delete updateData.order_number;
        delete updateData.tenant_id;
        delete updateData.created_at;
        delete updateData.created_by;
        delete updateData.client; // Relacionamento, não campo direto
        delete updateData.materials; // Relacionamento
        delete updateData.time_tracking; // Relacionamento
        delete updateData.issues; // Relacionamento
        delete updateData.history; // Relacionamento
        
        // Adicionar updated_by
        updateData.updated_by = userId;
        updateData.updated_at = new Date().toISOString();

        console.log('📝 Atualizando ordem:', id);
        console.log('📦 Dados para atualizar:', JSON.stringify(updateData, null, 2));

        const { data: order, error } = await supabase
            .from('prostoral_work_orders')
            .update(updateData)
            .eq('id', id)
            .eq('tenant_id', tenantId)
            .select()
            .single();

        if (error) {
            console.error('❌ Erro ao atualizar ordem:', error);
            console.error('❌ Detalhes do erro:', JSON.stringify(error, null, 2));
            return res.status(500).json({ 
                success: false, 
                error: error.message,
                details: error.details || error.hint
            });
        }

        console.log('✅ Ordem atualizada com sucesso:', order.id);
        return res.json({ success: true, order });

    } catch (error) {
        console.error('❌ Erro ao atualizar ordem (catch):', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// DELETAR ORDEM DE SERVIÇO
// DELETE /api/prostoral/orders/:id
// =====================================================
async function deleteOrder(req, res) {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const tenantId = await getUserTenant(userId);

        const { error } = await supabase
            .from('prostoral_work_orders')
            .delete()
            .eq('id', id)
            .eq('tenant_id', tenantId);

        if (error) {
            console.error('Erro ao deletar ordem:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.json({ success: true, message: 'Ordem deletada com sucesso' });

    } catch (error) {
        console.error('Erro ao deletar ordem:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// ADICIONAR MATERIAL À ORDEM
// POST /api/prostoral/orders/:id/materials
// =====================================================
async function addMaterial(req, res) {
    try {
        const { id: workOrderId } = req.params;
        const userId = req.user.id;
        const tenantId = await getUserTenant(userId);

        // Verificar se a ordem está finalizada
        const { data: order, error: orderError } = await supabase
            .from('prostoral_work_orders')
            .select('status')
            .eq('id', workOrderId)
            .eq('tenant_id', tenantId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ success: false, error: 'Ordem não encontrada' });
        }

        if (order.status === 'delivered' || order.status === 'cancelled') {
            return res.status(403).json({ 
                success: false, 
                error: 'Não é possível adicionar materiais a uma ordem finalizada ou cancelada'
            });
        }

        const {
            inventory_item_id,
            from_kit_id,
            planned_quantity,
            used_quantity,
            unit,
            unit_cost,
            notes
        } = req.body;

        if (!inventory_item_id || !used_quantity) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: inventory_item_id, used_quantity'
            });
        }

        const { data: material, error } = await supabase
            .from('prostoral_work_order_materials')
            .insert({
                work_order_id: workOrderId,
                inventory_item_id,
                from_kit_id,
                planned_quantity,
                used_quantity,
                unit,
                unit_cost,
                notes,
                added_by: userId
            })
            .select(`
                *,
                inventory_item:prostoral_inventory(id, name, code, unit),
                kit:kits(id, nome)
            `)
            .single();

        if (error) {
            console.error('Erro ao adicionar material:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(201).json({ success: true, material });

    } catch (error) {
        console.error('Erro ao adicionar material:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// ADICIONAR KIT COMPLETO À ORDEM
// POST /api/prostoral/orders/:id/materials/kit
// =====================================================
async function addKit(req, res) {
    try {
        const { id: workOrderId } = req.params;
        const userId = req.user.id;
        const { kit_id } = req.body;

        if (!kit_id) {
            return res.status(400).json({
                success: false,
                error: 'Campo obrigatório: kit_id'
            });
        }

        // Chamar function SQL que adiciona o kit completo
        const { data, error } = await supabase
            .rpc('add_kit_materials_to_work_order', {
                p_added_by: userId,
                p_kit_id: kit_id,
                p_work_order_id: workOrderId
            });

        if (error) {
            console.error('Erro ao adicionar kit:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(201).json({
            success: true,
            message: 'Kit adicionado com sucesso',
            materials_added: data
        });

    } catch (error) {
        console.error('Erro ao adicionar kit:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// REMOVER MATERIAL DA ORDEM
// DELETE /api/prostoral/orders/:id/materials/:materialId
// =====================================================
async function removeMaterial(req, res) {
    try {
        const { materialId } = req.params;

        const { error } = await supabase
            .from('prostoral_work_order_materials')
            .delete()
            .eq('id', materialId);

        if (error) {
            console.error('Erro ao remover material:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.json({ success: true, message: 'Material removido com sucesso' });

    } catch (error) {
        console.error('Erro ao remover material:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// INICIAR TIME TRACKING
// POST /api/prostoral/orders/:id/time-tracking
// =====================================================
async function startTimeTracking(req, res) {
    try {
        const { id: workOrderId } = req.params;
        const userId = req.user.id;
        const tenantId = await getUserTenant(userId);

        // Verificar se a ordem está finalizada
        const { data: order, error: orderError } = await supabase
            .from('prostoral_work_orders')
            .select('status')
            .eq('id', workOrderId)
            .eq('tenant_id', tenantId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ success: false, error: 'Ordem não encontrada' });
        }

        if (order.status === 'delivered' || order.status === 'cancelled') {
            return res.status(403).json({ 
                success: false, 
                error: 'Não é possível iniciar trabalho em uma ordem finalizada ou cancelada'
            });
        }

        const { stage, hourly_rate } = req.body;

        if (!stage || !hourly_rate) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: stage, hourly_rate'
            });
        }

        const { data: tracking, error } = await supabase
            .from('prostoral_work_order_time_tracking')
            .insert({
                work_order_id: workOrderId,
                technician_id: userId,
                stage,
                hourly_rate,
                status: 'in_progress'
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao iniciar tracking:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(201).json({ success: true, tracking });

    } catch (error) {
        console.error('Erro ao iniciar tracking:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// ATUALIZAR TIME TRACKING (pause, resume, finish)
// PUT /api/prostoral/orders/:id/time-tracking/:trackingId
// =====================================================
async function updateTimeTracking(req, res) {
    try {
        const { trackingId } = req.params;
        const { action } = req.body; // 'pause', 'resume', 'finish'

        let updateData = {};

        if (action === 'pause') {
            updateData = {
                status: 'paused',
                paused_at: new Date().toISOString()
            };
        } else if (action === 'resume') {
            updateData = {
                status: 'in_progress',
                resumed_at: new Date().toISOString()
            };
        } else if (action === 'finish') {
            updateData = {
                status: 'completed',
                finished_at: new Date().toISOString()
            };
        } else {
            return res.status(400).json({
                success: false,
                error: 'Ação inválida. Use: pause, resume, finish'
            });
        }

        const { data: tracking, error } = await supabase
            .from('prostoral_work_order_time_tracking')
            .update(updateData)
            .eq('id', trackingId)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar tracking:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.json({ success: true, tracking });

    } catch (error) {
        console.error('Erro ao atualizar tracking:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// LISTAR TIME TRACKING DE UMA ORDEM
// GET /api/prostoral/orders/:id/time-tracking
// =====================================================
async function listTimeTracking(req, res) {
    try {
        const { id: workOrderId } = req.params;

        const { data: tracking, error } = await supabase
            .from('prostoral_work_order_time_tracking')
            .select(`
                *,
                technician:auth.users(id, email)
            `)
            .eq('work_order_id', workOrderId)
            .order('started_at', { ascending: false });

        if (error) {
            console.error('Erro ao listar tracking:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.json({ success: true, tracking: tracking || [] });

    } catch (error) {
        console.error('Erro ao listar tracking:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// CRIAR INTERCORRÊNCIA
// POST /api/prostoral/orders/:id/issues
// =====================================================
async function createIssue(req, res) {
    try {
        const { id: workOrderId } = req.params;
        const userId = req.user.id;
        const tenantId = await getUserTenant(userId);

        // Verificar se a ordem existe e pertence ao tenant
        const { data: order, error: orderError } = await supabase
            .from('prostoral_work_orders')
            .select('status')
            .eq('id', workOrderId)
            .eq('tenant_id', tenantId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ success: false, error: 'Ordem não encontrada' });
        }

        // PERMITIR criar intercorrências mesmo em OS finalizada!
        // (útil para reportar problemas após entrega)

        const {
            type,
            severity,
            title,
            description,
            visible_to_client = false
        } = req.body;

        if (!type || !severity || !title || !description) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: type, severity, title, description'
            });
        }

        const { data: issue, error } = await supabase
            .from('prostoral_work_order_issues')
            .insert({
                work_order_id: workOrderId,
                type,
                severity,
                title,
                description,
                visible_to_client,
                reported_by: userId,
                status: 'open'
            })
            .select()
            .single();

        if (error) {
            console.error('Erro ao criar intercorrência:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.status(201).json({ success: true, issue });

    } catch (error) {
        console.error('Erro ao criar intercorrência:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// ATUALIZAR/RESPONDER INTERCORRÊNCIA
// PUT /api/prostoral/orders/:id/issues/:issueId
// =====================================================
async function updateIssue(req, res) {
    try {
        const { issueId } = req.params;
        const userId = req.user.id;

        const updateData = { ...req.body };
        
        // Se está respondendo, adicionar campos
        if (updateData.response) {
            updateData.responded_by = userId;
            updateData.responded_at = new Date().toISOString();
        }

        delete updateData.id;
        delete updateData.work_order_id;
        delete updateData.reported_by;
        delete updateData.created_at;

        const { data: issue, error } = await supabase
            .from('prostoral_work_order_issues')
            .update(updateData)
            .eq('id', issueId)
            .select()
            .single();

        if (error) {
            console.error('Erro ao atualizar intercorrência:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.json({ success: true, issue });

    } catch (error) {
        console.error('Erro ao atualizar intercorrência:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// LISTAR INTERCORRÊNCIAS DE UMA ORDEM
// GET /api/prostoral/orders/:id/issues
// =====================================================
async function listIssues(req, res) {
    try {
        const { id: workOrderId } = req.params;

        const { data: issues, error } = await supabase
            .from('prostoral_work_order_issues')
            .select(`
                *,
                reported_by_user:auth.users!prostoral_work_order_issues_reported_by_fkey(id, email),
                responded_by_user:auth.users!prostoral_work_order_issues_responded_by_fkey(id, email)
            `)
            .eq('work_order_id', workOrderId)
            .order('reported_at', { ascending: false });

        if (error) {
            console.error('Erro ao listar intercorrências:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.json({ success: true, issues: issues || [] });

    } catch (error) {
        console.error('Erro ao listar intercorrências:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// HISTÓRICO DE STATUS
// GET /api/prostoral/orders/:id/history
// =====================================================
async function getOrderHistory(req, res) {
    try {
        const { id: workOrderId } = req.params;

        const { data: history, error } = await supabase
            .from('prostoral_work_order_status_history')
            .select(`
                *,
                changed_by_user:auth.users(id, email)
            `)
            .eq('work_order_id', workOrderId)
            .order('changed_at', { ascending: false });

        if (error) {
            console.error('Erro ao buscar histórico:', error);
            return res.status(500).json({ success: false, error: error.message });
        }

        return res.json({ success: true, history: history || [] });

    } catch (error) {
        console.error('Erro ao buscar histórico:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// =====================================================
// CRIAR OS DE REPARO
// POST /api/prostoral/orders/:id/repair
// =====================================================
async function createRepairOrder(req, res) {
    try {
        const { id: parentOrderId } = req.params;
        const { 
            repair_type,  // 'warranty', 'billable', 'goodwill'
            repair_reason,
            work_description,
            due_date,
            priority
        } = req.body;

        const user = req.user;
        const tenant_id = await getUserTenant(user.id);

        // Validar tipo de reparo
        if (!['warranty', 'billable', 'goodwill'].includes(repair_type)) {
            return res.status(400).json({ 
                success: false, 
                error: 'Tipo de reparo inválido. Use: warranty, billable ou goodwill' 
            });
        }

        // Buscar OS original
        const { data: parentOrder, error: parentError } = await supabase
            .from('prostoral_work_orders')
            .select('*')
            .eq('id', parentOrderId)
            .single();

        if (parentError || !parentOrder) {
            return res.status(404).json({ 
                success: false, 
                error: 'OS original não encontrada' 
            });
        }

        // Verificar se a OS original não é ela mesma um reparo
        if (parentOrder.is_repair) {
            return res.status(400).json({ 
                success: false, 
                error: 'Não é possível criar reparo de um reparo. Use a OS original.' 
            });
        }

        // Gerar número da OS de reparo (baseado no número da OS original)
        const { data: repairCount, error: countError } = await supabase
            .from('prostoral_work_orders')
            .select('id', { count: 'exact' })
            .eq('parent_order_id', parentOrderId);

        const repairNumber = `${parentOrder.order_number}-R${(repairCount?.length || 0) + 1}`;

        // Criar OS de reparo
        const repairOrder = {
            order_number: repairNumber,
            client_id: parentOrder.client_id,
            patient_name: parentOrder.patient_name,
            patient_age: parentOrder.patient_age,
            work_type_id: parentOrder.work_type_id,
            work_type: parentOrder.work_type,
            work_description: work_description || `REPARO: ${parentOrder.work_description}`,
            shade: parentOrder.shade,
            due_date: due_date || null,
            priority: priority || 'high',
            status: 'received',
            technician_id: parentOrder.technician_id,
            account_manager_id: parentOrder.account_manager_id,
            final_price: repair_type === 'warranty' || repair_type === 'goodwill' ? 0 : parentOrder.final_price,
            is_repair: true,
            parent_order_id: parentOrderId,
            repair_type: repair_type,
            repair_reason: repair_reason,
            tenant_id: tenant_id,
            created_by: user.id
        };

        const { data: newRepairOrder, error: createError } = await supabase
            .from('prostoral_work_orders')
            .insert([repairOrder])
            .select()
            .single();

        if (createError) {
            console.error('Erro ao criar OS de reparo:', createError);
            return res.status(500).json({ 
                success: false, 
                error: createError.message 
            });
        }

        // Registrar no histórico da OS original
        await supabase
            .from('prostoral_work_order_history')
            .insert([{
                work_order_id: parentOrderId,
                change_type: 'repair_created',
                details: JSON.stringify({
                    repair_order_id: newRepairOrder.id,
                    repair_order_number: repairNumber,
                    repair_type: repair_type,
                    repair_reason: repair_reason
                }),
                changed_by: user.id,
                tenant_id: tenant_id
            }]);

        return res.json({ 
            success: true, 
            order: newRepairOrder,
            message: 'OS de reparo criada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao criar OS de reparo:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}

// =====================================================
// LISTAR OSs RELACIONADAS (Principal + Reparos)
// GET /api/prostoral/orders/:id/related
// =====================================================
async function getRelatedOrders(req, res) {
    try {
        const { id: orderId } = req.params;
        const user = req.user;

        // Buscar OS fornecida
        const { data: currentOrder, error: currentError } = await supabase
            .from('prostoral_work_orders')
            .select('id, parent_order_id, is_repair')
            .eq('id', orderId)
            .single();

        if (currentError || !currentOrder) {
            return res.status(404).json({ 
                success: false, 
                error: 'OS não encontrada' 
            });
        }

        // Determinar a OS principal
        const parentId = currentOrder.is_repair ? currentOrder.parent_order_id : orderId;

        // Buscar OS principal
        const { data: parentOrder, error: parentError } = await supabase
            .from('prostoral_work_orders')
            .select('*')
            .eq('id', parentId)
            .single();

        if (parentError) {
            console.error('Erro ao buscar OS principal:', parentError);
            return res.status(500).json({ 
                success: false, 
                error: parentError.message 
            });
        }

        // Buscar todos os reparos
        const { data: repairs, error: repairsError } = await supabase
            .from('prostoral_work_orders')
            .select('*')
            .eq('parent_order_id', parentId)
            .order('created_at', { ascending: true });

        if (repairsError) {
            console.error('Erro ao buscar reparos:', repairsError);
            return res.status(500).json({ 
                success: false, 
                error: repairsError.message 
            });
        }

        // Calcular custo total (original + reparos)
        const totalCost = (parentOrder.total_cost || 0) + 
            (repairs || []).reduce((sum, r) => sum + (r.total_cost || 0), 0);

        return res.json({ 
            success: true, 
            parent: parentOrder,
            repairs: repairs || [],
            total_cost: totalCost,
            repairs_count: repairs?.length || 0
        });

    } catch (error) {
        console.error('Erro ao buscar OSs relacionadas:', error);
        return res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
}

// =====================================================
// EXPORTS
// =====================================================
module.exports = {
    listOrders,
    getOrderDetails,
    createOrder,
    updateOrder,
    deleteOrder,
    addMaterial,
    addKit,
    removeMaterial,
    startTimeTracking,
    updateTimeTracking,
    listTimeTracking,
    createIssue,
    updateIssue,
    listIssues,
    getOrderHistory,
    createRepairOrder,
    getRelatedOrders
};

console.log('✅ Módulo prostoral-ordens.js exportado com sucesso!');

