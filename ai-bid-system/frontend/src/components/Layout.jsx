import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';

const pageTitles = {
  '/create-bid': '新建标书',
  '/my-bids': '我的标书',
  '/bid-analysis': '标书解析',
  '/bid-review': '标书审查',
  '/image-library': '图片库',
  '/product-library': '产品库',
  '/knowledge-base': '知识库',
};

const Layout = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const pageTitle = pageTitles[currentPath] || 'AI标书系统';

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      <Sidebar />
      <main className="flex-1 overflow-auto flex flex-col">
        {/* 页面标题栏 */}
        <div className="bg-white border-b border-gray-100 px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {getPageSubtitle(currentPath)}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* 可以添加全局操作按钮 */}
            </div>
          </div>
        </div>
        
        {/* 页面内容 */}
        <div className="flex-1 p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

function getPageSubtitle(path) {
  const subtitles = {
    '/create-bid': '上传招标文件，AI智能生成标书方案',
    '/my-bids': '查看和管理您创建的所有标书',
    '/bid-analysis': '分析标书得分、趋势和建议',
    '/bid-review': '审查标书合规性和质量',
    '/image-library': '管理和使用产品图片资源',
    '/product-library': '管理产品信息、价格和库存',
    '/knowledge-base': '标书相关知识和文档库',
  };
  return subtitles[path] || 'AI标书系统';
}

export default Layout;