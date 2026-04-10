const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;

export const SLOT_TYPE_OPTIONS = [
  { label: '字段型', value: 'field' },
  { label: '标准内容型', value: 'standard_content' },
  { label: '固定附件型', value: 'fixed_asset' },
  { label: '人工确认型', value: 'manual' }
];

export const FILL_STRATEGY_OPTIONS = [
  { label: '公司资料直填', value: 'company_profile' },
  { label: '标准内容库', value: 'standard_library' },
  { label: '固定附件选择', value: 'asset_selection' },
  { label: '人工确认', value: 'manual_confirm' }
];

export const SLOT_TYPE_LABELS = Object.fromEntries(SLOT_TYPE_OPTIONS.map((item) => [item.value, item.label]));
export const FILL_STRATEGY_LABELS = Object.fromEntries(FILL_STRATEGY_OPTIONS.map((item) => [item.value, item.label]));

const USER_FACING_SLOT_TYPE_LABELS = {
  field: '固定字段',
  standard_content: '推荐正文',
  fixed_asset: '固定附件',
  manual: '人工确认'
};

export const DEFAULT_TEMPLATE_SLOTS = [
  {
    template_name: '默认模板',
    slot_key: 'company_name',
    slot_name: '投标人名称',
    chapter_path: '封面 / 签署页',
    slot_type: 'field',
    fill_strategy: 'company_profile',
    learning_mode: 'field_extract',
    required: true,
    sort_order: 10,
    match_keywords: ['投标人名称', '投标人', '投标单位', '供应商', '单位名称'],
    notes: '直接取投标主体公司名称'
  },
  {
    template_name: '默认模板',
    slot_key: 'legal_representative',
    slot_name: '法定代表人',
    chapter_path: '授权委托书 / 法人证明',
    slot_type: 'field',
    fill_strategy: 'company_profile',
    learning_mode: 'field_extract',
    required: true,
    sort_order: 11,
    match_keywords: ['法定代表人', '法人代表', '法人', '法定代表人姓名'],
    notes: '直接取公司主体中的法人姓名'
  },
  {
    template_name: '默认模板',
    slot_key: 'company_intro',
    slot_name: '公司简介',
    chapter_path: '第四章 / 公司概况',
    slot_type: 'standard_content',
    fill_strategy: 'standard_library',
    learning_mode: 'content_summarize',
    required: true,
    sort_order: 20,
    match_keywords: ['公司简介', '公司概况', '企业简介', '企业概况'],
    notes: '企业标准版公司简介'
  },
  {
    template_name: '默认模板',
    slot_key: 'after_sales_plan',
    slot_name: '售后服务方案',
    chapter_path: '第三章 / 3.3',
    slot_type: 'standard_content',
    fill_strategy: 'standard_library',
    learning_mode: 'content_summarize',
    required: true,
    sort_order: 30,
    match_keywords: ['售后服务方案', '售后服务', '服务方案', '售后保障', '服务承诺'],
    notes: '企业标准版售后服务方案'
  },
  {
    template_name: '默认模板',
    slot_key: 'training_plan',
    slot_name: '培训方案',
    chapter_path: '第三章 / 3.4',
    slot_type: 'standard_content',
    fill_strategy: 'standard_library',
    learning_mode: 'content_summarize',
    required: true,
    sort_order: 31,
    match_keywords: ['培训方案', '培训计划', '培训服务', '培训安排'],
    notes: '企业标准版培训方案'
  },
  {
    template_name: '默认模板',
    slot_key: 'quality_assurance',
    slot_name: '质量保障措施',
    chapter_path: '第三章 / 质量保障',
    slot_type: 'standard_content',
    fill_strategy: 'standard_library',
    learning_mode: 'content_summarize',
    required: false,
    sort_order: 32,
    match_keywords: ['质量保障', '质量保证', '质量控制', '质量管理措施'],
    notes: '企业标准版质量保障措施'
  },
  {
    template_name: '默认模板',
    slot_key: 'after_sales_manual',
    slot_name: '售后服务手册',
    chapter_path: '附件 / 服务手册',
    slot_type: 'fixed_asset',
    fill_strategy: 'asset_selection',
    learning_mode: 'asset_detect',
    required: false,
    sort_order: 40,
    match_keywords: ['售后服务手册', '服务手册', '售后手册', '手册'],
    notes: '绑定固定手册资产'
  }
];

export const normalizeLearningText = (value = '') => value.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();

export const splitKeywords = (value = '') => value
  .split(/[，,、\n]/)
  .map((item) => item.trim())
  .filter(Boolean);

export const formatKeywords = (keywords = []) => keywords.join('，');

export const createSlotKey = (slotName = '') => slotName
  .trim()
  .toLowerCase()
  .replace(/[^\w\u4e00-\u9fa5]+/g, '_')
  .replace(/^_+|_+$/g, '')
  .slice(0, 80) || `slot_${Date.now()}`;

export const splitDocumentIntoSegments = (text = '') => {
  const normalized = normalizeLearningText(text);
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const segments = [];
  let currentTitle = '未命名片段';
  let currentLevel = 0;
  let buffer = [];
  let segmentIndex = 0;

  const pushBuffer = () => {
    const content = normalizeLearningText(buffer.join('\n'));
    if (!content) return;
    segments.push({
      id: `segment-${segmentIndex++}`,
      title: currentTitle,
      level: currentLevel,
      content,
      preview: content.slice(0, 140)
    });
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(HEADING_REGEX);
    if (headingMatch) {
      if (buffer.length > 0) pushBuffer();
      currentTitle = headingMatch[2].trim();
      currentLevel = headingMatch[1].length;
      buffer = [trimmed];
      return;
    }

    if (/^第[一二三四五六七八九十百]+[章节部分编]/.test(trimmed) || /^[一二三四五六七八九十]+[、.．]/.test(trimmed)) {
      if (buffer.length > 0) pushBuffer();
      currentTitle = trimmed;
      currentLevel = 1;
      buffer = [trimmed];
      return;
    }

    if (trimmed === '' && buffer.length > 0) {
      buffer.push('');
      return;
    }

    if (trimmed) {
      buffer.push(trimmed);
    }
  });

  if (buffer.length > 0) pushBuffer();

  return segments.filter((segment) => segment.content.length >= 40);
};

export const buildSlotMatcherText = (blank = {}) => normalizeLearningText([
  blank.fieldHint,
  blank._cellLabel,
  blank.localContext,
  blank.context,
  blank.matchText
].filter(Boolean).join(' ')).toLowerCase();

const normalizeMatcherToken = (value = '') => String(value)
  .toLowerCase()
  .replace(/[\s/()（）【】\[\]{}:：,，.。;；、_-]+/g, '');

const splitMatcherTerms = (value = '') => String(value)
  .split(/[\/｜|()（）【】\[\]\n:：,，.。;；、_-]+/)
  .map((item) => item.trim())
  .filter((item) => item.length >= 2 && !/^\d+(?:\.\d+)*$/.test(item));

const dedupeStrings = (values = []) => {
  const seen = new Set();
  return values.filter((value) => {
    const normalized = normalizeMatcherToken(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const buildSlotMatchCandidates = (slot = {}, preferredSamples = []) => dedupeStrings([
  slot.slot_name,
  ...(Array.isArray(slot.match_keywords) ? slot.match_keywords : []),
  ...splitMatcherTerms(slot.chapter_path || ''),
  ...splitMatcherTerms(slot.notes || ''),
  ...preferredSamples.map((sample) => sample.sample_title).filter(Boolean)
]);

const scoreCandidateMatch = (haystack = '', haystackCompact = '', candidate = '') => {
  const normalizedCandidate = normalizeMatcherToken(candidate);
  if (!normalizedCandidate || normalizedCandidate.length < 2) return 0;
  if (haystack.includes(String(candidate).trim().toLowerCase())) return normalizedCandidate.length * 3;
  if (haystackCompact.includes(normalizedCandidate)) return normalizedCandidate.length * 2;
  return 0;
};

export const getUserFacingSlotTypeLabel = (slotType = '') => USER_FACING_SLOT_TYPE_LABELS[slotType] || slotType;

export const matchSlotForBlank = (blank, slots = [], assetsBySlotId = {}, selectedSamplesBySlotId = {}) => {
  const haystack = buildSlotMatcherText(blank);
  if (!haystack) return null;

  const haystackCompact = normalizeMatcherToken(haystack);
  const fieldHintCompact = normalizeMatcherToken(`${blank.fieldHint || ''} ${blank._cellLabel || ''}`);
  let bestMatch = null;
  let bestScore = 0;

  slots.forEach((slot) => {
    const preferredSamples = selectedSamplesBySlotId[slot.id] || [];
    const candidates = buildSlotMatchCandidates(slot, preferredSamples);
    let score = 0;

    if (fieldHintCompact && slot.slot_type === 'field') {
      candidates.forEach((candidate) => {
        const normalizedCandidate = normalizeMatcherToken(candidate);
        if (!normalizedCandidate) return;
        if (normalizedCandidate.includes(fieldHintCompact) || fieldHintCompact.includes(normalizedCandidate)) {
          score = Math.max(score, normalizedCandidate.length * 5);
        }
      });
    }

    candidates.forEach((candidate) => {
      score = Math.max(score, scoreCandidateMatch(haystack, haystackCompact, candidate));
    });

    if (preferredSamples.length > 0) {
      score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        slot,
        asset: assetsBySlotId[slot.id] || null,
        score
      };
    }
  });

  return bestScore >= 6 ? bestMatch : null;
};

export const buildTemplateLearningPrompt = (matchedSlots = []) => {
  if (!matchedSlots.length) return '';

  const lines = ['【已确认的常用内容】'];
  matchedSlots.forEach(({ slot, asset }) => {
    const header = `${slot.chapter_path || slot.slot_name}（${getUserFacingSlotTypeLabel(slot.slot_type)}）`;
    lines.push(`- ${header}`);
    if (asset?.standard_content) {
      lines.push(asset.standard_content);
    }
    if (asset?.asset_binding_type && asset?.asset_binding_value) {
      lines.push(`固定附件绑定：${asset.asset_binding_type} - ${asset.asset_binding_value}`);
    }
  });

  return lines.join('\n') + '\n';
};

export const getSlotLearningMode = (slot = {}) => {
  if (slot.learning_mode) return slot.learning_mode;
  if (slot.slot_type === 'fixed_asset' || slot.fill_strategy === 'asset_selection') return 'asset_detect';
  if (slot.slot_type === 'field' || slot.fill_strategy === 'company_profile') return 'field_extract';
  return 'content_summarize';
};

export const normalizeTemplateSlots = (slots = []) => {
  const defaultMap = new Map(DEFAULT_TEMPLATE_SLOTS.map((slot) => [slot.slot_key, slot]));
  const normalized = slots.map((slot) => {
    const defaults = defaultMap.get(slot.slot_key);
    if (!defaults) {
      return {
        ...slot,
        learning_mode: getSlotLearningMode(slot)
      };
    }

    return {
      ...slot,
      slot_name: defaults.slot_name,
      chapter_path: defaults.chapter_path,
      slot_type: defaults.slot_type,
      fill_strategy: defaults.fill_strategy,
      sort_order: defaults.sort_order,
      match_keywords: defaults.match_keywords,
      notes: defaults.notes,
      learning_mode: defaults.learning_mode
    };
  });

  const existingKeys = new Set(normalized.map((slot) => slot.slot_key));
  DEFAULT_TEMPLATE_SLOTS.forEach((defaults) => {
    if (!existingKeys.has(defaults.slot_key)) {
      normalized.push(defaults);
    }
  });

  return normalized.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
};

export const matchSlotForSegment = (segment, slots = []) => {
  if (!segment?.content) return null;
  const haystack = normalizeLearningText(`${segment.title || ''}\n${segment.content}`).toLowerCase();
  const haystackCompact = normalizeMatcherToken(haystack);
  const titleText = normalizeLearningText(segment.title || '').toLowerCase();
  const titleCompact = normalizeMatcherToken(titleText);
  let bestMatch = null;
  let bestScore = 0;

  slots.forEach((slot) => {
    const candidates = buildSlotMatchCandidates(slot);
    let score = 0;
    candidates.forEach((candidate) => {
      const candidateText = String(candidate).trim().toLowerCase();
      const candidateCompact = normalizeMatcherToken(candidate);
      if (!candidateCompact) return;
      if (titleText && titleText.includes(candidateText)) {
        score = Math.max(score, candidateCompact.length * 5);
        return;
      }
      if (titleCompact && titleCompact.includes(candidateCompact)) {
        score = Math.max(score, candidateCompact.length * 4);
        return;
      }
      score = Math.max(score, scoreCandidateMatch(haystack, haystackCompact, candidate));
    });

    if (score > bestScore) {
      bestScore = score;
      bestMatch = { slot, score };
    }
  });

  return bestScore >= 6 ? bestMatch : null;
};

export const buildLearningDraftFromSamples = (slot, samples = []) => {
  if (!samples.length) return { standard_content: '', content_source: 'manual' };

  if (slot.slot_type === 'field') {
    const counts = new Map();
    samples.forEach((sample) => {
      const content = normalizeLearningText(sample.raw_content || sample.content || '');
      if (!content) return;
      counts.set(content, (counts.get(content) || 0) + 1);
    });
    const best = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)[0];
    return {
      standard_content: best?.[0] || normalizeLearningText(samples[0].raw_content || samples[0].content || ''),
      content_source: 'sample_derived'
    };
  }

  if (slot.slot_type === 'fixed_asset') {
    const manualSample = samples.find((sample) => /手册|彩页|白皮书|说明书/.test(sample.sample_title || sample.title || sample.raw_content || ''));
    return {
      standard_content: manualSample ? normalizeLearningText(manualSample.raw_content || manualSample.content || '') : '',
      content_source: 'sample_derived'
    };
  }

  const sorted = [...samples].sort((a, b) => {
    const aLen = normalizeLearningText(a.raw_content || a.content || '').length;
    const bLen = normalizeLearningText(b.raw_content || b.content || '').length;
    return bLen - aLen;
  });

  const preferred = sorted[0];
  return {
    standard_content: normalizeLearningText(preferred.raw_content || preferred.content || ''),
    content_source: 'sample_derived'
  };
};

const FIELD_PATTERNS = {
  company_name: [
    /(?:响应供应商名称|投标人名称|投标人|供应商名称|单位名称)[：:\s]+([^\n]{2,80})/g,
    /(?:响应供应商名称|投标人名称|投标人|供应商名称|单位名称)\s*\n\s*([^\n]{2,80})/g
  ],
  legal_representative: [
    /(?:法定代表人|法人代表|法定代表人姓名)[：:\s]+([^\n]{2,40})/g,
    /法定代表人\s*\n\s*([^\n]{2,40})/g
  ]
};

const cleanFieldValue = (slotKey, value = '') => {
  const cleaned = value
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[：:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return '';
  if (/^(姓名|签字|盖章|项目名称|职务|日期|电话|地址|邮箱)$/i.test(cleaned)) return '';
  if (slotKey === 'legal_representative' && /授权|声明|委托|证明|复印件|响应供应商/.test(cleaned)) return '';
  if (slotKey === 'company_name' && cleaned.length < 4) return '';
  return cleaned;
};

export const extractFieldSamplesFromText = (slot, text = '', sourceFilename = '') => {
  const patterns = FIELD_PATTERNS[slot.slot_key] || [];
  const matches = [];

  patterns.forEach((pattern) => {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      const value = cleanFieldValue(slot.slot_key, match[1] || '');
      if (!value) continue;
      matches.push({
        sample_title: slot.slot_name,
        raw_content: value,
        source_filename: sourceFilename,
        score: value.length
      });
    }
  });

  const deduped = [];
  const seen = new Set();
  matches.forEach((item) => {
    if (seen.has(item.raw_content)) return;
    seen.add(item.raw_content);
    deduped.push(item);
  });

  return deduped;
};

export const detectAssetSampleFromDocument = (slot, text = '', sourceFilename = '') => {
  const segments = splitDocumentIntoSegments(text);
  const candidate = segments.find((segment) => /售后服务手册|服务手册|VIP 级售后服务手册|手册/.test(`${segment.title}\n${segment.content}`));
  if (!candidate) return [];

  return [{
    sample_title: candidate.title || slot.slot_name,
    raw_content: '',
    source_filename: sourceFilename,
    score: candidate.content.length,
    asset_candidate_name: sourceFilename.replace(/\.[^.]+$/, '')
  }];
};
