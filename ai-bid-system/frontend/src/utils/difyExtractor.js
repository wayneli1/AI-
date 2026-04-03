// src/utils/difyExtractor.js
// Dify投标文件信息提取工具（支持前端分块）

const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE || 'https://api.dify.ai/v1';
const EXTRACTION_API_KEY = import.meta.env.VITE_DIFY_EXTRACTION_API_KEY;

// 导入智能分块函数
import { intelligentChunking, getChunkStats } from './difyWorkflow.js';

/**
 * 运行Dify Markdown信息提取工作流（支持分块）
 * @param {string} markdownContent - Markdown格式的文档内容
 * @param {string} filename - 原始文件名
 * @param {Object} options - 提取选项
 * @returns {Promise<Object>} - 提取的结构化信息
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
          
          const result = await callSimpleDifyWorkflow(
            chunk,
            `${filename}_chunk_${chunkIndex}`,
            chunkIndex,
            chunks.length
          );
          
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

    // 5. 合并提取结果
    console.log('🔄 合并分块提取结果...');
    const extractionData = successfulResults.map(r => r.data);
    const mergedResult = mergeExtractionResults(extractionData, {
      originalChunks: chunks.length,
      successfulChunks: successfulResults.length,
      failedChunks: failedResults.length
    });

    // 6. 添加处理元数据
    mergedResult.metadata = {
      ...mergedResult.metadata,
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
    };

    console.log('✅ Dify信息提取完成!');
    console.log(`  公司信息字段: ${Object.keys(mergedResult.company_info || {}).length}`);
    console.log(`  项目信息字段: ${Object.keys(mergedResult.project_info || {}).length}`);
    console.log(`  技术要求: ${mergedResult.technical_requirements?.length || 0} 项`);
    console.log(`  评分标准: ${mergedResult.scoring_criteria?.length || 0} 项`);
    console.log(`  总体置信度: ${(mergedResult.metadata?.overall_confidence || 0) * 100}%`);

    return mergedResult;

  } catch (error) {
    console.error('❌ Dify信息提取过程错误:', error);
    throw error;
  }
};

/**
 * 调用简单的Dify工作流处理单个分块
 */
const callSimpleDifyWorkflow = async (chunkContent, chunkName, chunkIndex, totalChunks) => {
  const payload = {
    inputs: {
      markdown_content: chunkContent,
      filename: chunkName,
      chunk_index: chunkIndex,
      total_chunks: totalChunks,
      extraction_mode: 'structured'
    },
    response_mode: 'blocking',
    user: `bid_learning_chunk_${chunkIndex}`
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
  return parseChunkResult(result, chunkIndex);
};

/**
 * 解析单个分块的提取结果
 */
const parseChunkResult = (difyResponse, chunkIndex) => {
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
      console.warn(`分块 ${chunkIndex} 从text解析JSON失败:`, e.message);
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
      console.warn(`分块 ${chunkIndex} 从result解析JSON失败:`, e.message);
    }
  }
  
  // 如果都没有提取到，返回空结构
  if (!extractionData) {
    console.warn(`分块 ${chunkIndex} 未提取到结构化数据`);
    return createEmptyChunkResult(chunkIndex);
  }
  
  // 标准化提取结果
  return normalizeChunkResult(extractionData, chunkIndex);
};

/**
 * 创建空的分块结果
 */
const createEmptyChunkResult = (chunkIndex) => {
  return {
    company_info: {},
    project_info: {},
    technical_requirements: [],
    scoring_criteria: [],
    metadata: {
      chunk_index: chunkIndex,
      extraction_time: new Date().toISOString(),
      confidence: 0.1,
      empty: true
    }
  };
};

/**
 * 标准化分块提取结果
 */
const normalizeChunkResult = (extractionData, chunkIndex) => {
  const normalized = {
    company_info: {},
    project_info: {},
    technical_requirements: [],
    scoring_criteria: [],
    metadata: {
      chunk_index: chunkIndex,
      extraction_time: new Date().toISOString(),
      confidence: 0.5
    }
  };
  
  // 处理公司信息
  if (extractionData.company_info || extractionData.company) {
    const companyData = extractionData.company_info || extractionData.company;
    normalized.company_info = extractCompanyInfo(companyData);
  }
  
  // 处理项目信息
  if (extractionData.project_info || extractionData.project) {
    const projectData = extractionData.project_info || extractionData.project;
    normalized.project_info = extractProjectInfo(projectData);
  }
  
  // 处理技术要求
  if (extractionData.technical_requirements) {
    normalized.technical_requirements = extractTechnicalRequirements(extractionData.technical_requirements);
  }
  
  // 处理评分标准
  if (extractionData.scoring_criteria) {
    normalized.scoring_criteria = extractScoringCriteria(extractionData.scoring_criteria);
  }
  
  // 更新置信度
  updateConfidence(normalized);
  
  return normalized;
};

/**
 * 提取公司信息
 */
const extractCompanyInfo = (companyData) => {
  return {
    name: companyData.name || companyData.company_name,
    legal_rep: companyData.legal_rep || companyData.legal_representative || companyData.legal_person,
    uscc: companyData.uscc || companyData.unified_social_credit_code,
    address: companyData.address || companyData.company_address,
    phone: companyData.phone || companyData.telephone,
    email: companyData.email,
    registered_capital: companyData.registered_capital,
    company_type: companyData.company_type,
    _confidence: companyData._confidence || companyData.confidence || 0.5,
    _source: 'extracted'
  };
};

/**
 * 提取项目信息
 */
const extractProjectInfo = (projectData) => {
  return {
    name: projectData.name || projectData.project_name,
    type: projectData.type || projectData.project_type,
    amount: projectData.amount || projectData.bid_amount || projectData.budget,
    duration: projectData.duration || projectData.period,
    requirements: projectData.requirements || projectData.key_requirements,
    _confidence: projectData._confidence || projectData.confidence || 0.5,
    _source: 'extracted'
  };
};

/**
 * 提取技术要求
 */
const extractTechnicalRequirements = (requirements) => {
  if (Array.isArray(requirements)) {
    return requirements.map(req => ({
      title: req.title || '技术要求',
      description: req.description || req.content,
      standards: req.standards,
      priority: req.priority,
      _confidence: req._confidence || req.confidence || 0.5
    }));
  }
  return [{
    title: '技术要求',
    description: requirements,
    _confidence: 0.5
  }];
};

/**
 * 提取评分标准
 */
const extractScoringCriteria = (criteria) => {
  if (Array.isArray(criteria)) {
    return criteria.map(item => ({
      item: item.item || item.name,
      weight: item.weight || item.score,
      description: item.description,
      requirements: item.requirements,
      _confidence: item._confidence || item.confidence || 0.5
    }));
  }
  return [{
    item: '评分标准',
    description: criteria,
    _confidence: 0.5
  }];
};

/**
 * 更新置信度
 */
const updateConfidence = (result) => {
  const confidences = [];
  
  // 收集所有置信度
  if (result.company_info._confidence) confidences.push(result.company_info._confidence);
  if (result.project_info._confidence) confidences.push(result.project_info._confidence);
  
  result.technical_requirements?.forEach(req => {
    if (req._confidence) confidences.push(req._confidence);
  });
  
  result.scoring_criteria?.forEach(criteria => {
    if (criteria._confidence) confidences.push(criteria._confidence);
  });
  
  // 计算平均置信度
  if (confidences.length > 0) {
    result.metadata.confidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }
};

/**
 * 合并多个分块的提取结果
 */
const mergeExtractionResults = (chunkResults, stats) => {
  console.log(`🔄 合并 ${chunkResults.length} 个分块结果...`);
  
  const merged = {
    company_info: {},
    project_info: {},
    technical_requirements: [],
    scoring_criteria: [],
    conflicts: [],
    metadata: {
      overall_confidence: 0,
      extraction_completeness: 0,
      merge_stats: stats,
      merged_at: new Date().toISOString()
    }
  };
  
  // 1. 合并公司信息（取置信度最高的）
  const companyFields = {};
  chunkResults.forEach((result, index) => {
    if (result.company_info && Object.keys(result.company_info).length > 0) {
      Object.entries(result.company_info).forEach(([key, value]) => {
        if (key.startsWith('_')) return; // 跳过元数据字段
        
        if (!companyFields[key]) {
          companyFields[key] = [];
        }
        
        companyFields[key].push({
          value,
          confidence: result.company_info._confidence || 0.5,
          source: `chunk_${index}`
        });
      });
    }
  });
  
  // 选择每个字段的最佳值
  Object.entries(companyFields).forEach(([field, candidates]) => {
    // 按置信度排序
    candidates.sort((a, b) => b.confidence - a.confidence);
    
    // 选择置信度最高的
    const bestCandidate = candidates[0];
    merged.company_info[field] = bestCandidate.value;
    
    // 检查冲突（如果有多个不同的高置信度值）
    if (candidates.length > 1) {
      const uniqueValues = new Set(candidates.map(c => c.value));
      if (uniqueValues.size > 1) {
        merged.conflicts.push({
          field: `company_info.${field}`,
          candidates: candidates.slice(0, 3), // 只记录前3个候选
          resolution: 'highest_confidence'
        });
      }
    }
  });
  
  // 2. 合并项目信息
  const projectFields = {};
  chunkResults.forEach((result, index) => {
    if (result.project_info && Object.keys(result.project_info).length > 0) {
      Object.entries(result.project_info).forEach(([key, value]) => {
        if (key.startsWith('_')) return;
        
        if (!projectFields[key]) {
          projectFields[key] = [];
        }
        
        projectFields[key].push({
          value,
          confidence: result.project_info._confidence || 0.5,
          source: `chunk_${index}`
        });
      });
    }
  });
  
  Object.entries(projectFields).forEach(([field, candidates]) => {
    candidates.sort((a, b) => b.confidence - a.confidence);
    merged.project_info[field] = candidates[0].value;
    
    if (candidates.length > 1) {
      const uniqueValues = new Set(candidates.map(c => c.value));
      if (uniqueValues.size > 1) {
        merged.conflicts.push({
          field: `project_info.${field}`,
          candidates: candidates.slice(0, 3),
          resolution: 'highest_confidence'
        });
      }
    }
  });
  
  // 3. 合并技术要求（去重）
  const techReqsMap = new Map();
  chunkResults.forEach(result => {
    result.technical_requirements?.forEach(req => {
      const key = `${req.title}_${req.description?.substring(0, 50)}`;
      if (!techReqsMap.has(key) || (req._confidence || 0) > (techReqsMap.get(key)._confidence || 0)) {
        techReqsMap.set(key, req);
      }
    });
  });
  
  merged.technical_requirements = Array.from(techReqsMap.values());
  
  // 4. 合并评分标准（去重）
  const scoringMap = new Map();
  chunkResults.forEach(result => {
    result.scoring_criteria?.forEach(criteria => {
      const key = `${criteria.item}_${criteria.weight}`;
      if (!scoringMap.has(key) || (criteria._confidence || 0) > (scoringMap.get(key)._confidence || 0)) {
        scoringMap.set(key, criteria);
      }
    });
  });
  
  merged.scoring_criteria = Array.from(scoringMap.values());
  
  // 5. 计算总体指标
  const allConfidences = [];
  chunkResults.forEach(result => {
    if (result.metadata?.confidence) {
      allConfidences.push(result.metadata.confidence);
    }
  });
  
  if (allConfidences.length > 0) {
    merged.metadata.overall_confidence = allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length;
  }
  
  // 计算提取完整性
  const expectedFields = ['name', 'legal_rep', 'uscc', 'address', 'phone'];
  const extractedFields = Object.keys(merged.company_info).filter(key => merged.company_info[key]);
  merged.metadata.extraction_completeness = extractedFields.length / expectedFields.length;
  
  console.log(`✅ 合并完成: ${merged.conflicts.length} 个冲突需要人工验证`);
  
  return merged;
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