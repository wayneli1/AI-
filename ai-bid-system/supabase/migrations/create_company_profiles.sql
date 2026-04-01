-- ============================================================
-- 多主体结构化企业库：company_profiles 表
-- 请在 Supabase SQL Editor 中执行此脚本
-- ============================================================

-- 1. 创建表
CREATE TABLE IF NOT EXISTS public.company_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基础信息
  company_name            TEXT NOT NULL,
  uscc                    TEXT,
  registered_capital      TEXT,
  company_type            TEXT,
  establish_date          DATE,
  operating_period        TEXT,
  phone                   TEXT,
  email                   TEXT,
  address                 TEXT,
  zip_code                TEXT,
  registration_authority  TEXT,
  business_scope          TEXT,

  -- 法人信息
  legal_rep_name  TEXT,
  id_number       TEXT,
  gender          TEXT,
  birth_date      DATE,
  id_expiry       TEXT,
  position        TEXT,
  id_photo_url    TEXT,

  -- 动态扩展字段
  custom_fields   JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- 时间戳
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 启用 RLS
ALTER TABLE public.company_profiles ENABLE ROW LEVEL SECURITY;

-- 3. RLS 策略：用户只能操作自己的数据
CREATE POLICY "company_profiles_select_own"
  ON public.company_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "company_profiles_insert_own"
  ON public.company_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "company_profiles_update_own"
  ON public.company_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "company_profiles_delete_own"
  ON public.company_profiles FOR DELETE
  USING (user_id = auth.uid());

-- 4. 索引
CREATE INDEX IF NOT EXISTS idx_company_profiles_user_id
  ON public.company_profiles (user_id);

-- 5. updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_profiles_updated_at
  ON public.company_profiles;

CREATE TRIGGER trg_company_profiles_updated_at
  BEFORE UPDATE ON public.company_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
