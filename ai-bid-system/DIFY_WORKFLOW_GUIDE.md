# Dify 智能字段映射工作流配置指南

## 概述

本文档指导您在 Dify 中创建智能字段映射工作流，用于将标书表格中的空白单元格智能映射到人员库字段。

## 工作流架构

```
输入数据 → LLM 推理 → 输出映射结果
```

## 第一步：创建工作流

1. 登录 Dify 平台：http://192.168.169.107
2. 进入"工作室" → "工作流"
3. 点击"创建工作流"
4. 选择"从空白开始"
5. 命名为：`智能字段映射工作流`

## 第二步：配置输入变量

在"开始"节点中添加以下输入变量：

### 1. table_context (文本)
- **变量名**: `table_context`
- **类型**: 文本
- **描述**: 表格上下文（表格前后的文字说明）
- **示例**: "项目组成员简历表"

### 2. table_type (文本)
- **变量名**: `table_type`
- **类型**: 文本
- **描述**: 表格类型标签
- **示例**: "resume_table"

### 3. table_headers (数组)
- **变量名**: `table_headers`
- **类型**: 数组
- **描述**: 表格列标题
- **示例**: `["姓名", "性别", "学历", "职称", "项目名称", "起止时间"]`

### 4. blank_cells (数组)
- **变量名**: `blank_cells`
- **类型**: 数组
- **描述**: 空白单元格列表（JSON 数组）
- **示例**:
```json
[
  {
    "row": 1,
    "col": 0,
    "label": "姓名",
    "headerText": "姓名",
    "text": ""
  },
  {
    "row": 1,
    "col": 2,
    "label": "学历",
    "headerText": "学历",
    "text": ""
  }
]
```

### 5. personnel_fields (数组)
- **变量名**: `personnel_fields`
- **类型**: 数组
- **描述**: 人员库字段定义（JSON 数组）
- **示例**:
```json
[
  {
    "fieldName": "name",
    "fieldLabel": "姓名",
    "fieldType": "string",
    "fieldPath": "name",
    "description": "人员姓名"
  },
  {
    "fieldName": "education",
    "fieldLabel": "学历",
    "fieldType": "string",
    "fieldPath": "education",
    "description": "最高学历"
  }
]
```

## 第三步：添加 LLM 节点

1. 拖拽"LLM"节点到画布
2. 连接"开始"节点到"LLM"节点
3. 配置 LLM 节点：

### 模型选择
- **模型**: `gpt-4` 或 `claude-3-5-sonnet`（推荐）
- **温度**: `0.1`（低温度保证稳定性）
- **最大令牌数**: `4000`

### 系统提示词 (System Prompt)

```
你是一个智能字段映射专家，负责将标书表格中的空白单元格映射到人员库字段。

你的任务：
1. 分析表格结构（上下文、列标题、空白单元格的语义标签）
2. 理解人员库的字段定义（字段名、字段路径、字段描述）
3. 为每个空白单元格找到最匹配的人员库字段
4. 返回映射结果（JSON 格式）

映射规则：
- 精确匹配：空白单元格的 label 与字段的 fieldLabel 完全一致 → 高置信度
- 语义匹配：label 与 fieldLabel 语义相近（如"姓名"与"人员姓名"）→ 中等置信度
- 路径推理：对于复杂字段（如"从业年限"），需要推理出正确的字段路径
- 项目经历：如果表格包含项目相关列（项目名称、起止时间等），应映射到 project_experiences 数组字段

特殊处理：
- "从业年限"/"工作年限" → 需要从 project_experiences 数组计算时间跨度
- "项目名称" → custom_fields.job_positions[].project_experiences[].project_name
- "起止时间"/"项目时间" → custom_fields.job_positions[].project_experiences[].start_date 和 end_date
- "项目角色"/"担任职务" → custom_fields.job_positions[].project_experiences[].role

输出格式（严格 JSON）：
{
  "mappings": [
    {
      "row": 1,
      "col": 0,
      "label": "姓名",
      "mappedField": "name",
      "mappedFieldPath": "name",
      "confidence": "high",
      "reasoning": "精确匹配：空白单元格标签'姓名'与字段'name'完全对应"
    }
  ]
}
```

### 用户提示词 (User Prompt)

```
请为以下表格进行智能字段映射：

## 表格上下文
{{table_context}}

## 表格类型
{{table_type}}

## 表格列标题
{{table_headers}}

## 空白单元格列表
{{blank_cells}}

## 人员库字段定义
{{personnel_fields}}

---

请分析以上信息，为每个空白单元格找到最匹配的人员库字段，并返回 JSON 格式的映射结果。
```

## 第四步：添加代码节点（可选，用于格式化输出）

如果 LLM 输出不稳定，可以添加"代码"节点进行后处理：

```python
import json

def main(llm_output: str) -> dict:
    """
    解析 LLM 输出，确保返回正确的 JSON 格式
    """
    try:
        # 尝试直接解析
        result = json.loads(llm_output)
        return result
    except:
        # 如果失败，尝试提取 JSON 部分
        import re
        json_match = re.search(r'\{.*\}', llm_output, re.DOTALL)
        if json_match:
            return json.loads(json_match.group())
        else:
            # 返回空映射
            return {"mappings": []}
```

## 第五步：配置输出变量

在"结束"节点中配置输出：

- **变量名**: `mappings`
- **类型**: 数组
- **来源**: LLM 节点的输出（或代码节点的输出）

## 第六步：测试工作流

使用以下测试数据：

```json
{
  "table_context": "项目组成员简历表",
  "table_type": "resume_table",
  "table_headers": ["姓名", "性别", "学历", "职称", "项目名称", "起止时间"],
  "blank_cells": [
    {"row": 1, "col": 0, "label": "姓名", "headerText": "姓名", "text": ""},
    {"row": 1, "col": 1, "label": "性别", "headerText": "性别", "text": ""},
    {"row": 1, "col": 2, "label": "学历", "headerText": "学历", "text": ""},
    {"row": 1, "col": 3, "label": "职称", "headerText": "职称", "text": ""},
    {"row": 1, "col": 4, "label": "项目名称", "headerText": "项目名称", "text": ""},
    {"row": 1, "col": 5, "label": "起止时间", "headerText": "起止时间", "text": ""}
  ],
  "personnel_fields": [
    {"fieldName": "name", "fieldLabel": "姓名", "fieldType": "string", "fieldPath": "name"},
    {"fieldName": "gender", "fieldLabel": "性别", "fieldType": "string", "fieldPath": "gender"},
    {"fieldName": "education", "fieldLabel": "学历", "fieldType": "string", "fieldPath": "education"},
    {"fieldName": "professionalTitle", "fieldLabel": "职称", "fieldType": "string", "fieldPath": "professional_title"},
    {"fieldName": "projectName", "fieldLabel": "项目名称", "fieldType": "string", "fieldPath": "custom_fields.job_positions[].project_experiences[].project_name"},
    {"fieldName": "projectStartDate", "fieldLabel": "项目开始时间", "fieldType": "date", "fieldPath": "custom_fields.job_positions[].project_experiences[].start_date"}
  ]
}
```

预期输出：

```json
{
  "mappings": [
    {"row": 1, "col": 0, "label": "姓名", "mappedField": "name", "mappedFieldPath": "name", "confidence": "high", "reasoning": "精确匹配"},
    {"row": 1, "col": 1, "label": "性别", "mappedField": "gender", "mappedFieldPath": "gender", "confidence": "high", "reasoning": "精确匹配"},
    {"row": 1, "col": 2, "label": "学历", "mappedField": "education", "mappedFieldPath": "education", "confidence": "high", "reasoning": "精确匹配"},
    {"row": 1, "col": 3, "label": "职称", "mappedField": "professionalTitle", "mappedFieldPath": "professional_title", "confidence": "high", "reasoning": "精确匹配"},
    {"row": 1, "col": 4, "label": "项目名称", "mappedField": "projectName", "mappedFieldPath": "custom_fields.job_positions[].project_experiences[].project_name", "confidence": "high", "reasoning": "项目经历字段映射"},
    {"row": 1, "col": 5, "label": "起止时间", "mappedField": "projectStartDate", "mappedFieldPath": "custom_fields.job_positions[].project_experiences[].start_date", "confidence": "medium", "reasoning": "时间字段映射"}
  ]
}
```

## 第七步：发布工作流并获取 API Key

1. 点击右上角"发布"按钮
2. 进入"API 访问"页面
3. 复制 API Key（格式：`app-xxxxxxxxxxxxxx`）
4. 将 API Key 填入后端配置文件：

```bash
# backend/.env
DIFY_FIELD_MAPPING_API_KEY=app-xxxxxxxxxxxxxx
```

## 第八步：重启后端服务

```bash
cd backend
python main.py
```

## 验证

1. 上传一个包含复杂表格的标书文档
2. 查看后端日志，确认智能映射接口被调用
3. 检查前端表格，验证字段映射是否正确

## 故障排查

### 问题1：Dify 返回 401 错误
- 检查 API Key 是否正确
- 确认工作流已发布

### 问题2：映射结果不准确
- 调整 LLM 温度（降低到 0.1）
- 优化系统提示词，增加更多示例
- 使用更强大的模型（如 GPT-4 或 Claude-3.5-Sonnet）

### 问题3：超时错误
- 增加后端请求超时时间（默认 60 秒）
- 优化 Prompt，减少输入数据量

## 高级优化

### 1. 添加缓存机制
对于相同的表格结构，可以缓存映射结果，避免重复调用 Dify。

### 2. 批量映射
使用 `batch-intelligent-mapping` 接口一次性处理多个表格。

### 3. 用户反馈学习
收集用户手动调整的映射结果，用于优化 Prompt 或微调模型。

## 总结

智能字段映射工作流通过 AI 推理，能够动态适应不同格式的标书表格，大幅提升填充准确率。相比硬编码的规则映射，具有更强的灵活性和扩展性。
