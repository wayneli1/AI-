import React, { useState } from 'react';
import { UploadCloud, File, FileText, FileType, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { runDifyAnalysis, validateBidFile } from '../lib/dify';
import { message, Progress } from 'antd';
import { useNavigate } from 'react-router-dom';

const BidAnalysis = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // 文件验证逻辑
  const handleFileSelect = async (file) => {
    const validation = validateBidFile(file);
    if (!validation.isValid) {
      message.error(validation.message);
      return;
    }
    // 文件合法，直接触发一条龙解析！
    await handleUploadAndAnalyze(file);
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
    if (file) handleFileSelect(file);
  };

  // 核心：上传并调用 Dify
  const handleUploadAndAnalyze = async (selectedFile) => {
    if (!user) return message.error('请先登录');

    try {
      setUploading(true);
      setUploadProgress(10);

      // 1. 上传文件到 Supabase
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}_${selectedFile.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
      const filePath = `${user.id}/${safeFileName}`;
      
      const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, selectedFile, { cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
      const fileUrl = urlData.publicUrl;
      setUploadProgress(30);

      // 2. 数据库建档
      const { data: projectData, error: insertError } = await supabase
        .from('bidding_projects')
        .insert({
          user_id: user.id,
          project_name: selectedFile.name.replace(/\.[^/.]+$/, ''),
          file_url: fileUrl,
          status: 'processing'
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setUploadProgress(40);

      // 3. 异步触发 Dify 引擎 (不阻塞主线程，这里可以选择立即跳转，或者等它转完)
      runDifyAnalysis(selectedFile, user.id)
        .then(async (results) => {
          setUploadProgress(90);
          await supabase.from('bidding_projects').update({
            analysis_report: results.report,
            framework_content: results.frame,
            checklist_content: results.checklist,
            status: 'completed'
          }).eq('id', projectData.id);
          
          setUploadProgress(100);
          message.success('招标文件深度解析完成！');
          setTimeout(() => navigate(`/my-bids`), 1500); // 成功后跳回列表页
        })
        .catch(async (error) => {
          await supabase.from('bidding_projects').update({ status: 'failed' }).eq('id', projectData.id);
          message.error(`解析失败: ${error.message}`);
          setTimeout(() => navigate(`/my-bids`), 1500);
        });

    } catch (error) {
      console.error('上传流程失败:', error);
      message.error(`创建失败: ${error.message}`);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F3FF] to-[#FFFFFF] flex flex-col lg:flex-row items-center justify-center p-8 gap-16">
      
      {/* 左侧：巨大的核心交互区 (对标图1) */}
      <div className="w-full max-w-2xl flex flex-col items-center">
        <h1 className="text-[32px] font-black tracking-tight mb-8">
          <span className="text-gray-900">智能系统 </span>
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">招标文件深度解析报告</span>
        </h1>

        <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.05)] w-full p-10 border border-white">
          <h2 className="text-xl font-bold text-gray-900 mb-2">深度解析招标文件</h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            投标响应策略建议、评分项分析、废标项分析、投标文件组成框架梳理、商务资料清单梳理
          </p>

          {!uploading ? (
            <div 
              className={`border-2 border-dashed rounded-2xl p-12 transition-all duration-300 flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group ${
                isDragging ? 'border-indigo-400 bg-indigo-50/50' : 'border-indigo-100 bg-indigo-50/20 hover:border-indigo-300 hover:bg-indigo-50/40'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => document.getElementById('main-upload-input').click()}
            >
              {/* 图标展示 */}
              <div className="flex space-x-6 mb-8 transform group-hover:-translate-y-2 transition-transform duration-300">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center shadow-sm">
                  <File className="text-blue-500" size={32} />
                </div>
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center shadow-sm">
                  <FileType className="text-indigo-500" size={32} />
                </div>
                <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center shadow-sm">
                  <FileText className="text-orange-500" size={32} />
                </div>
              </div>
              
              <p className="font-semibold text-gray-900 mb-6 text-lg">支持 (.doc/.docx/.pdf) 格式招标文件</p>
              
              <button className="bg-[#8B5CF6] hover:bg-[#7C3AED] text-white px-10 py-3.5 rounded-full font-bold shadow-lg shadow-purple-200 transition-all hover:scale-105 pointer-events-none">
                点击上传招标文件
              </button>
              
              <input
                id="main-upload-input"
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                  if (e.target) e.target.value = ''; // 清空，允许重复选
                }}
              />
            </div>
          ) : (
            /* 上传中状态 */
            <div className="border-2 border-dashed border-indigo-200 bg-indigo-50/30 rounded-2xl p-16 flex flex-col items-center justify-center">
              <Loader2 size={48} className="text-[#8B5CF6] animate-spin mb-6" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">正在进行深度解析...</h3>
              <p className="text-gray-500 mb-8 text-sm">AI 正在通读数十页文档，这可能需要约 1-2 分钟</p>
              <div className="w-full max-w-md">
                <Progress percent={uploadProgress} strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }} status="active" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右侧：模拟报告预览UI (对标图1右侧装饰) */}
      <div className="hidden lg:flex w-full max-w-sm flex-col pointer-events-none select-none opacity-90 transform hover:scale-105 transition-transform duration-700">
        <p className="text-right text-sm text-gray-500 mb-4 font-medium tracking-wide">生成报告示意<br/><span className="text-xs text-gray-400">解析完成后，您将获得以下结构的高质量报告</span></p>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden flex flex-col h-[500px]">
          {/* 模拟苹果窗口顶部 */}
          <div className="h-8 bg-gray-50 border-b border-gray-100 flex items-center px-4 space-x-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
          </div>
          {/* 假数据骨架屏 */}
          <div className="p-6 space-y-6 flex-1 bg-gradient-to-b from-white to-gray-50/50">
            <div className="space-y-2">
              <div className="flex items-center text-indigo-600 font-bold text-sm"><CheckCircle size={14} className="mr-1"/> 资质与风险提取</div>
              <div className="flex space-x-2">
                <div className="flex-1 bg-indigo-50 rounded-lg p-3 border border-indigo-100"><div className="text-xs text-gray-500 mb-1">资质硬性门槛</div><div className="font-bold text-indigo-700">5 项</div></div>
                <div className="flex-1 bg-red-50 rounded-lg p-3 border border-red-100"><div className="text-xs text-gray-500 mb-1">废标负面清单</div><div className="font-bold text-red-600">3 条</div></div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center text-purple-600 font-bold text-sm"><CheckCircle size={14} className="mr-1"/> 得分最大化策略</div>
              <div className="h-4 bg-gray-200 rounded-full w-full overflow-hidden"><div className="w-[46%] h-full bg-purple-500"></div></div>
              <div className="h-8 bg-yellow-50 rounded text-xs text-yellow-700 flex items-center px-3 border border-yellow-100">✨ 建议突出自研技术优势 (+3分)</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default BidAnalysis;