// src/utils/difyWorkflow.js

// 🔌 对应 .env.local 里的：VITE_DIFY_API_BASE=/v1
const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE; 

// 🔑 对应 .env.local 里的：VITE_DIFY_WORKFLOW_API_KEY=app-sLqr6WkUVlH8a4FK2aGiIAVa
const WORKFLOW_API_KEY = import.meta.env.VITE_DIFY_WORKFLOW_API_KEY;

/**
 * 调用 Dify 工作流生成标书
 * @param {string} requirementText - 包含目标公司和大纲要求的完整内容
 * @returns {Promise<string>} - DeepSeek 生成的标书正文
 */
export const generateBidContent = async (requirementText) => {
  if (!WORKFLOW_API_KEY || !DIFY_API_BASE) {
    throw new Error("⚠️ 未配置 Dify 工作流 API Key 或 Base URL，请检查 .env.local 文件");
  }

  try {
    console.log("🚀 传动轴启动：正在将大纲和公司名发送给 Dify 流水线...");
    console.log("正在使用的 API Key:", WORKFLOW_API_KEY.substring(0, 8) + "...");
    
    // 🌐 这里的请求地址会变成: /v1/workflows/run (Vite 会自动帮你代理到 192.168.169.107)
    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WORKFLOW_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // 🎯 这里的 'bid_framework' 必须是你 Dify 开始节点里定义的那个变量名！
        inputs: {
          bid_framework: requirementText 
        },
        response_mode: "blocking", // 阻塞模式，让大模型写完几十页再一起返回
        user: "frontend-bid-user" // 调用标识
      })
    });

    const result = await response.json();

    if (result.data && result.data.outputs) {
      console.log("✅ 标书生成成功！准备渲染！");
      // 🎯 这里的 .text 必须是你 Dify 结束节点里定义的输出变量名！
      return result.data.outputs.text; 
    } else {
      console.error("Dify 返回异常:", result);
      throw new Error(result.message || '工作流返回异常，请检查 Dify 接口');
    }
  } catch (error) {
    console.error(`❌ 调用生成引擎失败:`, error);
    throw error;
  }
};