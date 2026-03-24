import React, { useState, useRef } from 'react';
import { Button, Input, message, Spin, Modal, Tag, Empty } from 'antd';
import { 
  UploadCloud, ArrowLeft, Download, Search, 
  ChevronRight, Edit3, ListTree, Database, Building2, Eye, PenTool, FileText, CheckCircle2
} from 'lucide-react';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// 💡 引入了双引擎！
import { generateBidContent, generateBidOutline } from '../utils/difyWorkflow';
import { supabase } from '../lib/supabase'; 
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromDocument } from '../utils/documentParser';

export default function CreateBid() {
  const { user } = useAuth();
  
  const [step, setStep] = useState('upload');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const fileInputRef = useRef(null);

  // ==================== 状态：大纲审查台 ====================
  const [originalText, setOriginalText] = useState('');
  const [activeNodeId, setActiveNodeId] = useState(null); // 初始为空
  const [targetCompany, setTargetCompany] = useState('');
  const [isCompanyModalVisible, setIsCompanyModalVisible] = useState(false);
  const [companyList, setCompanyList] = useState([]);
  const [fetchingCompanies, setFetchingCompanies] = useState(false);
  
  // 结构化大纲状态
  const [outline, setOutline] = useState([]);

  // ==================== 状态：最终文档编辑器 ====================
  const [documentContent, setDocumentContent] = useState('');
  const [viewMode, setViewMode] = useState('preview'); 

  // ==================== 逻辑方法 ====================

  // 🚀 1. 真实上传、提取文本、并调用 AI 生成结构化大纲
  const handleRealUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return message.error("请先登录！");

    try {
      message.loading({ content: '正在上传文件并召唤 AI 提取大纲，请耐心等待（约需十几秒）...', key: 'upload', duration: 0 });
      
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${fileExtension}`;
      const filePath = `${user.id}/${safeFileName}`;

      // a. 上传源文件
      await supabase.storage.from('documents').upload(filePath, file);
      const fileUrl = `${supabase.supabaseUrl}/storage/v1/object/documents/${filePath}`;

      // b. 提取文本内容展示在左侧
      const extractedText = await extractTextFromDocument(file);
      setOriginalText(extractedText || `无法读取文件文字，仅支持可提取文本的 PDF/Word。\n文件名：${file.name}`);

      // 💡 c. 核心突破！呼叫 引擎 1，提取真正的 AI 大纲！
      let dynamicOutline = [];
      try {
        // 截取前 20000 字防止超出模型限制（标书一般前面是要求）
        const textForAi = extractedText ? extractedText.substring(0, 20000) : file.name; 
        dynamicOutline = await generateBidOutline(textForAi);
      } catch (aiError) {
        console.error("AI 提取大纲失败:", aiError);
        message.warning({ content: 'AI 解析大纲失败，已启用备用模板，请手动修改。', key: 'upload', duration: 3 });
        // 如果 AI 报错或超时，给一个保底的空骨架，防止页面崩溃
        dynamicOutline = [
          { id: 1, title: '第一章 项目需求响应', detail: `请根据上传的【${file.name}】手动输入需响应的详细要点...` }
        ];
      }

      setOutline(dynamicOutline);
      setActiveNodeId(dynamicOutline[0]?.id); // 默认选中第一项

      // d. 创建数据库记录
      const { data: project, error } = await supabase
        .from('bidding_projects')
        .insert({
          user_id: user.id,
          project_name: file.name.replace(/\.[^/.]+$/, ''),
          file_url: fileUrl,
          framework_content: JSON.stringify(dynamicOutline),
          status: 'processing'
        })
        .select()
        .single();

      if (error) throw error;
      setCurrentProjectId(project.id);

      message.success({ content: 'AI 解析完毕！大纲已为您自动提取，请审查。', key: 'upload' });
      setStep('outline');

    } catch (error) {
      console.error('上传解析失败:', error);
      message.error({ content: '流程中断: ' + error.message, key: 'upload' });
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  // 🏛️ 获取公司列表弹窗用
  const fetchCompanyList = async () => {
    try {
      setFetchingCompanies(true);
      const [docRes, imgRes] = await Promise.all([
        supabase.from('document_categories').select('name'),
        supabase.from('image_categories').select('name')
      ]);
      const allCategories = [...(docRes.data || []).map(i => i.name), ...(imgRes.data || []).map(i => i.name)];
      setCompanyList([...new Set(allCategories.filter(name => name && name.trim() !== ''))]);
    } catch (error) {} finally { setFetchingCompanies(false); }
  };

  const handleOpenCompanyModal = () => {
    setIsCompanyModalVisible(true);
    fetchCompanyList();
  };

  // 🚀 2. 确认大纲并调用 AI 生成标书正文
  const handleGenerateDocument = async () => {
    if (!targetCompany.trim()) return message.warning('请先输入或选择本次投标的主体公司！');

    setStep('generating');
    try {
      if (currentProjectId) {
        await supabase
          .from('bidding_projects')
          .update({ framework_content: JSON.stringify(outline) })
          .eq('id', currentProjectId);
      }

      const promptText = `
【重要前提指令】：你现在的身份是【${targetCompany}】的资深投标代表。
请你务必、严格地只使用内部知识库中与【${targetCompany}】相关的历史资质、项目经验和公司信息。如果在知识库中匹配到了带有Markdown格式的图片链接，请务必直接在正文中输出图片代码。

以下是经过人工最终确认的【标书撰写大纲】及每个章节的具体撰写要求，请你严格按照此大纲逐章输出极具专业度的标书正文：

${outline.map(node => `### 【${node.title}】\n撰写要求：\n${node.detail}\n`).join('\n')}
`;
      
      const generatedText = await generateBidContent(promptText);
      setDocumentContent(generatedText);
      
      if (currentProjectId) {
        await supabase
          .from('bidding_projects')
          .update({ analysis_report: generatedText, status: 'completed' })
          .eq('id', currentProjectId);
      }

      message.success('标书正文生成完毕！已存入“我的标书”。');
      setStep('document');
      setViewMode('preview');
    } catch (error) {
      message.error(`生成失败: ${error.message}`);
      setStep('outline');
    }
  };

  const handleDownloadWord = () => {
    const blob = new Blob([documentContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${targetCompany}_投标方案正文.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success("已导出文档！");
  };

  // ==================== 渲染逻辑 ====================

  if (step === 'upload') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FA] p-8">
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleRealUpload} accept=".pdf,.doc,.docx" />
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl p-24 bg-white shadow-sm cursor-pointer flex flex-col items-center group transition-all"
        >
          <UploadCloud size={64} className="text-indigo-400 group-hover:text-indigo-600 mb-6 transition-transform group-hover:scale-110" />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">上传采购文件，AI 智能提取响应大纲</h3>
          <p className="text-gray-500">支持 PDF、Word 格式，上传后自动进入大纲审查台</p>
        </div>
      </div>
    );
  }

  if (step === 'generating') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FA]">
        <div className="bg-white p-12 rounded-2xl shadow-xl flex flex-col items-center">
          <Spin size="large" />
          <h2 className="text-xl font-bold text-gray-800 mt-6 mb-2">🧠 正在根据大纲撰写标书正文...</h2>
          <p className="text-gray-500">DeepSeek 正在检索【{targetCompany}】的专属资质与历史方案</p>
        </div>
      </div>
    );
  }

  if (step === 'document') {
    return (
      <div className="h-screen flex flex-col bg-[#F2F3F5]">
        <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
          <Button type="text" icon={<ArrowLeft size={18} />} onClick={() => setStep('outline')} className="text-gray-600 hover:text-indigo-600 font-medium">
            返回大纲
          </Button>
          
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setViewMode('preview')} className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'preview' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <Eye size={16} className="mr-2" /> 沉浸预览
            </button>
            <button onClick={() => setViewMode('edit')} className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'edit' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <PenTool size={16} className="mr-2" /> 源码编辑
            </button>
          </div>

          <Button type="primary" icon={<Download size={16}/>} onClick={handleDownloadWord} className="bg-indigo-600 hover:bg-indigo-700 rounded-full px-6 border-0">
            导出文档
          </Button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 bg-white border-r border-gray-200 p-6 overflow-y-auto shrink-0">
            <p className="font-bold text-gray-800 mb-6 flex items-center"><ListTree size={18} className="mr-2 text-indigo-500"/> 方案大纲</p>
            <div className="space-y-4">
              {outline.map(d => (
                <div key={d.id} className="text-sm font-medium text-gray-700 hover:text-indigo-600 cursor-pointer border-l-2 border-transparent hover:border-indigo-500 pl-3 transition-all">
                  {d.title}
                </div>
              ))}
            </div>
          </div>
          
          <div className="flex-1 p-8 overflow-y-auto flex justify-center">
            <div className="w-[850px] bg-white shadow-lg border border-gray-200 min-h-[1050px] p-16 pb-32">
              {viewMode === 'preview' ? (
                <div className="prose prose-indigo prose-lg max-w-none prose-img:rounded-xl prose-img:shadow-md prose-headings:font-bold prose-a:text-indigo-600">
                  {documentContent ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{documentContent}</ReactMarkdown> : <Empty description="暂无生成内容" />}
                </div>
              ) : (
                <textarea 
                  className="w-full h-full min-h-[800px] resize-none outline-none font-mono text-[15px] leading-loose text-gray-700 bg-gray-50 p-6 rounded-xl border border-gray-200 focus:border-indigo-400 focus:bg-white transition-colors"
                  value={documentContent}
                  onChange={(e) => setDocumentContent(e.target.value)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 视图 4: 结构化大纲审查台
  const activeNode = outline.find(node => node.id === activeNodeId) || outline[0] || { title: '', detail: '' };
  
  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA]">
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
        <div className="flex items-center">
          <Tag color="purple" className="mr-3 text-sm py-1 px-3 rounded-full border-0 font-bold">🎯 智能分析完毕</Tag>
          <h1 className="text-lg font-bold text-gray-800">技术/服务方案大纲确认并编辑</h1>
        </div>
        <Button onClick={() => setStep('upload')} className="text-gray-500 border-gray-300 hover:text-indigo-600 hover:border-indigo-400">重新上传</Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左栏: 原文对照 */}
        <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
            <span className="font-bold text-gray-700 flex items-center"><FileText size={16} className="mr-2 text-indigo-500"/> 招标原文提取</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="text-sm leading-loose whitespace-pre-wrap text-gray-600 font-serif">
              {originalText || <div className="text-center text-gray-400 mt-20">原文解析中...</div>}
            </div>
          </div>
        </div>

        {/* 中栏: 大纲目录树 */}
        <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-200 bg-white">
            <span className="font-bold text-gray-800">目录结构</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {outline.map((node, index) => (
              <div 
                key={node.id}
                onClick={() => setActiveNodeId(node.id)}
                className={`p-4 rounded-xl cursor-pointer transition-all border ${
                  activeNodeId === node.id 
                    ? 'bg-white border-indigo-500 shadow-md transform scale-[1.02] relative z-10' 
                    : 'bg-white border-transparent hover:border-indigo-200 text-gray-600 shadow-sm'
                }`}
              >
                <div className="flex items-start">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-3 shrink-0 ${activeNodeId === node.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                    {index + 1}
                  </span>
                  <div className={`text-sm ${activeNodeId === node.id ? 'font-bold text-indigo-900' : 'font-medium text-gray-700'}`}>
                    {node.title}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右栏: 详细撰写要求编辑区 */}
        <div className="flex-1 bg-white flex flex-col relative">
          <div className="p-8 pb-6 border-b border-gray-100 flex justify-between items-start">
            <div>
              <div className="flex items-center mb-2">
                <CheckCircle2 size={20} className="text-green-500 mr-2"/>
                <h2 className="text-2xl font-bold text-gray-900">{activeNode.title}</h2>
              </div>
              <p className="text-gray-500 text-sm">请审查并微调 AI 拟定的本章响应逻辑及撰写要求</p>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 bg-[#F8F9FA]">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center text-gray-600 text-sm font-medium">
                <Edit3 size={16} className="mr-2 text-indigo-500"/>
                本章节 AI 思考框架（可直接修改）
              </div>
              <textarea 
                className="flex-1 w-full p-8 resize-none outline-none text-gray-700 leading-loose text-[15px] focus:bg-indigo-50/10 transition-colors"
                value={activeNode.detail}
                onChange={(e) => {
                  setOutline(outline.map(n => n.id === activeNodeId ? { ...n, detail: e.target.value } : n));
                }}
                placeholder="请输入本章节需要 AI 响应的具体内容和重点..."
              />
            </div>
          </div>

          {/* 底部悬浮操作台 */}
          <div className="h-24 bg-white border-t border-gray-200 flex items-center justify-end px-8 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] shrink-0 relative z-20">
            <div className="flex flex-col items-end mr-8">
              <div className="flex items-center">
                <span className="text-sm font-bold text-gray-700 mr-3">本次投标主体：</span>
                <div className="flex items-center shadow-sm rounded-lg overflow-hidden border border-indigo-200 bg-gray-50">
                  <Input 
                    placeholder="请输入或选择公司名称" 
                    value={targetCompany}
                    onChange={(e) => setTargetCompany(e.target.value)}
                    className="w-56 border-none h-10 bg-transparent focus:ring-0 font-medium text-indigo-900"
                  />
                  <Button 
                    type="text" 
                    icon={<Database size={16} />}
                    onClick={handleOpenCompanyModal}
                    className="bg-indigo-100 text-indigo-700 h-10 px-4 rounded-none hover:bg-indigo-200 border-l border-indigo-200 font-medium transition-colors"
                  >
                    从库中选
                  </Button>
                </div>
              </div>
              <div className="text-[11px] text-gray-400 mt-2 flex items-center">
                <Building2 size={12} className="mr-1 text-indigo-400"/> 
                知识库引擎将只检索与该公司相关的资质和业绩方案
              </div>
            </div>

            <Button
              type="primary"
              onClick={handleGenerateDocument}
              className="h-12 px-10 bg-indigo-600 hover:bg-indigo-700 rounded-full font-bold text-lg shadow-lg shadow-indigo-200 hover:shadow-indigo-300 hover:-translate-y-0.5 transition-all border-0"
            >
              确认大纲，生成正文
            </Button>
          </div>
        </div>
      </div>

      {/* 🏢 公司选择弹窗 */}
      <Modal
        title={<div className="flex items-center space-x-2 pb-2"><div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center"><Building2 size={18} className="text-indigo-600" /></div><span className="text-lg">选择投标主体</span></div>}
        open={isCompanyModalVisible}
        onCancel={() => setIsCompanyModalVisible(false)}
        footer={null}
        centered
        width={540}
        styles={{ body: { padding: '24px' } }}
      >
        {fetchingCompanies ? (
          <div className="flex flex-col items-center py-12"><Spin /><span className="mt-4 text-gray-400">正在检索资产库...</span></div>
        ) : companyList.length === 0 ? (
          <Empty description="您的仓库中暂无公司分类" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {companyList.map((name) => (
              <div
                key={name}
                onClick={() => { setTargetCompany(name); setIsCompanyModalVisible(false); message.success(`已锁定主体：${name}`); }}
                className="p-4 border border-gray-100 rounded-2xl hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition-all flex items-center space-x-3 group"
              >
                <div className="w-10 h-10 bg-gray-50 group-hover:bg-white rounded-xl flex items-center justify-center text-lg shadow-sm">🏢</div>
                <div className="flex-1 truncate font-bold text-gray-700 group-hover:text-indigo-700">{name}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}