-- 1. 创建标书项目表
CREATE TABLE public.bidding_projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    project_name TEXT NOT NULL,       -- 标书名称（如：山东省千佛山医院...docx）
    file_url TEXT,                    -- 原文件的存储链接（用于左侧 iframe 预览）
    analysis_report TEXT,             -- Dify生成的：深度解析报告
    framework_content TEXT,           -- Dify生成的：完整框架
    checklist_content TEXT,           -- Dify生成的：资料清单
    status TEXT DEFAULT 'processing', -- 状态：'processing'(解析中), 'completed'(已完成), 'failed'(失败)
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 开启 RLS 安全锁
ALTER TABLE public.bidding_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能管理自己的标书项目" ON public.bidding_projects FOR ALL USING (auth.uid() = user_id);