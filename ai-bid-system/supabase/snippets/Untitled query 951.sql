-- ============================================================
-- 为 bidding_projects 补齐原始文件元数据
-- ============================================================

BEGIN;

ALTER TABLE public.bidding_projects
  ADD COLUMN IF NOT EXISTS original_file_name TEXT;

ALTER TABLE public.bidding_projects
  ADD COLUMN IF NOT EXISTS file_type TEXT;

ALTER TABLE public.bidding_projects
  ADD COLUMN IF NOT EXISTS mime_type TEXT;

UPDATE public.bidding_projects
SET
  original_file_name = COALESCE(original_file_name, project_name),
  file_type = COALESCE(
    file_type,
    CASE
      WHEN lower(COALESCE(file_url, '')) LIKE '%.pdf%' THEN 'pdf'
      WHEN lower(COALESCE(file_url, '')) LIKE '%.docx%' THEN 'docx'
      ELSE NULL
    END
  )
WHERE original_file_name IS NULL OR file_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bidding_projects_file_type_check'
  ) THEN
    ALTER TABLE public.bidding_projects
      ADD CONSTRAINT bidding_projects_file_type_check
      CHECK (file_type IS NULL OR file_type IN ('pdf', 'docx'));
  END IF;
END $$;

COMMENT ON COLUMN public.bidding_projects.original_file_name IS '用户上传时的原始文件名';
COMMENT ON COLUMN public.bidding_projects.file_type IS '原文件类型，仅支持 pdf/docx';
COMMENT ON COLUMN public.bidding_projects.mime_type IS '上传文件的 MIME 类型';

COMMIT;

NOTIFY pgrst, 'reload schema';
