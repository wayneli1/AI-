-- 给 images 表增加 file_size 和 file_type 字段，满足前端代码的需求
ALTER TABLE public.images ADD COLUMN file_size INTEGER;
ALTER TABLE public.images ADD COLUMN file_type TEXT;

-- 顺便刷新一下 Supabase 的架构缓存 (Schema Cache)
NOTIFY pgrst, 'reload schema';