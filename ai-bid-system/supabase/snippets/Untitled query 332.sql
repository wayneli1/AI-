-- 1. 新建一个“图片分类表” (image_categories)
CREATE TABLE public.image_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL, -- 分类名称（比如：A公司资质、B公司产品）
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 为分类表开启安全锁 (RLS)
ALTER TABLE public.image_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能管理自己的分类" ON public.image_categories FOR ALL USING (auth.uid() = user_id);

-- 3. 修改之前的 images 表，加一个关联字段
-- 注意：这里用了 ON DELETE SET NULL。意思是如果你删除了"A公司"这个分类，里面的图片不会被删掉，而是变成"未分类"状态，这最安全！
ALTER TABLE public.images 
ADD COLUMN category_id UUID REFERENCES public.image_categories(id) ON DELETE SET NULL;

-- 4. 刷新缓存
NOTIFY pgrst, 'reload schema';