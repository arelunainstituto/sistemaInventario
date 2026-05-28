-- =====================================================
-- INVENTORY REFACTOR — FASE 1
-- Cadastros + Entradas
-- =====================================================
-- Cria todo o schema base do novo módulo de inventário:
-- unidades, localizações, categorias, UoM, fornecedores,
-- itens, lotes, stock, movimentos, entradas + linhas.
--
-- Inclui:
--   • Triggers para CMP, QR code, código interno, patrimônio
--   • Bloqueio de UPDATE/DELETE em inv_movements (RN07)
--   • Bloqueio de datas futuras (RN08)
--   • Unicidade de documento fiscal (RN02)
--   • Lote automático por categoria (Consumo=true, Patrimonial=false)
--   • Seeds iniciais (3 unidades + UoMs + categorias)
--
-- Atende: secções 5, 6, 7 e RN01, RN02, RN03, RN06, RN07, RN08, RN10
-- =====================================================

BEGIN;

-- =====================================================
-- 1. UNIDADES DE MEDIDA (UoM)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_units_of_measure (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(20) NOT NULL UNIQUE,
    name        VARCHAR(60) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_uom_active ON inv_units_of_measure (is_active) WHERE deleted_at IS NULL;

-- =====================================================
-- 2. UNIDADES (nível 1 — Marquês / Cristal / Lab. ProStoral)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_units (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        VARCHAR(30) NOT NULL UNIQUE,
    name        VARCHAR(120) NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_units_active ON inv_units (is_active) WHERE deleted_at IS NULL;

-- =====================================================
-- 3. LOCALIZAÇÕES (nível 2 — sublocais por unidade)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_locations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id       UUID NOT NULL REFERENCES inv_units(id) ON DELETE RESTRICT,
    name          VARCHAR(120) NOT NULL,
    type          VARCHAR(40) NOT NULL CHECK (type IN ('gabinete','area_operacional','armazem','laboratorio','dispensa','outro')),
    can_receive   BOOLEAN NOT NULL DEFAULT TRUE,
    can_send      BOOLEAN NOT NULL DEFAULT TRUE,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    UNIQUE (unit_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inv_locations_unit ON inv_locations (unit_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_locations_active ON inv_locations (is_active) WHERE deleted_at IS NULL;

-- =====================================================
-- 4. SUBCATEGORIAS (macro = consumo | patrimonial)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_categories (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_macro  VARCHAR(20) NOT NULL CHECK (parent_macro IN ('consumo','patrimonial')),
    name          VARCHAR(120) NOT NULL,
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ,
    UNIQUE (parent_macro, name)
);

CREATE INDEX IF NOT EXISTS idx_inv_categories_macro ON inv_categories (parent_macro) WHERE deleted_at IS NULL;

-- =====================================================
-- 5. FORNECEDORES
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_suppliers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL,
    tax_id      VARCHAR(40),
    email       VARCHAR(160),
    phone       VARCHAR(40),
    address     TEXT,
    notes       TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_suppliers_name ON inv_suppliers (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_suppliers_tax ON inv_suppliers (tax_id) WHERE tax_id IS NOT NULL AND deleted_at IS NULL;

-- =====================================================
-- 6. SEQUENCES para códigos automáticos
-- =====================================================
CREATE SEQUENCE IF NOT EXISTS seq_inv_internal_code  START 1 INCREMENT 1;
CREATE SEQUENCE IF NOT EXISTS seq_inv_patrimony      START 1 INCREMENT 1;

-- =====================================================
-- 7. ITENS (consumo ou patrimonial)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_items (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identificação
    macro_category       VARCHAR(20) NOT NULL CHECK (macro_category IN ('consumo','patrimonial')),
    subcategory_id       UUID REFERENCES inv_categories(id),
    name                 VARCHAR(200) NOT NULL,
    description          TEXT,
    internal_code        VARCHAR(40) NOT NULL UNIQUE,   -- preenchido via trigger
    qr_code              UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    barcode              VARCHAR(80),
    manufacturer_ref     VARCHAR(120),

    -- Unidades e conversão
    base_uom_id          UUID NOT NULL REFERENCES inv_units_of_measure(id),
    purchase_uom_id      UUID REFERENCES inv_units_of_measure(id),
    consumption_uom_id   UUID REFERENCES inv_units_of_measure(id),
    conversion_factor    NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),

    -- Controle de lote/série (calculado por categoria — RN03)
    controls_lot         BOOLEAN NOT NULL,
    uses_serial          BOOLEAN NOT NULL,

    -- Parâmetros de stock
    min_stock            NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (min_stock >= 0),
    max_stock            NUMERIC(14,4) CHECK (max_stock IS NULL OR max_stock >= min_stock),
    lead_time_days       INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_days >= 0),
    reorder_point        NUMERIC(14,4) NOT NULL DEFAULT 0,
    avg_daily_consumption NUMERIC(14,4) NOT NULL DEFAULT 0,

    -- Custo médio ponderado
    cmp                  NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (cmp >= 0),

    -- Mídia / anexos
    image_url            TEXT,
    pdf_url              TEXT,

    -- Patrimoniais (preenchido apenas se macro_category='patrimonial')
    patrimony_number     VARCHAR(40) UNIQUE,
    acquisition_date     DATE,
    acquisition_value    NUMERIC(14,2),
    depreciation_rate    NUMERIC(5,2) CHECK (depreciation_rate IS NULL OR (depreciation_rate >= 0 AND depreciation_rate <= 100)),
    asset_status         VARCHAR(20) CHECK (asset_status IN ('em_uso','inativo','baixado')),

    -- Auditoria
    is_active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ,
    created_by           UUID REFERENCES auth.users(id),
    updated_by           UUID REFERENCES auth.users(id),

    -- Coerência macro × campos patrimoniais
    CHECK (
        (macro_category = 'patrimonial')
        OR (patrimony_number IS NULL AND acquisition_date IS NULL
            AND acquisition_value IS NULL AND depreciation_rate IS NULL
            AND asset_status IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_inv_items_name        ON inv_items (name)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_items_macro       ON inv_items (macro_category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_items_subcat      ON inv_items (subcategory_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_items_active      ON inv_items (is_active)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_inv_items_qr          ON inv_items (qr_code);
CREATE INDEX IF NOT EXISTS idx_inv_items_barcode     ON inv_items (barcode)      WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_items_patrimony   ON inv_items (patrimony_number) WHERE patrimony_number IS NOT NULL;

-- =====================================================
-- 8. LOTES (ativos)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_lots (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id           UUID NOT NULL REFERENCES inv_items(id) ON DELETE RESTRICT,
    lot_number        VARCHAR(80) NOT NULL,
    manufacture_date  DATE,
    expiry_date       DATE,
    serial_number     VARCHAR(120),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (item_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_inv_lots_item    ON inv_lots (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_lots_expiry  ON inv_lots (expiry_date) WHERE expiry_date IS NOT NULL;

-- =====================================================
-- 9. STOCK (saldo por localização + lote)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_stock (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id       UUID NOT NULL REFERENCES inv_items(id) ON DELETE RESTRICT,
    location_id   UUID NOT NULL REFERENCES inv_locations(id) ON DELETE RESTRICT,
    lot_id        UUID REFERENCES inv_lots(id) ON DELETE RESTRICT,
    quantity      NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- UNIQUE precisa tratar lot_id NULL — usar dois índices parciais
CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_stock_with_lot
    ON inv_stock (item_id, location_id, lot_id)
    WHERE lot_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_inv_stock_no_lot
    ON inv_stock (item_id, location_id)
    WHERE lot_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_inv_stock_item     ON inv_stock (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_stock_location ON inv_stock (location_id);

-- =====================================================
-- 10. MOVIMENTOS (histórico imutável)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_movements (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type              VARCHAR(30) NOT NULL CHECK (type IN (
        'entrada','saida','transferencia_saida','transferencia_entrada',
        'ajuste','inventario','depreciacao'
    )),
    subtype           VARCHAR(40),   -- consumo|avaria|extravio|perda|quebra|manual|recepcao_fiscal|…
    item_id           UUID NOT NULL REFERENCES inv_items(id) ON DELETE RESTRICT,
    lot_id            UUID REFERENCES inv_lots(id) ON DELETE RESTRICT,
    from_location_id  UUID REFERENCES inv_locations(id),
    to_location_id    UUID REFERENCES inv_locations(id),
    quantity          NUMERIC(14,4) NOT NULL CHECK (quantity > 0),
    unit_cost         NUMERIC(14,4),
    total_cost        NUMERIC(14,4),
    cmp_at_moment     NUMERIC(14,4),
    document_type     VARCHAR(40),
    document_number   VARCHAR(80),
    supplier_id       UUID REFERENCES inv_suppliers(id),
    justification     TEXT,
    user_id           UUID REFERENCES auth.users(id),
    occurred_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_mov_item     ON inv_movements (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_type     ON inv_movements (type);
CREATE INDEX IF NOT EXISTS idx_inv_mov_occurred ON inv_movements (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_inv_mov_user     ON inv_movements (user_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_lot      ON inv_movements (lot_id) WHERE lot_id IS NOT NULL;

-- =====================================================
-- 11. ENTRADAS (cabeçalho de recepção)
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type   VARCHAR(30) NOT NULL CHECK (document_type IN ('fatura','guia_remessa','nota_encomenda','outro')),
    document_number VARCHAR(80) NOT NULL,
    document_date   DATE NOT NULL,
    supplier_id     UUID NOT NULL REFERENCES inv_suppliers(id),
    total_value     NUMERIC(14,2) NOT NULL DEFAULT 0,
    notes           TEXT,
    user_id         UUID REFERENCES auth.users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- RN02: unicidade documento × fornecedor (impede duplicação)
    UNIQUE (document_type, document_number, supplier_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_entries_supplier ON inv_entries (supplier_id);
CREATE INDEX IF NOT EXISTS idx_inv_entries_date     ON inv_entries (document_date DESC);

-- =====================================================
-- 12. LINHAS DE ENTRADA
-- =====================================================
CREATE TABLE IF NOT EXISTS inv_entry_lines (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id            UUID NOT NULL REFERENCES inv_entries(id) ON DELETE CASCADE,
    item_id             UUID NOT NULL REFERENCES inv_items(id) ON DELETE RESTRICT,
    purchase_qty        NUMERIC(14,4) NOT NULL CHECK (purchase_qty > 0),
    conversion_factor   NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (conversion_factor > 0),
    consumption_qty     NUMERIC(14,4) GENERATED ALWAYS AS (purchase_qty * conversion_factor) STORED,
    unit_cost           NUMERIC(14,4) NOT NULL CHECK (unit_cost >= 0),
    total_cost          NUMERIC(14,4) GENERATED ALWAYS AS (purchase_qty * unit_cost) STORED,
    location_id         UUID NOT NULL REFERENCES inv_locations(id),
    lot_number          VARCHAR(80),
    manufacture_date    DATE,
    expiry_date         DATE,
    serial_number       VARCHAR(120),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inv_entry_lines_entry ON inv_entry_lines (entry_id);
CREATE INDEX IF NOT EXISTS idx_inv_entry_lines_item  ON inv_entry_lines (item_id);

-- =====================================================
-- 13. FUNÇÕES E TRIGGERS
-- =====================================================

-- 13.1 updated_at automático
CREATE OR REPLACE FUNCTION fn_inv_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_inv_uom_updated ON inv_units_of_measure;
CREATE TRIGGER tg_inv_uom_updated BEFORE UPDATE ON inv_units_of_measure
    FOR EACH ROW EXECUTE FUNCTION fn_inv_set_updated_at();

DROP TRIGGER IF EXISTS tg_inv_units_updated ON inv_units;
CREATE TRIGGER tg_inv_units_updated BEFORE UPDATE ON inv_units
    FOR EACH ROW EXECUTE FUNCTION fn_inv_set_updated_at();

DROP TRIGGER IF EXISTS tg_inv_locations_updated ON inv_locations;
CREATE TRIGGER tg_inv_locations_updated BEFORE UPDATE ON inv_locations
    FOR EACH ROW EXECUTE FUNCTION fn_inv_set_updated_at();

DROP TRIGGER IF EXISTS tg_inv_categories_updated ON inv_categories;
CREATE TRIGGER tg_inv_categories_updated BEFORE UPDATE ON inv_categories
    FOR EACH ROW EXECUTE FUNCTION fn_inv_set_updated_at();

DROP TRIGGER IF EXISTS tg_inv_suppliers_updated ON inv_suppliers;
CREATE TRIGGER tg_inv_suppliers_updated BEFORE UPDATE ON inv_suppliers
    FOR EACH ROW EXECUTE FUNCTION fn_inv_set_updated_at();

DROP TRIGGER IF EXISTS tg_inv_items_updated ON inv_items;
CREATE TRIGGER tg_inv_items_updated BEFORE UPDATE ON inv_items
    FOR EACH ROW EXECUTE FUNCTION fn_inv_set_updated_at();

DROP TRIGGER IF EXISTS tg_inv_lots_updated ON inv_lots;
CREATE TRIGGER tg_inv_lots_updated BEFORE UPDATE ON inv_lots
    FOR EACH ROW EXECUTE FUNCTION fn_inv_set_updated_at();

-- 13.2 Geração do internal_code e flags controls_lot / uses_serial
CREATE OR REPLACE FUNCTION fn_inv_items_before_insert()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.internal_code IS NULL OR NEW.internal_code = '' THEN
        NEW.internal_code := 'INV-' || LPAD(nextval('seq_inv_internal_code')::TEXT, 6, '0');
    END IF;

    -- Lote automático por categoria (RN03)
    IF NEW.macro_category = 'consumo' THEN
        NEW.controls_lot := TRUE;
        NEW.uses_serial  := FALSE;
    ELSIF NEW.macro_category = 'patrimonial' THEN
        NEW.controls_lot := FALSE;
        NEW.uses_serial  := TRUE;
        IF NEW.patrimony_number IS NULL THEN
            NEW.patrimony_number := 'PAT-' || LPAD(nextval('seq_inv_patrimony')::TEXT, 6, '0');
        END IF;
        IF NEW.asset_status IS NULL THEN
            NEW.asset_status := 'em_uso';
        END IF;
    END IF;

    -- Ponto de reposição inicial baseado em min_stock se não informado
    IF NEW.reorder_point IS NULL OR NEW.reorder_point = 0 THEN
        NEW.reorder_point := NEW.min_stock;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_inv_items_before_insert ON inv_items;
CREATE TRIGGER tg_inv_items_before_insert BEFORE INSERT ON inv_items
    FOR EACH ROW EXECUTE FUNCTION fn_inv_items_before_insert();

-- 13.3 Bloqueio de UPDATE/DELETE em inv_movements (RN07 — histórico imutável)
CREATE OR REPLACE FUNCTION fn_inv_movements_immutable()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'inv_movements é imutável (RN07): correções devem ser feitas via novo movimento de ajuste';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_inv_mov_no_update ON inv_movements;
CREATE TRIGGER tg_inv_mov_no_update BEFORE UPDATE ON inv_movements
    FOR EACH ROW EXECUTE FUNCTION fn_inv_movements_immutable();

DROP TRIGGER IF EXISTS tg_inv_mov_no_delete ON inv_movements;
CREATE TRIGGER tg_inv_mov_no_delete BEFORE DELETE ON inv_movements
    FOR EACH ROW EXECUTE FUNCTION fn_inv_movements_immutable();

-- 13.4 Bloqueio de datas futuras (RN08)
CREATE OR REPLACE FUNCTION fn_inv_check_no_future_dates()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.occurred_at > NOW() + INTERVAL '1 minute' THEN
        RAISE EXCEPTION 'inv_movements: occurred_at não pode estar no futuro (RN08)';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_inv_mov_no_future ON inv_movements;
CREATE TRIGGER tg_inv_mov_no_future BEFORE INSERT ON inv_movements
    FOR EACH ROW EXECUTE FUNCTION fn_inv_check_no_future_dates();

-- 13.5 Recalcular CMP (fórmula da secção 11.1)
CREATE OR REPLACE FUNCTION fn_inv_recalc_cmp(
    p_item_id   UUID,
    p_entry_qty NUMERIC,
    p_unit_cost NUMERIC
)
RETURNS NUMERIC AS $$
DECLARE
    v_total_stock NUMERIC;
    v_current_cmp NUMERIC;
    v_new_cmp     NUMERIC;
BEGIN
    SELECT COALESCE(SUM(quantity), 0), MAX(i.cmp)
      INTO v_total_stock, v_current_cmp
      FROM inv_stock s
      JOIN inv_items i ON i.id = s.item_id
     WHERE s.item_id = p_item_id;

    IF v_current_cmp IS NULL THEN
        v_current_cmp := 0;
    END IF;

    IF (v_total_stock + p_entry_qty) <= 0 THEN
        v_new_cmp := p_unit_cost;
    ELSE
        v_new_cmp := ((v_total_stock * v_current_cmp) + (p_entry_qty * p_unit_cost))
                     / (v_total_stock + p_entry_qty);
    END IF;

    UPDATE inv_items SET cmp = v_new_cmp WHERE id = p_item_id;
    RETURN v_new_cmp;
END;
$$ LANGUAGE plpgsql;

-- 13.6 Processar linha de entrada: cria lote, atualiza stock, recalcula CMP, gera movimento
CREATE OR REPLACE FUNCTION fn_inv_process_entry_line()
RETURNS TRIGGER AS $$
DECLARE
    v_item            inv_items%ROWTYPE;
    v_lot_id          UUID;
    v_new_cmp         NUMERIC;
    v_supplier_id     UUID;
    v_user_id         UUID;
    v_doc_type        VARCHAR(40);
    v_doc_number      VARCHAR(80);
    v_occurred_at     TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_item FROM inv_items WHERE id = NEW.item_id;

    -- RN03: item que controla lote exige lote
    IF v_item.controls_lot AND (NEW.lot_number IS NULL OR NEW.lot_number = '') THEN
        RAISE EXCEPTION 'Item % controla lote — número de lote é obrigatório (RN03)', v_item.name;
    END IF;

    -- Cria/recupera lote se item controla
    IF v_item.controls_lot THEN
        INSERT INTO inv_lots (item_id, lot_number, manufacture_date, expiry_date, serial_number)
        VALUES (NEW.item_id, NEW.lot_number, NEW.manufacture_date, NEW.expiry_date, NEW.serial_number)
        ON CONFLICT (item_id, lot_number) DO UPDATE
            SET expiry_date     = COALESCE(EXCLUDED.expiry_date,     inv_lots.expiry_date),
                manufacture_date= COALESCE(EXCLUDED.manufacture_date,inv_lots.manufacture_date),
                serial_number   = COALESCE(EXCLUDED.serial_number,   inv_lots.serial_number)
        RETURNING id INTO v_lot_id;
    END IF;

    -- Recalcula CMP (RN06)
    v_new_cmp := fn_inv_recalc_cmp(NEW.item_id, NEW.consumption_qty, NEW.unit_cost);

    -- UPSERT manual em inv_stock (índices parciais com lot_id NULL/NOT NULL não
    -- combinam com ON CONFLICT genérico, então fazemos SELECT + UPDATE/INSERT).
    IF v_lot_id IS NULL THEN
        UPDATE inv_stock
           SET quantity   = quantity + NEW.consumption_qty,
               updated_at = NOW()
         WHERE item_id     = NEW.item_id
           AND location_id = NEW.location_id
           AND lot_id IS NULL;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (NEW.item_id, NEW.location_id, NULL, NEW.consumption_qty);
        END IF;
    ELSE
        UPDATE inv_stock
           SET quantity   = quantity + NEW.consumption_qty,
               updated_at = NOW()
         WHERE item_id     = NEW.item_id
           AND location_id = NEW.location_id
           AND lot_id      = v_lot_id;
        IF NOT FOUND THEN
            INSERT INTO inv_stock (item_id, location_id, lot_id, quantity)
            VALUES (NEW.item_id, NEW.location_id, v_lot_id, NEW.consumption_qty);
        END IF;
    END IF;

    -- Gera movimento (entrada fiscal)
    SELECT supplier_id, user_id, document_type, document_number, document_date
      INTO v_supplier_id, v_user_id, v_doc_type, v_doc_number, v_occurred_at
      FROM inv_entries WHERE id = NEW.entry_id;

    INSERT INTO inv_movements (
        type, subtype, item_id, lot_id, to_location_id, quantity,
        unit_cost, total_cost, cmp_at_moment, document_type, document_number,
        supplier_id, user_id, occurred_at
    ) VALUES (
        'entrada', 'recepcao_fiscal', NEW.item_id, v_lot_id, NEW.location_id, NEW.consumption_qty,
        NEW.unit_cost, NEW.total_cost, v_new_cmp, v_doc_type, v_doc_number,
        v_supplier_id, v_user_id, COALESCE(v_occurred_at::TIMESTAMPTZ, NOW())
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_inv_entry_line_after_insert ON inv_entry_lines;
CREATE TRIGGER tg_inv_entry_line_after_insert AFTER INSERT ON inv_entry_lines
    FOR EACH ROW EXECUTE FUNCTION fn_inv_process_entry_line();

-- 13.7 Atualizar total_value da entrada quando linhas mudam
CREATE OR REPLACE FUNCTION fn_inv_entry_recalc_total()
RETURNS TRIGGER AS $$
DECLARE
    v_entry_id UUID;
BEGIN
    v_entry_id := COALESCE(NEW.entry_id, OLD.entry_id);
    UPDATE inv_entries
       SET total_value = COALESCE((SELECT SUM(total_cost) FROM inv_entry_lines WHERE entry_id = v_entry_id), 0)
     WHERE id = v_entry_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_inv_entry_lines_recalc ON inv_entry_lines;
CREATE TRIGGER tg_inv_entry_lines_recalc AFTER INSERT OR UPDATE OR DELETE ON inv_entry_lines
    FOR EACH ROW EXECUTE FUNCTION fn_inv_entry_recalc_total();

-- =====================================================
-- 14. RLS (Row Level Security)
-- =====================================================
-- Política permissiva para authenticated (segurança é feita na camada
-- de API via requirePermission). Service role bypassa RLS.

ALTER TABLE inv_units_of_measure ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_units            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_locations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_categories       ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_suppliers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_lots             ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_stock            ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_movements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_entries          ENABLE ROW LEVEL SECURITY;
ALTER TABLE inv_entry_lines      ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'inv_units_of_measure','inv_units','inv_locations','inv_categories',
        'inv_suppliers','inv_items','inv_lots','inv_stock',
        'inv_entries','inv_entry_lines'
    ] LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%I_auth_select" ON %I', t, t);
        EXECUTE format('CREATE POLICY "%I_auth_select" ON %I FOR SELECT TO authenticated USING (true)', t, t);
    END LOOP;
END $$;

-- inv_movements: apenas SELECT (INSERT só via service role nos triggers)
DROP POLICY IF EXISTS "inv_movements_auth_select" ON inv_movements;
CREATE POLICY "inv_movements_auth_select" ON inv_movements
    FOR SELECT TO authenticated USING (true);

-- =====================================================
-- 15. SEEDS INICIAIS
-- =====================================================

-- 15.1 Unidades de medida básicas
INSERT INTO inv_units_of_measure (code, name) VALUES
    ('un',         'Unidade'),
    ('cx',         'Caixa'),
    ('pal',        'Palete'),
    ('fardo',      'Fardo'),
    ('embalagem',  'Embalagem'),
    ('frasco',     'Frasco'),
    ('par',        'Par'),
    ('g',          'Grama'),
    ('kg',         'Quilograma'),
    ('mg',         'Miligrama'),
    ('ml',         'Mililitro'),
    ('l',          'Litro'),
    ('cm',         'Centímetro'),
    ('m',          'Metro'),
    ('mm',         'Milímetro')
ON CONFLICT (code) DO NOTHING;

-- 15.2 Unidades (Marquês, Cristal, Lab. ProStoral)
INSERT INTO inv_units (code, name) VALUES
    ('MARQUES',  'Marquês'),
    ('CRISTAL',  'Cristal'),
    ('PROSTORAL','Laboratório ProStoral')
ON CONFLICT (code) DO NOTHING;

-- 15.3 Subcategorias iniciais (todas como ponto de partida — utilizador pode adicionar)
INSERT INTO inv_categories (parent_macro, name) VALUES
    ('consumo','Resinas'),
    ('consumo','Ceras'),
    ('consumo','Metais'),
    ('consumo','Gesso'),
    ('consumo','Silicone'),
    ('consumo','Cerâmica'),
    ('consumo','Acrílico'),
    ('consumo','Instrumentos descartáveis'),
    ('consumo','Consumíveis clínicos'),
    ('consumo','Material administrativo'),
    ('consumo','Higiene'),
    ('consumo','Outros'),
    ('patrimonial','Equipamentos clínicos'),
    ('patrimonial','Equipamentos de laboratório'),
    ('patrimonial','Mobiliário'),
    ('patrimonial','Informática'),
    ('patrimonial','Outros')
ON CONFLICT (parent_macro, name) DO NOTHING;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO PÓS-EXECUÇÃO
-- =====================================================
SELECT 'inv_units'             AS tabela, COUNT(*) FROM inv_units UNION ALL
SELECT 'inv_units_of_measure'  AS tabela, COUNT(*) FROM inv_units_of_measure UNION ALL
SELECT 'inv_categories'        AS tabela, COUNT(*) FROM inv_categories UNION ALL
SELECT 'inv_locations'         AS tabela, COUNT(*) FROM inv_locations UNION ALL
SELECT 'inv_suppliers'         AS tabela, COUNT(*) FROM inv_suppliers UNION ALL
SELECT 'inv_items'             AS tabela, COUNT(*) FROM inv_items UNION ALL
SELECT 'inv_lots'              AS tabela, COUNT(*) FROM inv_lots UNION ALL
SELECT 'inv_stock'             AS tabela, COUNT(*) FROM inv_stock UNION ALL
SELECT 'inv_movements'         AS tabela, COUNT(*) FROM inv_movements UNION ALL
SELECT 'inv_entries'           AS tabela, COUNT(*) FROM inv_entries UNION ALL
SELECT 'inv_entry_lines'       AS tabela, COUNT(*) FROM inv_entry_lines
ORDER BY tabela;
