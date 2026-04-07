// src/utils/difyExtractor.js
// Dify投标文件信息提取工具（优化版：减少API调用、跳过空结果、预过滤分块）

const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE || 'https://api.dify.ai/v1';
const EXTRACTION_API_KEY = import.meta.env.VITE_DIFY_EXTRACTION_API_KEY;

import { intelligentChunking, getChunkStats } from './difyWorkflow.js';

export const CORE_FIELD_CATEGORIES = {
  basic_info: {
    label: '基本信息',
    priority: 1,
    keywords: ['公司名称', '企业名称', '投标人', '供应商', '单位名称', '法定代表人', '法人代表', '注册资本', '注册资金', '统一社会信用代码', '信用代码', '成立日期', '成立时间', '公司类型', '企业类型', '注册地址', '住所', '公司地址', '经营范围', '营业期限'],
  },
  contact_info: {
    label: '联系信息',
    priority: 2,
    keywords: ['联系电话', '联系方式', '电话', '手机', '传真', '邮政编码', '邮编', '电子邮箱', '邮箱', '公司官网', '网址', '网站'],
  },
  legal_rep: {
    label: '法人信息',
    priority: 2,
    keywords: ['法定代表人', '法人代表', '身份证号码', '身份证号', '证件号码'],
  },
  project_team: {
    label: '项目团队',
    priority: 2,
    keywords: ['项目经理', '项目负责人', '项目总监', '技术负责人', '技术总监', '授权代表', '委托代理人', '联系人'],
  },
  financial: {
    label: '财务信息',
    priority: 3,
    keywords: ['开户银行', '开户行', '银行名称', '银行账号', '账号', '投标总价', '投标报价', '总报价', '报价', '投标保证金', '保证金金额', '履约保证金'],
  },
  qualification: {
    label: '资质信息',
    priority: 2,
    keywords: ['资质证书编号', '许可证号', '生产许可证编号', '安全生产许可证编号', '员工人数', '职工人数', '从业人员'],
  },
  bid_terms: {
    label: '投标条款',
    priority: 3,
    keywords: ['投标有效期', '有效期', '工期', '交货期', '服务期', '计划工期', '质量标准', '工程质量标准', '质量要求', '安全目标', '投标人名称', '投标日期', '日期'],
  },
};

const FIELD_CATEGORY_MAP = {};
Object.entries(CORE_FIELD_CATEGORIES).forEach(([categoryKey, category]) => {
  category.keywords.forEach(keyword => {
    FIELD_CATEGORY_MAP[keyword.toLowerCase()] = { category: categoryKey, label: category.label, priority: category.priority };
  });
});

const classifyField = (key) => {
  const lowerKey = key.toLowerCase();
  for (const [keyword, info] of Object.entries(FIELD_CATEGORY_MAP)) {
    if (lowerKey.includes(keyword) || keyword.includes(lowerKey)) {
      return info;
    }
  }
  return { category: 'other', label: '其他字段', priority: 4 };
};

const normalizeFieldValue = (key, value) => {
  if (!value || typeof value !== 'string') return value;
  
  let normalized = value.trim();
  normalized = normalized.replace(/\s+/g, ' ');
  
  if (/^(注册资本|注册资金|注册资本金)/i.test(key)) {
    normalized = normalized.replace(/人民币/i, '').replace(/元$/i, '').trim();
    if (!normalized.includes('万') && !normalized.includes('亿') && /^\d+$/.test(normalized.replace(/[,，]/g, ''))) {
      const num = parseInt(normalized.replace(/[,，]/g, ''));
      if (num > 10000) {
        normalized = (num / 10000) + '万元';
      } else {
        normalized = normalized + '万元';
      }
    }
  }
  
  if (/^(成立日期|成立时间|注册日期|投标日期|日期)/i.test(key)) {
    normalized = normalized.replace(/[年月]/g, '-').replace(/[日号]/g, '').replace(/\.$/g, '').trim();
    normalized = normalized.replace(/(\d{4})-(\d{1,2})-(\d{1,2})/, (match, y, m, d) => {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    });
  }
  
  if (/^(联系电话|电话|手机|传真)/i.test(key)) {
    normalized = normalized.replace(/[^\d-]/g, '');
  }
  
  if (/^(邮政编码|邮编)/i.test(key)) {
    normalized = normalized.replace(/[^\d]/g, '').substring(0, 6);
  }
  
  if (/^(统一社会信用代码|信用代码|USCC)/i.test(key)) {
    normalized = normalized.replace(/\s+/g, '').toUpperCase();
  }
  
  if (/^(银行账号|账号)/i.test(key)) {
    normalized = normalized.replace(/[^\d]/g, '');
  }
  
  if (/^(工期|交货期|服务期|计划工期)/i.test(key)) {
    const numMatch = normalized.match(/(\d+)/);
    if (numMatch) {
      normalized = numMatch[1] + '天';
    }
  }
  
  if (/^(员工人数|职工人数|从业人员|在职员工)/i.test(key)) {
    const numMatch = normalized.match(/(\d+)/);
    if (numMatch) {
      normalized = numMatch[1] + '人';
    }
  }
  
  return normalized;
};

const computeFieldConfidence = (key, value, source = 'dify') => {
  let confidence = 0.5;
  
  const classification = classifyField(key);
  if (classification.priority <= 2) {
    confidence += 0.15;
  }
  
  if (value && value.length > 0) {
    confidence += 0.1;
    if (value.length > 2 && value.length < 200) {
      confidence += 0.1;
    }
  }
  
  if (source === 'kv_extract') {
    confidence += 0.15;
  } else if (source === 'dify') {
    confidence += 0.05;
  }
  
  return Math.min(confidence, 1.0);
};

const chunkHasPotential = (chunk) => {
  const lower = chunk.toLowerCase();
  
  const infoSignals = [
    /[:：]/,
    /\*\*.+?\*\*[:：]/,
    /公司|企业|单位|投标人|供应商/,
    /法定代表人|法人|负责人/,
    /注册|成立|地址|电话|邮箱|邮编/,
    /资本|金额|报价|保证金|银行/,
    /编号|许可证|资质|证书/,
    /项目经理|技术负责人|授权代表/,
    /工期|有效期|质量标准/,
    /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/,
    /\d{6,}/,
    /@/,
  ];
  
  let signalCount = 0;
  for (const signal of infoSignals) {
    if (signal.test(lower)) {
      signalCount++;
      if (signalCount >= 2) return true;
    }
  }
  
  return signalCount >= 1;
};

const extractKVFields = (markdownContent) => {
  const fields = [];
  const lines = markdownContent.split('\n');
  
  const kvRegex = /^\*\*(.+?)\*\*[:：\s]+(.+)$/;
  const plainKvRegex = /^(.+?)[:：]\s*(.+)$/;
  
  const coreKeywords = Object.values(CORE_FIELD_CATEGORIES).flatMap(c => c.keywords);
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    let match = trimmed.match(kvRegex);
    
    if (!match) {
      match = trimmed.match(plainKvRegex);
      if (match) {
        const key = match[1].trim();
        const isCoreField = coreKeywords.some(keyword => 
          key.includes(keyword) || keyword.includes(key)
        );
        if (!isCoreField) continue;
      }
    }
    
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      
      if (value.length > 0 && value.length < 500) {
        const normalizedValue = normalizeFieldValue(key, value);
        const confidence = computeFieldConfidence(key, normalizedValue, 'kv_extract');
        
        fields.push({
          key,
          value: normalizedValue,
          source: 'kv_extract',
          confidence,
        });
      }
    }
  }
  
  return fields;
};

export const runDifyMarkdownExtraction = async (markdownContent, filename, options = {}) => {
  if (!EXTRACTION_API_KEY) {
    throw new Error('未配置Dify信息提取API Key (VITE_DIFY_EXTRACTION_API_KEY)');
  }

  if (!markdownContent || markdownContent.trim() === '') {
    throw new Error('Markdown内容为空');
  }

  console.log('🚀 开始Dify信息提取，内容长度:', markdownContent.length, '字符');

  const {
    chunkStrategy = 'hybrid',
    maxConcurrent = 3,
    chunkSize = 3000,
    overlap = 500,
    enableProgress = true,
    maxRetries = 1,
    maxChunks = 20,
  } = options;

  try {
    const kvFields = extractKVFields(markdownContent);
    console.log(`📋 键值对预提取: ${kvFields.length} 个字段`);

    console.log('📊 进行智能分块...');
    const allChunks = intelligentChunking(markdownContent, {
      chunkSize,
      overlap,
      strategy: chunkStrategy,
      maxChunks,
    });

    const chunksToProcess = allChunks.filter(chunk => chunkHasPotential(chunk));
    const skippedCount = allChunks.length - chunksToProcess.length;
    
    const stats = getChunkStats(chunksToProcess);
    console.log(`📊 分块: ${allChunks.length} 总块 → ${chunksToProcess.length} 有效块（跳过 ${skippedCount} 个无信息量分块），平均大小: ${stats.avgSize} 字符`);

    if (chunksToProcess.length === 0) {
      console.log('⚠️ 没有需要Dify处理的分块，返回键值对提取结果');
      return {
        fields: kvFields,
        metadata: {
          filename,
          kv_extract_count: kvFields.length,
          processing_stats: {
            total_chunks: allChunks.length,
            processed_chunks: 0,
            skipped_chunks: skippedCount,
            dify_calls: 0,
            chunk_strategy: chunkStrategy,
            chunk_size: chunkSize,
            overlap_size: overlap,
            processing_time: new Date().toISOString()
          },
        }
      };
    }

    const chunkResults = [];
    let completedChunks = 0;
    let difyCalls = 0;
    let emptyResults = 0;

    const updateProgress = (current, total, message = '') => {
      if (enableProgress && options.onProgress) {
        options.onProgress({
          current,
          total,
          percent: Math.round((current / total) * 100),
          message
        });
      }
    };

    const batchSize = Math.min(maxConcurrent, chunksToProcess.length);
    for (let batchStart = 0; batchStart < chunksToProcess.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, chunksToProcess.length);
      const batch = chunksToProcess.slice(batchStart, batchEnd);
      
      console.log(`🔄 处理批次 ${Math.floor(batchStart / batchSize) + 1}: ${batch.length} 个分块`);

      const batchPromises = batch.map(async (chunk, index) => {
        const chunkIndex = batchStart + index;
        try {
          updateProgress(completedChunks, chunksToProcess.length, `处理分块 ${chunkIndex + 1}/${chunksToProcess.length}`);
          
          difyCalls++;
          const result = await callDifyOnce(chunk, maxRetries);
          
          completedChunks++;
          updateProgress(completedChunks, chunksToProcess.length, `完成分块 ${chunkIndex + 1}/${chunksToProcess.length}`);
          
          if (!result || result.length === 0) {
            emptyResults++;
            return {
              index: chunkIndex,
              success: true,
              data: [],
              isEmpty: true,
            };
          }
          
          return {
            index: chunkIndex,
            success: true,
            data: result,
            chunkPreview: chunk.substring(0, 80) + '...'
          };
        } catch (error) {
          console.warn(`⚠️ 分块 ${chunkIndex} API调用失败:`, error.message);
          completedChunks++;
          updateProgress(completedChunks, chunksToProcess.length, `分块 ${chunkIndex + 1} 调用失败`);
          
          return {
            index: chunkIndex,
            success: false,
            error: error.message,
            data: null
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      chunkResults.push(...batchResults);
      
      if (batchEnd < chunksToProcess.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    const successfulResults = chunkResults.filter(r => r.success && !r.isEmpty);
    const apiFailures = chunkResults.filter(r => !r.success);
    
    console.log(`📈 处理完成: ${successfulResults.length} 块提取到字段, ${emptyResults} 块无字段(正常), ${apiFailures.length} 块API失败`);

    const extractionData = successfulResults.map(r => r.data);
    const mergedFields = mergeChunkFields(extractionData);

    const mergedMap = new Map();
    mergedFields.forEach(field => {
      mergedMap.set(field.key.toLowerCase(), field);
    });

    kvFields.forEach(kvField => {
      const existing = mergedMap.get(kvField.key.toLowerCase());
      if (!existing || kvField.confidence > (existing.confidence || 0)) {
        mergedMap.set(kvField.key.toLowerCase(), kvField);
      }
    });

    const allFields = Array.from(mergedMap.values());

    const result = {
      fields: allFields,
      metadata: {
        filename,
        kv_extract_count: kvFields.length,
        processing_stats: {
          total_chunks: allChunks.length,
          processed_chunks: chunksToProcess.length,
          skipped_chunks: skippedCount,
          successful_chunks: successfulResults.length,
          empty_chunks: emptyResults,
          api_failures: apiFailures.length,
          dify_calls: difyCalls,
          chunk_strategy: chunkStrategy,
          chunk_size: chunkSize,
          overlap_size: overlap,
          processing_time: new Date().toISOString()
        },
        chunk_previews: successfulResults.slice(0, 3).map(r => r.chunkPreview)
      }
    };

    console.log('✅ Dify信息提取完成!');
    console.log(`  提取字段数: ${allFields.length} (KV预提取: ${kvFields.length}, Dify补充: ${allFields.length - kvFields.length})`);
    console.log(`  API调用: ${difyCalls} 次, 空结果: ${emptyResults} 次`);

    return result;

  } catch (error) {
    console.error('❌ Dify信息提取过程错误:', error);
    throw error;
  }
};

const callDifyOnce = async (chunkContent, maxRetries = 1) => {
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`🔄 重试第 ${attempt} 次...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
      
      const result = await callSimpleDifyWorkflow(chunkContent);
      return result.map(field => ({
        ...field,
        source: 'dify',
        confidence: computeFieldConfidence(field.key, field.value, 'dify'),
      }));
    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Dify调用失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, error.message);
    }
  }
  
  throw lastError;
};

const callSimpleDifyWorkflow = async (chunkContent) => {
  const payload = {
    inputs: {
      markdown_content: chunkContent
    },
    response_mode: 'blocking',
    user: 'bid-learner'
  };

  const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${EXTRACTION_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dify请求失败 (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return parseChunkResult(result);
};

const parseChunkResult = (difyResponse) => {
  let extractionData = null;
  
  if (difyResponse.data?.outputs?.text) {
    try {
      const text = difyResponse.data.outputs.text;
      const cleanedText = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/<think[\s\S]*?<\/think>/gi, '')
        .trim();
      
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        extractionData = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.warn('从text解析JSON失败:', e.message);
    }
  }
  
  if (!extractionData && difyResponse.data?.outputs?.extracted_data) {
    extractionData = difyResponse.data.outputs.extracted_data;
  }
  
  if (!extractionData && difyResponse.data?.outputs?.result) {
    try {
      extractionData = JSON.parse(difyResponse.data.outputs.result);
    } catch (e) {
      console.warn('从result解析JSON失败:', e.message);
    }
  }
  
  if (!extractionData) {
    return [];
  }
  
  return extractFields(extractionData);
};

const extractFields = (extractionData) => {
  if (Array.isArray(extractionData.fields)) {
    return extractionData.fields.filter(field => 
      field && field.key && field.value && typeof field.key === 'string' && typeof field.value === 'string'
    );
  }
  
  const fields = [];
  
  if (typeof extractionData === 'object' && !Array.isArray(extractionData)) {
    Object.entries(extractionData).forEach(([key, value]) => {
      if (key.startsWith('_')) return;
      
      if (typeof value === 'string' && value.trim() !== '') {
        fields.push({ key, value: value.trim() });
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        fields.push({ key, value: String(value) });
      }
    });
  }
  
  return fields;
};

const mergeChunkFields = (chunkResults) => {
  const fieldMap = new Map();
  
  chunkResults.forEach((fields, resultIndex) => {
    fields.forEach(field => {
      const normalizedKey = field.key.toLowerCase();
      const existing = fieldMap.get(normalizedKey);
      
      if (!existing) {
        fieldMap.set(normalizedKey, {
          key: field.key,
          value: field.value,
          source: field.source || 'dify',
          confidence: field.confidence || 0.5,
          occurrences: 1,
          allValues: [{ value: field.value, confidence: field.confidence || 0.5, source: field.source || 'dify', chunkIndex: resultIndex }],
        });
      } else {
        existing.occurrences++;
        existing.allValues.push({
          value: field.value,
          confidence: field.confidence || 0.5,
          source: field.source || 'dify',
          chunkIndex: resultIndex,
        });
        
        if (field.confidence > existing.confidence) {
          existing.key = field.key;
          existing.value = field.value;
          existing.confidence = field.confidence;
          existing.source = field.source || 'dify';
        } else if (field.value.length > existing.value.length && (field.confidence || 0.5) >= existing.confidence * 0.8) {
          existing.value = field.value;
          existing.key = field.key;
        }
      }
    });
  });
  
  return Array.from(fieldMap.values()).map(entry => ({
    key: entry.key,
    value: entry.value,
    source: entry.source,
    confidence: entry.confidence,
    occurrences: entry.occurrences,
  }));
};

export const analyzeCrossDocumentFrequency = (docResults) => {
  console.log(`📊 开始跨文档分析，共 ${docResults.length} 份文档`);
  
  const keyStats = new Map();
  
  docResults.forEach((docResult, docIndex) => {
    const fields = docResult.fields || [];
    
    fields.forEach(field => {
      const { key, value } = field;
      if (!key || !value) return;
      
      const normalizedKey = normalizeKey(key);
      
      if (!keyStats.has(normalizedKey)) {
        keyStats.set(normalizedKey, {
          key: key,
          normalizedKey,
          values: new Map(),
          allValues: [],
          classification: classifyField(key),
          totalOccurrences: 0,
          confidences: [],
        });
      }
      
      const stat = keyStats.get(normalizedKey);
      stat.totalOccurrences++;
      
      const normalizedValue = normalizeFieldValue(key, value);
      const similarityKey = normalizeValueForComparison(normalizedValue);
      
      if (!stat.values.has(similarityKey)) {
        stat.values.set(similarityKey, []);
      }
      stat.values.get(similarityKey).push(docIndex);
      
      stat.allValues.push({
        value: normalizedValue,
        docIndex,
        confidence: field.confidence || 0.5,
        source: field.source || 'dify',
      });
      
      if (field.confidence) {
        stat.confidences.push(field.confidence);
      }
    });
  });
  
  const analysisResults = Array.from(keyStats.entries()).map(([normalizedKey, stat]) => {
    const totalDocs = docResults.length;
    const frequency = stat.values.size;
    
    const uniqueValues = Array.from(new Set(stat.allValues.map(v => normalizeValueForComparison(v.value))));
    const consistent = uniqueValues.length === 1;
    
    let mostCommonValue = '';
    let mostCommonCount = 0;
    
    stat.values.forEach((docIndices, value) => {
      if (docIndices.length > mostCommonCount) {
        mostCommonCount = docIndices.length;
        mostCommonValue = value;
      }
    });
    
    const avgConfidence = stat.confidences.length > 0
      ? stat.confidences.reduce((a, b) => a + b, 0) / stat.confidences.length
      : 0.5;
    
    const allValues = Array.from(stat.values.entries()).map(([value, docIndices]) => {
      const matchingEntries = stat.allValues.filter(v => normalizeValueForComparison(v.value) === value);
      const avgConf = matchingEntries.length > 0
        ? matchingEntries.reduce((sum, v) => sum + v.confidence, 0) / matchingEntries.length
        : 0.5;
      return {
        value,
        count: docIndices.length,
        docIndices,
        avgConfidence: avgConf,
      };
    });
    
    return {
      key: stat.key,
      value: mostCommonValue,
      frequency: `${frequency}/${totalDocs}`,
      frequencyNumber: frequency,
      consistent,
      allValues,
      selected: false,
      classification: stat.classification,
      avgConfidence: Math.round(avgConfidence * 100) / 100,
      totalOccurrences: stat.totalOccurrences,
    };
  });
  
  analysisResults.sort((a, b) => {
    if (b.frequencyNumber !== a.frequencyNumber) {
      return b.frequencyNumber - a.frequencyNumber;
    }
    if (a.consistent !== b.consistent) {
      return a.consistent ? -1 : 1;
    }
    if (a.avgConfidence !== b.avgConfidence) {
      return b.avgConfidence - a.avgConfidence;
    }
    const priorityA = a.classification?.priority || 4;
    const priorityB = b.classification?.priority || 4;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.key.localeCompare(b.key);
  });
  
  console.log(`✅ 跨文档分析完成，共 ${analysisResults.length} 个字段`);
  
  return analysisResults;
};

const normalizeKey = (key) => {
  return key
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[（）()]/g, '')
    .replace(/[：:]/g, '');
};

const normalizeValueForComparison = (value) => {
  if (!value) return '';
  return value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，,]/g, '')
    .replace(/[（）()]/g, '')
    .replace(/万元$/i, '万')
    .replace(/元人民币$/i, '元')
    .replace(/天$/i, '日')
    .replace(/个日历天$/i, '日');
};

export const testDifyConnection = async () => {
  if (!EXTRACTION_API_KEY) {
    return { connected: false, error: '未配置API Key' };
  }
  
  try {
    const response = await fetch(`${DIFY_API_BASE}/workflows`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${EXTRACTION_API_KEY}`
      }
    });
    
    return { 
      connected: response.ok, 
      status: response.status,
      statusText: response.statusText
    };
  } catch (error) {
    return { connected: false, error: error.message };
  }
};

export const testChunking = (markdownContent, options = {}) => {
  const chunks = intelligentChunking(markdownContent, options);
  return getChunkStats(chunks);
};

export const mockCrossDocumentAnalysis = () => {
  const mockResults = [
    {
      fields: [
        { key: '法定代表人', value: '张三' },
        { key: '注册资本', value: '500万元' },
        { key: '联系电话', value: '13800138000' }
      ]
    },
    {
      fields: [
        { key: '法定代表人', value: '张三' },
        { key: '注册资本', value: '500万元' },
        { key: '项目经理', value: '李四' }
      ]
    },
    {
      fields: [
        { key: '法定代表人', value: '张三' },
        { key: '公司地址', value: '北京市朝阳区' }
      ]
    }
  ];
  
  return analyzeCrossDocumentFrequency(mockResults);
};
