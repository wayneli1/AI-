-- 产品资产库数据库迁移脚本
-- 创建 products 和 product_assets 表

-- 1. 创建 products 表（产品及版本）
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name VARCHAR NOT NULL,
  product_name VARCHAR NOT NULL,
  version VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_name, product_name, version)
);

-- 2. 创建 product_assets 表（具体资产）
CREATE TABLE IF NOT EXISTS product_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  asset_name VARCHAR NOT NULL,
  asset_type VARCHAR CHECK (asset_type IN ('image', 'text')) NOT NULL,
  file_url TEXT,
  text_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 为常用查询创建索引
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_company_name ON products(company_name);
CREATE INDEX IF NOT EXISTS idx_product_assets_product_id ON product_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_product_assets_asset_type ON product_assets(asset_type);

-- 4. 添加注释
COMMENT ON TABLE products IS '产品及版本表，三级结构：所属公司 -> 产品及版本';
COMMENT ON TABLE product_assets IS '具体资产表，包含图片和文本两种类型';

-- 5. 示例数据（可选，用于测试）
-- INSERT INTO products (user_id, company_name, product_name, version) VALUES 
--   ('00000000-0000-0000-0000-000000000000', '某某邮件公司', '邮件系统', 'V5.0'),
--   ('00000000-0000-0000-0000-000000000000', '某某邮件公司', '邮件系统', 'V6.0');

-- INSERT INTO product_assets (product_id, asset_name, asset_type, text_content) VALUES
--   ((SELECT id FROM products WHERE product_name = '邮件系统' AND version = 'V6.0' LIMIT 1), 
--    '标准服务手册', 'text', '本服务提供7x24小时技术支持，响应时间不超过30分钟...');