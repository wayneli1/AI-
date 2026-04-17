import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Alert, Button, Input, message, Modal, Table, Tag, Empty, Spin, TreeSelect, Select, Popconfirm } from 'antd';
import {
  UploadCloud, ArrowLeft, Download, FileText, Cpu, Database, Edit3, Eye, Trash2, Package, ShieldCheck, TriangleAlert
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { useSearchParams } from 'react-router-dom';
import { renderAsync } from 'docx-preview';

import { fillDocumentBlanks, reviewFilledBlanksWithAI } from '../utils/difyWorkflow';
import { extractTextFromDocument } from '../utils/documentParser';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  extractDocumentXml,
  generateFilledDocx,
  filterIgnoredBlanks
} from '../utils/wordBlankFiller';
import { buildTemplateLearningPrompt, matchSlotForBlank } from '../utils/templateLearning';
import { parseBidDocx } from '../utils/backendApi';
import { 
  buildCellMapping, 
  fillPersonDataToRow, 
  getBlankCellsMappingInfo,
  getMappingStats 
} from '../utils/tableFieldMapper';
import { 
  callSmartFill,
  fillsToRowData
} from '../utils/intelligentMapping';

const DESKTOP_BREAKPOINT = 1280;
const MIN_PREVIEW_PANEL_WIDTH = 360;
const MAX_PREVIEW_PANEL_WIDTH = 960;
const MIN_EDITOR_PANEL_WIDTH = 480;

const normalizeAuditText = (value = '') => String(value || '').replace(/\s+/g, '').trim().toLowerCase();

const deriveAuditFieldHint = (blank) => {
  const rawHint = String(blank?.fieldHint || '').trim();
  const localContext = String(blank?.markedContext || blank?.localContext || blank?.context || '');
  const marker = '【🎯】';
  const markerIndex = localContext.indexOf(marker);
  const before = markerIndex >= 0 ? localContext.slice(0, markerIndex) : localContext;
  const after = markerIndex >= 0 ? localContext.slice(markerIndex + marker.length) : '';

  // 1. 冒号就近匹配
  const lastColonMatch = before.match(/([^：:，。,；;（）()\n]{1,24})[：:]\s*$/);
  if (lastColonMatch?.[1]) {
    return lastColonMatch[1].replace(/[_－\-\s]+/g, '').trim();
  }

  // 🐛 核心修复：处理特殊倒装句式（无冒号，且真实含义向后倒装）
  const cleanBefore = before.replace(/[_－\-\s]+/g, '');
  const cleanAfter = after.replace(/[_－\-\s]+/g, '');
  
  // 句式 1："系 [公司名称] 的法定代表人"
  if (/(?:系|是|为)$/.test(cleanBefore) && /^的?(?:法定代表人|法人代表|法人|委托代理人|授权代表)/.test(cleanAfter)) {
    return '投标人名称'; 
  }
  // 句式 2："( [公司名称] ) 法定代表人"
  if (cleanBefore.endsWith('（') || cleanBefore.endsWith('(')) {
    if (/^(?:法定代表人|法人代表|法人|委托代理人|授权代表)/.test(cleanAfter)) {
      return '投标人名称'; 
    }
  }

  // 2. 关键词模糊距离匹配
  const nearestBefore = [...before.matchAll(/(单位名称|投标人名称|供应商名称|报价人单位名称|法定代表人姓名|法定代表人|被授权人姓名|被授权人|委托代理人|授权代表|姓名|性别|年龄|职务|身份证号码|身份证号|联系电话|电子邮箱|开户地址|联系地址|注册地址|详细通讯地址|地址|邮编|开户行|银行账号|统一社会信用代码|项目名称|项目|报价|版本号|型号)/g)];
  
  // 稍微放宽向后匹配的条件，允许带一点点介词或符号
  const nearestAfter = after.match(/^.{0,3}?(单位名称|投标人名称|供应商名称|报价人单位名称|法定代表人姓名|法定代表人|被授权人姓名|被授权人|委托代理人|授权代表|姓名|性别|年龄|职务|身份证号码|身份证号|联系电话|电子邮箱|开户地址|联系地址|注册地址|详细通讯地址|地址|邮编|开户行|银行账号|统一社会信用代码|项目名称|项目|报价|版本号|型号)/);

  const candidate = nearestAfter?.[1] || nearestBefore.at(-1)?.[1] || rawHint;
  if (/开户地址|联系地址|注册地址|详细通讯地址/.test(candidate)) return '地址';
  if (/报价人单位名称|投标人名称|供应商名称|单位名称|公司名称/.test(candidate)) return '投标人名称';
  if (/法定代表人姓名|法定代表人/.test(candidate)) return '法定代表人信息';
  if (/被授权人姓名|被授权人|委托代理人|授权代表/.test(candidate)) return '被授权人信息';
  if (/身份证号码|身份证号/.test(candidate)) return '身份证号码';
  if (/联系电话/.test(candidate)) return '电话';
  if (/电子邮箱/.test(candidate)) return '邮箱';
  return candidate;
};

const getRuleSuggestion = (blank, company) => {
  if (!blank || !company) return '';
  const hint = deriveAuditFieldHint(blank);
  if (/投标人名称|单位名称|公司名称/.test(hint)) return company.company_name || '';
  if (/法定代表人信息|法定代表人姓名|姓名/.test(hint)) return company.legal_rep_name || '';
  if (/被授权人信息|委托代理人|授权代表/.test(hint)) return company.legal_rep_name || '';
  if (/性别/.test(hint)) return company.gender || '';
  if (/职务/.test(hint)) return company.position || '';
  if (/身份证号码|身份证号/.test(hint)) return company.id_number || '';
  if (/电话|联系电话|联系方式/.test(hint)) return company.phone || '';
  if (/邮箱|电子邮箱/.test(hint)) return company.email || '';
  if (/地址|联系地址|通讯地址/.test(hint)) return company.address || '';
  if (/统一社会信用代码|信用代码/.test(hint)) return company.uscc || '';
  return '';
};

const validateFilledBlanksWithRules = (blanks = [], values = {}, company = null) => {
  const results = {};

  blanks.forEach((blank) => {
    const value = String(values[blank.id] || '').trim();
    if (!value) return;

    const hint = deriveAuditFieldHint(blank);
    const normalizedValue = normalizeAuditText(value);
    const normalizedCompanyName = normalizeAuditText(company?.company_name || '');
    const result = {
      blankId: blank.id,
      fieldHint: hint || '未命名字段',
      status: 'pass',
      source: 'rule',
      reason: '规则校验通过',
      suggestedValue: ''
    };

    const companyLikeInWrongField = normalizedCompanyName && normalizedValue === normalizedCompanyName && !/投标人名称|单位名称|公司名称/.test(hint);
    if (companyLikeInWrongField) {
      result.status = 'error';
      result.reason = `${hint || '该字段'} 不应填写为公司名称`;
      result.suggestedValue = getRuleSuggestion(blank, company);
      results[blank.id] = result;
      return;
    }

    if (/性别/.test(hint)) {
      if (!['男', '女'].includes(value)) {
        result.status = 'error';
        result.reason = '性别字段只能填写“男”或“女”';
        result.suggestedValue = company?.gender || '';
      }
    } else if (/年龄/.test(hint)) {
      if (!/^\d{1,3}$/.test(value)) {
        result.status = 'warning';
        result.reason = '年龄字段建议填写纯数字';
      }
    } else if (/邮箱|电子邮箱/.test(hint)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        result.status = 'error';
        result.reason = '邮箱格式不正确';
        result.suggestedValue = company?.email || '';
      }
    } else if (/身份证号码|身份证号/.test(hint)) {
      if (!/^(\d{17}[\dXx]|\d{15})$/.test(value)) {
        result.status = 'error';
        result.reason = '身份证号码格式不正确';
        result.suggestedValue = company?.id_number || '';
      }
    } else if (/电话|联系电话|联系方式/.test(hint)) {
      if (!/^[\d\-+()\s]{7,20}$/.test(value)) {
        result.status = 'warning';
        result.reason = '联系电话格式看起来不合理';
        result.suggestedValue = company?.phone || '';
      }
    } else if (/统一社会信用代码|信用代码/.test(hint)) {
      if (!/^[0-9A-Z]{18}$/.test(value.toUpperCase())) {
        result.status = 'error';
        result.reason = '统一社会信用代码格式不正确';
        result.suggestedValue = company?.uscc || '';
      }
    } else if (/投标人名称|单位名称|公司名称/.test(hint)) {
      if (normalizedCompanyName && normalizedValue !== normalizedCompanyName) {
        result.status = 'warning';
        result.reason = '单位名称与当前投标主体档案不一致';
        result.suggestedValue = company?.company_name || '';
      }
    } else if (/法定代表人信息|法定代表人姓名|姓名/.test(hint)) {
      const normalizedLegalRep = normalizeAuditText(company?.legal_rep_name || '');
      if (normalizedLegalRep && normalizedValue !== normalizedLegalRep) {
        result.status = 'warning';
        result.reason = '姓名与当前投标主体档案中的法定代表人不一致';
        result.suggestedValue = company?.legal_rep_name || '';
      }
    }

    results[blank.id] = result;
  });

  return results;
};

const mergeAuditResults = (blanks = [], values = {}, ruleResults = {}, aiResults = {}) => {
  return blanks
    .filter((blank) => values[blank.id])
    .map((blank) => {
      const ruleResult = ruleResults[blank.id] || null;
      const aiResult = aiResults[blank.id] || null;
      let status = 'pass';
      if (ruleResult?.status === 'error' || aiResult?.status === 'error') status = 'error';
      else if (ruleResult?.status === 'warning' || aiResult?.status === 'warning') status = 'warning';

      return {
        blankId: blank.id,
        fieldHint: deriveAuditFieldHint(blank) || blank.fieldHint || '未命名字段',
        localContext: blank.localContext || blank.context || '',
        value: values[blank.id] || '',
        status,
        ruleResult,
        aiResult,
        suggestedValue: aiResult?.suggestedValue || ruleResult?.suggestedValue || ''
      };
    });
};

const summarizeAuditResults = (results = []) => ({
  total: results.length,
  pass: results.filter((item) => item.status === 'pass').length,
  warning: results.filter((item) => item.status === 'warning').length,
  error: results.filter((item) => item.status === 'error').length,
  suggested: results.filter((item) => item.suggestedValue).length
});

export default function CreateBid() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const urlProjectId = searchParams.get('id');

  const [step, setStep] = useState('upload');
  const fileInputRef = useRef(null);

  const [originalFile, setOriginalFile] = useState(null);
  const [originalZip, setOriginalZip] = useState(null);
  const [originalXml, setOriginalXml] = useState('');
  const [scannedBlanks, setScannedBlanks] = useState([]);
  const [manualEdits, setManualEdits] = useState({});

  const [targetCompany, setTargetCompany] = useState('');
  const [isCompanyModalVisible, setIsCompanyModalVisible] = useState(false);
  const [companyList, setCompanyList] = useState([]);
  const [fetchingCompanies, setFetchingCompanies] = useState(false);
  const [companyProfiles, setCompanyProfiles] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [tempSelectedCompany, setTempSelectedCompany] = useState(null);
  const [tempKbName, setTempKbName] = useState('');

  const [tenderContext, setTenderContext] = useState(''); 
  const [isContextModalVisible, setIsContextModalVisible] = useState(false);
  const tenderFileInputRef = useRef(null);
  const [isExtractingTender, setIsExtractingTender] = useState(false);

  // 产品资产库相关状态
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [selectedServiceManualIds, setSelectedServiceManualIds] = useState([]);
  const [productTreeData, setProductTreeData] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productCompanyName, setProductCompanyName] = useState('');

  const [templateSlots, setTemplateSlots] = useState([]);
  const [templateSlotAssets, setTemplateSlotAssets] = useState([]);
  const [templateSlotSamples, setTemplateSlotSamples] = useState([]);

  const [isScanning, setIsScanning] = useState(false);
  const [isFilling, setIsFilling] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [imageUrlMap, setImageUrlMap] = useState({}); // 保存占位符到URL的映射
  const [auditResults, setAuditResults] = useState([]);

  // 后端解析结果 - 三桶数据
  const [normalBlanks, setNormalBlanks] = useState([]);
  const [dynamicTables, setDynamicTables] = useState([]);
  const [manualTables, setManualTables] = useState([]);
  const [tableStructures, setTableStructures] = useState([]);
  const [parseMeta, setParseMeta] = useState(null);
  const [dynamicTableEdits, setDynamicTableEdits] = useState({});
  const [isTableModalVisible, setIsTableModalVisible] = useState(false);
  const [dynamicTableImages, setDynamicTableImages] = useState({});
  const [personnelProfiles, setPersonnelProfiles] = useState([]);
  const [selectedPersonRoles, setSelectedPersonRoles] = useState({}); // { [tableId]: { personName: positionName } }
  const [tempPersonSelection, setTempPersonSelection] = useState({}); // { [tableId]: personName }
  const [tableCellMappings, setTableCellMappings] = useState({}); // { [tableId]: cellMap } 存储每个表格的单元格映射

  // 标准化产品名称：处理中英文混合的空格问题
  const normalizeProductName = useCallback((name) => {
    if (!name || typeof name !== 'string') return '';
    // 1. 统一处理连字符前后的空格
    let normalized = name.replace(/\s*-\s*/g, '-');
    // 2. 移除所有空格
    normalized = normalized.replace(/\s+/g, '');
    // 3. 在英文单词和中文之间添加空格
    normalized = normalized.replace(/([a-zA-Z])([\u4e00-\u9fa5])/g, '$1 $2');
    normalized = normalized.replace(/([\u4e00-\u9fa5])([a-zA-Z])/g, '$1 $2');
    // 4. 在英文单词和数字之间添加空格
    normalized = normalized.replace(/([a-zA-Z])(\d)/g, '$1 $2');
    normalized = normalized.replace(/(\d)([a-zA-Z])/g, '$1 $2');
    // 5. 移除多余空格，保留单词间单个空格
    return normalized.replace(/\s+/g, ' ').trim();
  }, []);

  // 模糊匹配占位符：标准化后进行比较
  const fuzzyMatchPlaceholder = useCallback((value, placeholder) => {
    if (!value || !placeholder) return false;
    const normalizedValue = normalizeProductName(value);
    const normalizedPlaceholder = normalizeProductName(placeholder);
    return normalizedValue.includes(normalizedPlaceholder);
  }, [normalizeProductName]);

  // 构建占位符正则表达式
  const buildPlaceholderRegex = useCallback((placeholder) => {
    // 转义特殊字符
    const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // 将空格替换为 \\s*（允许0个或多个空格）
    const pattern = escaped.replace(/\\s+/g, '\\\\s*');
    return new RegExp(pattern, 'g');
  }, []);

  const [highlightBlankId, setHighlightBlankId] = useState(null);
  const previewRef = useRef(null);
  const previewScrollRef = useRef(null);
  const previewResizeStateRef = useRef({ startX: 0, startWidth: 0 });
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => window.innerWidth >= DESKTOP_BREAKPOINT);
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  const [previewPanelWidth, setPreviewPanelWidth] = useState(() => {
    const viewportWidth = window.innerWidth;
    const maxWidth = Math.min(MAX_PREVIEW_PANEL_WIDTH, viewportWidth - MIN_EDITOR_PANEL_WIDTH);
    const defaultWidth = Math.round(viewportWidth * 0.48);
    return Math.min(Math.max(defaultWidth, MIN_PREVIEW_PANEL_WIDTH), maxWidth);
  });

  const clampPreviewPanelWidth = useCallback((nextWidth, viewportWidth = window.innerWidth) => {
    const maxWidth = Math.max(
      MIN_PREVIEW_PANEL_WIDTH,
      Math.min(MAX_PREVIEW_PANEL_WIDTH, viewportWidth - MIN_EDITOR_PANEL_WIDTH)
    );
    return Math.min(Math.max(nextWidth, MIN_PREVIEW_PANEL_WIDTH), maxWidth);
  }, []);

  useEffect(() => {
    if (urlProjectId && user) {
      loadExistingProject(urlProjectId);
    }
  }, [urlProjectId, user]);

  useEffect(() => {
    if (!user) return;
    const fetchPersonnel = async () => {
      try {
        const { data } = await supabase.from('personnel_profiles').select('*').eq('user_id', user.id);
        if (data) setPersonnelProfiles(data);
      } catch (err) {
        console.error('拉取人员库失败:', err);
      }
    };
    fetchPersonnel();
  }, [user]);

  useEffect(() => {
    const handleWindowResize = () => {
      const viewportWidth = window.innerWidth;
      setIsDesktopViewport(viewportWidth >= DESKTOP_BREAKPOINT);
      setPreviewPanelWidth((currentWidth) => clampPreviewPanelWidth(currentWidth, viewportWidth));
    };

    window.addEventListener('resize', handleWindowResize);
    return () => window.removeEventListener('resize', handleWindowResize);
  }, [clampPreviewPanelWidth]);

  useEffect(() => {
    if (!isResizingPreview) return undefined;

    const handleMouseMove = (event) => {
      const { startX, startWidth } = previewResizeStateRef.current;
      const deltaX = event.clientX - startX;
      setPreviewPanelWidth(clampPreviewPanelWidth(startWidth + deltaX));
    };

    const stopResize = () => {
      setIsResizingPreview(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopResize);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [clampPreviewPanelWidth, isResizingPreview]);

  useEffect(() => {
    const container = previewRef.current;
    if (!container) return undefined;

    if (!originalFile || (step !== 'scan' && step !== 'review')) {
      container.innerHTML = '';
      setPreviewError('');
      setIsRenderingPreview(false);
      return undefined;
    }

    let cancelled = false;

    const renderPreview = async () => {
      setIsRenderingPreview(true);
      setPreviewError('');

      try {
        const arrayBuffer = await originalFile.arrayBuffer();
        if (cancelled) return;

        container.innerHTML = '';
        await renderAsync(arrayBuffer, container, null, {
          className: 'docx-preview-render',
          ignoreWidth: false,
          ignoreHeight: true,
          inWrapper: true,
          breakPages: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true
        });
      } catch (error) {
        if (!cancelled) {
          console.error('原文预览渲染失败:', error);
          setPreviewError('原文预览渲染失败，请重新上传后重试');
        }
      } finally {
        if (!cancelled) {
          setIsRenderingPreview(false);
        }
      }
    };

    renderPreview();

    return () => {
      cancelled = true;
    };
  }, [originalFile, step]);

  const loadExistingProject = async (id) => {
    try {
      message.loading({ content: '正在从云端恢复标书数据...', key: 'load', duration: 0 });
      const { data, error } = await supabase.from('bidding_projects').select('*').eq('id', id).single();
      if (error) throw error;

      if (data) {
        setCurrentProjectId(data.id);
        
        if (data.file_url) {
          const response = await fetch(data.file_url);
          const blob = await response.blob();
          const file = new File([blob], `${data.project_name}.docx`, { 
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' 
          });
          setOriginalFile(file);
          
          const { xmlString, zip } = await extractDocumentXml(file);
          setOriginalXml(xmlString);
          setOriginalZip(zip);
        }

        if (data.framework_content) {
          const parsed = JSON.parse(data.framework_content);
          if (Array.isArray(parsed)) {
            const blanks = filterIgnoredBlanks(parsed);
            setScannedBlanks(blanks);
          } else {
            setScannedBlanks(parsed.normalBlanks || []);
            setDynamicTables(parsed.dynamicTables || []);
            setManualTables(parsed.manualTables || []);
            setTableStructures(parsed.tableStructures || []);
            setParseMeta(parsed.meta || null);
          }
        }

        if (data.analysis_report) {
          const edits = JSON.parse(data.analysis_report);
          if (edits && typeof edits === 'object' && !Array.isArray(edits) && edits.manualEdits !== undefined) {
            // 新格式：包含 manualEdits + dynamicTableEdits
            setManualEdits(edits.manualEdits || {});
            setDynamicTableEdits(edits.dynamicTableEdits || {});
            setDynamicTableImages(edits.dynamicTableImages || {});
            setSelectedPersonRoles(edits.selectedPersonRoles || {});
          } else {
            // 旧格式：只有 manualEdits
            setManualEdits(edits);
          }
          setAuditResults([]);
          setStep('review'); 
        } else if (data.framework_content) {
          setStep('scan'); 
        } else {
          setStep('upload');
        }

        message.success({ content: '项目恢复成功！', key: 'load' });
      }
    } catch (err) {
      console.error("加载历史项目失败:", err);
      message.error({ content: '恢复项目失败，可能文件已损坏', key: 'load' });
      setStep('upload');
    }
  };

  useEffect(() => {
    if (!currentProjectId || step === 'upload') return;

    const debounceTimer = setTimeout(async () => {
      try {
        await supabase.from('bidding_projects').update({ 
          analysis_report: JSON.stringify({
            manualEdits,
            dynamicTableEdits,
            dynamicTableImages,
            selectedPersonRoles,
          })
        }).eq('id', currentProjectId);
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    }, 1500);

    return () => clearTimeout(debounceTimer);
  }, [manualEdits, dynamicTableEdits, dynamicTableImages, selectedPersonRoles, currentProjectId, step]);

  // 监听 productCompanyName 变化，加载该公司下的产品数据
  useEffect(() => {
    const loadProductsForCompany = async () => {
      setSelectedProductIds([]);
      if (!productCompanyName.trim() || !user) {
        setProductTreeData([]);
        return;
      }

      try {
        setLoadingProducts(true);
        
        // 1. 先查询产品
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', user.id)
          .eq('company_name', productCompanyName.trim())
          .order('product_name')
          .order('version');
        
        if (productsError) throw productsError;
        
        // 2. 如果有产品，查询相关资产
        let assets = [];
        if (products && products.length > 0) {
          const productIds = products.map(p => p.id);
          
          const { data: assetsData, error: assetsError } = await supabase
            .from('product_assets')
            .select('id, product_id, asset_name, asset_type, file_url, text_content')
            .in('product_id', productIds);
          
          if (assetsError) throw assetsError;
          assets = assetsData || [];
        }
        
        const data = products || [];
        const rawData = data || [];
        
        // 1. 按产品ID分组资产
        const assetsByProductId = {};
        const serviceManualsByProductId = {};
        
        assets.forEach(asset => {
          const productId = asset.product_id;
          
          if (!assetsByProductId[productId]) {
            assetsByProductId[productId] = [];
          }
          assetsByProductId[productId].push(asset);
          
          // 识别服务手册
          if (asset.asset_type === 'document') {
            const isServiceManual = asset.asset_name && (
              asset.asset_name.includes('售后服务手册') || 
              asset.asset_name.includes('服务手册') ||
              (asset.file_url && (asset.file_url.includes('.doc') || asset.file_url.includes('.docx')))
            );
            
            if (isServiceManual) {
              if (!serviceManualsByProductId[productId]) {
                serviceManualsByProductId[productId] = [];
              }
              serviceManualsByProductId[productId].push(asset);
            }
          }
        });
        
        // 2. 构建产品树
        const productMap = {};
        
        rawData.forEach(product => {
          if (!productMap[product.product_name]) {
            productMap[product.product_name] = {
              title: product.product_name,
              value: `product-${product.product_name}`,
              key: `product-${product.product_name}`,
              children: []
            };
          }
          
          const productServiceManuals = serviceManualsByProductId[product.id] || [];
          const hasServiceManual = productServiceManuals.length > 0;
          
          const versionTitle = product.version ? product.version : '默认版本';
          const titleWithIcon = hasServiceManual 
            ? `${versionTitle} 📚`  // 添加服务手册图标
            : versionTitle;
          
          // 创建产品版本节点
          const productNode = {
            title: titleWithIcon,
            value: product.id,
            key: product.id,
            isProduct: true,
            hasServiceManual: hasServiceManual,
            children: []
          };
          
          // 添加服务手册子节点
          if (productServiceManuals.length > 0) {
            productServiceManuals.forEach((manual) => {
              const manualId = `manual-${product.id}-${manual.id}`;
              productNode.children.push({
                title: `${manual.asset_name} 📄`,
                value: manualId,
                key: manualId,
                isServiceManual: true,
                assetId: manual.id,
                assetName: manual.asset_name,
                fileUrl: manual.file_url,
                productId: product.id,
                productName: product.product_name,
                productVersion: product.version
              });
            });
          }
          
          productMap[product.product_name].children.push(productNode);
        });
        
        // 3. 处理单版本产品（无版本号）
        let treeData = Object.values(productMap).map(group => {
          if (group.children.length === 1) {
            const childProduct = rawData.find(p => p.id === group.children[0].value);
            if (childProduct && !childProduct.version) {
              // 单版本产品，直接显示为叶子节点
              const hasServiceManual = group.children[0].hasServiceManual || false;
              const titleWithIcon = hasServiceManual 
                ? `${group.title} 📚`  // 添加服务手册图标
                : group.title;
              
              const singleProductNode = {
                ...group,
                title: titleWithIcon,
                value: group.children[0].value,
                key: group.children[0].value,
                isLeaf: true,
                isProduct: true,
                hasServiceManual: hasServiceManual
              };
              
              // 如果有服务手册，添加为子节点
              if (group.children[0].children && group.children[0].children.length > 0) {
                singleProductNode.children = group.children[0].children;
                singleProductNode.isLeaf = false;
              }
              
              return singleProductNode;
            }
          }
          return group;
        });
        
        console.log('🔍 构建的产品树数据:', treeData);
        console.log('🔍 服务手册统计:', {
          总产品数: rawData.length,
          有服务手册的产品数: Object.keys(serviceManualsByProductId).length,
          总服务手册数: Object.values(serviceManualsByProductId).reduce((sum, arr) => sum + arr.length, 0)
        });
        setProductTreeData(treeData);
      } catch (error) {
        console.error('加载产品数据失败:', error);
        setProductTreeData([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    const debounceTimer = setTimeout(loadProductsForCompany, 500);
    return () => clearTimeout(debounceTimer);
  }, [productCompanyName, user]);

  useEffect(() => {
    const loadTemplateLearning = async () => {
      if (!user || !selectedCompany?.id) {
        setTemplateSlots([]);
        setTemplateSlotAssets([]);
        setTemplateSlotSamples([]);
        return;
      }

      try {
        const [slotRes, assetRes, sampleRes] = await Promise.all([
          supabase
            .from('template_slots')
            .select('*')
            .eq('user_id', user.id)
            .eq('company_profile_id', selectedCompany.id)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false }),
          supabase
            .from('template_slot_assets')
            .select('*')
            .eq('user_id', user.id)
            .eq('company_profile_id', selectedCompany.id)
            .eq('enabled', true),
          supabase
            .from('template_slot_samples')
            .select('*')
            .eq('user_id', user.id)
            .eq('company_profile_id', selectedCompany.id)
            .eq('is_selected', true)
        ]);

        if (!slotRes.error) setTemplateSlots(slotRes.data || []);
        if (!assetRes.error) setTemplateSlotAssets(assetRes.data || []);
        if (!sampleRes.error) setTemplateSlotSamples(sampleRes.data || []);
      } catch (error) {
        console.error('加载模板学习结果失败:', error);
      }
    };

    loadTemplateLearning();
  }, [selectedCompany, user]);

  const templateAssetsBySlotId = useMemo(() => {
    const mapping = {};
    templateSlotAssets.forEach((item) => {
      mapping[item.slot_id] = item;
    });
    return mapping;
  }, [templateSlotAssets]);

  const selectedTemplateSamplesBySlotId = useMemo(() => {
    const mapping = {};
    templateSlotSamples.forEach((item) => {
      if (!mapping[item.slot_id]) {
        mapping[item.slot_id] = [];
      }
      mapping[item.slot_id].push(item);
    });
    return mapping;
  }, [templateSlotSamples]);

  const matchedTemplateSlots = useMemo(() => {
    if (!scannedBlanks.length || !templateSlots.length) return {};
    const mapping = {};
    scannedBlanks.forEach((blank) => {
      const match = matchSlotForBlank(blank, templateSlots, templateAssetsBySlotId, selectedTemplateSamplesBySlotId);
      if (match) {
        mapping[blank.id] = match;
      }
    });
    return mapping;
  }, [scannedBlanks, selectedTemplateSamplesBySlotId, templateAssetsBySlotId, templateSlots]);

  const auditSummary = useMemo(() => summarizeAuditResults(auditResults), [auditResults]);
  const auditResultsById = useMemo(() => Object.fromEntries(auditResults.map((item) => [item.blankId, item])), [auditResults]);

  // 处理树选择变化
  const handleTreeSelectChange = useCallback((selectedValues) => {
    console.log('🔍 handleTreeSelectChange 收到选择值:', selectedValues);
    
    if (!Array.isArray(selectedValues)) {
      selectedValues = [];
    }
    
    // 分离产品ID和服务手册ID
    const productIds = [];
    const serviceManualIds = [];
    
    selectedValues.forEach(value => {
      if (typeof value === 'string') {
        if (value.startsWith('manual-')) {
          // 服务手册ID格式: manual-{productId}-{assetId}
          serviceManualIds.push(value);
        } else if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
          // UUID格式的产品ID
          productIds.push(value);
        }
      }
    });
    
    console.log('🔍 分离后的ID:', {
      产品ID: productIds,
      服务手册ID: serviceManualIds,
      产品数量: productIds.length,
      服务手册数量: serviceManualIds.length
    });
    
    setSelectedProductIds(productIds);
    setSelectedServiceManualIds(serviceManualIds);
  }, []);

  const getPreviewLocatorText = useCallback((blank) => {
    if (!blank) return '';

    if (blank.type === 'empty_cell') {
      return (blank._cellLabel || blank.context || '').replace('：[空白单元格]', '').trim();
    }

    if (blank.context && blank.matchText) {
      const contextWithoutBlank = blank.context.replace(blank.matchText, ' ').replace(/\s+/g, ' ').trim();
      if (contextWithoutBlank) return contextWithoutBlank;
    }

    if (blank.matchText && !/^\s+$/.test(blank.matchText) && blank.matchText !== '[空白单元格]') {
      return blank.matchText.trim();
    }

    return (blank.context || '').trim();
  }, []);

  const normalizePreviewText = useCallback((text) => {
    return (text || '').replace(/\s+/g, ' ').trim();
  }, []);

  const collectPreviewCandidates = useCallback((container) => {
    const selector = 'span, p, td, th, div, li';
    const rawCandidates = Array.from(container.querySelectorAll(selector))
      .map((node, index) => ({ node, text: normalizePreviewText(node.textContent), index }))
      .filter(({ text }) => text && text.length <= 400);

    return rawCandidates.filter(({ node, text }) => {
      const duplicateDescendant = Array.from(node.querySelectorAll(selector)).some((child) => {
        if (child === node) return false;
        return normalizePreviewText(child.textContent) === text;
      });
      return !duplicateDescendant;
    });
  }, [normalizePreviewText]);

  const getPreviewAnchorTokens = useCallback((blank) => {
    if (!blank) return [];

    const tokens = [];
    const locatorText = getPreviewLocatorText(blank);
    const cleanContext = normalizePreviewText(blank.context || '');
    const cleanMatchText = normalizePreviewText(blank.matchText || '');

    if (blank.type === 'empty_cell') {
      const label = normalizePreviewText((blank._cellLabel || '').replace('：[空白单元格]', ''));
      if (label) tokens.push(label);

      if (label.includes('（项：')) {
        const parts = label.replace('）', '').split('（项：').map((part) => normalizePreviewText(part));
        parts.forEach((part) => {
          if (part) tokens.push(part);
        });
      }
    }

    if (cleanMatchText && cleanMatchText !== '[空白单元格]' && !/^_+$/.test(cleanMatchText) && !/^-+$/.test(cleanMatchText)) {
      tokens.push(cleanMatchText);
    }

    if (locatorText) tokens.push(normalizePreviewText(locatorText));
    if (cleanContext) tokens.push(cleanContext);

    return [...new Set(tokens)].filter((token) => token && token.length >= 2);
  }, [getPreviewLocatorText, normalizePreviewText]);

  const getBlankDisplayName = useCallback((blank) => {
    if (!blank) return '';
    if (blank._cellLabel) return blank._cellLabel;
    const locatorText = getPreviewLocatorText(blank);
    if (locatorText) return locatorText;
    return normalizePreviewText(blank.context || blank.matchText || blank.id);
  }, [getPreviewLocatorText, normalizePreviewText]);

  const clearPreviewAnchors = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;

    container.querySelectorAll('[data-preview-blank-ids]').forEach((node) => {
      node.removeAttribute('data-preview-blank-ids');
      node.removeAttribute('data-preview-primary-blank-id');
      node.classList.remove('preview-blank-anchor', 'preview-blank-anchor-active');
      node.style.cursor = '';
      node.style.transition = '';
      node.style.borderRadius = '';
      node.style.backgroundColor = '';
      node.style.boxShadow = '';
      node.onclick = null;
      node.onkeydown = null;
    });
  }, []);

  const applyPreviewAnchorStyles = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;

    container.querySelectorAll('[data-preview-blank-ids]').forEach((node) => {
      const ids = (node.getAttribute('data-preview-blank-ids') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const relatedBlanks = ids
        .map((id) => scannedBlanks.find((blank) => blank.id === id))
        .filter(Boolean);

      const hasFilled = relatedBlanks.some((blank) => !!manualEdits[blank.id]);
      const hasPending = relatedBlanks.some((blank) => !manualEdits[blank.id]);
      const isActive = highlightBlankId && ids.includes(highlightBlankId);

      node.style.cursor = 'pointer';
      node.style.transition = 'background-color 0.2s ease, box-shadow 0.2s ease';
      node.style.borderRadius = '6px';

      if (isActive) {
        node.style.backgroundColor = 'rgba(224, 231, 255, 0.85)';
        node.style.boxShadow = 'inset 0 0 0 2px rgba(79, 70, 229, 0.85), 0 0 0 3px rgba(165, 180, 252, 0.45)';
        return;
      }

      if (hasFilled && !hasPending) {
        node.style.backgroundColor = 'rgba(220, 252, 231, 0.75)';
        node.style.boxShadow = 'inset 0 0 0 1px rgba(34, 197, 94, 0.55)';
        return;
      }

      node.style.backgroundColor = 'rgba(254, 240, 138, 0.55)';
      node.style.boxShadow = 'inset 0 0 0 1px rgba(245, 158, 11, 0.55)';
    });
  }, [highlightBlankId, manualEdits, scannedBlanks]);

  const resolvePreviewBlankId = useCallback((anchor) => {
    if (!anchor) return '';

    const blankIds = (anchor.getAttribute('data-preview-blank-ids') || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (blankIds.length === 0) return '';
    if (highlightBlankId && blankIds.includes(highlightBlankId)) return highlightBlankId;

    const primaryBlankId = anchor.getAttribute('data-preview-primary-blank-id');
    if (primaryBlankId && blankIds.includes(primaryBlankId)) return primaryBlankId;

    return blankIds.find((id) => scannedBlanks.some((blank) => blank.id === id)) || blankIds[0];
  }, [highlightBlankId, scannedBlanks]);

  const findPreviewAnchor = useCallback((blank) => {
    const container = previewRef.current;
    if (!container || !blank) return null;

     const exactAnchor = container.querySelector(`[data-preview-blank-ids~="${blank.id}"]`) ||
      Array.from(container.querySelectorAll('[data-preview-blank-ids]')).find((node) => {
        const ids = (node.getAttribute('data-preview-blank-ids') || '').split(',').map((item) => item.trim());
        return ids.includes(blank.id);
      });
    if (exactAnchor) return exactAnchor;

    const locatorText = getPreviewLocatorText(blank);
    if (!locatorText) return null;

    const candidates = Array.from(
      container.querySelectorAll('p, td, th, span, div, li')
    );

    return candidates.find((node) => {
      const text = node.textContent?.replace(/\s+/g, ' ').trim();
      return text && text.includes(locatorText) && text.length <= 300;
    }) || null;
  }, [getPreviewLocatorText]);

  const scrollToTable = useCallback((blankId) => {
    setHighlightBlankId(blankId);
    setTimeout(() => {
      const el = document.querySelector(`[data-row-key="${blankId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-400');
        const input = el.querySelector('input');
        if (input) input.focus({ preventScroll: true });
        setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400'), 2000);
      }
    }, 100);
  }, []);

  const decoratePreviewAnchors = useCallback(() => {
    const container = previewRef.current;
    if (!container) return;

    clearPreviewAnchors();
    if (scannedBlanks.length === 0) return;

    const candidates = collectPreviewCandidates(container);
    const assignedOccurrenceCounts = new Map();

    scannedBlanks.forEach((blank) => {
      const tokens = getPreviewAnchorTokens(blank);
      if (tokens.length === 0) return;

      const sortedTokens = [...tokens].sort((a, b) => b.length - a.length);
      const primaryToken = normalizePreviewText(sortedTokens[0]);
      const blankKey = normalizePreviewText(getBlankDisplayName(blank) || primaryToken);
      const blankOccurrence = assignedOccurrenceCounts.get(blankKey) || 0;

      const matchedCandidates = [];

      tokens.forEach((token, tokenIndex) => {
        candidates.forEach(({ node, text, index }) => {
          if (!text.includes(token)) return;

          matchedCandidates.push({
            node,
            text,
            index,
            token,
            score: token.length * 100 - text.length - tokenIndex * 10
          });
        });
      });

      const exactPrimaryCandidates = matchedCandidates
        .filter(({ text }) => text === primaryToken)
        .sort((a, b) => b.score - a.score || a.index - b.index);

      let bestNode = exactPrimaryCandidates[blankOccurrence]?.node || null;

      if (!bestNode) {
        const rankedCandidates = matchedCandidates.sort((a, b) => b.score - a.score || a.index - b.index);
        bestNode = rankedCandidates.find(({ node }) => !node.hasAttribute('data-preview-blank-ids'))?.node
          || rankedCandidates[0]?.node
          || null;
      }

      if (!bestNode) return;
      assignedOccurrenceCounts.set(blankKey, blankOccurrence + 1);

      const existingIds = (bestNode.getAttribute('data-preview-blank-ids') || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      if (!existingIds.includes(blank.id)) {
        existingIds.push(blank.id);
      }

      bestNode.setAttribute('data-preview-blank-ids', existingIds.join(','));
      if (!bestNode.getAttribute('data-preview-primary-blank-id')) {
        bestNode.setAttribute('data-preview-primary-blank-id', blank.id);
      }
      const titleText = existingIds
        .map((id) => scannedBlanks.find((item) => item.id === id))
        .filter(Boolean)
        .map((item) => getBlankDisplayName(item))
        .filter(Boolean)
        .join('\n');
      bestNode.setAttribute('title', titleText || getBlankDisplayName(blank));
      bestNode.setAttribute('tabindex', '0');
      bestNode.setAttribute('role', 'button');
      bestNode.classList.add('preview-blank-anchor');
      bestNode.style.cursor = 'pointer';
      bestNode.onclick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        const targetBlankId = resolvePreviewBlankId(bestNode);
        if (targetBlankId) {
          scrollToTable(targetBlankId);
        }
      };
      bestNode.onkeydown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        event.stopPropagation();
        const targetBlankId = resolvePreviewBlankId(bestNode);
        if (targetBlankId) {
          scrollToTable(targetBlankId);
        }
      };
    });
    applyPreviewAnchorStyles();
  }, [applyPreviewAnchorStyles, clearPreviewAnchors, collectPreviewCandidates, getBlankDisplayName, getPreviewAnchorTokens, normalizePreviewText, resolvePreviewBlankId, scannedBlanks, scrollToTable]);

  // 💡 【右侧表格】点击后：滚动【左侧原文】
  const scrollToBlank = useCallback((blankId) => {
    setHighlightBlankId(blankId);
    setTimeout(() => {
      const blank = scannedBlanks.find((item) => item.id === blankId);
      const el = findPreviewAnchor(blank);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-indigo-400', 'bg-indigo-50');
        setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400', 'bg-indigo-50'), 2000);
      }
    }, 100);
  }, [findPreviewAnchor, scannedBlanks]);

  const handlePreviewResizeStart = useCallback((event) => {
    if (!isDesktopViewport) return;

    previewResizeStateRef.current = {
      startX: event.clientX,
      startWidth: previewPanelWidth
    };
    setIsResizingPreview(true);
  }, [isDesktopViewport, previewPanelWidth]);

  useEffect(() => {
    if (!previewRef.current || isRenderingPreview) return;
    decoratePreviewAnchors();
  }, [decoratePreviewAnchors, isRenderingPreview]);

  useEffect(() => {
    applyPreviewAnchorStyles();
  }, [applyPreviewAnchorStyles]);

  const handleFileUpload = async (event) => {
    console.log('🔍 [handleFileUpload] 文件上传开始');
    const file = event.target.files[0];
    console.log('🔍 上传文件:', file.name, '大小:', file.size);
    if (!file || !user) return message.error('请先登录！');

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'docx') {
      return message.warning('当前仅支持 .docx 格式，请上传 Word 2007+ 文件');
    }

    setOriginalFile(file);
    setIsScanning(true);
    setAuditResults([]);

    try {
      message.loading({ content: '正在调用后端解析标书...', key: 'scan', duration: 0 });

      // 调用后端API解析
      console.log('🔵 [前端] 开始调用后端 parseBidDocx...');
      const parseResult = await parseBidDocx(file);
      console.log('🔵 [前端] 后端返回成功:', parseResult.success);
      console.log('🔵 [前端] normalBlanks:', parseResult.normalBlanks?.length);
      console.log('🔵 [前端] dynamicTables:', parseResult.dynamicTables?.length);
      console.log('🔵 [前端] manualTables:', parseResult.manualTables?.length);
      console.log('🔵 [前端] meta:', JSON.stringify(parseResult.meta));
      
      if (!parseResult.success) {
        throw new Error(parseResult.message || '解析失败');
      }

      const {
        normalBlanks: backendNormalBlanks,
        dynamicTables: backendDynamicTables,
        manualTables: backendManualTables,
        tableStructures: backendTableStructures,
        meta: backendMeta
      } = parseResult;

      // 设置三桶数据
      setNormalBlanks(backendNormalBlanks);
      setDynamicTables(backendDynamicTables);
      setManualTables(backendManualTables);
      setTableStructures(backendTableStructures);
      setParseMeta(backendMeta);
      console.log('🔵 [前端] 三桶数据已设置完毕');

      // 本地规则快速映射（秒级完成，不调Dify）
      const cellMappings = {};
      backendDynamicTables.forEach(dt => {
        const ts = backendTableStructures.find(s => s.tableId === dt.tableId);
        if (ts) {
          cellMappings[dt.tableId] = buildCellMapping(dt, ts);
        }
      });
      setTableCellMappings(cellMappings);
      console.log('🔵 [前端] 本地规则映射完成');

      // 获取XML用于后续导出
      const { xmlString, zip } = await extractDocumentXml(file);
      setOriginalXml(xmlString);
      setOriginalZip(zip);

      const mergedBlanks = backendNormalBlanks;

      if (mergedBlanks.length === 0 && backendDynamicTables.length === 0 && backendManualTables.length === 0) {
        message.warning({ content: '未扫描到空白位置，该文件可能不需要填报，或空白格式未被识别。', key: 'scan', duration: 5 });
        setStep('upload');
        setIsScanning(false);
        return;
      }

      setScannedBlanks(mergedBlanks);
      const initialEdits = {};
      mergedBlanks.forEach(b => { initialEdits[b.id] = ''; });
      setManualEdits(initialEdits);
      setAuditResults([]);

      // 上传到Supabase
      const fileExtension = '.' + ext;
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${fileExtension}`;
      const filePath = `${user.id}/${safeFileName}`;
      await supabase.storage.from('documents').upload(filePath, file);
      const uploadedFileUrl = `${supabase.supabaseUrl}/storage/v1/object/documents/${filePath}`;

      const frameworkContent = {
        normalBlanks: mergedBlanks,
        dynamicTables: backendDynamicTables,
        manualTables: backendManualTables,
        tableStructures: backendTableStructures,
        meta: backendMeta
      };

      const { data: project, error } = await supabase.from('bidding_projects').insert({
        user_id: user.id,
        project_name: file.name.replace(/\.[^/.]+$/, ''),
        file_url: uploadedFileUrl,
        framework_content: JSON.stringify(frameworkContent),
        status: 'processing'
      }).select().single();

      if (!error && project) {
        setCurrentProjectId(project.id);
        window.history.replaceState(null, '', `/create-bid?id=${project.id}`);
      }

      const totalBlanks = mergedBlanks.length;
      const totalDynTables = backendDynamicTables.length;
      const totalManTables = backendManualTables.length;
      
      let scanSummary = `解析完成！`;
      if (totalBlanks > 0) scanSummary += `普通填空 ${totalBlanks} 处`;
      if (totalDynTables > 0) scanSummary += `，动态表格 ${totalDynTables} 个`;
      if (totalManTables > 0) scanSummary += `，高危表格 ${totalManTables} 个`;
      
      message.success({ content: scanSummary, key: 'scan' });
      setStep('scan');
    } catch (err) {
      console.error('扫描失败:', err);
      message.error({ content: '文件扫描失败: ' + err.message, key: 'scan' });
    } finally {
      setIsScanning(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleAutoFill = async () => {
    if (!scannedBlanks.length) {
      message.warning('请先扫描文档空白');
      return;
    }
    if (!targetCompany.trim()) {
      message.warning('请先输入或选择投标主体公司');
      return;
    }

    setIsFilling(true);
    setIsAuditing(false);
    try {
      message.loading({ content: `正在调用 AI 分析并填写 ${scannedBlanks.length} 处空白...`, key: 'fill', duration: 0 });

       console.log('🔍 [handleAutoFill] 调试信息开始');
      console.log('🔍 targetCompany:', targetCompany);
      console.log('🔍 productCompanyName:', productCompanyName);
      console.log('🔍 selectedProductIds:', selectedProductIds);
      console.log('🔍 selectedProductIds长度:', selectedProductIds.length);
      console.log('🔍 selectedServiceManualIds:', selectedServiceManualIds);
      console.log('🔍 selectedServiceManualIds长度:', selectedServiceManualIds.length);
      
      const structuredProfile = buildStructuredProfile(selectedCompany);
      const uniqueMatchedSlots = [];
      const matchedSlotIds = new Set();
      Object.values(matchedTemplateSlots).forEach((match) => {
        if (!match?.slot || matchedSlotIds.has(match.slot.id)) return;
        matchedSlotIds.add(match.slot.id);
        uniqueMatchedSlots.push(match);
      });
      const templateLearningPrompt = buildTemplateLearningPrompt(
        uniqueMatchedSlots.filter((match) => match.asset?.standard_content || match.asset?.asset_binding_value)
      );
      
      // 组装产品资产提示词
      let assetPrompt = '';
      const localImageUrlMap = {}; // 局部变量，用于构建映射
      const localManualUrlMap = {}; // 局部变量，用于构建服务手册暗号到URL的映射
      
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const productUuids = selectedProductIds.filter(id => uuidRegex.test(id));
      
      console.log('🔍 productUuids过滤后:', productUuids);
      console.log('🔍 productUuids长度:', productUuids.length);

      // 处理服务手册选择
      const serviceManualAssetIds = [];
      selectedServiceManualIds.forEach(id => {
        // 解析服务手册ID格式: manual-{productId}-{assetId}
        // 示例: manual-0b5e5bd1-b437-441d-b048-63b6ee218464-7437b908-2b65-4551-af95-9a728e998078
        if (id.startsWith('manual-')) {
          // 移除 "manual-" 前缀
          const idWithoutPrefix = id.substring(7); // "manual-".length = 7
          
          // UUID格式: 8-4-4-4-12 字符，共36个字符
          // productId是前36个字符
          if (idWithoutPrefix.length >= 36) {
            const productId = idWithoutPrefix.substring(0, 36);
            const assetId = idWithoutPrefix.substring(37); // 跳过中间的连字符
            
            console.log(`🔍 解析服务手册ID: ${id}`);
            console.log(`🔍   productId: ${productId}`);
            console.log(`🔍   assetId: ${assetId}`);
            
            // 验证assetId是否是有效的UUID格式
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(assetId)) {
              serviceManualAssetIds.push(assetId);
              console.log(`✅ 有效assetId: ${assetId}`);
            } else {
              console.warn(`⚠️ 无效的assetId格式: ${assetId}`);
            }
          } else {
            console.warn(`⚠️ 服务手册ID格式错误: ${id}`);
          }
        }
      });
      
      console.log('🔍 服务手册资产ID:', serviceManualAssetIds);

      if ((productUuids.length > 0 || serviceManualAssetIds.length > 0) && user) {
        console.log('🔍 开始查询产品资产');
        try {
          let assets = [];
          
          if (serviceManualAssetIds.length > 0) {
            // 查询选中的服务手册
            console.log('🔍 查询选中的服务手册资产，资产ID列表:', serviceManualAssetIds);
            const { data: manualAssets, error: manualError } = await supabase
              .from('product_assets')
              .select('*, products!inner(product_name, version)')
              .in('id', serviceManualAssetIds);
            
             if (manualError) {
              console.error('❌ 查询服务手册资产失败:', manualError);
              throw manualError;
            }
            assets.push(...(manualAssets || []));
            console.log('🔍 查询到的服务手册数量:', (manualAssets || []).length);
          }
          
          if (productUuids.length > 0) {
            // 查询选中产品的所有资产（包括图片）
            console.log('🔍 查询产品所有资产，产品UUID列表:', productUuids);
            const { data: productAssets, error: productError } = await supabase
              .from('product_assets')
              .select('*, products!inner(product_name, version)')
              .in('product_id', productUuids);
            
            if (productError) throw productError;
            assets.push(...(productAssets || []));
            console.log('🔍 查询到的产品资产数量:', (productAssets || []).length);
          }
          
          console.log('🔍 查询到的资产数量:', assets?.length || 0);

          // 按产品分组（使用标准化后的产品名称）
          const grouped = {};
          (assets || []).forEach(asset => {
            const productName = normalizeProductName(asset.products.product_name);
            const key = asset.products.version
              ? `${productName} ${asset.products.version}`
              : productName;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(asset);
          });

          console.log('🔍 分组后的产品资产:', grouped);
          console.log('🔍 分组数量:', Object.keys(grouped).length);

          // 构建提示词
          if (Object.keys(grouped).length > 0) {
            assetPrompt = '\n\n【产品资产库（如需引用产品信息或插入图片，请严格使用以下占位符和文本内容）】\n';
            Object.entries(grouped).forEach(([productLabel, items]) => {
              console.log(`🔍 处理产品: ${productLabel}, 资产数量: ${items.length}`);
              assetPrompt += `\n--- [产品：${productLabel}] ---\n`;
              
              const images = items.filter(i => i.asset_type === 'image');
              const texts = items.filter(i => i.asset_type === 'text' || i.asset_type === 'document');
              
              console.log(`🔍 产品 ${productLabel} 的图片资产数量: ${images.length}`);
              
              if (images.length > 0) {
                assetPrompt += '包含图片占位符（如需插入本产品图片，请严格输出此占位符，严禁输出真实链接）：\n';
                images.forEach(img => {
                  // 标准化产品标签和资产名称
                  const normalizedProductLabel = normalizeProductName(productLabel);
                  const normalizedAssetName = normalizeProductName(img.asset_name);
                  const placeholder = `{{IMG_${normalizedProductLabel}_${normalizedAssetName}}}`;
                  assetPrompt += `- ${placeholder}\n`;
                  // 建立占位符到真实 URL 的映射
                  if (img.file_url) {
                    localImageUrlMap[placeholder] = img.file_url;
                    console.log(`🔍 建立映射: ${placeholder} -> ${img.file_url}`);
                  } else {
                    console.warn(`🔍 资产 ${img.asset_name} 没有 file_url`);
                  }
                });
              }
              
              if (texts.length > 0) {
                assetPrompt += '包含文本资产内容（如需引用产品信息，请参考以下内容）：\n';
                texts.forEach(txt => {
                  // 判断是否为服务手册
                  const isServiceManual = txt.asset_name && (
                    txt.asset_name.includes('售后服务手册') || 
                    txt.asset_name.includes('服务手册') ||
                    (txt.asset_type === 'document' && txt.file_url && 
                     (txt.file_url.includes('.doc') || txt.file_url.includes('.docx')))
                  );
                  
                   if (isServiceManual && txt.file_url) {
                     // 服务手册：提供暗号标记，不提供URL
                     // 从资产名称生成简化的暗号名称
                     let manualName = txt.asset_name;
                     // 移除括号和日期等冗余信息
                     manualName = manualName.replace(/[（）()]/g, '');
                     manualName = manualName.replace(/\d{4,}/g, ''); // 移除年份
                     manualName = manualName.replace(/[\s_-]+/g, ' ').trim();
                     
                     // 生成暗号标记
                     const docCode = `[INSERT_DOC:${manualName}]`;
                     assetPrompt += `- [${txt.asset_name}]：文档暗号 - ${docCode}\n`;
                     
                     // 建立暗号到URL的映射
                     localManualUrlMap[docCode] = txt.file_url;
                     
                     console.log(`🔍 识别为服务手册: ${txt.asset_name}, 暗号: ${docCode}, URL: ${txt.file_url}`);
                   } else {
                    // 普通文档：截断显示内容
                    const contentPreview = txt.text_content && txt.text_content.length > 5000 
                      ? `${txt.text_content.substring(0, 5000)}...(全文共 ${txt.text_content.length} 字，已截断)` 
                      : txt.text_content || '';
                    assetPrompt += `- [${txt.asset_name}]：${contentPreview}\n`;
                  }
                });
              }
            });
           }
           
           // 记录assetPrompt内容
           console.log('🔍 assetPrompt内容预览（前1000字符）:', assetPrompt.substring(0, 1000));
           console.log('🔍 assetPrompt总长度:', assetPrompt.length);
           console.log('🔍 assetPrompt是否包含服务手册URL:', assetPrompt.includes('文档URL - http'));
         } catch (assetError) {
           console.warn('加载产品资产失败，继续执行:', assetError);
         }
       }
       
       console.log('🔍 localImageUrlMap构建结果:', localImageUrlMap);
      console.log('🔍 localImageUrlMap条目数量:', Object.keys(localImageUrlMap).length);
      console.log('🔍 localImageUrlMap键列表（标准化后）:');
      Object.keys(localImageUrlMap).forEach(key => {
        console.log(`  - "${key}" (标准化: "${normalizeProductName(key)}")`);
      });
      
       // 保存到状态，供导出时使用
       setImageUrlMap(localImageUrlMap);
        console.log('🔍 localManualUrlMap构建结果:', localManualUrlMap);
       console.log('🔍 localManualUrlMap条目数量:', Object.keys(localManualUrlMap).length);

      // === 新增：查询知识库中与目标公司相关的资质图片 ===
      try {
        if (targetCompany.trim() && user) {
          const { data: kbImages, error: kbError } = await supabase
            .from('images')
            .select('image_name, image_url, image_categories!inner(name)')
            .eq('image_categories.name', targetCompany.trim());

          if (!kbError && kbImages && kbImages.length > 0) {
            assetPrompt += '\n\n【公司资质图片（如需插入营业执照等公司资质，请直接输出纯 URL，不要输出 Markdown）】\n';
            kbImages.forEach(img => {
              assetPrompt += `- ${img.image_name}：${img.image_url}\n`;
            });
          }
        }
      } catch (kbImageError) {
        console.warn('加载知识库图片失败，继续执行:', kbImageError);
      }

      console.log('📊 ========== 空白上下文体检 ==========');
      scannedBlanks.forEach((b, i) => {
        const ctx = b.context || '';
        const chineseCount = (ctx.match(/[\u4e00-\u9fa5]/g) || []).length;
        const isPoorContext = chineseCount < 3 && ['underscore', 'dash', 'keyword_space'].includes(b.type);
        console.log(`👉 #${i + 1} ID: ${b.id} | 类型: ${b.type} | 符号: "${b.matchText}" | paraIndex: ${b.paraIndex}`);
        console.log(`   靶心上下文: "${ctx}"`);
        console.log(`   中文字符数: ${chineseCount}${isPoorContext ? ' ⚠️ 上下文不足！' : ' ✅'}`);
      });
      console.log('📊 ========== 体检结束 ==========');

      const enrichedContext = (structuredProfile ? structuredProfile + '\n' : '') 
        + (tenderContext || '') 
        + (templateLearningPrompt ? `\n${templateLearningPrompt}` : '')
        + assetPrompt;
      
      console.log('🔍 [handleAutoFill] 调用AI填空API');
      console.log('🔍 localImageUrlMap 内容:', localImageUrlMap);
      console.log('🔍 localImageUrlMap 键列表（标准化调试）:');
      Object.keys(localImageUrlMap).forEach(key => {
        console.log(`  - 原始: "${key}"`);
        console.log(`    标准化: "${normalizeProductName(key)}"`);
      });
      console.log('🔍 发送给AI的空白列表:', scannedBlanks.map(b => ({ 
        id: b.id, 
        type: b.type, 
        context: b.context,
        matchText: b.matchText,
        need_image: b.need_image 
      })));
      
      console.log('🔍 富文本上下文预览（前500字符）:', enrichedContext.substring(0, 500) + '...');
      
      const result = await fillDocumentBlanks(scannedBlanks, targetCompany, enrichedContext);
      console.log('🔍 AI返回结果:', result);
      console.log('🔍 AI返回结果键:', Object.keys(result));

      // 处理 AI 返回结果：将占位符替换为真实 URL
      const processedResult = {};
      for (const blankId in result) {
        let value = result[blankId] || '';
        console.log(`🔍 处理空白 ${blankId}: 原始值="${value}"`);
        console.log(`🔍 空白 ${blankId} 原始值长度:`, value.length);
        
          // 替换所有图片占位符为真实 URL
          if (value && typeof value === 'string') {
            let replaced = false;
            console.log(`🔍 检查空白 ${blankId} 的占位符替换，localImageUrlMap条目数:`, Object.keys(localImageUrlMap).length);
            
            for (const [placeholder, realUrl] of Object.entries(localImageUrlMap)) {
              console.log(`🔍 检查占位符匹配:`);
              console.log(`  - 空白值: "${value}"`);
              console.log(`  - 占位符: "${placeholder}"`);
              console.log(`  - 空白值标准化: "${normalizeProductName(value)}"`);
              console.log(`  - 占位符标准化: "${normalizeProductName(placeholder)}"`);
              console.log(`  - 是否包含: ${value.includes(placeholder)}`);
              console.log(`  - 模糊匹配: ${fuzzyMatchPlaceholder(value, placeholder)}`);
              
              // 使用模糊匹配
              if (fuzzyMatchPlaceholder(value, placeholder)) {
                console.log(`✅ 模糊匹配占位符 ${placeholder}，替换为 ${realUrl}`);
                
                // 使用新的正则表达式构建函数
                const oldValue = value;
                const regex = buildPlaceholderRegex(placeholder);
                const newValue = value.replace(regex, realUrl);
                
                console.log(`🔍 替换测试: 正则表达式 ${regex}`);
                console.log(`🔍 替换测试: 旧值 "${oldValue}"`);
                console.log(`🔍 替换测试: 新值 "${newValue}"`);
                console.log(`🔍 替换测试: 是否改变 ${oldValue !== newValue}`);
                
                if (oldValue !== newValue) {
                  value = newValue;
                  replaced = true;
                  console.log(`✅ 替换成功: ${placeholder} -> ${realUrl}`);
                } else {
                  console.log(`❌ 正则表达式替换失败，尝试直接替换`);
                  // 如果正则表达式替换失败，尝试直接替换
                  value = realUrl;
                  replaced = true;
                }
                break; // 找到匹配后跳出循环
              } else if (value.includes(placeholder)) {
                console.log(`✅ 精确匹配占位符 ${placeholder}，替换为 ${realUrl}`);
                value = value.replace(new RegExp(placeholder, 'g'), realUrl);
                replaced = true;
                break; // 找到匹配后跳出循环
              }
            }
          if (replaced) {
            console.log(`✅ 空白 ${blankId} 占位符替换完成，新值="${value.substring(0, 100)}..."`);
          } else {
            console.log(`🔍 空白 ${blankId} 未找到匹配的占位符`);
          }
          // === 新增：如果 LLM 输出了 Markdown 图片格式，提取纯 URL ===
          const mdImgMatch = value.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
          if (mdImgMatch) {
            console.log(`🔍 提取Markdown图片URL: ${mdImgMatch[1]}`);
            value = mdImgMatch[1];
          }
        }
        
        processedResult[blankId] = value;
        console.log(`🔍 空白 ${blankId} 最终值="${value.substring(0, 100)}..."`);
      }

      Object.entries(matchedTemplateSlots).forEach(([blankId, match]) => {
        if (processedResult[blankId]) return;
        const standardContent = match?.asset?.standard_content?.trim();
        if (standardContent && ['standard_library', 'asset_selection'].includes(match.slot.fill_strategy)) {
          processedResult[blankId] = standardContent;
        }
      });

      scannedBlanks.forEach((blank) => {
        if (processedResult[blank.id]) return;
        const structuredValue = getStructuredFieldValue(blank, selectedCompany);
        if (structuredValue) {
          processedResult[blank.id] = structuredValue;
        }
      });
       
      console.log('🔍 processedResult 最终结果:', processedResult);
      console.log('🔍 processedResult 键:', Object.keys(processedResult));

      const merged = { ...manualEdits };
      for (const blank of scannedBlanks) {
        if (!merged[blank.id] && processedResult[blank.id]) {
          merged[blank.id] = processedResult[blank.id] || '';
        }
      }
      setManualEdits(merged);

      setIsAuditing(true);
      message.loading({ content: 'AI 填写完成，正在执行智能审核...', key: 'audit', duration: 0 });
      const reviewedResults = await runSmartAudit(merged, enrichedContext);
      setAuditResults(reviewedResults);
      const reviewedSummary = summarizeAuditResults(reviewedResults);
      message.success({
        content: `智能审核完成：通过 ${reviewedSummary.pass} 项，可疑 ${reviewedSummary.warning} 项，高风险 ${reviewedSummary.error} 项`,
        key: 'audit',
        duration: 4
      });

      if (currentProjectId) {
        await supabase.from('bidding_projects').update({
          analysis_report: JSON.stringify({
            manualEdits: merged,
            dynamicTableEdits,
            dynamicTableImages,
            selectedPersonRoles,
          }),
          status: 'completed'
        }).eq('id', currentProjectId);
      }

      message.success({ content: 'AI 填写完成！请核对并手动修正后导出。', key: 'fill' });
      setStep('review');
    } catch (err) {
      console.error('AI 填写失败:', err);
      message.destroy('audit');
      message.error({ content: 'AI 填写失败: ' + err.message, key: 'fill' });
      setStep('scan');
    } finally {
      setIsFilling(false);
      setIsAuditing(false);
    }
  };

  const handleExportFilledWord = async () => {
    if (!originalZip || !originalXml || scannedBlanks.length === 0) {
      return message.error('缺少原始文件数据，请重新上传');
    }

    try {
      console.log('🔍 [handleExportFilledWord] 开始导出Word文档');
      console.log('🔍 导出参数:', {
        scannedBlanksCount: scannedBlanks.length,
        manualEditsCount: Object.keys(manualEdits).length,
      });

      message.loading({ content: '正在生成已填报的 Word 文件...', key: 'export', duration: 0 });

      const filledBlob = await generateFilledDocx(originalZip, originalXml, scannedBlanks, manualEdits, imageUrlMap);
      console.log('🔍 前端 Word 文档生成完成，blob大小:', filledBlob.size, 'bytes');

      // ===== 核心修复：从 manualEdits 中实时提取所有 [INSERT_DOC:xxx] 暗号 =====
      const codesToResolve = new Map();

      for (const [blankId, value] of Object.entries(manualEdits)) {
        if (typeof value === 'string') {
          let match;
          const regex = /\[INSERT_DOC:([^\]]+)\]/g;
          while ((match = regex.exec(value)) !== null) {
            const fullCode = match[0];
            const codeName = match[1];
            if (!codesToResolve.has(fullCode)) {
              codesToResolve.set(fullCode, { name: codeName, blankId });
            }
          }
        }
      }

      console.log('🔍 从 manualEdits 中提取到的暗号:', Array.from(codesToResolve.keys()));

      // 提取动态表格数据
      const dynamicTableDataList = Object.keys(dynamicTableEdits || {})
        .map(tableId => {
          const dt = dynamicTables.find(t => t.tableId === parseInt(tableId));
          const fillMode = dt?.fillMode || 'multi_person';
          
          return {
            table_id: parseInt(tableId),
            fill_mode: fillMode,
            rows: (dynamicTableEdits[tableId] || []).map((row, index) => {
              const { _personName, _positionName, _experienceIndex, _rowIndex, ...rest } = row;
              // 🆕 汇总表模式：保留行索引
              if (fillMode === 'multi_person' && _rowIndex !== undefined) {
                return {
                  ...rest,
                  _rowIndex: _rowIndex
                };
              }
              return rest;
            }),
            append_images: dynamicTableImages[tableId] || [],
          };
        })
        .filter(item => item.rows && item.rows.length > 0);

      console.log('🔍 动态表格数据:', dynamicTableDataList.length, '个表格');
      console.log('🔍 动态表格详情:', dynamicTableDataList);

      // 既没有服务手册，又没有动态表格 → 直接下载
      if (codesToResolve.size === 0 && dynamicTableDataList.length === 0) {
        console.log('🔍 没有服务手册和动态表格，直接下载');
        saveAs(filledBlob, `已填报_${originalFile.name}`);
        message.success({ content: '导出成功！格式 100% 还原原文件。', key: 'export' });
        return;
      }

      // 只有动态表格，没有服务手册 → 直接发后端
      if (codesToResolve.size === 0 && dynamicTableDataList.length > 0) {
        console.log('📡 仅有动态表格数据，直接发送后端处理');
        const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_BASE || 'http://localhost:8000';
        const formData = new FormData();
        formData.append('file', filledBlob, `filled_${originalFile.name}`);
        formData.append('mapping', JSON.stringify({}));
        formData.append('dynamic_tables', JSON.stringify(dynamicTableDataList));

        try {
          const response = await fetch(`${BACKEND_API_BASE}/api/merge-docs`, {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`后端处理失败: HTTP ${response.status} - ${errorText}`);
          }
          const mergedBlob = await response.blob();
          saveAs(mergedBlob, `已填报_${originalFile.name}`);
          message.success({ content: '导出成功！动态表格已填入。', key: 'export' });
        } catch (err) {
          console.error('❌ 动态表格处理失败:', err);
          message.error({ content: `导出失败: ${err.message}`, key: 'export' });
        }
        return;
      }

      // ===== 动态查询 Supabase 获取所有服务手册资产的 URL =====
      console.log('📡 正在查询服务手册资产以动态构建映射...');

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', user.id);

      if (productsError) throw productsError;

      const productIds = (products || []).map(p => p.id);
      console.log('📡 当前用户的产品ID数量:', productIds.length);

      let serviceManuals = [];
      if (productIds.length > 0) {
        const { data: allAssets, error: assetsError } = await supabase
          .from('product_assets')
          .select('*, products!inner(product_name, version)')
          .in('product_id', productIds);

        if (assetsError) throw assetsError;

        serviceManuals = (allAssets || []).filter(asset => {
          if (!asset.file_url) return false;
          const isDoc = asset.asset_type === 'document' ||
                        (asset.file_url.includes('.doc') || asset.file_url.includes('.docx'));
          const isManual = asset.asset_name && (
            asset.asset_name.includes('售后服务手册') ||
            asset.asset_name.includes('服务手册')
          );
          return isDoc && isManual;
        });

        console.log('📡 找到的服务手册资产:', serviceManuals.length);
        serviceManuals.forEach(sm => {
          console.log(`  - ${sm.asset_name} -> ${sm.file_url}`);
        });
      }

      // ===== 用标准化名称模糊匹配暗号与资产 =====
      const dynamicManualUrlMap = {};

      for (const [fullCode, { name: codeName }] of codesToResolve) {
        const normalizedCodeName = normalizeProductName(codeName);
        console.log(`🔍 尝试匹配暗号: ${fullCode}, 标准化: ${normalizedCodeName}`);

        let matched = false;
        for (const manual of serviceManuals) {
          let manualName = manual.asset_name;
          manualName = manualName.replace(/[（）()]/g, '');
          manualName = manualName.replace(/\d{4,}/g, '');
          manualName = manualName.replace(/[\s_-]+/g, ' ').trim();
          const normalizedManualName = normalizeProductName(manualName);

          console.log(`  对比: "${normalizedManualName}" (原始: "${manual.asset_name}")`);

          if (normalizedCodeName === normalizedManualName ||
              normalizedManualName.includes(normalizedCodeName) ||
              normalizedCodeName.includes(normalizedManualName)) {
            dynamicManualUrlMap[fullCode] = manual.file_url;
            console.log(`✅ 匹配成功: ${fullCode} -> ${manual.file_url}`);
            matched = true;
            break;
          }
        }

        if (!matched) {
          console.warn(`⚠️ 未找到匹配的资产: ${fullCode}`);
        }
      }

      console.log('📡 动态构建的 mapping:', dynamicManualUrlMap);

      if (Object.keys(dynamicManualUrlMap).length === 0 && dynamicTableDataList.length === 0) {
        console.log('⚠️ 未能解析任何服务手册URL，也无动态表格，将直接下载');
        saveAs(filledBlob, `已填报_${originalFile.name}`);
        message.warning({ content: '导出成功，但未能找到对应的服务手册文件，暗号将保留为文本', key: 'export', duration: 5 });
        return;
      }

      // ===== 调用后端合并接口 =====
      console.log('📡 调用后端合并接口...');
      console.log('📡 请求目标: POST /api/merge-docs');

      const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_BASE || 'http://localhost:8000';

      const formData = new FormData();
      formData.append('file', filledBlob, `filled_${originalFile.name}`);
      formData.append('mapping', JSON.stringify(dynamicManualUrlMap));

      if (dynamicTableDataList.length > 0) {
        formData.append('dynamic_tables', JSON.stringify(dynamicTableDataList));
      }

      console.log('📡 FormData 构造完成:');
      console.log('  - file:', filledBlob.name, filledBlob.size, 'bytes');
      console.log('  - mapping keys:', Object.keys(dynamicManualUrlMap));
      console.log('  - dynamic_tables:', dynamicTableDataList.length, '个表格');

      const response = await fetch(`${BACKEND_API_BASE}/api/merge-docs`, {
        method: 'POST',
        body: formData,
      });

      console.log('📡 后端响应状态:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ 后端返回错误:', response.status, errorText);
        throw new Error(`后端合并失败: HTTP ${response.status} - ${errorText}`);
      }

      const mergedBlob = await response.blob();
      console.log('📡 后端返回合并后的文档，大小:', mergedBlob.size, 'bytes');

      saveAs(mergedBlob, `已填报_${originalFile.name}`);
      message.success({ content: '导出成功！服务手册已合并到文档中。', key: 'export' });

    } catch (err) {
      console.error('❌ 导出失败:', err);
      console.error('❌ 错误堆栈:', err.stack);
      if (err.message && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError'))) {
        message.error({
          content: '网络错误：请确认后端服务已启动',
          key: 'export',
          duration: 8,
        });
      } else {
        message.error({ content: `导出失败: ${err.message}`, key: 'export' });
      }
    }
  };

  const handleManualEdit = (blankId, value) => {
    setManualEdits(prev => ({ ...prev, [blankId]: value }));
  };

  const handleTenderFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsExtractingTender(true);
    message.loading({ content: `正在读取 ${file.name}...`, key: 'extract_tender', duration: 0 });

    try {
      const text = await extractTextFromDocument(file);
      if (text && text.trim()) {
        setTenderContext(text);
        message.success({ 
          content: '提取成功！建议您删除无关页内容，仅保留核心要求，以提升 AI 准确度。', 
          key: 'extract_tender',
          duration: 5
        });
      } else {
        message.warning({ content: '未能从文件中提取到有效文字', key: 'extract_tender' });
      }
    } catch (error) {
      message.error({ content: `解析失败: ${error.message}`, key: 'extract_tender' });
    } finally {
      setIsExtractingTender(false);
      if (event.target) event.target.value = '';
    }
  };

  const fetchCompanyList = async () => {
    setTempSelectedCompany(selectedCompany);
    setTempKbName(companyList.includes(targetCompany) ? targetCompany : '');
    setIsCompanyModalVisible(true);
    setFetchingCompanies(true);
    try {
      const [profileRes, docRes, imgRes] = await Promise.all([
        supabase.from('company_profiles').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('document_categories').select('name'),
        supabase.from('image_categories').select('name')
      ]);
      if (!profileRes.error) {
        setCompanyProfiles(profileRes.data || []);
      }
      const kbNames = [...new Set([
        ...(docRes.data || []).map(i => i.name),
        ...(imgRes.data || []).map(i => i.name)
      ].filter(name => name && name.trim() !== ''))];
      setCompanyList(kbNames);
    } catch (error) {
      console.error('加载企业列表失败:', error);
    } finally {
      setFetchingCompanies(false);
    }
  };

  const confirmCompanySelection = () => {
    if (tempSelectedCompany) {
      setSelectedCompany(tempSelectedCompany);
    } else {
      setSelectedCompany(null);
    }
    if (tempKbName) {
      setTargetCompany(tempKbName);
    } else if (tempSelectedCompany) {
      setTargetCompany(tempSelectedCompany.company_name);
    } else {
      setTargetCompany('');
    }
    setProductCompanyName(tempSelectedCompany?.company_name || '');
    setIsCompanyModalVisible(false);
    const parts = [];
    if (tempSelectedCompany) parts.push(`结构化主体：${tempSelectedCompany.company_name}`);
    if (tempKbName) parts.push(`知识库分类：${tempKbName}`);
    if (parts.length > 0) message.success(`已锁定 ${parts.join(' + ')}`);
  };

  // 获取人员的职位列表（兼容新旧格式）
  const getPersonPositions = (profile) => {
    if (!profile) return [];
    const jobPositions = profile.custom_fields?.job_positions;
    if (Array.isArray(jobPositions) && jobPositions.length > 0) {
      return jobPositions.map(jp => jp.position_name).filter(Boolean);
    }
    // 兼容旧格式：如果有project_experiences但没有job_positions，返回默认职位
    const oldExperiences = profile.custom_fields?.project_experiences;
    if (Array.isArray(oldExperiences) && oldExperiences.length > 0) {
      return [profile.job_title || profile.title || '默认职位'];
    }
    return [];
  };

  // 获取指定职位的项目经历
  const getPositionExperiences = (profile, positionName) => {
    if (!profile) return [];
    const jobPositions = profile.custom_fields?.job_positions;
    if (Array.isArray(jobPositions)) {
      const position = jobPositions.find(jp => jp.position_name === positionName);
      return position?.project_experiences || [];
    }
    // 兼容旧格式
    return profile.custom_fields?.project_experiences || [];
  };

  // 检查人员是否已被选择（任意职位）
  const isPersonSelected = (tableId, personName) => {
    const selections = selectedPersonRoles[tableId] || {};
    return personName in selections;
  };

  // 获取已选人员列表
  const getSelectedPersons = (tableId) => {
    const selections = selectedPersonRoles[tableId] || {};
    return Object.keys(selections);
  };

  const buildStructuredProfile = (company) => {
    if (!company) return '';
    const labelMap = {
      company_name: '公司名称',
      uscc: '统一社会信用代码',
      registered_capital: '注册资金',
      company_type: '公司性质',
      establish_date: '成立日期',
      operating_period: '经营期限',
      phone: '联系电话',
      email: '公司邮箱',
      address: '公司地址',
      zip_code: '邮政编码',
      registration_authority: '登记机关',
      business_scope: '经营范围',
      legal_rep_name: '法定代表人',
      id_number: '身份证号',
      gender: '性别',
      birth_date: '出生日期',
      id_expiry: '身份证有效期',
      position: '职位',
      id_photo_front_url: '身份证正面照片',
      id_photo_back_url: '身份证反面照片',
    };
    let text = '【投标主体权威档案】\n';
    for (const [key, label] of Object.entries(labelMap)) {
      if (company[key]) {
        text += `${label}：${company[key]}\n`;
      }
    }
    if (company.custom_fields && typeof company.custom_fields === 'object') {
      const keys = Object.keys(company.custom_fields);
      if (keys.length > 0) {
        text += '【自定义扩展信息】\n';
        for (const [k, v] of Object.entries(company.custom_fields)) {
          if (v) text += `${k}：${v}\n`;
        }
      }
    }
    return text;
  };

  const runSmartAudit = useCallback(async (filledValues, enrichedContext) => {
    const ruleResults = validateFilledBlanksWithRules(scannedBlanks, filledValues, selectedCompany);
    const reviewCandidates = scannedBlanks.filter((blank) => {
      const value = String(filledValues[blank.id] || '').trim();
      if (!value) return false;
      if (/^https?:\/\//i.test(value)) return false;
      if (blank.type === 'image_placeholder' || blank.type === 'attachment') return false;
      return true;
    });

    const aiResults = {};
    if (reviewCandidates.length > 0) {
      try {
        const auditCandidates = reviewCandidates.map((blank) => ({
          ...blank,
          auditFieldHint: deriveAuditFieldHint(blank)
        }));
        const reviewed = await reviewFilledBlanksWithAI(auditCandidates, filledValues, selectedCompany || {}, tenderContext || enrichedContext || '');
        Object.assign(aiResults, reviewed);
      } catch (error) {
        console.warn('智能审核 AI 复核失败，保留规则校验结果:', error);
      }
    }

    return mergeAuditResults(scannedBlanks, filledValues, ruleResults, aiResults);
  }, [scannedBlanks, selectedCompany, tenderContext]);

  const handleApplyAuditSuggestion = useCallback((blankId, suggestedValue) => {
    if (!suggestedValue) return;
    setManualEdits((prev) => ({ ...prev, [blankId]: suggestedValue }));
    setAuditResults((prev) => prev.map((item) => (
      item.blankId === blankId
        ? { ...item, value: suggestedValue, status: 'warning', ruleResult: item.ruleResult, aiResult: item.aiResult }
        : item
    )));
    message.success('已采用智能审核建议');
  }, []);

  const getStructuredFieldValue = (blank, company) => {
    if (!blank || !company) return '';
    const hint = deriveAuditFieldHint(blank);
    const localContext = String(blank.localContext || '');

    if (/投标人名称|单位名称|公司名称/.test(hint)) {
      return company.company_name || '';
    }

    if (blank.type === 'brackets') {
      if (/报价人单位名称|投标人名称|单位名称|公司名称|供应商名称/.test(localContext)) {
        return company.company_name || '';
      }
      if (/法定代表人姓名|法人代表|法定代表人/.test(localContext)) {
        return company.legal_rep_name || '';
      }
      if (/被授权人姓名|委托代理人|授权代表|被授权人/.test(localContext)) {
        return company.legal_rep_name || '';
      }
      return '';
    }

    if (/法定代表人信息|法定代表人姓名|法人代表|法定代表人|姓名/.test(hint)) {
      return company.legal_rep_name || '';
    }
    if (/被授权人信息|委托代理人|授权代表/.test(hint)) {
      return company.legal_rep_name || '';
    }

    if (/性别/.test(hint)) {
      return company.gender || '';
    }

    if (/年龄/.test(hint)) {
      return '';
    }

    if (/职务/.test(hint)) {
      return company.position || '';
    }

    if (/身份证号码|身份证号/.test(hint)) {
      return company.id_number || '';
    }

    if (/电话|联系电话|联系方式/.test(hint)) {
      return company.phone || '';
    }

    if (/地址|联系地址|通讯地址/.test(hint)) {
      return company.address || '';
    }

    if (/统一社会信用代码|信用代码/.test(hint)) {
      return company.uscc || '';
    }

    return '';
  };

  const blankColumns = [
    {
      title: '序号',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (text) => <span className="font-mono text-indigo-600 text-xs">{text}</span>
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => {
        const typeMap = {
          underscore: { label: '下划线', color: 'blue' },
          dash: { label: '短横线', color: 'cyan' },
          spaces: { label: '空格', color: 'geekblue' },
          keyword_space: { label: '关键词', color: 'purple' },
          date_pattern: { label: '日期', color: 'orange' },
          empty_cell: { label: '空单元格', color: 'green' }
        };
        const info = typeMap[type] || { label: type, color: 'default' };
        return <Tag color={info.color} className="text-xs">{info.label}</Tag>;
      }
    },
    // ====== 修改 CreateBid.jsx 中的 blankColumns 数组 ======
    {
      title: '定位',
      key: 'locator',
      width: 300,
      render: (_, record) => (
        <div className="leading-snug">
          <div className="text-xs font-medium text-gray-700">
            {deriveAuditFieldHint(record) || record.fieldHint || '未命名字段'}
            <span className="ml-2 text-[11px] text-gray-400">P{record.paraIndex} / 第{record.blankOrdinalInParagraph || 1}空</span>
          </div>
          {/* 💡 核心：优先显示 markedContext，让你清清楚楚看到【🎯】到底指着谁！ */}
          <div className="mt-1 text-[11px] text-gray-500 break-all">{record.markedContext || record.context}</div>
        </div>
      )
    },
    {
      title: '智能审核',
      key: 'audit',
      width: 180,
      render: (_, record) => {
        const audit = auditResultsById[record.id];
        if (!audit) return <span className="text-xs text-gray-400">待审核</span>;
        const color = audit.status === 'error' ? 'red' : audit.status === 'warning' ? 'gold' : 'green';
        const label = audit.status === 'error' ? '高风险' : audit.status === 'warning' ? '可疑' : '通过';
        return (
          <div className="space-y-1">
            <Tag color={color}>{label}</Tag>
            <div className="text-[11px] text-gray-500 leading-5">{audit.aiResult?.reason || audit.ruleResult?.reason || '智能审核通过'}</div>
            {audit.suggestedValue && audit.suggestedValue !== (manualEdits[record.id] || '') && (
              <Button type="link" size="small" className="px-0 text-[11px]" onClick={() => handleApplyAuditSuggestion(record.id, audit.suggestedValue)}>
                采用建议
              </Button>
            )}
          </div>
        );
      }
    },
    {
      title: 'AI 填写结果 / 手动修改',
      key: 'value',
      width: 320,
      render: (_, record) => (
        <Input
          value={manualEdits[record.id] || ''}
          onChange={(e) => handleManualEdit(record.id, e.target.value)}
          placeholder="手动输入或等待 AI 填写..."
          className="w-full"
          onClick={() => scrollToBlank(record.id)}
        />
      )
    }
  ];

  if (step === 'upload') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F9FA] p-4 sm:p-8 relative">
        <h2 className="text-3xl font-bold text-gray-800 mb-4">投标文件智能填报</h2>
        <p className="text-gray-500 mb-12 text-center max-w-xl">
          上传甲方的 .docx 投标文件框架，系统将自动扫描其中的空白位置（签名栏、日期栏、公司信息等），
          由 AI 结合知识库自动填写，最终导出格式 100% 还原的已填报文件。
        </p>

        <div className="flex w-full max-w-4xl justify-center gap-4 sm:gap-8">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileUpload}
            accept=".docx"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 max-w-lg border-2 border-dashed border-indigo-300 hover:border-indigo-500 rounded-3xl px-6 py-10 sm:p-16 bg-white shadow-sm hover:shadow-xl cursor-pointer flex flex-col items-center group transition-all duration-300 transform hover:-translate-y-1"
          >
            <div className="w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
              <UploadCloud size={48} className="text-indigo-500" />
            </div>
            <h3 className="text-2xl font-bold text-gray-800 mb-3">上传投标文件框架 (.docx)</h3>
            <p className="text-gray-500 text-center text-sm leading-relaxed">
              支持 Word 2007+ 格式 (.docx)<br />
              系统将自动识别文件中的签名栏、日期栏、<br />
              公司信息等空白位置并智能填写
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
            <span className="text-lg">⚠️</span>
            <span className="text-sm font-medium">
              重要提示：AI 辅助填报内容可能存在随机性，请务必在封标前进行人工复核。
            </span>
          </div>
          <p className="text-xs text-gray-400">本系统仅作为辅助工具</p>
        </div>

        {isScanning && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-2xl flex flex-col items-center w-[min(92vw,400px)]">
              <Cpu size={40} className="text-indigo-500 mb-6 animate-pulse" />
              <h3 className="text-lg font-bold text-gray-800 mb-2">正在扫描文件...</h3>
              <p className="text-gray-500 text-sm">正在解析 Word XML 结构，识别空白填写位置</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 'scan' || step === 'review') {
    const isReviewed = step === 'review';

    return (
      <div className="h-screen flex flex-col bg-[#F8F9FA] overflow-hidden">
        <div className="bg-white border-b px-4 py-3 sm:px-6 shadow-sm shrink-0 z-10">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center">
            <Button
              type="text"
              icon={<ArrowLeft size={18} />}
                onClick={() => { setStep('upload'); setScannedBlanks([]); setManualEdits({}); setTenderContext(''); setAuditResults([]); }}
              className="text-gray-600 font-medium"
            >
              重新上传
            </Button>
            <span className="ml-4 text-gray-300">|</span>
            <span className="ml-4 min-w-0 truncate text-sm text-gray-500">
              {originalFile?.name}
            </span>
            <Tag color="blue" className="ml-3">{scannedBlanks.length} 处空白</Tag>
          </div>
          <div className="flex items-center gap-3 self-start lg:self-auto">
            {isReviewed && (
              <Button
                type="primary"
                icon={<Download size={16} />}
                onClick={handleExportFilledWord}
                className="bg-green-600 hover:bg-green-700 rounded-full px-6 border-0 font-bold"
              >
                导出已填报文件 (.docx)
              </Button>
              )}
          </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
          {/* ========== 左侧：原文对照侧边栏 ========== */}
<div
            className="h-[40vh] xl:h-auto bg-white border-b xl:border-b-0 border-gray-200 flex flex-col shrink-0 w-full"
            style={isDesktopViewport ? { width: `${previewPanelWidth}px` } : undefined}
          >
              <div className="p-3 border-b border-gray-100 bg-gray-50 shrink-0">
              <h4 className="font-bold text-gray-700 text-sm flex items-center">
                <Eye size={14} className="mr-2 text-indigo-500" />
                原文对照
                <span className="ml-2 text-xs text-gray-400 font-normal">保持原始版式，点击右侧字段定位左侧</span>
              </h4>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-200 ring-1 ring-amber-400" />
                <span>待填写</span>
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-green-100 ring-1 ring-green-500" />
                <span>已填写</span>
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-100 ring-2 ring-indigo-400" />
                <span>当前定位</span>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-[#f5f7fb] min-h-0" ref={previewScrollRef}>
              {isRenderingPreview && (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <Spin className="mb-3" />
                  <p className="text-xs">正在渲染原始 Word 预览...</p>
                </div>
              )}
              {previewError && !isRenderingPreview && (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <FileText size={32} className="text-gray-300 mb-2" />
                  <p className="text-xs text-red-500">{previewError}</p>
                </div>
              )}
              {!previewError && !originalFile && !isRenderingPreview && (
                <div className="flex flex-col items-center justify-center py-12">
                  <FileText size={32} className="text-gray-300 mb-2" />
                  <p className="text-xs text-gray-400">原文预览为空</p>
                </div>
              )}
              <div className="p-2 xl:p-3">
                <div
  ref={previewRef}
  className="docx-preview-host min-h-full overflow-auto rounded-xl bg-white shadow-sm [&_.docx-wrapper]:!items-start [&_.docx-wrapper_section.docx]:!mx-auto [&_.docx-wrapper]:!p-2 md:[&_.docx-wrapper]:!p-4"
/>
              </div>
            </div>
          </div>

          <div
            className={`hidden xl:flex w-2 shrink-0 cursor-col-resize items-stretch justify-center bg-white transition-colors ${isResizingPreview ? 'bg-indigo-50' : 'hover:bg-indigo-50/70'}`}
            onMouseDown={handlePreviewResizeStart}
            role="separator"
            aria-orientation="vertical"
            aria-label="调整原文对照宽度"
          >
            <div className={`my-2 w-px rounded-full transition-colors ${isResizingPreview ? 'bg-indigo-400' : 'bg-gray-200'}`} />
          </div>

          {/* ========== 中间：表格编辑区 ========== */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-white">
            {/* 1. 顶部标题与审核提示区 */}
            <div className="bg-white border-b border-gray-100 p-3 shrink-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-base font-bold text-gray-800 flex items-center">
                  <Edit3 size={16} className="mr-2 text-indigo-500" />
                  待填写字段
                  <Tag color="blue" className="ml-2">{scannedBlanks.length} 处</Tag>
                </h3>
                <p className="text-xs text-gray-400">
                  {isReviewed ? 'AI 已完成填写，可直接修改后导出' : '点击任意行 ↔ 左右双向联动定位'}
                </p>
              </div>

              {isReviewed && (
                <div className="mt-2 rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50 via-white to-emerald-50 p-2.5">
                  <div className="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-gray-800 font-semibold text-sm">
                        <ShieldCheck size={16} className="text-indigo-600" />
                        智能审核
                        {isAuditing && <Tag color="processing">审核中</Tag>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <div className="rounded-lg bg-white px-3 py-1 shadow-sm border border-gray-100 text-center">
                        <div className="text-[10px] text-gray-500">已审</div>
                        <div className="text-sm font-bold text-gray-900">{auditSummary.total}</div>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-1 shadow-sm border border-gray-100 text-center">
                        <div className="text-[10px] text-gray-500">通过</div>
                        <div className="text-sm font-bold text-emerald-600">{auditSummary.pass}</div>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-1 shadow-sm border border-gray-100 text-center">
                        <div className="text-[10px] text-gray-500">可疑</div>
                        <div className="text-sm font-bold text-amber-500">{auditSummary.warning}</div>
                      </div>
                      <div className="rounded-lg bg-white px-3 py-1 shadow-sm border border-gray-100 text-center">
                        <div className="text-[10px] text-gray-500">风险</div>
                        <div className="text-sm font-bold text-red-500">{auditSummary.error}</div>
                      </div>
                    </div>
                  </div>
                  {auditSummary.total > 0 && (auditSummary.warning > 0 || auditSummary.error > 0) && (
                    <Alert
                      className="mt-2 rounded-md py-1 px-3 text-xs"
                      type={auditSummary.error > 0 ? 'warning' : 'info'}
                      showIcon
                      icon={<TriangleAlert size={14} />}
                      message={`发现 ${auditSummary.error} 项高风险、${auditSummary.warning} 项可疑，建议优先检查。`}
                    />
                  )}
                </div>
              )}
            </div>

            {/* 2. 复杂表格入口按钮 */}
            {dynamicTables.length > 0 && (
              <div className="shrink-0 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-2 flex items-center justify-between">
                <div className="flex items-center">
                  <Package size={14} className="mr-2 text-blue-500" />
                  <span className="text-sm font-bold text-gray-800">复杂表格</span>
                  <Tag color="blue" className="ml-2">{dynamicTables.length} 个</Tag>
                  {Object.keys(dynamicTableEdits).filter(id => dynamicTableEdits[id]?.length > 0).length > 0 && (
                    <Tag color="green" className="ml-1">
                      已填 {Object.values(dynamicTableEdits).reduce((s, r) => s + (r?.length || 0), 0)} 行
                    </Tag>
                  )}
                </div>
                <Button
                  type="primary"
                  size="small"
                  icon={<Edit3 size={12} />}
                  onClick={() => setIsTableModalVisible(true)}
                  className="bg-blue-600 hover:bg-blue-700 border-0 rounded-md text-xs"
                >
                  填写复杂表格 ({dynamicTables.length})
                </Button>
              </div>
            )}

            {/* 3. 高危表格提示 */}
            {manualTables.length > 0 && (
              <div className="shrink-0 border-b border-gray-100 px-3 py-1.5 flex items-center gap-2 bg-amber-50/50 text-xs text-amber-700">
                <TriangleAlert size={12} className="shrink-0" />
                <span>检测到 {manualTables.length} 个高危表格（报价/偏离表），AI 禁止触碰，请手动填写</span>
              </div>
            )}

            {/* 4. 普通填空表格 */}
            <div className="flex-1 min-w-0 p-0 relative bg-white">
              <div className="absolute inset-0">
                <Table
                  dataSource={scannedBlanks}
                  columns={blankColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  className="blank-table h-full [&_.ant-table-body]:custom-scrollbar"
                  // 💡 核心优化：固定表头，横向和纵向滚动由 Table 内部接管，横向滚动条永远吸底！
                  scroll={{ x: 980, y: 'calc(100vh - 320px)' }}
                  onRow={(record) => ({
                    onClick: () => scrollToBlank(record.id),
                    className: 'cursor-pointer hover:bg-indigo-50/50 transition-colors'
                  })}
                  rowClassName={(record) => {
                    const filled = manualEdits[record.id];
                    if (highlightBlankId === record.id) return 'bg-indigo-50';
                    return filled ? 'bg-green-50/40' : '';
                  }}
                />
              </div>
            </div>

            {/* 3. 底部操作栏：极简强制单行，横向滑动 */}
            <div className="p-3 bg-white border-t border-gray-200 shrink-0 overflow-x-auto custom-scrollbar shadow-[0_-4px_10px_-2px_rgba(0,0,0,0.05)] z-10">
              <div className="flex flex-nowrap items-center gap-3 min-w-max">
                
                {/* 投标主体 */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold text-gray-700">投标主体:</span>
                  <div className="flex w-[240px] items-center shadow-sm rounded-md overflow-hidden border border-indigo-200 bg-gray-50">
                    <Input
                      placeholder="输入公司名称"
                      value={targetCompany}
                      onChange={(e) => {
                        setTargetCompany(e.target.value);
                        setProductCompanyName(e.target.value);
                      }}
                      className="flex-1 border-none h-8 bg-transparent font-medium text-xs px-2"
                    />
                    <Button
                      type="text"
                      icon={<Database size={12} />}
                      onClick={fetchCompanyList}
                      className="bg-indigo-100 text-indigo-700 h-8 px-2 rounded-none border-l border-indigo-200 font-medium text-xs"
                    >
                      选库
                    </Button>
                  </div>
                </div>

                {/* 招标原文 */}
                <Button 
                  type={tenderContext ? "primary" : "default"}
                  ghost={!!tenderContext}
                  icon={<FileText size={14} />} 
                  onClick={() => setIsContextModalVisible(true)}
                  className={`h-8 px-3 rounded-md font-medium shrink-0 text-xs ${tenderContext ? 'border-indigo-500 text-indigo-600' : 'text-gray-600 border-gray-300 hover:border-indigo-400'}`}
                >
                  {tenderContext ? '已补原文' : '📎 贴入招标项目信息'}
                </Button>

                {/* 产品资质 */}
                <div className="flex w-[240px] items-center shrink-0">
                  <Package size={14} className="text-gray-500 mr-1" />
                  <TreeSelect
                    treeData={productTreeData}
                    value={[...selectedProductIds, ...selectedServiceManualIds]}
                    onChange={handleTreeSelectChange}
                    treeCheckable={true}
                    showCheckedStrategy={TreeSelect.SHOW_CHILD}
                    placeholder="关联产品"
                    loading={loadingProducts}
                    disabled={!productCompanyName.trim() || loadingProducts}
                    className="w-full text-xs"
                    size="small"
                    dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                    allowClear
                    treeDefaultExpandAll
                  />
                </div>

                {Object.keys(matchedTemplateSlots).length > 0 && (
                  <Tag color="purple" className="shrink-0 m-0 text-xs h-7 leading-6">
                    匹配库内容 {Object.keys(matchedTemplateSlots).length} 项
                  </Tag>
                )}

                {/* AI 按钮 */}
                <div className="shrink-0 pl-2 ml-auto">
                  <Button
                    type={!isReviewed ? "primary" : "default"}
                    onClick={handleAutoFill}
                    loading={isFilling}
                    className={`h-8 font-bold px-6 shrink-0 text-xs rounded-md shadow-sm ${!isReviewed ? 'bg-indigo-600 hover:bg-indigo-700 border-0 text-white' : 'border-gray-300 text-gray-700'}`}
                  >
                    {!isReviewed ? '✨ AI 自动填写' : '重新 AI 填写'}
                  </Button>
                </div>

              </div>
            </div>
          </div>
        </div>

        {isFilling && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-2xl flex flex-col items-center w-[min(92vw,500px)]">
              <Cpu size={40} className="text-indigo-500 mb-6 animate-pulse" />
              <h3 className="text-lg font-bold text-gray-800 mb-2">AI 正在分析并填写...</h3>
              <p className="text-gray-500 text-sm mb-4">
                正在结合知识库为 {scannedBlanks.length} 处空白生成填写内容
              </p>
              <Spin size="large" />
            </div>
          </div>
        )}

        <Modal
          title="选择投标主体"
          open={isCompanyModalVisible}
          onCancel={() => setIsCompanyModalVisible(false)}
          onOk={confirmCompanySelection}
          okText="确认选择"
          cancelText="取消"
          okButtonProps={{ disabled: !tempSelectedCompany && !tempKbName }}
          centered
          width={640}
        >
          {fetchingCompanies ? (
            <div className="flex flex-col items-center py-12"><Spin /></div>
          ) : companyProfiles.length === 0 && companyList.length === 0 ? (
            <Empty description="暂无可选主体，请先在「投标主体库」或「知识库」中添加" />
          ) : (
            <div className="max-h-[60vh] overflow-y-auto space-y-5 pr-1">
              {companyProfiles.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-indigo-600 mb-2 tracking-wide">
                    🏢 结构化主体（{companyProfiles.length}）—— 选中后将注入完整企业档案
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {companyProfiles.map((c) => (
                      <div
                        key={c.id}
                         onClick={() => {
                           setTempSelectedCompany(prev => prev?.id === c.id ? null : c);
                         }}
                        className={`p-3 border rounded-xl cursor-pointer transition-all ${tempSelectedCompany?.id === c.id ? 'border-indigo-400 bg-indigo-50 shadow-sm' : 'border-gray-100 hover:bg-indigo-50 hover:border-indigo-200'}`}
                      >
                        <div className="flex items-center space-x-2 mb-1">
                          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-xs shadow">🏢</div>
                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-gray-800 text-sm truncate">{c.company_name}</div>
                            {c.company_type && <span className="text-xs text-gray-400">{c.company_type}</span>}
                          </div>
                          {tempSelectedCompany?.id === c.id && (
                            <span className="text-indigo-500 text-xs font-bold">✓ 已选</span>
                          )}
                        </div>
                        {c.uscc && <div className="text-xs text-gray-500 truncate">信用代码：{c.uscc}</div>}
                        {c.legal_rep_name && <div className="text-xs text-gray-500 truncate">法人：{c.legal_rep_name}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {companyProfiles.length > 0 && companyList.length > 0 && (
                <div className="border-t border-gray-100" />
              )}

              {companyList.length > 0 && (
                <div>
                  <div className="text-xs font-bold text-green-600 mb-2 tracking-wide">
                    📁 知识库分类（{companyList.length}）—— 选中后关联知识库文档
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {companyList.map((name) => (
                      <div
                        key={name}
                         onClick={() => {
                           setTempKbName(prev => prev === name ? '' : name);
                         }}
                        className={`p-3 border rounded-xl cursor-pointer transition-all flex items-center space-x-2 ${tempKbName === name ? 'border-green-400 bg-green-50 shadow-sm' : 'border-gray-100 hover:bg-green-50 hover:border-green-200'}`}
                      >
                        <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center text-sm">📁</div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-gray-700 text-sm truncate">{name}</div>
                          <div className="text-xs text-gray-400">知识库分类</div>
                        </div>
                        {tempKbName === name && (
                          <span className="text-green-500 text-xs font-bold">✓ 已选</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(tempSelectedCompany || tempKbName) && (
                <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
                  <div className="font-bold text-gray-700 mb-1">当前选择：</div>
                  {tempSelectedCompany && (
                    <div>🏢 结构化主体：<b>{tempSelectedCompany.company_name}</b>（完整档案将注入 AI 上下文）</div>
                  )}
                  {tempKbName && (
                    <div>📁 知识库分类：<b>{tempKbName}</b>（Dify 将检索关联文档）</div>
                  )}
                </div>
              )}
            </div>
          )}
        </Modal>

        <Modal
          title={<div className="font-bold text-lg text-gray-800 flex items-center"><FileText className="mr-2 text-indigo-500" size={20}/>补充招标原文要求</div>}
          open={isContextModalVisible}
          onOk={() => setIsContextModalVisible(false)}
          onCancel={() => setIsContextModalVisible(false)}
          okText="确认保存"
          cancelText="取消"
          width={860}
          centered
          styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
        >
          <div className="py-2">
            <div className="text-sm text-gray-600 mb-4 bg-amber-50 p-3 rounded-lg border border-amber-200 leading-relaxed">
              💡 <b>强烈建议：</b>上传招标文件或粘贴关键要求后，<b>请删除无关页内容</b>（如通用条款、免责声明等），仅保留项目概况、技术参数、评分标准等核心内容。<br/>
              <span className="text-amber-700">内容越精简，AI 填报越准确。</span>
            </div>

            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-700 text-sm">招标上下文内容</span>
                {tenderContext && (
                  <span className="text-xs text-gray-400">
                    {tenderContext.length > 1000
                      ? `${(tenderContext.length / 1000).toFixed(1)}k 字`
                      : `${tenderContext.length} 字`}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {tenderContext && (
                  <Button
                    size="small"
                    danger
                    icon={<Trash2 size={14} />}
                    onClick={() => {
                      setTenderContext('');
                      message.success('已清空，可重新粘贴或上传');
                    }}
                  >
                    清空
                  </Button>
                )}
                <input
                  type="file"
                  ref={tenderFileInputRef}
                  className="hidden"
                  onChange={handleTenderFileUpload}
                  accept=".pdf,.doc,.docx"
                />
                <Button
                  size="small"
                  type="dashed"
                  icon={<UploadCloud size={14} />}
                  loading={isExtractingTender}
                  onClick={() => tenderFileInputRef.current?.click()}
                  className="text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                >
                  上传文件自动提取
                </Button>
              </div>
            </div>

            <Input.TextArea
              value={tenderContext}
              onChange={(e) => setTenderContext(e.target.value)}
              placeholder={"请上传文件自动提取，或手动粘贴文本。\n\n例如：\n本项目名称为《2026年邮件系统采购项目》\n项目编号：GD-2026-001\n采购人：某某局\n预算金额：100万元\n交货时间：合同签订后30日内..."}
              className="w-full p-4 text-sm leading-relaxed custom-scrollbar rounded-xl border-gray-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all"
              style={{ resize: 'vertical', minHeight: '420px' }}
              autoSize={{ minRows: 18, maxRows: 35 }}
            />
          </div>
        </Modal>

        {/* ===== 复杂表格填写弹窗 ===== */}
        <Modal
          title={
            <div className="flex items-center gap-2">
              <Package size={16} className="text-blue-500" />
              <span>填写复杂表格</span>
              <Tag color="blue">{dynamicTables.length} 个表格</Tag>
            </div>
          }
          open={isTableModalVisible}
          onCancel={() => setIsTableModalVisible(false)}
          width="92vw"
          styles={{ body: { maxHeight: '80vh', overflowY: 'auto' } }}
          footer={[
            <Button key="close" onClick={() => setIsTableModalVisible(false)}>
              关闭
            </Button>,
            <Button
              key="confirm"
              type="primary"
              className="bg-blue-600 hover:bg-blue-700 border-0"
              onClick={() => {
                const filledCount = Object.values(dynamicTableEdits).filter(r => r?.length > 0).length;
                setIsTableModalVisible(false);
                if (filledCount > 0) {
                  message.success(`已配置 ${filledCount} 个表格数据，导出时将自动填入`);
                }
              }}
            >
              确认
            </Button>,
          ]}
        >
          <div className="space-y-4 max-h-[60vh] overflow-auto custom-scrollbar pr-1">
            {dynamicTables.map(dt => {
              const currentRows = dynamicTableEdits[dt.tableId] || [];
              const selectedNames = currentRows.map(r => r._personName).filter(Boolean);
              const ts = tableStructures.find(s => s.tableId === dt.tableId);
              const cells2d = (() => {
                if (!ts || !ts.cells) return null;
                const rows = {};
                ts.cells.forEach(c => {
                  if (c.rowSpan === 0 || c.colSpan === 0) return;
                  if (!rows[c.row]) rows[c.row] = [];
                  rows[c.row].push(c);
                });
                return Object.keys(rows).sort((a, b) => a - b).map(k => rows[k].sort((a, b) => a.col - b.col));
              })();

              // 处理单元格编辑
              const handleCellEdit = (rowIndex, header, value) => {
                setDynamicTableEdits(prev => {
                  const rows = [...(prev[dt.tableId] || [])];
                  if (rows[rowIndex]) {
                    rows[rowIndex] = { ...rows[rowIndex], [header]: value };
                  }
                  return { ...prev, [dt.tableId]: rows };
                });
              };

              // 处理行删除
              const handleRowDelete = (rowIndex) => {
                const row = currentRows[rowIndex];
                const personName = row._personName;
                const positionName = row._positionName;

                // 清空该行数据（保持位置）
                setDynamicTableEdits(prev => {
                  const rows = [...(prev[dt.tableId] || [])];
                  rows[rowIndex] = {}; // 清空该位置
                  return { ...prev, [dt.tableId]: rows };
                });

                // 检查该人员+职位是否还有其他行
                const hasOtherRows = currentRows.some((r, i) => i !== rowIndex && r._personName === personName && r._positionName === positionName);
                
                if (!hasOtherRows) {
                  // 移除记录
                  setSelectedPersonRoles(prev => {
                    const newSelections = { ...(prev[dt.tableId] || {}) };
                    delete newSelections[personName];
                    return { ...prev, [dt.tableId]: newSelections };
                  });
                  message.success(`已删除 ${personName} - ${positionName} 的所有数据`);
                } else {
                  message.success('已删除该行');
                }
              };

              const previewColumns = [
                // 职位列（新增）
                {
                  title: '职位',
                  dataIndex: '_positionName',
                  key: '_positionName',
                  width: 120,
                  fixed: 'left',
                  render: (text) => <span className="font-medium text-blue-600">{text}</span>
                },
                // 原有表头列（可编辑）
                ...dt.headers.map(h => ({
                  title: h,
                  dataIndex: h,
                  key: h,
                  width: 150,
                  render: (text, record, index) => (
                    <Input.TextArea
                      value={text || ''}
                      onChange={(e) => handleCellEdit(index, h, e.target.value)}
                      autoSize={{ minRows: 1, maxRows: 4 }}
                      className="text-xs"
                    />
                  )
                })),
                // 操作列
                {
                  title: '操作',
                  key: 'action',
                  width: 80,
                  fixed: 'right',
                  render: (_, record, index) => (
                    <Popconfirm
                      title="确定删除该行？"
                      description="删除后无法恢复"
                      onConfirm={() => handleRowDelete(index)}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<Trash2 size={14} />}
                      />
                    </Popconfirm>
                  )
                }
              ];

              return (
                <div key={dt.tableId} className="border border-blue-200 rounded-lg overflow-hidden">
                  <div className="bg-blue-50 px-4 py-2.5 border-b border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-bold text-gray-800">
                          📋 {dt.anchorContext || `表格 ${dt.tableId + 1}`}
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          表头: {dt.headers.join(' | ')} · 原始 {dt.rowCount} 行
                        </div>
                      </div>
                      <Tag color={selectedNames.length > 0 ? 'green' : 'default'}>
                        {selectedNames.length > 0 ? `${currentRows.length} 行数据` : '未填写'}
                      </Tag>
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    {/* 表格预览 + 填充值编辑 一体化 */}
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-700 mb-2 flex items-center justify-between">
                        <span>📄 {dt.anchorContext || `表格 ${dt.tableId + 1}`}</span>
                        {currentRows.length > 0 && (
                          <span className="text-green-600 font-normal">{currentRows.length} 行数据已填入</span>
                        )}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse border border-gray-300 text-xs">
                          <tbody>
                            {/* 新渲染逻辑：空白行可编辑，填充数据替换对应位置 */}
                            {cells2d ? (
                              <>
                                {cells2d.map((row, rowIndex) => {
                                  // 第0行是表头，直接渲染
                                  if (rowIndex === 0) {
                                    return (
                                      <tr key={`header-${rowIndex}`}>
                                        {row.map((cell, cellIndex) => (
                                          <td
                                            key={cellIndex}
                                            rowSpan={cell.rowSpan || 1}
                                            colSpan={cell.colSpan || 1}
                                            className="border border-gray-300 px-2 py-1.5 bg-gray-50 font-medium text-gray-700"
                                            style={{
                                              minWidth: '80px',
                                              verticalAlign: 'middle',
                                              textAlign: 'center'
                                            }}
                                          >
                                            {cell.text || ''}
                                          </td>
                                        ))}
                                        {/* 表头增加操作列 */}
                                        <td className="border border-gray-300 px-2 py-1.5 bg-gray-50 font-medium text-gray-700 w-10 text-center">
                                          操作
                                        </td>
                                      </tr>
                                    );
                                  }

                                  // 数据行：检查该位置是否有填充数据
                                  const dataRowIndex = rowIndex - 1; // 减去表头
                                  const filledData = currentRows[dataRowIndex];
                                  const templateCells = cells2d.length > 1 ? cells2d[1] : cells2d[0];

                                  if (filledData) {
                                    // 该位置有填充数据，渲染填充的数据行
                                    return (
                                      <tr key={`filled-${rowIndex}`} className="hover:bg-blue-50/50">
                                        {templateCells.map((cell, cellIdx) => {
                                          const header = cell.headerText || '';
                                          const isBlank = !cell.text || cell.text.trim() === '' || /^[\s\u3000_\-－]+$/.test(cell.text);
                                          const value = filledData[header] ?? '';
                                          
                                          return (
                                            <td
                                              key={cellIdx}
                                              colSpan={cell.colSpan || 1}
                                              className={`border border-gray-300 px-1 py-1 ${
                                                isBlank ? 'bg-white' : 'bg-gray-50 text-gray-500'
                                              }`}
                                              style={{
                                                minWidth: '80px',
                                                verticalAlign: 'middle',
                                                textAlign: 'center'
                                              }}
                                            >
                                              {isBlank ? (
                                                <Input.TextArea
                                                  value={value}
                                                  onChange={(e) => handleCellEdit(dataRowIndex, header, e.target.value)}
                                                  autoSize={{ minRows: 1, maxRows: 4 }}
                                                  className="text-xs"
                                                  placeholder="..."
                                                  bordered={false}
                                                  style={{ background: 'transparent' }}
                                                />
                                              ) : (
                                                cell.text || ''
                                              )}
                                            </td>
                                          );
                                        })}
                                        {/* 删除按钮列 */}
                                        <td className="border border-gray-300 px-1 py-1 w-10 text-center">
                                          <Popconfirm
                                            title="确定删除该行？"
                                            onConfirm={() => handleRowDelete(dataRowIndex)}
                                            okText="确定"
                                            cancelText="取消"
                                          >
                                            <Button type="text" danger size="small" icon={<Trash2 size={12} />} />
                                          </Popconfirm>
                                        </td>
                                      </tr>
                                    );
                                  } else {
                                    // 该位置没有填充数据，渲染空白可编辑行
                                    return (
                                      <tr key={`empty-${rowIndex}`} className="hover:bg-gray-50/50">
                                        {row.map((cell, cellIndex) => {
                                          const header = cell.headerText || '';
                                          const isBlank = !cell.text || cell.text.trim() === '' || /^[\s\u3000_\-－]+$/.test(cell.text);
                                          
                                          return (
                                            <td
                                              key={cellIndex}
                                              rowSpan={cell.rowSpan || 1}
                                              colSpan={cell.colSpan || 1}
                                              className={`border border-gray-300 px-1 py-1 ${
                                                isBlank ? 'bg-white' : 'bg-gray-50 text-gray-500'
                                              }`}
                                              style={{
                                                minWidth: '80px',
                                                verticalAlign: 'middle',
                                                textAlign: 'center'
                                              }}
                                            >
                                              {isBlank ? (
                                                <Input.TextArea
                                                  value=""
                                                  onChange={(e) => {
                                                    // 创建新的空行数据
                                                    setDynamicTableEdits(prev => {
                                                      const rows = [...(prev[dt.tableId] || [])];
                                                      // 确保该位置有数据对象
                                                      if (!rows[dataRowIndex]) {
                                                        rows[dataRowIndex] = {};
                                                      }
                                                      rows[dataRowIndex] = { ...rows[dataRowIndex], [header]: e.target.value };
                                                      return { ...prev, [dt.tableId]: rows };
                                                    });
                                                  }}
                                                  autoSize={{ minRows: 1, maxRows: 4 }}
                                                  className="text-xs"
                                                  placeholder="..."
                                                  bordered={false}
                                                  style={{ background: 'transparent' }}
                                                />
                                              ) : (
                                                cell.text || ''
                                              )}
                                            </td>
                                          );
                                        })}
                                        {/* 空白行的操作列 */}
                                        <td className="border border-gray-300 px-1 py-1 w-10 text-center">
                                          {/* 空白行不显示删除按钮 */}
                                        </td>
                                      </tr>
                                    );
                                  }
                                })}
                              </>
                            ) : (
                              <tr>
                                <td className="border border-gray-300 px-3 py-2 text-gray-400 text-center" colSpan={dt.headers.length || 3}>
                                  表格数据不可用
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      {currentRows.length === 0 && (
                        <div className="text-[10px] text-gray-400 mt-1">请选择人员填充表格</div>
                      )}
                    </div>

                    {/* 两级联动选择器 */}
                    <div className="space-y-3 mb-3">
                      {/* 第一级：选择人员 */}
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-medium text-gray-600 shrink-0 pt-1">选择人员:</span>
                        <div className="flex-1">
                          <Select
                            placeholder="选择人员后，再选择职位..."
                            style={{ width: '100%' }}
                            value={tempPersonSelection[dt.tableId] || undefined}
                            onChange={(personName) => {
                              setTempPersonSelection(prev => ({ ...prev, [dt.tableId]: personName }));
                            }}
                            options={personnelProfiles
                              .filter(p => !isPersonSelected(dt.tableId, p.name))
                              .map(p => ({ value: p.name, label: p.name }))}
                            disabled={personnelProfiles.every(p => isPersonSelected(dt.tableId, p.name))}
                          />
                        </div>
                      </div>

                      {/* 第二级：选择职位 */}
                      {tempPersonSelection[dt.tableId] && (
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-medium text-gray-600 shrink-0 pt-1">选择职位:</span>
                          <div className="flex-1">
                            <Select
                              placeholder="选择该人员的职位..."
                              style={{ width: '100%' }}
                              value={undefined}
                              onChange={async (positionName) => {
                                const personName = tempPersonSelection[dt.tableId];
                                const profile = personnelProfiles.find(p => p.name === personName);
                                if (!profile) return;

                                // 🆕 获取表格填充模式
                                const fillMode = dt.fillMode || 'multi_person';
                                const currentRows = dynamicTableEdits[dt.tableId] || [];

                                // 🆕 汇总表模式：检查是否已满
                                if (fillMode === 'multi_person') {
                                  const emptyRowCount = dt.emptyRowCount || 0;
                                  if (currentRows.length >= emptyRowCount) {
                                    message.warning(`表格只有 ${emptyRowCount} 行，已填满！`);
                                    return;
                                  }
                                }

                                // 🆕 单人简历表模式：只允许选择一个人
                                if (fillMode === 'single_person_detail' && currentRows.length > 0) {
                                  message.warning('该表格只能填写一个人的信息！');
                                  return;
                                }

                                message.loading({ content: `正在智能填充 ${personName} 的数据...`, key: 'smart-fill', duration: 0 });

                                // 查询该人员的附件图片
                                const allImages = [];
                                try {
                                  const { data: attachments } = await supabase
                                    .from('personnel_attachments')
                                    .select('file_url, attachment_type')
                                    .eq('personnel_profile_id', profile.id)
                                    .eq('enabled', true);
                                  if (attachments) {
                                    const imageTypes = ['id_card_front', 'id_card_back', 'degree_certificate', 'qualification_certificate'];
                                    attachments.forEach(att => {
                                      if (imageTypes.includes(att.attachment_type) && att.file_url) {
                                        allImages.push(att.file_url);
                                      }
                                    });
                                  }
                                } catch (err) {
                                  console.warn(`查询人员 ${personName} 附件失败:`, err);
                                }
                                setDynamicTableImages(prev => ({
                                  ...prev,
                                  [dt.tableId]: [...(prev[dt.tableId] || []), ...allImages]
                                }));

                                const newRows = [];

                                try {
                                  // ===== 优先使用 Dify 智能填充 =====
                                  const ts = tableStructures.find(s => s.tableId === dt.tableId);
                                  
                                  // 🆕 根据填充模式决定发送哪些空白单元格
                                  let blankCells = [];
                                  if (fillMode === 'multi_person') {
                                    // 汇总表：只发送下一个要填充的行的空白单元格
                                    const nextRowIndex = currentRows.length + 1;  // 下一行索引（跳过表头）
                                    blankCells = (dt.blankCells || [])
                                      .filter(bc => bc.row === nextRowIndex)
                                      .map(bc => ({
                                        row: bc.row,
                                        col: bc.col,
                                        label: bc.label || '',
                                        headerText: bc.headerText || '',
                                        rowHeader: bc.rowHeader || '',
                                        text: '',
                                      }));
                                  } else {
                                    // 单人简历表：发送所有空白单元格
                                    blankCells = (dt.blankCells || []).map(bc => ({
                                      row: bc.row,
                                      col: bc.col,
                                      label: bc.label || '',
                                      headerText: bc.headerText || '',
                                      rowHeader: bc.rowHeader || '',
                                      text: '',
                                    }));
                                  }

                                  if (blankCells.length > 0) {
                                    const result = await callSmartFill({
                                      tableId: dt.tableId,
                                      tableType: dt.type,
                                      anchorContext: dt.anchorContext,
                                      headers: dt.headers,
                                      blankCells: blankCells,
                                      personData: profile,
                                      positionName,
                                    });

                                    if (result.success && result.fills && result.fills.length > 0) {
                                      if (fillMode === 'multi_person') {
                                        // 🆕 汇总表：只创建一行数据
                                        const rowData = { 
                                          _personName: personName, 
                                          _positionName: positionName,
                                        };
                                        
                                        result.fills.forEach(fill => {
                                          const key = fill.header || dt.headers[fill.col] || `col_${fill.col}`;
                                          if (key && fill.value) {
                                            rowData[key] = fill.value;
                                          }
                                        });
                                        
                                        newRows.push(rowData);
                                        console.log(`✅ [Dify填充-汇总表] ${personName}: 1 行数据`);
                                      } else {
                                        // 🆕 单人简历表：按行分组，创建多行数据
                                        const rowsData = {};
                                        
                                        result.fills.forEach(fill => {
                                          const rowKey = fill.row;
                                          if (!rowsData[rowKey]) {
                                            rowsData[rowKey] = { 
                                              _personName: personName, 
                                              _positionName: positionName,
                                            };
                                          }
                                          
                                          const key = fill.header || dt.headers[fill.col] || `col_${fill.col}`;
                                          if (key && fill.value) {
                                            rowsData[rowKey][key] = fill.value;
                                          }
                                        });

                                        const sortedRows = Object.keys(rowsData)
                                          .sort((a, b) => parseInt(a) - parseInt(b))
                                          .map(rowKey => rowsData[rowKey]);
                                        
                                        newRows.push(...sortedRows);
                                        console.log(`✅ [Dify填充-单人简历表] ${personName}: ${sortedRows.length} 行数据`);
                                      }
                                    } else {
                                      throw new Error('Dify返回空结果');
                                    }
                                  } else {
                                    throw new Error('无空白单元格');
                                  }

                                } catch (difyError) {
                                  // ===== Dify 失败：回退到本地正则 =====
                                  console.warn(`⚠️ [智能填充] 回退到本地正则:`, difyError.message);

                                  const buildRowByRegex = () => {
                                    const row = { _personName: personName, _positionName: positionName };
                                    
                                    // 找到第一个空位置
                                    let insertPosition = currentRows.findIndex(r => !r || Object.keys(r).length === 0);
                                    if (insertPosition === -1) {
                                      insertPosition = currentRows.length;
                                    }
                                    
                                    dt.headers.forEach(header => {
                                      if (/序号/.test(header)) row[header] = (insertPosition + 1).toString(); // 使用实际插入位置
                                      else if (/姓名|名字/.test(header)) row[header] = profile.name || '';
                                      else if (/性别/.test(header)) row[header] = profile.gender || '';
                                      else if (/出生日期|出生年月/.test(header)) row[header] = profile.birth_date ? profile.birth_date.slice(0, 10) : '';
                                      else if (/年龄/.test(header)) {
                                        if (profile.birth_date) {
                                          const birthYear = new Date(profile.birth_date).getFullYear();
                                          const currentYear = new Date().getFullYear();
                                          row[header] = (currentYear - birthYear).toString();
                                        } else {
                                          row[header] = '';
                                        }
                                      }
                                      else if (/学历/.test(header)) row[header] = profile.education || '';
                                      else if (/学位/.test(header)) row[header] = profile.degree || '';
                                      else if (/岗位|职务|职位/.test(header)) row[header] = positionName;
                                      else if (/职称|资格|证书/.test(header)) row[header] = profile.title || '';
                                      else if (/电话|联系/.test(header)) row[header] = profile.phone || '';
                                      else if (/专业/.test(header)) row[header] = profile.major || '';
                                      else if (/院校|学校/.test(header)) row[header] = profile.school || '';
                                      else if (/身份证/.test(header)) row[header] = profile.id_number || '';
                                      else if (/机构|单位/.test(header)) row[header] = profile.organization || '';
                                      else if (/部门/.test(header)) row[header] = profile.department || '';
                                      else if (/拟.*职务|担任.*职务/.test(header)) row[header] = profile.assigned_role || positionName;
                                      else if (/从业|工作年限/.test(header)) row[header] = '10';
                                      else row[header] = '';
                                    });
                                    return row;
                                  };

                                  // 🆕 根据填充模式决定创建几行
                                  if (fillMode === 'multi_person') {
                                    // 汇总表：只创建一行
                                    newRows.push(buildRowByRegex());
                                  } else {
                                    // 单人简历表：根据项目经历创建多行
                                    const experiences = getPositionExperiences(profile, positionName);
                                    const hasProjectColumns = dt.headers.some(h => /项目|业绩|经验/.test(h));

                                    if (hasProjectColumns && experiences.length > 0) {
                                      experiences.forEach((exp, idx) => {
                                        const row = buildRowByRegex();
                                        dt.headers.forEach(header => {
                                          if (/项目名称|工程名称/.test(header)) row[header] = exp.project_name || '';
                                          else if (/时间|年月|起止|日期/.test(header)) row[header] = (exp.time_range && exp.time_range.length === 2) ? `${exp.time_range[0]} 至 ${exp.time_range[1]}` : '';
                                          else if (/角色|担任职务/.test(header)) row[header] = exp.role || '';
                                          else if (/内容|描述|职责/.test(header)) row[header] = exp.description || '';
                                        });
                                        row._experienceIndex = idx;
                                        newRows.push(row);
                                      });
                                    } else {
                                      newRows.push(buildRowByRegex());
                                    }
                                  }
                                }

                                // 🆕 为汇总表模式添加 _rowIndex
                                if (fillMode === 'multi_person') {
                                  newRows.forEach((row, idx) => {
                                    row._rowIndex = currentRows.length + idx + 2; // +2 因为跳过表头（行1）
                                  });
                                }

                                // 更新表格数据：找到第一个空位置插入，而不是追加到末尾
                                setDynamicTableEdits(prev => {
                                  const existingRows = prev[dt.tableId] || [];
                                  const updatedRows = [...existingRows];
                                  
                                  // 找到第一个空位置（undefined或空对象）
                                  let insertIndex = existingRows.findIndex(row => !row || Object.keys(row).length === 0);
                                  
                                  // 如果没有空位置，追加到末尾
                                  if (insertIndex === -1) {
                                    insertIndex = existingRows.length;
                                  }
                                  
                                  // 插入新行数据
                                  newRows.forEach((newRow, idx) => {
                                    updatedRows[insertIndex + idx] = newRow;
                                  });
                                  
                                  return {
                                    ...prev,
                                    [dt.tableId]: updatedRows
                                  };
                                });

                                // 记录已选人员+职位
                                setSelectedPersonRoles(prev => ({
                                  ...prev,
                                  [dt.tableId]: {
                                    ...(prev[dt.tableId] || {}),
                                    [personName]: positionName
                                  }
                                }));

                                // 清空临时选择
                                setTempPersonSelection(prev => ({ ...prev, [dt.tableId]: undefined }));

                                message.success({ content: `已添加 ${personName} - ${positionName}`, key: 'smart-fill' });
                              }}
                              options={(() => {
                                const personName = tempPersonSelection[dt.tableId];
                                const profile = personnelProfiles.find(p => p.name === personName);
                                const positions = getPersonPositions(profile);
                                return positions.map(pos => ({ value: pos, label: pos }));
                              })()}
                            />
                          </div>
                        </div>
                      )}

                      {/* 已选人员+职位列表 */}
                      {Object.keys(selectedPersonRoles[dt.tableId] || {}).length > 0 && (
                        <div className="flex items-start gap-3">
                          <span className="text-xs font-medium text-gray-600 shrink-0 pt-1">已选择:</span>
                          <div className="flex-1 flex flex-wrap gap-2">
                            {Object.entries(selectedPersonRoles[dt.tableId] || {}).map(([personName, positionName]) => (
                              <Tag
                                key={`${personName}-${positionName}`}
                                closable
                                onClose={() => {
                                  // 移除该人员+职位的所有行
                                  setDynamicTableEdits(prev => ({
                                    ...prev,
                                    [dt.tableId]: (prev[dt.tableId] || []).filter(
                                      row => !(row._personName === personName && row._positionName === positionName)
                                    )
                                  }));

                                  // 移除记录
                                  setSelectedPersonRoles(prev => {
                                    const newSelections = { ...(prev[dt.tableId] || {}) };
                                    delete newSelections[personName];
                                    return { ...prev, [dt.tableId]: newSelections };
                                  });

                                  message.success(`已移除 ${personName} - ${positionName}`);
                                }}
                                color="blue"
                              >
                                {personName} - {positionName}
                              </Tag>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                </div>
              );
            })}
          </div>
        </Modal>

      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-[#F8F9FA]">
      <div className="text-center">
        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
        <p className="text-gray-500">未知步骤，请刷新页面重试</p>
        <Button
          type="primary"
          onClick={() => setStep('upload')}
          className="mt-4 bg-indigo-600"
        >
          返回首页
        </Button>
      </div>
    </div>
  );
}
