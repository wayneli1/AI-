import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Button } from 'antd';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Sidebar from './Sidebar';
import ScreenSizeWarning from './ScreenSizeWarning';

const pageTitles = {
  '/create-bid': '新建标书',
  '/my-bids': '我的标书',
  '/bid-analysis': '标书解析',
  '/bid-review': '标书审查',
  '/image-library': '图片库',
  '/product-library': '产品库',
  '/knowledge-base': '知识库',
  '/company-profiles': '投标主体库',
  '/personnel-library': '人员专家库',
  '/learn-bid': '历史标书整理',
};

const Layout = () => {
  const location = useLocation();
  const currentPath = location.pathname;
  const pageTitle = pageTitles[currentPath] || 'AI标书系统';
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem('layout-sidebar-collapsed');
    if (saved !== null) {
      setSidebarCollapsed(saved === 'true');
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('layout-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      <Sidebar collapsed={sidebarCollapsed} />
      <main className="flex-1 overflow-auto flex flex-col">
        {/* 屏幕适配提示 */}
        <ScreenSizeWarning />
        {/* 页面标题栏 */}
        <div className="bg-white border-b border-gray-100 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
              <p className="text-sm text-gray-500 mt-1">
                {getPageSubtitle(currentPath)}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                type="text"
                icon={sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                className="text-gray-600 font-medium"
              >
                {sidebarCollapsed ? '展开导航' : '收起导航'}
              </Button>
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
    '/company-profiles': '管理多个投标公司主体，AI填报时自动注入',
    '/personnel-library': '管理项目人员档案，支持动态表格自动填入',
    '/learn-bid': '从历史标书中整理可长期复用的固定字段、正文内容和附件',
  };
  return subtitles[path] || 'AI标书系统';
}

export default Layout;
