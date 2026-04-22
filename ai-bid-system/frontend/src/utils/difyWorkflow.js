// src/utils/difyWorkflow.js

// 全局环境变量读取
const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE || 'https://api.dify.ai/v1';
const FILL_BLANK_API_KEY = import.meta.env.VITE_DIFY_FILL_BLANK_API_KEY;
const AUDIT_API_KEY = import.meta.env.VITE_DIFY_AUDIT_API_KEY;

const parseDifyJsonOutput = (result = {}) => {
  const outputStr = result.data?.outputs?.text || result.data?.outputs?.result;
  if (!outputStr) return null;

  let cleanStr = String(outputStr)
    .replace(/<think[\s\S]*?<\/think>/gi, '')
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  try {
    return JSON.parse(cleanStr);
  } catch (error) {
    const jsonMatch = cleanStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (nestedError) {
        return null;
      }
    }
    return null;
  }
};

const buildFocusHint = (blank = {}) => {
  const hint = String(blank.auditFieldHint || blank.fieldHint || '').trim();
  if (!hint) return '当前只填写【🎯】对应的这个空白，不要参考同一句中的其他空白。';

  const fieldSpecific = {
    '投标人名称': '当前只填写公司名称，不要填写法定代表人、地址、电话、信用代码。',
    '法定代表人信息': '当前只填写法定代表人姓名，不要填写公司名称、性别、身份证号、职务。',
    '被授权人信息': '当前只填写被授权人姓名，不要填写公司名称、电话、身份证号。',
    '性别': '当前只填写性别，只能是男或女，不要填写姓名、公司名称、年龄、职务。',
    '年龄': '当前只填写年龄，必须是数字，不要填写姓名、公司名称、职务。',
    '职务': '当前只填写职务，不要填写姓名、公司名称、身份证号。',
    '身份证号码': '当前只填写身份证号码，不要填写姓名、公司名称、电话。',
    '电话': '当前只填写联系电话，不要填写姓名、公司名称、身份证号。',
    '邮箱': '当前只填写邮箱地址，不要填写公司名称、电话。',
    '地址': '当前只填写地址，不要填写公司名称、信用代码、电话。',
    '统一社会信用代码': '当前只填写统一社会信用代码，不要填写公司名称、地址、电话。',
    '开户行': '当前只填写开户行名称，不要填写账号或公司名称。',
    '银行账号': '当前只填写银行账号，不要填写开户行或公司名称。',
    '项目名称': '当前只填写项目名称，不要填写公司名称或报价。',
    '项目': '当前只填写项目名称，不要填写公司名称或报价。',
    '报价': '当前只填写报价相关内容，不要填写公司名称或项目名称。',
    '型号': '当前只填写型号，不要填写产品名称或版本号。',
    '版本号': '当前只填写版本号，不要填写产品名称或型号。'
  };

  return `${hint}。${fieldSpecific[hint] || '当前只填写这个字段本身，不要把同一句里的其他字段内容填进来。'}`;
};

export const fillDocumentBlanks = async (blankContexts, companyName, tenderContext = '') => {
  if (!FILL_BLANK_API_KEY) throw new Error("未配置填报工作流 API Key");

  // 💡 修复重点：大幅度放宽拦截网，防止误杀！只有极其明确的金额和偏离才会拦截
  const MANUAL_CONTEXT_PATTERN = /总价|单价|费率|偏离度|响应差异/;
  const DATE_CONTEXT_PATTERN = /(?:投标)?日期[：:]?|年月日[：:]?|成立日期|出生日期|注册日期|签字生效|有效期|自.*?年.*?月.*?日.*?至.*?年.*?月.*?日|于.*?年.*?月.*?日/;
  
  const autoBlanks = [];
  const manualBlanks = [];
  
  for (const b of blankContexts) {
    const role = b.fill_role || 'auto'; // 💡 默认改为 auto！相信大模型的判断能力
    const isManualType = b.type === 'date_pattern';
    const hasManualContext = MANUAL_CONTEXT_PATTERN.test(b.context || '');
    const hasDateContext = DATE_CONTEXT_PATTERN.test(`${b.context || ''} ${b.markedContext || ''} ${b.auditFieldHint || ''} ${b.fieldHint || ''}`);
    
    if (role === 'manual' || isManualType || hasManualContext || hasDateContext) {
      manualBlanks.push(b);
    } else {
      autoBlanks.push(b);
    }
  }

  // ====== 修改 difyWorkflow.js 中的 blankList 映射逻辑 ======
  const blankList = autoBlanks.map(b => {
    // 优先使用底层（正则或上面去重函数）精准生成的 markedContext
    let finalMarkedContext = b.markedContext;
    
    // 🛡️ 极致兜底：万一遇到极特殊的缺失情况，利用坐标强行切出一个靶心
    if (!finalMarkedContext) {
       if (b.index !== undefined && b.index >= 0 && b.matchText) {
          finalMarkedContext = (b.context || '').substring(0, b.index) + '【🎯】' + (b.context || '').substring(b.index + b.matchText.length);
       } else if (b.matchText) {
          finalMarkedContext = (b.context || '').replace(b.matchText, '【🎯】');
       } else {
          finalMarkedContext = (b.context || '') + '【🎯】';
       }
    }

    if (b.type === 'attachment') {
      finalMarkedContext = "【🎯资质附件插入位置🎯】 " + (b.context || '');
    }
    
    return {
      id: b.id,
      context: finalMarkedContext,
      type: b.type,
      field_hint: b.auditFieldHint || b.fieldHint || '',
      focus_hint: buildFocusHint(b)
    };
  });
  const CHUNK_SIZE = 10;
  const chunks = [];
  for (let i = 0; i < blankList.length; i += CHUNK_SIZE) {
    chunks.push(blankList.slice(i, i + CHUNK_SIZE));
  }

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
      // 静默处理解析错误
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
};

export const reviewFilledBlanksWithAI = async (blanks = [], filledValues = {}, companyProfile = {}, tenderContext = '') => {
  if (!AUDIT_API_KEY || !DIFY_API_BASE) {
    throw new Error('未配置智能审核 API Key (VITE_DIFY_AUDIT_API_KEY)');
  }

  const companyProfileJson = JSON.stringify(companyProfile || {});
  const results = {};

  await Promise.all(blanks.map(async (blank) => {
    const filledValue = String(filledValues[blank.id] || '').trim();
    if (!filledValue) return;

    const payload = {
      inputs: {
        blank_id: blank.id,
        field_hint: blank.auditFieldHint || blank.fieldHint || '',
        local_context: blank.localContext || blank.context || '',
        full_context: blank.context || '',
        filled_value: filledValue,
        company_profile_json: companyProfileJson,
        tender_context: tenderContext || ''
      },
      response_mode: 'blocking',
      user: 'frontend-smart-audit-user'
    };

    const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${AUDIT_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`智能审核请求失败: ${response.status}`);
    }

    const result = await response.json();
    const parsed = parseDifyJsonOutput(result);
    if (parsed && parsed.blank_id) {
      results[parsed.blank_id] = {
        blankId: parsed.blank_id,
        status: parsed.status || 'warning',
        source: 'ai',
        reason: parsed.reason || 'AI 审核已完成',
        suggestedValue: parsed.suggested_value || ''
      };
    }
  }));

  return results;
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
    chunkSize = 3000,
    overlap = 500,
    strategy = 'hybrid',
    minChunkSize = 500,
    maxChunks = 20
  } = options;


  let content = markdownContent.trim();
  if (content.length === 0) {
    return [];
  }

  if (strategy === 'semantic' || strategy === 'hybrid') {
    const semanticChunks = chunkByHeadings(content, chunkSize, overlap, maxChunks);
    if (semanticChunks.length > 0 && semanticChunks.length <= maxChunks) {
      return semanticChunks;
    }
  }

  const fixedChunks = chunkByFixedSize(content, chunkSize, overlap, minChunkSize, maxChunks);
  
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
