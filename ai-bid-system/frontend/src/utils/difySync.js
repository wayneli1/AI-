// src/utils/difySync.js

const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE;
const DATASET_API_KEY = import.meta.env.VITE_DIFY_DATASET_API_KEY;
const DATASET_ID = import.meta.env.VITE_DIFY_DATASET_ID;
const CLEANER_API_KEY = import.meta.env.VITE_DIFY_CLEANER_API_KEY; // 🧼 引擎 3 的钥匙

/**
 * 🧼 [引擎 3] 调用 Dify 工作流：自动清洗、脱敏标书内容
 */
const autoCleanText = async (rawText) => {
  if (!CLEANER_API_KEY) {
    console.warn("⚠️ 未配置引擎 3 API Key，将跳过清洗直接入库");
    return rawText;
  }

  try {
    console.log("🧼 引擎 3 启动：正在全自动清洗并脱敏长文本...");
    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLEANER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          raw_text: rawText // 🎯 对应你 Dify 清洗工作流里的输入变量名
        },
        response_mode: "blocking",
        user: "system-cleaner"
      })
    });

    const result = await response.json();
    if (result.data && result.data.outputs) {
      // 优先获取 text 变量，如果没有则取 outputs 里的内容
      const cleaned = result.data.outputs.text || result.data.outputs.cleaned_text;
      console.log("✅ 引擎 3 清洗完毕，精肉已准备就绪");
      return cleaned;
    }
    return rawText;
  } catch (error) {
    console.error("❌ 引擎 3 清洗失败，回退至原始文本:", error);
    return rawText;
  }
};

/**
 * 🚀 同步到 Dify 知识库 (集成了引擎 3 自动清洗)
 */
export const syncTextToDify = async (documentName, textContent) => {
  if (!DATASET_API_KEY || !DATASET_ID) {
    console.warn("⚠️ 未配置 Dify 知识库密钥，跳过同步");
    return null;
  }

  if (!textContent || textContent.trim() === '') return null;

  try {
    // --- 第一步：调用引擎 3 洗肉 ---
    const finalContent = await autoCleanText(textContent);

    // --- 第二步：将洗好的肉入库 ---
    console.log(`🚀 正在将清洗后的 [${documentName}] 同步至知识库...`);
    
    const response = await fetch(`${DIFY_API_BASE}/datasets/${DATASET_ID}/document/create_by_text`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DATASET_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: documentName,
        text: finalContent,
        indexing_technique: 'high_quality',
        process_rule: {
          mode: 'automatic' 
        }
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