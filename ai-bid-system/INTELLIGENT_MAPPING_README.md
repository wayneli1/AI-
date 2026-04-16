# 智能字段映射功能 - 快速配置指南

## 功能概述

通过 Dify 工作流和后端 AI 推理，实现标书表格空白单元格到人员库字段的智能映射，解决复杂表格填充不准确的问题。

## 架构设计

```
标书文档 
  ↓
后端解析 (XML 识别表格结构 + 空白单元格)
  ↓
Dify 工作流 (AI 推理字段映射)
  ↓
前端智能填充 (基于映射结果填充人员数据)
  ↓
导出填充后的标书
```

## 已完成的工作

### 1. 后端实现 ✅

**新增文件:**
- `backend/routes/intelligent_mapping.py` - 智能映射接口
- `backend/config/personnel_schema.py` - 人员库字段定义
- `backend/.env.example` - 环境变量配置示例

**核心接口:**
- `POST /api/intelligent-field-mapping` - 单表格智能映射
- `POST /api/batch-intelligent-mapping` - 批量表格智能映射

**数据流:**
```
前端请求 → 后端接收表格数据 → 调用 Dify API → 返回映射结果
```

### 2. 前端实现 ✅

**新增文件:**
- `frontend/src/utils/intelligentMapping.js` - 智能映射工具类

**修改文件:**
- `frontend/src/pages/CreateBid.jsx` - 集成智能映射接口

**核心功能:**
- 解析完成后自动调用智能映射接口
- 使用 AI 返回的字段路径填充人员数据
- 支持复杂嵌套字段（如 `custom_fields.job_positions[].project_experiences[]`）
- 失败时自动回退到本地规则映射

### 3. 文档 ✅

- `DIFY_WORKFLOW_GUIDE.md` - Dify 工作流详细配置指南
- 包含完整的 Prompt 模板和测试数据

## 配置步骤

### 步骤 1: 创建 Dify 工作流

1. 登录 Dify: http://192.168.169.107
2. 创建新工作流: "智能字段映射工作流"
3. 配置输入变量（5个）:
   - `table_context` (文本)
   - `table_type` (文本)
   - `table_headers` (数组)
   - `blank_cells` (数组)
   - `personnel_fields` (数组)

4. 添加 LLM 节点:
   - 模型: GPT-4 或 Claude-3.5-Sonnet
   - 温度: 0.1
   - 使用文档中的 System Prompt 和 User Prompt

5. 配置输出变量:
   - `mappings` (数组)

6. 测试并发布工作流

### 步骤 2: 配置后端环境变量

创建 `backend/.env` 文件:

```bash
DIFY_BASE_URL=http://192.168.169.107/v1
DIFY_FIELD_MAPPING_API_KEY=app-你的API密钥
```

### 步骤 3: 启动服务

```bash
# 启动后端
cd backend
python main.py

# 启动前端（另一个终端）
cd frontend
npm run dev
```

### 步骤 4: 测试功能

1. 上传包含复杂表格的标书文档
2. 查看浏览器控制台，确认智能映射被调用
3. 选择人员填充表格，验证数据准确性

## 核心优势

### 相比硬编码规则映射:

1. **动态适应** - AI 能理解不同表格格式和语义
2. **智能推理** - 处理复杂字段（如"从业年限"需要计算项目时间跨度）
3. **易于维护** - 不需要手动添加映射规则
4. **高准确率** - 基于上下文和语义理解，而非简单的正则匹配

### 数据示例:

**输入（空白单元格）:**
```json
{
  "row": 1,
  "col": 5,
  "label": "从业年限",
  "headerText": "从业年限"
}
```

**AI 推理输出:**
```json
{
  "row": 1,
  "col": 5,
  "label": "从业年限",
  "mappedField": "projectExperiences",
  "mappedFieldPath": "custom_fields.job_positions[].project_experiences[]",
  "confidence": "medium",
  "reasoning": "从业年限需要从项目经历数组计算时间跨度"
}
```

**前端处理:**
- 识别到需要计算时间跨度
- 遍历所有项目经历，计算总年限
- 填充到对应单元格

## 故障排查

### 问题 1: 后端报错 "Dify API 调用失败"

**原因:** API Key 未配置或错误

**解决:**
```bash
# 检查 backend/.env 文件
cat backend/.env

# 确认 DIFY_FIELD_MAPPING_API_KEY 已设置
```

### 问题 2: 前端回退到本地规则映射

**原因:** 智能映射接口调用失败

**解决:**
1. 检查后端是否启动: `http://localhost:8000/health`
2. 检查 Dify 工作流是否发布
3. 查看浏览器控制台错误信息

### 问题 3: 映射结果不准确

**原因:** Prompt 需要优化

**解决:**
1. 在 Dify 中调整 System Prompt
2. 增加更多示例和规则
3. 使用更强大的模型（GPT-4）

## 后续优化建议

1. **缓存机制** - 对相同表格结构缓存映射结果
2. **用户反馈** - 收集手动调整的映射，用于优化 Prompt
3. **批量处理** - 使用批量接口提升性能
4. **映射可视化** - 在前端显示 AI 的推理过程

## 技术细节

### 人员库字段定义（40+ 字段）

包含:
- 基本信息: 姓名、性别、出生日期、身份证号等
- 教育背景: 学历、学位、专业、毕业院校等
- 职业信息: 职务、职称、部门、工号等
- 项目经历: 项目名称、角色、时间、描述等
- 资质证书: 证书名称、编号、发证日期等

### 字段路径示例

```javascript
// 简单字段
"name" → profile.name

// 嵌套字段
"custom_fields.job_positions[0].title" → profile.custom_fields.job_positions[0].title

// 数组字段
"custom_fields.job_positions[].project_experiences[].project_name" 
  → profile.custom_fields.job_positions[0].project_experiences[0].project_name
```

## 总结

智能字段映射功能通过 Dify 工作流实现了 AI 驱动的表格填充，大幅提升了复杂表格的填充准确率。系统已完成开发，只需配置 Dify 工作流即可使用。

**下一步:** 按照 `DIFY_WORKFLOW_GUIDE.md` 创建 Dify 工作流并测试功能。
