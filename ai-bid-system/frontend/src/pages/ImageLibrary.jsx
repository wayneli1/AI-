import React, { useState, useRef, useEffect } from 'react';
import { Folder, FolderPlus, Image as ImageIcon, Upload, X, Check, Trash2, Download, Eye, Maximize2, FileImage } from 'lucide-react';

const ImageLibrary = () => {
  const [folders, setFolders] = useState([
    { id: 1, name: '资质证书', count: 4 },
    { id: 2, name: '产品图片', count: 1 },
    { id: 3, name: '案例图片', count: 1 },
    { id: 4, name: '公司文化', count: 1 },
    { id: 5, name: '公司实力', count: 1 },
  ]);
  
  const [selectedFolderId, setSelectedFolderId] = useState(1);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [movingImage, setMovingImage] = useState(null);
  const [images, setImages] = useState({
    1: [
      { id: 1, name: '营业执照', size: '1.2 MB', uploadDate: '2024-03-19', thumbnail: 'https://picsum.photos/300/200?random=1', description: '公司营业执照扫描件' },
      { id: 2, name: 'ISO9001认证', size: '0.8 MB', uploadDate: '2024-03-18', thumbnail: 'https://picsum.photos/300/200?random=2', description: 'ISO9001质量体系认证证书' },
      { id: 6, name: '专利证书', size: '1.5 MB', uploadDate: '2024-03-14', thumbnail: 'https://picsum.photos/300/200?random=6', description: '技术专利证书扫描件' },
      { id: 8, name: '荣誉证书', size: '0.9 MB', uploadDate: '2024-03-12', thumbnail: 'https://picsum.photos/300/200?random=8', description: '行业荣誉证书和奖项' },
    ],
    2: [
      { id: 3, name: '产品展示图', size: '2.1 MB', uploadDate: '2024-03-17', thumbnail: 'https://picsum.photos/300/200?random=3', description: '主要产品高清展示图' },
    ],
    3: [
      { id: 4, name: '项目案例图', size: '3.4 MB', uploadDate: '2024-03-16', thumbnail: 'https://picsum.photos/300/200?random=4', description: '成功项目案例现场图片' },
    ],
    4: [
      { id: 5, name: '团队合影', size: '4.2 MB', uploadDate: '2024-03-15', thumbnail: 'https://picsum.photos/300/200?random=5', description: '公司团队集体合影' },
    ],
    5: [
      { id: 7, name: '工厂实拍', size: '5.1 MB', uploadDate: '2024-03-13', thumbnail: 'https://picsum.photos/300/200?random=7', description: '生产工厂实地拍摄照片' },
    ],
  });
  
  const fileInputRef = useRef(null);
  const dropZoneRef = useRef(null);

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
      
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFileUpload({ target: { files } });
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
  }, []);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      const newFolder = {
        id: Date.now(),
        name: newFolderName,
        count: 0
      };
      setFolders([...folders, newFolder]);
      setImages({ ...images, [newFolder.id]: [] });
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const handleRenameFolder = (folderId, newName) => {
    if (newName.trim()) {
      setFolders(folders.map(folder => 
        folder.id === folderId ? { ...folder, name: newName } : folder
      ));
      setEditingFolderId(null);
    }
  };

  const handleMoveImage = (imageId, targetFolderId) => {
    if (targetFolderId === selectedFolderId) return;

    const imageToMove = images[selectedFolderId].find(img => img.id === imageId);
    if (!imageToMove) return;

    const sourceImages = images[selectedFolderId].filter(img => img.id !== imageId);
    const targetImages = [...(images[targetFolderId] || []), imageToMove];

    setImages({
      ...images,
      [selectedFolderId]: sourceImages,
      [targetFolderId]: targetImages
    });

    setFolders(folders.map(folder => {
      if (folder.id === selectedFolderId) {
        return { ...folder, count: sourceImages.length };
      }
      if (folder.id === targetFolderId) {
        return { ...folder, count: targetImages.length };
      }
      return folder;
    }));

    setMovingImage(null);
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files);
    const validFiles = [];
    const invalidFiles = [];

    files.forEach(file => {
      const fileSizeMB = file.size / (1024 * 1024);
      const isImage = file.type.startsWith('image/');
      const isValidSize = fileSizeMB <= 20;
      
      if (isImage && isValidSize) {
        validFiles.push(file);
      } else {
        invalidFiles.push({
          name: file.name,
          reason: !isImage ? '不是图片文件' : `文件大小 ${fileSizeMB.toFixed(1)}MB 超过 20MB 限制`
        });
      }
    });

    if (invalidFiles.length > 0) {
      alert(`以下文件上传失败：\n${invalidFiles.map(f => `${f.name}: ${f.reason}`).join('\n')}`);
    }

    if (validFiles.length > 0) {
      const newImages = validFiles.map((file, index) => ({
        id: Date.now() + index,
        name: file.name.replace(/\.[^/.]+$/, ''),
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        uploadDate: new Date().toISOString().split('T')[0],
        thumbnail: URL.createObjectURL(file),
        description: `上传的图片 - ${file.name}`,
        fileType: file.type
      }));

      const currentImages = images[selectedFolderId] || [];
      const updatedImages = [...currentImages, ...newImages];
      
      setImages({
        ...images,
        [selectedFolderId]: updatedImages
      });

      setFolders(folders.map(folder => 
        folder.id === selectedFolderId 
          ? { ...folder, count: updatedImages.length }
          : folder
      ));
    }
  };

  const handleDeleteImage = (imageId) => {
    if (window.confirm('确定要删除这张图片吗？')) {
      const updatedImages = images[selectedFolderId].filter(img => img.id !== imageId);
      setImages({
        ...images,
        [selectedFolderId]: updatedImages
      });

      setFolders(folders.map(folder => 
        folder.id === selectedFolderId 
          ? { ...folder, count: updatedImages.length }
          : folder
      ));
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

  const handleDeleteFolder = (folderId) => {
    if (folderId === selectedFolderId) {
      setSelectedFolderId(folders[0].id);
    }
    
    const updatedFolders = folders.filter(folder => folder.id !== folderId);
    setFolders(updatedFolders);
    
    const updatedImages = { ...images };
    delete updatedImages[folderId];
    setImages(updatedImages);
  };

  const selectedFolder = folders.find(folder => folder.id === selectedFolderId);
  const currentImages = images[selectedFolderId] || [];

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部标题 */}
      <div className="px-8 pt-6">
        <h1 className="text-2xl font-bold text-gray-900">我的图片</h1>
        <div className="h-px bg-gray-100 mt-2"></div>
      </div>

      {/* 主内容区域 - 左右分栏布局 */}
      <div className="flex px-8 py-6">
        {/* 左侧侧边栏 - 文件夹列表 */}
        <div className="w-64 mr-8">
          <div className="text-sm text-gray-500 mb-4">文件夹</div>
          
          {/* 新建文件夹按钮 */}
          {isCreatingFolder ? (
            <div className="mb-4 p-3 border border-dashed border-gray-300 rounded-lg">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="输入文件夹名称"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-2"
                autoFocus
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateFolder}
                  className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 flex items-center justify-center"
                >
                  <Check size={16} className="mr-1" />
                  创建
                </button>
                <button
                  onClick={() => setIsCreatingFolder(false)}
                  className="px-3 py-1.5 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="w-full mb-4 p-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors flex items-center justify-center"
            >
              <FolderPlus size={20} className="mr-2" />
              + 新建文件夹
            </button>
          )}

          {/* 文件夹列表 */}
          <div className="space-y-1">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedFolderId === folder.id
                    ? 'bg-purple-50 border-l-4 border-purple-600'
                    : 'hover:bg-gray-50'
                }`}
                onClick={() => {
                  if (!editingFolderId) {
                    setSelectedFolderId(folder.id);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1 min-w-0">
                    <Folder size={18} className={`mr-3 flex-shrink-0 ${selectedFolderId === folder.id ? 'text-purple-600' : 'text-gray-400'}`} />
                    {editingFolderId === folder.id ? (
                      <input
                        type="text"
                        defaultValue={folder.name}
                        onBlur={(e) => handleRenameFolder(folder.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleRenameFolder(folder.id, e.target.value);
                          } else if (e.key === 'Escape') {
                            setEditingFolderId(null);
                          }
                        }}
                        className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${selectedFolderId === folder.id ? 'text-purple-700' : 'text-gray-700'}`}>
                          {folder.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {folder.count} 张图片
                        </div>
                      </div>
                    )}
                  </div>
                  {folder.id !== 1 && !editingFolderId && (
                    <div className="flex items-center space-x-1 ml-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFolderId(folder.id);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-500"
                        title="重命名"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(folder.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-500"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧内容区域 */}
        <div className="flex-1">
          {/* 内容顶部栏 */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <h2 className="text-xl font-semibold text-gray-900 mr-3">
                {selectedFolder?.name}
              </h2>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
                {selectedFolder?.count} 张图片
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                支持 JPG、PNG 格式，最大 20MB
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center"
              >
                <Upload size={16} className="mr-2" />
                上传图片
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".jpg,.jpeg,.png"
                multiple
                className="hidden"
              />
            </div>
          </div>

          {/* 图片内容区域 */}
          <div 
            ref={dropZoneRef}
            className={`min-h-[400px] ${isDragging ? 'bg-purple-50 border-2 border-dashed border-purple-400' : ''}`}
          >
            {currentImages.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {currentImages.map((img) => (
                  <div key={img.id} className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-md transition-shadow group">
                    <div className="relative h-48 overflow-hidden bg-gray-50">
                      <img 
                        src={img.thumbnail} 
                        alt={img.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                          onClick={() => setMovingImage(img)}
                          className="p-1.5 bg-white/90 backdrop-blur-sm rounded-lg hover:bg-white hover:scale-110 transition-transform"
                          title="移动到其他文件夹"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                            <polyline points="17 21 17 13 7 13 7 21"/>
                            <polyline points="7 3 7 8 15 8"/>
                          </svg>
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
              /* 空状态 */
              <div className={`flex flex-col items-center justify-center py-20 ${isDragging ? 'border-2 border-dashed border-purple-400 rounded-lg' : ''}`}>
                {isDragging ? (
                  <>
                    <Upload size={64} className="text-purple-400 mb-4 animate-bounce" />
                    <div className="text-lg font-medium text-purple-600 mb-2">松开鼠标上传图片</div>
                  </>
                ) : (
                  <>
                    <ImageIcon size={64} className="text-gray-300 mb-4" />
                    <div className="text-lg font-medium text-gray-900 mb-2">文件夹为空</div>
                    <div className="text-sm text-gray-500 mb-8">
                      点击上传图片，或拖拽图片到此处
                    </div>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 flex items-center transition-colors"
                    >
                      <Upload size={18} className="mr-2" />
                      上传图片
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

      {/* 移动图片模态框 */}
      {movingImage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">移动图片到其他文件夹</h3>
              <button
                onClick={() => setMovingImage(null)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <div className="text-sm text-gray-600 mb-2">选择目标文件夹：</div>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {folders
                    .filter(folder => folder.id !== selectedFolderId)
                    .map((folder) => (
                      <div
                        key={folder.id}
                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => handleMoveImage(movingImage.id, folder.id)}
                      >
                        <div className="flex items-center">
                          <Folder size={16} className="text-gray-400 mr-3" />
                          <div>
                            <div className="font-medium text-gray-900">{folder.name}</div>
                            <div className="text-xs text-gray-500">{folder.count} 张图片</div>
                          </div>
                        </div>
                        <button className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-md hover:bg-purple-200">
                          移动到此
                        </button>
                      </div>
                    ))}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setMovingImage(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageLibrary;