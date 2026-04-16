-- 1. 先删掉旧的严格约束
ALTER TABLE public.personnel_attachments 
DROP CONSTRAINT IF EXISTS personnel_attachments_attachment_type_check;

-- 2. 加上新的约束，把前端用的 id_card_front 和 id_card_back 加进白名单
ALTER TABLE public.personnel_attachments 
ADD CONSTRAINT personnel_attachments_attachment_type_check 
CHECK (attachment_type IN (
  'id_card',
  'id_card_front',
  'id_card_back',
  'graduation_certificate',
  'degree_certificate',
  'title_certificate',
  'qualification_certificate',
  'social_security',
  'other'
));