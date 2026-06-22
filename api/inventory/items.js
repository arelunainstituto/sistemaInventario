const express = require('express');
const router = express.Router();
const multer = require('multer');
const QRCode = require('qrcode');
const { createClient } = require('@supabase/supabase-js');
const { requirePermission } = require('../middleware/auth');

const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 }
});

// Anexos (fotos) de patrimônio: limite um pouco maior p/ fotos de celular.
const attachmentUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

// Hint explícito de FK é necessário porque inv_items tem 3 FKs para
// inv_units_of_measure (base/purchase/consumption). Sem o "!fk_column"
// o PostgREST falha ao tentar resolver a relação.
const ITEM_SELECT = `
    *,
    subcategory:inv_categories!subcategory_id(id, parent_macro, name),
    manufacturer:inv_manufacturers!manufacturer_id(id, name),
    base_uom:inv_units_of_measure!base_uom_id(id, code, name),
    purchase_uom:inv_units_of_measure!purchase_uom_id(id, code, name),
    consumption_uom:inv_units_of_measure!consumption_uom_id(id, code, name),
    default_supplier:inv_suppliers!default_supplier_id(id, name, tax_id)
`;

// Validação de payload por macro_category
function validateItemPayload(body, isUpdate = false) {
    const errors = [];
    if (!isUpdate) {
        if (!body.macro_category) errors.push('macro_category é obrigatório');
        else if (!['consumo','patrimonial'].includes(body.macro_category)) errors.push('macro_category inválido');
        if (!body.name)        errors.push('name é obrigatório');
        if (!body.base_uom_id) errors.push('base_uom_id é obrigatório');
    }
    if (body.macro_category === 'consumo') {
        const forbidden = ['patrimony_number','acquisition_date','acquisition_value','depreciation_rate','asset_status'];
        for (const f of forbidden) {
            if (body[f] !== undefined && body[f] !== null && body[f] !== '') {
                errors.push(`Campo ${f} não é permitido para itens de consumo`);
            }
        }
    }
    return errors;
}

// Categoria-folha = nenhuma outra categoria ativa a referencia como pai.
// Itens só podem ser atribuídos a folhas (categoria-pai não é selecionável).
async function isLeafCategory(catId) {
    const { count } = await supabaseAdmin
        .from('inv_categories')
        .select('id', { count: 'exact', head: true })
        .eq('parent_id', catId)
        .is('deleted_at', null);
    return (count || 0) === 0;
}
const NON_LEAF_CATEGORY_MSG = 'A categoria selecionada possui subcategorias — escolha uma categoria folha.';

// Helper de upload para Supabase Storage (reaproveita bucket item-images)
async function uploadFile(file, folder) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${folder}/${Date.now()}-${safeName}`;
    const bucket = folder === 'pdfs' ? 'item-pdfs' : 'item-images';
    const { error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) throw error;
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
}

// GET /  — lista itens com filtros
router.get('/', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { macro_category, subcategory_id, search, include_inactive, sort, dir, limit = 100, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Whitelist de colunas ordenáveis — evita injeção no .order()
        const SORTABLE  = ['internal_code', 'name', 'macro_category', 'cmp', 'min_stock', 'is_active', 'created_at'];
        const sortCol   = SORTABLE.includes(sort) ? sort : 'name';
        const ascending = String(dir).toLowerCase() !== 'desc';

        let q = supabaseAdmin
            .from('inv_items')
            .select(ITEM_SELECT, { count: 'exact' })
            .is('deleted_at', null)
            .order(sortCol, { ascending });
        // Desempate estável por internal_code → paginação consistente
        if (sortCol !== 'internal_code') q = q.order('internal_code', { ascending: true });
        q = q.range(offset, offset + parseInt(limit) - 1);

        if (!include_inactive)       q = q.eq('is_active', true);
        if (macro_category)          q = q.eq('macro_category', macro_category);
        if (subcategory_id)          q = q.eq('subcategory_id', subcategory_id);
        if (search) {
            q = q.or(`name.ilike.%${search}%,internal_code.ilike.%${search}%,manufacturer_ref.ilike.%${search}%,barcode.ilike.%${search}%`);
        }

        const { data, error, count } = await q;
        if (error) throw error;
        res.json({
            success: true,
            data,
            pagination: { page: parseInt(page), limit: parseInt(limit), total: count, totalPages: Math.ceil((count || 0) / parseInt(limit)) }
        });
    } catch (err) {
        console.error('GET inv_items error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar itens' });
    }
});

// GET /:id — detalhe + stock por localização
router.get('/:id', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { id } = req.params;
        const { data: item, error } = await supabaseAdmin
            .from('inv_items')
            .select(ITEM_SELECT)
            .eq('id', id)
            .is('deleted_at', null)
            .single();
        if (error) throw error;
        if (!item) return res.status(404).json({ error: 'Item não encontrado' });

        // Stock agregado por localização (com lote)
        const { data: stock } = await supabaseAdmin
            .from('inv_stock')
            .select('quantity, lot:inv_lots(id, lot_number, expiry_date), location:inv_locations(id, name, unit:inv_units(id, name))')
            .eq('item_id', id);

        // Fase 4.3: parâmetros efetivos por localização (apenas consumo).
        // Devolve sempre a lista completa (1 linha por location ativa) com
        // is_override + source_* para a UI poder distinguir herança vs override.
        let location_params = [];
        if (item.macro_category === 'consumo') {
            const { data: ep } = await supabaseAdmin
                .from('vw_inv_item_effective_params')
                .select('*')
                .eq('item_id', id)
                .order('location_name', { ascending: true });
            location_params = ep || [];
        }

        // Patrimônio: as unidades por número de série substituem o conceito de
        // stock (cada unidade = 1 ativo, com localização e colaborador atuais).
        let serial_units = [];
        if (item.macro_category === 'patrimonial') {
            const { data: su } = await supabaseAdmin
                .from('inv_serial_units')
                .select('id, serial_number, status, acquisition_date, acquisition_value, book_value, location:inv_locations!current_location_id(id, name, unit:inv_units(id, name)), holder:rh_employees!current_holder_id(id, name, department)')
                .eq('item_id', id)
                .is('deleted_at', null)
                .order('serial_number', { ascending: true });
            serial_units = su || [];
        }

        res.json({ success: true, data: { ...item, stock: stock || [], location_params, serial_units } });
    } catch (err) {
        console.error('GET inv_items/:id error:', err);
        res.status(500).json({ error: err.message || 'Erro ao obter item' });
    }
});

// POST / — cria item
router.post('/', requirePermission('inventory', 'create_item'), async (req, res) => {
    try {
        // Fase 5.2: a UI pede apenas UM de compra + UM de consumo.
        // base_uom_id é sempre = purchase_uom_id (coluna NOT NULL no DB).
        // Espelhamos ANTES da validação para que ela enxergue o campo
        // já preenchido — caso contrário a validação falha "base_uom_id
        // é obrigatório" mesmo com purchase_uom_id válido.
        if (req.body && !req.body.base_uom_id && req.body.purchase_uom_id) {
            req.body.base_uom_id = req.body.purchase_uom_id;
        }

        const errors = validateItemPayload(req.body, false);
        if (errors.length) return res.status(400).json({ error: errors.join('; ') });

        // uses_serial é sempre derivado do macro. controls_lot agora é escolha
        // do usuário para CONSUMO (checkbox no cadastro): default TRUE quando
        // não informado; PATRIMONIAL sempre FALSE (controla por nº de série).
        const { controls_lot, uses_serial, internal_code, qr_code, patrimony_number, ...rest } = req.body;
        const isConsumo = req.body.macro_category === 'consumo';

        const payload = {
            ...rest,
            controls_lot: isConsumo
                ? (controls_lot === undefined || controls_lot === null ? true : !!controls_lot)
                : false,
            uses_serial:  req.body.macro_category === 'patrimonial',
            created_by:   req.user?.id || null,
            updated_by:   req.user?.id || null
        };

        // Categoria precisa ser folha (sem subcategorias).
        if (payload.subcategory_id && !(await isLeafCategory(payload.subcategory_id))) {
            return res.status(400).json({ error: NON_LEAF_CATEGORY_MSG });
        }

        const { data, error } = await supabaseAdmin
            .from('inv_items')
            .insert(payload)
            .select(ITEM_SELECT)
            .single();
        if (error) throw error;
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('POST inv_items error:', err);
        if (err.code === '23505') return res.status(409).json({ error: 'Conflito de unicidade (código interno ou QR)' });
        res.status(500).json({ error: err.message || 'Erro ao criar item' });
    }
});

// PUT /:id — edita
router.put('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const errors = validateItemPayload(req.body, true);
        if (errors.length) return res.status(400).json({ error: errors.join('; ') });

        // Campos imutáveis após criação. controls_lot saiu daqui: é editável
        // (com guarda abaixo) para permitir ligar/desligar o controle de lote.
        const immutable = ['internal_code','qr_code','macro_category','uses_serial','patrimony_number'];
        // Campos editáveis apenas por Inventory_Admin/Admin (gerenciados normalmente
        // por operações: cmp via entradas, asset_status via depreciação ou saída tipo depreciacao)
        const adminOnly = ['cmp','asset_status'];
        const userRoles = Array.isArray(req.user?.roles) ? req.user.roles : [];
        const isAdmin = userRoles.some(r => ['Inventory_Admin','Admin','admin'].includes(r));

        const patch = { updated_by: req.user?.id || null };
        for (const [k, v] of Object.entries(req.body)) {
            if (immutable.includes(k)) continue;
            if (adminOnly.includes(k) && !isAdmin) {
                return res.status(403).json({
                    error: `Campo '${k}' só pode ser alterado por Inventory_Admin. Use operações (entradas/depreciação) para alterar via fluxo normal.`
                });
            }
            patch[k] = v;
        }

        // Fase 5.2: ao editar, se purchase_uom_id mudou, espelha em base_uom_id
        // (UI nova não pede base — sempre alinhada à compra).
        if (patch.purchase_uom_id) {
            patch.base_uom_id = patch.purchase_uom_id;
        }

        // controls_lot: editável só para CONSUMO e só enquanto o item não tiver
        // lotes (mudar o controle com lotes existentes deixaria o saldo
        // inconsistente entre o bucket por-lote e o sem-lote). Patrimonial
        // ignora (controla sempre por nº de série).
        if (Object.prototype.hasOwnProperty.call(patch, 'controls_lot')) {
            const { data: itemRow } = await supabaseAdmin
                .from('inv_items').select('macro_category').eq('id', id).single();
            if (itemRow?.macro_category !== 'consumo') {
                delete patch.controls_lot;
            } else {
                const { count: lotCount } = await supabaseAdmin
                    .from('inv_lots').select('id', { count: 'exact', head: true }).eq('item_id', id);
                if ((lotCount || 0) > 0) {
                    return res.status(409).json({
                        error: 'Não é possível alterar o controle de lote: o item já possui lotes registrados.'
                    });
                }
                patch.controls_lot = !!patch.controls_lot;
            }
        }

        // Categoria precisa ser folha. Grandfather: se o valor não mudou em
        // relação ao atual, não bloqueia (categoria que virou pai depois).
        if (patch.subcategory_id !== undefined && patch.subcategory_id) {
            const { data: curItem } = await supabaseAdmin
                .from('inv_items').select('subcategory_id').eq('id', id).single();
            if (patch.subcategory_id !== curItem?.subcategory_id
                && !(await isLeafCategory(patch.subcategory_id))) {
                return res.status(400).json({ error: NON_LEAF_CATEGORY_MSG });
            }
        }

        const { data, error } = await supabaseAdmin
            .from('inv_items')
            .update(patch)
            .eq('id', id)
            .select(ITEM_SELECT)
            .single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (err) {
        console.error('PUT inv_items error:', err);
        res.status(500).json({ error: err.message || 'Erro ao atualizar item' });
    }
});

// DELETE /:id — soft delete
router.delete('/:id', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id } = req.params;
        const { error } = await supabaseAdmin
            .from('inv_items')
            .update({ deleted_at: new Date().toISOString(), is_active: false, updated_by: req.user?.id || null })
            .eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE inv_items error:', err);
        res.status(500).json({ error: err.message || 'Erro ao remover item' });
    }
});

// POST /:id/image — upload imagem (substitui a anterior se houver)
router.post('/:id/image', requirePermission('inventory', 'update_item'), upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Arquivo image ausente' });
        if (!req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: 'Apenas imagens são permitidas' });
        const url = await uploadFile(req.file, 'inventory/items');
        const { error } = await supabaseAdmin.from('inv_items').update({ image_url: url, updated_by: req.user?.id || null }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, image_url: url });
    } catch (err) {
        console.error('POST inv_items/:id/image error:', err);
        res.status(500).json({ error: err.message || 'Erro ao fazer upload de imagem' });
    }
});

// DELETE /:id/image — remove imagem do item (zera image_url; arquivo no Storage
// fica órfão para auditoria — limpeza periódica fica fora deste fluxo).
router.delete('/:id/image', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { error } = await supabaseAdmin
            .from('inv_items')
            .update({ image_url: null, updated_by: req.user?.id || null })
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE inv_items/:id/image error:', err);
        res.status(500).json({ error: err.message || 'Erro ao remover imagem' });
    }
});

// POST /:id/pdf — upload PDF (manual/ficha técnica)
router.post('/:id/pdf', requirePermission('inventory', 'update_item'), upload.single('pdf'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'Arquivo pdf ausente' });
        if (req.file.mimetype !== 'application/pdf') return res.status(400).json({ error: 'Apenas PDF é permitido' });
        const url = await uploadFile(req.file, 'pdfs');
        const { error } = await supabaseAdmin.from('inv_items').update({ pdf_url: url }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, pdf_url: url });
    } catch (err) {
        console.error('POST inv_items/:id/pdf error:', err);
        res.status(500).json({ error: err.message || 'Erro ao fazer upload de PDF' });
    }
});

// =====================================================
// Anexos (fotos) por item de patrimônio — até 6 (migração 116)
// =====================================================
const ATTACHMENTS_BUCKET = 'item-attachments';
const MAX_ATTACHMENTS = 6;

// Upload genérico p/ um bucket, devolvendo url pública + caminho (p/ delete).
async function uploadToBucket(file, bucket, folder) {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `${folder}/${Date.now()}-${safeName}`;
    const { error } = await supabaseAdmin.storage
        .from(bucket)
        .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });
    if (error) throw error;
    const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return { url: data.publicUrl, path };
}

// GET /:id/attachments — lista os anexos do item
router.get('/:id/attachments', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { data, error } = await supabaseAdmin
            .from('inv_item_attachments')
            .select('id, file_url, file_name, mime_type, size_bytes, created_at')
            .eq('item_id', req.params.id)
            .order('created_at', { ascending: true });
        if (error) throw error;
        res.json({ success: true, data: data || [] });
    } catch (err) {
        console.error('GET inv_items/:id/attachments error:', err);
        res.status(500).json({ error: err.message || 'Erro ao listar anexos' });
    }
});

// POST /:id/attachments — envia 1 anexo (foto). Só itens patrimoniais, máx 6.
router.post('/:id/attachments', requirePermission('inventory', 'update_item'), attachmentUpload.single('file'), async (req, res) => {
    try {
        const { id } = req.params;
        if (!req.file) return res.status(400).json({ error: 'Arquivo (file) ausente' });
        // Por enquanto, anexos são fotos.
        if (!req.file.mimetype.startsWith('image/'))
            return res.status(400).json({ error: 'Apenas imagens (fotos) são permitidas' });

        const { data: item } = await supabaseAdmin
            .from('inv_items').select('id, macro_category').eq('id', id).single();
        if (!item) return res.status(404).json({ error: 'Item não encontrado' });
        if (item.macro_category !== 'patrimonial')
            return res.status(400).json({ error: 'Anexos disponíveis apenas para itens de patrimônio' });

        const { count } = await supabaseAdmin
            .from('inv_item_attachments').select('id', { count: 'exact', head: true }).eq('item_id', id);
        if ((count || 0) >= MAX_ATTACHMENTS)
            return res.status(409).json({ error: `Limite de ${MAX_ATTACHMENTS} anexos por item atingido` });

        const { url, path } = await uploadToBucket(req.file, ATTACHMENTS_BUCKET, `inventory/items/${id}`);
        const { data, error } = await supabaseAdmin
            .from('inv_item_attachments')
            .insert({
                item_id:      id,
                file_url:     url,
                storage_path: path,
                file_name:    req.file.originalname,
                mime_type:    req.file.mimetype,
                size_bytes:   req.file.size,
                uploaded_by:  req.user?.id || null
            })
            .select('id, file_url, file_name, mime_type, size_bytes, created_at')
            .single();
        if (error) {
            // Trigger de limite (P0001) ou outro erro: tenta limpar o objeto órfão.
            await supabaseAdmin.storage.from(ATTACHMENTS_BUCKET).remove([path]).catch(() => {});
            if (error.code === 'P0001') return res.status(409).json({ error: error.message });
            throw error;
        }
        res.status(201).json({ success: true, data });
    } catch (err) {
        console.error('POST inv_items/:id/attachments error:', err);
        res.status(500).json({ error: err.message || 'Erro ao enviar anexo' });
    }
});

// DELETE /:id/attachments/:attId — remove um anexo (objeto do Storage + linha)
router.delete('/:id/attachments/:attId', requirePermission('inventory', 'update_item'), async (req, res) => {
    try {
        const { id, attId } = req.params;
        const { data: att } = await supabaseAdmin
            .from('inv_item_attachments')
            .select('id, storage_path')
            .eq('id', attId).eq('item_id', id).single();
        if (!att) return res.status(404).json({ error: 'Anexo não encontrado' });

        if (att.storage_path) {
            await supabaseAdmin.storage.from(ATTACHMENTS_BUCKET).remove([att.storage_path]).catch(() => {});
        }
        const { error } = await supabaseAdmin.from('inv_item_attachments').delete().eq('id', attId);
        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        console.error('DELETE inv_items/:id/attachments/:attId error:', err);
        res.status(500).json({ error: err.message || 'Erro ao remover anexo' });
    }
});

// GET /:id/qr — devolve o QR Code como JSON { data_url: "data:image/png;base64,…" }
// Usar data URL evita problemas de binary stream com o middleware de
// compressão. O cliente usa diretamente como <img src="…">.
async function handleQrCode(req, res) {
    try {
        const { id } = req.params;
        const { data: item, error } = await supabaseAdmin
            .from('inv_items')
            .select('id, qr_code, name')
            .eq('id', id)
            .single();
        if (error) throw error;
        if (!item) return res.status(404).json({ error: 'Item não encontrado' });

        const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
        // QR aponta direto para a ficha do item — item-view aceita ?qr=<uuid>
        // e resolve via /api/inventory/scan/:qrCode internamente. Evita rebote
        // pela tela de scan.html (que fica reservada para leitura via câmera).
        const payload = `${base}/inventory/item-view.html?qr=${item.qr_code}`;
        const dataUrl = await QRCode.toDataURL(payload, { width: 512, margin: 2 });

        // no-store força browser/proxy a sempre buscar do servidor — evita conflito
        // com qualquer resposta antiga cacheada (era PNG, agora é JSON).
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.json({
            success: true,
            data: {
                item_id:  item.id,
                qr_code:  item.qr_code,
                payload,
                data_url: dataUrl
            }
        });
    } catch (err) {
        console.error('GET inv_items qr error:', err);
        res.status(500).json({ error: err.message || 'Erro ao gerar QR Code' });
    }
}
router.get('/:id/qr',     requirePermission('inventory', 'read'), handleQrCode);
router.get('/:id/qr.png', requirePermission('inventory', 'read'), handleQrCode);

// Fase 4.4: janela de consumo efetiva para um par (item, localização).
// Usado pelo Kardex e relatórios para popular o default do date range.
// Resolução: location_override > category > 30. Devolve também o source.
router.get('/:id/effective-window', requirePermission('inventory', 'read'), async (req, res) => {
    try {
        const { id }          = req.params;
        const { location_id } = req.query;

        if (location_id) {
            const { data, error } = await supabaseAdmin
                .from('vw_inv_item_effective_params')
                .select('consumption_window_days, source_window_days')
                .eq('item_id', id)
                .eq('location_id', location_id)
                .maybeSingle();
            if (error) throw error;
            if (data) return res.json({ success: true, data: { window_days: data.consumption_window_days, source: data.source_window_days } });
            // Item é patrimonial ou location inativa — cai no fallback abaixo
        }

        // Sem location ou item patrimonial: lê da categoria via item
        const { data: item, error: itemErr } = await supabaseAdmin
            .from('inv_items')
            .select('id, subcategory:inv_categories!subcategory_id(consumption_window_days)')
            .eq('id', id)
            .single();
        if (itemErr) throw itemErr;
        const catWindow = item?.subcategory?.consumption_window_days;
        res.json({
            success: true,
            data: {
                window_days: catWindow ?? 30,
                source:      catWindow != null ? 'category' : 'default'
            }
        });
    } catch (err) {
        console.error('GET inv_items effective-window error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
