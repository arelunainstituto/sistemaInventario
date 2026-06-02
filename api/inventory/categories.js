const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const VALID_MACROS  = ['consumo','patrimonial'];
const VALID_WINDOWS = [30, 60, 90, 180, 365];

// Profundidade máxima permitida por macro. Patrimonial pode ter árvores
// profundas (MacBooks → Macbook Air → Macbook Air v2025 → ...).
// Consumo fica em 2 níveis (Categoria → Subcategoria) para manter UX simples.
const MAX_DEPTH = { consumo: 2, patrimonial: 10 };

// GET / — lista plana (compat retrocompatível) com path + depth
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { parent_macro, include_inactive } = req.query;
        let q = supabaseAdmin
            .from('vw_inv_categories_tree')
            .select('*')
            .is('deleted_at', null)
            .order('parent_macro', { ascending: true })
            .order('path', { ascending: true });
        if (parent_macro) q = q.eq('parent_macro', parent_macro);
        if (!include_inactive) q = q.eq('is_active', true);

        const { data, error } = await q;
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET inv_categories error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar categorias' });
    }
});

// GET /tree — árvore aninhada (preferida pelo UI hierárquico)
router.get('/tree', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { parent_macro, include_inactive } = req.query;
        let q = supabaseAdmin
            .from('vw_inv_categories_with_counts')
            .select('*');
        if (parent_macro) q = q.eq('parent_macro', parent_macro);
        if (!include_inactive) q = q.eq('is_active', true);
        const { data, error } = await q.order('name', { ascending: true });
        if (error) throw error;

        // Constrói a árvore in-memory
        const byId = new Map();
        for (const r of (data || [])) {
            byId.set(r.id, { ...r, children: [] });
        }
        const roots = [];
        for (const node of byId.values()) {
            if (node.parent_id && byId.has(node.parent_id)) {
                byId.get(node.parent_id).children.push(node);
            } else {
                roots.push(node);
            }
        }
        res.json({ success: true, data: roots });
    } catch (err) {
        console.error('GET inv_categories/tree error:', err);
        res.status(500).json({ error: err.message || 'Erro ao montar árvore' });
    }
});

// Helper: calcula profundidade atual via view tree
async function getDepth(categoryId) {
    if (!categoryId) return 0;
    const { data } = await supabaseAdmin
        .from('vw_inv_categories_tree')
        .select('depth')
        .eq('id', categoryId)
        .maybeSingle();
    return data?.depth || 0;
}

router.post('/', requirePermission('inventory', 'create_item'), async (req, res) => {
    try {
        const { parent_macro, parent_id = null, name, is_active = true, consumption_window_days = 30 } = req.body;
        if (!parent_macro || !name) return res.status(400).json({ error: 'parent_macro e name são obrigatórios' });
        if (!VALID_MACROS.includes(parent_macro)) return res.status(400).json({ error: 'parent_macro inválido' });
        if (!VALID_WINDOWS.includes(parseInt(consumption_window_days)))
            return res.status(400).json({ error: `consumption_window_days deve ser um de: ${VALID_WINDOWS.join(', ')}` });

        // Limita profundidade por macro (regra de negócio aplicada no API)
        if (parent_id) {
            const parentDepth = await getDepth(parent_id);
            if (parentDepth + 1 > MAX_DEPTH[parent_macro]) {
                return res.status(400).json({
                    error: `Profundidade máxima de ${MAX_DEPTH[parent_macro]} níveis atingida para ${parent_macro}`
                });
            }
        }

        const { data, error } = await supabaseAdmin
            .from('inv_categories')
            .insert({
                parent_macro,
                parent_id,
                name: name.trim(),
                is_active,
                consumption_window_days: parseInt(consumption_window_days)
            })
            .select()
            .single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('POST inv_categories error:', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Já existe categoria com esse nome neste nível' });
        if (err.code === '22023') return res.status(400).json({ error: err.message });
        if (err.code === '02000') return res.status(404).json({ error: err.message });
        res.status(500).json({ error: err.message || 'Erro ao criar categoria' });
    }
});

router.put('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, is_active, consumption_window_days, parent_id } = req.body;
        const patch = {};
        if (name !== undefined) patch.name = name.trim();
        if (is_active !== undefined) patch.is_active = !!is_active;
        if (consumption_window_days !== undefined) {
            if (!VALID_WINDOWS.includes(parseInt(consumption_window_days)))
                return res.status(400).json({ error: `consumption_window_days deve ser um de: ${VALID_WINDOWS.join(', ')}` });
            patch.consumption_window_days = parseInt(consumption_window_days);
        }
        if (parent_id !== undefined) {
            // Valida profundidade ao mover de pai
            if (parent_id !== null) {
                const { data: current } = await supabaseAdmin
                    .from('inv_categories')
                    .select('parent_macro')
                    .eq('id', id)
                    .single();
                const parentDepth = await getDepth(parent_id);
                if (parentDepth + 1 > MAX_DEPTH[current.parent_macro]) {
                    return res.status(400).json({
                        error: `Profundidade máxima de ${MAX_DEPTH[current.parent_macro]} níveis atingida`
                    });
                }
            }
            patch.parent_id = parent_id;
        }
        const { data, error } = await supabaseAdmin
            .from('inv_categories')
            .update(patch)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('PUT inv_categories error:', err);
        if (err.code === '22023') return res.status(400).json({ error: err.message });
        res.status(500).json({ error: err.message || 'Erro ao atualizar categoria' });
    }
});

router.delete('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        // Não permite remover se há filhos ativos
        const { data: child } = await supabaseAdmin
            .from('inv_categories')
            .select('id')
            .eq('parent_id', id)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();
        if (child) {
            return res.status(400).json({ error: 'Categoria tem subcategorias. Remova-as primeiro.' });
        }
        // Não permite se há itens apontando para ela
        const { data: item } = await supabaseAdmin
            .from('inv_items')
            .select('id')
            .eq('subcategory_id', id)
            .is('deleted_at', null)
            .limit(1)
            .maybeSingle();
        if (item) {
            return res.status(400).json({ error: 'Categoria está em uso por itens. Reclassifique-os antes.' });
        }
        const { error } = await supabaseAdmin
            .from('inv_categories')
            .update({ deleted_at: new Date().toISOString(), is_active: false })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE inv_categories error:', err);
        res.status(500).json({ error: err.message || 'Erro ao remover categoria' });
    }
});

module.exports = router;
