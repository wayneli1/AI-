import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FilePlus, FileText, Compass, ShieldCheck, 
  Image, BookOpen, LogOut, User
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Dropdown, message } from 'antd';

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const mainNav = [
    { name: '新建标书', icon: <FilePlus size={18} />, path: '/create-bid' },
    { name: '我的标书', icon: <FileText size={18} />, path: '/my-bids' },
    { name: '招标解读', icon: <Compass size={18} />, path: '/bid-analysis' },
    { name: '标书审查', icon: <ShieldCheck size={18} />, path: '/bid-review' },
  ];

  const libraryNav = [
    { name: '图片库', icon: <Image size={18} />, path: '/image-library' },
    { name: '知识库', icon: <BookOpen size={18} />, path: '/knowledge-base' },
  ];

  const isActive = (path) => {
    return location.pathname === path;
  };

  const handleNavClick = (path) => {
    navigate(path);
  };

  const handleSignOut = async () => {
    try {
      const { error } = await signOut();
      if (error) throw error;
      message.success('已成功退出登录');
      navigate('/login');
    } catch (error) {
      message.error('退出登录失败');
    }
  };

  const userMenuItems = [
    {
      key: 'profile',
      label: '个人资料',
      icon: <User size={16} />,
      onClick: () => navigate('/profile'),
    },
    {
      key: 'divider',
      type: 'divider',
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogOut size={16} />,
      danger: true,
      onClick: handleSignOut,
    },
  ];

  const getUserInitial = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.charAt(0).toUpperCase();
    }
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  const getUserName = () => {
    return user?.user_metadata?.full_name || user?.email?.split('@')[0] || '用户';
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
        <Dropdown
          menu={{ items: userMenuItems }}
          placement="topRight"
          trigger={['click']}
        >
          <div className="flex items-center cursor-pointer hover:bg-gray-50 p-2 rounded-md transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-medium">
              {getUserInitial()}
            </div>
            <div className="ml-3 flex-1">
              <div className="text-sm font-medium text-gray-700">{getUserName()}</div>
              <div className="text-xs text-gray-400">{user?.email}</div>
            </div>
          </div>
        </Dropdown>
      </div>
    </aside>
  );
};

export default Sidebar;