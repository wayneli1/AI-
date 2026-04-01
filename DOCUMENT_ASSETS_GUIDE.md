# 文档资产功能使用指南

## 功能概述

产品资产库现在支持三种资产类型：
1. **图片** - 系统架构图、产品截图等
2. **文本** - 手动粘贴的文本内容
3. **文档** - 上传 `.docx` 或 `.pdf` 文件，自动提取文本给 AI 使用

## 数据库变更

**执行以下 SQL 以启用文档类型：**
```sql
-- 在 Supabase SQL 编辑器中执行
ALTER TABLE product_assets DROP CONSTRAINT IF EXISTS product_assets_asset_type_check;
ALTER TABLE product_assets ADD CONSTRAINT product_assets_asset_type_check 
  CHECK (asset_type IN ('image', 'text', 'document'));
```

## 使用流程

### 1. 创建产品
1. 进入"产品资产库"页面
2. 点击左侧"新建产品"按钮
3. 填写：公司名称、产品名称、版本号
4. 点击"创建"

### 2. 添加文档资产
1. 在左侧树中选择产品版本
2. 点击右侧"添加资产"按钮
3. 选择资产类型："文档（上传 docx/pdf，自动提取文本给 AI）"
4. 上传 `.docx` 或 `.pdf` 文件
5. 系统自动提取文本内容
6. 点击"添加资产"保存

### 3. 在标书中使用
1. 进入"新建标书"页面
2. 输入公司名称
3. 在"关联产品资质"中选择产品版本
4. 点击"AI 自动填写"
5. AI 将自动引用文档中的文本内容

## 技术实现

### 文件存储
- 文档文件存储在 Supabase Storage 的 `product-assets/{user_id}/` 路径
- 与图片使用同一个 `images` 存储桶
- 文件 URL 保存在 `product_assets.file_url`

### 文本提取
- 使用 `extractTextFromDocument` 工具（复用招标文件解析逻辑）
- 支持 `.docx`（Word）和 `.pdf` 格式
- 提取的文本保存在 `product_assets.text_content`

### AI 提示词
- `document` 类型与 `text` 类型在提示词中表现一致
- AI 看到的只是提取出的文本内容
- 格式：`[资产名称]：文本内容...`

## 资产卡片展示

文档资产卡片显示：
- 📄 文档图标（紫色）
- "文档"标签
- 文件名 + "下载原文件"链接
- 提取的文本预览（前150字符）

## 注意事项

1. **文件大小**：Supabase Storage 默认限制，建议文档不超过 50MB
2. **文本提取**：复杂格式（表格、图表）可能提取不完整
3. **编辑文档**：如需修改文档内容，建议重新上传新版本
4. **删除资产**：同时删除存储中的文件

## 故障排除

### 问题：无法选择"文档"类型
- 检查是否执行了数据库 SQL 变更
- 刷新页面重新加载

### 问题：文本提取失败
- 检查文件格式是否为 `.docx` 或 `.pdf`
- 尝试重新上传文件
- 检查浏览器控制台错误信息

### 问题：AI 未引用文档内容
- 确认在 CreateBid 页面选择了正确的产品版本
- 检查 `product_assets.text_content` 字段是否有内容
- 查看浏览器网络请求，确认提示词是否包含文档内容