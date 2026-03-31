const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE;
const FILL_BLANK_API_KEY = import.meta.env.VITE_DIFY_FILL_BLANK_API_KEY;

export const scanBlanksWithAI = async (paragraphs) => {
  const SCAN_BLANK_API_KEY = import.meta.env.VITE_DIFY_SCAN_BLANK_API_KEY;
  
  if (!SCAN_BLANK_API_KEY || !DIFY_API_BASE) {
    throw new Error("未配置空白扫描 API Key (VITE_DIFY_SCAN_BLANK_API_KEY)");
  }

  try {
    const lightParagraphs = paragraphs.map(p => ({
      paraIndex: p.paraIndex,
      text: p.text
    }));
    const paragraphsText = JSON.stringify(lightParagraphs);

    console.log("AI 扫描引擎启动，发送段落数:", lightParagraphs.length);
    
    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SCAN_BLANK_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: { 
          paragraphs_text: paragraphsText
        },
        response_mode: "blocking",
        user: "frontend-scan-blank-user"
      })
    });

    if (!response.ok) {
      let errorDetail = '';
      try {
        errorDetail = await response.text();
      } catch (e) {}
      console.error(`AI 扫描 API ${response.status} 错误详情:`, errorDetail);
      throw new Error(`HTTP ${response.status}: ${errorDetail}`);
    }

    const result = await response.json();

    if (result.data?.error) {
      throw new Error(result.data.message || '空白扫描工作流异常');
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
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      const jsonMatch = cleanStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch (e2) {
          console.error('JSON 解析失败:', e2);
        }
      }
    }

    throw new Error("AI 返回的数据无法解析为 JSON 数组");
  } catch (error) {
    console.error('AI 空白扫描失败:', error);
    throw error;
  }
};

// 💡 核心修改：新增 tenderContext 参数并传给后端
export const fillDocumentBlanks = async (blankContexts, companyName, tenderContext = '') => {
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
          company_name: companyName || '',
          tender_context: tenderContext // 💡 新增：把原文传给 Dify
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