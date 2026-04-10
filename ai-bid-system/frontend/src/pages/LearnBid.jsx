import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, CheckCircle2, FileUp, PencilLine, Sparkles } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  List,
  message,
  Modal,
  Progress,
  Select,
  Space,
  Spin,
  Switch,
  Tag,
  Typography
} from 'antd';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractTextFromDocument } from '../utils/documentParser';
import {
  buildLearningDraftFromSamples,
  DEFAULT_TEMPLATE_SLOTS,
  extractFieldSamplesFromText,
  getUserFacingSlotTypeLabel,
  getSlotLearningMode,
  matchSlotForSegment,
  normalizeTemplateSlots,
  splitDocumentIntoSegments
} from '../utils/templateLearning';
import { getTemplateLearningContextConfig, summarizeSlotSamplesWithAI } from '../utils/templateLearningAI';

const { TextArea } = Input;
const DEFAULT_TEMPLATE_NAME = '默认模板';

const createSampleId = (slotKey, sample, index) => {
  if (sample?.id) return sample.id;
  return `${slotKey}-${sample?.source_filename || 'sample'}-${sample?.sample_title || 'untitled'}-${index}`;
};

const createEditorDraft = (item = {}) => ({
  standard_content: item.assetDraft?.standard_content || item.asset?.standard_content || '',
  asset_binding_value: item.assetDraft?.asset_binding_value || item.asset?.asset_binding_value || '',
  enabled: item.asset?.enabled ?? true,
  selectedSampleIds: item.selectedSampleIds || item.samples?.filter((sample) => sample.is_selected).map((sample, index) => createSampleId(item.slot?.slot_key, sample, index)) || []
});

const buildSavedLearningRecords = (slots = [], assets = [], samples = []) => {
  const assetsBySlotId = new Map(assets.map((item) => [item.slot_id, item]));
  const samplesBySlotId = new Map();

  samples.forEach((sample) => {
    const bucket = samplesBySlotId.get(sample.slot_id) || [];
    bucket.push(sample);
    samplesBySlotId.set(sample.slot_id, bucket);
  });

  return normalizeTemplateSlots(slots).map((slot) => {
    const slotSamples = (samplesBySlotId.get(slot.id) || []).map((sample, index) => ({
      ...sample,
      sample_id: createSampleId(slot.slot_key, sample, index)
    }));
    const asset = assetsBySlotId.get(slot.id) || null;
    return {
      slot,
      asset,
      samples: slotSamples,
      selectedSampleIds: slotSamples.filter((sample) => sample.is_selected).map((sample) => sample.sample_id)
    };
  });
};

export default function LearnBid() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [templateName] = useState(DEFAULT_TEMPLATE_NAME);
  const [loading, setLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [savingManagedSlot, setSavingManagedSlot] = useState('');
  const [progress, setProgress] = useState({ percent: 0, text: '等待上传历史标书' });

  const [companyOptions, setCompanyOptions] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [systemSlots, setSystemSlots] = useState([]);
  const [savedLearningRecords, setSavedLearningRecords] = useState([]);
  const [learningResult, setLearningResult] = useState(null);
  const [editorState, setEditorState] = useState({ open: false, mode: 'preview', item: null, draft: createEditorDraft() });

  const learnedSlots = learningResult?.learnedSlots || [];

  const loadExistingSlots = useCallback(async () => {
    if (!user) return;
    if (!selectedCompanyId) {
      setSystemSlots(normalizeTemplateSlots(DEFAULT_TEMPLATE_SLOTS));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('template_slots')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_profile_id', selectedCompanyId)
        .eq('template_name', templateName)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSystemSlots(normalizeTemplateSlots((data || []).length ? (data || []) : DEFAULT_TEMPLATE_SLOTS));
    } catch (error) {
      console.error('加载模板槽位失败:', error);
      setSystemSlots(normalizeTemplateSlots(DEFAULT_TEMPLATE_SLOTS));
    } finally {
      setLoading(false);
    }
  }, [selectedCompanyId, templateName, user]);

  const loadSavedLearningRecords = useCallback(async () => {
    if (!user) return;
    if (!selectedCompanyId) {
      setSavedLearningRecords([]);
      setSavedLoading(false);
      return;
    }
    setSavedLoading(true);
    try {
      const [slotRes, assetRes, sampleRes] = await Promise.all([
        supabase
          .from('template_slots')
          .select('*')
          .eq('user_id', user.id)
          .eq('company_profile_id', selectedCompanyId)
          .eq('template_name', templateName)
          .order('sort_order', { ascending: true }),
        supabase
          .from('template_slot_assets')
          .select('*')
          .eq('user_id', user.id)
          .eq('company_profile_id', selectedCompanyId),
        supabase
          .from('template_slot_samples')
          .select('*')
          .eq('user_id', user.id)
          .eq('company_profile_id', selectedCompanyId)
          .order('created_at', { ascending: false })
      ]);

      if (slotRes.error) throw slotRes.error;
      if (assetRes.error) throw assetRes.error;
      if (sampleRes.error) throw sampleRes.error;

      setSavedLearningRecords(buildSavedLearningRecords(slotRes.data || [], assetRes.data || [], sampleRes.data || []));
    } catch (error) {
      console.error('加载学习管理数据失败:', error);
      setSavedLearningRecords([]);
    } finally {
      setSavedLoading(false);
    }
  }, [selectedCompanyId, templateName, user]);

  const loadCompanyOptions = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('id, company_name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const options = (data || []).map((item) => ({ label: item.company_name, value: item.id }));
      setCompanyOptions(options);
      setSelectedCompanyId((prev) => (prev && options.some((item) => item.value === prev) ? prev : options[0]?.value || null));
    } catch (error) {
      console.error('加载投标主体失败:', error);
      setCompanyOptions([]);
      setSelectedCompanyId(null);
    }
  }, [user]);

  useEffect(() => {
    loadCompanyOptions();
  }, [loadCompanyOptions]);

  useEffect(() => {
    loadExistingSlots();
    loadSavedLearningRecords();
  }, [loadExistingSlots, loadSavedLearningRecords]);

  useEffect(() => {
    setUploadedFiles([]);
    setLearningResult(null);
    setProgress({ percent: 0, text: selectedCompanyId ? '等待上传历史标书' : '请先选择投标主体' });
  }, [selectedCompanyId]);

  const summaryCards = useMemo(() => {
    if (!learningResult) return [];
    return [
      { label: '识别内容项', value: learningResult.summary.totalLearned },
      { label: '推荐正文', value: learningResult.summary.standardContentSlots },
      { label: '固定字段', value: learningResult.summary.fieldSlots }
    ];
  }, [learningResult]);

  const savedSummary = useMemo(() => ({
    enabledSlots: savedLearningRecords.filter((item) => item.asset?.enabled).length,
    managedSlots: savedLearningRecords.filter((item) => item.asset?.standard_content).length,
    selectedSamples: savedLearningRecords.reduce((sum, item) => sum + item.samples.filter((sample) => sample.is_selected).length, 0)
  }), [savedLearningRecords]);

  const learningConfig = useMemo(() => getTemplateLearningContextConfig(), []);

  const handleFilesSelect = async (files) => {
    setUploadedFiles(files);
    setLearningResult(null);
    setProgress({ percent: 0, text: files.length ? `已选择 ${files.length} 份历史文件` : '等待上传历史标书' });
  };

  const openEditor = (mode, item) => {
    setEditorState({ open: true, mode, item, draft: createEditorDraft(item) });
  };

  const closeEditor = () => {
    setEditorState({ open: false, mode: 'preview', item: null, draft: createEditorDraft() });
  };

  const updateEditorDraft = (patch) => {
    setEditorState((prev) => ({ ...prev, draft: { ...prev.draft, ...patch } }));
  };

  const applyEditorChangesToPreview = () => {
    const targetSlotKey = editorState.item?.slot?.slot_key;
    if (!targetSlotKey) return;

    setLearningResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        learnedSlots: prev.learnedSlots.map((item) => {
          if (item.slot.slot_key !== targetSlotKey) return item;
          return {
            ...item,
            selectedSampleIds: editorState.draft.selectedSampleIds,
            assetDraft: {
              ...item.assetDraft,
              standard_content: editorState.draft.standard_content.trim(),
              asset_binding_value: editorState.draft.asset_binding_value.trim() || null
            }
          };
        })
      };
    });
  };

  const saveManagedRecord = async () => {
    const item = editorState.item;
    if (!user || !selectedCompanyId || !item?.slot?.id) return;

    setSavingManagedSlot(item.slot.id);
    try {
      const assetPayload = {
        user_id: user.id,
        company_profile_id: selectedCompanyId,
        slot_id: item.slot.id,
        standard_content: editorState.draft.standard_content.trim() || null,
        content_source: item.asset?.content_source || 'manual',
        asset_binding_type: null,
        asset_binding_value: null,
        enabled: editorState.draft.enabled
      };

      const { error: assetError } = await supabase
        .from('template_slot_assets')
        .upsert(assetPayload, { onConflict: 'user_id,company_profile_id,slot_id' });
      if (assetError) throw assetError;

      const { error: clearError } = await supabase
        .from('template_slot_samples')
        .update({ is_selected: false })
        .eq('user_id', user.id)
        .eq('company_profile_id', selectedCompanyId)
        .eq('slot_id', item.slot.id);
      if (clearError) throw clearError;

      if (editorState.draft.selectedSampleIds.length > 0) {
        const { error: markError } = await supabase
          .from('template_slot_samples')
          .update({ is_selected: true })
          .in('id', editorState.draft.selectedSampleIds);
        if (markError) throw markError;
      }

      message.success('已保存人工校验结果');
      closeEditor();
      await loadSavedLearningRecords();
    } catch (error) {
      console.error('保存人工校验结果失败:', error);
      message.error(`保存失败: ${error.message}`);
    } finally {
      setSavingManagedSlot('');
    }
  };

  const handleEditorSave = async () => {
    if (editorState.mode === 'preview') {
      applyEditorChangesToPreview();
      closeEditor();
      message.success('已更新本次整理结果，确认后会正式投入使用');
      return;
    }
    await saveManagedRecord();
  };

  const runLearning = async () => {
    if (!selectedCompanyId) {
      message.warning('请先选择投标主体');
      return;
    }

    if (!uploadedFiles.length) {
      message.warning('请先上传历史投标文件');
      return;
    }

    setRunning(true);
    setLearningResult(null);

    try {
      const sampleBuckets = new Map(systemSlots.map((slot) => [slot.slot_key, []]));
      let processed = 0;

      for (const file of uploadedFiles) {
        setProgress({ percent: Math.round((processed / uploadedFiles.length) * 100), text: `正在解析 ${file.name}` });
        const text = await extractTextFromDocument(file);
        const segments = splitDocumentIntoSegments(text);

        systemSlots.forEach((slot) => {
          const learningMode = getSlotLearningMode(slot);
          if (learningMode !== 'field_extract') return;

          const samples = extractFieldSamplesFromText(slot, text, file.name);
          if (samples.length > 0) {
            sampleBuckets.get(slot.slot_key)?.push(...samples);
          }
        });

        segments.forEach((segment) => {
          const match = matchSlotForSegment(segment, systemSlots);
          if (!match?.slot) return;
          if (getSlotLearningMode(match.slot) !== 'content_summarize') return;
          sampleBuckets.get(match.slot.slot_key)?.push({
            sample_title: segment.title,
            raw_content: segment.content,
            source_filename: file.name,
            score: match.score
          });
        });

        processed += 1;
        setProgress({ percent: Math.round((processed / uploadedFiles.length) * 100), text: `已完成 ${processed}/${uploadedFiles.length} 份文件` });
      }

      const matchedSlots = systemSlots
        .map((slot) => ({ slot, samples: (sampleBuckets.get(slot.slot_key) || []).sort((a, b) => (b.score || 0) - (a.score || 0)) }))
        .filter((item) => item.samples.length > 0);

      const learned = [];
      for (let index = 0; index < matchedSlots.length; index += 1) {
        const { slot, samples } = matchedSlots[index];
        setProgress({
          percent: 90 + Math.round(((index + 1) / matchedSlots.length) * 10),
          text: `正在归纳 ${slot.slot_name}（${index + 1}/${matchedSlots.length}）`
        });

        let assetDraft = buildLearningDraftFromSamples(slot, samples);
        const learningMode = getSlotLearningMode(slot);
        if (learningMode === 'content_summarize') {
          try {
            const aiSummary = await summarizeSlotSamplesWithAI(slot, samples);
            if (aiSummary?.trim()) {
              assetDraft = {
                ...assetDraft,
                standard_content: aiSummary.trim(),
                content_source: 'sample_derived'
              };
            }
          } catch (error) {
            console.warn(`AI 归纳 ${slot.slot_name} 失败，回退到本地规则:`, error);
          }
        }

        learned.push({
          slot,
          samples: samples.map((sample, sampleIndex) => ({
            ...sample,
            sample_id: createSampleId(slot.slot_key, sample, sampleIndex)
          })),
          selectedSampleIds: samples.slice(0, Math.min(samples.length, 2)).map((sample, sampleIndex) => createSampleId(slot.slot_key, sample, sampleIndex)),
          assetDraft: {
            ...assetDraft,
            asset_binding_type: null,
            asset_binding_value: null
          },
          confidence: getConfidence(slot, samples)
        });
      }

      const summary = {
        totalLearned: learned.length,
        standardContentSlots: learned.filter((item) => item.slot.slot_type === 'standard_content').length,
        fieldSlots: learned.filter((item) => item.slot.slot_type === 'field').length
      };

      setLearningResult({ learnedSlots: learned, summary });
      setProgress({ percent: 100, text: '整理完成，请先校对后确认使用' });
      message.success(`已完成整理，识别到 ${learned.length} 个可复用内容项`);
    } catch (error) {
      console.error('自动学习失败:', error);
      message.error(`学习失败: ${error.message}`);
      setProgress({ percent: 0, text: '学习失败，请重试' });
    } finally {
      setRunning(false);
    }
  };

  const confirmLearning = async () => {
    if (!user || !selectedCompanyId || !learningResult?.learnedSlots?.length) {
      message.warning('当前没有可确认的学习结果');
      return;
    }

    setConfirming(true);
    try {
      const existingSlotsRes = await supabase
        .from('template_slots')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_profile_id', selectedCompanyId)
        .eq('template_name', templateName);
      if (existingSlotsRes.error) throw existingSlotsRes.error;

      let slotRows = existingSlotsRes.data || [];
      const slotMapByKey = new Map(slotRows.map((slot) => [slot.slot_key, slot]));

      const missingSlots = DEFAULT_TEMPLATE_SLOTS
        .filter((slot) => !slotMapByKey.has(slot.slot_key))
        .map((slot) => ({
          ...slot,
          user_id: user.id,
          company_profile_id: selectedCompanyId
        }));

      if (missingSlots.length > 0) {
        const insertRes = await supabase.from('template_slots').insert(missingSlots).select('*');
        if (insertRes.error) throw insertRes.error;
        slotRows = [...slotRows, ...(insertRes.data || [])];
        slotRows.forEach((slot) => slotMapByKey.set(slot.slot_key, slot));
      }

      const samplePayload = [];
      const assetPayload = [];

      learningResult.learnedSlots.forEach((item) => {
        const persistedSlot = slotMapByKey.get(item.slot.slot_key);
        if (!persistedSlot) return;

        item.samples.forEach((sample) => {
          samplePayload.push({
            user_id: user.id,
            company_profile_id: selectedCompanyId,
            slot_id: persistedSlot.id,
            source_filename: sample.source_filename,
            sample_title: sample.sample_title,
            raw_content: sample.raw_content,
            normalized_content: sample.raw_content,
            is_selected: item.selectedSampleIds?.includes(sample.sample_id) || false
          });
        });

        assetPayload.push({
          user_id: user.id,
          company_profile_id: selectedCompanyId,
          slot_id: persistedSlot.id,
          standard_content: item.assetDraft.standard_content || null,
          content_source: item.assetDraft.content_source || 'sample_derived',
          asset_binding_type: null,
          asset_binding_value: null,
          enabled: true
        });
      });

      if (samplePayload.length > 0) {
        const { error: sampleDeleteError } = await supabase
          .from('template_slot_samples')
          .delete()
          .eq('user_id', user.id)
          .eq('company_profile_id', selectedCompanyId)
          .in('slot_id', learningResult.learnedSlots.map((item) => slotMapByKey.get(item.slot.slot_key)?.id).filter(Boolean));
        if (sampleDeleteError) throw sampleDeleteError;

        const { error: sampleInsertError } = await supabase.from('template_slot_samples').insert(samplePayload);
        if (sampleInsertError) throw sampleInsertError;
      }

      for (const asset of assetPayload) {
        const { error } = await supabase
          .from('template_slot_assets')
          .upsert(asset, { onConflict: 'user_id,company_profile_id,slot_id' });
        if (error) throw error;
      }

      await Promise.all([loadExistingSlots(), loadSavedLearningRecords()]);
      message.success('整理结果已确认并投入使用');
    } catch (error) {
      console.error('确认学习结果失败:', error);
      message.error(`确认失败: ${error.message}`);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="flex items-start gap-3">
          <BookOpen size={24} className="text-purple-600 mt-1" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">历史标书整理</h1>
            <p className="text-gray-600 mt-1">上传几份历史投标文件，系统会自动整理出以后可直接复用的固定字段和正文内容。</p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <Card loading={loading} className="border border-gray-200">
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr_auto] gap-4 items-end">
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">适用公司</div>
                <Select
                  value={selectedCompanyId}
                  options={companyOptions}
                  placeholder="先选择投标主体"
                  className="w-full"
                  onChange={setSelectedCompanyId}
                />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">历史投标文件</div>
                <Button icon={<FileUp size={16} />} disabled={!selectedCompanyId} onClick={() => fileInputRef.current?.click()} className="w-full justify-start">
                  {uploadedFiles.length ? `已选择 ${uploadedFiles.length} 份文件，点击重新上传` : '上传 3-5 份历史投标文件'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={(e) => handleFilesSelect(Array.from(e.target.files || []))}
                />
              </div>
              <Button type="primary" loading={running} disabled={!selectedCompanyId} onClick={runLearning} className="min-w-[160px]">
                开始整理
              </Button>
            </div>

            <Alert
              type="info"
              showIcon
              message={`先选择投标主体，再上传历史文件。系统会整理出这家公司的固定字段和推荐正文；每个内容项最多参考 ${learningConfig.maxSamplesPerSlot} 份样本。`}
              description={learningConfig.aiEnabled ? '系统已启用 AI 归纳。请在确认前勾选最准确的参考样本并修正文案，后续系统会优先参考这些已确认样本。附件不在这里复用，仍由用户在生成标书时自行选择。' : '当前未启用 AI 归纳，会先使用规则版摘要。建议先人工校对，再确认投入使用。附件不在这里复用。'}
            />

            <div>
              <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
                <span>{progress.text}</span>
                <span>{progress.percent}%</span>
              </div>
              <Progress percent={progress.percent} status={running ? 'active' : 'normal'} />
            </div>

            {uploadedFiles.length > 0 && (
              <div className="text-sm text-gray-500 flex flex-wrap gap-2">
                {uploadedFiles.map((file) => <Tag key={`${file.name}-${file.size}`}>{file.name}</Tag>)}
              </div>
            )}
          </div>
        </Card>

        {!learningResult ? (
          <Card className="border border-gray-200">
            {running ? (
              <div className="py-12 flex flex-col items-center text-gray-500">
                <Spin className="mb-4" />
                <p>系统正在自动学习历史文件，请稍候。</p>
              </div>
            ) : (
              <Empty description="上传历史投标文件并点击“开始整理”后，这里会展示系统建议和人工校对入口。" />
            )}
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {summaryCards.map((item) => (
                <Card key={item.label} className="border border-gray-200">
                  <div className="text-sm text-gray-500">{item.label}</div>
                  <div className="text-3xl font-bold text-gray-900 mt-2">{item.value}</div>
                </Card>
              ))}
            </div>

            <Card className="border border-gray-200">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
                <div>
                  <Typography.Title level={4} style={{ marginBottom: 0 }}>本次整理结果</Typography.Title>
                  <Typography.Text type="secondary">系统已先给出建议，请逐项校对内容和参考样本，确认后再正式投入使用。</Typography.Text>
                </div>
                <Button type="primary" icon={<CheckCircle2 size={16} />} loading={confirming} onClick={confirmLearning}>
                  确认并投入使用
                </Button>
              </div>

              <List
                dataSource={learnedSlots}
                renderItem={(item) => (
                  <List.Item>
                    <Card size="small" className="w-full border border-gray-100">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-medium text-gray-800">{item.slot.slot_name}</div>
                            <div className="text-xs text-gray-500 mt-1">{item.slot.chapter_path}</div>
                          </div>
                          <Space wrap>
                            <Tag color="purple">{getUserFacingSlotTypeLabel(item.slot.slot_type)}</Tag>
                            <Tag color={item.confidence === 'high' ? 'green' : item.confidence === 'medium' ? 'gold' : 'default'}>
                              置信度 {item.confidence}
                            </Tag>
                            <Tag>{item.samples.length} 份参考</Tag>
                            <Tag color="blue">已选 {item.selectedSampleIds?.length || 0}</Tag>
                            <Button size="small" icon={<PencilLine size={14} />} onClick={() => openEditor('preview', item)}>
                              校对
                            </Button>
                          </Space>
                        </div>

                        {item.assetDraft.standard_content && (
                          <div>
                            <div className="text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
                              <Sparkles size={14} className="text-purple-500" /> 推荐正文
                            </div>
                            <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100">
                              {item.assetDraft.standard_content.slice(0, 320)}
                              {item.assetDraft.standard_content.length > 320 ? '...' : ''}
                            </div>
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          参考来源：{item.samples.slice(0, 3).map((sample) => sample.source_filename).join('，')}
                          {item.samples.length > 3 ? ' 等' : ''}
                        </div>
                      </div>
                    </Card>
                  </List.Item>
                )}
              />
            </Card>
          </>
        )}

        <Card className="border border-gray-200" loading={savedLoading}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Typography.Title level={4} style={{ marginBottom: 0 }}>已生效内容管理</Typography.Title>
                <Typography.Text type="secondary">这里是已经投入使用的固定字段和正文内容。你可以随时修正内容，并重新指定最准确的参考样本。</Typography.Text>
              </div>
              <Space wrap>
                <Tag color="green">启用项 {savedSummary.enabledSlots}</Tag>
                <Tag color="blue">已生效内容 {savedSummary.managedSlots}</Tag>
                <Tag>已选参考 {savedSummary.selectedSamples}</Tag>
              </Space>
            </div>

            {!savedLearningRecords.some((item) => item.asset?.standard_content || item.samples.length > 0) ? (
              <Empty description="还没有已生效内容。先完成一次整理并确认使用。" />
            ) : (
              <List
                dataSource={savedLearningRecords.filter((item) => item.asset?.standard_content || item.samples.length > 0)}
                renderItem={(item) => (
                  <List.Item>
                    <Card size="small" className="w-full border border-gray-100">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-medium text-gray-800">{item.slot.slot_name}</div>
                            <div className="text-xs text-gray-500 mt-1">{item.slot.chapter_path}</div>
                          </div>
                          <Space wrap>
                            <Tag color="purple">{getUserFacingSlotTypeLabel(item.slot.slot_type)}</Tag>
                            <Tag color={item.asset?.enabled ? 'green' : 'default'}>{item.asset?.enabled ? '已启用' : '已停用'}</Tag>
                            <Tag>{item.samples.length} 份参考</Tag>
                            <Tag color="blue">已选 {item.samples.filter((sample) => sample.is_selected).length}</Tag>
                            <Button
                              size="small"
                              icon={<PencilLine size={14} />}
                              loading={savingManagedSlot === item.slot.id}
                              onClick={() => openEditor('saved', item)}
                            >
                              调整
                            </Button>
                          </Space>
                        </div>

                        {item.asset?.standard_content && (
                          <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100">
                            {item.asset.standard_content.slice(0, 320)}
                            {item.asset.standard_content.length > 320 ? '...' : ''}
                          </div>
                        )}

                        <div className="text-xs text-gray-500">
                          最近参考来源：{item.samples.slice(0, 3).map((sample) => sample.source_filename).join('，') || '暂无参考'}
                          {item.samples.length > 3 ? ' 等' : ''}
                        </div>
                      </div>
                    </Card>
                  </List.Item>
                )}
              />
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={editorState.open}
        title={editorState.mode === 'preview' ? '校对本次整理结果' : '调整已生效内容'}
        onCancel={closeEditor}
        onOk={handleEditorSave}
        okText={editorState.mode === 'preview' ? '保存本次校对' : '保存调整'}
        confirmLoading={editorState.mode === 'saved' && savingManagedSlot === editorState.item?.slot?.id}
        width={820}
      >
        {editorState.item && (
          <div className="space-y-5">
            <div>
              <div className="font-medium text-gray-900">{editorState.item.slot.slot_name}</div>
              <div className="text-xs text-gray-500 mt-1">{editorState.item.slot.chapter_path}</div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">正文内容</div>
              <TextArea
                value={editorState.draft.standard_content}
                onChange={(e) => updateEditorDraft({ standard_content: e.target.value })}
                rows={8}
                placeholder="把这项内容改成你希望系统长期复用的标准写法"
              />
            </div>

            {editorState.mode === 'saved' && (
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3 bg-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-800">启用当前学习结果</div>
                  <div className="text-xs text-gray-500">关闭后，这项已生效内容不会参与新建标书的自动生成。</div>
                </div>
                <Switch checked={editorState.draft.enabled} onChange={(checked) => updateEditorDraft({ enabled: checked })} />
              </div>
            )}

            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">最准确的参考样本</div>
              <div className="text-xs text-gray-500 mb-2">勾选越准确，系统后续自动匹配时越会优先参考这些内容。</div>
              {editorState.item.samples?.length ? (
                <Checkbox.Group
                  value={editorState.draft.selectedSampleIds}
                  onChange={(values) => updateEditorDraft({ selectedSampleIds: values })}
                  className="w-full"
                >
                  <div className="space-y-3 max-h-[280px] overflow-auto pr-2">
                    {editorState.item.samples.map((sample, index) => {
                      const sampleId = sample.sample_id || createSampleId(editorState.item.slot.slot_key, sample, index);
                      return (
                        <label key={sampleId} className="block rounded-lg border border-gray-200 p-3 bg-white cursor-pointer">
                          <div className="flex items-start gap-3">
                            <Checkbox value={sampleId} />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm text-gray-800">{sample.sample_title || '未命名片段'}</div>
                              <div className="text-xs text-gray-500 mt-1">来源文件：{sample.source_filename || '未知文件'}</div>
                              <div className="text-xs text-gray-600 whitespace-pre-wrap mt-2 bg-gray-50 rounded p-2 border border-gray-100">
                                {(sample.raw_content || '').slice(0, 220)}
                                {(sample.raw_content || '').length > 220 ? '...' : ''}
                              </div>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </Checkbox.Group>
              ) : (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前内容项暂无参考样本" />
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function getConfidence(slot, samples) {
  if (slot.slot_type === 'field') return samples.length >= 2 ? 'high' : 'medium';
  if (slot.slot_type === 'fixed_asset') return samples.length >= 1 ? 'medium' : 'low';
  if (samples.length >= 3) return 'high';
  if (samples.length >= 1) return 'medium';
  return 'low';
}
