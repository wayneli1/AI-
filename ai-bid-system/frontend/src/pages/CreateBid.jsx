import React, { useState } from 'react';
import { Button, Input, message, Spin } from 'antd';
import { UploadCloud, ArrowLeft, Download, Search, ChevronRight, Edit3, ListTree } from 'lucide-react';
// ⚠️ 极其关键：引入我们写好的 Dify 呼叫对讲机
import { generateBidContent } from '../utils/difyWorkflow';

export default function CreateBid() {
  // 核心步骤状态：'upload' -> 'outline' -> 'generating' -> 'document'
  const [step, setStep] = useState('upload');
  
  // ==================== 状态：大纲审查台 ====================
  const [activeNodeId, setActiveNodeId] = useState(1);
  // 💡 新增状态：本次投标的目标公司名称
  const [targetCompany, setTargetCompany] = useState('');
  
  const originalText = `招标文件\n\n项目名称：山东第一医科大学第一附属医院邮件系统运维项目\n\n1.5 技术评分标准\n1. 应急响应措施（30分）\n2. 维保服务方案（25分）\n3. 本项目重点、难点（20分）\n4. 人员配置（15分）\n\n1.6 废标条款\n未实质性响应招标要求将作废标处理。`;
  
  const [outline, setOutline] = useState([
    { id: 1, category: '投标方案', score: '30分', theme: 'orange', title: '应急响应措施', detail: '本章节需包含：\n1. 应急响应组织架构与职责分工\n2. 应急事件分类与响应流程\n3. 全院级故障应急响应措施\n4. 普通故障应急响应措施\n\nAI 将根据以上要求，结合招标文件为您生成详细的响应预案。' },
    { id: 2, category: '投标方案', score: '25分', theme: 'orange', title: '维保服务方案', detail: '本章节需包含：\n1. 维保服务总体概述\n2. 驻场服务方案\n3. 巡检服务方案\n4. 安全服务方案\n\nAI 将自动匹配我司《标准运维服务SOP》进行响应。' },
    { id: 3, category: '投标方案', score: '20分', theme: 'orange', title: '本项目重点、难点及解决方案', detail: '本章节需包含：\n1. 项目重点分析\n2. 项目难点分析\n3. 针对性解决方案' },
    { id: 4, category: '投标方案', score: '15分', theme: 'orange', title: '人员配置', detail: '本章节需包含：\n1. 维护人员岗位设置\n2. 人员配备清单\n3. 持证上岗情况' },
  ]);

  // ==================== 状态：最终文档编辑器 ====================
  const [activeChapterId, setActiveChapterId] = useState('1-1');
  const [documentContent, setDocumentContent] = useState('');

  // 模拟目录树结构
  const [directory, setDirectory] = useState([
    {
      id: '1', title: '第一章 应急响应措施', isOpen: true,
      children: [
        { id: '1-1', title: '第一节 应急响应组织架构与职责...' },
        { id: '1-2', title: '第二节 应急事件分类与响应流程' },
        { id: '1-3', title: '第三节 全院级故障应急响应措施' },
        { id: '1-4', title: '第四节 普通故障应急响应措施' }
      ]
    },
    {
      id: '2', title: '第二章 维保服务方案', isOpen: false,
      children: [
        { id: '2-1', title: '第一节 维保服务总体概述' },
        { id: '2-2', title: '第二节 驻场服务方案' }
      ]
    }
  ]);

  // ==================== 操作方法 ====================
  
  // 🚀 核心逻辑：真实调用 Dify 引擎生成标书
  const handleGenerateDocument = async () => {
    if (!targetCompany.trim()) {
      return message.warning('老板，请先在下方输入本次投标的主体公司名称！');
    }

    setStep('generating');
    try {
      // 1. 拼接霸气的“锁死”指令
      const promptText = `
【重要前提指令】：你现在的身份是【${targetCompany}】的资深投标代表。
请你务必、严格地只使用内部知识库中与【${targetCompany}】相关的历史资质、项目经验和公司信息。如果知识库检索到了其他无关公司的信息，请绝对忽略！

以下是本次投标响应大纲及具体编写要求，请逐条扩写为专业的标书正文：
${outline.map(node => `\n### 章节：【${node.title}】\n具体要求：${node.detail}`).join('\n')}
`;
      
      console.log("🚀 正在呼叫 Dify 大脑，发送指令：", promptText);
      
      // 2. 真实请求我们在 difyWorkflow.js 里写的接口
      const generatedText = await generateBidContent(promptText);
      
      // 3. 把大模型写出来的东西塞进 A4 纸
      setDocumentContent(generatedText);
      
      message.success('标书生成完毕！已根据知识库为您精准填报。');
      setStep('document');
      
    } catch (error) {
      console.error('生成标书失败:', error);
      message.error(`生成失败: ${error.message}，请检查 Dify 工作流配置`);
      setStep('outline'); // 失败了就退回来
    }
  };

  const toggleDir = (id) => {
    setDirectory(directory.map(dir => dir.id === id ? { ...dir, isOpen: !dir.isOpen } : dir));
  };

  // ==================== 视图 1：上传页 ====================
  if (step === 'upload') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">智能标书生成工作台</h1>
          <p className="text-gray-600 text-lg">上传招标文件，开启三栏智能分析体验</p>
        </div>
        <div className="relative w-full max-w-4xl">
          <div 
            onClick={() => { message.success('解析成功！'); setStep('outline'); }}
            className="border-4 border-dashed border-gray-300 hover:border-indigo-400 rounded-3xl p-20 bg-white/80 hover:bg-indigo-50/30 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center group"
          >
            <UploadCloud size={100} className="text-gray-400 group-hover:text-indigo-500 mb-10" />
            <h3 className="text-3xl font-bold text-gray-900 mb-6 group-hover:text-indigo-700">
              拖拽《招标文件》至此，开启分析台
            </h3>
            <p className="text-gray-500 text-center text-lg max-w-2xl">
              AI 将自动解析评分标准、废标条款，并为您构建响应大纲
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 视图 2：加载中（生成动画） ====================
  if (step === 'generating') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white">
        <Spin size="large" />
        <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-2">🧠 正在连接企业知识库...</h2>
        <p className="text-gray-500">DeepSeek 正在根据【{targetCompany}】的专属资料，逐条响应评分项，预计需要数十秒</p>
      </div>
    );
  }

  // ==================== 视图 3：最终文档编辑器 (对标你的图2) ====================
  if (step === 'document') {
    return (
      <div className="h-screen flex flex-col bg-[#F8F9FA]">
        {/* 顶部工具栏 */}
        <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center">
            <Button type="text" icon={<ArrowLeft size={18} />} onClick={() => setStep('outline')} className="mr-2 text-indigo-600 font-medium">
              返回大纲
            </Button>
            <h1 className="text-base font-bold text-gray-900">山东第一医科大学第一附属医院邮件系统运维项目</h1>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <Button type="primary" className="bg-indigo-500 hover:bg-indigo-600 rounded-full px-6 border-0">下载为 Word</Button>
          </div>
        </div>

        {/* 主体两栏布局 */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左侧：全局目录 (TOC) */}
          <div className="w-[280px] bg-[#F8F9FA] border-r border-gray-200 flex flex-col shrink-0">
            <div className="p-4 flex items-center justify-between">
              <span className="font-bold text-gray-800 text-base">目录</span>
              <Button size="small" className="text-indigo-500 border-indigo-200 bg-indigo-50 flex items-center text-xs rounded">
                <Edit3 size={12} className="mr-1"/> 编辑目录
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {directory.map(dir => (
                <div key={dir.id} className="mb-1">
                  <div 
                    onClick={() => toggleDir(dir.id)}
                    className="flex items-center px-2 py-2 hover:bg-gray-100 rounded cursor-pointer text-sm font-medium text-gray-800"
                  >
                    <ChevronRight size={14} className={`mr-1 text-gray-400 transition-transform ${dir.isOpen ? 'rotate-90' : ''}`} />
                    {dir.title}
                  </div>
                  {dir.isOpen && (
                    <div className="ml-6 mt-1 space-y-1">
                      {dir.children.map(child => (
                        <div 
                          key={child.id}
                          onClick={() => setActiveChapterId(child.id)}
                          className={`flex items-center justify-between px-3 py-1.5 rounded cursor-pointer text-xs ${
                            activeChapterId === child.id ? 'bg-indigo-100/50 text-indigo-600 font-medium' : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <span className="truncate pr-2">{child.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 右侧：A4 纸编辑器 */}
          <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-[#F2F3F5]">
            <div className="w-[800px] bg-white shadow-sm border border-gray-200 min-h-[1000px] flex flex-col">
              {/* 富文本编辑区：暂时用 textarea 承接 AI 吐出的 Markdown 代码 */}
              <textarea
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                className="flex-1 w-full p-12 resize-none outline-none text-gray-800 leading-loose text-[15px] font-mono"
                placeholder="AI 正在赶来填满这张纸..."
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 视图 4：大纲审查台 (对标你的图1) ====================
  const activeNode = outline.find(node => node.id === activeNodeId) || outline[0];
  return (
    <div className="h-screen flex flex-col bg-white">
      {/* 顶部导航 */}
      <div className="h-14 border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
        <h1 className="text-xl font-bold text-gray-900">标书大纲审查台</h1>
        <div className="flex space-x-3">
          <Button onClick={() => setStep('upload')}>重新上传</Button>
        </div>
      </div>

      {/* 三栏工作区 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：原文 */}
        <div className="w-1/3 border-r border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center bg-purple-50/30">
            <span className="font-bold text-purple-700">📄 招标原文</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6 bg-white">
            <div className="text-gray-700 leading-loose whitespace-pre-line text-sm font-serif">
              {originalText}
            </div>
          </div>
        </div>

        {/* 中间：得分卡导航 */}
        <div className="w-[300px] border-r border-gray-200 bg-gray-50 flex flex-col relative">
          <div className="p-4 border-b border-gray-200 bg-white sticky top-0 z-20 flex justify-between">
            <span className="font-bold text-gray-900">🎯 响应得分项</span>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">共 {outline.length} 项</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 relative">
            <div className="absolute right-[11px] top-4 bottom-4 w-px bg-gray-200 z-0"></div>
            {outline.map((node) => {
              const isActive = activeNodeId === node.id;
              let colorStyles = { border: '', bg: '', text: '', dot: '' };
              if (node.theme === 'orange') colorStyles = { border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-600', dot: 'bg-orange-400' };
              else if (node.theme === 'purple') colorStyles = { border: 'border-purple-300', bg: 'bg-purple-50', text: 'text-purple-600', dot: 'bg-purple-400' };
              return (
                <div
                  key={node.id}
                  onClick={() => setActiveNodeId(node.id)}
                  className={`relative p-3 rounded-md cursor-pointer transition-all border mr-3 z-10 ${
                    isActive ? `${colorStyles.bg} ${colorStyles.border} shadow-sm ring-1 ring-inset ${colorStyles.border.replace('border-', 'ring-')}` : `bg-white border-gray-200 hover:border-gray-300`
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-500">{node.category}</span>
                    <span className={`text-xs font-bold ${isActive ? colorStyles.text : 'text-gray-500'}`}>{node.score}</span>
                  </div>
                  <div className={`text-sm ${isActive ? 'text-gray-900 font-bold' : 'text-gray-700 font-medium'}`}>{node.title}</div>
                  <div className={`absolute -right-[16px] top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full border-[1.5px] border-white ${colorStyles.dot} ${isActive ? 'scale-125 ring-2 ring-white' : ''}`}></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右侧：大纲细节确认 */}
        <div className="flex-1 bg-white flex flex-col relative">
          <div className="p-8 pb-4 border-b border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900">{activeNode.title}</h2>
            <p className="text-gray-500 mt-2 text-sm">审查 AI 提取的编写大纲与得分要求</p>
          </div>
          <div className="flex-1 overflow-y-auto p-8">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4 flex items-center"><ListTree size={16} className="mr-2"/> 拟定大纲及要求</h3>
              <textarea
                value={activeNode.detail}
                onChange={(e) => {
                  setOutline(outline.map(n => n.id === activeNodeId ? { ...n, detail: e.target.value } : n));
                }}
                className="w-full h-[400px] bg-transparent resize-none outline-none text-gray-700 leading-loose text-sm font-medium"
              />
            </div>
          </div>
          
          {/* 💡 底部操作区：新增了公司输入框和生成按钮 */}
          <div className="h-20 border-t border-gray-100 bg-white flex items-center justify-end px-8 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
            <div className="flex items-center mr-6">
              <span className="text-sm text-gray-700 font-bold mr-3">本次投标主体：</span>
              <Input 
                placeholder="请输入您要代表的公司名称" 
                value={targetCompany}
                onChange={(e) => setTargetCompany(e.target.value)}
                className="w-64 rounded-lg h-10 border-indigo-200 focus:border-indigo-500"
              />
            </div>
            <Button
              type="primary"
              onClick={handleGenerateDocument}
              className="h-12 px-10 bg-[#6344FF] hover:bg-[#5233E8] border-0 rounded-full text-lg font-bold shadow-lg shadow-indigo-200 transition-transform hover:scale-105"
            >
              确认完毕，生成标书正文
            </Button>
          </div>
          
        </div>
      </div>
    </div>
  );
}