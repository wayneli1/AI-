// src/utils/difyWorkflow.js

const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE; 
const WORKFLOW_API_KEY = import.meta.env.VITE_DIFY_WORKFLOW_API_KEY;
const OUTLINE_API_KEY = import.meta.env.VITE_DIFY_OUTLINE_API_KEY; 

/**
 * 🚀 [引擎 1] 调用 Dify 工作流：从长文本提取结构化大纲 (保持不变)
 */
export const generateBidOutline = async (documentText) => {
  if (!OUTLINE_API_KEY || !DIFY_API_BASE) {
    throw new Error("⚠️ 未配置大纲提取 API Key (VITE_DIFY_OUTLINE_API_KEY)");
  }

  try {
    console.log("🚀 引擎1启动：正在发送招标文件长文本以提取大纲...");
    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OUTLINE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: { document_text: documentText },
        response_mode: "blocking",
        user: "frontend-outline-user"
      })
    });

    const result = await response.json();
    if (result.data && result.data.outputs) {
      const outlineStr = result.data.outputs.outline_json || result.data.outputs.text; 
      if (!outlineStr) throw new Error("AI 返回了空数据");
      const cleanStr = outlineStr.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanStr);
    } else {
      throw new Error(result.message || '大纲提取异常');
    }
  } catch (error) {
    console.error(`❌ 提取大纲失败:`, error);
    throw error;
  }
};

/**
 * 🚀 [引擎 2] 调用 Dify 工作流：生成最终标书正文
 */
// 💡 修改：接收 3 个参数
export const generateBidContent = async (companyName, frameworkText, queryText) => {
  if (!WORKFLOW_API_KEY || !DIFY_API_BASE) throw new Error("⚠️ 未配置 Dify 工作流 API Key");

  try {
    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // 💡 核心：把 3 个变量明明白白地传给 Dify 开始节点
        inputs: {
          target_company: companyName,
          bid_framework: frameworkText,
          search_query: queryText
        },
        response_mode: "blocking", 
        user: "frontend-bid-user" 
      })
    });

    const result = await response.json();
    if (result.data && result.data.outputs) return result.data.outputs.text; 
    throw new Error(result.message || '标书生成异常');
  } catch (error) {
    console.error(`❌ 调用撰写引擎失败:`, error);
    throw error;
  }
};