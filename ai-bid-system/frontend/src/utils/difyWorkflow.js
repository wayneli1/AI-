// src/utils/difyWorkflow.js

const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE; 
const WORKFLOW_API_KEY = import.meta.env.VITE_DIFY_WORKFLOW_API_KEY;
const OUTLINE_API_KEY = import.meta.env.VITE_DIFY_OUTLINE_API_KEY; // 🔑 新增的大纲引擎钥匙

/**
 * 🚀 [引擎 1] 调用 Dify 工作流：从长文本提取结构化大纲
 * @param {string} documentText - 提取出的招标文件纯文本
 * @returns {Promise<Array>} - 解析后的 JSON 大纲数组
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
        inputs: {
          document_text: documentText // 🎯 对应您在 Dify 里设置的开始节点变量名
        },
        response_mode: "blocking",
        user: "frontend-outline-user"
      })
    });

    const result = await response.json();

    if (result.data && result.data.outputs) {
      console.log("✅ 大纲提取成功！原始返回:", result.data.outputs);
      
      // 兼容您在结束节点命名的变量名（outline_json 或 text）
      const outlineStr = result.data.outputs.outline_json || result.data.outputs.text; 
      
      if (!outlineStr) throw new Error("AI 返回了空数据");

      // 🛠️ 容错清洗：去掉 AI 可能带上的 markdown 代码块符号 (```json 和 ```)
      const cleanStr = outlineStr.replace(/```json/g, '').replace(/```/g, '').trim();
      
      // 将纯净的字符串转为 JSON 数组
      const outlineArray = JSON.parse(cleanStr);
      return outlineArray;
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
 * @param {string} requirementText - 包含目标公司和大纲要求的完整内容
 * @returns {Promise<string>} - DeepSeek 生成的标书正文
 */
export const generateBidContent = async (requirementText) => {
  if (!WORKFLOW_API_KEY || !DIFY_API_BASE) {
    throw new Error("⚠️ 未配置 Dify 工作流 API Key");
  }

  try {
    console.log("🚀 引擎2启动：正在将大纲和公司名发送给标书撰写流水线...");
    
    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          bid_framework: requirementText 
        },
        response_mode: "blocking", 
        user: "frontend-bid-user" 
      })
    });

    const result = await response.json();

    if (result.data && result.data.outputs) {
      console.log("✅ 标书生成成功！准备渲染！");
      return result.data.outputs.text; 
    } else {
      throw new Error(result.message || '标书生成异常');
    }
  } catch (error) {
    console.error(`❌ 调用撰写引擎失败:`, error);
    throw error;
  }
};