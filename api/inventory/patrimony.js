// Operações de Patrimônio (itens macro_category='patrimonial').
// Fase 2: Entrada (aquisição) — cadastra 1..N unidades por número de série e
// gera um movimento 'entrada' por unidade. Movimentação (Fase 3) e baixa
// (Fase 4) entram aqui depois, reaproveitando inv_serial_units + as colunas
// serial_unit_id/from_employee_id/to_employee_id de inv_movements.

const express = require('express');
const router  = express.Router();
const { requirePermission } = require('../middleware/auth');
const { supabaseAdmin } = require('./_stock');

// POST /entries — aquisição de patrimônio.
// Body: { item_id, location_id, holder_id?, supplier_id?, acquisition_doc?,
//         units: [{ serial_number, acquisition_date?, acquisition_value? }] }
router.post('/entries', requirePermission('inventory', 'entry'), async (req, res) => {
    try {
        const { item_id, location_id, holder_id, supplier_id, acquisition_doc, units } = req.body || {};

        if (!item_id)     return res.status(400).json({ error: 'item_id é obrigatório' });
        if (!location_id) return res.status(400).json({ error: 'location_id (localização inicial) é obrigatório' });
        if (!Array.isArray(units) || units.length === 0)
            return res.status(400).json({ error: 'Pelo menos uma unidade (número de série) é obrigatória' });

        // Fronteira de macro: este fluxo é só de PATRIMÔNIO.
        const { data: item } = await supabaseAdmin
            .from('inv_items').select('id, name, macro_category').eq('id', item_id).single();
        if (!item) return res.status(400).json({ error: 'Item não encontrado' });
        if (item.macro_category !== 'patrimonial')
            return res.status(400).json({ error: `"${item.name}" não é patrimonial — use Consumo › Entrada` });

        // Normaliza/valida séries: não vazias e sem duplicata no próprio formulário.
        const seen = new Set();
        const rows = [];
        for (const [i, u] of units.entries()) {
            const sn = (u.serial_number ?? '').toString().trim();
            if (!sn) return res.status(400).json({ error: `Unidade ${i + 1}: número de série é obrigatório` });
            if (seen.has(sn)) return res.status(400).json({ error: `Número de série "${sn}" duplicado no formulário` });
            seen.add(sn);
            const raw = u.acquisition_value;
            const val = (raw != null && raw !== '') ? parseFloat(raw) : null;
            if (val != null && (!isFinite(val) || val < 0))
                return res.status(400).json({ error: `Unidade ${i + 1}: valor de aquisição inválido (deve ser ≥ 0)` });
            rows.push({
                item_id,
                serial_number:       sn,
                acquisition_date:    u.acquisition_date || null,
                acquisition_value:   val,
                book_value:          val,   // valor contábil inicial = valor de aquisição (depreciação por unidade)
                supplier_id:         supplier_id || null,
                acquisition_doc:     acquisition_doc || null,
                current_location_id: location_id,
                current_holder_id:   holder_id || null,
                status:              'em_uso',
                created_by:          req.user?.id || null,
                updated_by:          req.user?.id || null
            });
        }

        // Rejeita séries que já existem para este item (não soft-deleted).
        const { data: existing } = await supabaseAdmin
            .from('inv_serial_units')
            .select('serial_number')
            .eq('item_id', item_id)
            .is('deleted_at', null)
            .in('serial_number', [...seen]);
        if (existing && existing.length) {
            const list = existing.map(e => e.serial_number).slice(0, 10).join(', ');
            return res.status(409).json({ error: `Número(s) de série já cadastrado(s) para este item: ${list}` });
        }

        // 1) Insere as unidades.
        const { data: created, error: insErr } = await supabaseAdmin
            .from('inv_serial_units').insert(rows).select('id, serial_number, acquisition_value');
        if (insErr) {
            if (insErr.code === '23505') return res.status(409).json({ error: 'Número de série duplicado para este item' });
            if (insErr.code === '23514') return res.status(400).json({ error: 'Valor de aquisição inválido (deve ser ≥ 0)' });
            if (insErr.code === '23503') return res.status(400).json({ error: 'Localização, colaborador ou fornecedor inexistente' });
            throw insErr;
        }

        // 2) Um movimento 'entrada' por unidade (trilha de auditoria / kardex).
        const movements = created.map(u => ({
            type:            'entrada',
            subtype:         'aquisicao_patrimonial',
            item_id,
            serial_unit_id:  u.id,
            to_location_id:  location_id,
            to_employee_id:  holder_id || null,
            quantity:        1,
            unit_cost:       u.acquisition_value,
            total_cost:      u.acquisition_value,
            supplier_id:     supplier_id || null,
            document_number: acquisition_doc || null,
            justification:   'Aquisição de patrimônio',
            user_id:         req.user?.id || null
        }));
        const { error: movErr } = await supabaseAdmin.from('inv_movements').insert(movements);
        if (movErr) {
            // Compensação: remove as unidades criadas nesta chamada (sem trail).
            // Se a própria reversão falhar, as unidades ficam sem movimento de
            // entrada — avisa explicitamente em vez de mascarar como 500 genérico.
            const { error: delErr } = await supabaseAdmin
                .from('inv_serial_units').delete().in('id', created.map(u => u.id));
            if (delErr) {
                console.error('Compensação falhou — unidades órfãs sem movimento:', created.map(u => u.id), delErr.message);
                return res.status(500).json({
                    error: 'Falha ao registar o movimento de entrada e a reversão das unidades também falhou. ' +
                           `Unidades cadastradas sem trilha: ${rows.map(r => r.serial_number).join(', ')}. Contacte o suporte.`
                });
            }
            throw movErr;
        }

        res.status(201).json({ success: true, data: { created_units: created.length } });
    } catch (err) {
        console.error('POST patrimony/entries error:', err);
        res.status(500).json({ error: err.message || 'Erro ao registar entrada de patrimônio' });
    }
});

// Embeds (hints por coluna FK; from/to apontam para as mesmas tabelas).
const MOVEMENT_SELECT = `
    id, occurred_at, quantity, justification,
    serial_unit:inv_serial_units!serial_unit_id(id, serial_number, item:inv_items!item_id(id, internal_code, name)),
    from_location:inv_locations!from_location_id(id, name, unit:inv_units(id, name)),
    to_location:inv_locations!to_location_id(id, name, unit:inv_units(id, name)),
    from_employee:rh_employees!from_employee_id(id, name),
    to_employee:rh_employees!to_employee_id(id, name)
`;

// GET /movements — histórico de movimentações de patrimônio.
router.get('/movements', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('inv_movements')
            .select(MOVEMENT_SELECT)
            .eq('subtype', 'movimentacao_patrimonial')
            .order('occurred_at', { ascending: false })
            .limit(parseInt(req.query.limit) || 100);
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET patrimony/movements error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar movimentações' });
    }
});

// POST /movements — reatribui uma unidade: origem (local/colaborador atuais) →
// destino (nova localização e/ou colaborador). Atualiza o estado da unidade e
// grava UM movimento com origem e destino (local + colaborador).
// Body: { serial_unit_id, to_location_id, to_employee_id?, justification? }
router.post('/movements', requirePermission('inventory', 'transfer'), async (req, res) => {
    try {
        const { serial_unit_id, to_location_id, to_employee_id, justification } = req.body || {};
        if (!serial_unit_id) return res.status(400).json({ error: 'serial_unit_id é obrigatório' });
        if (!to_location_id) return res.status(400).json({ error: 'to_location_id (localização de destino) é obrigatório' });

        const { data: unit } = await supabaseAdmin
            .from('inv_serial_units')
            .select('id, item_id, current_location_id, current_holder_id, status, serial_number')
            .eq('id', serial_unit_id).is('deleted_at', null).single();
        if (!unit) return res.status(404).json({ error: 'Unidade não encontrada' });
        if (unit.status === 'baixado') return res.status(400).json({ error: 'Unidade baixada não pode ser movimentada' });

        const newHolder = to_employee_id || null;
        if (to_location_id === unit.current_location_id && newHolder === (unit.current_holder_id || null))
            return res.status(400).json({ error: 'Nada mudou — escolha uma localização ou colaborador diferente da origem' });

        const fromLoc = unit.current_location_id, fromHolder = unit.current_holder_id;

        // 1) Atualiza o estado ATUAL da unidade — com guarda de concorrência
        //    otimista: só atualiza se a origem ainda for a que lemos. Se outra
        //    operação já moveu a unidade (duplo clique/2 operadores), 0 linhas
        //    são afetadas e abortamos, evitando um movimento com origem defasada.
        let upd = supabaseAdmin.from('inv_serial_units')
            .update({ current_location_id: to_location_id, current_holder_id: newHolder, updated_by: req.user?.id || null })
            .eq('id', unit.id);
        upd = (fromLoc == null)    ? upd.is('current_location_id', null) : upd.eq('current_location_id', fromLoc);
        upd = (fromHolder == null) ? upd.is('current_holder_id', null)   : upd.eq('current_holder_id', fromHolder);
        const { data: updated, error: upErr } = await upd.select('id');
        if (upErr) {
            if (upErr.code === '23503') return res.status(400).json({ error: 'Localização ou colaborador inexistente' });
            throw upErr;
        }
        if (!updated || !updated.length)
            return res.status(409).json({ error: 'A unidade foi movimentada por outra operação — recarregue e tente novamente.' });

        // 2) Movimento (origem→destino, local + colaborador). Reverte se falhar.
        const { error: movErr } = await supabaseAdmin.from('inv_movements').insert({
            type:             'transferencia_saida',
            subtype:          'movimentacao_patrimonial',
            item_id:          unit.item_id,
            serial_unit_id:   unit.id,
            from_location_id: fromLoc,
            to_location_id,
            from_employee_id: fromHolder,
            to_employee_id:   newHolder,
            quantity:         1,
            justification:    justification || 'Movimentação de patrimônio',
            user_id:          req.user?.id || null
        });
        if (movErr) {
            const { error: revErr } = await supabaseAdmin.from('inv_serial_units')
                .update({ current_location_id: fromLoc, current_holder_id: fromHolder }).eq('id', unit.id);
            if (revErr) {
                console.error('Reversão da movimentação falhou — unidade movida sem trilha:', unit.id, revErr.message);
                return res.status(500).json({
                    error: `Falha ao registar o movimento e a reversão também falhou. A unidade ${unit.serial_number} pode estar movida sem trilha — contacte o suporte.`
                });
            }
            throw movErr;
        }

        res.status(201).json({ success: true, data: { serial_unit_id: unit.id } });
    } catch (err) {
        console.error('POST patrimony/movements error:', err);
        res.status(500).json({ error: err.message || 'Erro ao movimentar patrimônio' });
    }
});

// Embeds para a listagem de baixas (origem = última localização/colaborador).
const WRITEOFF_SELECT = `
    id, occurred_at, justification,
    serial_unit:inv_serial_units!serial_unit_id(id, serial_number, status, write_off_date, item:inv_items!item_id(id, internal_code, name)),
    from_location:inv_locations!from_location_id(id, name, unit:inv_units(id, name)),
    from_employee:rh_employees!from_employee_id(id, name)
`;

// GET /write-offs — histórico de baixas de patrimônio.
router.get('/write-offs', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('inv_movements')
            .select(WRITEOFF_SELECT)
            .eq('subtype', 'baixa')
            .order('occurred_at', { ascending: false })
            .limit(parseInt(req.query.limit) || 100);
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('GET patrimony/write-offs error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar baixas' });
    }
});

// POST /write-offs — baixa de uma unidade com motivo. Marca status='baixado',
// grava motivo/data e registra um movimento 'saida' subtype 'baixa'.
// Body: { serial_unit_id, reason, write_off_date? }
router.post('/write-offs', requirePermission('inventory', 'exit'), async (req, res) => {
    try {
        const { serial_unit_id, reason, write_off_date } = req.body || {};
        if (!serial_unit_id)        return res.status(400).json({ error: 'serial_unit_id é obrigatório' });
        if (!reason || !reason.trim()) return res.status(400).json({ error: 'Motivo da baixa é obrigatório' });

        const { data: unit } = await supabaseAdmin
            .from('inv_serial_units')
            .select('id, item_id, current_location_id, current_holder_id, status, serial_number')
            .eq('id', serial_unit_id).is('deleted_at', null).single();
        if (!unit) return res.status(404).json({ error: 'Unidade não encontrada' });
        if (unit.status === 'baixado') return res.status(400).json({ error: 'Unidade já está baixada' });

        const wDate = write_off_date || new Date().toISOString().slice(0, 10);

        // 1) Baixa com guarda otimista: não baixa de novo se já mudou (concorrência).
        const { data: updated, error: upErr } = await supabaseAdmin
            .from('inv_serial_units')
            .update({ status: 'baixado', write_off_reason: reason.trim(), write_off_date: wDate, updated_by: req.user?.id || null })
            .eq('id', unit.id).neq('status', 'baixado').select('id');
        if (upErr) throw upErr;
        if (!updated || !updated.length)
            return res.status(409).json({ error: 'A unidade já foi baixada por outra operação.' });

        // 2) Movimento 'saida'/'baixa'. Reverte a baixa se falhar.
        const { error: movErr } = await supabaseAdmin.from('inv_movements').insert({
            type:             'saida',
            subtype:          'baixa',
            item_id:          unit.item_id,
            serial_unit_id:   unit.id,
            from_location_id: unit.current_location_id,
            from_employee_id: unit.current_holder_id,
            quantity:         1,
            justification:    reason.trim(),
            user_id:          req.user?.id || null
        });
        if (movErr) {
            const { error: revErr } = await supabaseAdmin.from('inv_serial_units')
                .update({ status: unit.status, write_off_reason: null, write_off_date: null }).eq('id', unit.id);
            if (revErr) {
                console.error('Reversão da baixa falhou:', unit.id, revErr.message);
                return res.status(500).json({
                    error: `Falha ao registar a baixa e a reversão também falhou. A unidade ${unit.serial_number} pode estar inconsistente — contacte o suporte.`
                });
            }
            throw movErr;
        }

        res.status(201).json({ success: true, data: { serial_unit_id: unit.id } });
    } catch (err) {
        console.error('POST patrimony/write-offs error:', err);
        res.status(500).json({ error: err.message || 'Erro ao dar baixa' });
    }
});

module.exports = router;
