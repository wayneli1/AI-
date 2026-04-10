-- ============================================================
-- 历史标书整理结果按公司隔离，并作废旧数据
-- ============================================================

BEGIN;

DELETE FROM public.template_slot_assets;
DELETE FROM public.template_slot_samples;
DELETE FROM public.template_slots;

ALTER TABLE public.template_slots
  ADD COLUMN IF NOT EXISTS company_profile_id UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.template_slot_samples
  ADD COLUMN IF NOT EXISTS company_profile_id UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.template_slot_assets
  ADD COLUMN IF NOT EXISTS company_profile_id UUID REFERENCES public.company_profiles(id) ON DELETE CASCADE;

ALTER TABLE public.template_slots
  ALTER COLUMN company_profile_id SET NOT NULL;

ALTER TABLE public.template_slot_samples
  ALTER COLUMN company_profile_id SET NOT NULL;

ALTER TABLE public.template_slot_assets
  ALTER COLUMN company_profile_id SET NOT NULL;

ALTER TABLE public.template_slots
  DROP CONSTRAINT IF EXISTS template_slots_user_slot_key_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'template_slots_user_company_slot_key_unique'
  ) THEN
    ALTER TABLE public.template_slots
      ADD CONSTRAINT template_slots_user_company_slot_key_unique
      UNIQUE (user_id, company_profile_id, template_name, slot_key);
  END IF;
END $$;

ALTER TABLE public.template_slot_assets
  DROP CONSTRAINT IF EXISTS template_slot_assets_user_slot_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'template_slot_assets_user_company_slot_unique'
  ) THEN
    ALTER TABLE public.template_slot_assets
      ADD CONSTRAINT template_slot_assets_user_company_slot_unique
      UNIQUE (user_id, company_profile_id, slot_id);
  END IF;
END $$;

DROP INDEX IF EXISTS idx_template_slots_user_template;
CREATE INDEX IF NOT EXISTS idx_template_slots_user_company_template
  ON public.template_slots (user_id, company_profile_id, template_name, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_template_slot_samples_user_company_slot
  ON public.template_slot_samples (user_id, company_profile_id, slot_id, created_at DESC);

DROP INDEX IF EXISTS idx_template_slot_assets_slot;
CREATE INDEX IF NOT EXISTS idx_template_slot_assets_user_company_slot
  ON public.template_slot_assets (user_id, company_profile_id, slot_id, updated_at DESC);

COMMENT ON COLUMN public.template_slots.company_profile_id IS '该内容项所属的投标主体';
COMMENT ON COLUMN public.template_slot_samples.company_profile_id IS '该参考样本所属的投标主体';
COMMENT ON COLUMN public.template_slot_assets.company_profile_id IS '该已生效内容所属的投标主体';

COMMIT;

NOTIFY pgrst, 'reload schema';
