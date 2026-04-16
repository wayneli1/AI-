ALTER TABLE public.personnel_profiles
ADD COLUMN IF NOT EXISTS department TEXT,
ADD COLUMN IF NOT EXISTS organization TEXT;