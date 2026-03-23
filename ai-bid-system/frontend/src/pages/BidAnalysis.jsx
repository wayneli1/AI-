import { useState, useEffect, useCallback } from 'react';
import { 
  FileText, Upload, CheckCircle, Clock, AlertCircle, 
  Eye, Download, Trash2, Search, Filter, Plus,
  File, FileType, X, Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { runDifyAnalysis, validateBidFile } from '../lib/dify';
import { message, Modal, Input, Tabs, Button, Tag, Progress, Card, Table } from 'antd';
import { useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;
const { Search: AntSearch } = Input;

const BidAnalysis = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // 状态管理
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [processingProjects, setProcessingProjects] = useState(new Set());

  // 获取标书项目列表
  const fetchProjects = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      let query = supabase
        .from('bidding_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // 根据标签筛选
      if (activeTab === 'completed') {
        query = query.eq('status', 'completed');
      } else if (activeTab === 'processing') {
        query = query.eq('status', 'processing');
      }

      const { data, error } = await query;

      if (error) throw error;

      setProjects(data || []);
    } catch (error) {
      console.error('获取标书项目失败:', error);
      message.error('获取标书项目失败');
    } finally {
      setLoading(false);
    }
  }, [user, activeTab]);

  // 初始化加载
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // 监听处理中的项目，定期刷新
  useEffect(() => {
    if (projects.some(p => p.status === 'processing')) {
      const interval = setInterval(() => {
        fetchProjects();
      }, 10000); // 每10秒刷新一次

      return () => clearInterval(interval);
    }
  }, [projects, fetchProjects]);

  // 处理文件选择
  const handleFileSelect = (file) => {
    const validation = validateBidFile(file);
    if (!validation.isValid) {
      message.error(validation.message);
      return;
    }
    setSelectedFile(file);
  };

  // 处理拖拽上传
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // 上传并解析标书文件
  const handleUploadAndAnalyze = async () => {
    if (!selectedFile || !user) return;

    try {
      setUploading(true);
      setUploadProgress(10);

      // 1. 上传文件到 Supabase Storage
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${selectedFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const filePath = `${user.id}/${safeFileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 获取文件的公开访问 URL
      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);
      
      const fileUrl = urlData.publicUrl;
      setUploadProgress(20);

      // 2. 在数据库中创建记录（使用获取到的 fileUrl）
      const { data: projectData, error: insertError } = await supabase
        .from('bidding_projects')
        .insert({
          user_id: user.id,
          project_name: selectedFile.name.replace(/\.[^/.]+$/, ''), // 移除扩展名
          file_url: fileUrl, // 存储文件的公开访问链接
          analysis_report: '',
          framework_content: '',
          checklist_content: '',
          status: 'processing'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setUploadProgress(30);
      message.info('标书已创建，开始解析...');

      // 添加到处理中集合
      setProcessingProjects(prev => new Set(prev).add(projectData.id));

      // 2. 调用 Dify API 解析（异步，不阻塞UI）
      runDifyAnalysis(selectedFile, user.id)
        .then(async (results) => {
          setUploadProgress(80);
          
          // 3. 更新数据库记录
          const { error: updateError } = await supabase
            .from('bidding_projects')
            .update({
              analysis_report: results.report,
              framework_content: results.frame,
              checklist_content: results.checklist,
              status: 'completed'
            })
            .eq('id', projectData.id)
            .eq('user_id', user.id);

          if (updateError) throw updateError;

          setUploadProgress(100);
          message.success('标书解析完成！');
          
          // 从处理中集合移除
          setProcessingProjects(prev => {
            const newSet = new Set(prev);
            newSet.delete(projectData.id);
            return newSet;
          });

          // 刷新列表
          fetchProjects();
        })
        .catch(async (error) => {
          console.error('标书解析失败:', error);
          
          // 更新状态为失败
          await supabase
            .from('bidding_projects')
            .update({
              status: 'failed'
            })
            .eq('id', projectData.id)
            .eq('user_id', user.id);

          message.error(`解析失败: ${error.message}`);
          
          // 从处理中集合移除
          setProcessingProjects(prev => {
            const newSet = new Set(prev);
            newSet.delete(projectData.id);
            return newSet;
          });

          fetchProjects();
        })
        .finally(() => {
          setTimeout(() => {
            setUploading(false);
            setUploadProgress(0);
            setIsUploadModalVisible(false);
            setSelectedFile(null);
          }, 1000);
        });

    } catch (error) {
      console.error('标书创建失败:', error);
      message.error(`创建失败: ${error.message}`);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // 删除标书项目
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

  // 查看解析报告
  const handleViewAnalysis = (projectId) => {
    navigate(`/bid-analysis/${projectId}`);
  };

  // 根据状态获取标签颜色和图标
  const getStatusConfig = (status) => {
    switch (status) {
      case 'completed':
        return {
          color: 'green',
          icon: <CheckCircle size={14} />,
          text: '已完成'
        };
      case 'processing':
        return {
          color: 'blue',
          icon: <Loader2 size={14} className="animate-spin" />,
          text: '解析中'
        };
      case 'failed':
        return {
          color: 'red',
          icon: <AlertCircle size={14} />,
          text: '解析失败'
        };
      default:
        return {
          color: 'gray',
          icon: <Clock size={14} />,
          text: '待处理'
        };
    }
  };

  // 过滤项目列表
  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.project_name.toLowerCase().includes(searchText.toLowerCase());
    return matchesSearch;
  });

  // 统计数据
  const stats = {
    total: projects.length,
    completed: projects.filter(p => p.status === 'completed').length,
    processing: projects.filter(p => p.status === 'processing').length,
    failed: projects.filter(p => p.status === 'failed').length,
  };

  // 表格列定义
  const columns = [
    {
      title: '标书名称',
      dataIndex: 'project_name',
      key: 'project_name',
      render: (text, record) => (
        <div className="flex items-center">
          <FileText size={18} className="text-gray-400 mr-3" />
          <div>
            <div className="font-medium text-gray-900">{text}</div>
            <div className="text-xs text-gray-500">
              {new Date(record.created_at).toLocaleDateString('zh-CN')}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const config = getStatusConfig(status);
        return (
          <Tag color={config.color} icon={config.icon}>
            {config.text}
          </Tag>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <div className="flex space-x-2">
          <Button
            type="link"
            icon={<Eye size={16} />}
            onClick={() => handleViewAnalysis(record.id)}
            disabled={record.status !== 'completed'}
            title={record.status !== 'completed' ? '解析完成后可查看' : '查看解析报告'}
          >
            查看报告
          </Button>
          <Button
            type="link"
            danger
            icon={<Trash2 size={16} />}
            onClick={() => {
              setProjectToDelete(record);
              setIsDeleteModalVisible(true);
            }}
          >
            删除
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-white p-6">
      {/* 页面标题和统计卡片 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">我的标书</h1>
        <p className="text-gray-600">管理您的标书项目，查看AI解析报告</p>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">总标书数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText size={24} className="text-blue-500" />
            </div>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">已完成</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
              </div>
              <CheckCircle size={24} className="text-green-500" />
            </div>
          </Card>
          
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">解析中</p>
                <p className="text-2xl font-bold text-gray-900">{stats.processing}</p>
              </div>
              <Loader2 size={24} className="text-blue-500 animate-spin" />
            </div>
          </Card>
          
          <Card className="bg-gradient-to-r from-red-50 to-red-100 border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">解析失败</p>
                <p className="text-2xl font-bold text-gray-900">{stats.failed}</p>
              </div>
              <AlertCircle size={24} className="text-red-500" />
            </div>
          </Card>
        </div>
      </div>

      {/* 操作工具栏 */}
      <Card className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex-1 w-full md:w-auto">
            <AntSearch
              placeholder="搜索标书名称..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              className="w-full"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <Tabs 
              activeKey={activeTab} 
              onChange={setActiveTab}
              className="mb-0"
            >
              <TabPane tab="全部标书" key="all" />
              <TabPane tab="已完成" key="completed" />
              <TabPane tab="解析中" key="processing" />
            </Tabs>
            
            <Button
              type="primary"
              icon={<Plus size={18} />}
              onClick={() => setIsUploadModalVisible(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              新建标书
            </Button>
          </div>
        </div>
      </Card>

      {/* 标书列表 */}
      <Card>
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 size={48} className="text-purple-600 animate-spin" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-20">
            <FileText size={64} className="text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchText ? '未找到匹配的标书' : '暂无标书项目'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchText ? '尝试其他搜索关键词' : '点击"新建标书"开始解析您的第一个标书文件'}
            </p>
            <Button
              type="primary"
              icon={<Upload size={18} />}
              onClick={() => setIsUploadModalVisible(true)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              新建标书
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredProjects}
            rowKey="id"
            pagination={{ pageSize: 10 }}
            className="overflow-x-auto"
          />
        )}
      </Card>

      {/* 新建标书弹窗 */}
      <Modal
        title="新建标书"
        open={isUploadModalVisible}
        onCancel={() => {
          if (!uploading) {
            setIsUploadModalVisible(false);
            setSelectedFile(null);
            setIsDragging(false);
          }
        }}
        footer={[
          <Button 
            key="cancel" 
            onClick={() => {
              if (!uploading) {
                setIsUploadModalVisible(false);
                setSelectedFile(null);
              }
            }}
            disabled={uploading}
          >
            取消
          </Button>,
          <Button
            key="upload"
            type="primary"
            icon={uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            onClick={handleUploadAndAnalyze}
            disabled={!selectedFile || uploading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {uploading ? '处理中...' : '开始解析'}
          </Button>
        ]}
        width={600}
      >
        <div className="py-4">
          {uploading ? (
            <div className="text-center py-8">
              <Loader2 size={48} className="text-purple-600 animate-spin mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">正在处理标书文件</h4>
              <p className="text-gray-600 mb-4">AI正在解析标书内容，请稍候...</p>
              <Progress percent={uploadProgress} strokeColor="#8b5cf6" />
              <div className="mt-4 text-sm text-gray-500">
                {uploadProgress < 30 && '正在创建标书记录...'}
                {uploadProgress >= 30 && uploadProgress < 80 && '正在解析标书内容...'}
                {uploadProgress >= 80 && '正在保存解析结果...'}
              </div>
            </div>
          ) : (
            <>
              <div 
                className={`border-2 border-dashed rounded-xl p-8 mb-6 transition-all ${
                  isDragging 
                    ? 'border-purple-400 bg-purple-50' 
                    : selectedFile
                      ? 'border-green-300 bg-green-50'
                      : 'border-gray-300 hover:border-purple-300'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {selectedFile ? (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} className="text-green-600" />
                    </div>
                    <h4 className="font-medium text-gray-900 mb-2">文件已选择</h4>
                    <p className="text-gray-600 mb-1">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500 mb-4">
                      文件大小: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button
                      icon={<X size={16} />}
                      onClick={() => setSelectedFile(null)}
                      className="mt-2"
                    >
                      重新选择
                    </Button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="flex justify-center space-x-6 mb-6">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-2">
                          <File size={24} className="text-blue-600" />
                        </div>
                        <span className="text-xs text-gray-500">DOC</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-2">
                          <FileType size={24} className="text-purple-600" />
                        </div>
                        <span className="text-xs text-gray-500">DOCX</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mb-2">
                          <FileText size={24} className="text-orange-600" />
                        </div>
                        <span className="text-xs text-gray-500">PDF</span>
                      </div>
                    </div>
                    
                    <p className="font-medium text-gray-900 mb-2">选择标书文件</p>
                    <p className="text-gray-500 text-sm mb-6">
                      支持 PDF、DOCX 格式，最大 50MB
                    </p>
                    
                    <div>
  <input
    id="bid-upload-input"
    type="file"
    className="hidden"
    accept=".pdf,.docx"
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (file) handleFileSelect(file);
      // 下面这行极其关键：清空值，保证你连续两次选同一个文件也能触发
      if (e.target) e.target.value = ''; 
    }}
  />
  <Button 
    type="primary" 
    icon={<Upload size={16} />}
    className="bg-purple-600 hover:bg-purple-700"
    onClick={() => document.getElementById('bid-upload-input').click()}
  >
    选择文件
  </Button>
</div>
                    
                    <p className="text-sm text-gray-400 mt-4">或拖拽文件到此处</p>
                  </div>
                )}
              </div>
              
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle size={18} className="text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-blue-800">
                      <strong>注意：</strong>标书解析需要一定时间，解析过程中请勿关闭页面。解析完成后，您可以在列表中查看详细的AI分析报告。
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* 删除确认弹窗 */}
      <Modal
        title="删除标书"
        open={isDeleteModalVisible}
        onOk={handleDeleteProject}
        onCancel={() => {
          setIsDeleteModalVisible(false);
          setProjectToDelete(null);
        }}
        okText="删除"
        cancelText="取消"
        okType="danger"
      >
        <div className="py-4">
          <p className="text-gray-700">
            确定要删除标书 <span className="font-semibold">"{projectToDelete?.project_name}"</span> 吗？
          </p>
          <p className="mt-2 text-sm text-gray-500">
            删除后将无法恢复，相关的解析报告也将被永久删除。
          </p>
        </div>
      </Modal>

    </div>
  );
};

export default BidAnalysis;