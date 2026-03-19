# AI标书系统 - 用户认证模块

## 功能特性

✅ 完整的用户注册/登录系统
✅ 密码重置功能
✅ 用户个人资料管理
✅ 自动创建用户档案（数据库触发器）
✅ 受保护的路由访问控制
✅ 响应式UI设计（Ant Design + Tailwind CSS）

## 技术栈

- **前端框架**: React 18 + Vite
- **UI组件库**: Ant Design 5
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **路由**: React Router DOM 6
- **认证**: Supabase Auth
- **数据库**: Supabase PostgreSQL

## 环境配置

### 1. 环境变量
已创建 `.env.local` 文件，包含本地Supabase配置：
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

### 2. 数据库配置
Supabase数据库已配置以下功能：
- `profiles` 表存储用户档案
- 自动触发器：用户注册时自动创建档案
- 行级安全策略（RLS）：用户只能访问自己的数据

## 页面说明

### 公开页面
1. **登录页面** (`/login`)
   - 邮箱/密码登录
   - 忘记密码链接
   - 注册页面跳转

2. **注册页面** (`/register`)
   - 用户注册（姓名、邮箱、密码）
   - 密码确认验证
   - 注册成功后跳转登录

3. **忘记密码** (`/forgot-password`)
   - 发送密码重置邮件
   - 邮件发送成功提示

### 受保护页面（需要登录）
1. **主应用布局** (`/`)
   - 侧边栏导航
   - 用户信息显示
   - 登出功能

2. **个人资料** (`/profile`)
   - 查看和编辑个人信息
   - 显示账户信息
   - 更新用户名和公司信息

3. **其他功能页面**
   - 新建标书 (`/create-bid`)
   - 我的标书 (`/my-bids`)
   - 标书解析 (`/bid-analysis`)
   - 标书审查 (`/bid-review`)
   - 图片库 (`/image-library`)
   - 知识库 (`/knowledge-base`)

## 认证流程

### 注册流程
1. 用户填写注册表单（姓名、邮箱、密码）
2. 提交后调用 `supabase.auth.signUp()`
3. 数据库触发器自动在 `profiles` 表创建记录
4. 显示成功消息，跳转到登录页面

### 登录流程
1. 用户输入邮箱和密码
2. 调用 `supabase.auth.signInWithPassword()`
3. 验证成功后跳转到主应用
4. 用户信息存储在AuthContext中

### 登出流程
1. 点击侧边栏用户菜单的"退出登录"
2. 调用 `supabase.auth.signOut()`
3. 清除本地会话，跳转到登录页面

## 安全特性

### 1. 路由保护
- 使用 `ProtectedRoute` 组件包装需要认证的路由
- 未登录用户自动重定向到登录页面
- 登录状态通过 `AuthContext` 全局管理

### 2. 数据库安全
- 所有表启用行级安全策略（RLS）
- 用户只能访问自己的数据
- 使用 `auth.uid()` 进行权限验证

### 3. 密码安全
- 密码最小长度6位
- 密码确认验证
- 密码重置邮件功能
- Supabase内置密码哈希和存储

## 开发说明

### 启动应用
```bash
cd frontend
npm install
npm run dev
```

应用将在 http://localhost:5174 启动

### 构建生产版本
```bash
npm run build
npm run preview
```

### 代码结构
```
src/
├── contexts/
│   └── AuthContext.jsx      # 认证上下文和钩子
├── lib/
│   └── supabase.js          # Supabase客户端配置
├── components/
│   ├── Layout.jsx           # 主布局
│   ├── Sidebar.jsx          # 侧边栏（含用户菜单）
│   └── ProtectedRoute.jsx   # 受保护路由组件
├── pages/
│   ├── Login.jsx            # 登录页面
│   ├── Register.jsx         # 注册页面
│   ├── ForgotPassword.jsx   # 忘记密码页面
│   ├── Profile.jsx          # 个人资料页面
│   └── ...其他功能页面
└── App.jsx                  # 路由配置
```

## 测试用户

1. 访问 http://localhost:5174/register 注册新用户
2. 或使用以下测试凭据（如果已创建）：
   - 邮箱: test@example.com
   - 密码: password123

## 故障排除

### 1. 连接Supabase失败
- 确保本地Supabase服务正在运行：`supabase start`
- 检查环境变量配置是否正确
- 验证Supabase URL和Anon Key

### 2. 注册失败
- 检查邮箱格式是否正确
- 确保密码至少6位
- 查看浏览器控制台错误信息

### 3. 登录后无法访问受保护页面
- 检查 `AuthContext` 是否正确初始化
- 验证Supabase会话状态
- 确保路由配置正确

## 后续扩展建议

1. **邮箱验证**：添加邮箱验证流程
2. **社交登录**：集成Google、GitHub等OAuth登录
3. **双因素认证**：增强账户安全性
4. **会话管理**：添加"记住我"功能
5. **权限管理**：添加用户角色和权限系统
6. **审计日志**：记录用户登录和操作日志