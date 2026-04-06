-- ============================================================
-- Migration: Auto-create public.users + user_profiles on Auth user creation
-- Created: 2026-04-06
-- Purpose: Garantir que todo novo usuário Auth tenha entrada em
--          public.users e user_profiles automaticamente (via trigger).
--          Resolve o bug de login de usuários criados pelo módulo RH
--          sem profile.
-- ============================================================

-- Função que sincroniza auth.users -> public.users -> user_profiles automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_display_name text;
BEGIN
  -- Pegar tenant_id padrão (o tenant ativo com menor created_at)
  SELECT id INTO v_tenant_id
  FROM public.tenants
  WHERE is_active = true
  ORDER BY created_at
  LIMIT 1;

  -- Nome de exibição: preferir user_metadata.full_name, depois email
  v_display_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- 1. Garantir entrada em public.users (referenciada por FK de user_profiles)
  INSERT INTO public.users (id, name, email)
  VALUES (NEW.id, v_display_name, NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Criar user_profiles (apenas se tenant_id disponível)
  IF v_tenant_id IS NOT NULL THEN
    INSERT INTO public.user_profiles (user_id, display_name, first_name, tenant_id, is_active)
    VALUES (
      NEW.id,
      v_display_name,
      split_part(v_display_name, ' ', 1),
      v_tenant_id,
      true
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Criar o trigger (substituir se já existir)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();
