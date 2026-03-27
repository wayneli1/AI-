import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, message, Spin, Modal, Tag, Empty, Tree, Progress, Popconfirm } from 'antd';
import { 
  UploadCloud, ArrowLeft, Download, Search, 
  ChevronRight, Edit3, ListTree, Database, Building2, Eye, PenTool, FileText, CheckCircle2,
  Cpu, Plus, Trash2, Maximize2, Minimize2
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

import MDEditor from '@uiw/react-md-editor';
import { asBlob } from 'html-docx-js-typescript';

// 💡 引入了全新的 parseTemplateToOutline
import { generateBidContent, generateBidOutline, parseTemplateToOutline } from '../utils/difyWorkflow';
import { supabase } from '../lib/supabase'; 
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromDocument } from '../utils/documentParser';

// ==========================================
// 🚀 性能狂飙隔离仓
// ==========================================
const PerformanceEditor = React.memo(({ initialContent, onContentChange, viewMode }) => {
  const [localContent, setLocalContent] = React.useState(initialContent);

  React.useEffect(() => {
    setLocalContent(initialContent);
  }, [initialContent]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      onContentChange(localContent);
    }, 1000);
    return () => clearTimeout(timer);
  }, [localContent, onContentChange]);

  return (
    <div className="flex-1 w-full h-full flex flex-col min-h-0" data-color-mode="light">
      <MDEditor
        value={localContent}
        onChange={setLocalContent}
        height="100%"
        preview={viewMode === 'preview' ? 'live' : 'edit'}
        hideToolbar={viewMode === 'edit'}
        enableScroll={true}
        visibleDragbar={true} 
        style={{ flex: 1, height: '100%', overflow: 'hidden', borderRadius: '0.75rem' }}
        textareaProps={{
          style: { whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
        }}
      />
    </div>
  );
});

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

  const [fileUrl, setFileUrl] = useState(''); 
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

  // 💡 专家模式相关状态
  const [isTemplateModalVisible, setIsTemplateModalVisible] = useState(false);
  const [pastedTemplate, setPastedTemplate] = useState('');
  const [isParsingTemplate, setIsParsingTemplate] = useState(false);
// 💡 新增：用户自定义的模板标书名称
  const [templateProjectName, setTemplateProjectName] = useState('');
  const [showOriginal, setShowOriginal] = useState(true);

  const editorRef = useRef(null);
  // 💡 新增：用于模板上传的 ref 和解析状态
  const templateFileInputRef = useRef(null);
  const [isExtractingTemplate, setIsExtractingTemplate] = useState(false);

  useEffect(() => {
    if (urlProjectId && user) {
      loadExistingProject(urlProjectId);
    }
  }, [urlProjectId, user]);

  const loadExistingProject = async (id) => {
    try {
      message.loading({ content: '正在加载标书...', key: 'load' });
      const { data, error } = await supabase.from('bidding_projects').select('*').eq('id', id).maybeSingle();
      if (error) throw error;
      if (data) {
        setCurrentProjectId(data.id);
        setFileUrl(data.file_url); 

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

  // 💡 正文防抖保存
  useEffect(() => {
    if (step !== 'document' || !currentProjectId || !documentContent) return;

    const autoSaveDocumentToDatabase = async () => {
      try {
        await supabase
          .from('bidding_projects')
          .update({ analysis_report: documentContent }) 
          .eq('id', currentProjectId);
      } catch (error) {
        console.error('正文自动保存失败:', error);
      }
    };

    const debounceTimer = setTimeout(() => {
      autoSaveDocumentToDatabase();
    }, 1500);

    return () => clearTimeout(debounceTimer);
  }, [documentContent, currentProjectId, step]);

  // 💡 大纲防抖保存
  useEffect(() => {
    if (!currentProjectId || outline.length === 0) return;

    const autoSaveToDatabase = async () => {
      try {
        await supabase
          .from('bidding_projects')
          .update({ framework_content: JSON.stringify(outline) })
          .eq('id', currentProjectId);
      } catch (error) {}
    };

    const debounceTimer = setTimeout(() => {
      autoSaveToDatabase();
    }, 1500);

    return () => clearTimeout(debounceTimer);
  }, [outline, currentProjectId]);

  // ==========================================
  // 事件处理：上传文件 (自动挡)
  // ==========================================
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
      
      setFileUrl(uploadedFileUrl); 

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
// 💡 新增：处理模板文件上传并自动提取文字
  const handleTemplateFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!templateProjectName) {
      setTemplateProjectName(file.name.replace(/\.[^/.]+$/, ''));
    }
    try {
      setIsExtractingTemplate(true);
      message.loading({ content: `正在从 ${file.name} 中提取文字...`, key: 'extractTemplate', duration: 0 });
      
      // 复用您现成的文档提取神仙函数
      const extractedText = await extractTextFromDocument(file);
      
      if (!extractedText || extractedText.trim() === '') {
        throw new Error("未能提取到有效文字，请检查文件格式或尝试手动复制粘贴。");
      }

      // 把提取出来的文字直接塞进文本框，让用户可以预览和二次编辑
      setPastedTemplate(extractedText);
      message.success({ content: '文字提取成功！请核对下方内容后，点击 AI 洗数据。', key: 'extractTemplate' });
      
    } catch (error) {
      message.error({ content: '提取失败: ' + error.message, key: 'extractTemplate' });
    } finally {
      setIsExtractingTemplate(false);
      // 清空 input，允许重复上传同一个文件
      if (event.target) event.target.value = ''; 
    }
  };


  // ==========================================
  // 事件处理：专家模式粘贴模板 (手动挡)
  // ==========================================
  // ==========================================
  // 事件处理：专家模式粘贴模板 (手动挡)
  // ==========================================
  const handleImportTemplate = async () => {
    // 1. 前置拦截校验
    if (!templateProjectName.trim()) {
      return message.warning('请先为这份标书命名！'); // 强制要求用户输入名字
    }
    if (!pastedTemplate.trim()) {
      return message.warning('请粘贴或上传模板内容！');
    }
    if (!user) {
      return message.error("请先登录！");
    }

    setIsParsingTemplate(true);
    try {
      message.loading({ 
        content: `正在通过 AI 清洗【${templateProjectName}】的目录结构...`, 
        key: 'importTemplate', 
        duration: 0 
      });

      // 2. 调用专用 AI 极速清洗乱码模板
      const dynamicOutline = await parseTemplateToOutline(pastedTemplate);

      // 3. 数据入库，生成草稿记录 (这里的 project_name 直接使用用户输入的名称)
      const { data: project, error } = await supabase.from('bidding_projects').insert({
        user_id: user.id,
        project_name: templateProjectName.trim(), // 💡 使用用户自定义的名字入库！
        file_url: null, // 专家模式目前不保存源文件 URL
        framework_content: JSON.stringify(dynamicOutline),
        status: 'processing' // 状态标记为处理中/草稿
      }).select().single();

      if (error) throw error;

      // 4. 状态切换，平滑跳入编辑树界面
      setCurrentProjectId(project.id);
      setOutline(dynamicOutline);
      setActiveNodeId(dynamicOutline[0]?.id || null);
      setFileUrl(''); 
      
      // 更新浏览器 URL，方便刷新不丢失
      window.history.replaceState(null, '', `/create-bid?id=${project.id}`);

      message.success({ 
        content: `模板导入成功！标书【${templateProjectName}】已自动保存草稿。`, 
        key: 'importTemplate' 
      });
      
      // 5. 关闭弹窗并清空状态
      setStep('outline');
      setIsTemplateModalVisible(false);
      setPastedTemplate('');
      setTemplateProjectName(''); // 清空名称输入框
      
    } catch (error) {
      message.error({ 
        content: '模板解析失败: ' + error.message, 
        key: 'importTemplate' 
      });
    } finally {
      setIsParsingTemplate(false);
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
        await supabase
          .from('bidding_projects')
          .update({ framework_content: JSON.stringify(outline) })
          .eq('id', currentProjectId);
      }
      
      message.loading({ content: `正在从数据库提取【${targetCompany}】的图片资产...`, key: 'fetch-img' });
      const imageDictionary = [];
      
      try {
        const { data: catData } = await supabase
          .from('image_categories')
          .select('id')
          .eq('name', targetCompany)
          .single();
          
        if (catData) {
          const { data: imgData } = await supabase
            .from('images')
            .select('image_name, image_url')
            .eq('category_id', catData.id);
            
          if (imgData && imgData.length > 0) {
            imgData.forEach(img => {
              imageDictionary.push({ name: img.image_name, url: img.image_url });
            });
          }
        }
      } catch (e) {}
      
      try {
        const { data: uncategorizedImg } = await supabase
          .from('images')
          .select('image_name, image_url')
          .is('category_id', null);
          
        if (uncategorizedImg && uncategorizedImg.length > 0) {
          uncategorizedImg.forEach(img => {
            if (!imageDictionary.find(i => i.name === img.image_name)) {
              imageDictionary.push({ name: img.image_name, url: img.image_url });
            }
          });
        }
      } catch (e) {}
      
      message.success({ content: `图片字典构建完毕，共 ${imageDictionary.length} 张可用图片`, key: 'fetch-img' });
      
      const imageNamesList = imageDictionary.map(img => `- ${img.name}`).join('\n');
      let fullGeneratedText = '';
      
      for (let i = 0; i < leafNodes.length; i++) {
        const node = leafNodes[i];
        
        setCurrentGeneratingNode(`[${node.id}] ${node.title}`);
        setGenerationProgress(Math.round((i / leafNodes.length) * 100));

        const queryText = `${targetCompany} ${node.title} ${node.requirement || ''}`.substring(0, 100);
        const frameworkText = `
当前章节：### ${node.id} ${node.title}
撰写要求：
${node.requirement || '请结合上下文与内部知识库，详细扩充本节的技术或管理方案。'}

【🚨 图片插入极度严格规范】
如需插入图片，你只能从以下可用图片列表中选择，并严格输出占位符格式：{{IMG_图片名称}}

可用图片列表：
${imageNamesList || '（当前无可用图片，请仅输出文字内容）'}

⚠️ 核心纪律：
1. 绝对禁止输出任何 URL 或 ![]() 语法，只能输出形如 {{IMG_营业执照}} 的占位符
2. 严禁在标书签字、盖章落款处插入图片
3. 除非大纲明确要求，否则绝对不允许擅自加戏插入图片

注意：首行请严格以 "### ${node.id} ${node.title}" 标准 Markdown 格式开头。
        `.trim();
        
        let chunkText = await generateBidContent(targetCompany, frameworkText, queryText);
        
        imageDictionary.forEach(img => {
          const placeholder = `{{IMG_${img.name}}}`;
          const realMarkdown = `![${img.name}](${img.url})`;
          chunkText = chunkText.split(placeholder).join(realMarkdown);
        });
        
        chunkText = chunkText.replace(/\{\{IMG_\s*([^}]+?)\s*\}\}/g, (match, imgName) => {
          const trimmedName = imgName.trim();
          const foundImg = imageDictionary.find(img => img.name === trimmedName);
          if (foundImg) {
            return `![${foundImg.name}](${foundImg.url})`;
          }
          return match;
        });
        
        fullGeneratedText += chunkText + '\n\n';
        setDocumentContent(fullGeneratedText);
      }

      setGenerationProgress(100);
      if (currentProjectId) {
        await supabase
          .from('bidding_projects')
          .update({ analysis_report: fullGeneratedText, status: 'completed' })
          .eq('id', currentProjectId);
      }
      
      message.success('全部分块流水线生成完毕！');
      setStep('document');
      setViewMode('preview');
      
    } catch (error) {
      console.error("生成报错:", error);
      message.error(`生成过程中断: ${error.message}`);
      setStep('document'); 
      setViewMode('edit'); 
    }
  };

  const handleDownloadWord = async () => {
    try {
      message.loading({ content: '正在打包 Word 文档...', key: 'export' });
      const htmlContent = document.querySelector('.wmde-markdown').innerHTML;
      
      const sourceHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${targetCompany || '标书正文'}</title>
            <style>
              body { font-family: 'SimSun', '宋体', sans-serif; font-size: 14pt; line-height: 1.5; }
              table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
              table, th, td { border: 1px solid black; padding: 8px; }
              img { max-width: 100%; height: auto; display: block; margin: 10px auto; }
              h1, h2, h3 { color: #333; }
            </style>
          </head>
          <body>
            ${htmlContent}
          </body>
        </html>
      `;

      const blob = await asBlob(sourceHTML, { orientation: 'portrait', margins: { top: 1440, right: 1440, bottom: 1440, left: 1440 }});
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${targetCompany || '投标文件'}_正文.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success({ content: 'Word 文档导出成功！', key: 'export' });
    } catch (err) {
      console.error(err);
      message.error({ content: '导出失败，请重试', key: 'export' });
    }
  };

  const scrollToAnchor = (nodeId, nodeTitle) => {
    const headings = document.querySelectorAll('.w-md-editor-preview h1, .w-md-editor-preview h2, .w-md-editor-preview h3, .w-md-editor-preview h4, .w-md-editor-preview h5, .w-md-editor-preview h6');
    let targetElement = null;

    for (let i = 0; i < headings.length; i++) {
      const text = headings[i].textContent;
      if (text.includes(nodeId) || text.includes(nodeTitle)) {
        targetElement = headings[i];
        break;
      }
    }

    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      message.warning('尚未生成该章节内容，或正在生成中...');
    }
  };

  const mapOutlineToTreeData = (nodes, isDocumentView = false) => {
    return nodes.map(node => ({
      title: (
        <span 
          className={`text-[13px] ${activeNodeId === node.id ? 'font-bold text-indigo-600' : 'text-gray-700'} cursor-pointer hover:text-indigo-500`}
          onClick={() => isDocumentView ? scrollToAnchor(node.id, node.title) : null}
        >
          {node.id} {node.title}
        </span>
      ),
      key: node.id,
      children: node.children ? mapOutlineToTreeData(node.children, isDocumentView) : []
    }));
  };

  // ==========================================
  // UI 渲染逻辑
  // ==========================================

  // 💡 双通道入口 UI 渲染
  if (step === 'upload') {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#F8F9FA] p-8 relative">
        <h2 className="text-3xl font-bold text-gray-800 mb-12">选择一种方式开始编制标书</h2>
        
        <div className="flex gap-8 max-w-5xl w-full justify-center">
          {/* 自动挡：上传文件 */}
          <input type="file" ref={fileInputRef} className="hidden" onChange={handleRealUpload} accept=".pdf,.doc,.docx" />
          <div 
            onClick={() => fileInputRef.current?.click()} 
            className="flex-1 max-w-md border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-3xl p-12 bg-white shadow-sm hover:shadow-xl cursor-pointer flex flex-col items-center group transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <UploadCloud size={40} className="text-indigo-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">上传招标原文件</h3>
            <p className="text-gray-500 text-center text-sm leading-relaxed">
              适合新手。系统将自动阅读数十万字原文件，<br/>由 AI 智能提取多级大纲树。
            </p>
          </div>

          {/* 手动挡：导入模板 */}
          <div 
            onClick={() => setIsTemplateModalVisible(true)} 
            className="flex-1 max-w-md border-2 border-solid border-emerald-200 hover:border-emerald-400 rounded-3xl p-12 bg-white shadow-sm hover:shadow-xl cursor-pointer flex flex-col items-center group transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <FileText size={40} className="text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">导入已有模板 <Tag color="green" className="ml-2">专家模式</Tag></h3>
            <p className="text-gray-500 text-center text-sm leading-relaxed">
              适合老手。直接复制粘贴您的祖传模板要求，<br/>AI 将瞬间为您生成可编辑的目录树。
            </p>
          </div>
        </div>

        {/* 💡 专家模式输入弹窗 (完整版) */}
        <Modal
          title={
            <div className="flex items-center space-x-2 pb-2">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <FileText size={18} className="text-emerald-600" />
              </div>
              <span className="text-lg font-bold">导入标书模板框架</span>
            </div>
          }
          open={isTemplateModalVisible}
          onCancel={() => {
            // 💡 取消时清空所有状态
            setIsTemplateModalVisible(false);
            setTemplateProjectName('');
            setPastedTemplate('');
          }}
          width={750}
          centered
          maskClosable={false} // 防止误触遮罩层关掉导致丢失数据
          footer={[
            <Button 
              key="back" 
              onClick={() => {
                setIsTemplateModalVisible(false);
                setTemplateProjectName('');
                setPastedTemplate('');
              }}
            >
              取消
            </Button>,
            <Button 
              key="submit" 
              type="primary" 
              loading={isParsingTemplate} 
              onClick={handleImportTemplate}
              className="bg-emerald-600 hover:bg-emerald-700 border-0 px-8 font-medium"
            >
              AI 洗数据并生成大纲
            </Button>
          ]}
        >
          <div className="py-2 flex flex-col h-[65vh] min-h-[450px]">
            
            {/* 1. 标书项目名称输入区 */}
            <div className="mb-5">
              <div className="text-sm font-bold text-gray-700 mb-2">
                标书项目名称 <span className="text-red-500">*</span>
              </div>
              <Input
                placeholder="请输入本次标书的名称（例如：XX医院弱电智能化项目投标文件）"
                value={templateProjectName}
                onChange={(e) => setTemplateProjectName(e.target.value)}
                className="h-11 rounded-lg border-gray-300 focus:border-emerald-400 focus:ring-emerald-100 text-base"
              />
            </div>

            {/* 2. 提示语与一键上传按钮区 */}
            <div className="flex justify-between items-start mb-4 gap-4">
              <div className="bg-emerald-50 text-emerald-700 p-3.5 rounded-xl text-sm flex-1 leading-relaxed border border-emerald-100">
                <span className="mr-2 text-base">💡</span>
                您可以直接粘贴文本，或者 <strong>上传已有模板文件</strong>，系统将自动提取文字并填入下方。无论格式多乱，AI 都会自动为您梳理成层级目录树。
              </div>
              
              {/* 隐藏的文件上传框 */}
              <input 
                type="file" 
                ref={templateFileInputRef} 
                className="hidden" 
                onChange={handleTemplateFileUpload} 
                accept=".pdf,.doc,.docx,.ppt,.pptx" 
              />
              
              {/* 触发上传的按钮 */}
              <Button 
                onClick={() => templateFileInputRef.current?.click()} 
                loading={isExtractingTemplate}
                className="shrink-0 h-[76px] px-5 border-emerald-300 text-emerald-600 hover:text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50 flex flex-col items-center justify-center rounded-xl transition-all"
              >
                <UploadCloud size={20} className="mb-1" />
                <span className="font-bold text-xs">上传模板文件</span>
              </Button>
            </div>

            {/* 3. 核心大文本粘贴区 */}
            <div className="flex-1 flex flex-col">
              <div className="text-sm font-bold text-gray-700 mb-2">
                模板目录内容 <span className="text-red-500">*</span>
              </div>
              <Input.TextArea
                placeholder="提取的文字会显示在这里。您也可以直接在此处粘贴（例如：一、商务部分 1.营业执照...）"
                value={pastedTemplate}
                onChange={(e) => setPastedTemplate(e.target.value)}
                className="flex-1 bg-gray-50 p-4 rounded-xl leading-relaxed text-[14px] border-gray-200 focus:border-emerald-400 focus:ring-emerald-100 resize-none custom-scrollbar"
              />
            </div>

          </div>
        </Modal>
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
      <div className="h-screen flex flex-col bg-[#F2F3F5] overflow-hidden">
        <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm z-10 shrink-0">
          <Button type="text" icon={<ArrowLeft size={18} />} onClick={() => setStep('outline')} className="text-gray-600 hover:text-indigo-600 font-medium">
            返回大纲配置
          </Button>
          
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setViewMode('preview')} className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'preview' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <Eye size={16} className="mr-2" /> 双栏对照
            </button>
            <button onClick={() => setViewMode('edit')} className={`flex items-center px-4 py-1.5 rounded-md text-sm font-medium transition-all ${viewMode === 'edit' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}>
              <PenTool size={16} className="mr-2" /> 沉浸纯排版
            </button>
          </div>
          
          <Button type="primary" icon={<Download size={16}/>} onClick={handleDownloadWord} className="bg-indigo-600 hover:bg-indigo-700 rounded-full px-6 border-0">
            导出 Word (.docx)
          </Button>
        </div>

        <div className="flex-1 flex overflow-hidden p-4 gap-4">
          <div className="w-1/4 max-w-[320px] bg-white rounded-xl shadow-sm border border-gray-200 p-5 overflow-y-auto flex flex-col min-h-0">
            <p className="font-bold text-gray-800 mb-4 flex items-center shrink-0">
              <ListTree size={18} className="mr-2 text-indigo-500"/> 
              点击目录跳转原文
            </p>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <Tree 
                treeData={mapOutlineToTreeData(outline, true)} 
                defaultExpandAll 
                selectable={false} 
                className="bg-transparent" 
              />
            </div>
          </div>
          
          <div className="flex-1 bg-white shadow-lg border border-gray-200 rounded-xl overflow-hidden flex flex-col min-h-0" ref={editorRef} data-color-mode="light">
              <div className="flex-1 p-2 bg-[#fafafa] flex flex-col min-h-0">
                <PerformanceEditor 
                  initialContent={documentContent} 
                  onContentChange={setDocumentContent} 
                  viewMode={viewMode} 
                />
              </div>
          </div>
        </div>
      </div>
    );
  }

  const activeNode = activeNodeId ? findNodeById(outline, activeNodeId) : null;
  
  return (
    <div className="h-screen flex flex-col bg-[#F8F9FA] overflow-hidden">
      <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-sm z-20">
        <div className="flex items-center">
          <Tag color="purple" className="mr-3 text-sm py-1 px-3 rounded-full border-0 font-bold">🎯 多级树状分析</Tag>
          <h1 className="text-lg font-bold text-gray-800">树状大纲确认与细化</h1>
        </div>
        <div className="flex items-center space-x-4">
          <Button 
            onClick={() => setShowOriginal(!showOriginal)} 
            type="text"
            icon={showOriginal ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-medium"
          >
            {showOriginal ? '收起原文区' : '展开原文区'}
          </Button>
          <Button onClick={() => {
              window.history.replaceState(null, '', `/create-bid`);
              setStep('upload');
              setOutline([]);
              setFileUrl('');
          }} className="text-gray-500 border-gray-300 hover:text-indigo-600 hover:border-indigo-400">
            重新上传
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {showOriginal && (
          <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col shrink-0 transition-all duration-300 min-h-0">
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
                  <div className="text-gray-400 font-medium">暂无原文件，您正处于模板手工编制模式</div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className={`${showOriginal ? 'w-[300px]' : 'w-1/3'} bg-gray-50 border-r border-gray-200 flex flex-col shrink-0 transition-all duration-300 min-h-0`}>
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

        <div className="flex-1 bg-white flex flex-col relative min-w-0 min-h-0">
          {activeNode ? (
            <>
              <div className="p-8 pb-6 border-b border-gray-100 flex flex-col items-start bg-indigo-50/30">
                <div className="flex items-center w-full justify-between mb-4">
                  <div className="flex items-center flex-1 mr-4 min-w-0">
                    <span className="text-xl font-bold text-indigo-600 mr-3 shrink-0">{activeNode.id}</span>
                    <Input 
                      value={activeNode.title}
                      onChange={(e) => setOutline(updateNodeTitle(outline, activeNodeId, e.target.value))}
                      className="text-xl font-bold text-gray-900 border-transparent hover:border-indigo-300 focus:border-indigo-500 bg-transparent px-2 py-1 shadow-none w-full"
                    />
                  </div>
                  
                  <div className="flex space-x-2 shrink-0">
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
              
              <div className="flex-1 overflow-y-auto p-6 lg:p-10 bg-[#F8F9FA]">
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

          <div className="h-24 bg-white border-t border-gray-200 flex items-center justify-between px-8 shadow-[0_-10px_40px_rgba(0,0,0,0.04)] shrink-0 relative z-20">
            <div className="flex flex-col items-start">
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