-- ==========================================
-- 第一步：新建“分公司”和“文档分类”的基础表
-- ==========================================

-- 1. 新增【分公司表】 (用于区分资料属于北京分公司、广州总公司等)
CREATE TABLE branches (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  name text NOT NULL, -- 分公司名称
  created_at timestamp with time zone DEFAULT now()
);

-- 2. 新增【文档分类表】 (让知识库也能像图片库一样，拥有左侧文件夹树)
CREATE TABLE document_categories (
  id uuid NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  name text NOT NULL, -- 分类名称 (如：招标文件、历史业绩、资格证明)
  created_at timestamp with time zone DEFAULT now()
);

-- ==========================================
-- 第二步：给现有的表打补丁（增加 OCR 和 业务字段）
-- ==========================================

-- 3. 改造现有的【图片表 (images)】
ALTER TABLE images 
  ADD COLUMN branch_id uuid REFERENCES branches(id), -- 归属分公司
  ADD COLUMN expire_date date,                       -- 证件有效期 (如营业执照到期日)
  ADD COLUMN ocr_content text,                       -- 存放 OCR 提取出来的纯文本
  ADD COLUMN ocr_status text DEFAULT 'pending';      -- 识别状态: pending(待识别), completed(已完成), failed(失败)

-- 4. 改造现有的【文档表 (documents)】
ALTER TABLE documents 
  ADD COLUMN category_id uuid REFERENCES document_categories(id), -- 关联文档分类
  ADD COLUMN branch_id uuid REFERENCES branches(id),              -- 归属分公司
  ADD COLUMN expire_date date,                                    -- 文档有效期
  ADD COLUMN ocr_content text,                                    -- 存放解析出来的 PDF/Word 纯文本
  ADD COLUMN ocr_status text DEFAULT 'pending';                   -- 提取状态