-- ============================================================
-- 人员档案库：personnel_profiles 表
-- ============================================================

CREATE TABLE IF NOT EXISTS public.personnel_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_profile_id UUID NOT NULL REFERENCES public.company_profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  gender TEXT,
  birth_date DATE,
  phone TEXT,
  id_number TEXT,
  city TEXT,

  education TEXT,
  degree TEXT,
  school TEXT,
  major TEXT,

  job_title TEXT,
  title TEXT,
  certificate_summary TEXT,
  assigned_role TEXT,

  work_start_date DATE,
  management_start_date DATE,

  resume_text TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT personnel_profiles_user_company_name_unique UNIQUE (user_id, company_profile_id, name)
);

ALTER TABLE public.personnel_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personnel_profiles_select_own"
  ON public.personnel_profiles FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "personnel_profiles_insert_own"
  ON public.personnel_profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "personnel_profiles_update_own"
  ON public.personnel_profiles FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "personnel_profiles_delete_own"
  ON public.personnel_profiles FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_personnel_profiles_user_company
  ON public.personnel_profiles (user_id, company_profile_id, name);

CREATE INDEX IF NOT EXISTS idx_personnel_profiles_company
  ON public.personnel_profiles (company_profile_id, created_at DESC);

DROP TRIGGER IF EXISTS trg_personnel_profiles_updated_at
  ON public.personnel_profiles;

CREATE TRIGGER trg_personnel_profiles_updated_at
  BEFORE UPDATE ON public.personnel_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.personnel_profiles IS '人员结构化档案，用于姓名驱动的人员表自动补全';

NOTIFY pgrst, 'reload schema';
