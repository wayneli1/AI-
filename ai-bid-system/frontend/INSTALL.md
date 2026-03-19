# 前端安装说明

## 环境要求
- Node.js 18.0.0 或更高版本
- npm 10.0.0 或更高版本
- Supabase CLI (用于本地开发)
- Docker Desktop (用于运行Supabase)

## 完整安装步骤

### 1. 启动Supabase本地服务
```bash
cd ai-bid-system
supabase start
```

### 2. 启动前端应用
```bash
cd frontend
npm install
npm run dev
```

### 3. 访问应用
- 前端应用: http://localhost:5174
- Supabase Studio: http://127.0.0.1:54323 (数据库管理)
- Mailpit: http://127.0.0.1:54324 (查看验证邮件)

### 如果样式未生效
确保Tailwind CSS已正确配置。如果页面样式异常，尝试：
1. 检查终端是否有安装错误
2. 确认 `tailwind.config.js` 和 `postcss.config.js` 文件存在
3. 重启开发服务器

### 认证功能测试
1. 访问 http://localhost:5174/register 注册新用户
2. 检查 Mailpit (http://127.0.0.1:54324) 查看验证邮件
3. 登录后访问个人资料页面管理信息

## 项目结构

```
frontend/
├── src/
│   ├── contexts/       # 上下文和状态管理
│   │   └── AuthContext.jsx
│   ├── lib/            # 工具库和配置
│   │   └── supabase.js
│   ├── components/     # 公共组件
│   │   ├── Layout.jsx
│   │   ├── Sidebar.jsx
│   │   └── ProtectedRoute.jsx
│   ├── pages/          # 页面组件
│   │   ├── Login.jsx
│   │   ├── Register.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── Profile.jsx
│   │   ├── CreateBid.jsx
│   │   ├── MyBids.jsx
│   │   ├── BidAnalysis.jsx
│   │   ├── BidReview.jsx
│   │   ├── ImageLibrary.jsx
│   │   └── KnowledgeBase.jsx
│   ├── App.jsx         # 主应用组件
│   ├── main.jsx        # 入口文件
│   └── index.css       # 全局样式
├── public/             # 静态资源
├── .env.local          # 环境变量配置
├── index.html          # HTML模板
├── vite.config.js      # Vite配置
└── package.json        # 项目依赖
```

## 功能模块

### 认证模块
1. **用户注册** - 邮箱/密码注册，自动创建用户档案
2. **用户登录** - 安全的登录系统，会话管理
3. **密码重置** - 通过邮件重置密码
4. **个人资料** - 查看和编辑用户信息

### 核心功能
1. **新建标书** - AI智能生成标书方案，上传招标文件
2. **我的标书** - 查看和管理所有标书，支持筛选和操作
3. **标书解析** - 分析标书得分、趋势、要求符合情况
4. **标书审查** - 审查标书合规性和质量
5. **图片库** - 管理资质证书、产品图片等资源
6. **知识库** - 标书相关知识和文档库，支持搜索和分类

## 使用的技术栈

### 前端框架
- React 18
- Vite (构建工具)
- React Router (路由)

### UI和样式
- Ant Design 5 (UI组件库)
- Tailwind CSS (样式框架)
- Lucide React (图标库)

### 后端和数据库
- Supabase Auth (用户认证)
- Supabase PostgreSQL (数据库)
- Supabase Realtime (实时功能)

### 开发工具
- ESLint (代码检查)
- PostCSS (CSS处理)
- Autoprefixer (浏览器前缀)