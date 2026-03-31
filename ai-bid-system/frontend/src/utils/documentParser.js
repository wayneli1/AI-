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

// --- 解析 Word (.docx) 的核心逻辑（混合模式：段落用纯文本，表格保留 HTML） ---
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
      output.push(extractTableHtml(node));
    } else {
      const text = blockElementToText(node);
      if (text.trim()) output.push(text);
    }
  }

  const fullText = output.join('\n\n');
  console.log(`✅ Word 混合解析成功，共 ${fullText.length} 个字符`);
  return fullText;
};

const extractTableHtml = (tableEl) => {
  const clean = (el) => {
    const clone = el.cloneNode(true);
    for (const attr of [...clone.attributes]) {
      const name = attr.name.toLowerCase();
      if (!['colspan', 'rowspan'].includes(name)) clone.removeAttribute(attr.name);
    }
    clone.removeAttribute('style');
    clone.removeAttribute('class');
    for (const child of clone.querySelectorAll('*')) {
      child.removeAttribute('style');
      child.removeAttribute('class');
      for (const attr of [...child.attributes]) {
        if (!['colspan', 'rowspan'].includes(attr.name.toLowerCase())) {
          child.removeAttribute(attr.name);
        }
      }
    }
    return clone.outerHTML;
  };
  return clean(tableEl);
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

export const buildAiText = (fullText, maxLen = 20000) => {
  if (!fullText) return '';
  if (fullText.length <= maxLen) return fullText;

  const tableBlocks = [];
  const nonTableParts = [];

  const parts = fullText.split(/(<table[\s\S]*?<\/table>)/gi);
  for (const part of parts) {
    if (/^<table/i.test(part)) {
      let preceding = '';
      const idx = nonTableParts.length - 1;
      if (idx >= 0) {
        const lines = nonTableParts[idx].split('\n');
        preceding = lines.filter(l => l.trim()).slice(-3).join('\n') + '\n';
      }
      tableBlocks.push(preceding + part);
    } else {
      nonTableParts.push(part);
    }
  }

  const tablesText = tableBlocks.join('\n\n');
  let result = tablesText;

  if (result.length >= maxLen) {
    return result.substring(0, maxLen);
  }

  const remaining = maxLen - result.length;
  const plainText = nonTableParts.join('\n\n');

  if (plainText.length <= remaining) {
    return result + '\n\n' + plainText;
  }

  const headPart = plainText.substring(0, remaining);
  return result + '\n\n' + headPart;
};

export const extractOriginalTables = (fullText) => {
  const tables = [];
  const parts = fullText.split(/(<table[\s\S]*?<\/table>)/gi);
  let precedingLines = [];

  for (const part of parts) {
    if (/^<table/i.test(part)) {
      const heading = precedingLines.filter(l => l.trim()).slice(-3).join(' ');
      const cellTexts = [];
      const tmpDoc = new DOMParser().parseFromString(part, 'text/html');
      tmpDoc.querySelectorAll('td').forEach(td => cellTexts.push(td.textContent.trim()));
      const cellSnippet = cellTexts.join(' ');

      tables.push({ html: part, heading, cellSnippet });
      precedingLines = [];
    } else {
      precedingLines = part.split('\n');
    }
  }

  return tables;
};

const findBestMatch = (nodeTitle, tables) => {
  const title = nodeTitle.replace(/[\s\d一二三四五六七八九十、.()（）]/g, '').toLowerCase();
  const titleChars = [...new Set(title)];

  let bestTable = null;
  let bestScore = 0;

  for (const t of tables) {
    let score = 0;

    const headClean = t.heading.replace(/[\s\d一二三四五六七八九十、.()（）#]/g, '').toLowerCase();
    let matchCount = 0;
    for (const ch of titleChars) {
      if (headClean.includes(ch)) matchCount++;
    }
    score = titleChars.length > 0 ? matchCount / titleChars.length : 0;

    if (score > bestScore) {
      bestScore = score;
      bestTable = t;
    }
  }

  return bestScore >= 0.5 ? bestTable : null;
};

export const injectOriginalTables = (outline, tables) => {
  if (!tables || tables.length === 0) return outline;

  const walk = (nodes) => {
    for (const node of nodes) {
      const hasTable = node.requirement && node.requirement.includes('<table');
      if (hasTable) {
        const match = findBestMatch(node.title, tables);
        if (match) {
          const prefix = node.requirement.substring(0, node.requirement.indexOf('<table'));
          node.requirement = (prefix || '【表格填写指令】：请按以下表格结构填写数据，保持列名和合并单元格完全一致：\n') + match.html;
        }
      }
      if (node.children && node.children.length > 0) {
        walk(node.children);
      }
    }
  };

  walk(outline);
  return outline;
};