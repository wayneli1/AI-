# AI投标系统

一个基于人工智能的投标文档自动生成和分析系统。

## 项目概述

该系统利用AI技术帮助用户快速生成、分析和优化投标文档，提高投标效率和成功率。

## 功能特性

### 核心功能
- **智能投标生成**：基于模板和用户输入自动生成投标文档
- **文档分析**：分析招标文件，提取关键信息和要求
- **空白填充**：智能识别和填充文档中的空白字段
- **知识库管理**：管理公司信息、产品库、图片库等投标资源
- **学习模式**：通过AI学习投标文档的最佳实践

### 技术特性
- **前端**：React + Vite + TailwindCSS + Ant Design
- **后端**：Supabase（数据库和认证）
- **AI集成**：Dify AI工作流集成
- **文档处理**：支持PDF、Word、Excel等多种格式

## 项目结构

```
ai-bid-system/
├── frontend/              # React前端应用
│   ├── src/
│   │   ├── components/    # 可复用组件
│   │   ├── pages/        # 页面组件
│   │   ├── utils/        # 工具函数
│   │   ├── lib/          # 第三方库封装
│   │   └── contexts/     # React上下文
│   ├── package.json
│   └── vite.config.js
├── supabase/             # Supabase配置和迁移文件
│   ├── migrations/       # 数据库迁移脚本
│   └── config.toml       # Supabase配置
├── merge_server.py       # Python后端服务器
├── start.sh              # Linux启动脚本
├── start.bat             # Windows启动脚本
└── README.md             # 项目说明
```

## 快速开始

### 环境要求
- Node.js 18+
- Python 3.8+
- Supabase账号

### 安装步骤

1. **克隆项目**
   ```bash
   git clone https://github.com/wayneli1/AI-.git
   cd ai-bid-system
   ```

2. **前端安装**
   ```bash
   cd frontend
   npm install
   ```

3. **配置环境变量**
   复制`.env.example`为`.env.local`并填写你的配置：
   ```bash
   cp .env.example .env.local
   ```
   编辑`.env.local`文件，设置以下变量：
   ```
   VITE_SUPABASE_URL=你的Supabase项目URL
   VITE_SUPABASE_ANON_KEY=你的Supabase匿名密钥
   VITE_DIFY_API_KEY=你的Dify API密钥
   VITE_DIFY_WORKFLOW_ID=你的Dify工作流ID
   ```

4. **启动前端**
   ```bash
   npm run dev
   ```

5. **启动后端服务器**
   ```bash
   python merge_server.py
   ```

6. **访问应用**
   打开浏览器访问：http://localhost:5173

## 数据库设置

1. 在Supabase控制台创建新项目
2. 运行数据库迁移脚本：
   ```bash
   cd supabase
   supabase db reset
   ```

## 配置说明

### Supabase配置
- 创建`profiles`表存储用户信息
- 创建`bids`表存储投标记录
- 创建`company_profiles`表存储公司信息
- 配置行级安全策略

### Dify AI配置
- 在Dify平台创建工作流
- 配置API密钥和工作流ID
- 设置适当的提示词和参数

## 使用指南

### 1. 用户注册和登录
- 使用邮箱注册新账户
- 登录后进入仪表板

### 2. 创建投标
- 上传招标文件
- 系统自动分析文档
- 填写必要信息
- 生成投标文档

### 3. 管理资源
- **公司资料**：维护公司基本信息
- **产品库**：管理产品和服务信息
- **图片库**：存储投标相关图片
- **知识库**：积累投标经验和模板

### 4. 学习模式
- 上传历史投标文档
- AI分析成功案例
- 学习最佳实践

## 开发指南

### 代码规范
- 使用ESLint进行代码检查
- 遵循React最佳实践
- 使用函数组件和Hooks

### 添加新功能
1. 在`src/pages/`创建新页面组件
2. 在`src/utils/`添加工具函数
3. 更新路由配置
4. 添加相应的数据库表

### 测试
```bash
cd frontend
npm run lint    # 代码检查
```

## 部署

### 前端部署
```bash
cd frontend
npm run build
```
将`dist/`目录部署到静态托管服务（如Vercel、Netlify等）

### 后端部署
- 将`merge_server.py`部署到Python服务器
- 配置环境变量
- 使用PM2或systemd管理进程

## 注意事项

1. **敏感信息**：`.env.local`文件包含敏感信息，不要提交到版本控制
2. **API限制**：注意Dify API的调用频率限制
3. **文件大小**：上传文件大小限制为10MB
4. **浏览器兼容**：建议使用Chrome或Edge最新版本

## 故障排除

### 常见问题
1. **无法连接Supabase**：检查环境变量配置
2. **AI分析失败**：检查Dify API密钥和工作流配置
3. **文件上传失败**：检查文件格式和大小限制

### 日志查看
- 前端：浏览器开发者工具控制台
- 后端：Python服务器控制台输出

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 创建Pull Request

## 许可证

本项目采用MIT许可证。详见LICENSE文件。

## 联系方式

如有问题或建议，请通过GitHub Issues提交。