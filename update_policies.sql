-- === image_categories ===
DROP POLICY IF EXISTS "用户只能管理自己的分类" ON image_categories;
DROP POLICY IF EXISTS "Users can view their own categories" ON image_categories;

CREATE POLICY "All users can view all image_categories" ON image_categories
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own image_categories" ON image_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own image_categories" ON image_categories
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own image_categories" ON image_categories
  FOR DELETE USING (auth.uid() = user_id);

-- === images ===
DROP POLICY IF EXISTS "个人图片隔离" ON images;
DROP POLICY IF EXISTS "Users can view their own images" ON images;

CREATE POLICY "All users can view all images" ON images
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own images" ON images
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own images" ON images
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own images" ON images
  FOR DELETE USING (auth.uid() = user_id);

-- === documents ===
DROP POLICY IF EXISTS "个人文档隔离" ON documents;
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;

CREATE POLICY "All users can view all documents" ON documents
  FOR SELECT USING (true);
CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON documents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE USING (auth.uid() = user_id);
