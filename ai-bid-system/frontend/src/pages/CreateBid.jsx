import React, { useState } from 'react';
import { Button, Input, message, Spin } from 'antd';
import { UploadCloud, ArrowLeft, Save, Download, Search, Wand2, ChevronRight, FileText, Lock, Unlock, Edit3, ListTree } from 'lucide-react';
export default function CreateBid() {
  // 核心步骤状态：'upload' -> 'outline' -> 'generating' -> 'document'
  const [step, setStep] = useState('upload');
  
  // ==================== 状态：大纲审查台 ====================
  const [activeNodeId, setActiveNodeId] = useState(1);
  const originalText = `招标文件\n\n项目名称：山东第一医科大学第一附属医院邮件系统运维项目\n\n1.5 技术评分标准\n1. 应急响应措施（30分）\n2. 维保服务方案（25分）\n3. 本项目重点、难点（20分）\n4. 人员配置（15分）\n\n1.6 废标条款\n未实质性响应招标要求将作废标处理。`;
  
  const [outline, setOutline] = useState([
    { id: 1, category: '投标方案', score: '30分', theme: 'orange', title: '应急响应措施', detail: '本章节需包含：\n1. 应急响应组织架构与职责分工\n2. 应急事件分类与响应流程\n3. 全院级故障应急响应措施\n4. 普通故障应急响应措施\n\nAI 将根据以上要求，结合招标文件为您生成详细的响应预案。' },
    { id: 2, category: '投标方案', score: '25分', theme: 'orange', title: '维保服务方案', detail: '本章节需包含：\n1. 维保服务总体概述\n2. 驻场服务方案\n3. 巡检服务方案\n4. 安全服务方案\n\nAI 将自动匹配我司《标准运维服务SOP》进行响应。' },
    { id: 3, category: '投标方案', score: '20分', theme: 'orange', title: '本项目重点、难点及解决方案', detail: '本章节需包含：\n1. 项目重点分析\n2. 项目难点分析\n3. 针对性解决方案' },
    { id: 4, category: '投标方案', score: '15分', theme: 'orange', title: '人员配置', detail: '本章节需包含：\n1. 维护人员岗位设置\n2. 人员配备清单\n3. 持证上岗情况' },
  ]);

  // ==================== 状态：最终文档编辑器 ====================
  const [activeChapterId, setActiveChapterId] = useState('1-1');
  const [documentContent, setDocumentContent] = useState(`第一章 应急响应措施

第一节 应急响应组织架构与职责分工

一、应急响应组织架构设计

1. 应急响应组织架构设计目标
本项目应急响应组织架构的设计目标是确保系统故障能够半小时内响应、2小时内上门，普通故障4小时内解决。同时，架构需覆盖邮件系统功能部署、Bug修复、扩容、维护以及安全防护等各类服务需求，保障内外收发顺畅且延迟不超过30分钟，满足采购人的严密评审要求。

针对上述目标，应急响应组织架构将采用分层管理模式，明确各层级责任及协作机制，确保信息传递高效且责任分明。

2. 岗位设置方案
根据项目的具体需求和实施特点，应急响应组织架构中包含以下关键岗位：
(1) 技术支持工程师：负责邮件系统故障响应、日常运维及问题排查等技术支持工作；
(2) 系统运维工程师：承担邮件系统部署、配置、扩容及性能优化等工作；
(3) 安全运维工程师：专注于邮件系统的安全防护、漏洞修复及安全事件处理；`);

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
  const handleGenerateDocument = () => {
    setStep('generating');
    setTimeout(() => {
      message.success('标书生成完毕！共计 320 页，已自动排版。');
      setStep('document');
    }, 3000); // 模拟3秒的AI生成过程
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
        <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-2">正在全力撰写标书正文...</h2>
        <p className="text-gray-500">AI 正在根据 12 个评分项为您逐条响应，预计需要 1-2 分钟</p>
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
              返回
            </Button>
            <h1 className="text-base font-bold text-gray-900">山东第一医科大学第一附属医院邮件系统运维项目</h1>
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-600">
            <Button type="primary" className="bg-indigo-500 hover:bg-indigo-600 rounded-full px-6 border-0">下载</Button>
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
              
              
              {/* 富文本编辑区 */}
              <textarea
                value={documentContent}
                onChange={(e) => setDocumentContent(e.target.value)}
                className="flex-1 w-full p-12 resize-none outline-none text-gray-800 leading-loose text-[15px] font-serif"
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
          {/* 底部巨大的紫蓝色生成按钮 */}
          <div className="h-20 border-t border-gray-100 bg-white flex items-center justify-end px-8 shadow-[0_-10px_30px_rgba(0,0,0,0.02)]">
            <span className="text-sm text-gray-500 mr-6">请确认所有响应大纲无误后，点击生成最终正文</span>
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