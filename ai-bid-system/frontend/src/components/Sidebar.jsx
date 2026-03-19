import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FilePlus, FileText, Compass, ShieldCheck, 
  Image, Package, BookOpen 
} from 'lucide-react';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const mainNav = [
    { name: '新建标书', icon: <FilePlus size={18} />, path: '/create-bid' },
    { name: '我的标书', icon: <FileText size={18} />, path: '/my-bids' },
    { name: '招文解读', icon: <Compass size={18} />, path: '/bid-analysis' },
    { name: '标书审查', icon: <ShieldCheck size={18} />, path: '/bid-review' },
  ];

  const libraryNav = [
    { name: '图片库', icon: <Image size={18} />, path: '/image-library' },
    { name: '产品库', icon: <Package size={18} />, path: '/product-library' },
    { name: '知识库', icon: <BookOpen size={18} />, path: '/knowledge-base' },
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  const handleNavClick = (path) => {
    navigate(path);
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-100 flex flex-col h-full">
      {/* Logo 区域 */}
      <div className="h-20 flex items-center px-6">
        <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-indigo-500 rounded-lg flex items-center justify-center text-white mr-3 shadow-md shadow-purple-100">
          <span className="font-bold text-lg">X</span>
        </div>
        <span className="font-bold text-lg tracking-tight">标书AI</span>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 px-4 py-4 space-y-6 overflow-y-auto">
        <div className="space-y-1">
          {mainNav.map((item) => (
            <div
              key={item.name}
              onClick={() => handleNavClick(item.path)}
              className={`flex items-center px-4 py-2.5 rounded-md cursor-pointer text-sm transition-all relative ${
                isActive(item.path)
                  ? 'bg-purple-50 text-purple-600 font-medium' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              {isActive(item.path) && (
                <div className="absolute left-0 w-1 h-5 bg-purple-600 rounded-r-full" />
              )}
              <span className="mr-3">{item.icon}</span>
              {item.name}
            </div>
          ))}
        </div>

        <div className="pt-4 border-t border-gray-50 space-y-1">
          <div className="px-4 pb-2">
            <span className="text-xs text-gray-400 font-medium tracking-wider uppercase">资源库</span>
          </div>
          {libraryNav.map((item) => (
            <div
              key={item.name}
              onClick={() => handleNavClick(item.path)}
              className={`flex items-center px-4 py-2.5 rounded-md cursor-pointer text-sm transition-all ${
                isActive(item.path)
                  ? 'bg-purple-50 text-purple-600 font-medium' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              {item.name}
            </div>
          ))}
        </div>
      </nav>

      {/* 底部用户信息 */}
      <div className="p-4 border-t border-gray-50">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium">
            U
          </div>
          <div className="ml-3">
            <div className="text-sm font-medium text-gray-700">用户名称</div>
            <div className="text-xs text-gray-400">管理员</div>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;