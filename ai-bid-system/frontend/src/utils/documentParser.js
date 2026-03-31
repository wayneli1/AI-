// src/utils/documentParser.js
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// 【魔法修复】：使用 Vite 的 ?url 语法，把本地的 worker 文件当做静态资源引入
// 这样既不需要外网，也不会报 Invalid type 的错！
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

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

