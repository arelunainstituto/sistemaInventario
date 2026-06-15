// Unidades por número de série (itens patrimoniais).
// Cada linha é uma unidade física identificável de um produto patrimonial,
// com localização e colaborador atuais e estado (em_uso/inativo/baixado).
// Criação/edição via api/inventory/patrimony.js; aqui só leitura.

const express = require('express');
const router  = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');

// Embeds por nome de coluna FK (mesmo padrão de items.js). holder = rh_employees.
const SERIAL_SELECT = `
    *,
    item:inv_items!item_id(id, internal_code, name, macro_category, subcategory:inv_categories!subcategory_id(id, name)),
    location:inv_locations!current_location_id(id, name, unit:inv_units(id, name)),
    holder:rh_employees!current_holder_id(id, name, department),
    supplier:inv_suppliers!supplier_id(id, name)
`;

const SORTABLE = ['serial_number', 'status', 'acquisition_date', 'acquisition_value', 'created_at'];

// GET / — lista unidades. Filtros: item_id, status, location_id, holder_id, search; page/limit/sort/dir.
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { item_id, status, location_id, holder_id, search, sort, dir, limit = 100, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const sortCol   = SORTABLE.includes(sort) ? sort : 'created_at';
        const ascending = String(dir).toLowerCase() === 'asc';

        let q = supabaseAdmin
            .from('inv_serial_units')
            .select(SERIAL_SELECT, { count: 'exact' })
            .is('deleted_at', null)
            .order(sortCol, { ascending });
        if (sortCol !== 'serial_number') q = q.order('serial_number', { ascending: true });
        q = q.range(offset, offset + parseInt(limit) - 1);

        if (item_id)     q = q.eq('item_id', item_id);
        if (status)      q = q.eq('status', status);
        if (location_id) q = q.eq('current_location_id', location_id);
        if (holder_id)   q = q.eq('current_holder_id', holder_id);
        if (search)      q = q.ilike('serial_number', `%${search}%`);

        const { data, error, count } = await q;
        if (error) throw error;
        res.json({
            success: true,
            data,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil((count || 0) / parseInt(limit)) }
        });
    } catch (err) {
        console.error('GET inv_serial_units error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar unidades' });
    }
});

// GET /:id — unidade + histórico de movimentos
router.get('/:id', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { data: unit, error } = await supabaseAdmin
            .from('inv_serial_units')
            .select(SERIAL_SELECT)
            .eq('id', req.params.id)
            .is('deleted_at', null)
            .single();
        if (error) throw error;
        if (!unit) return res.status(404).json({ error: 'Unidade não encontrada' });

        const { data: movements } = await supabaseAdmin
            .from('inv_movements')
            .select('id, type, subtype, occurred_at, from_location_id, to_location_id, from_employee_id, to_employee_id, justification, unit_cost')
            .eq('serial_unit_id', req.params.id)
            .order('occurred_at', { ascending: false });

        res.json({ success: true, data: { ...unit, movements: movements || [] } });
    } catch (err) {
        console.error('GET inv_serial_units/:id error:', err);
        res.status(500).json({ error: err.message || 'Erro ao obter unidade' });
    }
});

module.exports = router;
