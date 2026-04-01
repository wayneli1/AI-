// 全局环境变量读取
const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE || 'https://api.dify.ai/v1';
const FILL_BLANK_API_KEY = import.meta.env.VITE_DIFY_FILL_BLANK_API_KEY;
const SCAN_BLANK_API_KEY = import.meta.env.VITE_DIFY_SCAN_BLANK_API_KEY;

export const scanBlanksWithAI = async (paragraphs) => {
  if (!SCAN_BLANK_API_KEY || !DIFY_API_BASE) {
    throw new Error("未配置空白扫描 API Key (VITE_DIFY_SCAN_BLANK_API_KEY)");
  }

  const lightParagraphs = paragraphs.map(p => ({
    paraIndex: p.paraIndex,
    text: p.text
  }));

  const CHUNK_SIZE = 40;
  const chunks = [];
  for (let i = 0; i < lightParagraphs.length; i += CHUNK_SIZE) {
    chunks.push(lightParagraphs.slice(i, i + CHUNK_SIZE));
  }

  console.log(`AI 扫描引擎启动，共 ${lightParagraphs.length} 个段落，切分为 ${chunks.length} 个并发扫描任务...`);

  const promises = chunks.map(async (chunk, index) => {
    try {
      const paragraphsText = JSON.stringify(chunk);

      const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SCAN_BLANK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: { paragraphs_text: paragraphsText },
          response_mode: "blocking",
          user: "frontend-scan-blank-user"
        })
      });

      if (!response.ok) {
        console.warn(`⚠️ 扫描切片 ${index} HTTP ${response.status}，断臂求生跳过`);
        return [];
      }

      const result = await response.json();
      if (result.data?.error) {
        console.warn(`⚠️ 扫描切片 ${index} 工作流异常: ${result.data.message}`);
        return [];
      }

      const outputStr = result.data?.outputs?.text || result.data?.outputs?.result;
      if (!outputStr) {
        console.warn(`⚠️ 扫描切片 ${index} 返回空数据，跳过`);
        return [];
      }

      let cleanStr = outputStr;
      cleanStr = cleanStr.replace(/<think[\s\S]*?<\/think>/gi, '').trim();
      cleanStr = cleanStr.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

      try {
        const parsed = JSON.parse(cleanStr);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        const jsonMatch = cleanStr.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
          try {
            const recovered = JSON.parse(jsonMatch[0]);
            if (Array.isArray(recovered)) {
              console.log(`✅ 扫描切片 ${index} 正则抢救成功，恢复 ${recovered.length} 个空白`);
              return recovered;
            }
          } catch (e2) { /* fall through */ }
        }
      }

      console.warn(`⚠️ 扫描切片 ${index} 解析失败，返回空数组`);
      return [];
    } catch (error) {
      console.warn(`⚠️ 扫描切片 ${index} 异常，断臂求生:`, error.message);
      return [];
    }
  });

  const chunkResults = await Promise.all(promises);
  const allAiBlanks = chunkResults.flat();

  console.log(`🎉 AI 扫描完成！所有切片共发现 ${allAiBlanks.length} 个空白`);
  return allAiBlanks;
};

export const fillDocumentBlanks = async (blankContexts, companyName, tenderContext = '') => {
  if (!FILL_BLANK_API_KEY) throw new Error("未配置填报工作流 API Key");

  // 💡 修复重点：大幅度放宽拦截网，防止误杀！只有极其明确的金额和偏离才会拦截
  const MANUAL_CONTEXT_PATTERN = /总价|单价|费率|偏离度|响应差异/;
  
  const autoBlanks = [];
  const manualBlanks = [];
  
  for (const b of blankContexts) {
    const role = b.fill_role || 'auto'; // 💡 默认改为 auto！相信大模型的判断能力
    const isManualType = b.type === 'date_pattern';
    const hasManualContext = MANUAL_CONTEXT_PATTERN.test(b.context || '');
    
    if (role === 'manual' || isManualType || hasManualContext) {
      manualBlanks.push(b);
    } else {
      autoBlanks.push(b);
    }
  }
  console.log(`智能拦截结果: ${autoBlanks.length} 个自动填空, ${manualBlanks.length} 个纯手工填空（已拦截）`);

  const blankList = autoBlanks.map(b => {
    let markedContext = b.context;
    if (b.index !== undefined && b.matchText && b.matchText !== '[空白单元格]' && b.type !== 'attachment') {
      markedContext = b.context.substring(0, b.index) + "【🎯此处为本字段要填的位置🎯】" + b.context.substring(b.index + b.matchText.length);
    } else if (b.type === 'empty_cell' || b.matchText === '[空白单元格]' || b.type === 'attachment') {
      markedContext = "【🎯请根据后面的提示填空🎯】 " + b.context;
    }
    return { id: b.id, context: markedContext, type: b.type };
  });

  const CHUNK_SIZE = 15;
  const chunks = [];
  for (let i = 0; i < blankList.length; i += CHUNK_SIZE) {
    chunks.push(blankList.slice(i, i + CHUNK_SIZE));
  }

  try {
    const promises = chunks.map(async (chunk, index) => {
      const payload = {
        inputs: { blank_list: JSON.stringify(chunk), company_name: companyName, tender_context: tenderContext },
        response_mode: "blocking",
        user: "frontend-fill-blank-user"
      };

      const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${FILL_BLANK_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error(`Dify 切片 ${index} 请求失败: ${response.status}`);

      const resData = await response.json();
      
      let parsedChunk = {};
      try {
        let textStr = resData.data?.outputs?.result || resData.data?.outputs?.text || "{}";
        textStr = textStr.replace(/```json/g, '').replace(/```/g, '').trim();
        const startIdx = textStr.indexOf('{');
        const endIdx = textStr.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) textStr = textStr.substring(startIdx, endIdx + 1);

        try {
          parsedChunk = JSON.parse(textStr);
        } catch (parseError) {
          const regex = /"(blank_(?:ai_)?\d+)"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g;
          let m;
          while ((m = regex.exec(textStr)) !== null) {
            try { parsedChunk[m[1]] = JSON.parse(`"${m[2]}"`); } catch (e) { /* ignore */ }
          }
        }
      } catch (fatalError) {
        console.error(`切片 ${index} 发生致命解析错误:`, fatalError);
      }
      return parsedChunk;
    });

    const chunkResults = await Promise.all(promises);
    const finalFilledData = {};
    for (const res of chunkResults) Object.assign(finalFilledData, res);
    
    // 手工项保持留空
    for (const manualBlank of manualBlanks) {
      finalFilledData[manualBlank.id] = '';
    }

    return finalFilledData;
  } catch (error) {
    console.error("并发填报过程发生错误:", error);
    throw error;
  }
};