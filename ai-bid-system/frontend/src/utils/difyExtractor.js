// src/utils/difyExtractor.js
// Dify投标文件信息提取工具（支持前端分块 + 跨文档频率分析）

const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE || 'https://api.dify.ai/v1';
const EXTRACTION_API_KEY = import.meta.env.VITE_DIFY_EXTRACTION_API_KEY;

// 导入智能分块函数
import { intelligentChunking, getChunkStats } from './difyWorkflow.js';

/**
 * 运行Dify Markdown信息提取工作流（支持分块）
 * @param {string} markdownContent - Markdown格式的文档内容
 * @param {string} filename - 原始文件名
 * @param {Object} options - 提取选项
 * @returns {Promise<Array>} - 提取的字段数组 [{key, value}, ...]
 */
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
    maxConcurrent = 3,      // 最大并发数
    chunkSize = 1500,       // 分块大小
    overlap = 300,          // 重叠大小
    enableProgress = true   // 启用进度回调
  } = options;

  try {
    // 1. 智能分块
    console.log('📊 进行智能分块...');
    const chunks = intelligentChunking(markdownContent, {
      chunkSize,
      overlap,
      strategy: chunkStrategy,
      maxChunks: 20
    });

    const stats = getChunkStats(chunks);
    console.log(`📊 分块完成: ${stats.count} 个分块，平均大小: ${stats.avgSize} 字符`);

    if (chunks.length === 0) {
      throw new Error('分块失败，无法继续处理');
    }

    // 2. 准备分块处理
    const chunkResults = [];
    let completedChunks = 0;

    // 进度回调函数
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

    // 3. 分批处理分块（控制并发）
    const batchSize = Math.min(maxConcurrent, chunks.length);
    for (let batchStart = 0; batchStart < chunks.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, chunks.length);
      const batch = chunks.slice(batchStart, batchEnd);
      
      console.log(`🔄 处理批次 ${batchStart / batchSize + 1}: ${batch.length} 个分块`);

      // 创建批次承诺
      const batchPromises = batch.map(async (chunk, index) => {
        const chunkIndex = batchStart + index;
        try {
          updateProgress(completedChunks, chunks.length, `处理分块 ${chunkIndex + 1}/${chunks.length}`);
          
          const result = await callSimpleDifyWorkflow(chunk);
          
          completedChunks++;
          updateProgress(completedChunks, chunks.length, `完成分块 ${chunkIndex + 1}/${chunks.length}`);
          
          return {
            index: chunkIndex,
            success: true,
            data: result,
            chunkPreview: chunk.substring(0, 100) + '...'
          };
        } catch (error) {
          console.error(`❌ 分块 ${chunkIndex} 处理失败:`, error.message);
          completedChunks++;
          updateProgress(completedChunks, chunks.length, `分块 ${chunkIndex + 1} 失败`);
          
          return {
            index: chunkIndex,
            success: false,
            error: error.message,
            data: null
          };
        }
      });

      // 等待批次完成
      const batchResults = await Promise.all(batchPromises);
      chunkResults.push(...batchResults);
      
      // 批次间延迟，避免API限制
      if (batchEnd < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 4. 分析处理结果
    const successfulResults = chunkResults.filter(r => r.success);
    const failedResults = chunkResults.filter(r => !r.success);
    
    console.log(`📈 处理完成: ${successfulResults.length} 成功, ${failedResults.length} 失败`);

    if (successfulResults.length === 0) {
      throw new Error('所有分块处理都失败了');
    }

    // 5. 合并同一文档多个分块的提取结果
    console.log('🔄 合并分块提取结果...');
    const extractionData = successfulResults.map(r => r.data);
    const mergedFields = mergeChunkFields(extractionData);

    // 6. 添加处理元数据
    const result = {
      fields: mergedFields,
      metadata: {
        filename,
        processing_stats: {
          total_chunks: chunks.length,
          successful_chunks: successfulResults.length,
          failed_chunks: failedResults.length,
          chunk_strategy: chunkStrategy,
          chunk_size: chunkSize,
          overlap_size: overlap,
          processing_time: new Date().toISOString()
        },
        chunk_previews: successfulResults.slice(0, 3).map(r => r.chunkPreview)
      }
    };

    console.log('✅ Dify信息提取完成!');
    console.log(`  提取字段数: ${mergedFields.length}`);
    console.log(`  高频字段: ${mergedFields.slice(0, 5).map(f => f.key).join(', ')}`);

    return result;

  } catch (error) {
    console.error('❌ Dify信息提取过程错误:', error);
    throw error;
  }
};

/**
 * 调用简单的Dify工作流处理单个分块
 */
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

/**
 * 解析单个分块的提取结果
 */
const parseChunkResult = (difyResponse) => {
  // 尝试从不同位置获取提取结果
  let extractionData = null;
  
  // 1. 从outputs.text获取（JSON字符串）
  if (difyResponse.data?.outputs?.text) {
    try {
      const text = difyResponse.data.outputs.text;
      // 清理和提取JSON
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
  
  // 2. 从outputs.extracted_data获取（直接对象）
  if (!extractionData && difyResponse.data?.outputs?.extracted_data) {
    extractionData = difyResponse.data.outputs.extracted_data;
  }
  
  // 3. 从outputs.result获取
  if (!extractionData && difyResponse.data?.outputs?.result) {
    try {
      extractionData = JSON.parse(difyResponse.data.outputs.result);
    } catch (e) {
      console.warn('从result解析JSON失败:', e.message);
    }
  }
  
  // 如果都没有提取到，返回空结构
  if (!extractionData) {
    console.warn('未提取到结构化数据');
    return [];
  }
  
  // 提取fields数组
  return extractFields(extractionData);
};

/**
 * 从提取结果中提取fields数组
 */
const extractFields = (extractionData) => {
  // 如果直接有fields数组，直接返回
  if (Array.isArray(extractionData.fields)) {
    return extractionData.fields.filter(field => 
      field && field.key && field.value && typeof field.key === 'string' && typeof field.value === 'string'
    );
  }
  
  // 如果没有fields数组，尝试从其他格式转换
  const fields = [];
  
  // 如果是对象，把每个属性转为field
  if (typeof extractionData === 'object' && !Array.isArray(extractionData)) {
    Object.entries(extractionData).forEach(([key, value]) => {
      if (key.startsWith('_')) return; // 跳过元数据字段
      
      if (typeof value === 'string' && value.trim() !== '') {
        fields.push({ key, value: value.trim() });
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        fields.push({ key, value: String(value) });
      }
    });
  }
  
  return fields;
};

/**
 * 合并同一文档多个分块的fields
 */
const mergeChunkFields = (chunkResults) => {
  const fieldMap = new Map();
  
  chunkResults.forEach(fields => {
    fields.forEach(field => {
      const existing = fieldMap.get(field.key);
      if (!existing || field.value.length > existing.value.length) {
        // 取最长的值（通常更完整）
        fieldMap.set(field.key, field);
      }
    });
  });
  
  return Array.from(fieldMap.values());
};

/**
 * 分析多份文档的字段频率
 * @param {Array} docResults - 多份文档的提取结果数组
 * @returns {Array} - 分析结果 [{key, value, frequency, consistent, values}, ...]
 */
export const analyzeCrossDocumentFrequency = (docResults) => {
  console.log(`📊 开始跨文档分析，共 ${docResults.length} 份文档`);
  
  // 统计每个key出现的文档索引和值
  const keyStats = new Map();
  
  docResults.forEach((docResult, docIndex) => {
    const fields = docResult.fields || [];
    
    fields.forEach(field => {
      const { key, value } = field;
      if (!key || !value) return;
      
      if (!keyStats.has(key)) {
        keyStats.set(key, {
          key,
          values: new Map(), // value -> [docIndex1, docIndex2, ...]
          allValues: []      // 所有出现的值（用于检查一致性）
        });
      }
      
      const stat = keyStats.get(key);
      
      // 记录值出现的文档索引
      if (!stat.values.has(value)) {
        stat.values.set(value, []);
      }
      stat.values.get(value).push(docIndex);
      
      // 记录所有值
      stat.allValues.push(value);
    });
  });
  
  // 转换为分析结果
  const analysisResults = Array.from(keyStats.entries()).map(([key, stat]) => {
    const totalDocs = docResults.length;
    const frequency = stat.values.size > 0 ? stat.values.size : 0;
    
    // 检查值是否一致（所有文档的值都相同）
    const uniqueValues = Array.from(new Set(stat.allValues));
    const consistent = uniqueValues.length === 1;
    
    // 选择最常出现的值
    let mostCommonValue = '';
    let mostCommonCount = 0;
    
    stat.values.forEach((docIndices, value) => {
      if (docIndices.length > mostCommonCount) {
        mostCommonCount = docIndices.length;
        mostCommonValue = value;
      }
    });
    
    // 收集所有不同的值（用于显示）
    const allValues = Array.from(stat.values.entries()).map(([value, docIndices]) => ({
      value,
      count: docIndices.length,
      docIndices
    }));
    
    return {
      key,
      value: mostCommonValue,
      frequency: `${frequency}/${totalDocs}`,
      frequencyNumber: frequency,
      consistent,
      allValues,
      selected: false // 默认未选中
    };
  });
  
  // 按出现频率排序
  analysisResults.sort((a, b) => {
    // 先按频率（高到低）
    if (b.frequencyNumber !== a.frequencyNumber) {
      return b.frequencyNumber - a.frequencyNumber;
    }
    // 再按一致性（一致的在前面）
    if (a.consistent !== b.consistent) {
      return a.consistent ? -1 : 1;
    }
    // 最后按key字母顺序
    return a.key.localeCompare(b.key);
  });
  
  console.log(`✅ 跨文档分析完成，共 ${analysisResults.length} 个字段`);
  
  return analysisResults;
};

/**
 * 测试Dify连接
 */
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

/**
 * 测试分块功能
 */
export const testChunking = (markdownContent, options = {}) => {
  const chunks = intelligentChunking(markdownContent, options);
  return getChunkStats(chunks);
};

/**
 * 模拟跨文档分析（用于测试）
 */
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