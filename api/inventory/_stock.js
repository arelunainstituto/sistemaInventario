// Helper compartilhado para consultas de stock disponível.
// Usado pelas telas de saída/transferência/ajuste para mostrar
// stock disponível por localização + lote antes de submeter.

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Retorna stock disponível para um item, agrupado por localização e lote.
 * Inclui apenas registros com quantity > 0.
 */
async function getStockByItem(itemId) {
    const { data, error } = await supabaseAdmin
        .from('inv_stock')
        .select(`
            quantity, location_id, lot_id,
            location:inv_locations!location_id(id, name, can_send, unit:inv_units!unit_id(id, name)),
            lot:inv_lots!lot_id(id, lot_number, expiry_date, manufacture_date)
        `)
        .eq('item_id', itemId)
        .gt('quantity', 0)
        .order('quantity', { ascending: false });
    if (error) throw error;
    return data || [];
}

/**
 * Retorna stock atual para o triplo (item, location, lot).
 * Usado para validação antes de submeter saída/ajuste.
 */
async function getStockAt(itemId, locationId, lotId) {
    let q = supabaseAdmin
        .from('inv_stock')
        .select('quantity')
        .eq('item_id', itemId)
        .eq('location_id', locationId);
    q = lotId ? q.eq('lot_id', lotId) : q.is('lot_id', null);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    return data ? parseFloat(data.quantity) : 0;
}

/**
 * Parseia mensagens de exceção das functions plpgsql que vêm no formato
 * "CODIGO|chave=valor|chave=valor". Retorna { code, fields } ou null.
 */
function parsePgException(message) {
    if (!message || typeof message !== 'string') return null;
    const parts = message.split('|');
    if (parts.length < 2) return null;
    const code = parts[0].trim();
    if (!/^[A-Z_]+$/.test(code)) return null;
    const fields = {};
    for (const p of parts.slice(1)) {
        const eq = p.indexOf('=');
        if (eq > 0) fields[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
    }
    return { code, fields };
}

/**
 * Enriquece uma lista de movimentos com is_cancelled (existe estorno
 * apontando para ele) e is_reversal (é um estorno). Faz uma única query
 * extra em inv_movements para os IDs do batch.
 */
async function attachCancellationStatus(rows) {
    const ids = (rows || []).map(r => r.id).filter(Boolean);
    if (!ids.length) return rows;
    const { data: revs } = await supabaseAdmin
        .from('inv_movements')
        .select('reversal_of_movement_id')
        .in('reversal_of_movement_id', ids);
    const cancelledIds = new Set((revs || []).map(r => r.reversal_of_movement_id));
    return rows.map(r => ({
        ...r,
        is_cancelled: cancelledIds.has(r.id),
        is_reversal:  !!r.reversal_of_movement_id
    }));
}

module.exports = { supabaseAdmin, getStockByItem, getStockAt, parsePgException, attachCancellationStatus };
