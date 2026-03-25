import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, message, Spin, Modal, Tag, Empty, Tree, Progress, Popconfirm } from 'antd';
import { 
  UploadCloud, ArrowLeft, Download, Search, 
  ChevronRight, Edit3, ListTree, Database, Building2, Eye, PenTool, FileText, CheckCircle2,
  Cpu, Plus, Trash2
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { generateBidContent, generateBidOutline } from '../utils/difyWorkflow';
import { supabase } from '../lib/supabase'; 
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromDocument } from '../utils/documentParser';

// ==================== 树结构操作辅助函数 ====================
const getLeafNodes = (nodes) => {
  let leaves = [];
  nodes.forEach(node => {
    if (!node.children || node.children.length === 0) {
      leaves.push(node);
    } else {
      leaves = leaves.concat(getLeafNodes(node.children));
    }
  });
  return leaves;
};

const findNodeById = (nodes, id) => {
  for (let node of nodes) {
    if (node.id === id) return node;
    if (node.children && node.children.length > 0) {
      const found = findNodeById(node.children, id);
      if (found) return found;
    }
  }
  return null;
};

const updateNodeRequirement = (nodes, id, newReq) => {
  return nodes.map(node => {
    if (node.id === id) return { ...node, requirement: newReq };
    if (node.children && node.children.length > 0) return { ...node, children: updateNodeRequirement(node.children, id, newReq) };
    return node;
  });
};

const updateNodeTitle = (nodes, id, newTitle) => {
  return nodes.map(node => {
    if (node.id === id) return { ...node, title: newTitle };
    if (node.children && node.children.length > 0) return { ...node, children: updateNodeTitle(node.children, id, newTitle) };
    return node;
  });
};

const addChildNode = (nodes, parentId) => {
  return nodes.map(node => {
    if (node.id === parentId) {
      const currentChildrenCount = node.children ? node.children.length : 0;
      const newChildId = `${node.id}.${currentChildrenCount + 1}`;
      const newChild = { id: newChildId, title: '新增子章节标题', requirement: '', children: [] };
      return { ...node, children: [...(node.children || []), newChild] };
    }
    if (node.children && node.children.length > 0) {
      return { ...node, children: addChildNode(node.children, parentId) };
    }
    return node;
  });
};

const deleteNode = (nodes, id) => {
  return nodes.filter(node => node.id !== id).map(node => ({
    ...node,
    children: node.children ? deleteNode(node.children, id) : []
  }));
};

// ==================== 主组件 ====================

export default function CreateBid() {
  const { user } = useAuth();
  
  const [searchParams] = useSearchParams();
  const urlProjectId = searchParams.get('id');

  const [step, setStep] = useState('upload');
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const fileInputRef = useRef(null);

  const [fileUrl, setFileUrl] = useState(''); // 💡 新增：专门存文件的下载/预览链接
  const [originalText, setOriginalText] = useState('');
  const [activeNodeId, setActiveNodeId] = useState(null); 
  const [targetCompany, setTargetCompany] = useState('');
  const [isCompanyModalVisible, setIsCompanyModalVisible] = useState(false);
  const [companyList, setCompanyList] = useState([]);
  const [fetchingCompanies, setFetchingCompanies] = useState(false);
  const [outline, setOutline] = useState([]);

  const [documentContent, setDocumentContent] = useState('');
  const [viewMode, setViewMode] = useState('preview'); 
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentGeneratingNode, setCurrentGeneratingNode] = useState('');

  useEffect(() => {
    if (urlProjectId && user) {
      loadExistingProject(urlProjectId);
    }
  }, [urlProjectId, user]);

  const loadExistingProject = async (id) => {
    try {
      message.loading({ content: '正在加载标书...', key: 'load' });
      const { data, error } = await supabase.from('bidding_projects').select('*').eq('id', id).single();
      if (error) throw error;
      if (data) {
        setCurrentProjectId(data.id);
        setFileUrl(data.file_url); // 💡 新增：把数据库里的文件链接存入状态

        if (data.framework_content) {
          try {
            const parsedOutline = JSON.parse(data.framework_content);
            if (Array.isArray(parsedOutline)) {
              setOutline(parsedOutline);
            } else throw new Error("解析出的内容不是数组");
          } catch (parseError) {
            setOutline([{ id: "1", title: '识别错误', requirement: '格式不兼容', children: [] }]);
          }
        }
        if (data.analysis_report && data.status === 'completed') {
          setDocumentContent(data.analysis_report);
          setStep('document'); 
          setViewMode('preview');
        } else if (data.framework_content) {
          setStep('outline'); 
        }
        message.success({ content: '加载成功！', key: 'load' });
      }
    } catch (err) {
      message.error({ content: '读取标书失败', key: 'load' });
    }
  };

  // 🚀 防抖自动保存引擎 (Auto-Save)
  useEffect(() => {
    if (!currentProjectId || outline.length === 0) return;

    const autoSaveToDatabase = async () => {
      try {
        await supabase
          .from('bidding_projects')
          .update({ framework_content: JSON.stringify(outline) })
          .eq('id', currentProjectId);
        console.log('✨ 大纲已自动静默保存');
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    };

    const debounceTimer = setTimeout(() => {
      autoSaveToDatabase();
    }, 1500);

    return () => clearTimeout(debounceTimer);
  }, [outline, currentProjectId]);

  const handleRealUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !user) return message.error("请先登录！");

    try {
      message.loading({ content: '正在智能提取多级大纲...', key: 'upload', duration: 0 });
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${fileExtension}`;
      const filePath = `${user.id}/${safeFileName}`;

      await supabase.storage.from('documents').upload(filePath, file);
      const uploadedFileUrl = `${supabase.supabaseUrl}/storage/v1/object/documents/${filePath}`;
      
      setFileUrl(uploadedFileUrl); // 💡 新增：刚上传完也立刻设置预览链接

      const extractedText = await extractTextFromDocument(file);
      setOriginalText(extractedText || `无法读取文件文字`);

      let dynamicOutline = [];
      try {
        const textForAi = extractedText ? extractedText.substring(0, 20000) : file.name; 
        dynamicOutline = await generateBidOutline(textForAi); 
      } catch (aiError) {
        dynamicOutline = [{ id: "1", title: '第一章 需求响应', requirement: `请手动输入...`, children: [] }];
      }

      setOutline(dynamicOutline);
      setActiveNodeId(dynamicOutline[0]?.id || null);

      const { data: project, error } = await supabase.from('bidding_projects').insert({
          user_id: user.id, project_name: file.name.replace(/\.[^/.]+$/, ''), file_url: uploadedFileUrl, framework_content: JSON.stringify(dynamicOutline), status: 'processing'
      }).select().single();

      if (error) throw error;
      setCurrentProjectId(project.id);
      window.history.replaceState(null, '', `/create-bid?id=${project.id}`);
      message.success({ content: '树状大纲提取完毕！', key: 'upload' });
      setStep('outline');
    } catch (error) {
      message.error({ content: '流程中断: ' + error.message, key: 'upload' });
    } finally {
      if (event.target) event.target.value = '';
    }
  };

  const fetchCompanyList = async () => {
    try {
      setFetchingCompanies(true);
      const [docRes, imgRes] = await Promise.all([
        supabase.from('document_categories').select('name'), supabase.from('image_categories').select('name')
      ]);
      const allCategories = [...(docRes.data || []).map(i => i.name), ...(imgRes.data || []).map(i => i.name)];
      setCompanyList([...new Set(allCategories.filter(name => name && name.trim() !== ''))]);
    } catch (error) {} finally { setFetchingCompanies(false); }
  };

  const handleOpenCompanyModal = () => {
    setIsCompanyModalVisible(true);
    fetchCompanyList();
  };

  const handleGenerateDocument = async () => {
    if (!targetCompany.trim()) return message.warning('请先输入或选择本次投标的主体公司！');
    const leafNodes = getLeafNodes(outline);
    if (leafNodes.length === 0) return message.error('大纲为空，无法生成！');

    setStep('generating');
    setGenerationProgress(0);
    setDocumentContent(''); 
    
    try {
      if (currentProjectId) {
        await supabase.from('bidding_projects').update({ framework_content: JSON.stringify(outline) }).eq('id', currentProjectId);
      }
      let fullGeneratedText = '';
      for (let i = 0; i < leafNodes.length; i++) {
        const node = leafNodes[i];
        setCurrentGeneratingNode(`[${node.id}] ${node.title}`);
        setGenerationProgress(Math.round((i / leafNodes.length) * 100));

        const promptText = `
【重要前提指令】：你现在的身份是【${targetCompany}】的资深投标代表。
【绝对跨界禁区】：如果检索到的内容带有其他具体主体公司的标识（既不是 {{targetCompany}}，也不是 未分类/通用），请立即触发警报并丢弃，**绝不可**将其写入本文！
请严格使用内部知识库中与【${targetCompany}】相关的历史资质、项目经验。若匹配到Markdown图片链接，请务必直接输出图片代码。
【通用白名单】：对于通用的技术方案、培训服务、实施方法论等，如果检索到带有“【所属主体：未分类】”或“【所属主体：通用】”标识的资料，**允许且必须作为通用标准资产使用**！
【当前撰写任务】：
当前章节：### 【${node.id} ${node.title}】
撰写要求：
${node.requirement || '请结合上下文与内部知识库，按照专业公文标准，详细扩充本节的技术/管理方案。'}
请直接输出本节的 Markdown 正文，行文必须高度专业严谨。首行请以该章节的标题开头。`;
        
        const chunkText = await generateBidContent(promptText);
        fullGeneratedText += chunkText + '\n\n';
        setDocumentContent(fullGeneratedText);
      }

      setGenerationProgress(100);
      if (currentProjectId) {
        await supabase.from('bidding_projects').update({ analysis_report: fullGeneratedText, status: 'completed' }).eq('id', currentProjectId);
      }
      message.success('全部分块生成完毕！');
      setStep('document');
      setViewMode('preview');
    } catch (error) {
      message.error(`生成过程中断: ${error.message}`);
      setStep('document'); 
      setViewMode('edit');
    }
  };

  const handleDownloadWord = () => {
    const blob = new Blob([documentContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${targetCompany || '标书方案'}_正文.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    message.success("已导出文档！");
  };

  const mapOutlineToTreeData = (nodes) => {
    return nodes.map(node => ({
      title: <span className={`text-[13px] ${activeNodeId === node.id ? 'font-bold text-indigo-600' : 'text-gray-700'}`}>{node.id} {node.title}</span>,
      key: node.id,
      children: node.children ? mapOutlineToTreeData(node.children) : []
    }));
  };

  if (step === 'upload') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FA] p-8">
        <input type="file" ref={fileInputRef} className="hidden" onChange={handleRealUpload} accept=".pdf,.doc,.docx" />
        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-2xl p-24 bg-white shadow-sm cursor-pointer flex flex-col items-center group transition-all">
          <UploadCloud size={64} className="text-indigo-400 group-hover:text-indigo-600 mb-6 transition-transform group-hover:scale-110" />
          <h3 className="text-2xl font-bold text-gray-800 mb-2">上传招标文件，AI 智能提取多级大纲</h3>
        </div>
      </div>
    );
  }

  if (step === 'generating') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FA]">
        <div className="bg-white p-12 rounded-2xl shadow-xl flex flex-col items-center w-[600px] text-center">
          <Cpu size={48} className="text-indigo-500 mb-6 animate-pulse" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">流水线引擎正在作业中...</h2>
          <div className="w-full text-left bg-gray-50 p-4 rounded-lg mb-6 border border-gray-100">
            <div className="text-xs text-indigo-500 font-bold mb-1">正在撰写当前模块：</div>
            <div className="text-sm text-gray-700 font-mono truncate">{currentGeneratingNode}</div>
          </div>
          <Progress percent={generationProgress} strokeColor={{ '0%': '#818cf8', '100%': '#4f46e5' }} />
        </div>
      </div>
    );
  }

  if (step === 'document') {
    return (
      <div className="h-screen flex flex-col bg-[#F2F3F5]">
        <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
          <Button type="text" icon={<ArrowLeft size={18} />} onClick={() => setStep('outline')} className="text-gray-600 hover:text-indigo-600 font-medium">返回大纲</Button>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setViewMode('preview')} className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'preview' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}><Eye size={16} className="mr-2" /> 沉浸预览</button>
            <button onClick={() => setViewMode('edit')} className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'edit' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}><PenTool size={16} className="mr-2" /> 源码编辑</button>
          </div>
          <Button type="primary" icon={<Download size={16}/>} onClick={handleDownloadWord} className="bg-indigo-600 hover:bg-indigo-700 rounded-full px-6 border-0">导出文档</Button>
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="w-80 bg-white border-r border-gray-200 p-6 overflow-y-auto shrink-0">
            <p className="font-bold text-gray-800 mb-6 flex items-center"><ListTree size={18} className="mr-2 text-indigo-500"/> 方案大纲视图</p>
            <Tree treeData={mapOutlineToTreeData(outline)} defaultExpandAll selectable={false} className="bg-transparent" />
          </div>
          <div className="flex-1 p-8 overflow-y-auto flex justify-center">
            <div className="w-[850px] bg-white shadow-lg border border-gray-200 min-h-[1050px] p-16 pb-32">
              {viewMode === 'preview' ? (
                <div className="prose prose-indigo prose-lg max-w-none prose-img:rounded-xl prose-img:shadow-md prose-headings:font-bold prose-a:text-indigo-600">
                  {documentContent ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{documentContent}</ReactMarkdown> : <Empty description="暂无生成内容" />}
                </div>
              ) : (
                <textarea className="w-full h-full min-h-[800px] resize-none outline-none font-mono text-[15px] leading-loose text-gray-700 bg-gray-50 p-6 rounded-xl border border-gray-200 focus:border-indigo-400 focus:bg-white transition-colors" value={documentContent} onChange={(e) => setDocumentContent(e.target.value)} />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeNode = activeNodeId ? findNodeById(outline, activeNodeId) : null;
  
  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA]">
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
        <div className="flex items-center">
          <Tag color="purple" className="mr-3 text-sm py-1 px-3 rounded-full border-0 font-bold">🎯 多级树状分析</Tag>
          <h1 className="text-lg font-bold text-gray-800">树状大纲确认与细化</h1>
        </div>
        <Button onClick={() => {
            window.history.replaceState(null, '', `/create-bid`);
            setStep('upload');
            setOutline([]);
            setFileUrl('');
        }} className="text-gray-500 border-gray-300 hover:text-indigo-600 hover:border-indigo-400">重新上传</Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：原文预览对照区 */}
        <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center shadow-sm z-10">
            <span className="font-bold text-gray-700 flex items-center">
              <FileText size={16} className="mr-2 text-indigo-500"/> 招标原文对照
            </span>
            {fileUrl && (
              <a 
                href={fileUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs px-3 py-1 bg-white border border-gray-200 rounded-full text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
              >
                在新窗口放大查看
              </a>
            )}
          </div>
          <div className="flex-1 bg-[#525659] overflow-hidden flex items-center justify-center relative">
            {fileUrl ? (
              fileUrl.toLowerCase().includes('.pdf') ? (
                <iframe 
                  src={`${fileUrl}#toolbar=0&navpanes=0`} 
                  className="w-full h-full border-0" 
                  title="Document Preview"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-white m-8 rounded-2xl shadow-lg w-3/4 text-center">
                  <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                    <FileText size={32} className="text-blue-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">Word 文档已妥善保存</h3>
                  <p className="text-sm text-gray-500 mb-6">浏览器暂不支持直接内嵌预览 Word 格式，请下载后对照查看。</p>
                  <Button type="primary" href={fileUrl} target="_blank" className="bg-indigo-600 rounded-full px-8">
                    点击下载原文件
                  </Button>
                </div>
              )
            ) : (
              <div className="text-center">
                <FileText size={48} className="mx-auto text-gray-400 mb-4 opacity-50" />
                <div className="text-gray-400 font-medium">暂无原文件，可能为旧版历史数据</div>
              </div>
            )}
          </div>
        </div>

        {/* 中间：Ant Design 树状目录 */}
        <div className="w-[350px] bg-gray-50 border-r border-gray-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-gray-200 bg-white">
            <span className="font-bold text-gray-800">树状目录结构</span>
            <div className="text-xs text-gray-400 mt-1">系统将逐一生成最底层的叶子节点</div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
            {outline.length > 0 ? (
              <Tree
                treeData={mapOutlineToTreeData(outline)}
                defaultExpandAll
                selectedKeys={[activeNodeId]}
                onSelect={(selectedKeys) => {
                  if (selectedKeys.length > 0) setActiveNodeId(selectedKeys[0]);
                }}
                className="bg-transparent tree-custom-theme"
              />
            ) : (
              <Empty description="暂无目录树数据" />
            )}
          </div>
        </div>

        {/* 右侧：节点要求编辑器 */}
        <div className="flex-1 bg-white flex flex-col relative">
          {activeNode ? (
            <>
              <div className="p-8 pb-6 border-b border-gray-100 flex flex-col items-start bg-indigo-50/30">
                <div className="flex items-center w-full justify-between mb-4">
                  <div className="flex items-center w-2/3">
                    <span className="text-xl font-bold text-indigo-600 mr-3 shrink-0">{activeNode.id}</span>
                    <Input 
                      value={activeNode.title}
                      onChange={(e) => setOutline(updateNodeTitle(outline, activeNodeId, e.target.value))}
                      className="text-xl font-bold text-gray-900 border-transparent hover:border-indigo-300 focus:border-indigo-500 bg-transparent px-2 py-1 shadow-none"
                    />
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button 
                      type="dashed" 
                      icon={<Plus size={14} />} 
                      onClick={() => setOutline(addChildNode(outline, activeNodeId))}
                      className="text-indigo-600 border-indigo-200 hover:border-indigo-500 hover:text-indigo-700 bg-white"
                    >
                      添加子章节
                    </Button>
                    <Popconfirm
                      title="确定删除此章节及其所有子章节吗？"
                      onConfirm={() => {
                        setOutline(deleteNode(outline, activeNodeId));
                        setActiveNodeId(null);
                      }}
                      okText="确认删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                    >
                      <Button danger type="text" icon={<Trash2 size={16} />} />
                    </Popconfirm>
                  </div>
                </div>
                
                <p className="text-gray-500 text-sm px-2">
                  {(!activeNode.children || activeNode.children.length === 0) 
                    ? "✨ 此为叶子节点，系统将为其发起精准检索与生成，请在下方细化具体撰写要求。" 
                    : "📁 此为父级标题框架，其生成内容将由下属子章节汇总而成。"}
                </p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 bg-[#F8F9FA]">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center text-gray-600 text-sm font-medium">
                    <Edit3 size={16} className="mr-2 text-indigo-500"/>
                    撰写要求与数据填充 (Requirement)
                  </div>
                  <textarea 
                    className="flex-1 w-full p-8 resize-none outline-none text-gray-700 leading-loose text-[15px] focus:bg-indigo-50/10 transition-colors"
                    value={activeNode.requirement || ''}
                    placeholder="输入该小节的具体要求。例如：请重点描述我们的 7x24 小时响应机制；或者在此处粘贴需要填写的具体业绩医院名称..."
                    onChange={(e) => setOutline(updateNodeRequirement(outline, activeNodeId, e.target.value))}
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[#F8F9FA]">
              <Empty description="请在左侧点击选择一个目录节点进行编辑" />
            </div>
          )}

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
                  <Button type="text" icon={<Database size={16} />} onClick={handleOpenCompanyModal} className="bg-indigo-100 text-indigo-700 h-10 px-4 rounded-none hover:bg-indigo-200 border-l border-indigo-200 font-medium transition-colors">
                    从库中选
                  </Button>
                </div>
              </div>
            </div>

            <Button type="primary" onClick={handleGenerateDocument} className="h-12 px-10 bg-indigo-600 hover:bg-indigo-700 rounded-full font-bold text-lg shadow-lg shadow-indigo-200 hover:-translate-y-0.5 transition-all border-0">
              流水线组装并生成正文
            </Button>
          </div>
        </div>
      </div>
      
      <Modal
        title={<div className="flex items-center space-x-2 pb-2"><div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center"><Building2 size={18} className="text-indigo-600" /></div><span className="text-lg">选择投标主体</span></div>}
        open={isCompanyModalVisible}
        onCancel={() => setIsCompanyModalVisible(false)}
        footer={null}
        centered
        width={540}
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