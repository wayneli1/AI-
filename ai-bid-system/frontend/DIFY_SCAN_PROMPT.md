# Dify 招标文件空白扫描工作流配置指南

## 工作流名称
招标文件空白扫描 (Bid Document Blank Scanner)

## 输入变量
- `paragraphs`: JSON 字符串，包含带索引的段落数组

## 输出变量
- `text`: JSON 字符串，包含识别出的空白位置数组

## AI 提示词 (Prompt)

```markdown
你是一个专业的招标文件分析专家。你的任务是识别招标文件中的空白位置（需要填写的位置）。

## 输入
你将收到一个 JSON 数组，每个元素包含：
- `paraIndex`: 段落索引（从0开始）
- `text`: 段落文本内容

## 任务
仔细分析每个段落，识别出所有需要填写的空白位置。空白位置包括但不限于：
1. 下划线空白：`_________`、`______`
2. 破折号空白：`--------`、`----`
3. 空格空白：`年   月   日`、`地址：        `
4. 括号空白：`（盖章处）`、`（请填写）`、`[填写公司名称]`
5. 表格空白单元格：空单元格或只有占位符的单元格
6. 自然语言暗示：`请在此处填写`、`待补充`、`待定`
7. 关键词附近的空白：`供应商：`、`投标人：`、`日期：` 后面的空白

## 输出要求
返回一个 JSON 数组，每个空白位置包含：
```json
{
  "paraIndex": 段落索引（必须与输入一致）,
  "context": "完整的段落文本",
  "matchText": "匹配到的空白文本（如'_________'、'（盖章处）'）",
  "index": 空白在段落中的字符位置（从0开始）,
  "type": "空白类型（underscore/dash/spaces/brackets/empty_cell/keyword）",
  "confidence": "识别置信度（high/medium/low）"
}
```

## 重要规则
1. **只识别真正的空白**：不要识别页码、页眉页脚等非填写位置
2. **精确计算 index**：使用 `indexOf()` 计算 `matchText` 在 `context` 中的位置
3. **合并相邻空白**：如果多个空白相邻（如 `年____月____日`），识别为多个独立空白
4. **表格处理**：对于表格中的空白，`paraIndex` 使用最近的段落索引
5. **去重**：不要重复识别同一个空白位置

## 示例输入
```json
[
  {
    "paraIndex": 0,
    "text": "投标人名称：_________"
  },
  {
    "paraIndex": 1,
    "text": "日期：____年__月__日"
  },
  {
    "paraIndex": 2,
    "text": "（盖章处）"
  }
]
```

## 示例输出
```json
[
  {
    "paraIndex": 0,
    "context": "投标人名称：_________",
    "matchText": "_________",
    "index": 5,
    "type": "underscore",
    "confidence": "high"
  },
  {
    "paraIndex": 1,
    "context": "日期：____年__月__日",
    "matchText": "____",
    "index": 3,
    "type": "underscore",
    "confidence": "high"
  },
  {
    "paraIndex": 1,
    "context": "日期：____年__月__日",
    "matchText": "__",
    "index": 7,
    "type": "underscore",
    "confidence": "high"
  },
  {
    "paraIndex": 1,
    "context": "日期：____年__月__日",
    "matchText": "__",
    "index": 10,
    "type": "underscore",
    "confidence": "high"
  },
  {
    "paraIndex": 2,
    "context": "（盖章处）",
    "matchText": "（盖章处）",
    "index": 0,
    "type": "brackets",
    "confidence": "high"
  }
]
```

现在开始分析输入的段落，识别所有空白位置。
```

## 模型配置
- **模型**: Qwen3.5 PLUS (推荐，中文理解强)
- **温度**: 0.1 (低温度确保 JSON 格式稳定)
- **最大 Token**: 4000

## 测试数据
用户可以在 Dify 工作流测试界面使用以下测试数据：

```json
{
  "paragraphs": "[{\"paraIndex\":0,\"text\":\"投标人（供应商）名称：___________________________\"},{\"paraIndex\":1,\"text\":\"法定代表人（负责人）：________________________\"},{\"paraIndex\":2,\"text\":\"地址：________________________________________\"},{\"paraIndex\":3,\"text\":\"电话：__________________传真：________________\"},{\"paraIndex\":4,\"text\":\"开户银行：________________账号：______________\"},{\"paraIndex\":5,\"text\":\"投标日期：____年__月__日\"},{\"paraIndex\":6,\"text\":\"（投标人盖章处）\"},{\"paraIndex\":7,\"text\":\"授权代表签字：________________\"}]"
}
```

预期应识别出 10+ 个空白位置。

## 部署说明
1. 在 Dify 创建新工作流
2. 配置输入变量 `paragraphs` (类型: String)
3. 配置输出变量 `text` (类型: String)
4. 使用上面的提示词配置 LLM 节点
5. 保存并发布工作流
6. 获取 API Key 并更新到 `.env.local` 的 `VITE_DIFY_SCAN_BLANK_API_KEY`
```

Now let me test if the code compiles by checking for any syntax errors:

<｜DSML｜function_calls>
<｜DSML｜invoke name="bash">
<｜DSML｜parameter name="command" string="true">cd "C:\Users\Coremail\Desktop\biaoshu\ai-bid-system\frontend" && npm run build