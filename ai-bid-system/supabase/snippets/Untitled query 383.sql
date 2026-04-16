-- personnel-attachments 存储桶策略
CREATE POLICY "personnel_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'personnel-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "personnel_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'personnel-attachments');

CREATE POLICY "personnel_storage_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'personnel-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "personnel_storage_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'personnel-attachments' AND auth.role() = 'authenticated');