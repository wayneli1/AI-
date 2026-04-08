ALTER TABLE public.company_profiles 
  DROP COLUMN id_photo_url,
  ADD COLUMN id_photo_front_url TEXT,
  ADD COLUMN id_photo_back_url TEXT;
