// 全局环境变量读取
const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE || 'https://api.dify.ai/v1';
const FILL_BLANK_API_KEY = import.meta.env.VITE_DIFY_FILL_BLANK_API_KEY;
const SCAN_BLANK_API_KEY = import.meta.env.VITE_DIFY_SCAN_BLANK_API_KEY;

// ==========================================
// 1. AI 智能扫描空白引擎 (保留您的原版逻辑)
// ==========================================
export const scanBlanksWithAI = async (paragraphs) => {
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

// ==========================================
// 2. AI 智能填报引擎 (全新升级：靶心 + 并发切片 + 正则抢救)
// ==========================================
export const fillDocumentBlanks = async (blankContexts, companyName, tenderContext = '') => {
  if (!FILL_BLANK_API_KEY) {
    throw new Error("未配置填报工作流 API Key");
  }

  // 1. 组装并打上🎯靶心
  const blankList = blankContexts.map(b => {
    let markedContext = b.context;
    if (b.index !== undefined && b.matchText && b.matchText !== '[空白单元格]') {
      markedContext = 
        b.context.substring(0, b.index) + 
        "【🎯此处为本字段要填的位置🎯】" + 
        b.context.substring(b.index + b.matchText.length);
    } else if (b.type === 'empty_cell' || b.matchText === '[空白单元格]' || b.type === 'attachment') {
      markedContext = "【🎯请根据后面的提示填空🎯】 " + b.context;
    }
    return { id: b.id, context: markedContext, type: b.type };
  });

  // 2. 核心：切片算法（Chunking）- 每次只给大模型 15 个题，保证 100% 注意力
  const CHUNK_SIZE = 15;
  const chunks = [];
  for (let i = 0; i < blankList.length; i += CHUNK_SIZE) {
    chunks.push(blankList.slice(i, i + CHUNK_SIZE));
  }

  console.log(`总计 ${blankList.length} 个填空，切分为 ${chunks.length} 个并发任务...`);

  // 3. 并发向 Dify 发起请求
  try {
    const promises = chunks.map(async (chunk, index) => {
      const payload = {
        inputs: {
          blank_list: JSON.stringify(chunk),
          company_name: companyName,
          tender_context: tenderContext
        },
        response_mode: "blocking", // 使用阻塞模式等待 JSON 返回
        user: "frontend-fill-blank-user"
      };

      const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FILL_BLANK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Dify 切片 ${index} 请求失败: ${response.status}`);
      }

      const resData = await response.json();
      
      // 解析 Dify 返回的 JSON 字符串，加入正则抢救引擎
      let parsedChunk = {};
      try {
        let textStr = resData.data?.outputs?.result || resData.data?.outputs?.text || "{}";
        
        // 基础清理
        textStr = textStr.replace(/```json/g, '').replace(/```/g, '').trim();
        const startIdx = textStr.indexOf('{');
        const endIdx = textStr.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          textStr = textStr.substring(startIdx, endIdx + 1);
        }

        try {
          // 正常情况：尝试标准 JSON 解析
          parsedChunk = JSON.parse(textStr);
        } catch (parseError) {
          console.warn(`⚠️ 切片 ${index} JSON解析失败，启动正则抢救模式...`);
          
          // 异常情况：大模型乱加符号导致崩溃，强行提取 Key-Value
          const regex = /"(blank_(?:ai_)?\d+)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
          let m;
          let recoveredCount = 0;
          while ((m = regex.exec(textStr)) !== null) {
            try {
              const key = m[1];
              const value = JSON.parse(`"${m[2]}"`); 
              parsedChunk[key] = value;
              recoveredCount++;
            } catch (e) {
              // 忽略单个彻底损毁的字段
            }
          }
          console.log(`✅ 切片 ${index} 抢救成功，从破损的 JSON 中恢复了 ${recoveredCount} 个字段！`);
        }
      } catch (fatalError) {
        console.error(`切片 ${index} 发生致命解析错误:`, fatalError);
      }
      
      return parsedChunk;
    });

    // 🚀 等待所有并发的大模型同时交卷
    const chunkResults = await Promise.all(promises);

    // 4. 将所有切片的答案合并成一个完整的对象返回
    const finalFilledData = {};
    for (const res of chunkResults) {
      Object.assign(finalFilledData, res);
    }

    console.log("🎉 所有切片合并完成！最终结果:", finalFilledData);
    return finalFilledData;

  } catch (error) {
    console.error("并发填报过程发生错误:", error);
    throw error;
  }
};