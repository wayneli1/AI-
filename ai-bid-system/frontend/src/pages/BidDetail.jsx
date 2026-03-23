import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Tabs, Spin, Button, message } from 'antd';
import { ArrowLeft, Download, FileText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const { TabPane } = Tabs;

const BidDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('report');
  
  // 监听真正发生滚动的容器
  const scrollContainerRef = useRef(null);

  // 1. 获取数据
  useEffect(() => {
    const fetchProjectDetail = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('bidding_projects')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setProject(data);
      } catch (error) {
        message.error('未找到该标书的解析数据，请返回重试');
        navigate('/my-bids');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProjectDetail();
  }, [id, navigate]);

  // 2. 决定当前显示的 Markdown 内容
  const currentMarkdown = useMemo(() => {
    if (!project) return '';
    let text = '';
    if (activeTab === 'report') text = project.analysis_report || '';
    else if (activeTab === 'framework') text = project.framework_content || '';
    else if (activeTab === 'checklist') text = project.checklist_content || '';
    
    text = text.replace(/\\n/g, '\n');
    text = text.replace(/([^\n])\n(\s*\|)/g, '$1\n\n$2');
    return text || '暂无数据';
  }, [project, activeTab]);

  // 3. 提取标题（修复版：扩大抓取范围到 H1~H4）
  const tocItems = useMemo(() => {
    if (!currentMarkdown) return [];
    // 【关键修改】：正则改为 #{1,4}，能抓到三四级标题
    const regex = /^(#{1,4})\s+(.+)$/gm;
    const items = [];
    let match;
    while ((match = regex.exec(currentMarkdown)) !== null) {
      const level = match[1].length; 
      const title = match[2].trim();
      const slug = title.replace(/\s+/g, '-'); 
      items.push({ key: slug, href: `#${slug}`, title: title, level: level });
    }
    return items;
  }, [currentMarkdown]);

  // 4. 监听容器滚动，高亮目录
  const [activeTocId, setActiveTocId] = useState('');
  
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || tocItems.length === 0) return;
    
    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      
      const headings = tocItems.map(item => {
        const element = document.getElementById(item.key);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return { id: item.key, top: rect.top - containerTop };
      }).filter(Boolean);
      
      if (headings.length === 0) return;
      
      let currentActive = headings[0].id;
      for (let i = 0; i < headings.length; i++) {
        if (headings[i].top <= 150) { 
          currentActive = headings[i].id;
        } else {
          break;
        }
      }
      
      if (currentActive !== activeTocId) setActiveTocId(currentActive);
    };
    
    container.addEventListener('scroll', handleScroll);
    handleScroll(); 
    return () => container.removeEventListener('scroll', handleScroll);
  }, [tocItems, activeTocId]);

  // 5. Markdown 渲染组件
  const MarkdownComponents = {
    h1: ({node, children, ...props}) => {
      const title = Array.isArray(children) ? children.join('') : String(children || '');
      const id = title.trim().replace(/\s+/g, '-');
      return <h1 id={id} className="text-[24px] font-bold mt-8 mb-6 pb-3 border-b border-[#e5e7eb] text-[#111827] scroll-mt-6" {...props}>{children}</h1>;
    },
    h2: ({node, children, ...props}) => {
      const title = Array.isArray(children) ? children.join('') : String(children || '');
      const id = title.trim().replace(/\s+/g, '-');
      return <h2 id={id} className="text-[18px] font-bold mt-7 mb-4 text-[#6d28d9] flex items-center before:content-[''] before:block before:w-1.5 before:h-5 before:bg-[#6d28d9] before:mr-2 before:rounded-sm scroll-mt-6" {...props}>{children}</h2>;
    },
    // 【关键修改】：给 h3 和 h4 绑定相同的 id 生成逻辑，让它们也能被跳转
    h3: ({node, children, ...props}) => {
      const title = Array.isArray(children) ? children.join('') : String(children || '');
      const id = title.trim().replace(/\s+/g, '-');
      return <h3 id={id} className="text-[16px] font-bold mt-6 mb-3 text-[#374151] scroll-mt-6" {...props}>{children}</h3>;
    },
    h4: ({node, children, ...props}) => {
      const title = Array.isArray(children) ? children.join('') : String(children || '');
      const id = title.trim().replace(/\s+/g, '-');
      return <h4 id={id} className="text-[15px] font-bold mt-4 mb-2 text-gray-700 scroll-mt-6" {...props}>{children}</h4>;
    },
    p: ({node, ...props}) => <p className="mb-4 text-justify text-[#333333] leading-[1.6]" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc ml-6 mb-4 mt-2 text-[#333333] leading-[1.6]" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal ml-6 mb-4 mt-2 text-[#333333] leading-[1.6]" {...props} />,
    table: ({node, ...props}) => <div className="overflow-x-auto my-6"><table className="w-full border-collapse text-[14px]" {...props} /></div>,
    thead: ({node, ...props}) => <thead className="bg-[#f8fafc]" {...props} />,
    th: ({node, ...props}) => <th className="font-bold text-[#1e293b] px-3 py-2.5 border border-[#cbd5e1] text-left align-top" {...props} />,
    td: ({node, ...props}) => <td className="text-[#475569] px-3 py-2.5 border border-[#cbd5e1] align-top" {...props} />,
  };

  // 6. 导出函数 (保留原状)
  const markdownToHtml = (markdown) => {
    if (!markdown) return '';
    let html = markdown.replace(/\\n/g, '\n');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/^\s*[-*+] (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => '<ul>' + match + '</ul>');
    html = html.replace(/^\s*\d+\. (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => '<ol>' + match + '</ol>');
    
    const lines = html.split('\n');
    let inTable = false;
    let processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('|') && !line.startsWith('<') && !line.startsWith('#')) {
        const nextLine = lines[i + 1] || '';
        const isHeader = nextLine.includes('|') && /^[\s\|:-]+$/.test(nextLine.replace(/\|/g, '').trim());
        if (!inTable) {
          inTable = true;
          processedLines.push('<table>');
        }
        const cells = line.split('|').filter(cell => cell.trim() !== '');
        const cellTag = isHeader ? 'th' : 'td';
        const rowHtml = '<tr>' + cells.map(cell => `<${cellTag}>${cell.trim()}</${cellTag}>`).join('') + '</tr>';
        
        if (isHeader) {
          processedLines.push('<thead>' + rowHtml + '</thead><tbody>');
          i++; 
        } else {
          processedLines.push(rowHtml);
        }
      } else {
        if (inTable) {
          inTable = false;
          processedLines.push('</tbody></table>');
        }
        processedLines.push(line);
      }
    }
    if (inTable) processedLines.push('</tbody></table>');
    html = processedLines.join('\n');
    html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^(?!<[a-z]|<\/[a-z]|$)(.+)$/gm, '<p>$1</p>');
    
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>标书解析报告</title><style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: 'Microsoft YaHei', 'SimSun', sans-serif; font-size: 15px; line-height: 1.6; color: #333333; padding: 40px; background: #ffffff; max-width: 210mm; margin: 0 auto; } p { margin-bottom: 16px; text-align: justify; text-justify: inter-ideograph; } h1 { font-size: 24px; font-weight: bold; color: #111827; border-bottom: 1px solid #e5e7eb; padding-bottom: 12px; margin-bottom: 24px; margin-top: 32px; } h2 { font-size: 18px; font-weight: bold; color: #6d28d9; margin-top: 28px; margin-bottom: 16px; } h3 { font-size: 16px; font-weight: bold; color: #374151; margin-top: 24px; margin-bottom: 12px; } h4 { font-size: 15px; font-weight: bold; color: #4b5563; margin-top: 16px; margin-bottom: 8px; } table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; } thead { background-color: #f8fafc; } th { font-weight: bold; color: #1e293b; padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; vertical-align: top; } td { color: #475569; padding: 10px 12px; border: 1px solid #cbd5e1; vertical-align: top; } ul, ol { margin-left: 24px; margin-bottom: 16px; margin-top: 8px; } li { margin-bottom: 8px; text-align: justify; } blockquote { border-left: 4px solid #8b5cf6; background-color: #f5f3ff; color: #64748b; padding: 12px; margin: 16px 0; border-radius: 0 4px 4px 0; } pre { background-color: #f1f5f9; border: 1px solid #e2e8f0; padding: 16px; margin: 16px 0; border-radius: 6px; overflow-x: auto; } code { font-family: 'Consolas', 'Monaco', monospace; background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 14px; } a { color: #2563eb; text-decoration: none; } a:hover { text-decoration: underline; }</style></head><body>${html}</body></html>`;
  };

  const downloadReport = async () => {
    if (!project?.analysis_report) return message.warning('深度解析报告内容为空');
    try {
      const html = markdownToHtml(project.analysis_report);
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.project_name}_深度解析报告.doc`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('深度解析报告下载开始');
    } catch (error) { message.error('生成文档失败，请重试'); }
  };

  const downloadFramework = async () => {
    if (!project?.framework_content) return message.warning('投标文件完整框架内容为空');
    try {
      const html = markdownToHtml(project.framework_content);
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.project_name}_投标文件完整框架.doc`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('投标文件完整框架下载开始');
    } catch (error) { message.error('生成文档失败，请重试'); }
  };

  const downloadChecklist = async () => {
    if (!project?.checklist_content) return message.warning('商务资料清单内容为空');
    try {
      const html = markdownToHtml(project.checklist_content);
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.project_name}_商务资料清单.doc`;
      a.click();
      URL.revokeObjectURL(url);
      message.success('商务资料清单下载开始');
    } catch (error) { message.error('生成文档失败，请重试'); }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-50">
        <Spin size="large" />
        <p className="mt-4 text-gray-500">正在从数据库加载解析报告...</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-white">
      {/* 顶部导航栏 */}
      <div className="h-16 border-b border-gray-200 px-6 flex items-center justify-between shrink-0 bg-white shadow-sm z-10">
        <div className="flex items-center space-x-4">
          <Button icon={<ArrowLeft size={18} />} onClick={() => navigate(-1)} type="text" className="text-gray-500 hover:text-purple-600" />
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-100 rounded flex items-center justify-center mr-3">
              <FileText size={18} className="text-purple-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-800 leading-tight">{project?.project_name || '标书深度解析详情'}</h1>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button type="primary" icon={<Download size={16} />} onClick={downloadReport} className="bg-purple-600 border-none shadow-sm">
            深度解析报告
          </Button>
          <Button icon={<Download size={16} />} onClick={downloadFramework} className="bg-[#f8fafc] text-gray-700 border-gray-200 hover:text-purple-600 hover:border-purple-600 shadow-sm">
            完整框架
          </Button>
          <Button icon={<Download size={16} />} onClick={downloadChecklist} className="bg-[#f8fafc] text-gray-700 border-gray-200 hover:text-purple-600 hover:border-purple-600 shadow-sm">
            商务清单
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧原文预览区 */}
        <div className="w-[40%] border-r border-gray-200 bg-gray-100 flex flex-col">
          <div className="p-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-600 flex justify-between items-center">
            <span>原文预览</span>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            {project?.file_url && project.file_url.toLowerCase().includes('.pdf') ? (
              <iframe src={project.file_url} className="w-full h-full rounded shadow bg-white border-0" title="PDF预览" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded shadow text-gray-500 border border-gray-200">
                <FileText size={32} className="text-blue-500 mb-4" />
                <p className="text-lg font-medium mb-2">标书已成功解析</p>
                <p className="text-sm text-gray-500 mb-6 text-center">右侧报告已就绪，请下载原文进行对照阅读。</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧解析结果区 */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
          <div className="px-6 pt-4 border-b border-gray-100 shrink-0">
            <Tabs activeKey={activeTab} onChange={setActiveTab} size="large" className="mb-0">
              <TabPane tab="深度解析报告" key="report" />
              <TabPane tab="投标文件完整框架" key="framework" />
              <TabPane tab="商务资料清单" key="checklist" />
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto p-8 relative scroll-smooth flex items-start" ref={scrollContainerRef}>
             {/* 正文渲染 */}
             <div className="flex-1 max-w-3xl pr-4">              
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
                  {currentMarkdown}
                </ReactMarkdown>
             </div>

             {/* 悬浮目录导航 TOC */}
             {tocItems.length > 0 && (
               <div className="w-[280px] shrink-0 hidden lg:block sticky top-0 pl-8 pb-10">
                 <div className="bg-white rounded-lg shadow-sm border border-gray-200 py-3 flex flex-col max-h-[calc(100vh-200px)]">
                   <div className="overflow-y-auto custom-scrollbar px-2">
                     <div className="space-y-0.5">
                       {tocItems.map((item) => {
                         const isActive = activeTocId === item.key;
                         
                         // 【关键修改】：智能判断层级，赋予不同的缩进、字体大小和颜色
                         let indentClass = 'font-bold text-[14px]'; // H1
                         if (item.level === 2) indentClass = 'ml-3 font-medium text-[14px]'; // H2
                         if (item.level === 3) indentClass = 'ml-6 text-[13px] text-gray-600'; // H3
                         if (item.level === 4) indentClass = 'ml-9 text-[12px] text-gray-500'; // H4
                         
                         return (
                           <a
                             key={item.key}
                             href={`#${item.key}`}
                             onClick={(e) => {
                               e.preventDefault();
                               const element = document.getElementById(item.key);
                               if (element) {
                                 element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                 setActiveTocId(item.key);
                               }
                             }}
                             className={`block px-3 py-1.5 rounded-r-md transition-all duration-200 border-l-[3px] ${indentClass} ${
                               isActive
                                 ? 'text-[#6d28d9] font-bold bg-[#f5f3ff] border-[#6d28d9]' 
                                 : 'border-transparent hover:text-[#6d28d9] hover:bg-gray-50'
                             }`}
                           >
                             {item.title}
                           </a>
                         );
                       })}
                     </div>
                   </div>
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BidDetail;