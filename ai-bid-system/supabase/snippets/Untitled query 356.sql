-- 给 profiles 表补充 INSERT (插入) 权限，允许用户自己 upsert 自己的档案
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);