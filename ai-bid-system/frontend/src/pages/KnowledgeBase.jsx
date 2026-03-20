import React, { useState, useEffect } from 'react';
import { Upload, Inbox, FileText, Download, Eye, Trash2, CheckCircle, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { message } from 'antd';

const KnowledgeBase = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState([]);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [user]);

  const fetchDocuments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

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
        status: 'processed',
        file_url: doc.file_url
      }));

      setFiles(formattedFiles);
    } catch (error) {
      console.error('获取文档失败:', error);
      message.error('获取文档列表失败');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return;

    // 检查文件类型
    const allowedTypes = ['.pdf', '.doc', '.docx'];
    const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
      message.error('只支持 PDF、DOC、DOCX 格式的文件');
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
      
      // 1. 上传文件到 Storage
     const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExtension.replace('.', '')}`;
      const filePath = `${user.id}/${safeFileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // 2. 构建文件访问URL（私有桶）
      const fileUrl = `${supabase.supabaseUrl}/storage/v1/object/documents/${filePath}`;

      // 3. 首先确保用户在profiles表中有记录
      const { data: profileData, error: profileError } = await supabase
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

      // 4. 写入数据库
      const { data: insertData, error: insertError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_url: fileUrl
        })
        .select()
        .single();

      if (insertError) {
        console.error('数据库插入错误:', insertError);
        throw insertError;
      }

      // 4. 更新本地状态
      const newFile = {
        id: insertData.id,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        type: fileExtension.replace('.', '').toUpperCase(),
        date: new Date().toLocaleDateString('zh-CN'),
        status: 'processed',
        file_url: fileUrl
      };

      setUploadedFile(newFile);
      setFiles([newFile, ...files]);
      
      // 5. 显示成功消息
      message.success(`${file.name} 上传成功！`);
      
      // 6. 刷新列表
      fetchDocuments();

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
      event.target.value = '';
    }
  };

  const deleteFile = async (id) => {
    const fileToDelete = files.find(file => file.id === id);
    if (!fileToDelete || !user) return;

    try {
      // 从文件名解析出文件路径
      const filePath = `${user.id}/${fileToDelete.name}`;
      
      // 1. 从Storage删除文件
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([filePath]);

      if (storageError) throw storageError;

      // 2. 从数据库删除记录
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (dbError) throw dbError;

      // 3. 更新本地状态
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
            accept=".pdf,.doc,.docx"
            onChange={handleFileUpload}
            disabled={uploading || !user}
          />
          <div className={`bg-purple-50/30 rounded-xl p-10 hover:bg-purple-100/40 hover:shadow-md transition-all duration-300 flex flex-col items-center justify-center min-h-[220px] ${(uploading || !user) ? 'opacity-50 cursor-not-allowed' : ''}`}>
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
            ) : (
              <>
                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center text-purple-600 mb-6 shadow-sm">
                  <Upload size={40} />
                </div>
                <p className="text-purple-700 font-bold text-xl mb-3 text-center">
                  点击上传完整投标文件
                </p>
                <p className="text-gray-500 text-sm text-center">
                  支持 PDF、DOC、DOCX 格式，最大300M
                </p>
              </>
            )}
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
  );
};

export default KnowledgeBase;