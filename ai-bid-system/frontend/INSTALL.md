# 前端安装说明

## 环境要求
- Node.js 18.0.0 或更高版本
- npm 10.0.0 或更高版本

## 安装步骤

1. 进入前端目录：
   ```bash
   cd ai-bid-system/frontend
   ```

2. 安装依赖包（包括Tailwind CSS）：
   ```bash
   npm install
   ```

3. 启动开发服务器：
   ```bash
   npm run dev
   ```

4. 在浏览器中打开：http://localhost:5173

### 如果样式未生效
确保Tailwind CSS已正确配置。如果页面样式异常，尝试：
1. 检查终端是否有安装错误
2. 确认 `tailwind.config.js` 和 `postcss.config.js` 文件存在
3. 重启开发服务器

## 项目结构

```
frontend/
├── src/
│   ├── components/     # 公共组件
│   │   ├── Layout.jsx
│   │   └── Sidebar.jsx
│   ├── pages/          # 页面组件
│   │   ├── CreateBid.jsx
│   │   ├── MyBids.jsx
│   │   ├── BidAnalysis.jsx
│   │   ├── ImageLibrary.jsx
│   │   ├── ProductLibrary.jsx
│   │   └── KnowledgeBase.jsx
│   ├── App.jsx         # 主应用组件
│   ├── main.jsx        # 入口文件
│   └── index.css       # 全局样式
├── public/             # 静态资源
├── index.html          # HTML模板
├── vite.config.js      # Vite配置
└── package.json        # 项目依赖
```

## 功能模块

1. **新建标书** - AI智能生成标书方案，上传招标文件
2. **我的标书** - 查看和管理所有标书，支持筛选和操作
3. **标书解析** - 分析标书得分、趋势、要求符合情况
4. **图片库** - 管理资质证书、产品图片等资源
5. **产品库** - 管理产品信息、价格、库存和状态
6. **知识库** - 标书相关知识和文档库，支持搜索和分类

## 使用的技术栈

- React 18
- Tailwind CSS (样式框架)
- Lucide React (图标库)
- Vite (构建工具)
- React Router (路由)