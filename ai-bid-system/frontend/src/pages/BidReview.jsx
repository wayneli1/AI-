import React, { useState } from 'react';
import { Zap, Upload, FileText, AlertTriangle, CheckCircle, X, Shield, Target, BarChart } from 'lucide-react';

const BidReview = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      console.log('上传投标文件:', file.name);
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
    <div className="min-h-screen bg-[linear-gradient(45deg,_#f0f9ff_25%,_transparent_25%),_linear-gradient(-45deg,_#f0f9ff_25%,_transparent_25%),_linear-gradient(45deg,_transparent_75%,_#f0f9ff_75%),_linear-gradient(-45deg,_transparent_75%,_#f0f9ff_75%)] bg-[size:20px_20px] bg-fixed flex flex-col items-center justify-center p-4 md:p-8">
      {/* 页面顶部标题区域 */}
      <div className="text-center mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 text-gray-900">
          废标风险审查AI
        </h1>
        <p className="text-gray-500 text-sm md:text-base max-w-2xl mx-auto">
          上传您的投标文件，AI 将自动识别废标风险与潜力
        </p>
      </div>

      {/* 主卡片 */}
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg p-6 md:p-8">
        {/* 卡片头部 - 带闪电图标 */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center text-white mr-4">
            <Zap size={24} />
          </div>
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              智能废标风险审查
            </h2>
            <p className="text-gray-500 text-sm mt-1">基于AI的深度分析与预警</p>
          </div>
        </div>

        {/* 中心上传区域 - 单栏设计 */}
        <div className="flex flex-col items-center justify-center">
          <div 
            className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-8 md:p-12 mb-8 transition-all duration-300 ${
              isDragging 
                ? 'border-blue-400 bg-blue-50/50' 
                : selectedFile 
                  ? 'border-green-200 bg-green-50/30' 
                  : 'border-blue-200 hover:border-blue-300 hover:bg-blue-50/30'
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
                  <p className="text-gray-900 font-bold text-lg mb-2">投标文件已选择</p>
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
                  <button className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center">
                    <Shield size={18} className="mr-2" />
                    开始风险审查
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center">
                {/* 蓝色上传图标 */}
                <div className="w-24 h-24 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-8">
                  <Upload size={48} />
                </div>

                {/* 标题和描述 */}
                <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">
                  上传投标文件进行风险审查
                </h3>
                <p className="text-gray-500 text-center mb-8 max-w-md">
                  支持 PDF、Word 格式，AI将自动分析废标风险点
                  <br />
                  并提供优化建议，提升中标概率
                </p>

                {/* 上传按钮 */}
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileUpload}
                  />
                  <div className="px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:opacity-90 transition-opacity flex items-center text-lg font-medium">
                    <FileText size={20} className="mr-3" />
                    选择投标文件
                  </div>
                </label>

                {/* 拖拽提示 */}
                <p className="text-gray-400 text-sm mt-6">
                  或拖拽文件到此处
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 功能特性说明 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-blue-600 mb-4 shadow-sm">
              <AlertTriangle size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">风险识别</h3>
            <p className="text-gray-600 text-sm">
              智能识别废标条款、格式错误、资质不符等风险点
            </p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-100">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-purple-600 mb-4 shadow-sm">
              <Target size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">评分优化</h3>
            <p className="text-gray-600 text-sm">
              分析评分标准，提供技术方案和商务响应优化建议
            </p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
            <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-green-600 mb-4 shadow-sm">
              <BarChart size={24} />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">成功率预测</h3>
            <p className="text-gray-600 text-sm">
              基于历史数据预测中标概率，提供决策支持
            </p>
          </div>
        </div>

        {/* 审查流程说明 */}
        <div className="mt-10 pt-8 border-t border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 mb-6 text-center">AI审查流程</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 mb-3">
                <span className="font-bold">1</span>
              </div>
              <p className="text-sm font-medium text-gray-700">文件上传</p>
              <p className="text-xs text-gray-500 mt-1">上传投标文件</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 mb-3">
                <span className="font-bold">2</span>
              </div>
              <p className="text-sm font-medium text-gray-700">智能解析</p>
              <p className="text-xs text-gray-500 mt-1">提取关键信息</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 mb-3">
                <span className="font-bold">3</span>
              </div>
              <p className="text-sm font-medium text-gray-700">风险分析</p>
              <p className="text-xs text-gray-500 mt-1">识别废标风险</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-3">
                <span className="font-bold">4</span>
              </div>
              <p className="text-sm font-medium text-gray-700">生成报告</p>
              <p className="text-xs text-gray-500 mt-1">提供优化建议</p>
            </div>
          </div>
        </div>

        {/* 底部说明 */}
        <div className="mt-8 pt-6 border-t border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500">
            <div className="mb-4 md:mb-0">
              <p className="flex items-center">
                <Shield size={14} className="mr-2 text-green-500" />
                100% 数据安全，文件处理完成后自动删除
              </p>
            </div>
            <div className="text-center md:text-right">
              <p>支持文件格式：PDF、DOC、DOCX</p>
              <p className="mt-1">最大文件大小：50MB</p>
            </div>
          </div>
        </div>
      </div>

      {/* 页面底部信息 */}
      <div className="mt-8 text-center text-gray-400 text-sm">
        <p>废标风险审查AI · 智能投标保障</p>
        <p className="mt-1">提前预警风险，确保投标合规</p>
      </div>
    </div>
  );
};

export default BidReview;