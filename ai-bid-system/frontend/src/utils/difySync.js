// src/utils/difySync.js

const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE;
const DATASET_API_KEY = import.meta.env.VITE_DIFY_DATASET_API_KEY;
const DATASET_ID = import.meta.env.VITE_DIFY_DATASET_ID;

/**
 * 将 OCR 提取的纯文本同步到 Dify 知识库
 * @param {string} documentName - 文件名 (比如：营业执照.jpg 或 招标文件.pdf)
 * @param {string} textContent - OCR 或解析出来的纯文本内容
 * @returns {Promise<string|null>} - 成功返回 Dify 文档 ID，失败返回 null
 */
export const syncTextToDify = async (documentName, textContent) => {
  if (!DATASET_API_KEY || !DATASET_ID) {
    console.warn("⚠️ 未配置 Dify 知识库密钥，跳过同步");
    return null;
  }

  if (!textContent || textContent.trim() === '') {
    console.warn(`⚠️ 文件 ${documentName} 内容为空，无需同步`);
    return null;
  }

  try {
    console.log(`🚀 正在将 [${documentName}] 的内容同步至 Dify 知识库...`);
    
    // 调用 Dify 的 "通过文本创建文档" API
    const response = await fetch(`${DIFY_API_BASE}/datasets/${DATASET_ID}/document/create_by_text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DATASET_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: documentName,
        text: textContent,
        indexing_technique: 'high_quality', // 高质量索引（会调用 Embedding 模型）
        process_rule: {
          mode: 'automatic' // 自动分段清洗
        }
      })
    });

    const result = await response.json();

    if (result.document && result.document.id) {
      console.log(`✅ [${documentName}] 成功喂给 Dify！Dify 文档 ID: ${result.document.id}`);
      return result.document.id;
    } else {
      throw new Error(result.message || 'Dify 同步接口返回异常');
    }
  } catch (error) {
    console.error(`❌ 同步到 Dify 失败:`, error);
    return null;
  }
};

/**
 * 从 Dify 知识库删除文档
 * @param {string} documentId - Dify 文档 ID
 * @returns {Promise<boolean>} - 删除是否成功
 */
export const deleteDocumentFromDify = async (documentId) => {
  if (!DATASET_API_KEY || !DATASET_ID) {
    console.warn("⚠️ 未配置 Dify 知识库密钥，跳过删除");
    return false;
  }

  if (!documentId) {
    console.warn("⚠️ 未提供 Dify 文档 ID，无法删除");
    return false;
  }

  try {
    console.log(`🗑️ 正在从 Dify 知识库删除文档 ID: ${documentId}...`);
    
    // 调用 Dify 的删除文档 API
    const response = await fetch(`${DIFY_API_BASE}/datasets/${DATASET_ID}/documents/${documentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${DATASET_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      console.log(`✅ 文档 ${documentId} 已从 Dify 知识库删除`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`❌ 删除失败 (${response.status}):`, errorText);
      return false;
    }
  } catch (error) {
    console.error(`❌ 删除 Dify 文档失败:`, error);
    return false;
  }
};