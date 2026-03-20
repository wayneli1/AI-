-- 1. 确保数据表的 RLS 防盗门是开启状态
ALTER TABLE public.images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- 2. 清理掉之前可能混乱的旧锁（如果有的话）
DROP POLICY IF EXISTS "Users can manage own images" ON public.images;
DROP POLICY IF EXISTS "Users can manage own documents" ON public.documents;
DROP POLICY IF EXISTS "个人图片隔离" ON public.images;
DROP POLICY IF EXISTS "个人文档隔离" ON public.documents;

-- 3. 换上最严密的“智能电子锁”：只有当你当前的登录 ID (auth.uid) 等于这条数据的拥有者 ID (user_id) 时，才允许你增删改查！
CREATE POLICY "个人图片隔离" ON public.images FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "个人文档隔离" ON public.documents FOR ALL USING (auth.uid() = user_id);