-- 为 product_assets 增加 description 字段（用于存储图片 OCR 描述)
ALTER TABLE product_assets ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN product_assets.description IS 'text='图片 OCR 自动提取的描述文字，用于帮助 AI 精准匹配图片';
