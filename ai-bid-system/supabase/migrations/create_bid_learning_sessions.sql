-- ============================================================
-- 投标文件学习记录表：bid_learning_sessions
-- 用于记录用户学习投标文件的过程和结果
-- ============================================================

-- 1. 创建表
CREATE TABLE IF NOT EXISTS public.bid_learning_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 原始文件信息
  original_filename TEXT NOT NULL,
  original_file_size INTEGER,
  original_file_url TEXT, -- 原始文件存储路径
  
  -- Markdown转换信息
  markdown_content TEXT,
  markdown_size INTEGER,
  
  -- Dify提取结果
  extraction_result JSONB, -- Dify提取的结构化数据
  extraction_metadata JSONB DEFAULT '{}', -- 提取元数据（置信度、分块数、处理时间等）
  
  -- 处理状态
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',          -- 等待处理
    'converting',       -- 转换中（转Markdown）
    'uploading',        -- 上传中（到Dify）
    'extracting',       -- 提取中（Dify处理）
    'awaiting_verification', -- 等待人工校验
    'verifying',        -- 校验中
    'completed',        -- 已完成
    'failed'            -- 失败
  )),
  
  -- 关联信息
  company_profile_id UUID REFERENCES public.company_profiles(id) ON DELETE SET NULL,
  
  -- 校验信息
  verified BOOLEAN DEFAULT FALSE,
  verified_by UUID REFERENCES auth.users(id),
  verified_at TIMESTAMPTZ,
  notes TEXT, -- 校验备注
  
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 启用 RLS
ALTER TABLE public.bid_learning_sessions ENABLE ROW LEVEL SECURITY;

-- 3. RLS 策略：用户只能操作自己的数据
CREATE POLICY "bid_learning_sessions_select_own"
  ON public.bid_learning_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "bid_learning_sessions_insert_own"
  ON public.bid_learning_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bid_learning_sessions_update_own"
  ON public.bid_learning_sessions FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "bid_learning_sessions_delete_own"
  ON public.bid_learning_sessions FOR DELETE
  USING (user_id = auth.uid());

-- 4. 索引（优化查询性能）
CREATE INDEX IF NOT EXISTS idx_bid_learning_user_id
  ON public.bid_learning_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_bid_learning_status
  ON public.bid_learning_sessions (status);

CREATE INDEX IF NOT EXISTS idx_bid_learning_company
  ON public.bid_learning_sessions (company_profile_id);

CREATE INDEX IF NOT EXISTS idx_bid_learning_created
  ON public.bid_learning_sessions (created_at DESC);

-- 5. 为 company_profiles 表添加学习记录关联（可选）
-- 在 company_profiles.custom_fields 中存储学习来源信息
-- 这将在应用层处理，不需要数据库变更

-- 6. updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION public.handle_bid_learning_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bid_learning_sessions_updated_at
  ON public.bid_learning_sessions;

CREATE TRIGGER trg_bid_learning_sessions_updated_at
  BEFORE UPDATE ON public.bid_learning_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_bid_learning_updated_at();

-- 7. 注释（文档化）
COMMENT ON TABLE public.bid_learning_sessions IS '投标文件学习记录表，记录用户学习投标文件的过程和提取结果';
COMMENT ON COLUMN public.bid_learning_sessions.extraction_result IS 'Dify提取的结构化数据，包含公司信息、项目信息、技术要求等';
COMMENT ON COLUMN public.bid_learning_sessions.extraction_metadata IS '提取过程的元数据，如置信度、分块数、处理时间等';
COMMENT ON COLUMN public.bid_learning_sessions.markdown_content IS '原始文件转换后的Markdown格式内容，用于Dify处理';

-- 8. 刷新架构缓存
NOTIFY pgrst, 'reload schema';