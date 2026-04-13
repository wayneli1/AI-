import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button, Spin, message } from 'antd';
import { ArrowLeft, ChevronLeft, ChevronRight, Eye, EyeOff, List } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderAsync } from 'docx-preview';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { convertToMarkdown } from '../utils/documentParser';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const SOURCE_SECTION_KEYWORDS = [
  '招标公告',
  '投标人须知',
  '评标办法',
  '采购需求',
  '项目要求',
  '合同',
  '投标文件格式',
  '投标格式',
  '附件',
  '投标函',
  '授权委托书',
  '法定代表人',
  '报价一览表'
];

const FRAMEWORK_SECTION_KEYWORDS = [
  '投标文件格式',
  '投标格式',
  '附件',
  '投标函',
  '法定代表人',
  '授权委托书',
  '报价一览表',
  '资格审查',
  '商务偏离',
  '技术偏离'
];

const slugify = (value = '') =>
  String(value)
    .replace(/<[^>]+>/g, '')
    .replace(/[【】]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fa5-]/g, '')
    .toLowerCase();

const normalizeMarkdown = (value = '') => {
  const text = String(value || '').replace(/\\n/g, '\n');
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');
  const fixed = [];

  for (let i = 0; i < lines.length; i += 1) {
    const current = lines[i];
    const trimmed = current.trim();
    const prev = fixed[fixed.length - 1] || '';
    const next = lines[i + 1] || '';
    const currentLooksLikeTable = trimmed.includes('|');
    const prevLooksLikeTable = prev.trim().includes('|');
    const nextLooksLikeTable = next.trim().includes('|');

    if (!trimmed && prevLooksLikeTable && nextLooksLikeTable) {
      continue;
    }

    if (currentLooksLikeTable && fixed.length > 0 && prev.trim() && !prevLooksLikeTable) {
      fixed.push('');
    }

    fixed.push(current);
  }

  return fixed.join('\n').trim();
};

const uniqueByKey = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.key || seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
};

const parseMarkdownSections = (markdown = '') => {
  const normalized = normalizeMarkdown(markdown);
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const sections = [];
  let current = null;

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      if (current) sections.push(current);
      current = {
        level: match[1].length,
        title: match[2].trim(),
        key: slugify(match[2]),
        content: [line]
      };
      continue;
    }

    if (!current) {
      current = { level: 1, title: '', key: '', content: [] };
    }
    current.content.push(line);
  }

  if (current) sections.push(current);
  return sections.filter((section) => section.title || section.content.join('').trim());
};

const extractSourceNavigation = (sourceMarkdown = '') => {
  const sections = parseMarkdownSections(sourceMarkdown);
  const candidates = sections
    .filter((section) => section.title)
    .filter((section) => {
      const title = section.title.trim();
      return (
        section.level <= 3 ||
        SOURCE_SECTION_KEYWORDS.some((keyword) => title.includes(keyword)) ||
        /^第[一二三四五六七八九十百]+[章节编部分]/.test(title)
      );
    })
    .map((section, index) => ({
      key: section.key || `source-${index}`,
      title: section.title,
      level: section.level,
      type: 'source'
    }));

  return uniqueByKey(candidates).slice(0, 12);
};

const extractReportToc = (markdown = '') => {
  const normalized = normalizeMarkdown(markdown);
  if (!normalized) return [];

  const regex = /^(#{2,3})\s+(.+)$/gm;
  const items = [];
  let match;
  while ((match = regex.exec(normalized)) !== null) {
    const title = match[2].trim();
    items.push({
      key: slugify(title),
      title,
      level: match[1].length
    });
  }

  return uniqueByKey(items);
};

const buildReportMetaItems = (project, sourceNavigation) => {
  const primary = sourceNavigation.slice(0, 6).map((item) => ({
    ...item,
    label: item.title
  }));

  if (primary.length > 0) return primary;

  return [
    { key: 'project-name', title: project?.project_name || '项目名称', label: project?.project_name || '项目名称' }
  ];
};

const buildFrameworkMarkdown = (frameworkContent, sourceMarkdown) => {
  const normalizedFramework = normalizeMarkdown(frameworkContent);
  const sourceSections = parseMarkdownSections(sourceMarkdown);
  if (!sourceSections.length) return normalizedFramework;

  const matchedSections = sourceSections.filter((section) => {
    const haystack = `${section.title}\n${section.content.join('\n')}`;
    return FRAMEWORK_SECTION_KEYWORDS.some((keyword) => haystack.includes(keyword));
  });

  const supplement = matchedSections
    .slice(0, 8)
    .map((section) => section.content.join('\n').trim())
    .filter(Boolean)
    .join('\n\n');

  if (!supplement) return normalizedFramework;
  if (!normalizedFramework) return supplement;

  const hasFrameworkSection = FRAMEWORK_SECTION_KEYWORDS.some((keyword) => normalizedFramework.includes(keyword));
  if (hasFrameworkSection && normalizedFramework.length > 600) return normalizedFramework;

  return `${normalizedFramework}\n\n# 原文投标格式补充\n\n${supplement}`.trim();
};

const buildChecklistMarkdown = (checklistContent) => {
  const normalized = normalizeMarkdown(checklistContent);
  if (!normalized) return '';
  if (/\|\s*[-:]+\s*\|/.test(normalized)) return normalized;

  const rows = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^[-*\d一二三四五六七八九十、.．（）()]*\s*([^：:]+)[：:]+\s*(.+)$/);
      if (match) {
        return [match[1].trim(), match[1].trim(), match[2].trim()];
      }
      return [line, line, ''];
    });

  const body = rows.map((row) => `| ${row[0]} | ${row[1]} | ${row[2]} |`).join('\n');
  return `# 资料清单\n\n| 资料名称 | 资料内容 | 说明 |\n| --- | --- | --- |\n${body}`;
};

const markdownToHtml = (markdown, variant = 'report', title = '标书解读报告') => {
  const normalized = normalizeMarkdown(markdown);
  let html = normalized;
  html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  html = html.replace(/^#### (.*$)/gm, '<h4>$1</h4>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/^\s*[-*+] (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);
  html = html.replace(/^\s*\d+\. (.*$)/gm, '<li>$1</li>');
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ol>${match}</ol>`);

  const lines = html.split('\n');
  let inTable = false;
  const processedLines = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.includes('|') && !line.startsWith('<') && !line.startsWith('#')) {
      const nextLine = lines[i + 1] || '';
      const isHeader = nextLine.includes('|') && /^[\s\|:-]+$/.test(nextLine.replace(/\|/g, '').trim());
      if (!inTable) {
        inTable = true;
        processedLines.push('<table>');
      }
      const cells = line.split('|').filter((cell) => cell.trim() !== '');
      const cellTag = isHeader ? 'th' : 'td';
      processedLines.push(`<tr>${cells.map((cell) => `<${cellTag}>${cell.trim()}</${cellTag}>`).join('')}</tr>`);
      if (isHeader) {
        processedLines.splice(processedLines.length - 1, 1, `<thead>${processedLines[processedLines.length - 1]}</thead><tbody>`);
        i += 1;
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

  const pageStyle =
    variant === 'framework'
      ? 'body { font-family: SimSun, Microsoft YaHei, serif; font-size: 17px; line-height: 1.9; color: #111827; padding: 44px 56px; background: #ffffff; max-width: 210mm; margin: 0 auto; } h1 { text-align: center; font-size: 32px; margin: 12px 0 32px; } h2 { font-size: 24px; margin: 30px 0 18px; text-align: center; } h3 { font-size: 20px; margin: 24px 0 14px; }'
      : variant === 'checklist'
        ? 'body { font-family: SimSun, Microsoft YaHei, serif; font-size: 16px; line-height: 1.8; color: #111827; padding: 40px 48px; background: #ffffff; max-width: 210mm; margin: 0 auto; } h1 { text-align: center; font-size: 34px; margin: 10px 0 26px; } h2 { font-size: 24px; margin: 28px 0 20px; } h3 { font-size: 18px; margin: 20px 0 12px; }'
        : 'body { font-family: Microsoft YaHei, SimSun, sans-serif; font-size: 15px; line-height: 1.75; color: #111827; padding: 40px 48px; background: #ffffff; max-width: 210mm; margin: 0 auto; } h1 { font-size: 28px; margin: 0 0 22px; padding-bottom: 12px; border-bottom: 1px solid #d1d5db; } h2 { font-size: 22px; margin: 28px 0 16px; } h3 { font-size: 18px; margin: 20px 0 10px; }';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>*{box-sizing:border-box;} ${pageStyle} p { margin: 0 0 14px; text-align: justify; } table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; } thead { background: #f8fafc; } th, td { border: 1px solid #d1d5db; padding: 10px 12px; text-align: left; vertical-align: top; } ul, ol { margin: 0 0 16px 24px; } li { margin-bottom: 8px; } blockquote { margin: 16px 0; padding: 12px 16px; border-left: 4px solid #8b5cf6; background: #f5f3ff; } code { background: #f3f4f6; padding: 2px 6px; border-radius: 4px; } pre { background: #f3f4f6; padding: 14px; overflow: auto; } strong { font-weight: 700; }</style></head><body>${html}</body></html>`;
};

const buildPdfLines = (items = [], viewport) => {
  const positioned = items
    .filter((item) => String(item.str || '').trim())
    .map((item) => {
      const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
      return {
        text: String(item.str || '').trim(),
        left: tx[4],
        top: tx[5] - fontSize,
        width: Math.max(item.width * viewport.scale, 8),
        height: Math.max(fontSize, 10),
        fontSize
      };
    });

  const lines = [];
  for (const item of positioned) {
    const current = lines.find((line) => Math.abs(line.top - item.top) <= 6);
    if (current) {
      current.items.push(item);
      current.left = Math.min(current.left, item.left);
      current.top = Math.min(current.top, item.top);
      current.height = Math.max(current.height, item.height);
      current.text = `${current.text} ${item.text}`.trim();
      current.fontSize = Math.max(current.fontSize, item.fontSize);
    } else {
      lines.push({
        items: [item],
        text: item.text,
        left: item.left,
        top: item.top,
        height: item.height,
        fontSize: item.fontSize
      });
    }
  }

  return lines.sort((a, b) => a.top - b.top);
};

const extractPdfHeadings = (lines = [], pageNumber) => {
  if (!lines.length) return [];
  const fontSizes = lines.map((line) => line.fontSize);
  const maxSize = Math.max(...fontSizes);
  const avgSize = fontSizes.reduce((sum, value) => sum + value, 0) / fontSizes.length;

  return lines
    .filter((line) => {
      const title = line.text.trim();
      return (
        line.fontSize >= avgSize + (maxSize - avgSize) * 0.18 ||
        SOURCE_SECTION_KEYWORDS.some((keyword) => title.includes(keyword)) ||
        /^第[一二三四五六七八九十百]+[章节编部分]/.test(title)
      );
    })
    .slice(0, 6)
    .map((line, index) => ({
      key: `${slugify(line.text)}-${pageNumber}-${index}`,
      title: line.text.trim(),
      pageNumber,
      top: line.top
    }));
};

const matchTitle = (a = '', b = '') => {
  const left = String(a).replace(/\s+/g, '');
  const right = String(b).replace(/\s+/g, '');
  return left.includes(right) || right.includes(left);
};

const inferFileExtension = (url = '', contentType = '', projectName = '') => {
  const lowerUrl = String(url).toLowerCase();
  const lowerType = String(contentType).toLowerCase();
  const lowerName = String(projectName).toLowerCase();

  if (lowerType.includes('pdf') || lowerUrl.includes('.pdf') || lowerName.endsWith('.pdf')) return 'pdf';
  if (
    lowerType.includes('wordprocessingml') ||
    lowerType.includes('docx') ||
    lowerUrl.includes('.docx') ||
    lowerName.endsWith('.docx')
  ) {
    return 'docx';
  }

  return '';
};

const BidDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState(null);
  const [activeTab, setActiveTab] = useState('report');
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [originalFile, setOriginalFile] = useState(null);
  const [originalFileExt, setOriginalFileExt] = useState('');
  const [sourceMarkdown, setSourceMarkdown] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [fileDebugInfo, setFileDebugInfo] = useState('');
  const [pdfPages, setPdfPages] = useState([]);
  const [activeSourceId, setActiveSourceId] = useState('');
  const [activeTocId, setActiveTocId] = useState('');
  const [isTocExpanded, setIsTocExpanded] = useState(false);

  const scrollContainerRef = useRef(null);
  const previewScrollRef = useRef(null);
  const docxPreviewRef = useRef(null);
  const pdfCanvasRefs = useRef({});
  const pdfPageProxyRef = useRef({});
  const sourceAnchorRefs = useRef({});

  useEffect(() => {
    const fetchProjectDetail = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('bidding_projects').select('*').eq('id', id).single();
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

  useEffect(() => {
    if (!project?.file_url) return undefined;

    let cancelled = false;

    const loadOriginalFile = async () => {
      try {
        setPreviewLoading(true);
        setPreviewError('');
        setPdfPages([]);
        pdfCanvasRefs.current = {};
        pdfPageProxyRef.current = {};
        sourceAnchorRefs.current = {};

        const response = await fetch(project.file_url);
        const blob = await response.blob();
        if (cancelled) return;

        const fileExt = inferFileExtension(project.file_url, blob.type, project.project_name || '');
        const fallbackName = `${project.project_name || 'bid'}${fileExt ? `.${fileExt}` : ''}`;
        const fileNameFromUrl = decodeURIComponent(project.file_url.split('/').pop()?.split('?')[0] || fallbackName);
        const finalName = fileNameFromUrl.includes('.') ? fileNameFromUrl : fallbackName;
        const file = new File([blob], finalName, { type: blob.type || 'application/octet-stream' });
        setOriginalFile(file);
        setOriginalFileExt(fileExt || finalName.split('.').pop()?.toLowerCase() || '');
        setFileDebugInfo(`type=${blob.type || 'unknown'}; ext=${fileExt || 'unknown'}; name=${finalName}`);

        try {
          const markdown = await convertToMarkdown(file);
          if (!cancelled) setSourceMarkdown(markdown);
        } catch (markdownError) {
          console.error('原文结构提取失败:', markdownError);
          if (!cancelled) setSourceMarkdown('');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('原文恢复失败:', error);
          setPreviewError('原文文件加载失败，请稍后重试');
          setFileDebugInfo(String(error?.message || error));
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    loadOriginalFile();
    return () => {
      cancelled = true;
    };
  }, [project?.file_url, project?.project_name]);

  const sourceNavigation = useMemo(() => extractSourceNavigation(sourceMarkdown), [sourceMarkdown]);
  const reportMetaItems = useMemo(() => buildReportMetaItems(project, sourceNavigation), [project, sourceNavigation]);

  const reportMarkdown = useMemo(() => normalizeMarkdown(project?.analysis_report || ''), [project?.analysis_report]);
  const frameworkMarkdown = useMemo(
    () => buildFrameworkMarkdown(project?.framework_content || '', sourceMarkdown),
    [project?.framework_content, sourceMarkdown]
  );
  const checklistMarkdown = useMemo(() => buildChecklistMarkdown(project?.checklist_content || ''), [project?.checklist_content]);

  const currentMarkdown = useMemo(() => {
    if (activeTab === 'framework') return frameworkMarkdown || '暂无投标文件完整框架内容';
    if (activeTab === 'checklist') return checklistMarkdown || '暂无商务资料清单内容';
    return reportMarkdown || '暂无深度解读报告内容';
  }, [activeTab, frameworkMarkdown, checklistMarkdown, reportMarkdown]);

  const tocItems = useMemo(() => extractReportToc(currentMarkdown), [currentMarkdown]);

  useEffect(() => {
    const file = originalFile;
    const container = docxPreviewRef.current;
    if (!file) return undefined;

    const fileExt = originalFileExt || file.name.split('.').pop()?.toLowerCase();
    if (fileExt !== 'docx' || !container) {
      if (fileExt !== 'pdf') setPdfPages([]);
      return undefined;
    }

    let cancelled = false;

    const renderDocxPreview = async () => {
      try {
        setPreviewLoading(true);
        setPreviewError('');
        container.innerHTML = '';
        const arrayBuffer = await file.arrayBuffer();
        if (cancelled) return;

        await renderAsync(arrayBuffer, container, null, {
          className: 'docx-preview-render',
          ignoreWidth: false,
          ignoreHeight: true,
          inWrapper: true,
          breakPages: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true
        });

        if (cancelled) return;

        const blocks = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6, p'));
        const anchors = {};
        sourceNavigation.forEach((item) => {
          const target = blocks.find((node) => matchTitle(node.textContent || '', item.title));
          if (target) {
            target.dataset.sourceAnchor = item.key;
            anchors[item.key] = target;
          }
        });
        sourceAnchorRefs.current = anchors;
      } catch (error) {
        if (!cancelled) {
          console.error('DOCX 预览渲染失败:', error);
          setPreviewError('DOCX 原文预览渲染失败');
          setFileDebugInfo(`docx render failed: ${String(error?.message || error)}`);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    renderDocxPreview();
    return () => {
      cancelled = true;
    };
  }, [originalFile, originalFileExt, sourceNavigation]);

  useEffect(() => {
    const file = originalFile;
    if (!file || (originalFileExt || file.name.split('.').pop()?.toLowerCase()) !== 'pdf') return undefined;

    let cancelled = false;

    const renderPdfPreview = async () => {
      try {
        setPreviewLoading(true);
        setPreviewError('');

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pages = [];
        const fallbackNavigation = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 1.35 });
          const textContent = await page.getTextContent();
          const lines = buildPdfLines(textContent.items, viewport);
          const headings = extractPdfHeadings(lines, pageNumber);
          fallbackNavigation.push(...headings);
          pdfPageProxyRef.current[pageNumber] = page;
          pages.push({
            pageNumber,
            width: viewport.width,
            height: viewport.height,
            viewport,
            lines,
            textItems: lines.flatMap((line) => line.items),
            anchors: []
          });
        }

        if (cancelled) return;

        const navForMatch = sourceNavigation.length
          ? sourceNavigation
          : uniqueByKey(
              fallbackNavigation.map((item) => ({
                key: slugify(item.title),
                title: item.title,
                level: 1,
                type: 'source'
              }))
            );

        const nextPages = pages.map((page) => {
          const anchors = navForMatch
            .map((nav) => {
              const targetLine = page.lines.find((line) => matchTitle(line.text, nav.title));
              if (!targetLine) return null;
              return {
                key: nav.key,
                title: nav.title,
                top: targetLine.top,
                height: targetLine.height
              };
            })
            .filter(Boolean);

          return { ...page, anchors };
        });

        const anchorRegistry = {};
        nextPages.forEach((page) => {
          page.anchors.forEach((anchor) => {
            anchorRegistry[anchor.key] = { pageNumber: page.pageNumber, top: anchor.top };
          });
        });

        sourceAnchorRefs.current = anchorRegistry;
        setPdfPages(nextPages);
      } catch (error) {
        if (!cancelled) {
          console.error('PDF 原文预览渲染失败:', error);
          setPreviewError('PDF 原文预览渲染失败');
          setFileDebugInfo(`pdf render failed: ${String(error?.message || error)}`);
        }
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    renderPdfPreview();
    return () => {
      cancelled = true;
    };
  }, [originalFile, originalFileExt, sourceNavigation]);

  useEffect(() => {
    if (!pdfPages.length) return undefined;

    let cancelled = false;
    const renderCanvases = async () => {
      for (const page of pdfPages) {
        const canvas = pdfCanvasRefs.current[page.pageNumber];
        const pageProxy = pdfPageProxyRef.current[page.pageNumber];
        if (!canvas || !pageProxy || cancelled) continue;
        const context = canvas.getContext('2d');
        canvas.width = page.width;
        canvas.height = page.height;
        canvas.style.width = `${page.width}px`;
        canvas.style.height = `${page.height}px`;
        await pageProxy.render({ canvasContext: context, viewport: page.viewport }).promise;
      }
    };

    renderCanvases();
    return () => {
      cancelled = true;
    };
  }, [pdfPages]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || tocItems.length === 0) return undefined;

    const handleScroll = () => {
      const containerTop = container.getBoundingClientRect().top;
      const headings = tocItems
        .map((item) => {
          const element = document.getElementById(item.key);
          if (!element) return null;
          return { id: item.key, top: element.getBoundingClientRect().top - containerTop };
        })
        .filter(Boolean);

      if (!headings.length) return;
      let current = headings[0].id;
      for (const heading of headings) {
        if (heading.top <= 160) current = heading.id;
      }
      setActiveTocId(current);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [tocItems]);

  useEffect(() => {
    const container = previewScrollRef.current;
    if (!container || sourceNavigation.length === 0) return undefined;

    const handlePreviewScroll = () => {
      const entries = sourceNavigation
        .map((item) => {
          const ref = sourceAnchorRefs.current[item.key];
          if (!ref) return null;

          if (ref instanceof Element) {
            const top = ref.getBoundingClientRect().top - container.getBoundingClientRect().top;
            return { key: item.key, top };
          }

          const pageElement = container.querySelector(`[data-page-number="${ref.pageNumber}"]`);
          if (!pageElement) return null;
          const top = pageElement.getBoundingClientRect().top - container.getBoundingClientRect().top + (ref.top || 0);
          return { key: item.key, top };
        })
        .filter(Boolean);

      if (!entries.length) return;
      let current = entries[0].key;
      for (const entry of entries) {
        if (entry.top <= 140) current = entry.key;
      }
      setActiveSourceId(current);
    };

    container.addEventListener('scroll', handlePreviewScroll);
    handlePreviewScroll();
    return () => container.removeEventListener('scroll', handlePreviewScroll);
  }, [sourceNavigation, pdfPages]);

  const jumpToSourceSection = (item) => {
    const container = previewScrollRef.current;
    const target = sourceAnchorRefs.current[item.key];
    if (!container || !target) return;

    if (target instanceof Element) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSourceId(item.key);
      return;
    }

    const pageElement = container.querySelector(`[data-page-number="${target.pageNumber}"]`);
    if (!pageElement) return;

    const pageTop = pageElement.offsetTop + (target.top || 0) - 24;
    container.scrollTo({ top: pageTop, behavior: 'smooth' });
    setActiveSourceId(item.key);
  };

  const jumpToToc = (item) => {
    const element = document.getElementById(item.key);
    const container = scrollContainerRef.current;
    if (!element || !container) return;

    const containerRect = container.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const targetTop = container.scrollTop + (elementRect.top - containerRect.top) - 28;

    container.scrollTo({
      top: Math.max(targetTop, 0),
      behavior: 'smooth'
    });
    setActiveTocId(item.key);
    setIsTocExpanded(false);
  };

  const renderHeading = (Tag, className) => ({ children, ...props }) => {
    const title = Array.isArray(children) ? children.join('') : String(children || '');
    const id = slugify(title);
    return (
      <Tag id={id} className={className} {...props}>
        {children}
      </Tag>
    );
  };

  const markdownComponents = useMemo(() => {
    const headingClassMap = {
      report: {
        h1: 'text-[30px] font-black tracking-tight text-[#111827] mb-6 pb-4 border-b border-gray-200 scroll-mt-24',
        h2: 'text-[24px] font-bold text-[#111827] mt-10 mb-5 scroll-mt-24',
        h3: 'text-[18px] font-bold text-[#374151] mt-7 mb-3 scroll-mt-24'
      },
      framework: {
        h1: 'text-[34px] font-bold text-center tracking-[0.08em] text-[#111827] mb-10 scroll-mt-24',
        h2: 'text-[26px] font-bold text-center text-[#111827] mt-10 mb-6 scroll-mt-24',
        h3: 'text-[22px] font-semibold text-[#111827] mt-8 mb-4 scroll-mt-24'
      },
      checklist: {
        h1: 'text-[34px] font-bold text-center text-[#111827] mb-8 scroll-mt-24',
        h2: 'text-[24px] font-bold text-[#111827] mt-10 mb-5 scroll-mt-24',
        h3: 'text-[18px] font-semibold text-[#111827] mt-6 mb-4 scroll-mt-24'
      }
    };

    const classes = headingClassMap[activeTab] || headingClassMap.report;

    return {
      h1: renderHeading('h1', classes.h1),
      h2: renderHeading('h2', classes.h2),
      h3: renderHeading('h3', classes.h3),
      p: ({ ...props }) => (
        <p
          className={`text-[#1f2937] leading-[1.95] ${activeTab === 'framework' ? 'text-[19px] indent-8 font-serif' : 'text-[15px]'} mb-4`}
          {...props}
        />
      ),
      ul: ({ ...props }) => <ul className="list-disc ml-6 mb-5 text-[#1f2937] leading-[1.9]" {...props} />,
      ol: ({ ...props }) => <ol className="list-decimal ml-6 mb-5 text-[#1f2937] leading-[1.9]" {...props} />,
      li: ({ ...props }) => <li className={`mb-2 ${activeTab === 'framework' ? 'text-[18px]' : 'text-[15px]'}`} {...props} />,
      table: ({ ...props }) => (
        <div className={`my-6 overflow-x-auto rounded-xl border border-gray-200 bg-white ${activeTab === 'checklist' ? 'shadow-[0_18px_40px_rgba(15,23,42,0.05)]' : ''}`}>
          <table className="w-full border-collapse text-[14px]" {...props} />
        </div>
      ),
      thead: ({ ...props }) => <thead className="bg-[#f8fafc]" {...props} />,
      th: ({ ...props }) => (
        <th className="border border-gray-200 px-4 py-3 text-left align-top text-[14px] font-semibold text-[#111827]" {...props} />
      ),
      td: ({ ...props }) => (
        <td className={`border border-gray-200 px-4 py-3 align-top text-[#374151] ${activeTab === 'checklist' ? 'text-[15px] leading-[1.8]' : 'text-[14px]'}`} {...props} />
      ),
      blockquote: ({ ...props }) => (
        <blockquote className="my-5 rounded-2xl border border-purple-100 bg-purple-50/70 px-5 py-4 text-[#4b5563]" {...props} />
      )
    };
  }, [activeTab]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#f8fafc]">
        <Spin size="large" />
        <p className="mt-4 text-gray-500">正在加载招标解读工作台...</p>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-64px)] bg-[#eef2f7] text-[#111827]">
      <div className="flex h-full flex-col">
        <div className="shrink-0 border-b border-[#d9e1ec] bg-[#f7f9fc] px-5 py-3">
          <div className="flex items-center gap-3">
            <Button icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} type="text" className="text-gray-500 hover:text-violet-600" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-base font-semibold text-[#111827]">{project?.project_name || '招标文件解读报告'}</div>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className={`${isPreviewCollapsed ? 'w-[72px]' : 'w-[46%] min-w-[360px] max-w-[760px]'} relative flex shrink-0 flex-col border-r border-[#d9e1ec] bg-[#e9eef5] transition-all duration-300`}>
            <div className="flex h-14 items-center justify-between border-b border-[#d9e1ec] bg-[#f7f9fc] px-4">
              <div className={`flex items-center gap-3 ${isPreviewCollapsed ? 'justify-center w-full' : ''}`}>
                {!isPreviewCollapsed && originalFileExt && (
                  <span className="rounded-full border border-[#d8e0eb] bg-white px-2.5 py-1 text-[11px] text-gray-500">{originalFileExt.toUpperCase()}</span>
                )}
              </div>

              <Button
                type="text"
                icon={isPreviewCollapsed ? <Eye size={16} /> : <EyeOff size={16} />}
                onClick={() => setIsPreviewCollapsed((value) => !value)}
                className="text-gray-500 hover:text-violet-600"
              />
            </div>

            {!isPreviewCollapsed && (
              <div ref={previewScrollRef} className="min-h-0 flex-1 overflow-auto p-5">
                {previewLoading && (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#cfd8e6] bg-[#f8fafc]">
                    <Spin size="large" />
                    <p className="mt-4 text-sm text-gray-500">正在构建原文预览与定位索引...</p>
                  </div>
                )}

                {!previewLoading && previewError && (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-3xl border border-red-100 bg-[#f8fafc] px-6 text-center">
                    <p className="text-sm text-red-500">{previewError}</p>
                    {!!fileDebugInfo && <p className="mt-2 max-w-md break-all text-xs text-gray-400">{fileDebugInfo}</p>}
                    {project?.file_url && (
                      <a
                        href={project.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 rounded-full border border-violet-200 px-4 py-2 text-sm text-violet-600 hover:bg-violet-50"
                      >
                        打开原文件
                      </a>
                    )}
                  </div>
                )}

                {!previewLoading && !previewError && originalFileExt === 'docx' && (
                  <div className="rounded-[28px] border border-[#d7dee9] bg-[#fdfefe] p-3 shadow-[0_24px_50px_rgba(15,23,42,0.06)]">
                    <div
                      ref={docxPreviewRef}
                      className="docx-preview-host min-h-full overflow-auto rounded-[22px] bg-white [&_.docx-wrapper]:!items-start [&_.docx-wrapper]:!p-4 md:[&_.docx-wrapper]:!p-6 [&_.docx-wrapper_section.docx]:!mx-auto"
                    />
                  </div>
                )}

                {!previewLoading && !previewError && originalFileExt === 'pdf' && (
                  <div className="space-y-6">
                    {pdfPages.map((page) => (
                      <div
                        key={page.pageNumber}
                        data-page-number={page.pageNumber}
                        className="relative mx-auto w-fit rounded-[28px] border border-[#d7dee9] bg-[#fdfefe] p-3 shadow-[0_24px_50px_rgba(15,23,42,0.06)]"
                      >
                        <div className="absolute right-5 top-4 rounded-full bg-black/70 px-2.5 py-1 text-[11px] text-white">第 {page.pageNumber} 页</div>
                        <div className="relative overflow-hidden rounded-[20px] bg-white" style={{ width: page.width, height: page.height }}>
                          <canvas ref={(node) => { pdfCanvasRefs.current[page.pageNumber] = node; }} className="block" />
                          <div className="pointer-events-none absolute inset-0">
                            {page.anchors.map((anchor) => (
                              <div
                                key={anchor.key}
                                className={`absolute left-0 right-0 rounded-md transition ${activeSourceId === anchor.key ? 'bg-violet-200/40 ring-1 ring-violet-400/50' : 'bg-transparent'}`}
                                style={{ top: anchor.top, height: Math.max(anchor.height + 6, 18) }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {!previewLoading && !previewError && !originalFileExt && (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-3xl border border-[#d7dee9] bg-[#f8fafc] px-6 text-center">
                    <p className="text-sm text-gray-500">当前文件类型暂不支持内嵌预览</p>
                    {project?.file_url && (
                      <a
                        href={project.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-4 rounded-full border border-violet-200 px-4 py-2 text-sm text-violet-600 hover:bg-violet-50"
                      >
                        打开原文件
                      </a>
                    )}
                  </div>
                )}
              </div>
            )}

            {isPreviewCollapsed && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-white/60">
                <button
                  type="button"
                  onClick={() => setIsPreviewCollapsed(false)}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 shadow-sm hover:text-violet-600"
                >
                  <ChevronRight size={18} />
                </button>
                <div className="rotate-180 text-xs tracking-[0.3em] text-gray-400 [writing-mode:vertical-rl]">原文</div>
              </div>
            )}
          </div>

          {isPreviewCollapsed && (
            <button
              type="button"
              onClick={() => setIsPreviewCollapsed(false)}
              className="flex w-8 items-center justify-center border-r border-[#d9e1ec] bg-[#f7f9fc] text-gray-400 hover:text-violet-600"
            >
              <ChevronRight size={18} />
            </button>
          )}

          {!isPreviewCollapsed && (
            <button
              type="button"
              onClick={() => setIsPreviewCollapsed(true)}
              className="flex w-8 items-center justify-center border-r border-[#d9e1ec] bg-[#f7f9fc] text-gray-400 hover:text-violet-600"
            >
              <ChevronLeft size={18} />
            </button>
          )}

          <div className="relative min-w-0 flex-1 overflow-hidden bg-[#f3f6fb]">
              <div className="sticky top-0 z-20 border-b border-[#d9e1ec] bg-[#f7f9fc]/95 px-8 py-4 backdrop-blur-sm">
              <div className="flex min-h-[44px] items-center justify-start gap-3 overflow-x-auto">
                {[
                  { key: 'report', label: '深度解读报告' },
                  { key: 'framework', label: '投标文件完整框架' },
                  { key: 'checklist', label: '商务资料清单' }
                ].map((tab) => {
                  const active = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`inline-flex h-11 shrink-0 items-center rounded-full px-5 py-2 text-sm font-medium whitespace-nowrap transition ${
                        active
                          ? 'bg-violet-500 text-white shadow-[0_10px_30px_rgba(139,92,246,0.28)]'
                          : 'border border-[#d8e0eb] bg-[#fbfcfe] text-gray-500 hover:border-violet-300 hover:text-violet-600'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div ref={scrollContainerRef} className="h-full overflow-y-auto px-8 pb-36 pt-8">
              <div className="mx-auto max-w-5xl">
                <div className="rounded-[32px] border border-[#d7dee9] bg-[#fffefe] px-10 py-10 shadow-[0_24px_60px_rgba(15,23,42,0.06)] md:px-14">
                  <div className="mb-8 border-b border-[#e1e7f0] pb-6">
                    <div className="text-sm font-medium text-gray-500">招标文件解读报告</div>
                  </div>

                  <div className={activeTab === 'framework' ? 'font-serif' : ''}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {currentMarkdown}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>

            {tocItems.length > 0 && (
              <div
                className="pointer-events-auto absolute right-8 top-20 hidden lg:block"
                onMouseEnter={() => setIsTocExpanded(true)}
                onMouseLeave={() => setIsTocExpanded(false)}
              >
                <div
                  className={`overflow-hidden rounded-2xl border border-sky-200 bg-[rgba(239,246,255,0.96)] text-slate-700 shadow-[0_20px_45px_rgba(59,130,246,0.16)] backdrop-blur-sm transition-all duration-200 ${
                    isTocExpanded ? 'w-64' : 'w-[92px]'
                  }`}
                >
                  <button
                    type="button"
                    className={`flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-sky-900 ${
                      isTocExpanded ? 'border-b border-sky-100' : ''
                    }`}
                    onClick={() => setIsTocExpanded((value) => !value)}
                  >
                    <List size={15} />
                    <span>目录</span>
                  </button>

                  <div
                    className={`transition-all duration-200 ${
                      isTocExpanded ? 'max-h-[420px] opacity-100' : 'max-h-0 opacity-0'
                    } overflow-y-auto p-2`}
                  >
                    <div className="space-y-1.5">
                      {tocItems.map((item) => {
                        const active = activeTocId === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => jumpToToc(item)}
                            className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                              active
                                ? 'bg-white text-sky-700 shadow-sm'
                                : 'text-slate-500 hover:bg-white/70 hover:text-sky-800'
                            } ${item.level === 3 ? 'pl-6 text-[13px]' : ''}`}
                          >
                            {item.title}
                          </button>
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
