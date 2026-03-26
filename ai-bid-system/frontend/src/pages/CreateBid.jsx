import React, { useState, useRef, useEffect } from 'react';
import { Button, Input, message, Spin, Modal, Tag, Empty, Tree, Progress, Popconfirm } from 'antd';
import { 
  UploadCloud, ArrowLeft, Download, Search, 
  ChevronRight, Edit3, ListTree, Database, Building2, Eye, PenTool, FileText, CheckCircle2,
  Cpu, Plus, Trash2, Maximize2, Minimize2
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

// 💡 核心升级 1：引入真正的双栏编辑器
import MDEditor from '@uiw/react-md-editor';
// 💡 核心升级 2：引入真正的 Word 导出库
import { asBlob } from 'html-docx-js-typescript';

import { generateBidContent, generateBidOutline } from '../utils/difyWorkflow';
import { supabase } from '../lib/supabase'; 
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromDocument } from '../utils/documentParser';

// ==========================================
// 🚀 性能狂飙隔离仓：专为超大文本优化的 Markdown 编辑器
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
    // 💡 彻底修复白屏与排版塌陷：强制 flex 布局满铺，恢复拖拽条
    <div className="flex-1 w-full h-full flex flex-col min-h-0" data-color-mode="light">
      <MDEditor
        value={localContent}
        onChange={setLocalContent}
        height="100%"
        preview={viewMode === 'preview' ? 'live' : 'edit'}
        hideToolbar={viewMode === 'edit'}
        enableScroll={true}
        visibleDragbar={true} // 🚀 拖拽条复活！可自由调节左右宽度比例
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

  // 💡 界面控制状态
  const [showOriginal, setShowOriginal] = useState(true);

  const editorRef = useRef(null);
  
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

  // 💡 Markdown 正文实时防抖自动保存
  useEffect(() => {
    if (step !== 'document' || !currentProjectId || !documentContent) return;

    const autoSaveDocumentToDatabase = async () => {
      try {
        await supabase
          .from('bidding_projects')
          .update({ analysis_report: documentContent }) 
          .eq('id', currentProjectId);
        console.log('✨ 标书正文已自动静默保存！');
      } catch (error) {
        console.error('正文自动保存失败:', error);
      }
    };

    const debounceTimer = setTimeout(() => {
      autoSaveDocumentToDatabase();
    }, 1500);

    return () => clearTimeout(debounceTimer);
  }, [documentContent, currentProjectId, step]);

  // 💡 大纲实时防抖自动保存
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
      
      // 步骤1：生成前查库，提取图片字典
      message.loading({ content: `正在从数据库提取【${targetCompany}】的图片资产...`, key: 'fetch-img' });
      const imageDictionary = [];
      
      try {
        const { data: catData } = await supabase
          .from('image_categories')
          .select('id')
          .eq('name', targetCompany)
          .eq('user_id', user.id)
          .single();
          
        if (catData) {
          const { data: imgData } = await supabase
            .from('images')
            .select('image_name, image_url')
            .eq('category_id', catData.id);
            
          if (imgData && imgData.length > 0) {
            imgData.forEach(img => {
              imageDictionary.push({
                name: img.image_name,
                url: img.image_url
              });
            });
          }
        }
      } catch (e) {
        console.warn("获取图片库失败，可能该公司暂无专属图片");
      }
      
      // 查询"未分类"通用图片（category_id 为 null 的图片）
      try {
        const { data: uncategorizedImg } = await supabase
          .from('images')
          .select('image_name, image_url')
          .is('category_id', null);
          
        if (uncategorizedImg && uncategorizedImg.length > 0) {
          uncategorizedImg.forEach(img => {
            if (!imageDictionary.find(i => i.name === img.image_name)) {
              imageDictionary.push({
                name: img.image_name,
                url: img.image_url
              });
            }
          });
        }
      } catch (e) {
        console.warn("获取未分类图片失败");
      }
      
      message.success({ content: `图片字典构建完毕，共 ${imageDictionary.length} 张可用图片`, key: 'fetch-img' });
      
      // 步骤2：构建图片名称列表用于 prompt
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

【🚨 图片插入极度严格规范（防滥用死命令）】
如需插入图片，你只能从以下可用图片列表中选择，并严格输出占位符格式：{{IMG_图片名称}}

可用图片列表：
${imageNamesList || '（当前无可用图片，请仅输出文字内容）'}

⚠️ 核心使用纪律（违规将导致废标）：
1. 绝对禁止输出任何 URL 或 ![]() 语法，只能输出形如 {{IMG_营业执照}} 的占位符
2. 严禁在标书的签字、盖章、落款、日期声明处（如"投标人名称："、"法定代表人签字："）插入营业执照或任何图片
3. 除非本章节的大纲要求明确指明需要提供某项资质或截图，否则绝对不允许擅自加戏插入图片
4. 营业执照等核心资质图片，通常仅在【资格证明材料】或【公司简介】章节展示一次，严禁在业务响应方案中反复滥用

注意：首行请严格以 "### ${node.id} ${node.title}" 标准 Markdown 格式开头，不要使用任何 HTML 标签。
        `.trim();
        
        // 调用大模型生成内容
        let chunkText = await generateBidContent(targetCompany, frameworkText, queryText);
        
        // 步骤3：精准替换占位符为真实 Markdown 语法
        imageDictionary.forEach(img => {
          const placeholder = `{{IMG_${img.name}}}`;
          const realMarkdown = `![${img.name}](${img.url})`;
          // 使用 split + join 进行全局替换，避免正则特殊字符问题
          chunkText = chunkText.split(placeholder).join(realMarkdown);
        });
        
        // 兼容处理：也支持 {{IMG_图片名称}} 格式中可能存在的空格
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

  // 💡 宽屏沉浸视图 (生成完毕后的编辑/导出界面)
  if (step === 'document') {
    return (
      <div className="h-screen flex flex-col bg-[#F2F3F5] overflow-hidden">
        {/* 顶部控制栏 */}
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

        {/* 💡 宽屏工作区 */}
        <div className="flex-1 flex overflow-hidden p-4 gap-4">
          
          {/* 左侧：可收缩的目录树 (占宽 1/4) */}
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
          
          {/* 右侧：火力全开撑满全屏的编辑器 (占宽 3/4) */}
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
  
  // 💡 大纲配置视图 (生成前)
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
        {/* 左侧：原文预览对照区 (可折叠) */}
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
                  <div className="text-gray-400 font-medium">暂无原文件，可能为旧版历史数据</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 中间：Ant Design 树状目录 */}
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

        {/* 右侧：节点要求编辑器 */}
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