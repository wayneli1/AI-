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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: { document_text: documentText },
        response_mode: "blocking",
        user: "frontend-outline-user"
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    
    const result = await response.json();
    
    if (result.data?.error) {
      console.error('Dify API Error:', result.data);
      throw new Error(result.data.message || '标书生成异常');
    }
    
    const outlineStr = result.data?.outputs?.outline_json || result.data?.outputs?.text;
    
    if (!outlineStr) {
      console.error('Dify response:', JSON.stringify(result, null, 2));
      console.error('Available keys:', result.data?.outputs ? Object.keys(result.data.outputs) : 'none');
      throw new Error("AI 返回了空数据");
    }
    
    let cleanStr = outlineStr;
    if (cleanStr.startsWith('```json')) {
      cleanStr = cleanStr.replace(/```json/g, '').replace(/```/g, '');
    }
    cleanStr = cleanStr.trim();
    
    try {
      return JSON.parse(cleanStr);
    } catch (parseError) {
      console.error('解析大纲 JSON 失败:', cleanStr);
      console.error('Original string:', outlineStr);
      throw new Error(`大纲 JSON 解析失败: ${parseError.message}`);
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
    
    // 添加调试日志
    console.log('📊 Dify Outline API 卽:', JSON.stringify(result, null, 2));
    
    if (result.data && result.data.outputs && result.data.outputs.text) {
      return result.data.outputs.text;
    }
    
    // 更详细的错误信息
    const errorDetail = result.message || 
      (result.data ? '返回数据格式不正确' : '未返回数据');
    throw new Error(`提取大纲失败: ${errorDetail}`);
  } catch (error) {
    console.error(`❌ 调用撰写引擎失败:`, error);
    throw error;
  }
};