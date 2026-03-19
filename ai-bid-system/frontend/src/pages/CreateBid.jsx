import React, { useState } from 'react';
import { Upload, CheckCircle2, Zap, Sparkles, FileStack, ListChecks, FolderOpen, FileUp, X } from 'lucide-react';

export default function CreateBid() {
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setShowUploadOptions(false);
      // 这里可以添加文件上传逻辑
      console.log('上传文件:', file.name);
    }
  };

  const handleSelectFromLibrary = () => {
    setShowUploadOptions(false);
    // 这里可以添加从知识库选择文件的逻辑
    console.log('从知识库选择文件');
  };

  return (
    <div className="flex-1 flex flex-col items-center">
      {/* 功能描述 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-extrabold mb-2">
          <span className="text-black">AI</span>{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 via-indigo-500 to-pink-500">
            智能生成标书方案
          </span>
        </h1>
        <p className="text-gray-400 text-sm">根据生成需求选择对应功能</p>
      </div>

      {/* 核心内容大卡片 */}
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 flex overflow-hidden min-h-[500px]">
        
        {/* 卡片左侧：功能菜单 */}
        <div className="w-1/3 border-r border-gray-50 p-6 bg-gray-50/30">
          <div className="mb-8">
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">方案生成类</h3>
            <div className="space-y-3">
              {/* 选中项 */}
              <div className="p-3 rounded-xl bg-white border border-purple-100 shadow-sm flex items-start cursor-pointer transition-all border-l-4 border-l-purple-600">
                <div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mr-3 shrink-0">
                  <Zap size={20} />
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">完整技术方案生成</div>
                  <div className="text-[11px] text-gray-400 mt-0.5">全行业适用 图文并茂</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 卡片右侧：操作区 */}
        <div className="flex-1 p-8">
          <div className="border border-gray-100 rounded-2xl h-full p-8 flex flex-col">
            <div className="mb-6">
              <div className="flex items-center mb-2">
                <h2 className="text-xl font-bold text-gray-900">完整技术方案生成</h2>
                <span className="ml-3 text-xs text-gray-400">根据投标文件生成完整技术方案内容</span>
              </div>
              <div className="flex space-x-6 mt-4">
                <FeatureItem text="智能解析评分标准" />
                <FeatureItem text="自动生成图文并茂排版" />
                <FeatureItem text="支持超长篇幅文档生成" />
              </div>
            </div>

            {/* 上传区域 */}
            <div 
              className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50 hover:bg-purple-50/30 hover:border-purple-200 transition-all cursor-pointer group relative"
              onClick={() => setShowUploadOptions(true)}
            >
              {selectedFile ? (
                <>
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-green-600 mb-4">
                    <CheckCircle2 size={28} />
                  </div>
                  <p className="text-gray-900 font-bold mb-1">已选择文件</p>
                  <p className="text-gray-600 text-sm mb-2">{selectedFile.name}</p>
                  <p className="text-gray-400 text-xs text-center px-10">
                    文件大小: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB<br/>
                    点击重新选择文件
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                    <Upload size={28} />
                  </div>
                  <p className="text-gray-900 font-bold mb-1">点击或拖拽上传投标文件</p>
                  <p className="text-gray-400 text-xs text-center px-10">
                    支持 PDF、Word 格式，文件大小不超过 50MB<br/>
                    AI 将自动解析投标需求并匹配最佳素材
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 上传选项模态框 */}
      {showUploadOptions && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            {/* 模态框头部 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">选择文件来源</h3>
              <button 
                onClick={() => setShowUploadOptions(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
              >
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            {/* 选项列表 */}
            <div className="p-6">
              <div className="space-y-4">
                {/* 从知识库产品库选择文件 */}
                <button
                  onClick={handleSelectFromLibrary}
                  className="w-full p-4 border border-gray-100 rounded-xl hover:border-purple-200 hover:bg-purple-50/30 transition-all flex items-center group"
                >
                  <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mr-4 group-hover:bg-purple-100 transition-colors">
                    <FolderOpen size={24} />
                  </div>
                  <div className="text-left flex-1">
                    <div className="font-bold text-gray-900">从知识库产品库选择文件</div>
                    <div className="text-xs text-gray-400 mt-1">从已有知识库或产品库中选择文件</div>
                  </div>
                </button>

                {/* 点击上传投标文件 */}
                <label className="block">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                  />
                  <div className="w-full p-4 border border-gray-100 rounded-xl hover:border-purple-200 hover:bg-purple-50/30 transition-all flex items-center group cursor-pointer">
                    <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center text-purple-600 mr-4 group-hover:bg-purple-100 transition-colors">
                      <FileUp size={24} />
                    </div>
                    <div className="text-left flex-1">
                      <div className="font-bold text-gray-900">点击上传投标文件</div>
                      <div className="text-xs text-gray-400 mt-1">上传本地文件（PDF、Word，≤50MB）</div>
                    </div>
                  </div>
                </label>
              </div>

              {/* 底部提示 */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-400 text-center">
                  支持 PDF、Word 格式，文件大小不超过 50MB
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 辅助组件：特点说明项
function FeatureItem({ text }) {
  return (
    <div className="flex items-center text-[11px] text-gray-500 font-medium">
      <CheckCircle2 size={14} className="text-purple-500 mr-1.5" />
      {text}
    </div>
  );
}