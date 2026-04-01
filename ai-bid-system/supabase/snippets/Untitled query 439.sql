CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name VARCHAR NOT NULL,
  product_name VARCHAR NOT NULL,
  version VARCHAR NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, company_name, product_name, version)
);

CREATE TABLE IF NOT EXISTS product_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  asset_name VARCHAR NOT NULL,
  asset_type VARCHAR CHECK (asset_type IN ('image', 'text')) NOT NULL,
  file_url TEXT,
  text_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_company_name ON products(company_name);
CREATE INDEX IF NOT EXISTS idx_product_assets_product_id ON product_assets(product_id);
