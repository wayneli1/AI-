-- personnel-attachments 存储桶策略

-- 允许认证用户上传
CREATE POLICY "personnel_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'personnel-attachments' AND auth.role() = 'authenticated');

-- 允许公开读取
CREATE POLICY "personnel_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'personnel-attachments');

-- 允许认证用户删除
CREATE POLICY "personnel_storage_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'personnel-attachments' AND auth.role() = 'authenticated');

-- 允许认证用户更新
CREATE POLICY "personnel_storage_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'personnel-attachments' AND auth.role() = 'authenticated');
