-- ============================================================
-- 人员证明材料：personnel_attachments 表
-- ============================================================

CREATE TABLE IF NOT EXISTS public.personnel_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  personnel_profile_id UUID NOT NULL REFERENCES public.personnel_profiles(id) ON DELETE CASCADE,

  attachment_type TEXT NOT NULL CHECK (attachment_type IN (
    'id_card',
    'id_card_front',
    'id_card_back',
    'graduation_certificate',
    'degree_certificate',
    'title_certificate',
    'qualification_certificate',
    'social_security',
    'other'
  )),
  attachment_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,

  side TEXT CHECK (side IN ('front', 'back')),
  level TEXT,
  certificate_name TEXT,
  certificate_no TEXT,
  issuer TEXT,
  issue_date DATE,
  expiry_date DATE,

  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.personnel_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "personnel_attachments_select_own"
  ON public.personnel_attachments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "personnel_attachments_insert_own"
  ON public.personnel_attachments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "personnel_attachments_update_own"
  ON public.personnel_attachments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "personnel_attachments_delete_own"
  ON public.personnel_attachments FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_personnel_attachments_user_personnel
  ON public.personnel_attachments (user_id, personnel_profile_id, attachment_type, enabled);

CREATE INDEX IF NOT EXISTS idx_personnel_attachments_personnel
  ON public.personnel_attachments (personnel_profile_id, sort_order, created_at DESC);

DROP TRIGGER IF EXISTS trg_personnel_attachments_updated_at
  ON public.personnel_attachments;

CREATE TRIGGER trg_personnel_attachments_updated_at
  BEFORE UPDATE ON public.personnel_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE public.personnel_attachments IS '人员证件、学历学位证书、职称证等证明材料';

NOTIFY pgrst, 'reload schema';
