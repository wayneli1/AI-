-- 人员档案库：新增身份证有效期字段
ALTER TABLE public.personnel_profiles
ADD COLUMN IF NOT EXISTS id_card_valid_start DATE,
ADD COLUMN IF NOT EXISTS id_card_valid_end DATE,
ADD COLUMN IF NOT EXISTS id_card_is_permanent BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.personnel_profiles.id_card_valid_start IS '身份证有效起始日期，由OCR识别反面自动填入';
COMMENT ON COLUMN public.personnel_profiles.id_card_valid_end IS '身份证有效截止日期，长期有效存为 9999-12-31';
COMMENT ON COLUMN public.personnel_profiles.id_card_is_permanent IS '身份证是否长期有效（46岁以上）';

NOTIFY pgrst, 'reload schema';
