// =====================================================
// PROSTORAL - ROTAS PARA PORTAL DO CLIENTE
// =====================================================

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// =====================================================
// HELPER: Obter Client ID do usuário
// =====================================================
async function getClientId(userId) {
    const { data, error } = await supabase
        .from('prostoral_clients')
        .select('id')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error('Erro ao buscar client_id:', error);
        return null;
    }

    return data?.id;
}

// =====================================================
// VERIFICAR SE USUÁRIO É CLIENTE
// GET /api/prostoral/check-client-role
// =====================================================
async function checkClientRole(req, res) {
    try {
        const user = req.user;
        
        // Verificar se o usuário tem a role "cliente"
        const isClient = user.roles?.includes('cliente') || user.roles?.includes('client');
        
        // Ou verificar se está vinculado a um client na tabela prostoral_clients
        const clientId = await getClientId(user.id);
        
        return res.json({
            isClient: isClient || !!clientId,
            clientId: clientId
        });

    } catch (error) {
        console.error('Erro ao verificar role de cliente:', error);
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// DASHBOARD - KPIs DO CLIENTE
// GET /api/prostoral/client/dashboard/kpis
// =====================================================
async function getClientDashboardKPIs(req, res) {
    try {
        const user = req.user;
        const clientId = await getClientId(user.id);

        if (!clientId) {
            return res.status(403).json({ error: 'Usuário não é cliente' });
        }

        // Total de OSs
        const { count: totalOrders } = await supabase
            .from('prostoral_work_orders')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId);

        // OSs Em Andamento (não entregues, não canceladas)
        const { count: activeOrders } = await supabase
            .from('prostoral_work_orders')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId)
            .not('status', 'in', '(delivered,cancelled)');

        // OSs Concluídas
        const { count: completedOrders } = await supabase
            .from('prostoral_work_orders')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', clientId)
            .eq('status', 'delivered');

        // Intercorrências Abertas (criadas pelo cliente)
        const { count: openIssues } = await supabase
            .from('prostoral_work_order_issues')
            .select('*, prostoral_work_orders!inner(client_id)', { count: 'exact', head: true })
            .eq('prostoral_work_orders.client_id', clientId)
            .eq('created_by_client', true)
            .eq('status', 'open');

        return res.json({
            total_orders: totalOrders || 0,
            active_orders: activeOrders || 0,
            completed_orders: completedOrders || 0,
            open_issues: openIssues || 0
        });

    } catch (error) {
        console.error('Erro ao buscar KPIs do cliente:', error);
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// LISTAR ORDENS RECENTES
// GET /api/prostoral/client/orders/recent
// =====================================================
async function getClientRecentOrders(req, res) {
    try {
        const user = req.user;
        const clientId = await getClientId(user.id);

        if (!clientId) {
            return res.status(403).json({ error: 'Usuário não é cliente' });
        }

        const { data: orders, error } = await supabase
            .from('prostoral_work_orders')
            .select('id, order_number, patient_name, status, received_date')
            .eq('client_id', clientId)
            .order('received_date', { ascending: false })
            .limit(5);

        if (error) {
            throw error;
        }

        return res.json(orders || []);

    } catch (error) {
        console.error('Erro ao buscar ordens recentes:', error);
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// LISTAR TODAS AS ORDENS DO CLIENTE
// GET /api/prostoral/client/orders
// =====================================================
async function listClientOrders(req, res) {
    try {
        const user = req.user;
        const clientId = await getClientId(user.id);

        if (!clientId) {
            return res.status(403).json({ error: 'Usuário não é cliente' });
        }

        const { page = 1, limit = 20, search = '', status = '', date_from = '' } = req.query;
        const offset = (page - 1) * limit;

        // Construir query
        let query = supabase
            .from('prostoral_work_orders')
            .select('*', { count: 'exact' })
            .eq('client_id', clientId);

        // Filtros
        if (search) {
            query = query.or(`order_number.ilike.%${search}%,patient_name.ilike.%${search}%`);
        }

        if (status) {
            query = query.eq('status', status);
        }

        if (date_from) {
            query = query.gte('received_date', date_from);
        }

        // Paginação e ordenação
        query = query
            .order('received_date', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);

        const { data: orders, error, count } = await query;

        if (error) {
            throw error;
        }

        return res.json({
            orders: orders || [],
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / limit)
            }
        });

    } catch (error) {
        console.error('Erro ao listar ordens do cliente:', error);
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// CRIAR NOVA ORDEM (PELO CLIENTE)
// POST /api/prostoral/client/orders
// =====================================================
async function createClientOrder(req, res) {
    try {
        const user = req.user;
        const clientId = await getClientId(user.id);

        if (!clientId) {
            return res.status(403).json({ error: 'Usuário não é cliente' });
        }

        const { patient_name, work_type, work_description, due_date } = req.body;

        if (!patient_name || !work_description) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando' });
        }

        // Buscar tenant_id do cliente
        const { data: client, error: clientError } = await supabase
            .from('prostoral_clients')
            .select('tenant_id')
            .eq('id', clientId)
            .single();

        if (clientError || !client || !client.tenant_id) {
            console.error('Erro ao buscar tenant_id:', clientError);
            return res.status(500).json({ error: 'Erro ao identificar tenant do cliente' });
        }

        // Gerar número da OS
        const orderNumber = `OS-${Date.now()}`;

        // Criar ordem
        const newOrder = {
            order_number: orderNumber,
            client_id: clientId,
            tenant_id: client.tenant_id,
            patient_name,
            work_type: work_type || null,
            work_description,
            due_date: due_date || null,
            status: 'received',
            received_date: new Date().toISOString(),
            created_by: user.id,
            qr_code: `WO-${orderNumber}`,
            qr_code_url: `https://prostoral.app/os/${orderNumber}`
        };

        const { data: order, error } = await supabase
            .from('prostoral_work_orders')
            .insert([newOrder])
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Registrar no histórico
        await supabase
            .from('prostoral_work_order_status_history')
            .insert([{
                work_order_id: order.id,
                old_status: null,
                new_status: 'received',
                changed_by: user.id,
                changed_at: new Date().toISOString(),
                notes: 'Ordem criada pelo cliente'
            }]);

        return res.json({
            success: true,
            order,
            message: 'Ordem criada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao criar ordem:', error);
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// DETALHES DA ORDEM (PELO CLIENTE)
// GET /api/prostoral/client/orders/:id
// =====================================================
async function getClientOrderDetails(req, res) {
    try {
        const { id } = req.params;
        const user = req.user;
        const clientId = await getClientId(user.id);

        if (!clientId) {
            return res.status(403).json({ error: 'Usuário não é cliente' });
        }

        // Buscar ordem
        const { data: order, error: orderError } = await supabase
            .from('prostoral_work_orders')
            .select('*')
            .eq('id', id)
            .eq('client_id', clientId) // Garantir que é a ordem do cliente
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: 'Ordem não encontrada' });
        }

        // Buscar intercorrências criadas pelo cliente
        const { data: clientIssues } = await supabase
            .from('prostoral_work_order_issues')
            .select('*')
            .eq('work_order_id', id)
            .eq('created_by_client', true)
            .order('created_at', { ascending: false });

        // Buscar histórico
        const { data: history } = await supabase
            .from('prostoral_work_order_status_history')
            .select('*')
            .eq('work_order_id', id)
            .order('changed_at', { ascending: false });

        return res.json({
            ...order,
            client_issues: clientIssues || [],
            history: history || []
        });

    } catch (error) {
        console.error('Erro ao buscar detalhes da ordem:', error);
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// CRIAR INTERCORRÊNCIA (PELO CLIENTE)
// POST /api/prostoral/client/orders/:id/issues
// =====================================================
async function createClientIssue(req, res) {
    try {
        const { id: workOrderId } = req.params;
        const user = req.user;
        const clientId = await getClientId(user.id);

        if (!clientId) {
            return res.status(403).json({ error: 'Usuário não é cliente' });
        }

        // Verificar se a ordem pertence ao cliente
        const { data: order, error: orderError } = await supabase
            .from('prostoral_work_orders')
            .select('id, client_id')
            .eq('id', workOrderId)
            .eq('client_id', clientId)
            .single();

        if (orderError || !order) {
            return res.status(404).json({ error: 'Ordem não encontrada' });
        }

        const { title, description, severity = 'medium' } = req.body;

        if (!title || !description) {
            return res.status(400).json({ error: 'Título e descrição são obrigatórios' });
        }

        // Criar intercorrência
        const newIssue = {
            work_order_id: workOrderId,
            title,
            description,
            severity,
            status: 'open',
            created_by: user.id,
            created_by_client: true, // Flag para identificar que foi criada pelo cliente
            created_at: new Date().toISOString()
        };

        const { data: issue, error } = await supabase
            .from('prostoral_work_order_issues')
            .insert([newIssue])
            .select()
            .single();

        if (error) {
            throw error;
        }

        // Registrar no histórico
        await supabase
            .from('prostoral_work_order_status_history')
            .insert([{
                work_order_id: workOrderId,
                old_status: null,
                new_status: null,
                changed_by: user.id,
                changed_at: new Date().toISOString(),
                notes: `Cliente adicionou intercorrência: ${title}`
            }]);

        return res.json({
            success: true,
            issue,
            message: 'Intercorrência criada com sucesso'
        });

    } catch (error) {
        console.error('Erro ao criar intercorrência:', error);
        return res.status(500).json({ error: error.message });
    }
}

// =====================================================
// LISTAR TODOS OS CLIENTES (PARA ADMINS)
// GET /api/prostoral/clients/all
// =====================================================
async function getAllClients(req, res) {
    try {
        const { data: clients, error } = await supabase
            .from('prostoral_clients')
            .select(`
                id,
                name,
                email,
                phone,
                address,
                user_id,
                created_at
            `)
            .order('name');

        if (error) throw error;

        return res.json({
            success: true,
            clients: clients || []
        });

    } catch (error) {
        console.error('Erro ao listar clientes:', error);
        return res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
}

// =====================================================
// VINCULAR USUÁRIO A CLIENTE
// POST /api/prostoral/clients/link-user
// Body: { userId, clientId }
// =====================================================
async function linkUserToClient(req, res) {
    try {
        const { userId, clientId } = req.body;

        if (!userId || !clientId) {
            return res.status(400).json({
                success: false,
                error: 'userId e clientId são obrigatórios'
            });
        }

        // Atualizar o cliente com o user_id
        const { data, error } = await supabase
            .from('prostoral_clients')
            .update({ user_id: userId })
            .eq('id', clientId)
            .select()
            .single();

        if (error) throw error;

        return res.json({
            success: true,
            message: 'Usuário vinculado ao cliente com sucesso',
            client: data
        });

    } catch (error) {
        console.error('Erro ao vincular usuário ao cliente:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// =====================================================
// DESVINCULAR USUÁRIO DE CLIENTE
// POST /api/prostoral/clients/unlink-user
// Body: { userId }
// =====================================================
async function unlinkUserFromClient(req, res) {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                error: 'userId é obrigatório'
            });
        }

        // Remover o user_id do cliente
        const { data, error } = await supabase
            .from('prostoral_clients')
            .update({ user_id: null })
            .eq('user_id', userId)
            .select();

        if (error) throw error;

        return res.json({
            success: true,
            message: 'Usuário desvinculado do cliente com sucesso',
            affectedClients: data
        });

    } catch (error) {
        console.error('Erro ao desvincular usuário do cliente:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// =====================================================
// OBTER CLIENTE VINCULADO AO USUÁRIO
// GET /api/prostoral/clients/by-user/:userId
// =====================================================
async function getClientByUser(req, res) {
    try {
        const { userId } = req.params;

        const { data, error } = await supabase
            .from('prostoral_clients')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = not found
            throw error;
        }

        return res.json({
            success: true,
            client: data || null
        });

    } catch (error) {
        console.error('Erro ao buscar cliente por usuário:', error);
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
    checkClientRole,
    getClientDashboardKPIs,
    getClientRecentOrders,
    listClientOrders,
    createClientOrder,
    getClientOrderDetails,
    createClientIssue,
    getAllClients,
    linkUserToClient,
    unlinkUserFromClient,
    getClientByUser
};

