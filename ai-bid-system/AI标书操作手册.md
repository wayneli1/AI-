# AI投标系统 - AI标书操作手册

## 目录

1. [项目技术架构](#1-项目技术架构)
2. [前端启动](#2-前端启动)
3. [后端启动](#3-后端启动)
4. [Dify AI 工作流后台](#4-dify-ai-工作流后台)
5. [Supabase 数据库管理](#5-supabase-数据库管理)
6. [常用服务地址](#6-常用服务地址)

---

## 1. 项目技术架构

本系统包含以下核心组件：

| 组件 | 技术 | 说明 |
|------|------|------|
| 前端 | React + Vite | 用户界面，端口 5173 |
| 后端 | Python FastAPI | 标书解析服务，端口 8000 |
| 数据库 | Supabase (PostgreSQL) | 数据存储 |
| AI 服务 | Dify | 智能分析和填充 |

---

## 2. 前端启动

### 步骤

1. **打开 VSCode**
   - 使用 VSCode 打开项目根目录 `ai-bid-system`

2. **进入前端目录**
   - 在 VSCode 左侧资源管理器中，展开项目目录
   - 进入 `frontend` 文件夹

3. **打开终端**
   - 菜单栏：`终端` → `新建终端`（或快捷键 `` Ctrl+` ``）
   - 确保终端路径显示为 `...\ai-bid-system\frontend>`


4. **启动开发服务器**
   ```bash
   终端输入: npm run dev
   ```

5. **访问系统**
   - 打开浏览器访问：http://localhost:5173
   - 使用账号wayneli12345@gmail.com  密码：qwe123123

### 验证前端启动成功

终端显示类似以下内容：
```
VITE v5.1.4  ready in 123 ms

➜  Local:   http://localhost:5173/
```

---

退出请按ctrl+c



## 3. 后端启动

### 步骤

1. **打开 VSCode**
   - 使用 VSCode 打开项目根目录 `ai-bid-system`

2. **进入后端目录**
   - 在 VSCode 左侧资源管理器中，展开项目目录
   - 进入 `backend` 文件夹

3. **打开终端**
   - 菜单栏：`终端` → `新建终端`（或快捷键 `` Ctrl+` ``）
   - 确保终端路径显示为 `...\ai-bid-system\backend>`


4. **启动后端服务**
   ```
   终端输入:  python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```

### 验证后端启动成功

终端显示类似以下内容：
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

退出请按ctrl+c


### 后端 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/api/parse-bid-docx` | POST | 解析 DOCX 标书文件 |

---

## 4. Dify AI 工作流后台

Dify 是本系统的 AI 大脑，负责招标文件分析、空白填充等智能功能。

### 登录 Dify 后台

1. **访问 Dify**
   - 浏览器访问：`http://192.168.169.107`（项目配置的 Dify 地址）

2. **登录账号**
   - 使用管理员账号登录 
   - 账号352406739@qq.com 密码qwe123123

3. **进入工作流管理**
   - 登录后进入主界面
   - 点击左侧菜单 `工作室` → ` workflows` 查看所有工作流

### 主要工作流说明

| 工作流名称 | API Key | 功能 |
|-----------|---------|------|
| 招标解析 | `app-SsnDAJZJBp6q3I67dv37eTiP` | 深度解析招标文件，生成结构化报告 |
| 知识库检索 | `dataset-NEKrlruW8PKkhcp7RGlPR7de` | 从知识库检索相关信息 |
| 生成标书 | `app-sLqr6WkUVlH8a4FK2aGiIAVa` | AI 生成投标文档 |
| 标书大纲 | `app-yexLG1xGwhrTXxwewEpxV53w` | 生成投标文档大纲 |
| 清洗标书 | `app-sa6HgcdwoRRW8bCJJ5e2vwSM` | 清洗和整理标书内容 |
| 导入模板 | `app-8lyzVvMTFfiHRf8hDvHd0wr0` | 导入投标模板 |
| 内容抽取 | `app-L52Al7joOcZ2QRStVkWhxrZl` | 抽取文档关键内容 |
| 空白填充 | `app-Rd62AVk01hOTQzA1AzpedvjG` | 智能填充文档空白 |
| 模板学习 | `app-tum5glVX7TCEHAnDxNL2qDQQ` | 从历史标书学习 |
| 智能审核 | `app-B3PclucqCDCSWl5t3TwbPAu6` | 审核投标文档 |

### 配置 Dify 工作流

1. **编辑工作流**
   - 进入特定工作流页面
   - 点击 `编辑` 进入可视化编辑器

2. **查看/修改 API 密钥**
   - 点击工作流右上角 `API` 按钮
   - 查看 `API 密钥`

3. **测试工作流**
   - 在 Dify 界面中可直接测试
   - 查看运行日志和输出结果



## 5. Supabase 数据库管理

Supabase 是本系统的数据库和认证服务提供商。

### 访问 Supabase 管理后台

1. **方法一：通过项目地址访问**
   - 浏览器访问：`https://192.168.169.107` （项目配置的 Supabase 地址）
   - 使用 Supabase 账号登录

### Supabase 后台主要功能

#### 5.1 表管理（Database）

1. **进入表编辑器**
   - 左侧菜单：`Table Editor`

2. **查看现有表**
   - `profiles` - 用户信息
   - `bidding_projects` - 标书项目
   - `company_profiles` - 公司信息
   - `products` - 产品信息
   - `product_assets` - 产品资产
   - `images` - 图片资源
   - `template_slots` - 模板字段

3. **增删改查操作**
   - 点击表名进入数据编辑界面
   - 可以直接添加、修改、删除记录

#### 5.2 用户管理（Authentication）

1. **进入用户管理**
   - 左侧菜单：`Authentication` → `Users`

2. **查看用户列表**
   - 显示所有注册用户
   - 查看用户创建时间、最后登录等

3. **管理用户**
   - 点击用户行查看详情
   - 可以手动创建用户、禁用账户等

#### 5.3 存储管理（Storage）

1. **进入存储管理**
   - 左侧菜单：`Storage`

2. **管理文件桶**
   - 默认桶：`avatars`、`bid-documents`、`product-images` 等
   - 可以创建新桶、设置权限

3. **上传文件**
   - 进入对应桶
   - 点击 `Upload` 上传文件

#### 5.4 API 文档（API Docs）

1. **进入 API 文档**
   - 左侧菜单：`API Docs`

2. **查看自动生成 API**
   - Supabase 自动为每个表生成 REST API
   - 可以直接在这里测试 API

3. **获取 API 密钥**
   - 项目设置 → `API`
   - 查看 `Project URL` 和 `anon/public` 密钥

### Supabase 环境变量

前端配置在 `frontend/.env.local`：

| 变量名 | 说明 |
|--------|------|
| `VITE_SUPABASE_URL` | Supabase 项目地址 |
| `VITE_SUPABASE_ANON_KEY` | 匿名访问密钥 |

后端配置在 `backend/.env`：

| 变量名 | 说明 |
|--------|------|
| `DIFY_BASE_URL` | Dify 服务地址 |
| `DIFY_FIELD_MAPPING_API_KEY` | 字段映射 API Key |
| `ENABLE_INTELLIGENT_MAPPING` | 是否启用智能映射 |

---

## 6. 常用服务地址

| 服务 | 地址 | 说明 |
|------|------|------|
| 前端应用 | http://localhost:5173 | React 开发服务器 |
| 后端 API | http://localhost:8000 | FastAPI 服务 |
| Supabase Studio | http://127.0.0.1:54323 | 本地数据库管理 |
| Supabase API | http://192.168.169.107:54321 | Supabase 服务 |
| Dify 后台 | http://192.168.169.107 | Dify 工作流管理 |
---

## 快速启动脚本（Windows）

项目根目录下的 `start.bat` 可以一键启动所有服务：

```bash
# 在项目根目录运行
start.bat
```

脚本会自动：
1. 启动 Supabase 服务
2. 等待服务就绪
3. 打开前端开发服务器

---

## 故障排查

### 前端无法访问

1. 确认前端服务已启动（终端显示 `Local: http://localhost:5173/`）
2. 清除浏览器缓存
3. 检查 `.env.local` 配置是否正确

### 后端无法访问

1. 确认后端服务已启动（终端显示 `Uvicorn running on http://0.0.0.0:8000`）
2. 检查端口 8000 是否被占用
3. 查看后端终端的错误日志

### Dify 调用失败

1. 确认 Dify 服务可访问（浏览器打开 `http://192.168.169.107`）
2. 检查 `.env.local` 中的 Dify API Key 是否正确
3. 在 Dify 后台测试工作流是否正常运行

### 数据库连接失败

1. 确认 Supabase 服务可访问
2. 检查 `.env.local` 中的 Supabase URL 和 Key
3. 如果本地开发，确认 Supabase 已启动

---

## 联系方式

如有问题，请联系系统开发人员或提交 Issue。
