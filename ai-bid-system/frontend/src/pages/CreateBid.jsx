import React, { useState, useEffect } from 'react';
import { Button, Input, message, Spin, Modal, Tag, Empty } from 'antd';
import { 
  UploadCloud, ArrowLeft, Download, Search, 
  ChevronRight, Edit3, ListTree, Database, Building2 
} from 'lucide-react';
// ⚠️ 关键引入
import { generateBidContent } from '../utils/difyWorkflow';
import { supabase } from '../lib/supabase'; // 确保路径正确

export default function CreateBid() {
  // 核心步骤状态：'upload' -> 'outline' -> 'generating' -> 'document'
  const [step, setStep] = useState('upload');
  
  // ==================== 状态：大纲审查台 ====================
  const [activeNodeId, setActiveNodeId] = useState(1);
  const [targetCompany, setTargetCompany] = useState('');
  
  // --- 新增：公司仓库弹窗状态 ---
  const [isCompanyModalVisible, setIsCompanyModalVisible] = useState(false);
  const [companyList, setCompanyList] = useState([]);
  const [fetchingCompanies, setFetchingCompanies] = useState(false);
  
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
  const [directory, setDirectory] = useState([
    {
      id: '1', title: '第一章 应急响应措施', isOpen: true,
      children: [
        { id: '1-1', title: '第一节 应急响应组织架构与职责...' },
        { id: '1-2', title: '第二节 应急事件分类与响应流程' }
      ]
    }
  ]);

  // ==================== 逻辑方法 ====================

  // 🏛️ 自动获取库中所有不重复的公司分类
  // 🏛️ 自动获取库中所有不重复的公司分类 (适配你的真实表名)
  const fetchCompanyList = async () => {
    try {
      setFetchingCompanies(true);
      
      // 1. 从你的 document_categories 和 image_categories 表里取数据
      // 注意：这里我们取的是 'name' 这一列
      const [docRes, imgRes] = await Promise.all([
        supabase.from('document_categories').select('name'),
        supabase.from('image_categories').select('name')
      ]);
      
      // 调试：看看有没有拿到数据
      console.log("文档库分类:", docRes.data);
      console.log("图片库分类:", imgRes.data);

      const allCategories = [
        ...(docRes.data || []).map(i => i.name),
        ...(imgRes.data || []).map(i => i.name)
      ];
      
      // 去重并过滤空值
      const uniqueNames = [...new Set(allCategories.filter(name => name && name.trim() !== ''))];
      
      setCompanyList(uniqueNames);
    } catch (error) {
      console.error("无法获取公司列表:", error);
      message.error("获取公司仓库失败");
    } finally {
      setFetchingCompanies(false);
    }
  };

  const handleOpenCompanyModal = () => {
    setIsCompanyModalVisible(true);
    fetchCompanyList();
  };

  const handleGenerateDocument = async () => {
    if (!targetCompany.trim()) {
      return message.warning('老板，请先输入或选择本次投标的主体公司！');
    }

    setStep('generating');
    try {
      const promptText = `
【重要前提指令】：你现在的身份是【${targetCompany}】的资深投标代表。
请你务必、严格地只使用内部知识库中与【${targetCompany}】相关的历史资质、项目经验和公司信息。

以下是本次投标响应大纲及具体编写要求：
${outline.map(node => `\n### 章节：【${node.title}】\n具体要求：${node.detail}`).join('\n')}
`;
      const generatedText = await generateBidContent(promptText);
      setDocumentContent(generatedText);
      message.success('标书生成完毕！已根据知识库为您精准响应。');
      setStep('document');
    } catch (error) {
      message.error(`生成失败: ${error.message}`);
      setStep('outline');
    }
  };

  const toggleDir = (id) => {
    setDirectory(directory.map(dir => dir.id === id ? { ...dir, isOpen: !dir.isOpen } : dir));
  };

  // ==================== 渲染逻辑 ====================

  // 视图 1: 上传页
  if (step === 'upload') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50 p-8">
        <div 
          onClick={() => setStep('outline')}
          className="border-4 border-dashed border-gray-300 hover:border-indigo-400 rounded-3xl p-20 bg-white cursor-pointer flex flex-col items-center group transition-all"
        >
          <UploadCloud size={80} className="text-gray-400 group-hover:text-indigo-500 mb-6" />
          <h3 className="text-2xl font-bold text-gray-800">上传招标文件，解析得分大纲</h3>
        </div>
      </div>
    );
  }

  // 视图 2: 生成中
  if (step === 'generating') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-white">
        <Spin size="large" />
        <h2 className="text-xl font-bold mt-8">🧠 正在连接【{targetCompany}】私有知识库...</h2>
        <p className="text-gray-400 mt-2">DeepSeek 正在为您逐条匹配历史业绩与方案</p>
      </div>
    );
  }

  // 视图 3: 最终文档
  if (step === 'document') {
    return (
      <div className="h-screen flex flex-col bg-[#F8F9FA]">
        <div className="h-14 bg-white border-b flex items-center justify-between px-6">
          <Button type="text" icon={<ArrowLeft size={18} />} onClick={() => setStep('outline')}>返回大纲</Button>
          <Button type="primary" className="bg-indigo-600 rounded-full">下载 Word</Button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 border-r bg-white p-4">
            <p className="font-bold mb-4">目录结构</p>
            {directory.map(d => <div key={d.id} className="text-sm py-1">{d.title}</div>)}
          </div>
          <div className="flex-1 p-8 bg-gray-100 overflow-y-auto flex justify-center">
            <textarea 
              className="w-[800px] h-full bg-white p-12 shadow-sm outline-none font-serif leading-loose"
              value={documentContent}
              onChange={(e) => setDocumentContent(e.target.value)}
            />
          </div>
        </div>
      </div>
    );
  }

  // 视图 4: 大纲审查台
  const activeNode = outline.find(node => node.id === activeNodeId) || outline[0];
  return (
    <div className="h-screen flex flex-col bg-white">
      <div className="h-14 border-b flex items-center justify-between px-6">
        <h1 className="text-lg font-bold">标书大纲审查台</h1>
        <Button onClick={() => setStep('upload')}>重新上传</Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左: 原文 */}
        <div className="w-1/3 border-r p-6 overflow-y-auto bg-gray-50/30">
          <Tag color="purple" className="mb-4">📄 招标原文</Tag>
          <div className="text-sm leading-relaxed whitespace-pre-line text-gray-600">{originalText}</div>
        </div>

        {/* 中: 得分项 */}
        <div className="w-72 border-r bg-gray-50 flex flex-col">
          <div className="p-4 border-b font-bold bg-white">🎯 响应得分项</div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {outline.map(node => (
              <div 
                key={node.id}
                onClick={() => setActiveNodeId(node.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  activeNodeId === node.id ? 'bg-orange-50 border-orange-300 shadow-sm' : 'bg-white border-gray-100'
                }`}
              >
                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                  <span>{node.category}</span>
                  <span className="font-bold text-orange-500">{node.score}</span>
                </div>
                <div className="text-sm font-medium">{node.title}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 右: 大纲细节 */}
        <div className="flex-1 flex flex-col">
          <div className="p-8 pb-4">
            <h2 className="text-xl font-bold">{activeNode.title}</h2>
            <p className="text-xs text-gray-400 mt-1">请审查并微调 AI 拟定的响应逻辑</p>
          </div>
          <div className="flex-1 p-8">
            <textarea 
              className="w-full h-full p-6 bg-gray-50 rounded-xl border-none outline-none text-sm leading-loose"
              value={activeNode.detail}
              onChange={(e) => {
                setOutline(outline.map(n => n.id === activeNodeId ? { ...n, detail: e.target.value } : n));
              }}
            />
          </div>

          {/* 💡 底部操作区：整合后的公司选择逻辑 */}
          <div className="h-24 border-t bg-white flex items-center justify-end px-8 shadow-2xl">
            <div className="flex flex-col items-end mr-8">
              <div className="flex items-center">
                <span className="text-sm font-bold text-gray-600 mr-3">投标主体公司：</span>
                <div className="flex items-center shadow-sm rounded-lg overflow-hidden border border-indigo-200">
                  <Input 
                    placeholder="请输入或选择公司" 
                    value={targetCompany}
                    onChange={(e) => setTargetCompany(e.target.value)}
                    className="w-56 border-none h-10 focus:ring-0"
                  />
                  <Button 
                    type="text" 
                    icon={<Database size={16} />}
                    onClick={handleOpenCompanyModal}
                    className="bg-indigo-50 text-indigo-600 h-10 px-4 rounded-none hover:bg-indigo-100 border-l border-indigo-100"
                  >
                    从库中选
                  </Button>
                </div>
              </div>
              <div className="text-[10px] text-gray-400 mt-1 flex items-center">
                <Building2 size={10} className="mr-1"/> 
                AI 将精准检索此公司名下的知识库和图片资产
              </div>
            </div>

            <Button
              type="primary"
              onClick={handleGenerateDocument}
              className="h-12 px-10 bg-indigo-600 hover:bg-indigo-700 rounded-full font-bold text-lg shadow-xl shadow-indigo-100"
            >
              生成标书正文
            </Button>
          </div>
        </div>
      </div>

      {/* 🏢 公司选择弹窗 */}
      <Modal
        title={
          <div className="flex items-center space-x-2 pb-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Building2 size={18} className="text-indigo-600" />
            </div>
            <span className="text-lg">选择投标主体</span>
          </div>
        }
        open={isCompanyModalVisible}
        onCancel={() => setIsCompanyModalVisible(false)}
        footer={null}
        centered
        width={540}
        styles={{ body: { padding: '24px' } }}
      >
        {fetchingCompanies ? (
          <div className="flex flex-col items-center py-12">
            <Spin />
            <span className="mt-4 text-gray-400">正在检索您的数字资产库...</span>
          </div>
        ) : companyList.length === 0 ? (
          <Empty description="您的仓库中暂无公司分类" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {companyList.map((name) => (
              <div
                key={name}
                onClick={() => {
                  setTargetCompany(name);
                  setIsCompanyModalVisible(false);
                  message.success(`已切换投标主体为：${name}`);
                }}
                className="p-4 border border-gray-100 rounded-2xl hover:bg-indigo-50 hover:border-indigo-300 cursor-pointer transition-all flex items-center space-x-3 group"
              >
                <div className="w-10 h-10 bg-gray-50 group-hover:bg-white rounded-xl flex items-center justify-center text-lg">🏢</div>
                <div className="flex-1 truncate font-bold text-gray-700 group-hover:text-indigo-600">{name}</div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}