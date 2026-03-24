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

// --- 解析 Word (.docx) 的核心逻辑 ---
const parseWord = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  // mammoth 瞬间抽干 Word 纯文本
  const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
  
  const fullText = result.value;
  console.log(`✅ Word 解析成功，共 ${fullText.length} 个字符`);
  return fullText;
};