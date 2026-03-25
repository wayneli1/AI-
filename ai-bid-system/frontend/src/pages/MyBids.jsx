import React, { useState, useEffect, useCallback } from 'react';
import { Search, MoreHorizontal } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { message, Modal, Dropdown, Button, Input } from 'antd';
import { useNavigate } from 'react-router-dom';

const MyBids = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); 
  const [searchText, setSearchText] = useState('');
  
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);

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
      console.error('获取项目失败:', error);
      message.error('获取项目失败');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
    const interval = setInterval(() => {
      setProjects(current => {
        if (current.some(p => p.status === 'processing')) {
          fetchProjects(); 
        }
        return current;
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchProjects]);

  const handleDeleteProject = async () => {
    if (!projectToDelete || !user) return;
    try {
      if (projectToDelete.file_url) {
        const urlParts = projectToDelete.file_url.split('documents/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage.from('documents').remove([filePath]);
        }
      }
      const { error } = await supabase
        .from('bidding_projects')
        .delete()
        .eq('id', projectToDelete.id)
        .eq('user_id', user.id);

      if (error) throw error;
      message.success('已永久删除');
      fetchProjects();
    } catch (error) {
      message.error('删除失败，请重试');
    } finally {
      setIsDeleteModalVisible(false);
      setProjectToDelete(null);
    }
  };

  // 🧠 智能路由分拣器：判断该去哪个页面 (💡 修复：去掉了状态判断，随时可进)
  const handleProjectClick = (project) => {
    try {
      if (project.framework_content) {
        const parsed = JSON.parse(project.framework_content);
        if (Array.isArray(parsed)) {
          navigate(`/create-bid?id=${project.id}`);
          return;
        }
      }
    } catch (e) {
      // 解析报错说明是旧版 Markdown 纯文本解读报告
    }
    // 默认跳去解读报告页
    navigate(`/bid-analysis/${project.id}`);
  };

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.project_name?.toLowerCase().includes(searchText.toLowerCase());
    if (!matchesSearch) return false;
    if (activeTab === 'completed') return project.status === 'completed';
    if (activeTab === 'uncompleted') return project.status !== 'completed';
    return true;
  });

  const getStatusTags = (project) => {
    let isNewGenerationFlow = false;
    
    try {
      if (project.framework_content) {
        const parsed = JSON.parse(project.framework_content);
        if (Array.isArray(parsed)) {
          isNewGenerationFlow = true; 
        }
      }
    } catch (e) {
      isNewGenerationFlow = false; 
    }

    if (isNewGenerationFlow) {
      if (project.status === 'completed') {
        return (
          <>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-600 mr-2 border border-purple-100">大纲已确认</span>
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-600 border border-blue-100">完整方案</span>
          </>
        );
      } else {
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">大纲已生成 / 待生成正文</span>;
      }
    } else {
      if (project.status === 'completed') {
        return (
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-500 border border-blue-100">招标文件解读报告</span>
        );
      } else {
        return <span className="px-3 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-500 border border-orange-100">文件解读中...</span>;
      }
    }
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-6">
          <Button 
            type="primary" 
            className="bg-[#7C3AED] hover:bg-[#6D28D9] border-0 rounded-full px-6 h-9 shadow-sm"
            onClick={() => navigate('/create-bid')}
          >
            新建标书
          </Button>
          
          <div className="flex space-x-6 text-sm">
            <span onClick={() => setActiveTab('all')} className={`cursor-pointer pb-1 transition-colors ${activeTab === 'all' ? 'text-gray-900 font-bold border-b-2 border-[#7C3AED]' : 'text-gray-500 hover:text-gray-900'}`}>全部记录</span>
            <span onClick={() => setActiveTab('completed')} className={`cursor-pointer pb-1 transition-colors ${activeTab === 'completed' ? 'text-gray-900 font-bold border-b-2 border-[#7C3AED]' : 'text-gray-500 hover:text-gray-900'}`}>已完成</span>
            <span onClick={() => setActiveTab('uncompleted')} className={`cursor-pointer pb-1 transition-colors ${activeTab === 'uncompleted' ? 'text-gray-900 font-bold border-b-2 border-[#7C3AED]' : 'text-gray-500 hover:text-gray-900'}`}>未完成</span>
          </div>
        </div>

        <div className="relative w-72">
          <Input placeholder="请输入方案或报告名称" value={searchText} onChange={(e) => setSearchText(e.target.value)} className="rounded-full bg-gray-50 border-gray-200 hover:border-purple-300 focus:border-purple-500 h-9 pr-10" />
          <Search size={16} className="absolute right-3 top-2.5 text-gray-400" />
        </div>
      </div>

      <div className="space-y-0">
        {loading ? (
          <div className="text-center py-20 text-gray-500">正在加载您的资产...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20 text-gray-400">暂无符合条件的数据</div>
        ) : (
          filteredProjects.map((project) => (
            <div key={project.id} className="flex items-center justify-between py-5 border-b border-gray-50 hover:bg-gray-50/50 transition-colors px-4 group">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <h3 className="text-base font-medium text-gray-900 mr-4 cursor-pointer hover:text-purple-600 transition-colors"
                      onClick={() => handleProjectClick(project)}>
                    {project.project_name || '未命名项目'}
                  </h3>
                  {getStatusTags(project)}
                </div>
                <div className="flex items-center text-xs text-gray-400 space-x-6">
                  <span>创建时间：{new Date(project.created_at).toLocaleString('zh-CN')}</span>
                  <span>创建人：{user?.phone || user?.email || '系统用户'}</span>
                  {project.file_url && (
                    <a href={project.file_url} target="_blank" rel="noreferrer" className="text-purple-500 hover:underline">查看原始招标文件</a>
                  )}
                </div>
              </div>
              
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Dropdown
                  menu={{
                    items: [
                      {
                        key: 'view',
                        label: '查看并编辑',
                        // 💡 修复：去掉了 disabled 限制
                        onClick: () => handleProjectClick(project)
                      },
                      {
                        key: 'delete',
                        label: <span className="text-red-500">永久删除</span>,
                        onClick: () => { setProjectToDelete(project); setIsDeleteModalVisible(true); }
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

      <Modal title="永久删除确认" open={isDeleteModalVisible} onOk={handleDeleteProject} onCancel={() => { setIsDeleteModalVisible(false); setProjectToDelete(null); }} okText="确认删除" cancelText="取消" okButtonProps={{ danger: true }}>
        <p className="py-4 text-gray-600">确定要永久删除 <strong>{projectToDelete?.project_name}</strong> 吗？<br/><span className="text-xs text-red-500">此操作将清空AI生成的全部内容及源文件。</span></p>
      </Modal>
    </div>
  );
};

export default MyBids;