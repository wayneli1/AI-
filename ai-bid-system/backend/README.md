# 后端标书解析服务

## 概述

后端服务负责解析 DOCX 标书文件，提供企业级表格识别和空白扫描功能。

## 技术栈

- **FastAPI**: Web 框架
- **python-docx**: DOCX 文件解析
- **Pydantic**: 数据验证

## 目录结构

```
backend/
├── main.py                 # FastAPI 入口
├── requirements.txt       # 依赖
├── Dockerfile             # Docker 部署
├── routes/
│   └── parse_bid.py       # 标书解析 API
├── services/
│   ├── blank_scanner.py   # 空白扫描器（从 JS 迁移）
│   ├── table_parser.py     # 企业级表格解析
│   └── table_classifier.py # 表格分类器
└── schemas/
    └── response.py        # 响应模型
```

## 启动方式

### 方式一：直接运行

```bash
# 安装依赖
pip install -r backend/requirements.txt

# 启动服务
cd backend
python -m uvicorn main:app --reload
```

### 方式二：使用启动脚本

**Windows:**
```bash
start_backend.bat
```

**Linux/Mac:**
```bash
chmod +x start_backend.sh
./start_backend.sh
```

### 方式三：Docker

```bash
docker-compose up -d
```

## API 端点

### POST /api/parse-bid-docx

解析标书文件，返回三桶数据。

**请求:**
- Content-Type: `multipart/form-data`
- Body: `file` - DOCX 文件

**响应:**
```json
{
  "success": true,
  "normalBlanks": [...],
  "dynamicTables": [...],
  "manualTables": [...],
  "tableStructures": [...],
  "meta": {
    "fileName": "招标文件.docx",
    "totalParagraphs": 156,
    "totalTables": 8,
    "totalNormalBlanks": 47
  }
}
```

### GET /health

健康检查。

**响应:**
```json
{
  "status": "ok",
  "service": "bid-parser"
}
```

## 三桶数据模型

### normalBlanks (普通填空)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 空白唯一标识 |
| paraIndex | int | 段落索引 |
| context | string | 完整上下文 |
| markedContext | string | 带靶心标记的上下文 |
| matchText | string | 匹配到的空白符号 |
| type | string | 类型：underscore/dash/keyword_space/brackets |
| confidence | string | 置信度：high/medium |
| fill_role | string | 填写角色：auto/manual |
| source | string | 来源：regex/ai |

### dynamicTables (动态可克隆表格)

| 字段 | 类型 | 说明 |
|------|------|------|
| tableId | int | 表格索引 |
| type | string | 类型：resume_table/experience_table/certificate_table |
| anchorContext | string | 表格上方上下文 |
| headers | string[] | 表头 |
| rowCount | int | 行数 |
| blankCells | BlankCell[] | 空白单元格 |

### manualTables (高危人工表格)

| 字段 | 类型 | 说明 |
|------|------|------|
| tableId | int | 表格索引 |
| type | string | 类型：pricing_table/deviation_table |
| anchorContext | string | 表格上方上下文 |
| headers | string[] | 表头 |

## 表格分类规则

### 动态表格（AI 可处理）

关键词：`简历`、`人员`、`项目经历`、`工作经验`、`资格证书`、`拟投入`、`主要人员` 等

### 高危表格（禁止 AI 触碰）

关键词：`报价`、`价格`、`总价`、`单价`、`费率`、`偏离`、`折扣`、`优惠` 等

## 前端集成

在 `.env.local` 中配置后端地址：

```env
VITE_BACKEND_API_BASE=http://localhost:8000
```

调用方式：

```javascript
import { parseBidDocx } from './utils/backendApi';

const result = await parseBidDocx(file);
const { normalBlanks, dynamicTables, manualTables } = result;
```

## 注意事项

1. 后端仅支持 `.docx` 格式文件
2. 服务默认端口为 `8000`
3. CORS 已开放所有来源（仅用于开发环境）
