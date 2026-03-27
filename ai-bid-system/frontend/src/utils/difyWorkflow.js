// src/utils/difyWorkflow.js

const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE; 
const WORKFLOW_API_KEY = import.meta.env.VITE_DIFY_WORKFLOW_API_KEY;
const OUTLINE_API_KEY = import.meta.env.VITE_DIFY_OUTLINE_API_KEY; 
// 💡 新增：模板极速清洗专用 Key
const TEMPLATE_API_KEY = import.meta.env.VITE_DIFY_TEMPLATE_API_KEY; 

/**
 * 🚀 [引擎 1] 调用 Dify 工作流：从长文本提取结构化大纲 (自动挡)
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
    console.log('📊 Dify Outline API 响应:', JSON.stringify(result, null, 2));
    
    if (result.data && result.data.outputs && result.data.outputs.text) {
      return result.data.outputs.text;
    }
    
    const errorDetail = result.message || (result.data ? '返回数据格式不正确' : '未返回数据');
    throw new Error(`提取正文失败: ${errorDetail}`);
  } catch (error) {
    console.error(`❌ 调用撰写引擎失败:`, error);
    throw error;
  }
};

/**
 * 🚀 [引擎 4] 专家模式：极速清洗用户粘贴的乱码模板，转为标准 JSON 大纲树 (手动挡)
 */
export const parseTemplateToOutline = async (pastedText) => {
  if (!TEMPLATE_API_KEY || !DIFY_API_BASE) {
    throw new Error("⚠️ 未配置模板清洗 API Key (VITE_DIFY_TEMPLATE_API_KEY)");
  }

  try {
    console.log("🚀 引擎4启动：正在调用专用工作流清洗模板...");
    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TEMPLATE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: { pasted_text: pastedText }, // 💡 对应新工作流里的输入变量
        response_mode: "blocking",
        user: "frontend-template-user"
      })
    });

    const result = await response.json();
    if (result.data?.error) throw new Error(result.data.message);
    
    // 取出结果并清理 Markdown 尾巴
    const outlineStr = result.data?.outputs?.text || result.data?.outputs?.outline_json;
    if (!outlineStr) throw new Error("AI 返回了空数据");
    
    let cleanStr = outlineStr.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 如果模型带有 <think> 标签，在这里直接一刀切掉
    cleanStr = cleanStr.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

    return JSON.parse(cleanStr);
  } catch (error) {
    console.error(`❌ 模板清洗失败:`, error);
    throw error;
  }
};