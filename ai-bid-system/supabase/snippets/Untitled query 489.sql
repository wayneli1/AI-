ALTER TABLE product_assets DROP CONSTRAINT IF EXISTS product_assets_asset_type_check;
ALTER TABLE product_assets ADD CONSTRAINT product_assets_asset_type_check 
  CHECK (asset_type IN ('image', 'text', 'document'));
