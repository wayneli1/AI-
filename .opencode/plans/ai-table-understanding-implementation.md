# AI完全接管表格理解 - 完整实施方案

## 目标
让AI像人眼一样理解表格结构，不再依赖后端的表头识别规则。

## 核心思路
- **后端**：只提取原始单元格数据 + 生成完整的 `tableHtml`
- **AI (Dify)**：接收 `tableHtml`，像人眼一样理解表格布局，识别字段标签和填充位置
- **前端**：根据AI返回的 `(row, col)` 坐标精准填充数据

---

## 修改清单

### 1️⃣ 后端：Schema增加tableHtml字段

**文件**: `backend/schemas/response.py`

#### 修改1: DynamicTable (第41-49行)
```python
class DynamicTable(BaseModel):
    tableId: int
    type: str
    anchorContext: str
    headers: List[str]
    rowCount: int
    blankCells: Optional[List[BlankCell]] = None
    fillMode: Optional[str] = "multi_person"
    emptyRowCount: Optional[int] = 0
    tableHtml: Optional[str] = ""  # 🆕 完整的表格HTML，供AI理解表格结构
```

#### 修改2: TableStructure (第59-67行)
```python
class TableStructure(BaseModel):
    tableId: int
    rowCount: int
    colCount: int
    headers: List[str]
    cells: List[TableCell]
    blankCells: List[BlankCell]
    anchorContext: str
    tableHtml: Optional[str] = ""  # 🆕 完整的表格HTML，供AI理解表格结构
```

---

### 2️⃣ 后端：确保tableHtml正确传递到前端

**文件**: `backend/routes/parse_bid.py`

需要检查 `parse_table()` 函数返回的数据是否包含 `tableHtml`。

#### 查找位置
搜索 `def parse_table` 或 `TableStructure(` 的构造位置，确保：
```python
TableStructure(
    tableId=...,
    rowCount=...,
    colCount=...,
    headers=...,
    cells=...,
    blankCells=...,
    anchorContext=...,
    tableHtml=table_html  # 🆕 确保传递这个字段
)
```

同样检查 `DynamicTable` 的构造：
```python
DynamicTable(
    tableId=...,
    type=...,
    anchorContext=...,
    headers=...,
    rowCount=...,
    blankCells=...,
    fillMode=...,
    emptyRowCount=...,
    tableHtml=table_html  # 🆕 确保传递这个字段
)
```

---

### 3️⃣ 后端：SmartFillRequest增加tableHtml参数

**文件**: `backend/routes/intelligent_mapping.py`

#### 修改1: SmartFillRequest (第20-28行)
```python
class SmartFillRequest(BaseModel):
    tableId: int
    tableType: str
    anchorContext: str
    headers: List[str]
    blankCells: List[BlankCellInfo]
    personData: Dict[str, Any]
    positionName: str = ""
    tableHtml: str = ""  # 🆕 完整的表格HTML
```

#### 修改2: intelligent_field_mapping函数 (第143-149行)
```python
table_data = {
    "tableId": request.tableId,
    "tableType": request.tableType,
    "anchorContext": request.anchorContext,
    "headers": request.headers,
    "blankCells": [bc.dict() for bc in request.blankCells],
    "tableHtml": request.tableHtml,  # 🆕 传递tableHtml
}
```

---

### 4️⃣ 前端：callSmartFill增加tableHtml参数

**文件**: `frontend/src/utils/intelligentMapping.js`

#### 修改1: 函数签名和JSDoc (第15行)
```javascript
/**
 * @param {string} params.tableHtml - 🆕 完整的表格HTML
 */
export async function callSmartFill({ 
  tableId, 
  tableType, 
  anchorContext, 
  headers, 
  blankCells, 
  personData, 
  positionName,
  tableHtml  // 🆕 新增参数
}) {
```

#### 修改2: payload构造 (第47-55行)
```javascript
const payload = {
  tableId,
  tableType: tableType || 'unknown',
  anchorContext: anchorContext || '',
  headers: headers || [],
  blankCells: slimBlanks,
  personData: slimPerson,
  positionName: positionName || '',
  tableHtml: tableHtml || '',  // 🆕 传递tableHtml
};
```

---

### 5️⃣ 前端：handleSelectPerson传递tableHtml

**文件**: `frontend/src/pages/CreateBid.jsx`

需要找到 `handleSelectPerson` 函数中调用 `callSmartFill` 的地方。

#### 查找位置
搜索 `callSmartFill({` 或 `handleSelectPerson`，找到类似这样的代码：
```javascript
const result = await callSmartFill({
  tableId: table.tableId,
  tableType: table.type,
  anchorContext: table.anchorContext,
  headers: table.headers,
  blankCells: table.blankCells,
  personData: person,
  positionName: positionName,
  tableHtml: table.tableHtml || '',  // 🆕 传递tableHtml
});
```

---

### 6️⃣ 前端：改为基于(row,col)坐标的填充逻辑

**文件**: `frontend/src/pages/CreateBid.jsx`

#### 当前逻辑（需要修改）
现在的逻辑是：AI返回 `{header, value}`，前端根据 `header` 匹配列。

#### 新逻辑
AI直接返回 `{row, col, value}`，前端根据坐标填充。

#### 修改位置
在 `handleSelectPerson` 函数中，找到处理 `result.fills` 的代码，改为：

```javascript
// 🆕 新逻辑：基于坐标填充
const newRowData = {};
result.fills.forEach(fill => {
  const key = `${fill.row}_${fill.col}`;  // 使用坐标作为key
  newRowData[key] = fill.value;
});

// 更新表格数据
setTableData(prev => {
  const updated = { ...prev };
  const tableKey = `table_${tableId}`;
  
  if (!updated[tableKey]) {
    updated[tableKey] = [];
  }
  
  // 找到第一个空位置插入
  const insertIndex = updated[tableKey].findIndex(row => !row || Object.keys(row).length === 0);
  
  if (insertIndex >= 0) {
    updated[tableKey][insertIndex] = {
      ...newRowData,
      _personName: person.name,
      _positionName: positionName,
    };
  } else {
    updated[tableKey].push({
      ...newRowData,
      _personName: person.name,
      _positionName: positionName,
    });
  }
  
  return updated;
});
```

---

### 7️⃣ 前端：表格渲染逻辑适配坐标填充

**文件**: `frontend/src/pages/CreateBid.jsx`

#### 修改表格渲染逻辑
找到表格渲染的代码（通常在 `renderDynamicTable` 或类似函数中），改为：

```javascript
// 渲染单元格时，检查是否有填充数据
const cellKey = `${rowIndex}_${colIndex}`;
const filledValue = rowData[cellKey];

if (filledValue) {
  // 渲染填充的值
  return <td key={colIndex}>{filledValue}</td>;
} else {
  // 渲染可编辑的空白单元格
  return (
    <td key={colIndex}>
      <input 
        type="text" 
        value={rowData[cellKey] || ''} 
        onChange={(e) => handleCellChange(tableId, rowIndex, colIndex, e.target.value)}
      />
    </td>
  );
}
```

---

## 8️⃣ Dify工作流配置指南

### 输入变量（Inputs）

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `table_html` | String | 完整的表格HTML（包含所有单元格、合并信息） |
| `blank_cells` | String (JSON) | 空白单元格列表：`[{row, col, label, headerText, rowHeader}]` |
| `personnel_fields` | String (JSON) | 人员数据：`{name, gender, birth_date, education, ...}` |
| `table_context` | String | 表格上下文（可选，用于理解表格用途） |

### 提示词模板

```
你是一个表格理解专家。你的任务是像人眼一样理解表格结构，识别哪些单元格是"字段标签"，哪些是"值单元格"，然后根据人员数据填充。

## 输入数据

### 1. 表格HTML
{{table_html}}

### 2. 空白单元格列表
{{blank_cells}}

### 3. 人员数据
{{personnel_fields}}

### 4. 表格上下文
{{table_context}}

## 你的任务

1. **理解表格结构**：
   - 分析表格HTML，识别表头、合并单元格、字段标签的位置
   - 像人眼一样理解：哪些单元格是"姓名"、"性别"、"学历"等标签
   - 识别哪些单元格是需要填充的"值单元格"

2. **匹配字段**：
   - 将表格中的字段标签与人员数据中的字段进行智能匹配
   - 例如："姓名" → personnel_fields.name
   - 例如："出生年月" → personnel_fields.birth_date
   - 例如："学历/学位" → personnel_fields.education + "/" + personnel_fields.degree

3. **生成填充方案**：
   - 对于每个需要填充的单元格，返回其坐标 (row, col) 和填充值
   - 只填充有明确对应关系的单元格，不确定的留空

## 输出格式

返回JSON数组，每个元素包含：
- `row`: 行号（从0开始）
- `col`: 列号（从0开始）
- `value`: 填充的值
- `field_name`: 对应的字段名（用于调试）
- `reasoning`: 为什么这样填充（可选，用于调试）

示例：
```json
{
  "fills": [
    {
      "row": 2,
      "col": 1,
      "value": "张三",
      "field_name": "name",
      "reasoning": "第2行第1列是'姓名'字段的值单元格"
    },
    {
      "row": 2,
      "col": 3,
      "value": "男",
      "field_name": "gender",
      "reasoning": "第2行第3列是'性别'字段的值单元格"
    }
  ]
}
```

## 注意事项

1. **坐标从0开始**：第一行是row=0，第一列是col=0
2. **只填充空白单元格**：不要修改已有内容的单元格
3. **智能组合字段**：如果表格要求"学历/学位"，则组合 education + "/" + degree
4. **日期格式转换**：根据表格要求的格式转换日期（如：1990-01-01 → 1990年1月）
5. **处理缺失数据**：如果人员数据中某个字段为空，不要填充该单元格

现在开始分析并生成填充方案。
```

### 输出变量（Outputs）

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `mappings` | String (JSON) | 填充方案：`{fills: [{row, col, value, field_name, reasoning}]}` |

---

## 测试步骤

1. **后端测试**：
   ```bash
   # 重启后端
   cd backend
   python main.py
   
   # 检查日志，确认tableHtml有内容
   # 应该看到：🤖 [Dify] 表格HTML长度: XXXX 字符
   ```

2. **前端测试**：
   ```bash
   # 重启前端
   cd frontend
   npm run dev
   
   # 打开浏览器控制台，上传fuzabiaoge.docx
   # 选择人员，观察填充行为
   ```

3. **Dify测试**：
   - 在Dify工作流中，使用"运行"按钮测试
   - 输入示例数据，检查AI是否正确识别表格结构
   - 检查返回的 `fills` 数组是否包含正确的坐标

---

## 预期效果

✅ **解决复杂表格解析问题**：fuzabiaoge.docx等多层表头表格能正确识别  
✅ **填充位置正确**：选择人员后，数据填充到第一个空白行（行2），而非追加到末尾  
✅ **AI理解表格**：不再依赖后端的表头识别规则，AI自己分析表格结构  
✅ **坐标精准填充**：基于 (row, col) 坐标，不会出现列错位问题  

---

## 回滚方案

如果出现问题，可以快速回滚：

1. **后端**：移除 `tableHtml` 字段，恢复原来的 schema
2. **前端**：移除 `tableHtml` 参数，恢复基于 `header` 的填充逻辑
3. **Dify**：恢复原来的提示词，继续使用 `headerText`

---

## 下一步

1. 你确认这个方案后，我会逐个文件进行修改
2. 修改完成后，我会帮你测试整个流程
3. 如果有问题，我们可以逐步调试

准备好了吗？
