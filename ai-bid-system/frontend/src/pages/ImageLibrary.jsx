import { useState, useRef, useEffect, useCallback } from 'react';
import { Image as ImageIcon, Upload, Trash2, Download, Eye, FileImage, Loader2, X, Folder, FolderPlus, FolderOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { message, Modal, Input, Tabs } from 'antd';
import { extractTextFromImage } from '../utils/ocr';
import { syncTextToDify, deleteDocumentFromDify } from '../utils/difySync';

const { TabPane } = Tabs;

const ImageLibrary = () => {
  const { user } = useAuth();
  
  // 图片相关状态
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingImages, setLoadingImages] = useState(true);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [images, setImages] = useState([]);
  
  // 分类相关状态
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all', 'uncategorized', 或 category id
  const [selectedCategoryName, setSelectedCategoryName] = useState('全部图片');
  
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
      setLoadingCategories(true);
      const { data, error } = await supabase
        .from('image_categories')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });

      if (error) throw error;

      setCategories(data || []);
    } catch (error) {
      console.error('获取分类失败:', error);
      message.error('获取分类列表失败');
    } finally {
      setLoadingCategories(false);
    }
  }, [user]);

  // 获取图片列表（支持分类筛选）
  const fetchImages = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoadingImages(true);
      let query = supabase
        .from('images')
        .select('*, image_categories(name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // 根据选中的分类筛选图片
      if (selectedCategory === 'uncategorized') {
        query = query.is('category_id', null);
      } else if (selectedCategory !== 'all') {
        query = query.eq('category_id', selectedCategory);
      }

      const { data, error } = await query;

      if (error) throw error;

      const formattedImages = data.map(img => ({
        id: img.id,
        name: img.image_name,
        size: img.file_size ? `${(img.file_size / 1024 / 1024).toFixed(1)} MB` : '未知大小',
        uploadDate: new Date(img.created_at).toISOString().split('T')[0],
        thumbnail: img.image_url,
        description: img.description || `上传的图片 - ${img.image_name}`,
        fileType: img.file_type || 'image/jpeg',
        category_id: img.category_id,
        category_name: img.image_categories?.name || '未分类',
        image_url: img.image_url,
        dify_document_id: img.dify_document_id // ✅ 获取 Dify ID
      }));

      setImages(formattedImages);
    } catch (error) {
      console.error('获取图片失败:', error);
      message.error('获取图片列表失败');
    } finally {
      setLoadingImages(false);
    }
  }, [user, selectedCategory]);

  // 初始化加载：获取分类和图片
  useEffect(() => {
    if (user) {
      fetchCategories();
      fetchImages();
    }
  }, [user, fetchCategories, fetchImages]);

  // 处理分类切换
  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    
    // 更新选中的分类名称（用于显示）
    if (categoryId === 'all') {
      setSelectedCategoryName('全部图片');
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
        .from('image_categories')
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
      // 检查分类下是否有图片
      const { data: imagesInCategory, error: checkError } = await supabase
        .from('images')
        .select('id')
        .eq('category_id', categoryToDelete.id)
        .limit(1);

      if (checkError) throw checkError;

      if (imagesInCategory && imagesInCategory.length > 0) {
        message.warning('该分类下还有图片，无法删除');
        return;
      }

      const { error } = await supabase
        .from('image_categories')
        .delete()
        .eq('id', categoryToDelete.id)
        .eq('user_id', user.id);

      if (error) throw error;

      message.success('分类删除成功');
      setCategories(prev => prev.filter(cat => cat.id !== categoryToDelete.id));
      
      // 如果删除的是当前选中的分类，切换到全部图片
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

  // 处理文件上传
  const handleFileUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files || event.dataTransfer?.files || []);
    if (!files.length || !user) return;

    // 检查是否选择了分类（除了全部图片和未分类）
    if (selectedCategory === 'all') {
      message.warning('请先选择一个分类，或者切换到"未分类"');
      return;
    }

    const validFiles = [];
    const invalidFiles = [];

    files.forEach(file => {
      const fileSizeMB = file.size / (1024 * 1024);
      const isImage = file.type.startsWith('image/');
      const isValidSize = fileSizeMB <= 20;
      const isAllowedType = file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png';
      
      if (isImage && isValidSize && isAllowedType) {
        validFiles.push(file);
      } else {
        let reason = '';
        if (!isImage) {
          reason = '不是图片文件';
        } else if (!isAllowedType) {
          reason = '只支持 JPG、PNG 格式';
        } else {
          reason = `文件大小 ${fileSizeMB.toFixed(1)}MB 超过 20MB 限制`;
        }
        invalidFiles.push({ name: file.name, reason });
      }
    });

    if (invalidFiles.length > 0) {
      message.error(`以下文件上传失败：\n${invalidFiles.map(f => `${f.name}: ${f.reason}`).join('\n')}`);
    }

    if (validFiles.length === 0) return;

    try {
      setUploading(true);
      const uploadedImages = [];

      for (const file of validFiles) {
        try {
          // 生成安全的文件名（避免中文等特殊字符）
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 9);
          const lastDotIndex = file.name.lastIndexOf('.');
          let ext = lastDotIndex !== -1 ? file.name.substring(lastDotIndex).toLowerCase() : '';
          // 过滤扩展名，只保留字母、数字和点号
          if (ext) {
            ext = ext.replace(/[^a-z0-9.]/g, '_');
          }
          const safeFileName = `${timestamp}_${randomStr}${ext}`;
          const filePath = `${user.id}/${safeFileName}`;
          const { error: uploadError } = await supabase.storage
            .from('images')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            if (uploadError.message.includes('duplicate')) {
              throw new Error(`文件 "${file.name}" 已存在，请重命名后重新上传`);
            }
            throw uploadError;
          }

          const { data: publicUrlData } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

          const imageUrl = publicUrlData.publicUrl;

          // 准备插入数据，包含category_id（如果是未分类则为null）
          const insertData = {
            user_id: user.id,
            image_name: file.name,
            image_url: imageUrl,
            file_size: file.size,
            file_type: file.type,
            category_id: selectedCategory === 'uncategorized' ? null : selectedCategory,
            ocr_status: 'pending'
          };

          const { data: insertDataResult, error: insertError } = await supabase
            .from('images')
            .insert(insertData)
            .select()
            .single();

          if (insertError) {
            console.error('数据库插入错误:', insertError);
            throw insertError;
          }

          uploadedImages.push({
            id: insertDataResult.id,
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            uploadDate: new Date().toISOString().split('T')[0],
            thumbnail: imageUrl,
            description: `上传的图片 - ${file.name}`,
            fileType: file.type,
            category_id: insertDataResult.category_id,
            category_name: selectedCategory === 'uncategorized' ? '未分类' : 
                          categories.find(cat => cat.id === selectedCategory)?.name || '',
            image_url: imageUrl,
            dify_document_id: null // 初始暂空
          });

           // 异步触发OCR文字提取
           (async () => {
             try {
               const text = await extractTextFromImage(file);
               
               // ✅ 补丁：图片 OCR 文字需拼接公网 URL 后，再传给 Dify！
               const contentForDify = `【图片资产名称：${file.name}】\n图片内解析文字内容：${text}\n原图公网访问地址（请在标书中直接以Markdown格式插入此链接展示图片）：![${file.name}](${imageUrl})`;

               await supabase
                 .from('images')
                 .update({ ocr_content: text, ocr_status: 'completed' })
                 .eq('id', insertDataResult.id);
                 
                // 同步到Dify知识库
                let finalDifyId = null;
                try {
                  finalDifyId = await syncTextToDify(file.name, contentForDify);
                  if (finalDifyId) {
                    // 将 Dify 文档 ID 保存到数据库
                    await supabase
                      .from('images')
                      .update({ dify_document_id: finalDifyId })
                      .eq('id', insertDataResult.id);
                  }
                } catch (syncError) {
                  console.error('同步到Dify失败:', syncError);
                }
                
                // ✅ 补丁：将 Dify ID 注入本地 State
                setImages(prev => prev.map(img => 
                  img.id === insertDataResult.id ? { ...img, dify_document_id: finalDifyId } : img
                ));

             } catch (ocrError) {
               console.error(`OCR提取失败（图片ID: ${insertDataResult.id}）:`, ocrError);
               // 更新状态为失败
               await supabase
                 .from('images')
                 .update({ ocr_status: 'failed' })
                 .eq('id', insertDataResult.id);
             }
           })();

        } catch (fileError) {
          console.error(`上传文件 ${file.name} 失败:`, fileError);
          message.error(`文件 "${file.name}" 上传失败: ${fileError.message}`);
        }
      }

      if (uploadedImages.length > 0) {
        // 先把未完全处理的放进视图
        setImages(prev => [...uploadedImages, ...prev]);
        message.success(`成功上传 ${uploadedImages.length} 张图片到"${selectedCategoryName}"`);
      }

    } catch (error) {
      console.error('上传过程中发生错误:', error);
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  }, [user, selectedCategory, selectedCategoryName, categories]); // 去除 fetchImages 依赖防止死循环

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

  // ✅ 核心修复：图片操作函数加入 Dify 删除联动
  const handleDeleteImage = async (imageId) => {
    const imageToDelete = images.find(img => img.id === imageId);
    if (!imageToDelete || !user) return;

    if (!window.confirm('确定要删除这张图片吗？关联的 AI 知识库内容也将被同步清除。')) return;

    try {
      // 1. 如果存在 Dify 文档 ID，则从 Dify 知识库删除
      if (imageToDelete.dify_document_id) {
        try {
          await deleteDocumentFromDify(imageToDelete.dify_document_id);
        } catch (difyError) {
          console.error('从 Dify 知识库删除图片数据失败:', difyError);
          message.warning('图片已从本地删除，但 Dify 知识库文档删除失败，请手动清理');
        }
      }

      // 2. 从 Storage 删除
      const urlParts = imageToDelete.image_url?.split('/');
      const fileName = urlParts?.[urlParts.length - 1];
      const filePath = `${user.id}/${fileName}`;

      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('images')
          .remove([filePath]);

        if (storageError) throw storageError;
      }

      // 3. 从数据库记录删除
      const { error: dbError } = await supabase
        .from('images')
        .delete()
        .eq('id', imageId)
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      // 4. 更新前端状态
      setImages(prev => prev.filter(img => img.id !== imageId));
      message.success('图片及 AI 记忆删除成功');
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败，请重试');
    }
  };

  const handlePreviewImage = (image) => {
    setSelectedImage(image);
  };

  const handleDownloadImage = (image) => {
    const link = document.createElement('a');
    link.href = image.thumbnail;
    link.download = `${image.name}.${image.fileType?.split('/')[1] || 'jpg'}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
        <h1 className="text-2xl font-bold text-gray-900">图片库</h1>
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
              {/* 全部图片 */}
              <div
                className={`flex items-center px-4 py-3 rounded-lg cursor-pointer transition-colors ${selectedCategory === 'all' ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50'}`}
                onClick={() => handleCategorySelect('all')}
              >
                <FolderOpen size={16} className="mr-3" />
                <span className="font-medium">全部图片</span>
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
              {loadingCategories ? (
                <div className="px-4 py-3">
                  <div className="animate-pulse flex items-center">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              ) : categories.length > 0 ? (
                categories.map(renderCategoryItem)
              ) : (
                <div className="px-4 py-3 text-sm text-gray-500">
                  暂无分类，点击上方按钮创建
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧图片区域 */}
        <div className="flex-1 p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-gray-900 mr-3">
                {selectedCategoryName}
              </h2>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                {images.length} 张图片
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                支持 JPG、PNG 格式，最大 20MB
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
                accept=".jpg,.jpeg,.png"
                multiple
                disabled={uploading || !user || selectedCategory === 'all'}
                className="hidden"
              />
            </div>
          </div>

          {/* 图片网格区域 */}
          <div 
            ref={dropZoneRef}
            className={`min-h-[400px] ${isDragging ? 'bg-purple-50 border-2 border-dashed border-purple-400 rounded-lg' : ''}`}
          >
            {loadingImages ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 size={64} className="text-purple-600 mb-4 animate-spin" />
                <div className="text-lg font-medium text-gray-900 mb-2">加载中...</div>
              </div>
            ) : images.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {images.map((img) => (
                  <div key={img.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
                    <div className="relative h-48 overflow-hidden bg-gray-50">
                      <img 
                        src={img.thumbnail} 
                        alt={img.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/300x200?text=图片加载失败';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300"></div>
                      <div className="absolute top-3 right-3 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button 
                          onClick={() => handlePreviewImage(img)}
                          className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white hover:scale-110 transition-transform"
                          title="预览"
                        >
                          <Eye size={14} className="text-gray-700" />
                        </button>
                        <button 
                          onClick={() => handleDownloadImage(img)}
                          className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white hover:scale-110 transition-transform"
                          title="下载"
                        >
                          <Download size={14} className="text-gray-700" />
                        </button>
                        <button 
                          onClick={() => handleDeleteImage(img.id)}
                          className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white hover:scale-110 transition-transform"
                          title="删除"
                        >
                          <Trash2 size={14} className="text-gray-700" />
                        </button>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 truncate">{img.name}</h4>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{img.description}</p>
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-2">{img.size}</span>
                      </div>
                      <div className="mb-2">
                        <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                          {img.category_name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center">
                          <FileImage size={12} className="mr-1" />
                          {img.fileType?.split('/')[1]?.toUpperCase() || 'JPG'}
                        </div>
                        <div>{img.uploadDate}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={`flex flex-col items-center justify-center py-20 ${isDragging ? 'border-2 border-dashed border-purple-400 rounded-lg' : ''}`}>
                {isDragging ? (
                  <>
                    <Upload size={64} className="text-purple-400 mb-4 animate-bounce" />
                    <div className="text-lg font-medium text-purple-600 mb-2">松开鼠标上传图片</div>
                    <div className="text-sm text-gray-500">
                      图片将上传到"{selectedCategoryName}"
                    </div>
                  </>
                ) : !user ? (
                  <>
                    <ImageIcon size={64} className="text-gray-300 mb-4" />
                    <div className="text-lg font-medium text-gray-900 mb-2">请先登录</div>
                    <div className="text-sm text-gray-500 mb-8">
                      登录后即可上传和管理图片
                    </div>
                  </>
                ) : selectedCategory === 'all' ? (
                  <>
                    <ImageIcon size={64} className="text-gray-300 mb-4" />
                    <div className="text-lg font-medium text-gray-900 mb-2">选择分类查看图片</div>
                    <div className="text-sm text-gray-500 mb-8">
                      请在左侧选择一个分类，或切换到"未分类"
                    </div>
                  </>
                ) : (
                  <>
                    <ImageIcon size={64} className="text-gray-300 mb-4" />
                    <div className="text-lg font-medium text-gray-900 mb-2">暂无图片</div>
                    <div className="text-sm text-gray-500 mb-8">
                      点击上传图片到"{selectedCategoryName}"，或拖拽图片到此处
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading || selectedCategory === 'all'}
                      className={`px-6 py-3 bg-purple-600 text-white rounded-lg font-medium flex items-center transition-colors ${uploading || selectedCategory === 'all' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'}`}
                    >
                      {uploading ? (
                        <>
                          <Loader2 size={18} className="mr-2 animate-spin" />
                          上传中...
                        </>
                      ) : (
                        <>
                          <Upload size={18} className="mr-2" />
                          上传图片
                        </>
                      )}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 图片预览模态框 */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedImage.name}</h3>
                <div className="text-sm text-gray-500 mt-1">
                  {selectedImage.size} • {selectedImage.uploadDate} • 
                  <span className="text-blue-600 ml-1">{selectedImage.category_name}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownloadImage(selectedImage)}
                  className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                  title="下载"
                >
                  <Download size={20} />
                </button>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                  title="关闭"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-80px)]">
              <div className="flex justify-center">
                <img 
                  src={selectedImage.thumbnail} 
                  alt={selectedImage.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/800x600?text=图片加载失败';
                  }}
                />
              </div>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-2">图片描述</div>
                <div className="text-gray-900 mb-3">{selectedImage.description}</div>
                <div className="flex items-center">
                  <div className="text-sm text-gray-600 mr-2">所属分类:</div>
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {selectedImage.category_name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
            创建后，你可以将图片上传到这个分类
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
            确定要删除分类 <span className="font-semibold">"{categoryToDelete?.name}"</span> 吗？
          </p>
          <p className="mt-2 text-sm text-gray-500">
            注意：只有空分类才能被删除。如果分类下还有图片，请先移动或删除这些图片。
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default ImageLibrary;