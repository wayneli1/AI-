-- ============================================================
-- 模板学习中心：固定模板槽位、样本、标准资产
-- ============================================================

CREATE TABLE IF NOT EXISTS public.template_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL DEFAULT '默认模板',
  slot_key TEXT NOT NULL,
  slot_name TEXT NOT NULL,
  chapter_path TEXT,
  slot_type TEXT NOT NULL DEFAULT 'standard_content' CHECK (slot_type IN (
    'field',
    'standard_content',
    'fixed_asset',
    'manual'
  )),
  fill_strategy TEXT NOT NULL DEFAULT 'standard_library' CHECK (fill_strategy IN (
    'company_profile',
    'standard_library',
    'asset_selection',
    'manual_confirm'
  )),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  match_keywords TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT template_slots_user_slot_key_unique UNIQUE (user_id, template_name, slot_key)
);

CREATE TABLE IF NOT EXISTS public.template_slot_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.template_slots(id) ON DELETE CASCADE,
  source_session_id UUID REFERENCES public.bid_learning_sessions(id) ON DELETE SET NULL,
  source_filename TEXT,
  sample_title TEXT,
  raw_content TEXT NOT NULL,
  normalized_content TEXT,
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.template_slot_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL REFERENCES public.template_slots(id) ON DELETE CASCADE,
  standard_content TEXT,
  content_source TEXT NOT NULL DEFAULT 'manual' CHECK (content_source IN ('manual', 'sample_derived')),
  asset_binding_type TEXT CHECK (asset_binding_type IN ('product_asset', 'document_category', 'image_category')),
  asset_binding_value TEXT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT template_slot_assets_user_slot_unique UNIQUE (user_id, slot_id)
);

ALTER TABLE public.template_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_slot_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_slot_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "template_slots_select_own"
  ON public.template_slots FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "template_slots_insert_own"
  ON public.template_slots FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "template_slots_update_own"
  ON public.template_slots FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "template_slots_delete_own"
  ON public.template_slots FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "template_slot_samples_select_own"
  ON public.template_slot_samples FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "template_slot_samples_insert_own"
  ON public.template_slot_samples FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "template_slot_samples_update_own"
  ON public.template_slot_samples FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "template_slot_samples_delete_own"
  ON public.template_slot_samples FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "template_slot_assets_select_own"
  ON public.template_slot_assets FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "template_slot_assets_insert_own"
  ON public.template_slot_assets FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "template_slot_assets_update_own"
  ON public.template_slot_assets FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "template_slot_assets_delete_own"
  ON public.template_slot_assets FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_template_slots_user_template
  ON public.template_slots (user_id, template_name, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_template_slot_samples_slot
  ON public.template_slot_samples (slot_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_template_slot_assets_slot
  ON public.template_slot_assets (slot_id, updated_at DESC);

CREATE OR REPLACE FUNCTION public.handle_template_learning_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_template_slots_updated_at
  ON public.template_slots;

CREATE TRIGGER trg_template_slots_updated_at
  BEFORE UPDATE ON public.template_slots
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_template_learning_updated_at();

DROP TRIGGER IF EXISTS trg_template_slot_assets_updated_at
  ON public.template_slot_assets;

CREATE TRIGGER trg_template_slot_assets_updated_at
  BEFORE UPDATE ON public.template_slot_assets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_template_learning_updated_at();

COMMENT ON TABLE public.template_slots IS '固定模板的槽位定义，用于模板学习中心';
COMMENT ON TABLE public.template_slot_samples IS '历史标书归档到槽位的样本内容';
COMMENT ON TABLE public.template_slot_assets IS '槽位沉淀后的标准内容或固定资产绑定';

NOTIFY pgrst, 'reload schema';
