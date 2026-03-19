import React, { useState } from 'react';
import { Upload, Inbox, FileText, Download, Eye, Trash2, CheckCircle, X } from 'lucide-react';

const KnowledgeBase = () => {
  const [files, setFiles] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const newFile = {
        id: Date.now(),
        name: file.name,
        size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
        type: file.name.split('.').pop().toUpperCase(),
        date: new Date().toLocaleDateString('zh-CN'),
        status: 'uploaded'
      };
      setUploadedFile(newFile);
      setFiles([newFile, ...files]);
      console.log('上传文件:', file.name);
    }
  };

  const deleteFile = (id) => {
    setFiles(files.filter(file => file.id !== id));
    if (uploadedFile?.id === id) {
      setUploadedFile(null);
    }
  };

  const sampleFiles = [
    {
      id: 1,
      name: '智慧城市项目投标文件.docx',
      size: '12.4 MB',
      type: 'DOCX',
      date: '2024-03-19',
      status: 'processed'
    },
    {
      id: 2,
      name: '数据中心建设技术方案.pdf',
      size: '8.7 MB',
      type: 'PDF',
      date: '2024-03-18',
      status: 'processed'
    },
    {
      id: 3,
      name: '网络安全系统投标书.doc',
      size: '5.2 MB',
      type: 'DOC',
      date: '2024-03-17',
      status: 'processing'
    }
  ];

  // 初始化时使用示例文件
  if (files.length === 0) {
    setFiles(sampleFiles);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      {/* 页面标题 */}
      <h1 className="text-2xl font-bold text-gray-900 mb-8">知识库</h1>

      {/* 顶部上传卡区 - 单栏布局 */}
      <div className="mb-10">
        <label className="cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept=".doc,.docx"
            onChange={handleFileUpload}
          />
          <div className="bg-purple-50/30 rounded-xl p-10 hover:bg-purple-100/40 hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center min-h-[220px]">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-purple-600 mb-6 shadow-sm">
              <Upload size={40} />
            </div>
            <p className="text-purple-700 font-bold text-xl mb-3 text-center">
              点击上传完整投标文件
            </p>
            <p className="text-gray-500 text-sm text-center">
              支持docx、doc格式，最大300M
            </p>
          </div>
        </label>
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
      {files.length > 0 ? (
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
                      <button className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                        <Eye size={16} />
                      </button>
                      <button className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg">
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
  );
};

export default KnowledgeBase;