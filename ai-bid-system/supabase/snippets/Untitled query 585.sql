ALTER TABLE public.personnel_profiles
ADD COLUMN IF NOT EXISTS work_start_date DATE,
ADD COLUMN IF NOT EXISTS graduation_date DATE;