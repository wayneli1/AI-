import { useState, useRef, useEffect, useCallback } from 'react';
import { Image as ImageIcon, Upload, Trash2, Download, Eye, FileImage, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { message } from 'antd';

const ImageLibrary = () => {
  const { user } = useAuth();
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState([]);
  
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

  const fetchImages = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('images')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedImages = data.map(img => ({
        id: img.id,
        name: img.image_name,
        size: img.file_size ? `${(img.file_size / 1024 / 1024).toFixed(1)} MB` : '未知大小',
        uploadDate: new Date(img.created_at).toISOString().split('T')[0],
        thumbnail: img.image_url,
        description: img.description || `上传的图片 - ${img.image_name}`,
        fileType: img.file_type || 'image/jpeg',
        image_url: img.image_url
      }));

      setImages(formattedImages);

    } catch (error) {
      console.error('获取图片失败:', error);
      message.error('获取图片列表失败');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleFileUpload = useCallback(async (event) => {
    const files = Array.from(event.target.files || event.dataTransfer?.files || []);
    if (!files.length || !user) return;

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
          const filePath = `${user.id}/${Date.now()}_${file.name}`;
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

          const { data: insertData, error: insertError } = await supabase
            .from('images')
            .insert({
              user_id: user.id,
              image_name: file.name,
              image_url: imageUrl,
              file_size: file.size,
              file_type: file.type
            })
            .select()
            .single();

          if (insertError) {
            console.error('数据库插入错误:', insertError);
            throw insertError;
          }

          uploadedImages.push({
            id: insertData.id,
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            uploadDate: new Date().toISOString().split('T')[0],
            thumbnail: imageUrl,
            description: `上传的图片 - ${file.name}`,
            fileType: file.type,
            image_url: imageUrl
          });

        } catch (fileError) {
          console.error(`上传文件 ${file.name} 失败:`, fileError);
          message.error(`文件 "${file.name}" 上传失败: ${fileError.message}`);
        }
      }

      if (uploadedImages.length > 0) {
        setImages(prev => [...prev, ...uploadedImages]);
        message.success(`成功上传 ${uploadedImages.length} 张图片`);
        fetchImages();
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
  }, [user, fetchImages]);

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
      handleFileUpload(e);
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

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('确定要删除这张图片吗？') || !user) return;

    const imageToDelete = images.find(img => img.id === imageId);
    if (!imageToDelete) return;

    try {
      const urlParts = imageToDelete.image_url?.split('/');
      const fileName = urlParts?.[urlParts.length - 1];
      const filePath = `${user.id}/${fileName}`;

      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('images')
          .remove([filePath]);

        if (storageError) throw storageError;
      }

      const { error: dbError } = await supabase
        .from('images')
        .delete()
        .eq('id', imageId)
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      setImages(prev => prev.filter(img => img.id !== imageId));
      message.success('图片删除成功');
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

  return (
    <div className="min-h-screen bg-white">
      <div className="px-8 pt-6">
        <h1 className="text-2xl font-bold text-gray-900">我的图片</h1>
        <div className="h-px bg-gray-100 mt-2"></div>
      </div>

      <div className="px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <h2 className="text-xl font-semibold text-gray-900 mr-3">
              所有图片
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
              disabled={uploading || !user}
              className={`px-4 py-2 bg-purple-600 text-white rounded-lg font-medium flex items-center ${uploading || !user ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'}`}
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
              ) : (
                <>
                  <Upload size={16} className="mr-2" />
                  上传图片
                </>
              )}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".jpg,.jpeg,.png"
              multiple
              disabled={uploading || !user}
              className="hidden"
            />
          </div>
        </div>

        <div 
          ref={dropZoneRef}
          className={`min-h-[400px] ${isDragging ? 'bg-purple-50 border-2 border-dashed border-purple-400 rounded-lg' : ''}`}
        >
          {loading ? (
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
                </>
              ) : !user ? (
                <>
                  <ImageIcon size={64} className="text-gray-300 mb-4" />
                  <div className="text-lg font-medium text-gray-900 mb-2">请先登录</div>
                  <div className="text-sm text-gray-500 mb-8">
                    登录后即可上传和管理图片
                  </div>
                </>
              ) : (
                <>
                  <ImageIcon size={64} className="text-gray-300 mb-4" />
                  <div className="text-lg font-medium text-gray-900 mb-2">暂无图片</div>
                  <div className="text-sm text-gray-500 mb-8">
                    点击上传图片，或拖拽图片到此处
                  </div>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className={`px-6 py-3 bg-purple-600 text-white rounded-lg font-medium flex items-center transition-colors ${uploading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'}`}
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

      {selectedImage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-900">{selectedImage.name}</h3>
                <div className="text-sm text-gray-500 mt-1">
                  {selectedImage.size} • {selectedImage.uploadDate}
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
                <div className="text-gray-900">{selectedImage.description}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageLibrary;