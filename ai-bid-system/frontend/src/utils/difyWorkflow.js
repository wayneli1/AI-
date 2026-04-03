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
    } else if (b.type === 'empty_cell' || b.matchText === '[空白单元格]' || b.type === 'attachment' || b.need_image) {
      markedContext = "【🎯此处需要插入对应资质图片，请从知识库资质图片中找到匹配的图片并输出其纯URL🎯】 " + b.context;
    }
    return { id: b.id, context: markedContext, type: b.type };
  });

  const CHUNK_SIZE = 10;
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

// ============================================================
// 投标文件智能分块函数
// ============================================================

/**
 * 智能分块Markdown文档
 * @param {string} markdownContent - Markdown格式的文档内容
 * @param {Object} options - 分块选项
 * @returns {Array} 分块数组
 */
export const intelligentChunking = (markdownContent, options = {}) => {
  const {
    chunkSize = 1500,           // 每块字符数
    overlap = 300,              // 重叠字符数
    strategy = 'semantic',      // 分块策略: 'semantic', 'fixed', 'hybrid'
    minChunkSize = 500,         // 最小分块大小
    maxChunks = 20              // 最大分块数
  } = options;

  console.log(`开始智能分块，内容长度: ${markdownContent.length} 字符，策略: ${strategy}`);

  // 清理内容
  let content = markdownContent.trim();
  if (content.length === 0) {
    return [];
  }

  // 策略1: 语义分块（按标题）
  if (strategy === 'semantic' || strategy === 'hybrid') {
    const semanticChunks = chunkByHeadings(content, chunkSize, overlap);
    if (semanticChunks.length > 0 && semanticChunks.length <= maxChunks) {
      console.log(`语义分块成功: ${semanticChunks.length} 个分块`);
      return semanticChunks;
    }
  }

  // 策略2: 固定大小分块（备用）
  const fixedChunks = chunkByFixedSize(content, chunkSize, overlap, minChunkSize, maxChunks);
  console.log(`固定大小分块: ${fixedChunks.length} 个分块`);
  
  return fixedChunks;
};

/**
 * 按标题进行语义分块
 */
const chunkByHeadings = (content, chunkSize, overlap) => {
  const chunks = [];
  
  // 识别标题（# 标题）
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const lines = content.split('\n');
  
  let currentChunk = '';
  let currentChunkSize = 0;
  let lastHeadingIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // 检查是否是标题
    const isHeading = headingRegex.test(line);
    headingRegex.lastIndex = 0; // 重置正则
    
    if (isHeading) {
      // 如果当前分块已经有内容，保存它
      if (currentChunkSize > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = '';
        currentChunkSize = 0;
      }
      lastHeadingIndex = i;
    }
    
    // 添加当前行到分块
    currentChunk += line + '\n';
    currentChunkSize += line.length + 1;
    
    // 如果分块太大，在段落边界分割
    if (currentChunkSize >= chunkSize && i > lastHeadingIndex) {
      // 向前查找段落边界
      let splitIndex = i;
      for (let j = i; j > Math.max(lastHeadingIndex, i - 10); j--) {
        if (lines[j].trim() === '') {
          splitIndex = j;
          break;
        }
      }
      
      // 分割分块
      const chunkLines = lines.slice(lastHeadingIndex + 1, splitIndex + 1);
      if (chunkLines.length > 0) {
        chunks.push(chunkLines.join('\n').trim());
      }
      
      // 重置当前分块（从分割点开始，包含重叠）
      const overlapStart = Math.max(splitIndex - Math.floor(overlap / 50), lastHeadingIndex + 1);
      currentChunk = lines.slice(overlapStart, i + 1).join('\n') + '\n';
      currentChunkSize = currentChunk.length;
      lastHeadingIndex = overlapStart - 1;
    }
  }
  
  // 添加最后一个分块
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks.filter(chunk => chunk.length >= 100); // 过滤掉太小的分块
};

/**
 * 按固定大小分块
 */
const chunkByFixedSize = (content, chunkSize, overlap, minChunkSize, maxChunks) => {
  const chunks = [];
  const contentLength = content.length;
  
  if (contentLength <= chunkSize) {
    return [content];
  }
  
  let start = 0;
  while (start < contentLength && chunks.length < maxChunks) {
    let end = start + chunkSize;
    
    // 如果没到结尾，尝试在段落边界分割
    if (end < contentLength) {
      // 查找最近的段落边界
      const paragraphBoundary = content.lastIndexOf('\n\n', end);
      if (paragraphBoundary > start + minChunkSize) {
        end = paragraphBoundary;
      }
    }
    
    // 确保不会超过内容长度
    end = Math.min(end, contentLength);
    
    // 提取分块
    const chunk = content.substring(start, end).trim();
    if (chunk.length >= minChunkSize) {
      chunks.push(chunk);
    }
    
    // 移动起始位置（考虑重叠）
    start = end - overlap;
    if (start < 0) start = 0;
    
    // 防止无限循环
    if (start >= end) {
      start = end;
    }
  }
  
  return chunks;
};

/**
 * 计算分块统计信息
 */
export const getChunkStats = (chunks) => {
  if (!chunks || chunks.length === 0) {
    return { count: 0, avgSize: 0, totalSize: 0 };
  }
  
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const avgSize = Math.round(totalSize / chunks.length);
  
  return {
    count: chunks.length,
    avgSize,
    totalSize,
    sizeDistribution: chunks.map((chunk, i) => ({
      index: i,
      size: chunk.length,
      preview: chunk.substring(0, 100) + '...'
    }))
  };
};