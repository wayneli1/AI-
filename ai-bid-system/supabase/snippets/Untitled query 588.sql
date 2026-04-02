-- 检查product_assets表中的图片资产
SELECT 
  pa.id,
  pa.asset_name,
  pa.asset_type,
  pa.file_url,
  pa.created_at,
  p.product_name,
  p.version
FROM product_assets pa
LEFT JOIN products p ON pa.product_id = p.id
WHERE pa.asset_type = 'image'
ORDER BY pa.created_at DESC
LIMIT 10;
