ALTER TABLE public.personnel_attachments 
DROP CONSTRAINT personnel_attachments_attachment_type_check;

ALTER TABLE public.personnel_attachments 
ADD CONSTRAINT personnel_attachments_attachment_type_check 
CHECK (attachment_type IN (
  'id_card', 'id_card_front', 'id_card_back',
  'graduation_certificate', 'degree_certificate',
  'title_certificate', 'qualification_certificate',
  'social_security', 'other'
));