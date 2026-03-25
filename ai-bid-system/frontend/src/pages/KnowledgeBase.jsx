import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Inbox, FileText, Download, Eye, Trash2, CheckCircle, X, Loader2, Folder, FolderPlus, FolderOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { message, Modal, Input } from 'antd';
import { extractTextFromDocument } from '../utils/documentParser';
import { syncTextToDify, deleteDocumentFromDify } from '../utils/difySync';

const KnowledgeBase = () => {
  const { user } = useAuth();
  
  // 文档相关状态
  const [files, setFiles] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  
  // 分类相关状态
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all', 'uncategorized', 或 category id
  const [selectedCategoryName, setSelectedCategoryName] = useState('全部文档');
  
  // 弹窗状态
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  // 获取分类列表
  const fetchCategories = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('document_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;

      setCategories(data || []);
    } catch (error) {
      console.error('获取分类失败:', error);
      message.error('获取分类列表失败');
    }
  }, [user]);

  // 获取文档列表（支持分类筛选）
  const fetchDocuments = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      let query = supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // 根据选中的分类筛选文档
      if (selectedCategory === 'uncategorized') {
        query = query.is('category_id', null);
      } else if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      const { data, error } = await query;

      if (error) {
        console.error('获取文档失败:', error);
        // 如果获取失败，返回空数组
        setFiles([]);
        return;
      }

      const formattedFiles = data.map(doc => ({
        id: doc.id,
        name: doc.file_name,
        size: doc.file_size ? `${(doc.file_size / 1024 / 1024).toFixed(2)} MB` : '0 MB',
        type: doc.file_type?.toUpperCase() || doc.file_name.split('.').pop().toUpperCase(),
        date: new Date(doc.created_at).toLocaleDateString('zh-CN'),
        status: doc.ocr_status === 'completed' ? 'processed' : doc.ocr_status === 'pending' ? 'processing' : 'processed',
        file_url: doc.file_url,
        category_id: doc.category_id,
        dify_document_id: doc.dify_document_id
      }));

      setFiles(formattedFiles);
    } catch (error) {
      console.error('获取文档失败:', error);
      message.error('获取文档列表失败');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [user, selectedCategory]);

  // 初始化加载：获取分类和文档
  useEffect(() => {
    if (user) {
      fetchCategories();
      fetchDocuments();
    }
  }, [user, fetchCategories, fetchDocuments]);

  // 处理分类切换
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    
    // 更新选中的分类名称（用于显示）
    if (categoryId === 'all') {
      setSelectedCategoryName('全部文档');
    } else if (categoryId === 'uncategorized') {
      setSelectedCategoryName('未分类');
    } else {
      const category = categories.find(cat => cat.id === categoryId);
      setSelectedCategoryName(category?.name || '');
    }
  };

  // 创建新分类
  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !user) {
      message.warning('请输入分类名称');
      return;
    }

    try {
      setIsCreatingCategory(true);
      const { data, error } = await supabase
        .from('document_categories')
        .insert({
          user_id: user.id,
          name: newCategoryName.trim()
        })
        .select()
        .single();

      if (error) throw error;

      message.success('分类创建成功');
      setCategories(prev => [...prev, data]);
      setNewCategoryName('');
      setIsCreateModalVisible(false);
      
      // 自动选中新创建的分类
      handleCategorySelect(data.id);
    } catch (error) {
      console.error('创建分类失败:', error);
      message.error('创建分类失败，请重试');
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // 删除分类
  const handleDeleteCategory = async () => {
    if (!categoryToDelete || !user) return;

    try {
      // 检查分类下是否有文档
      const { data: docsInCategory, error: checkError } = await supabase
        .from('documents')
        .select('id')
        .eq('category_id', categoryToDelete.id)
        .limit(1);

      if (checkError) throw checkError;

      if (docsInCategory && docsInCategory.length > 0) {
        message.warning('该分类下还有文档，无法删除');
        return;
      }

      const { error } = await supabase
        .from('document_categories')
        .delete()
        .eq('id', categoryToDelete.id)
        .eq('user_id', user.id);

      if (error) throw error;

      message.success('分类删除成功');
      setCategories(prev => prev.filter(cat => cat.id !== categoryToDelete.id));
      
      // 如果删除的是当前选中的分类，切换到全部文档
      if (selectedCategory === categoryToDelete.id) {
        handleCategorySelect('all');
      }
    } catch (error) {
      console.error('删除分类失败:', error);
      message.error('删除分类失败，请重试');
    } finally {
      setIsDeleteModalVisible(false);
      setCategoryToDelete(null);
    }
  };

  const handleFileUpload = useCallback(async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return;

    // 检查是否选择了分类（除了全部文档和未分类）
    if (selectedCategory === 'all') {
      message.warning('请先选择一个分类，或者切换到"未分类"');
      return;
    }

    // 检查文件类型
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      message.error('只支持 PDF、DOCX 格式的文件');
      return;
    }

    // 检查文件大小（最大300MB）
    const maxSize = 300 * 1024 * 1024; // 300MB
    if (file.size > maxSize) {
      message.error('文件大小不能超过300MB');
      return;
    }

    try {
      setUploading(true);
      
      // 1. 生成安全的文件名（避免中文等特殊字符）
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const safeFileName = `${timestamp}_${randomStr}${fileExtension}`;
      const filePath = `${user.id}/${safeFileName}`;
      
      // 2. 上传文件到 Storage
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 3. 构建文件访问URL（私有桶）
      const fileUrl = `${supabase.supabaseUrl}/storage/v1/object/documents/${filePath}`;

      // 4. 首先确保用户在profiles表中有记录
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          username: user.email?.split('@')[0] || 'user',
          company_name: '未设置'
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (profileError) {
        console.error('创建/更新用户profile失败:', profileError);
      }

      // 5. 写入数据库，包含category_id和ocr_status
      const insertData = {
        user_id: user.id,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
        file_type: fileExtension.replace('.', ''),
        category_id: selectedCategory === 'uncategorized' ? null : selectedCategory,
        ocr_status: 'pending'
      };

      const { data: insertDataResult, error: insertError } = await supabase
        .from('documents')
        .insert(insertData)
        .select()
        .single();

      if (insertError) {
        console.error('数据库插入错误:', insertError);
        throw insertError;
      }

      // 6. 更新本地状态
      const newFile = {
        id: insertDataResult.id,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        type: fileExtension.replace('.', '').toUpperCase(),
        date: new Date().toLocaleDateString('zh-CN'),
        status: 'processing',
        file_url: fileUrl,
        category_id: insertDataResult.category_id,
        dify_document_id: null // 初始为空，稍后更新
      };

      setUploadedFile(newFile);
      setFiles(prev => [newFile, ...prev]);
      
      // 7. 显示成功消息
      message.success(`${file.name} 上传成功！`);
      
      // 8. 刷新列表
      fetchDocuments();

      // 9. 异步触发OCR文字提取和Dify同步
      (async () => {
        try {
          const text = await extractTextFromDocument(file);
          let finalDifyId = null;

          // 更新状态为已完成
          await supabase
            .from('documents')
            .update({ ocr_content: text, ocr_status: 'completed' })
            .eq('id', insertDataResult.id);
            
          // 同步到Dify知识库
          try {
              finalDifyId = await syncTextToDify(file.name, text, selectedCategoryName);            if (finalDifyId) {
              // 将 Dify 文档 ID 保存到数据库
              await supabase
                .from('documents')
                .update({ dify_document_id: finalDifyId })
                .eq('id', insertDataResult.id);
            }
          } catch (syncError) {
            console.error('同步到Dify失败:', syncError);
          }
            
          // 🚀 核心修复：更新本地状态为已处理，并注入 Dify ID，确保立刻能删
          setFiles(prev => prev.map(f => 
            f.id === insertDataResult.id ? { ...f, status: 'processed', dify_document_id: finalDifyId } : f
          ));
        } catch (ocrError) {
          console.error(`OCR提取失败（文档ID: ${insertDataResult.id}）:`, ocrError);
          // 更新状态为失败
          await supabase
            .from('documents')
            .update({ ocr_status: 'failed' })
            .eq('id', insertDataResult.id);
        }
      })();

    } catch (error) {
      console.error('上传失败:', error);
      
      if (error.message.includes('duplicate')) {
        message.error('文件已存在，请重命名后重新上传');
      } else {
        message.error('上传失败，请重试');
      }
    } finally {
      setUploading(false);
      // 清空input值，允许重复上传同一文件
      if (event.target) event.target.value = '';
    }
  }, [user, selectedCategory, fetchDocuments]);

  const deleteFile = async (id) => {
    const fileToDelete = files.find(file => file.id === id);
    if (!fileToDelete || !user) return;

    try {
      // 从文件名解析出文件路径（使用安全文件名）
      const urlParts = fileToDelete.file_url?.split('/');
      const fileName = urlParts?.[urlParts.length - 1];
      const filePath = `${user.id}/${fileName}`;
      
      // 1. 如果存在 Dify 文档 ID，则从 Dify 知识库删除
      if (fileToDelete.dify_document_id) {
        try {
          await deleteDocumentFromDify(fileToDelete.dify_document_id);
        } catch (difyError) {
          console.error('从 Dify 知识库删除文档失败:', difyError);
          message.warning('文件已从本地删除，但 Dify 知识库文档删除失败，请手动清理');
        }
      }
      
      // 2. 从Storage删除文件
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([filePath]);
        if (storageError) throw storageError;
      }

      // 3. 从数据库删除记录
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      // 4. 更新本地状态
      setFiles(files.filter(file => file.id !== id));
      if (uploadedFile?.id === id) {
        setUploadedFile(null);
      }

      message.success('文件删除成功');
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败，请重试');
    }
  };

  // 拖拽上传事件处理
  useEffect(() => {
    const handleDragEnter = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);
    };

    const handleDragLeave = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!dropZoneRef.current?.contains(e.relatedTarget)) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      
      // 创建模拟的event对象
      const dataTransfer = e.dataTransfer;
      const files = dataTransfer.files;
      if (files.length > 0) {
        const mockEvent = { target: { files } };
        handleFileUpload(mockEvent);
      }
    };

    const dropZone = dropZoneRef.current;
    if (dropZone) {
      dropZone.addEventListener('dragenter', handleDragEnter);
      dropZone.addEventListener('dragleave', handleDragLeave);
      dropZone.addEventListener('dragover', handleDragOver);
      dropZone.addEventListener('drop', handleDrop);
    }

    return () => {
      if (dropZone) {
        dropZone.removeEventListener('dragenter', handleDragEnter);
        dropZone.removeEventListener('dragleave', handleDragLeave);
        dropZone.removeEventListener('dragover', handleDragOver);
        dropZone.removeEventListener('drop', handleDrop);
      }
    };
  }, [handleFileUpload]);

  // 分类导航项组件
  const renderCategoryItem = (category) => (
    <div
      key={category.id}
      className={`flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-colors ${selectedCategory === category.id ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50'}`}
      onClick={() => handleCategorySelect(category.id)}
    >
      <div className="flex items-center">
        <Folder size={16} className="mr-3" />
        <span className="font-medium">{category.name}</span>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setCategoryToDelete(category);
          setIsDeleteModalVisible(true);
        }}
        className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-red-50"
        title="删除分类"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部标题 */}
      <div className="px-8 pt-6">
        <h1 className="text-2xl font-bold text-gray-900">知识库</h1>
        <div className="h-px bg-gray-100 mt-2"></div>
      </div>

      <div className="flex">
        {/* 左侧分类导航栏 */}
        <div className="w-64 border-r border-gray-200 min-h-[calc(100vh-120px)] p-4">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">分类</h2>
              <button
                onClick={() => setIsCreateModalVisible(true)}
                className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg"
                title="新建分类"
              >
                <FolderPlus size={18} />
              </button>
            </div>
            
            {/* 分类列表 */}
            <div className="space-y-1">
              {/* 全部文档 */}
              <div
                className={`flex items-center px-4 py-3 rounded-lg cursor-pointer transition-colors ${selectedCategory === 'all' ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50'}`}
                onClick={() => handleCategorySelect('all')}
              >
                <FolderOpen size={16} className="mr-3" />
                <span className="font-medium">全部文档</span>
              </div>

              {/* 未分类 */}
              <div
                className={`flex items-center px-4 py-3 rounded-lg cursor-pointer transition-colors ${selectedCategory === 'uncategorized' ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50'}`}
                onClick={() => handleCategorySelect('uncategorized')}
              >
                <Folder size={16} className="mr-3" />
                <span className="font-medium">未分类</span>
              </div>

              {/* 用户自定义分类 */}
              {categories.length > 0 ? (
                categories.map(renderCategoryItem)
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500">
                  暂无分类，点击上方按钮创建
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-gray-900 mr-3">
                {selectedCategoryName}
              </h2>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                {files.length} 个文档
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                支持 PDF、DOCX 格式
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !user || selectedCategory === 'all'}
                className={`px-4 py-2 bg-purple-600 text-white rounded-lg font-medium flex items-center ${uploading || !user || selectedCategory === 'all' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'}`}
                title={selectedCategory === 'all' ? '请先选择一个分类' : ''}
              >
                {uploading ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    上传中...
                  </>
                ) : !user ? (
                  <>
                    <Upload size={16} className="mr-2" />
                    请先登录
                  </>
                ) : selectedCategory === 'all' ? (
                  <>
                    <Upload size={16} className="mr-2" />
                    请选择分类
                  </>
                ) : (
                  <>
                    <Upload size={16} className="mr-2" />
                    上传到 {selectedCategoryName}
                  </>
                )}
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".pdf,.doc,.docx"
                disabled={uploading || !user || selectedCategory === 'all'}
                className="hidden"
              />
            </div>
          </div>

          {/* 上传卡片区域 */}
          <div 
            ref={dropZoneRef}
            className={`mb-10 ${isDragging ? 'bg-purple-50 border-2 border-dashed border-purple-400 rounded-xl' : ''}`}
          >
            {/* 修复：将 label 替换为带点击事件的 div，强制触发隐藏的 file input */}
            <div 
              className="cursor-pointer"
              onClick={() => {
                if (!uploading && user && selectedCategory !== 'all') {
                  fileInputRef.current?.click();
                }
              }}
            >
              <div className={`bg-purple-50/30 rounded-xl p-10 hover:bg-purple-100/40 hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center min-h-[220px] ${(uploading || !user || selectedCategory === 'all') ? 'opacity-50 cursor-not-allowed' : ''}`}>
                {uploading ? (
                  <>
                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-purple-600 mb-6 shadow-sm">
                      <Loader2 size={40} className="animate-spin" />
                    </div>
                    <p className="text-purple-700 font-bold text-xl mb-3 text-center">
                      上传中...
                    </p>
                    <p className="text-gray-500 text-sm text-center">
                      请稍候
                    </p>
                  </>
                ) : !user ? (
                  <>
                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-purple-600 mb-6 shadow-sm">
                      <Upload size={40} />
                    </div>
                    <p className="text-purple-700 font-bold text-xl mb-3 text-center">
                      请先登录
                    </p>
                    <p className="text-gray-500 text-sm text-center">
                      登录后即可上传文件
                    </p>
                  </>
                ) : selectedCategory === 'all' ? (
                  <>
                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-purple-600 mb-6 shadow-sm">
                      <Upload size={40} />
                    </div>
                    <p className="text-purple-700 font-bold text-xl mb-3 text-center">
                      请先选择一个分类
                    </p>
                    <p className="text-gray-500 text-sm text-center">
                      在左侧选择一个分类后即可上传文件
                    </p>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-purple-600 mb-6 shadow-sm">
                      <Upload size={40} />
                    </div>
                    <p className="text-purple-700 font-bold text-xl mb-3 text-center">
                      点击上传完整投标文件
                    </p>
                    <p className="text-gray-500 text-sm text-center">
                      支持 PDF、DOCX 格式，最大300M
                    </p>
                    <p className="text-gray-500 text-xs mt-2 text-center">
                      或拖拽文件到此处
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* "已上传文件"标题栏 */}
          <div className="mb-8">
            <div className="flex items-center">
              <div className="border-l-4 border-purple-600 h-6 mr-3"></div>
              <h2 className="text-xl font-bold text-gray-900">已上传文件</h2>
            </div>
            <p className="text-gray-500 text-sm mt-2">管理您上传的投标文件</p>
          </div>

          {/* 文件列表或空状态 */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 size={48} className="text-purple-600 animate-spin mb-4" />
              <p className="text-gray-500">加载中...</p>
            </div>
          ) : files.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">文件名称</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">类型</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">大小</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">上传日期</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">状态</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 mr-4">
                            <FileText size={20} />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{file.name}</div>
                            <div className="text-xs text-gray-500 mt-1">投标文件</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                          {file.type}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">{file.size}</td>
                      <td className="py-4 px-4 text-sm text-gray-700">{file.date}</td>
                      <td className="py-4 px-4">
                        {file.status === 'uploaded' ? (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs rounded-full flex items-center w-fit">
                            <CheckCircle size={12} className="mr-1" />
                            已上传
                          </span>
                        ) : file.status === 'processing' ? (
                          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                            处理中
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs rounded-full flex items-center w-fit">
                            <CheckCircle size={12} className="mr-1" />
                            已处理
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex space-x-2">
                          <button 
                            onClick={() => window.open(file.file_url, '_blank')}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => {
                              const link = document.createElement('a');
                              link.href = file.file_url;
                              link.download = file.name;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                            }}
                            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg"
                          >
                            <Download size={16} />
                          </button>
                          <button 
                            onClick={() => deleteFile(file.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : !user ? (
            /* 未登录状态 */
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-24 h-24 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
                <Inbox size={48} />
              </div>
              <p className="text-gray-400 text-lg mb-2">请先登录</p>
              <p className="text-gray-400 text-sm text-center max-w-md">
                登录后即可上传和管理文件
              </p>
            </div>
          ) : (
            /* 空状态展示区域 */
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-24 h-24 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600 mb-6">
                <Inbox size={48} />
              </div>
              <p className="text-gray-400 text-lg mb-2">暂无文件</p>
              <p className="text-gray-400 text-sm text-center max-w-md">
                点击上方按钮上传文件，开始构建您的知识库
              </p>
            </div>
          )}

          {/* 上传成功提示 */}
          {uploadedFile && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center">
                <CheckCircle size={20} className="text-green-600 mr-3" />
                <div>
                  <p className="text-green-800 font-medium">文件上传成功！</p>
                  <p className="text-green-600 text-sm mt-1">
                    {uploadedFile.name} 已添加到知识库
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setUploadedFile(null)}
                className="text-green-600 hover:text-green-800"
              >
                <X size={20} />
              </button>
            </div>
          )}

          {/* 统计信息 */}
          <div className="mt-10 pt-8 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{files.length}</div>
                    <div className="text-sm text-gray-600 mt-1">文件总数</div>
                  </div>
                  <FileText size={24} className="text-gray-400" />
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {files.filter(f => f.status === 'processed').length}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">已处理文件</div>
                  </div>
                  <CheckCircle size={24} className="text-green-400" />
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-bold text-gray-900">
                      {files.reduce((sum, file) => {
                        const size = parseFloat(file.size);
                        return sum + (isNaN(size) ? 0 : size);
                      }, 0).toFixed(1)} MB
                    </div>
                    <div className="text-sm text-gray-600 mt-1">总存储空间</div>
                  </div>
                  <Download size={24} className="text-blue-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 新建分类弹窗 */}
      <Modal
        title="新建分类"
        open={isCreateModalVisible}
        onOk={handleCreateCategory}
        onCancel={() => {
          setIsCreateModalVisible(false);
          setNewCategoryName('');
        }}
        confirmLoading={isCreatingCategory}
        okText="创建"
        cancelText="取消"
      >
        <div className="py-4">
          <Input
            placeholder="请输入分类名称"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onPressEnter={handleCreateCategory}
            autoFocus
          />
          <div className="mt-2 text-sm text-gray-500">
            创建后，你可以将文档上传到这个分类
          </div>
        </div>
      </Modal>

      {/* 删除分类确认弹窗 */}
      <Modal
        title="删除分类"
        open={isDeleteModalVisible}
        onOk={handleDeleteCategory}
        onCancel={() => {
          setIsDeleteModalVisible(false);
          setCategoryToDelete(null);
        }}
        okText="删除"
        cancelText="取消"
        okType="danger"
      >
        <div className="py-4">
          <p className="text-gray-700">
             确定要删除分类 <span className="font-semibold">&quot;{categoryToDelete?.name}&quot;</span> 吗？
          </p>
          <p className="mt-2 text-sm text-gray-500">
            注意：只有空分类才能被删除。如果分类下还有文档，请先移动或删除这些文档。
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default KnowledgeBase;