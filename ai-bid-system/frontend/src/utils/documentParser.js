// src/utils/documentParser.js
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import TurndownService from 'turndown';

// 【魔法修复】：使用 Vite 的 ?url 语法，把本地的 worker 文件当做静态资源引入
// 这样既不需要外网，也不会报 Invalid type 的错！
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// 初始化Turndown服务，配置中文友好的Markdown转换
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
  linkReferenceStyle: 'full'
});

// 添加自定义规则，优化中文文档转换
turndownService.addRule('chineseSpaces', {
  filter: ['p', 'div', 'span'],
  replacement: function(content) {
    // 保留中文排版中的空格处理
    return content.replace(/\s+/g, ' ').trim();
  }
});

turndownService.addRule('tableOptimization', {
  filter: ['table'],
  replacement: function(content, node) {
    // 表格转换为Markdown表格
    const rows = node.querySelectorAll('tr');
    if (rows.length === 0) return '';
    
    const tableData = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      const rowData = Array.from(cells).map(cell => cell.textContent.trim());
      tableData.push(rowData);
    });
    
    if (tableData.length === 0) return '';
    
    // 生成Markdown表格
    const header = tableData[0];
    const separator = header.map(() => '---').join(' | ');
    const rowsMarkdown = tableData.map(row => row.join(' | ')).join('\n');
    
    return `\n${header.join(' | ')}\n${separator}\n${rowsMarkdown}\n`;
  }
});

/**
 * 智能提取 PDF 或 Word 文档纯文本
 * @param {File} file - 用户上传的 PDF 或 Word 文件对象
 * @returns {Promise<string>} - 提取出的纯文本
 */
export const extractTextFromDocument = async (file) => {
  const fileExt = file.name.split('.').pop().toLowerCase();

  try {
    if (fileExt === 'pdf') {
      return await parsePDF(file);
    } else if (fileExt === 'docx') {
      return await parseWord(file);
    } else {
      throw new Error('不支持的文件格式，仅支持 PDF 和 Word');
    }
  } catch (error) {
    console.error("❌ 文档解析报错:", error);
    throw error;
  }
};

/**
 * 将 PDF 或 Word 文档转换为 Markdown 格式
 * @param {File} file - 用户上传的 PDF 或 Word 文件对象
 * @returns {Promise<string>} - 转换后的 Markdown 内容
 */
export const convertToMarkdown = async (file) => {
  const fileExt = file.name.split('.').pop().toLowerCase();

  try {
    if (fileExt === 'pdf') {
      return await parsePDFToMarkdown(file);
    } else if (fileExt === 'docx') {
      return await parseWordToMarkdown(file);
    } else {
      throw new Error('不支持的文件格式，仅支持 PDF 和 Word');
    }
  } catch (error) {
    console.error("❌ Markdown 转换报错:", error);
    throw error;
  }
};

// --- 解析 PDF 的核心逻辑 ---
const parsePDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  
  // 【修复】：去掉你刚才加的 worker: null，让它正常运转
  const pdf = await pdfjsLib.getDocument({ 
    data: arrayBuffer
  }).promise;
  
  let fullText = '';
  
  // 遍历每一页提取文字
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
  }
  
  console.log(`✅ PDF 解析成功，共 ${pdf.numPages} 页，${fullText.length} 个字符`);
  return fullText;
};

const parseWord = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<body>${html}</body>`, 'text/html');
  const nodes = doc.body.childNodes;

  const output = [];

  for (const node of nodes) {
    if (node.nodeType !== Node.ELEMENT_NODE) continue;

    if (node.tagName === 'TABLE') {
      output.push(tableToPlainText(node));
    } else {
      const text = blockElementToText(node);
      if (text.trim()) output.push(text);
    }
  }

  const fullText = output.join('\n\n');
  console.log(`Word 解析成功，共 ${fullText.length} 个字符`);
  return fullText;
};

const tableToPlainText = (tableEl) => {
  const rows = tableEl.querySelectorAll('tr');
  const matrix = [];

  for (const row of rows) {
    const cells = row.querySelectorAll('td, th');
    const rowTexts = [...cells].map(cell => cell.textContent.trim().replace(/\n+/g, ' '));
    if (rowTexts.some(t => t !== '')) {
      matrix.push(rowTexts);
    }
  }

  if (matrix.length === 0) return '';

  const colCount = Math.max(...matrix.map(r => r.length));
  const colWidths = [];
  for (let c = 0; c < colCount; c++) {
    let maxLen = 0;
    for (const row of matrix) {
      const val = row[c] || '';
      maxLen = Math.max(maxLen, val.length);
    }
    colWidths.push(Math.min(maxLen, 30));
  }

  const lines = [];
  for (const row of matrix) {
    const padded = [];
    for (let c = 0; c < colCount; c++) {
      const val = (row[c] || '').padEnd(colWidths[c], ' ');
      padded.push(val);
    }
    lines.push(padded.join('  |  '));
  }
  return lines.join('\n');
};

const blockElementToText = (el) => {
  if (['H1','H2','H3','H4','H5','H6'].includes(el.tagName)) {
    const level = parseInt(el.tagName[1]);
    return '#'.repeat(level) + ' ' + el.textContent.trim();
  }
  if (['P','DIV','SPAN'].includes(el.tagName)) {
    return el.textContent.trim();
  }
  if (['UL','OL'].includes(el.tagName)) {
    return [...el.querySelectorAll('li')]
      .map((li, i) => el.tagName === 'UL' ? `- ${li.textContent.trim()}` : `${i + 1}. ${li.textContent.trim()}`)
      .join('\n');
  }
  return el.textContent.trim();
};

// --- Markdown 转换函数 ---

/**
 * 将 PDF 转换为 Markdown 格式
 */
const parsePDFToMarkdown = async (file) => {
  // 先提取纯文本
  const text = await parsePDF(file);
  
  // 增强文本结构识别，转换为Markdown
  return enhanceTextToMarkdown(text);
};

/**
 * 将 Word 文档转换为 Markdown 格式
 */
const parseWordToMarkdown = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;
  
  // 使用turndown将HTML转换为Markdown
  let markdown = turndownService.turndown(html);
  
  // 清理和优化Markdown格式
  markdown = cleanMarkdown(markdown);
  
  console.log(`✅ Word 转 Markdown 成功，共 ${markdown.length} 个字符`);
  return markdown;
};

/**
 * 增强纯文本，识别结构并转换为Markdown
 */
const enhanceTextToMarkdown = (text) => {
  let markdown = text;
  
  // 识别标题（基于字体大小、位置等启发式规则）
  // 这里可以添加更复杂的标题识别逻辑
  markdown = markdown.replace(/^第[一二三四五六七八九十]+章\s+([^\n]+)/gm, '## $1');
  markdown = markdown.replace(/^第[一二三四五六七八九十]+条\s+([^\n]+)/gm, '### $1');
  markdown = markdown.replace(/^[一二三四五六七八九十]+、\s+([^\n]+)/gm, '1. $1');
  
  // 识别列表项
  markdown = markdown.replace(/^（[一二三四五六七八九十]+）\s+([^\n]+)/gm, '- $1');
  markdown = markdown.replace(/^[0-9]+\.\s+([^\n]+)/gm, '1. $1');
  
  // 清理多余的空行
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  console.log(`✅ PDF 转 Markdown 成功，共 ${markdown.length} 个字符`);
  return markdown;
};

/**
 * 清理和优化Markdown格式
 */
const cleanMarkdown = (markdown) => {
  // 移除多余的HTML标签
  let cleaned = markdown.replace(/<[^>]*>/g, '');
  
  // 标准化换行符
  cleaned = cleaned.replace(/\r\n/g, '\n');
  
  // 清理多余的空格
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  
  // 确保标题前后有空行
  cleaned = cleaned.replace(/(\n)(#{1,6}\s+[^\n]+)(\n)/g, '$1$2$3');
  
  // 清理连续的空行
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  return cleaned.trim();
};

/**
 * 验证投标文件格式和大小
 * @param {File} file - 要验证的文件
 * @returns {Object} - 验证结果 {isValid: boolean, message: string}
 */
export const validateBidFile = (file) => {
  if (!file) {
    return { isValid: false, message: '请选择文件' };
  }
  
  // 检查文件格式
  const allowedFormats = ['.pdf', '.docx'];
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  
  if (!allowedFormats.includes(fileExtension)) {
    return { 
      isValid: false, 
      message: '仅支持 PDF 和 DOCX 格式的文件' 
    };
  }
  
  // 检查文件大小（最大50MB）
  const maxSize = 50 * 1024 * 1024; // 50MB
  if (file.size > maxSize) {
    return { 
      isValid: false, 
      message: `文件大小不能超过 50MB，当前文件大小为 ${(file.size / 1024 / 1024).toFixed(2)}MB` 
    };
  }
  
  // 检查文件名（避免特殊字符）
  const fileName = file.name;
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(fileName)) {
    return { 
      isValid: false, 
      message: '文件名包含无效字符，请重命名文件' 
    };
  }
  
  return { isValid: true, message: '文件验证通过' };
};

