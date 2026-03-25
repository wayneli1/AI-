// src/utils/difySync.js

const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE;
const DATASET_API_KEY = import.meta.env.VITE_DIFY_DATASET_API_KEY;
const DATASET_ID = import.meta.env.VITE_DIFY_DATASET_ID;
const CLEANER_API_KEY = import.meta.env.VITE_DIFY_CLEANER_API_KEY;

/**
 * 🧼 [引擎 3] 调用 Dify 工作流：自动清洗、脱敏标书内容
 */
const autoCleanText = async (rawText) => {
  if (!CLEANER_API_KEY) return rawText;

  try {
    console.log("🧼 引擎 3 启动：正在全自动清洗并脱敏长文本...");
    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLEANER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: { raw_text: rawText },
        response_mode: "blocking",
        user: "system-cleaner"
      })
    });

    const result = await response.json();
    
    // 老板已经在源头治好了，直接精准拿 text！干净利落！
    const cleanedText = result?.data?.outputs?.text;

    if (cleanedText && String(cleanedText).trim() !== '') {
      console.log("✅ 引擎 3 清洗完毕");
      return String(cleanedText);
    }
    
    return rawText;
  } catch (error) {
    console.error("❌ 引擎 3 清洗失败，回退至原始文本:", error);
    return rawText;
  }
};

/**
 * 🚀 同步到 Dify 知识库 (集成了引擎 3 自动清洗 + 公司主体物理打标)
 */
export const syncTextToDify = async (documentName, textContent, category = '通用资料') => {
  if (!DATASET_API_KEY || !DATASET_ID) return null;
  if (!textContent || textContent.trim() === '') return null;

  try {
    const cleanedContent = await autoCleanText(textContent);
    const safeContent = cleanedContent || textContent;

    // --- 物理打标：给 AI 检索用的强力胶水 ---
    const taggedContent = `【所属主体：${category}】\n\n${safeContent}`;
    const finalFileName = `[${category}]_${documentName}`;

    console.log(`🚀 正在将 [${category}] 的资料同步至知识库...`);
    
    const response = await fetch(`${DIFY_API_BASE}/datasets/${DATASET_ID}/document/create_by_text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DATASET_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: finalFileName,
        text: taggedContent, 
        indexing_technique: 'high_quality',
        process_rule: { mode: 'automatic' }
      })
    });

    const result = await response.json();

    if (result.document && result.document.id) {
      console.log(`✅ 同步成功！Dify 文档 ID: ${result.document.id}`);
      return result.document.id;
    } else {
      throw new Error(result.message || 'Dify 同步异常');
    }
  } catch (error) {
    console.error(`❌ 同步失败:`, error);
    return null;
  }
};

/**
 * 从 Dify 知识库删除文档 (保持不变)
 */
export const deleteDocumentFromDify = async (documentId) => {
  if (!DATASET_API_KEY || !DATASET_ID || !documentId) return false;
  try {
    const response = await fetch(`${DIFY_API_BASE}/datasets/${DATASET_ID}/documents/${documentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${DATASET_API_KEY}` },
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};