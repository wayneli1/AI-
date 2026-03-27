-- ==========================================
-- 第一步：暴力拆除你之前建的“个人私有锁”
-- ==========================================
DROP POLICY IF EXISTS "个人图片隔离" ON public.images;
DROP POLICY IF EXISTS "个人文档隔离" ON public.documents;
DROP POLICY IF EXISTS "用户只能管理自己的分类" ON public.image_categories;
DROP POLICY IF EXISTS "用户只能管理自己的标书项目" ON public.bidding_projects;


-- ==========================================
-- 第二步：换上“全公司共享锁” 
-- (FOR ALL 代表增删改查全开放，USING (true) 代表对所有登录同事生效)
-- ==========================================

-- 1. 共享图片库 & 图片分类
CREATE POLICY "全公司共享图片" ON public.images FOR ALL TO authenticated USING (true);
CREATE POLICY "全公司共享图片分类" ON public.image_categories FOR ALL TO authenticated USING (true);

-- 2. 共享知识库(文档) & 文档分类
CREATE POLICY "全公司共享文档" ON public.documents FOR ALL TO authenticated USING (true);
CREATE POLICY "全公司共享文档分类" ON public.document_categories FOR ALL TO authenticated USING (true);

-- 3. 共享标书项目 & 分公司配置（既然团队协作，标书和分公司最好也共享）
CREATE POLICY "全公司共享标书项目" ON public.bidding_projects FOR ALL TO authenticated USING (true);
CREATE POLICY "全公司共享分公司配置" ON public.branches FOR ALL TO authenticated USING (true);

-- 刷新缓存使其立刻生效
NOTIFY pgrst, 'reload schema';