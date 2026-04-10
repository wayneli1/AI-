-- ============================================================
-- 补齐 template_slots.learning_mode 字段
-- ============================================================

BEGIN;

ALTER TABLE public.template_slots
  ADD COLUMN IF NOT EXISTS learning_mode TEXT;

UPDATE public.template_slots
SET learning_mode = CASE
  WHEN slot_type = 'field' OR fill_strategy = 'company_profile' THEN 'field_extract'
  WHEN slot_type = 'fixed_asset' OR fill_strategy = 'asset_selection' THEN 'asset_detect'
  ELSE 'content_summarize'
END
WHERE learning_mode IS NULL;

ALTER TABLE public.template_slots
  ALTER COLUMN learning_mode SET DEFAULT 'content_summarize';

ALTER TABLE public.template_slots
  ALTER COLUMN learning_mode SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'template_slots_learning_mode_check'
  ) THEN
    ALTER TABLE public.template_slots
      ADD CONSTRAINT template_slots_learning_mode_check
      CHECK (learning_mode IN ('field_extract', 'content_summarize', 'asset_detect'));
  END IF;
END $$;

COMMENT ON COLUMN public.template_slots.learning_mode IS '历史标书整理时的处理方式';

COMMIT;

NOTIFY pgrst, 'reload schema';
