import React from 'react';
import { Upload, CheckCircle2, Zap, Sparkles, FileStack, ListChecks } from 'lucide-react';

export default function CreateBid() {
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

              <div className="p-3 rounded-xl hover:bg-white transition-all flex items-center cursor-pointer group">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 mr-3 shrink-0 group-hover:bg-purple-50 group-hover:text-purple-600">
                  <Sparkles size={18} />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-gray-600">施工标专项</span>
                  <span className="ml-2 text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase italic font-bold">New</span>
                </div>
              </div>

              <div className="p-3 rounded-xl hover:bg-white transition-all flex items-center cursor-pointer group">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 mr-3 shrink-0 group-hover:bg-purple-50 group-hover:text-purple-600">
                  <FileStack size={18} />
                </div>
                <div className="flex-1 text-sm font-medium text-gray-600">
                  以标写标 <span className="ml-2 text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded-full uppercase italic font-bold">New</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 px-2">资料辅助类</h3>
            <div className="space-y-2">
              <div className="p-3 rounded-xl hover:bg-white transition-all flex items-center cursor-pointer group">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 mr-3 shrink-0 group-hover:bg-purple-50 group-hover:text-purple-600">
                  <ListChecks size={18} />
                </div>
                <div className="flex-1 text-sm font-medium text-gray-600">
                  投标文件框架提取 <span className="ml-2 text-[9px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-bold">限免</span>
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
                <span className="ml-3 text-xs text-gray-400">根据招标文件生成完整技术方案内容</span>
              </div>
              <div className="flex space-x-6 mt-4">
                <FeatureItem text="智能解析评分标准" />
                <FeatureItem text="自动生成图文并茂排版" />
                <FeatureItem text="支持超长篇幅文档生成" />
              </div>
            </div>

            {/* 上传区域 */}
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50 hover:bg-purple-50/30 hover:border-purple-200 transition-all cursor-pointer group">
              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-purple-600 mb-4 group-hover:scale-110 transition-transform">
                <Upload size={28} />
              </div>
              <p className="text-gray-900 font-bold mb-1">点击或拖拽上传招标文件</p>
              <p className="text-gray-400 text-xs text-center px-10">
                支持 PDF、Word 格式，文件大小不超过 50MB<br/>
                AI 将自动解析招标需求并匹配最佳素材
              </p>
            </div>
          </div>
        </div>
      </div>
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