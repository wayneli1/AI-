// src/utils/documentParser.js
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';
import TurndownService from 'turndown';

import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
  linkReferenceStyle: 'full'
});

turndownService.addRule('chineseSpaces', {
  filter: ['p', 'div', 'span'],
  replacement: function(content) {
    return content.replace(/\s+/g, ' ').trim();
  }
});

turndownService.addRule('tableOptimization', {
  filter: ['table'],
  replacement: function(content, node) {
    const rows = node.querySelectorAll('tr');
    if (rows.length === 0) return '';
    
    const tableData = [];
    rows.forEach(row => {
      const cells = row.querySelectorAll('td, th');
      const rowData = Array.from(cells).map(cell => cell.textContent.trim());
      tableData.push(rowData);
    });
    
    if (tableData.length === 0) return '';
    
    const header = tableData[0];
    const separator = header.map(() => '---').join(' | ');
    const rowsMarkdown = tableData.map(row => row.join(' | ')).join('\n');
    
    return `\n${header.join(' | ')}\n${separator}\n${rowsMarkdown}\n`;
  }
});

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

const BID_HEADING_PATTERNS = [
  { regex: /^第[一二三四五六七八九十百]+[章编部分]/, level: 1 },
  { regex: /^第[一二三四五六七八九十百]+条/, level: 2 },
  { regex: /^[一二三四五六七八九十]+[、.．]/, level: 3 },
  { regex: /^（[一二三四五六七八九十]+）/, level: 4 },
  { regex: /^[\d]+[、.．]\s*[^\d]/, level: 4 },
  { regex: /^（[\d]+）/, level: 5 },
];

const KEY_VALUE_PATTERNS = [
  /^(公司名称|企业名称|投标人|供应商|单位名称)[：:\s]*(.+)$/i,
  /^(法定代表人|法人代表|法定代表人姓名|法人)[：:\s]*(.+)$/i,
  /^(注册资本|注册资金|注册资本金)[：:\s]*(.+)$/i,
  /^(统一社会信用代码|信用代码|USCC|社会信用代码)[：:\s]*([A-Za-z0-9]+)$/i,
  /^(成立日期|成立时间|注册日期)[：:\s]*(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}[日号]?)$/i,
  /^(营业期限|经营期限)[：:\s]*(.+)$/i,
  /^(公司类型|企业类型|登记状态|经营状态)[：:\s]*(.+)$/i,
  /^(注册地址|住所|公司地址|企业地址|单位地址|通讯地址)[：:\s]*(.+)$/i,
  /^(经营范围|业务范围)[：:\s]*(.+)$/i,
  /^(联系电话|联系电话话|联系方式|电话|手机|联系电话)[：:\s]*([\d-]+)$/i,
  /^(传真|传真号码)[：:\s]*([\d-]+)$/i,
  /^(邮政编码|邮编|邮政编码)[：:\s]*(\d{6})$/i,
  /^(电子邮箱|邮箱|E-?mail|电子邮件)[：:\s]*([\w.-]+@[\w.-]+\.\w+)$/i,
  /^(法定代表人身份证号码|身份证号码|身份证号|证件号码)[：:\s]*([\dXx]+)$/i,
  /^(项目经理|项目负责人|项目总监)[：:\s]*(.+)$/i,
  /^(技术负责人|技术总监|CTO)[：:\s]*(.+)$/i,
  /^(授权代表|委托代理人|联系人)[：:\s]*(.+)$/i,
  /^(开户银行|开户行|基本账户开户行|银行名称)[：:\s]*(.+)$/i,
  /^(银行账号|账号|基本账户账号|银行帐号)[：:\s]*([\d]+)$/i,
  /^(资质证书编号|许可证号|生产许可证编号|安全生产许可证编号)[：:\s]*([\w-]+)$/i,
  /^(投标有效期|有效期)[：:\s]*(\d+\s*[天日个].*)$/i,
  /^(投标保证金|保证金金额|履约保证金)[：:\s]*([\d,，.]+.*)$/i,
  /^(投标总价|投标报价|总报价|报价)[：:\s]*([\d,，.]+.*)$/i,
  /^(工期|交货期|服务期|计划工期|计划工期.*?日历天)[：:\s]*(\d+\s*[天日个].*)$/i,
  /^(质量标准|工程质量标准|质量要求|质量目标)[：:\s]*(.+)$/i,
  /^(安全目标|安全生产目标)[：:\s]*(.+)$/i,
  /^(投标人名称|投标人盖[章印]|单位盖[章印]|盖[章印])[：:\s]*(.+)$/i,
  /^(投标日期|日期|递交日期|提交日期)[：:\s]*(\d{4}[-/年.]\d{1,2}[-/月.]\d{1,2}[日号]?)$/i,
  /^(公司官网|网址|网站)[：:\s]*(https?:\/\/.+)$/i,
  /^(员工人数|职工人数|从业人员|在职员工)[：:\s]*(\d+)\s*人?$/i,
];

const parsePDF = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  
  const pdf = await pdfjsLib.getDocument({ 
    data: arrayBuffer
  }).promise;
  
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = extractStructuredTextFromPage(textContent, i);
    fullText += pageText + '\n\n';
  }
  
  console.log(`✅ PDF 解析成功，共 ${pdf.numPages} 页，${fullText.length} 个字符`);
  return fullText;
};

const extractStructuredTextFromPage = (textContent, pageNum) => {
  const items = textContent.items;
  if (items.length === 0) return `--- 第 ${pageNum} 页 ---`;
  
  const enrichedItems = items
    .filter(item => item.str.trim().length > 0)
    .map(item => {
      const transform = item.transform;
      const fontSize = Math.round(Math.sqrt(transform[0] * transform[0] + transform[1] * transform[1]));
      const x = Math.round(transform[4]);
      const y = Math.round(transform[5]);
      return {
        str: item.str.trim(),
        fontSize,
        x,
        y,
        width: item.width,
        height: item.height,
      };
    });
  
  if (enrichedItems.length === 0) return `--- 第 ${pageNum} 页 ---`;
  
  const fontSizes = enrichedItems.map(i => i.fontSize);
  const maxFontSize = Math.max(...fontSizes);
  const avgFontSize = fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length;
  const fontSizeThreshold1 = avgFontSize + (maxFontSize - avgFontSize) * 0.5;
  const fontSizeThreshold2 = avgFontSize + (maxFontSize - avgFontSize) * 0.25;
  
  const lines = [];
  let currentLine = null;
  
  for (const item of enrichedItems) {
    if (!currentLine || Math.abs(item.y - currentLine.y) > 5) {
      if (currentLine) lines.push(currentLine);
      currentLine = { items: [item], y: item.y, minX: item.x, maxX: item.x + (item.width || 0) };
    } else {
      currentLine.items.push(item);
      currentLine.minX = Math.min(currentLine.minX, item.x);
      currentLine.maxX = Math.max(currentLine.maxX, item.x + (item.width || 0));
    }
  }
  if (currentLine) lines.push(currentLine);
  
  lines.sort((a, b) => b.y - a.y);
  
  const output = [];
  output.push(`--- 第 ${pageNum} 页 ---`);
  
  for (const line of lines) {
    const lineText = line.items.map(i => i.str).join(' ');
    const avgLineFontSize = line.items.reduce((sum, i) => sum + i.fontSize, 0) / line.items.length;
    
    let headingLevel = 0;
    if (avgLineFontSize >= fontSizeThreshold1) {
      headingLevel = 1;
    } else if (avgLineFontSize >= fontSizeThreshold2) {
      headingLevel = 2;
    }
    
    for (const pattern of BID_HEADING_PATTERNS) {
      if (pattern.regex.test(lineText.trim())) {
        headingLevel = Math.max(headingLevel, pattern.level);
        break;
      }
    }
    
    if (headingLevel > 0 && headingLevel <= 6) {
      output.push('\n' + '#'.repeat(headingLevel) + ' ' + lineText.trim() + '\n');
    } else {
      let isKeyValue = false;
      for (const kvPattern of KEY_VALUE_PATTERNS) {
        const match = lineText.trim().match(kvPattern);
        if (match) {
          output.push(`**${match[1]}**: ${match[2].trim()}`);
          isKeyValue = true;
          break;
        }
      }
      
      if (!isKeyValue) {
        if (line.items.length >= 4 && line.items.some(i => i.str.includes('|') || i.str.includes('│'))) {
          const cells = line.items.map(i => i.str.trim()).filter(s => s);
          if (cells.length >= 2) {
            output.push('| ' + cells.join(' | ') + ' |');
          } else {
            output.push(lineText.trim());
          }
        } else {
          output.push(lineText.trim());
        }
      }
    }
  }
  
  return output.join('\n');
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

const parsePDFToMarkdown = async (file) => {
  const text = await parsePDF(file);
  return enhanceTextToMarkdown(text);
};

const parseWordToMarkdown = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  const html = result.value;
  
  let markdown = turndownService.turndown(html);
  markdown = cleanMarkdown(markdown);
  
  console.log(`✅ Word 转 Markdown 成功，共 ${markdown.length} 个字符`);
  return markdown;
};

const enhanceTextToMarkdown = (text) => {
  let markdown = text;
  
  markdown = markdown.replace(/^第[一二三四五六七八九十]+章\s+([^\n]+)/gm, '## $1');
  markdown = markdown.replace(/^第[一二三四五六七八九十]+条\s+([^\n]+)/gm, '### $1');
  markdown = markdown.replace(/^[一二三四五六七八九十]+、\s+([^\n]+)/gm, '1. $1');
  
  markdown = markdown.replace(/^（[一二三四五六七八九十]+）\s+([^\n]+)/gm, '- $1');
  markdown = markdown.replace(/^[0-9]+\.\s+([^\n]+)/gm, '1. $1');
  
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  console.log(`✅ PDF 转 Markdown 成功，共 ${markdown.length} 个字符`);
  return markdown;
};

const cleanMarkdown = (markdown) => {
  let cleaned = markdown.replace(/<[^>]*>/g, '');
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.replace(/(\n)(#{1,6}\s+[^\n]+)(\n)/g, '$1$2$3');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
};

export const validateBidFile = (file) => {
  if (!file) {
    return { isValid: false, message: '请选择文件' };
  }
  
  const allowedFormats = ['.pdf', '.docx'];
  const fileExtension = '.' + file.name.split('.').pop().toLowerCase();
  
  if (!allowedFormats.includes(fileExtension)) {
    return { 
      isValid: false, 
      message: '仅支持 PDF 和 DOCX 格式的文件' 
    };
  }
  
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return { 
      isValid: false, 
      message: `文件大小不能超过 50MB，当前文件大小为 ${(file.size / 1024 / 1024).toFixed(2)}MB` 
    };
  }
  
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
