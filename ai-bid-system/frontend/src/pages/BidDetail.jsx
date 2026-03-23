import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Tabs, Spin, Button, Anchor, message } from 'antd';
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

  // 1. 根据 ID 从数据库获取数据
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
        console.error('获取详情失败:', error);
        message.error('未找到该标书的解析数据，请返回重试');
        navigate('/my-bids');
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProjectDetail();
  }, [id, navigate]);

 // 2. 根据当前选中的 Tab 决定显示的 Markdown 内容
  const currentMarkdown = useMemo(() => {
    if (!project) return '';
    let text = '';
    if (activeTab === 'report') text = project.analysis_report || '';
    else if (activeTab === 'framework') text = project.framework_content || '';
    else if (activeTab === 'checklist') text = project.checklist_content || '';
    
    // 修复转义符
    text = text.replace(/\\n/g, '\n');
    // 【魔法正则】：强制在 Markdown 表格前加一个空行，彻底解决表格变成一行的问题
    text = text.replace(/([^\n])\n(\s*\|)/g, '$1\n\n$2');
    
    return text || '暂无数据';
  }, [project, activeTab]);

  // 3. 自动提取当前 Markdown 的 H1/H2 标题生成右侧目录锚点 (TOC)
  const tocItems = useMemo(() => {
    if (!currentMarkdown) return [];
    const regex = /^(#{1,2})\s+(.+)$/gm;
    const items = [];
    let match;
    while ((match = regex.exec(currentMarkdown)) !== null) {
      const level = match[1].length; // 1 or 2
      const title = match[2].trim();
      const slug = title.toLowerCase().replace(/\s+/g, '-');
      items.push({
        key: slug,
        href: `#${slug}`,
        title: title,
        className: level === 1 ? 'font-bold mt-2' : 'ml-4 text-gray-500'
      });
    }
    return items;
  }, [currentMarkdown]);

// 自定义 Markdown 渲染组件（自动给标题加 ID 以便跳转，美化表格）
  const MarkdownComponents = {
    h1: ({node, ...props}) => {
      const id = props.children[0]?.toString().toLowerCase().replace(/\s+/g, '-');
      return <h1 id={id} className="text-2xl font-bold mt-8 mb-4 pb-2 border-b border-gray-200 text-gray-800" {...props} />
    },
    h2: ({node, ...props}) => {
      const id = props.children[0]?.toString().toLowerCase().replace(/\s+/g, '-');
      return <h2 id={id} className="text-xl font-semibold mt-6 mb-3 text-purple-700" {...props} />
    },
    h3: ({node, ...props}) => <h3 className="text-lg font-medium mt-4 mb-2 text-gray-800" {...props} />,
    p: ({node, ...props}) => <p className="mb-4 leading-relaxed text-gray-700" {...props} />,
    ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-4 space-y-1 text-gray-700" {...props} />,
    ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-4 space-y-1 text-gray-700" {...props} />,
    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-purple-500 bg-purple-50 py-2 px-4 rounded-r-md my-4 italic text-gray-700" {...props} />,
    
    // 【核心大修】：完全复刻高级 SaaS 的表格样式
    table: ({node, ...props}) => (
      <div className="overflow-x-auto my-6 rounded-lg border border-[#e4e7ed] shadow-sm">
        <table className="w-full text-left border-collapse bg-white" {...props} />
      </div>
    ),
    thead: ({node, ...props}) => <thead className="bg-[#f5f7fa] border-b border-[#e4e7ed]" {...props} />,
    th: ({node, ...props}) => <th className="px-6 py-4 text-sm font-bold text-[#333] border-r border-[#e4e7ed] last:border-0 whitespace-nowrap" {...props} />,
    td: ({node, ...props}) => <td className="px-6 py-4 text-sm text-[#606266] border-r border-b border-[#e4e7ed] last:border-r-0 hover:bg-blue-50/50 transition-colors align-top leading-relaxed" {...props} />,
   };

  // Markdown 转 HTML 函数
  const markdownToHtml = (markdown) => {
    if (!markdown) return '';
    
    let html = markdown.replace(/\\n/g, '\n');
    
    // 处理标题
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
    
    // 处理加粗和斜体
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // 处理列表
    html = html.replace(/^\s*[-*+] (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      return '<ul>' + match + '</ul>';
    });
    
    // 处理数字列表
    html = html.replace(/^\s*\d+\. (.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
      return '<ol>' + match + '</ol>';
    });
    
    // 处理表格 - 增强的表格支持
    // 先按行分割
    const lines = html.split('\n');
    let inTable = false;
    let tableRows = [];
    let processedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 检测表格行（包含管道符）
      if (line.includes('|') && !line.startsWith('<') && !line.startsWith('#')) {
        // 检查下一行是否是分隔线
        const nextLine = lines[i + 1] || '';
        const isHeader = nextLine.includes('|') && /^[\s\|:-]+$/.test(nextLine.replace(/\|/g, '').trim());
        
        if (!inTable) {
          inTable = true;
          processedLines.push('<table>');
        }
        
        // 解析单元格
        const cells = line.split('|').filter(cell => cell.trim() !== '');
        const cellTag = isHeader ? 'th' : 'td';
        const rowHtml = '<tr>' + cells.map(cell => `<${cellTag}>${cell.trim()}</${cellTag}>`).join('') + '</tr>';
        
        if (isHeader) {
          processedLines.push('<thead>' + rowHtml + '</thead><tbody>');
          i++; // 跳过分隔线
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
    
    if (inTable) {
      processedLines.push('</tbody></table>');
    }
    
    html = processedLines.join('\n');
    
    // 处理引用块
    html = html.replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>');
    
    // 处理代码块
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // 处理段落 - 将剩余的行转换为段落
    html = html.replace(/^(?!<[a-z]|<\/[a-z]|$)(.+)$/gm, '<p>$1</p>');
    
    // 创建完整的 HTML 文档
    return `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>标书解析报告</title>
<style>
/* 全局样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Microsoft YaHei', 'SimSun', sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: #333333;
  padding: 40px;
  background: #ffffff;
  max-width: 210mm;
  margin: 0 auto;
}

/* 段落样式 */
p {
  margin-bottom: 16px;
  text-align: justify;
  text-justify: inter-ideograph;
}

/* 标题样式 */
h1 {
  font-size: 24px;
  font-weight: bold;
  color: #111827;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 12px;
  margin-bottom: 24px;
  margin-top: 32px;
}

h2 {
  font-size: 18px;
  font-weight: bold;
  color: #6d28d9;
  margin-top: 28px;
  margin-bottom: 16px;
}

h3 {
  font-size: 16px;
  font-weight: bold;
  color: #374151;
  margin-top: 24px;
  margin-bottom: 12px;
}

/* 表格样式 */
table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
  font-size: 14px;
}

thead {
  background-color: #f8fafc;
}

th {
  font-weight: bold;
  color: #1e293b;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  text-align: left;
  vertical-align: top;
}

td {
  color: #475569;
  padding: 10px 12px;
  border: 1px solid #cbd5e1;
  vertical-align: top;
}

/* 列表样式 */
ul, ol {
  margin-left: 24px;
  margin-bottom: 16px;
  margin-top: 8px;
}

li {
  margin-bottom: 8px;
  text-align: justify;
}

/* 引用块样式 */
blockquote {
  border-left: 4px solid #8b5cf6;
  background-color: #f5f3ff;
  color: #64748b;
  padding: 12px;
  margin: 16px 0;
  border-radius: 0 4px 4px 0;
}

/* 代码样式 */
pre {
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 16px;
  margin: 16px 0;
  border-radius: 6px;
  overflow-x: auto;
}

code {
  font-family: 'Consolas', 'Monaco', monospace;
  background-color: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 14px;
}

/* 链接样式 */
a {
  color: #2563eb;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}
</style>
</head>
<body>
${html}
</body>
</html>
    `;
  };

  // 下载函数
  const downloadReport = async () => {
    if (!project?.analysis_report) {
      message.warning('深度解析报告内容为空');
      return;
    }
    try {
      const html = markdownToHtml(project.analysis_report);
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.project_name}_深度解析报告.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success('深度解析报告下载开始');
    } catch (error) {
      console.error('生成文档失败:', error);
      message.error('生成文档失败，请重试');
    }
  };

  const downloadFramework = async () => {
    if (!project?.framework_content) {
      message.warning('投标文件完整框架内容为空');
      return;
    }
    try {
      const html = markdownToHtml(project.framework_content);
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.project_name}_投标文件完整框架.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success('投标文件完整框架下载开始');
    } catch (error) {
      console.error('生成文档失败:', error);
      message.error('生成文档失败，请重试');
    }
  };

  const downloadChecklist = async () => {
    if (!project?.checklist_content) {
      message.warning('商务资料清单内容为空');
      return;
    }
    try {
      const html = markdownToHtml(project.checklist_content);
      const blob = new Blob([html], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.project_name}_商务资料清单.doc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      message.success('商务资料清单下载开始');
    } catch (error) {
      console.error('生成文档失败:', error);
      message.error('生成文档失败，请重试');
    }
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
              <h1 className="text-lg font-bold text-gray-800 leading-tight">
                {project?.project_name || '标书深度解析详情'}
              </h1>
              <p className="text-xs text-green-600 flex items-center mt-0.5">
                <span className="w-2 h-2 rounded-full bg-green-500 mr-1.5"></span> AI 解析已完成
              </p>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button type="primary" icon={<Download size={16} />} onClick={downloadReport} className="bg-purple-600">
            深度解析报告
          </Button>
          <Button type="primary" icon={<Download size={16} />} onClick={downloadFramework} className="bg-green-600">
            投标文件完整框架
          </Button>
          <Button type="primary" icon={<Download size={16} />} onClick={downloadChecklist} className="bg-blue-600">
            商务资料清单
          </Button>
        </div>
      </div>

      {/* 主体分栏区域 */}
      <div className="flex-1 flex overflow-hidden">
        
       {/* 左侧：原文预览区 (占宽 40%) */}
        <div className="w-[40%] border-r border-gray-200 bg-gray-100 flex flex-col">
          <div className="p-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-600 flex justify-between items-center">
            <span>原文预览</span>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            {project?.file_url ? (
              // 智能判断：如果是 PDF，正常渲染
              project.file_url.toLowerCase().includes('.pdf') ? (
                <iframe src={project.file_url} className="w-full h-full rounded shadow bg-white border-0" title="PDF预览" />
              ) : (
                // 如果是 DOCX，显示优雅的替代 UI
                <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded shadow text-gray-500 border border-gray-200">
                  <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    <FileText size={32} className="text-blue-500" />
                  </div>
                  <p className="text-lg font-medium mb-2 text-gray-800">标书已成功解析</p>
                  <p className="text-sm text-gray-500 mb-6 text-center px-8">
                    由于不可控力原因Word 文档无法在此直接预览。（pdf可以）<br/>
                    <span className="text-purple-600 mt-2 inline-block">右侧深度解析报告已就绪，请下载进行对照阅读。</span>
                  </p>
                </div>
              )
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-white rounded shadow text-gray-400 border border-dashed border-gray-300">
                <FileText size={48} className="mb-4 text-gray-300" />
                <p>文件原文暂未存储至云端，无法预览</p>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：AI 解析结果区 (占宽 60%) */}
        <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
          <div className="px-6 pt-4 border-b border-gray-100 shrink-0">
            <Tabs activeKey={activeTab} onChange={setActiveTab} size="large" className="mb-0">
              <TabPane tab="深度解析报告" key="report" />
              <TabPane tab="投标文件完整框架" key="framework" />
              <TabPane tab="商务资料清单" key="checklist" />
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto p-8 relative scroll-smooth flex">
            {/* Markdown 正文渲染 */}
                <div className="flex-1 max-w-4xl pr-8">              
                    <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={MarkdownComponents}
              >
                {currentMarkdown}
              </ReactMarkdown>
            </div>

            {/* 悬浮目录导航 TOC */}
            {tocItems.length > 0 && (
              <div className="w-48 shrink-0 hidden lg:block sticky top-0 self-start">
                <div className="pl-4 border-l-2 border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">本页导航</h4>
                  <Anchor 
                    affix={false} 
                    items={tocItems} 
                    targetOffset={80} // 防止顶部导航栏遮挡标题
                    className="custom-anchor text-sm"
                  />
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