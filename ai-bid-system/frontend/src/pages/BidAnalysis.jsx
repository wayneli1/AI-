import React, { useState } from 'react';
import { FileText, File, FileType, Upload, CheckCircle, AlertCircle, X } from 'lucide-react';

const BidAnalysis = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      console.log('上传文件:', file.name);
    }
  };

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
    if (file && (file.type.includes('pdf') || file.name.match(/\.(doc|docx)$/i))) {
      setSelectedFile(file);
      console.log('拖拽上传文件:', file.name);
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50/50 via-white to-white flex flex-col items-center justify-center p-4 md:p-8">
      {/* 页面大标题 */}
      <div className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4">
          <span className="text-black">标书AI</span>{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-blue-500">
            投标文件深度解析报告
          </span>
        </h1>
        <p className="text-gray-500 text-sm md:text-base">AI智能分析，提升投标成功率</p>
      </div>

      {/* 核心内容卡片 */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg p-6 md:p-8">
        {/* 卡片顶部标题 */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
            深度解析投标文件
          </h2>
          <p className="text-gray-500 text-sm md:text-base leading-relaxed max-w-3xl mx-auto">
            投标应答策略建议、评分项分析、废标项分析、投标文件组成框架梳理、商务资料清单梳理
          </p>
        </div>

        {/* 文件上传区域 */}
        <div 
          className={`border-2 border-dashed rounded-2xl p-8 md:p-12 mb-8 transition-all duration-300 ${
            isDragging 
              ? 'border-purple-400 bg-purple-50/50' 
              : selectedFile 
                ? 'border-green-200 bg-green-50/30' 
                : 'border-purple-200 hover:border-purple-300 hover:bg-purple-50/30'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {selectedFile ? (
            <div className="flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center text-green-600 mb-6">
                <CheckCircle size={40} />
              </div>
              <div className="text-center mb-6">
                <p className="text-gray-900 font-bold text-lg mb-2">文件已选择</p>
                <p className="text-gray-600 mb-1">{selectedFile.name}</p>
                <p className="text-gray-400 text-sm">
                  文件大小: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <div className="flex space-x-4">
                <button
                  onClick={removeFile}
                  className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors flex items-center"
                >
                  <X size={18} className="mr-2" />
                  重新选择
                </button>
                <button className="px-6 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center">
                  <FileText size={18} className="mr-2" />
                  开始解析
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              {/* 文档图标 */}
              <div className="flex space-x-6 mb-8">
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-xl flex items-center justify-center text-purple-600 mb-2">
                    <File size={32} />
                  </div>
                  <span className="text-xs text-gray-500">DOC</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 mb-2">
                    <FileType size={32} />
                  </div>
                  <span className="text-xs text-gray-500">DOCX</span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600 mb-2">
                    <FileText size={32} />
                  </div>
                  <span className="text-xs text-gray-500">PDF</span>
                </div>
              </div>

              {/* 提示文字 */}
              <p className="text-gray-900 font-bold text-lg mb-2">
                支持(.doc/.docx/.pdf)格式投标文件
              </p>
              <p className="text-gray-500 text-sm text-center mb-8 max-w-md">
                点击下方按钮上传文件，或直接拖拽文件到此处
                <br />
                文件大小不超过 50MB
              </p>

              {/* 上传按钮 */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                />
                <div className="px-8 py-3.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors flex items-center text-lg font-medium">
                  <Upload size={20} className="mr-3" />
                  点击上传投标文件
                </div>
              </label>

              {/* 拖拽提示 */}
              <p className="text-gray-400 text-sm mt-6">
                或拖拽文件到此处
              </p>
            </div>
          )}
        </div>

        {/* 功能特性说明 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 mb-4">
              <FileText size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">智能解析</h3>
            <p className="text-gray-600 text-sm">
              自动提取投标文件关键信息，识别评分标准和废标条款
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-5">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-4">
              <CheckCircle size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">策略建议</h3>
            <p className="text-gray-600 text-sm">
              提供针对性的投标应答策略，优化技术方案和商务响应
            </p>
          </div>

          <div className="bg-gray-50 rounded-xl p-5">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center text-purple-600 mb-4">
              <AlertCircle size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">风险预警</h3>
            <p className="text-gray-600 text-sm">
              识别潜在废标风险，提前预警并给出规避建议
            </p>
          </div>
        </div>

        {/* 底部说明 */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <div className="mb-4 md:mb-0">
              <p className="flex items-center">
                <CheckCircle size={14} className="mr-2 text-green-500" />
                100% 数据安全，文件处理完成后自动删除
              </p>
            </div>
            <div>
              <p>支持文件格式：PDF、DOC、DOCX</p>
              <p className="mt-1">最大文件大小：50MB</p>
            </div>
          </div>
        </div>
      </div>

      {/* 页面底部信息 */}
      <div className="mt-8 text-center text-gray-400 text-sm">
        <p>AI · 智能投标助手</p>
        <p className="mt-1">让投标更简单，让中标更容易</p>
      </div>
    </div>
  );
};

export default BidAnalysis;