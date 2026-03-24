import React, { useState, useEffect, useCallback } from 'react';
import { Search, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { message, Modal, Dropdown, Button, Tag, Input } from 'antd';
import { useNavigate } from 'react-router-dom';

const MyBids = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // all, completed, uncompleted
  const [searchText, setSearchText] = useState('');
  
  // 删除相关状态
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

  // 获取标书项目列表
  const fetchProjects = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bidding_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      console.error('获取标书项目失败:', error);
      message.error('获取标书项目失败');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // 初始化与轮询（针对处理中的项目）
  useEffect(() => {
    fetchProjects();
    const interval = setInterval(() => {
      setProjects(current => {
        if (current.some(p => p.status === 'processing')) {
          fetchProjects(); // 如果有正在处理的，每10秒刷一次
        }
        return current;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  // 删除逻辑
  const handleDeleteProject = async () => {
    if (!projectToDelete || !user) return;
    try {
      const { error } = await supabase
        .from('bidding_projects')
        .delete()
        .eq('id', projectToDelete.id)
        .eq('user_id', user.id);

      if (error) throw error;
      message.success('标书已删除');
      fetchProjects();
    } catch (error) {
      console.error('删除标书失败:', error);
      message.error('删除失败，请重试');
    } finally {
      setIsDeleteModalVisible(false);
      setProjectToDelete(null);
    }
  };

  // 过滤逻辑
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.project_name.toLowerCase().includes(searchText.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'completed') return project.status === 'completed';
    if (activeTab === 'uncompleted') return project.status !== 'completed';
    return true;
  });

  // 获取状态标签 UI
  const getStatusTags = (status) => {
    if (status === 'completed') {
      return (
        <>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 mr-2 border border-indigo-100">大纲已生成</span>
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">完整方案</span>
        </>
      );
    } else if (status === 'processing') {
      return <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-600 border border-purple-100">正文部分预览中...</span>;
    } else {
      return <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600 border border-red-100">解析失败</span>;
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      {/* 顶部工具栏 (完美对标图2) */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-6">
          <Button 
            type="primary" 
            className="bg-[#7C3AED] hover:bg-[#6D28D9] border-0 rounded-full px-6 h-9 shadow-sm"
            onClick={() => navigate('/bid-analysis')}
          >
            新建标书
          </Button>
          
          <div className="flex space-x-6 text-sm">
            <span 
              onClick={() => setActiveTab('all')}
              className={`cursor-pointer pb-1 transition-colors ${activeTab === 'all' ? 'text-gray-900 font-bold border-b-2 border-[#7C3AED]' : 'text-gray-500 hover:text-gray-900'}`}
            >
              全部标书
            </span>
            <span 
              onClick={() => setActiveTab('completed')}
              className={`cursor-pointer pb-1 transition-colors ${activeTab === 'completed' ? 'text-gray-900 font-bold border-b-2 border-[#7C3AED]' : 'text-gray-500 hover:text-gray-900'}`}
            >
              已完成
            </span>
            <span 
              onClick={() => setActiveTab('uncompleted')}
              className={`cursor-pointer pb-1 transition-colors ${activeTab === 'uncompleted' ? 'text-gray-900 font-bold border-b-2 border-[#7C3AED]' : 'text-gray-500 hover:text-gray-900'}`}
            >
              未完成
            </span>
          </div>
        </div>

        <div className="relative w-72">
          <Input
            placeholder="请输入方案名称"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="rounded-full bg-gray-50 border-gray-200 hover:border-purple-300 focus:border-purple-500 h-9 pr-10"
          />
          <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
        </div>
      </div>

      {/* 极简列表渲染 */}
      <div className="space-y-0">
        {loading ? (
          <div className="text-center py-20 text-gray-500">正在加载您的标书资产...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20 text-gray-400">暂无符合条件的标书数据</div>
        ) : (
          filteredProjects.map((project) => (
            <div key={project.id} className="flex items-center justify-between py-5 border-b border-gray-50 hover:bg-gray-50/50 transition-colors px-4 group">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <h3 className="text-base font-medium text-gray-900 mr-4 cursor-pointer hover:text-purple-600 transition-colors"
                      onClick={() => project.status === 'completed' && navigate(`/bid-analysis/${project.id}`)}>
                    {project.project_name}
                  </h3>
                  {getStatusTags(project.status)}
                </div>
                <div className="flex items-center text-xs text-gray-400 space-x-6">
                  <span>创建时间：{new Date(project.created_at).toLocaleString('zh-CN')}</span>
                  <span>创建人：{user?.phone || user?.email || '系统用户'}</span>
                </div>
              </div>
              
              {/* 右侧操作菜单 */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'view',
                        label: '查看报告',
                        disabled: project.status !== 'completed',
                        onClick: () => navigate(`/bid-analysis/${project.id}`)
                      },
                      {
                        key: 'delete',
                        label: <span className="text-red-500">删除标书</span>,
                        onClick: () => {
                          setProjectToDelete(project);
                          setIsDeleteModalVisible(true);
                        }
                      }
                    ]
                  }}
                  trigger={['click']}
                  placement="bottomRight"
                >
                  <Button type="text" icon={<MoreHorizontal size={20} className="text-gray-400" />} />
                </Dropdown>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 删除确认弹窗 */}
      <Modal
        title="删除标书"
        open={isDeleteModalVisible}
        onOk={handleDeleteProject}
        onCancel={() => {
          setIsDeleteModalVisible(false);
          setProjectToDelete(null);
        }}
        okText="确认删除"
        cancelText="取消"
        okButtonProps={{ danger: true }}
      >
        <p className="py-4 text-gray-600">确定要永久删除标书 <strong>{projectToDelete?.project_name}</strong> 吗？此操作不可恢复。</p>
      </Modal>
    </div>
  );
};

export default MyBids;