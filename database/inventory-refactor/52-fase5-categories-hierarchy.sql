-- =====================================================
-- INVENTORY REFACTOR — Fase 5.1
-- Hierarquia de categorias (Adjacency List com parent_id)
-- =====================================================
-- Motivação:
--   O modelo atual tem 2 níveis fixos: macro_category (consumo/patrimonial)
--   + subcategoria livre. O Instituto precisa de hierarquia mais profunda:
--     - Consumo:    Categoria → Subcategoria (2 níveis)
--     - Patrimonial: Categoria → Subcategoria → Variante → ... (N níveis)
--
--   Exemplo patrimonial:
--     MacBooks → Macbook Air → Macbook Air v2025
--     Desktops → Desktop → 16Gb Ram 512GB SSD
--
--   inv_items continua apontando para a FOLHA via subcategory_id.
--   parent_macro continua existindo e discrimina a árvore (mantém compat).
--
-- Decisão arquitetural:
--   - Adjacency List (parent_id) é mais simples que Materialized Path/
--     Nested Set e suficiente para árvores rasas (<10 níveis).
--   - Validação de mesmo macro entre pai/filho via trigger (DB enforça).
--   - Validação de não-ciclo via trigger (defensiva).
--   - Profundidade máxima POR consumo (=2) é validada no API, não no DB,
--     para manter schema flexível para o patrimonial multinível.
--
-- Aditiva pura: categorias atuais ficam como raízes (parent_id = NULL).
-- =====================================================

BEGIN;

-- ---------- 1) Coluna parent_id ----------

ALTER TABLE inv_categories
    ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES inv_categories(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_inv_categories_parent
    ON inv_categories(parent_id)
    WHERE parent_id IS NOT NULL;

COMMENT ON COLUMN inv_categories.parent_id IS
'Categoria pai. NULL = raiz da árvore. Filhos herdam parent_macro do pai '
'(validado por trigger).';

-- ---------- 2) Trigger: valida parent_macro coerente + sem ciclos ----------

CREATE OR REPLACE FUNCTION fn_inv_categories_check_parent()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_macro TEXT;
    v_cycle_check  UUID;
BEGIN
    IF NEW.parent_id IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.parent_id = NEW.id THEN
        RAISE EXCEPTION 'Categoria não pode ser pai de si mesma' USING ERRCODE = '22023';
    END IF;

    SELECT parent_macro INTO v_parent_macro FROM inv_categories WHERE id = NEW.parent_id;
    IF v_parent_macro IS NULL THEN
        RAISE EXCEPTION 'Categoria pai não encontrada: %', NEW.parent_id USING ERRCODE = '02000';
    END IF;

    IF v_parent_macro <> NEW.parent_macro THEN
        RAISE EXCEPTION 'Filho deve ter o mesmo tipo (consumo/patrimonial) do pai. Pai=%, filho=%',
                        v_parent_macro, NEW.parent_macro
            USING ERRCODE = '22023';
    END IF;

    -- Anti-ciclo: percorre ancestrais e garante que NEW.id não está lá
    IF TG_OP = 'UPDATE' THEN
        WITH RECURSIVE anc AS (
            SELECT NEW.parent_id AS id, 1 AS depth
            UNION ALL
            SELECT c.parent_id, anc.depth + 1
              FROM inv_categories c
              JOIN anc ON c.id = anc.id
             WHERE c.parent_id IS NOT NULL AND anc.depth < 100
        )
        SELECT id INTO v_cycle_check FROM anc WHERE id = NEW.id LIMIT 1;
        IF v_cycle_check IS NOT NULL THEN
            RAISE EXCEPTION 'Ciclo detectado: categoria não pode ser ancestral de si mesma' USING ERRCODE = '22023';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_inv_categories_check_parent ON inv_categories;
CREATE TRIGGER tg_inv_categories_check_parent
    BEFORE INSERT OR UPDATE OF parent_id, parent_macro ON inv_categories
    FOR EACH ROW EXECUTE FUNCTION fn_inv_categories_check_parent();

-- ---------- 3) View com path completo + depth ----------
-- Usada pela API para devolver categorias com breadcrumb pronto:
--   "MacBooks / Macbook Air / Macbook Air v2025"
-- O array ancestors_ids é útil para o frontend renderizar drill-down.

CREATE OR REPLACE VIEW vw_inv_categories_tree AS
WITH RECURSIVE tree AS (
    SELECT
        id, parent_id, parent_macro, name,
        consumption_window_days, is_active, deleted_at,
        name::text                   AS path,
        1                            AS depth,
        ARRAY[id]                    AS ancestors_ids,
        ARRAY[name::text]            AS ancestors_names
    FROM   inv_categories
    WHERE  parent_id IS NULL

    UNION ALL

    SELECT
        c.id, c.parent_id, c.parent_macro, c.name,
        c.consumption_window_days, c.is_active, c.deleted_at,
        (t.path || ' / ' || c.name)::text,
        t.depth + 1,
        t.ancestors_ids || c.id,
        t.ancestors_names || c.name::text
    FROM   inv_categories c
    JOIN   tree t ON c.parent_id = t.id
)
SELECT * FROM tree;

COMMENT ON VIEW vw_inv_categories_tree IS
'Categorias com path completo (separado por " / "), depth e arrays de '
'ancestrais. Frontend usa para renderizar breadcrumbs e drill-downs.';

-- ---------- 4) Helper: contar filhos (usado pela API para exibir badges) ----------

CREATE OR REPLACE VIEW vw_inv_categories_with_counts AS
SELECT
    c.*,
    (SELECT COUNT(*) FROM inv_categories ch WHERE ch.parent_id = c.id AND ch.deleted_at IS NULL) AS children_count,
    (SELECT COUNT(*) FROM inv_items     i  WHERE i.subcategory_id = c.id AND i.deleted_at IS NULL) AS items_count
FROM   inv_categories c
WHERE  c.deleted_at IS NULL;

COMMIT;

-- =====================================================
-- VERIFICAÇÃO
-- =====================================================

-- 1) Coluna criada
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'inv_categories' AND column_name = 'parent_id';

-- 2) Categorias atuais viram raízes (parent_id NULL)
SELECT parent_macro, COUNT(*) AS raiz_count
  FROM inv_categories
 WHERE parent_id IS NULL AND deleted_at IS NULL
 GROUP BY parent_macro;

-- 3) Teste manual da view tree (sem hierarquia ainda, só raízes)
SELECT depth, parent_macro, name, path
  FROM vw_inv_categories_tree
 ORDER BY parent_macro, path
 LIMIT 30;

-- 4) Teste manual de bloqueios (rodar depois):
-- a) Tentar criar filho consumo de pai patrimonial → deve falhar 22023
-- b) Tentar fazer categoria ser filha de si mesma → deve falhar 22023
-- c) Tentar ciclo A→B, B→A → deve falhar 22023 no UPDATE
