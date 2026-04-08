// src/utils/difyExtractor.js
// Dify投标文件信息提取工具（纯净版）

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
    if (lowerKey.includes(keyword) || keyword.includes(lowerKey)) return info;
  }
  return { category: 'other', label: '其他字段', priority: 4 };
};

const normalizeFieldValue = (key, value) => {
  if (!value || typeof value !== 'string') return value;
  return value.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
};

const computeFieldConfidence = (key, value, source = 'dify') => {
  let confidence = 0.5;
  const classification = classifyField(key);
  if (classification.priority <= 2) confidence += 0.15;
  if (value && value.length > 0) {
    confidence += 0.1;
    if (value.length > 2 && value.length < 200) confidence += 0.1;
  }
  if (source === 'dify') {
    confidence += 0.20;
  } else if (source === 'kv_extract') {
    confidence += 0.05; 
  }
  return Math.min(confidence, 1.0);
};

const chunkHasPotential = (chunk) => {
  const lower = chunk.toLowerCase();
  const infoSignals = [
    /[:：]/, /\|/, /\*\*.+?\*\*[:：]/,
    /公司|企业|单位|投标人|供应商/, /法定代表人|法人|负责人/,
    /注册|成立|地址|电话|邮箱|邮编/, /资本|金额|报价|保证金|银行/,
    /编号|许可证|资质|证书/, /项目经理|技术负责人|授权代表/,
    /工期|有效期|质量标准/, /\d{4}[-/年]\d{1,2}[-/月]\d{1,2}/,
    /\d{6,}/, /@/
  ];
  for (const signal of infoSignals) {
    if (signal.test(lower)) return true;
  }
  return false;
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
        const isCoreField = coreKeywords.some(keyword => key.includes(keyword) || keyword.includes(key));
        if (!isCoreField) continue;
      }
    }
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      if (value.length > 0 && value.length < 500) {
        const normalizedValue = normalizeFieldValue(key, value);
        fields.push({ key, value: normalizedValue, source: 'kv_extract', confidence: computeFieldConfidence(key, normalizedValue, 'kv_extract') });
      }
    }
  }
  return fields;
};

export const runDifyMarkdownExtraction = async (markdownContent, filename, options = {}) => {
  if (!EXTRACTION_API_KEY) throw new Error('未配置Dify信息提取API Key');
  if (!markdownContent || markdownContent.trim() === '') throw new Error('Markdown内容为空');

  const { chunkStrategy = 'hybrid', maxConcurrent = 3, chunkSize = 3000, overlap = 500, enableProgress = true, maxRetries = 1, maxChunks = 20 } = options;

  try {
    const kvFields = extractKVFields(markdownContent);
    const allChunks = intelligentChunking(markdownContent, { chunkSize, overlap, strategy: chunkStrategy, maxChunks });
    const chunksToProcess = allChunks.filter(chunkHasPotential);
    const skippedCount = allChunks.length - chunksToProcess.length;
    
    if (chunksToProcess.length === 0) {
      return { fields: kvFields, metadata: { filename, kv_extract_count: kvFields.length, processing_stats: { total_chunks: allChunks.length, processed_chunks: 0 } } };
    }

    const chunkResults = [];
    let completedChunks = 0;

    const updateProgress = (current, total, message = '') => {
      if (enableProgress && options.onProgress) {
        options.onProgress({ current, total, percent: Math.round((current / total) * 100), message });
      }
    };

    const batchSize = Math.min(maxConcurrent, chunksToProcess.length);
    for (let batchStart = 0; batchStart < chunksToProcess.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, chunksToProcess.length);
      const batch = chunksToProcess.slice(batchStart, batchEnd);

      const batchPromises = batch.map(async (chunk, index) => {
        const chunkIndex = batchStart + index;
        try {
          updateProgress(completedChunks, chunksToProcess.length, `处理分块 ${chunkIndex + 1}/${chunksToProcess.length}`);
          const result = await callDifyOnce(chunk, maxRetries);
          completedChunks++;
          updateProgress(completedChunks, chunksToProcess.length, `完成分块 ${chunkIndex + 1}/${chunksToProcess.length}`);
          if (!result || result.length === 0) return { index: chunkIndex, success: true, data: [], isEmpty: true };
          return { index: chunkIndex, success: true, data: result, chunkPreview: chunk.substring(0, 80) + '...' };
        } catch (error) {
          completedChunks++;
          updateProgress(completedChunks, chunksToProcess.length, `分块 ${chunkIndex + 1} 调用失败`);
          return { index: chunkIndex, success: false, error: error.message, data: null };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      chunkResults.push(...batchResults);
      if (batchEnd < chunksToProcess.length) await new Promise(resolve => setTimeout(resolve, 300));
    }

    const successfulResults = chunkResults.filter(r => r.success && !r.isEmpty);
    const extractionData = successfulResults.map(r => r.data);
    const mergedFields = mergeChunkFields(extractionData);

    const mergedMap = new Map();
    mergedFields.forEach(field => mergedMap.set(field.key.toLowerCase(), field));

    kvFields.forEach(kvField => {
      const existing = mergedMap.get(kvField.key.toLowerCase());
      if (!existing || kvField.confidence > (existing.confidence || 0)) mergedMap.set(kvField.key.toLowerCase(), kvField);
    });

    const allFields = Array.from(mergedMap.values());

    return {
      fields: allFields,
      metadata: {
        filename,
        kv_extract_count: kvFields.length,
        processing_stats: {
          total_chunks: allChunks.length,
          processed_chunks: chunksToProcess.length,
          skipped_chunks: skippedCount,
          successful_chunks: successfulResults.length
        }
      }
    };
  } catch (error) {
    throw error;
  }
};

const callDifyOnce = async (chunkContent, maxRetries = 1) => {
  let lastError = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      const result = await callSimpleDifyWorkflow(chunkContent);
      return result.map(field => ({
        ...field,
        source: 'dify',
        confidence: computeFieldConfidence(field.key, field.value, 'dify'),
      }));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

const callSimpleDifyWorkflow = async (chunkContent) => {
  const payload = { inputs: { markdown_content: chunkContent }, response_mode: 'blocking', user: 'bid-learner' };
  const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${EXTRACTION_API_KEY}`, 'Content-Type': 'application/json' },
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
      const cleanedText = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').replace(/<think[\s\S]*?<\/think>/gi, '').trim();
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) extractionData = JSON.parse(jsonMatch[0]);
    } catch (e) { }
  }
  if (!extractionData && difyResponse.data?.outputs?.extracted_data) extractionData = difyResponse.data.outputs.extracted_data;
  if (!extractionData && difyResponse.data?.outputs?.result) {
    try { extractionData = JSON.parse(difyResponse.data.outputs.result); } catch (e) { }
  }
  if (!extractionData) return [];
  return extractFields(extractionData);
};

const extractFields = (extractionData) => {
  if (Array.isArray(extractionData.fields)) {
    return extractionData.fields.filter(field => field && field.key && field.value && typeof field.key === 'string' && typeof field.value === 'string');
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
        fieldMap.set(normalizedKey, { key: field.key, value: field.value, source: field.source || 'dify', confidence: field.confidence || 0.5, occurrences: 1, allValues: [{ value: field.value, confidence: field.confidence || 0.5, source: field.source || 'dify', chunkIndex: resultIndex }] });
      } else {
        existing.occurrences++;
        existing.allValues.push({ value: field.value, confidence: field.confidence || 0.5, source: field.source || 'dify', chunkIndex: resultIndex });
        if (field.confidence > existing.confidence) {
          existing.key = field.key; existing.value = field.value; existing.confidence = field.confidence; existing.source = field.source || 'dify';
        } else if (field.value.length > existing.value.length && (field.confidence || 0.5) >= existing.confidence * 0.8) {
          existing.value = field.value; existing.key = field.key;
        }
      }
    });
  });
  return Array.from(fieldMap.values()).map(entry => ({ key: entry.key, value: entry.value, source: entry.source, confidence: entry.confidence, occurrences: entry.occurrences }));
};

const normalizeKey = (key) => key.toLowerCase().replace(/\s+/g, '').replace(/[（）()]/g, '').replace(/[：:]/g, '');
const normalizeValueForComparison = (value) => {
  if (!value) return '';
  return value.toLowerCase().replace(/\s+/g, '').replace(/[，,]/g, '').replace(/[（）()]/g, '').replace(/万元$/i, '万').replace(/元人民币$/i, '元').replace(/天$/i, '日').replace(/个日历天$/i, '日');
};

export const analyzeCrossDocumentFrequency = (docResults) => {
  const keyStats = new Map();
  docResults.forEach((docResult, docIndex) => {
    const fields = docResult.fields || [];
    fields.forEach(field => {
      if (!keyStats.has(field.key)) keyStats.set(field.key, { key: field.key, values: new Map(), classification: classifyField(field.key) });
      const stat = keyStats.get(field.key);
      const cleanValue = field.value.toLowerCase().replace(/\s+/g, '');
      if (!stat.values.has(cleanValue)) stat.values.set(cleanValue, { count: 0, originalValue: field.value });
      stat.values.get(cleanValue).count++;
    });
  });
  const totalDocs = docResults.length;
  return Array.from(keyStats.values()).map(stat => {
    let bestValue = ''; let maxCount = 0; const allValuesList = [];
    stat.values.forEach((data, cleanVal) => {
      allValuesList.push({ value: data.originalValue, count: data.count, avgConfidence: 0.9 });
      if (data.count > maxCount) { maxCount = data.count; bestValue = data.originalValue; }
    });
    return { key: stat.key, value: bestValue, frequency: `${maxCount}/${totalDocs}`, frequencyNumber: maxCount, consistent: stat.values.size === 1, allValues: allValuesList, classification: stat.classification, avgConfidence: 0.9 };
  }).sort((a, b) => b.frequencyNumber - a.frequencyNumber);
};