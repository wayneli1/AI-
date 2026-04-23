-- 人员档案库：新增日期字段（入职时间、毕业时间）用于计算年限
-- 年龄、本公司工作年限、工作年限 均由前端根据日期实时计算，无需存储

ALTER TABLE public.personnel_profiles
ADD COLUMN IF NOT EXISTS work_start_date DATE,
ADD COLUMN IF NOT EXISTS graduation_date DATE;

COMMENT ON COLUMN public.personnel_profiles.work_start_date IS '入职时间，用于计算在本公司工作年限';
COMMENT ON COLUMN public.personnel_profiles.graduation_date IS '毕业时间，用于计算工作年限';

NOTIFY pgrst, 'reload schema';