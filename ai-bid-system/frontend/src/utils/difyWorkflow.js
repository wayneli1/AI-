// src/utils/difyWorkflow.js

const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE; 
const WORKFLOW_API_KEY = import.meta.env.VITE_DIFY_WORKFLOW_API_KEY;
const OUTLINE_API_KEY = import.meta.env.VITE_DIFY_OUTLINE_API_KEY; 
const TEMPLATE_API_KEY = import.meta.env.VITE_DIFY_TEMPLATE_API_KEY;
const FILL_BLANK_API_KEY = import.meta.env.VITE_DIFY_FILL_BLANK_API_KEY;

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
    cleanStr = cleanStr.replace(/<think[\s\S]*?<\/think>/gi, '').trim();
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
    
    // 取出结果
    const outlineStr = result.data?.outputs?.text || result.data?.outputs?.outline_json;
    if (!outlineStr) throw new Error("AI 返回了空数据");
    
    // --- 🛡️ 开始终极清洗装甲 ---
    let cleanStr = outlineStr;
    
    // 1. 暴力切除可能存在的 <think> 思考过程
    cleanStr = cleanStr.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    // 2. 剥离 Markdown 格式的外壳 (如果大模型调皮加了的话)
    cleanStr = cleanStr.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    
    // 3. 寻找最外层的数组结构（避免模型在前面或后面说废话）
    const arrayMatch = cleanStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (arrayMatch) {
      cleanStr = arrayMatch[0];
    }

    try {
      // 尝试第一次解析
      return JSON.parse(cleanStr);
    } catch (parseError) {
      console.warn("⚠️ 第一次 JSON 解析失败，尝试强制转义修复...", parseError);
      
      try {
        // 🚨 终极修复方案：针对 requirement 字段里那些致命的换行符和未转义双引号
        // 我们利用正则，只针对 "requirement": "..." 里面的内容进行暴力转义
        let fixedStr = cleanStr.replace(/"requirement"\s*:\s*"([\s\S]*?)"(?=\s*(?:,|}|$))/g, (match, p1) => {
          // 把里面的双引号转为 \", 换行转为 \n
          let safeContent = p1
            .replace(/\\"/g, '"') // 先把已经转的还原，防重复
            .replace(/"/g, '\\"') // 全部强行转义
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '');
          return `"requirement": "${safeContent}"`;
        });
        
        return JSON.parse(fixedStr);
      } catch (fatalError) {
        console.error('❌ 终极 JSON 清洗仍然失败，原始返回:', outlineStr);
        // 为了不让页面崩溃，提供一个降级的保底数据，让用户至少能进入第二步
        return [
          {
            id: "1",
            title: "结构解析失败 (需手动校对)",
            requirement: `【系统提示】：AI 返回的数据格式严重错乱，无法构建树状结构。\n\n原始数据如下：\n${outlineStr}`,
            children: []
          }
        ];
      }
    }
  } catch (error) {
    console.error(`❌ 模板清洗引擎崩溃:`, error);
    throw error;
  }
};
// 💡 新增：专门负责提取单个章节详细要求的函数 (阶段二：填血肉)
export const fetchRequirementForNode = async (nodeTitle, fullText) => {
  try {
    // 请确认您的 Dify API 地址，如果是云端版就是 https://api.dify.ai/v1/workflows/run
    // 如果是本地私有化部署，请换成您自己的域名/IP
    const response = await fetch('http://192.168.169.107/v1/workflows/run', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // 💡 填入了您刚刚生成的专属 API Key
        'Authorization': `Bearer app-UoXNnj93CKzCPie3gyZw8UbX` 
      },
      body: JSON.stringify({
        inputs: {
          "node_title": nodeTitle,
          "full_text": fullText
        },
        response_mode: "blocking", // 阻塞模式，等待AI写完一次性返回
        user: "bid_expert_frontend"
      })
    });

    const result = await response.json();
    if (result.code || result.message) throw new Error(result.message);
    
    // 💡 精准获取您的输出变量: text
    return result.data?.outputs?.text || "请结合上下文与内部知识库，详细扩充本节方案。";
  } catch (error) {
    console.error(`提取 [${nodeTitle}] 失败:`, error);
    return "自动提取超时或失败，请手动输入或重试。";
  }
};

export const fillDocumentBlanks = async (blankContexts, companyName) => {
  if (!FILL_BLANK_API_KEY || !DIFY_API_BASE) {
    throw new Error("未配置填报工作流 API Key (VITE_DIFY_FILL_BLANK_API_KEY)");
  }

  try {
    const blankList = blankContexts.map(b => ({
      id: b.id,
      context: b.context,
      type: b.type
    }));

    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FILL_BLANK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: {
          blank_list: JSON.stringify(blankList),
          company_name: companyName || ''
        },
        response_mode: "blocking",
        user: "frontend-fill-blank-user"
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result.data?.error) {
      throw new Error(result.data.message || '填报工作流异常');
    }

    const outputStr = result.data?.outputs?.text || result.data?.outputs?.result;

    if (!outputStr) {
      throw new Error("AI 返回了空数据");
    }

    let cleanStr = outputStr;
    cleanStr = cleanStr.replace(/<think[\s\S]*?<\/think>/gi, '').trim();
    cleanStr = cleanStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    try {
      const parsed = JSON.parse(cleanStr);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed;
      }
    } catch (e) {
      const jsonMatch = cleanStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e2) {}
      }
    }

    throw new Error("AI 返回的数据无法解析为 JSON");
  } catch (error) {
    console.error('填报工作流失败:', error);
    throw error;
  }
};