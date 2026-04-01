-- 为 product_assets 表添加 'document' 资产类型支持
-- 执行此 SQL 以允许存储 docx/pdf 原始文件

-- 1. 删除旧的 CHECK 约束
ALTER TABLE product_assets DROP CONSTRAINT IF EXISTS product_assets_asset_type_check;

-- 2. 添加新的 CHECK 约束，包含 'document' 类型
ALTER TABLE product_assets ADD CONSTRAINT product_assets_asset_type_check 
  CHECK (asset_type IN ('image', 'text', 'document'));

-- 3. 可选：添加注释说明
COMMENT ON COLUMN product_assets.asset_type IS '资产类型：image=图片, text=纯文本, document=文档文件(docx/pdf)';

-- 4. 验证修改
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'product_assets' 
  AND column_name = 'asset_type';