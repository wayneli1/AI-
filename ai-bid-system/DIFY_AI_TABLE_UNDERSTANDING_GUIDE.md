# Dify AI 表格理解配置指南

## 🎯 目标

让 AI 像人眼一样理解表格结构，不再依赖后端的表头识别规则。

---

## 📋 前置条件

1. 已完成代码修改（后端 + 前端）
2. 后端已重启，确保 `tableHtml` 字段正确传递
3. 有 Dify 工作流的编辑权限

---

## 🔧 Dify 工作流配置步骤

### 1. 登录 Dify 平台

访问你的 Dify 实例（例如：`http://192.168.169.107`），登录账号。

### 2. 找到智能填充工作流

在工作流列表中找到名为 **"智能字段映射"** 或 **"表格填充"** 的工作流。

### 3. 检查输入变量

确保工作流有以下 4 个输入变量：

| 变量名 | 类型 | 说明 | 是否必需 |
|--------|------|------|---------|
| `table_context` | String | 表格上下文（表格前的段落文本） | 可选 |
| `table_html` | String | 完整的表格HTML结构 | **必需** |
| `blank_cells` | String (JSON) | 空白单元格列表 | 必需 |
| `personnel_fields` | String (JSON) | 人员数据 | 必需 |

**如果缺少 `table_html`，请添加：**
- 点击"输入变量"
- 添加新变量：名称 `table_html`，类型 `String`
- 保存

### 4. 更新 LLM 节点的提示词

找到 LLM 节点（通常是主要的 AI 处理节点），将提示词替换为以下内容：

```
你是专业的表格填充助手，能够像人眼一样理解复杂的表格结构，并根据人员信息智能填充表格。

# 输入数据

**表格上下文：**
{{#1776326402237.table_context#}}

**完整表格结构（HTML）：**
{{#1776326402237.table_html#}}

**需要填充的空白单元格列表：**
{{#1776326402237.blank_cells#}}

**人员信息数据源：**
{{#1776326402237.personnel_fields#}}

---

# 核心任务

你的任务是**像人眼一样理解表格**，而不是依赖预定义的规则。

## 步骤1：理解表格结构

仔细分析 table_html，识别：

1. **表格类型**：
   - 汇总表（多人多行，如：序号|姓名|年龄|性别...）
   - 单人简历表（字段-值对，如：姓名[___] 性别[___]）
   - 项目经历表（包含项目列表）
   - 其他复杂表格

2. **字段标签位置**：
   - 在表头行？
   - 在每个单元格的左侧？
   - 在每个单元格的上方？
   - 跨多行多列的合并单元格？

3. **填充位置**：
   - 哪些单元格是空白的需要填充？
   - 每个空白单元格对应什么字段？

## 步骤2：识别字段含义

对于每个空白单元格（blank_cells中的项）：

1. **查看其周围的单元格**（左侧、上方、同行、同列）
2. **找到字段标签**（如"姓名"、"性别"、"学历"等）
3. **忽略 headerText 和 rowHeader**（它们可能不准确），完全依靠你对 table_html 的理解

## 步骤3：提取人员数据

从 personnel_fields 中提取对应的值：

**基本信息字段映射：**
- 姓名/名字 → name
- 性别 → gender
- 年龄 → 根据 birth_date 计算（2026 - 出生年份）
- 学历 → education
- 学位 → degree
- 专业 → major
- 毕业学校/院校 → school
- 职称/资格/证书 → title
- 职务/职位/岗位 → job_title 或当前选择的职位
- 电话/联系方式 → phone
- 身份证号 → id_number
- 出生日期/出生年月 → birth_date
- 工作单位/机构 → organization
- 部门 → department
- 从业年限/工作年限 → 根据经验推断或使用默认值

**项目经历字段：**
- 从 personnel_fields.custom_fields.job_positions 中找到对应职位
- 从该职位的 experiences 数组中提取项目
- 如果表格有多行项目，按顺序分配：
  * 第1个空白项目行 → experiences[0]
  * 第2个空白项目行 → experiences[1]
  * 以此类推
- 项目字段：
  * 项目名称 → project_name
  * 时间/起止时间 → time_range（转为"YYYY-MM至YYYY-MM"格式）
  * 角色/担任职务 → role
  * 工作内容/项目描述 → description

## 步骤4：生成填充结果

为每个空白单元格返回填充值。

---

# 重要提示

1. **不要依赖 headerText 和 rowHeader**：它们可能不准确，完全依靠你对 table_html 的理解
2. **像人一样思考**：如果你是人，看到这个表格，你会如何理解它的结构？
3. **处理复杂布局**：
   - 合并单元格（rowspan/colspan）
   - 多层表头
   - 字段和值混合在一起的布局
4. **必须为每个空白单元格返回结果**（即使无法确定也返回空字符串""）
5. **保持 row 和 col 坐标不变**

---

# 输出格式

**严格按照以下 JSON 格式输出，不要添加任何 markdown 标记（如 ```json）或其他文本：**

{
  "fills": [
    {
      "row": 0,
      "col": 1,
      "field": "姓名",
      "value": "张三"
    },
    {
      "row": 0,
      "col": 4,
      "field": "性别",
      "value": "男"
    },
    {
      "row": 1,
      "col": 1,
      "field": "毕业学校",
      "value": "清华大学"
    }
  ]
}

**字段说明：**
- row: 单元格的行号（从0开始）
- col: 单元格的列号（从0开始）
- field: 你识别出的字段名称（用于调试和验证）
- value: 填充的值（字符串类型，空值用""）

---

# 输出要求

1. 只输出纯 JSON，不要包含任何其他文本或标记
2. 确保 JSON 格式正确，可以被解析
3. fills 数组中的每个对象必须包含：row, col, field, value
4. value 必须是字符串类型，空值用""（不要用 null）
5. 不要省略任何空白单元格，即使无法确定值也要返回
6. row 和 col 必须与 blank_cells 中的坐标完全一致
```

**注意：** 提示词中的 `{{#1776326402237.table_html#}}` 是 Dify 的变量引用语法，数字部分是节点ID，需要根据你的实际工作流调整。

### 5. 配置输出变量

确保工作流的输出节点配置为：

- 变量名：`mappings`
- 值选择器：指向 LLM 节点的输出文本

### 6. 保存并发布

- 点击"保存"
- 点击"发布"，使配置生效

---

## 🧪 测试步骤

### 1. 测试后端是否传递 tableHtml

启动后端：
```bash
cd backend
python main.py
```

上传一个 Word 文档，查看后端日志，应该看到：
```
📊 [后端] 表格 0: type=dynamic, label=人员汇总表, rows=10, anchor="..."
```

### 2. 测试前端是否传递 tableHtml

启动前端：
```bash
cd frontend
npm run dev
```

打开浏览器控制台（F12），上传文档并选择人员，应该看到：
```
🤖 [智能填充] 调用: 表格0, 人员=张三, 职位=项目经理, 空白数=5, HTML长度=1234
```

如果 `HTML长度=0`，说明 `tableHtml` 没有正确传递。

### 3. 测试 Dify 工作流

在 Dify 工作流编辑页面，点击"运行"按钮，输入测试数据：

**table_html 示例：**
```html
<table border="1">
  <tr>
    <td>序号</td>
    <td>姓名</td>
    <td>性别</td>
    <td>年龄</td>
  </tr>
  <tr>
    <td>1</td>
    <td>[空白]</td>
    <td>[空白]</td>
    <td>[空白]</td>
  </tr>
</table>
```

**blank_cells 示例：**
```json
[
  {"row": 1, "col": 1, "label": "", "headerText": "姓名", "rowHeader": ""},
  {"row": 1, "col": 2, "label": "", "headerText": "性别", "rowHeader": ""},
  {"row": 1, "col": 3, "label": "", "headerText": "年龄", "rowHeader": ""}
]
```

**personnel_fields 示例：**
```json
{
  "name": "张三",
  "gender": "男",
  "birth_date": "1990-01-01",
  "education": "本科",
  "degree": "学士",
  "major": "计算机科学",
  "school": "清华大学"
}
```

点击"运行"，检查输出是否正确：
```json
{
  "fills": [
    {"row": 1, "col": 1, "field": "姓名", "value": "张三"},
    {"row": 1, "col": 2, "field": "性别", "value": "男"},
    {"row": 1, "col": 3, "field": "年龄", "value": "36"}
  ]
}
```

### 4. 端到端测试

上传 `fuzabiaoge.docx`（复杂表格），选择人员，观察：

1. **填充位置正确**：数据填充到第一个空白行（行2），而非追加到末尾
2. **字段识别正确**："姓名"不会被识别成"职务"
3. **多层表头处理正确**：复杂的合并单元格能正确识别

---

## 🐛 常见问题

### 问题1：tableHtml 为空

**症状：** 前端日志显示 `HTML长度=0`

**解决：**
1. 检查后端 `response.py` 是否添加了 `tableHtml` 字段
2. 检查后端 `parse_bid.py` 是否传递了 `tableHtml`
3. 重启后端

### 问题2：Dify 返回格式错误

**症状：** 前端报错 `JSON parse error`

**解决：**
1. 检查 Dify 提示词是否强调"只输出纯 JSON，不要包含 markdown 标记"
2. 在 Dify 工作流中添加"代码节点"，清洗 LLM 输出：
```python
def main(text: str) -> dict:
    import json
    import re
    
    # 移除 markdown 代码块标记
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    
    cleaned = cleaned.strip()
    
    # 解析 JSON
    try:
        result = json.loads(cleaned)
        return {"mappings": json.dumps(result, ensure_ascii=False)}
    except:
        return {"mappings": cleaned}
```

### 问题3：AI 识别错误

**症状：** "姓名"被填充到"职务"列

**解决：**
1. 检查 `table_html` 是否完整（包含所有单元格）
2. 在提示词中增加示例，展示如何识别复杂表格
3. 调整 LLM 的 temperature（建议 0.1-0.3）

### 问题4：填充位置错误

**症状：** 数据追加到表格末尾，而非填充第一个空白行

**解决：**
1. 检查前端 `CreateBid.jsx` 是否使用了 `findIndex` 查找第一个空位置
2. 检查 `dynamicTableEdits` 的数据结构是否正确

---

## 📊 预期效果

✅ **fuzabiaoge.docx 正确识别**：多层表头、复杂合并单元格都能正确处理  
✅ **填充位置正确**：数据填充到第一个空白行，而非追加到末尾  
✅ **AI 理解表格**：不再依赖后端的表头识别规则  
✅ **坐标精准**：基于 (row, col) 坐标，不会出现列错位  

---

## 🔄 回滚方案

如果出现问题，可以快速回滚：

1. **后端**：移除 `tableHtml` 字段，恢复原来的 schema
2. **前端**：移除 `tableHtml` 参数，恢复基于 `header` 的填充逻辑
3. **Dify**：恢复原来的提示词，继续使用 `headerText`

---

## 📝 总结

通过这次改造，我们实现了：

1. **数据流完整**：后端 → 前端 → Dify，`tableHtml` 完整传递
2. **AI 接管理解**：AI 像人眼一样分析表格，不依赖后端规则
3. **坐标精准填充**：基于 (row, col) 坐标，避免列错位
4. **保持兼容性**：Word 导出格式完全不变

现在，系统能够处理任意复杂的表格结构！🎉
