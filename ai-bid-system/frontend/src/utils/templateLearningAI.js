const DIFY_API_BASE = import.meta.env.VITE_DIFY_API_BASE || 'https://api.dify.ai/v1';
const TEMPLATE_LEARNING_API_KEY = import.meta.env.VITE_DIFY_TEMPLATE_LEARNING_API_KEY;

const MAX_SAMPLES_PER_SLOT = 4;
const MAX_SAMPLE_CHARS = 1800;
const MAX_FIELD_CHARS = 200;

const sanitizeSampleContent = (text = '') => text
  .replace(/\b(20\d{2}[年./-]?\d{1,2}[月./-]?\d{1,2}日?)\b/g, '【日期】')
  .replace(/([￥¥]?\s?\d+[\d,，.]*(万元|元)?)/g, '【金额】')
  .replace(/([甲乙丙丁][方方]|采购人|招标人|招标单位|建设单位)[：:]?\s*[\u4e00-\u9fa5A-Za-z0-9（）()《》“”-]{2,40}/g, '$1：【项目相关方】')
  .replace(/项目名称[：:]?\s*[\u4e00-\u9fa5A-Za-z0-9（）()《》“”-]{2,50}/g, '项目名称：【项目名称】')
  .trim();

const trimSampleContent = (slotType, text = '') => {
  const normalized = sanitizeSampleContent(text);
  const limit = slotType === 'field' ? MAX_FIELD_CHARS : MAX_SAMPLE_CHARS;
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit)}...`;
};

const pickTopSamples = (samples = []) => samples
  .slice()
  .sort((a, b) => {
    const scoreDiff = (b.score || 0) - (a.score || 0);
    if (scoreDiff !== 0) return scoreDiff;
    return (b.raw_content || '').length - (a.raw_content || '').length;
  })
  .slice(0, MAX_SAMPLES_PER_SLOT);

const buildFallbackSummary = (slot, samples = []) => {
  const longest = pickTopSamples(samples).sort((a, b) => (b.raw_content || '').length - (a.raw_content || '').length)[0];
  return trimSampleContent(slot.slot_type, longest?.raw_content || '');
};

export const summarizeSlotSamplesWithAI = async (slot, samples = []) => {
  if (!samples.length) return '';

  const topSamples = pickTopSamples(samples);

  if (!TEMPLATE_LEARNING_API_KEY) {
    return buildFallbackSummary(slot, topSamples);
  }

  const trimmedSamplesText = topSamples
    .map((sample, index) => `样本${index + 1}（来源：${sample.source_filename} / ${sample.sample_title || '未命名片段'}）\n${trimSampleContent(slot.slot_type, sample.raw_content || '')}`)
    .join('\n\n');

  const prompt = [
    `槽位名称：${slot.slot_name}`,
    `章节路径：${slot.chapter_path || '未提供'}`,
    `槽位类型：${slot.slot_type}`,
    `样本数量：${topSamples.length}`,
    `每个样本最长字符数：${slot.slot_type === 'field' ? MAX_FIELD_CHARS : MAX_SAMPLE_CHARS}`,
    '任务：根据以下同一固定模板槽位的历史样本，归纳一版可复用的企业标准内容。',
    '要求：',
    '1. 只输出最终标准内容，不要解释。',
    '2. 删除或泛化历史项目名称、甲方名称、日期、金额、编号等项目专属信息。',
    '3. 保留企业通用能力、承诺、服务机制、标准写法。',
    '4. 如果是字段型槽位，只输出最稳定的一项值。',
    '5. 如果样本明显不足，尽量保守，基于已有内容输出。',
    '6. 每个样本都已经过裁剪，只能基于现有样本内容总结，不得补充样本中没有出现的新事实。',
    '',
    trimmedSamplesText
  ].join('\n');

  const workflowInputs = {
    slot_name: slot.slot_name,
    slot_name_: slot.slot_name,
    slot_type: slot.slot_type,
    slot_type_: slot.slot_type,
    chapter_path: slot.chapter_path || '',
    chapter_path_: slot.chapter_path || '',
    samples_text: prompt,
    samples_text_: prompt
  };

  const response = await fetch(`${DIFY_API_BASE}/workflows/run`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TEMPLATE_LEARNING_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      inputs: workflowInputs,
      response_mode: 'blocking',
      user: 'frontend-template-learning-user'
    })
  });

  if (!response.ok) {
    let errorMessage = `模板学习归纳失败: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData?.message) {
        errorMessage = `${errorMessage} - ${errorData.message}`;
      }
    } catch {
      // ignore body parse failure
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();
  let output = result.data?.outputs?.result || result.data?.outputs?.text || '';
  output = String(output).replace(/```(?:json|text)?/g, '').replace(/```/g, '').trim();

  if (!output || /缺少关键|请您补充|我需要以下内容|无法完成/.test(output)) {
    return buildFallbackSummary(slot, topSamples);
  }

  return output;
};

export const getTemplateLearningContextConfig = () => ({
  maxSamplesPerSlot: MAX_SAMPLES_PER_SLOT,
  maxSampleChars: MAX_SAMPLE_CHARS,
  maxFieldChars: MAX_FIELD_CHARS,
  aiEnabled: Boolean(TEMPLATE_LEARNING_API_KEY)
});

export const isTemplateLearningAIEnabled = () => Boolean(TEMPLATE_LEARNING_API_KEY);
