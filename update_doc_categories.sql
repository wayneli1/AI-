-- 启用 RLS
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;

-- 所有人可查看
CREATE POLICY "All users can view all document_categories" ON document_categories
  FOR SELECT USING (true);

-- 仅自己可写
CREATE POLICY "Users can insert own document_categories" ON document_categories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own document_categories" ON document_categories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own document_categories" ON document_categories
  FOR DELETE USING (auth.uid() = user_id);
