import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Button, Input, message, Modal, Table, Tag, Empty, Spin, TreeSelect } from 'antd';
import {
  UploadCloud, ArrowLeft, Download, FileText, Cpu, Database, Edit3, Eye, Trash2, Package
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { useSearchParams } from 'react-router-dom';
import { renderAsync } from 'docx-preview';

import { fillDocumentBlanks, scanBlanksWithAI } from '../utils/difyWorkflow';
import { extractTextFromDocument } from '../utils/documentParser';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  scanBlanksFromXml,
  extractDocumentXml,
  generateFilledDocx,
  extractIndexedParagraphs,
  mergeBlanks
} from '../utils/wordBlankFiller';
import { buildTemplateLearningPrompt, matchSlotForBlank } from '../utils/templateLearning';

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
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const [imageUrlMap, setImageUrlMap] = useState({}); // 保存占位符到URL的映射

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
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (urlProjectId && user) {
      loadExistingProject(urlProjectId);
    }
  }, [urlProjectId, user]);

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
          const blanks = JSON.parse(data.framework_content);
          setScannedBlanks(blanks);
        }

        if (data.analysis_report) {
          const edits = JSON.parse(data.analysis_report);
          setManualEdits(edits);
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
          analysis_report: JSON.stringify(manualEdits) 
        }).eq('id', currentProjectId);
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    }, 1500);

    return () => clearTimeout(debounceTimer);
  }, [manualEdits, currentProjectId, step]);

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
      if (!user) return;
      try {
        const [slotRes, assetRes, sampleRes] = await Promise.all([
          supabase
            .from('template_slots')
            .select('*')
            .eq('user_id', user.id)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false }),
          supabase
            .from('template_slot_assets')
            .select('*')
            .eq('user_id', user.id)
            .eq('enabled', true),
          supabase
            .from('template_slot_samples')
            .select('*')
            .eq('user_id', user.id)
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
  }, [user]);

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

    const candidates = Array.from(container.querySelectorAll('span, p, td, th, div, li'))
      .map((node) => ({ node, text: normalizePreviewText(node.textContent) }))
      .filter(({ text }) => text && text.length <= 400);

    scannedBlanks.forEach((blank) => {
      const tokens = getPreviewAnchorTokens(blank);
      if (tokens.length === 0) return;

      let bestNode = null;
      let bestScore = Number.NEGATIVE_INFINITY;

      tokens.forEach((token, tokenIndex) => {
        candidates.forEach(({ node, text }) => {
          if (!text.includes(token)) return;

          const score = token.length * 100 - text.length - tokenIndex * 10;
          if (score > bestScore) {
            bestNode = node;
            bestScore = score;
          }
        });
      });

      if (!bestNode) return;

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
  }, [applyPreviewAnchorStyles, clearPreviewAnchors, getBlankDisplayName, getPreviewAnchorTokens, normalizePreviewText, resolvePreviewBlankId, scannedBlanks, scrollToTable]);

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

    try {
      message.loading({ content: '正在扫描投标文件中的空白位置...', key: 'scan', duration: 0 });

      const { xmlString, zip } = await extractDocumentXml(file);
      setOriginalXml(xmlString);
      setOriginalZip(zip);

      const [regexBlanks, indexedParagraphs] = await Promise.all([
        Promise.resolve(scanBlanksFromXml(xmlString)),
        Promise.resolve(extractIndexedParagraphs(xmlString))
      ]);

      let aiBlanks = [];
      try {
        const nonEmptyParagraphs = indexedParagraphs.filter(p => p.text.length > 0);
        if (nonEmptyParagraphs.length > 0) {
          message.loading({ content: '正则扫描完成，正在调用 AI 进行智能识别...', key: 'scan', duration: 0 });
          aiBlanks = await scanBlanksWithAI(nonEmptyParagraphs);
        }
      } catch (aiError) {
        console.warn('AI 扫描失败，继续使用正则结果:', aiError);
        message.warning({ content: 'AI 扫描失败，仅使用正则识别结果', key: 'scan', duration: 3 });
      }

      const mergedBlanks = mergeBlanks(regexBlanks, aiBlanks);

      if (mergedBlanks.length === 0) {
        message.warning({ content: '未扫描到空白位置，该文件可能不需要填报，或空白格式未被识别。', key: 'scan', duration: 5 });
        setStep('upload');
        setIsScanning(false);
        return;
      }

      setScannedBlanks(mergedBlanks);
      const initialEdits = {};
      mergedBlanks.forEach(b => { initialEdits[b.id] = ''; });
      setManualEdits(initialEdits);

      const fileExtension = '.' + ext;
      const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}${fileExtension}`;
      const filePath = `${user.id}/${safeFileName}`;
      await supabase.storage.from('documents').upload(filePath, file);
      const uploadedFileUrl = `${supabase.supabaseUrl}/storage/v1/object/documents/${filePath}`;

      const { data: project, error } = await supabase.from('bidding_projects').insert({
        user_id: user.id,
        project_name: file.name.replace(/\.[^/.]+$/, ''),
        file_url: uploadedFileUrl,
        framework_content: JSON.stringify(mergedBlanks),
        status: 'processing'
      }).select().single();

      if (!error && project) {
        setCurrentProjectId(project.id);
        window.history.replaceState(null, '', `/create-bid?id=${project.id}`);
      }

      const scanSummary = `扫描完成，共发现 ${mergedBlanks.length} 处待填写位置！`;
      if (aiBlanks.length > 0) {
        message.success({ content: `${scanSummary} (正则: ${regexBlanks.length}, AI: ${aiBlanks.length})`, key: 'scan' });
      } else {
        message.success({ content: scanSummary, key: 'scan' });
      }
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
      
      console.log('🔍 processedResult 最终结果:', processedResult);
      console.log('🔍 processedResult 键:', Object.keys(processedResult));

      const merged = { ...manualEdits };
      for (const blank of scannedBlanks) {
        if (!merged[blank.id] && processedResult[blank.id]) {
          merged[blank.id] = processedResult[blank.id] || '';
        }
      }
      setManualEdits(merged);

      if (currentProjectId) {
        await supabase.from('bidding_projects').update({
          analysis_report: JSON.stringify(merged),
          status: 'completed'
        }).eq('id', currentProjectId);
      }

      message.success({ content: 'AI 填写完成！请核对并手动修正后导出。', key: 'fill' });
      setStep('review');
    } catch (err) {
      console.error('AI 填写失败:', err);
      message.error({ content: 'AI 填写失败: ' + err.message, key: 'fill' });
      setStep('scan');
    } finally {
      setIsFilling(false);
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

      if (codesToResolve.size === 0) {
        console.log('🔍 没有服务手册需要合并，直接下载');
        saveAs(filledBlob, `已填报_${originalFile.name}`);
        message.success({ content: '导出成功！格式 100% 还原原文件。', key: 'export' });
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

      if (Object.keys(dynamicManualUrlMap).length === 0) {
        console.log('⚠️ 未能解析任何服务手册URL，将直接下载（暗号将保留为文本）');
        saveAs(filledBlob, `已填报_${originalFile.name}`);
        message.warning({ content: '导出成功，但未能找到对应的服务手册文件，暗号将保留为文本', key: 'export', duration: 5 });
        return;
      }

      // ===== 调用后端合并接口 =====
      console.log('📡 检测到服务手册映射，开始调用后端合并接口...');
      console.log('📡 请求目标: POST /api/merge-docs (代理 → http://localhost:8003)');

      const formData = new FormData();
      formData.append('file', filledBlob, `filled_${originalFile.name}`);
      formData.append('mapping', JSON.stringify(dynamicManualUrlMap));

      console.log('📡 FormData 构造完成:');
      console.log('  - file:', filledBlob.name, filledBlob.size, 'bytes');
      console.log('  - mapping keys:', Object.keys(dynamicManualUrlMap));

      const response = await fetch('http://192.168.169.107:8003/api/merge-docs', {
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
          content: '网络错误：请确认后端服务已启动在 http://localhost:8003',
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
    {
      title: '定位',
      key: 'locator',
      width: 360,
      render: (_, record) => (
        <div className="leading-snug">
          <div className="text-xs font-medium text-gray-700">
            {record.fieldHint || '未命名字段'}
            <span className="ml-2 text-[11px] text-gray-400">P{record.paraIndex} / 第{record.blankOrdinalInParagraph || 1}空</span>
          </div>
          {matchedTemplateSlots[record.id]?.slot && (
            <div className="mt-1">
              <Tag color="purple" className="text-[10px]">
                模板槽位：{matchedTemplateSlots[record.id].slot.slot_name}
              </Tag>
            </div>
          )}
          <div className="mt-1 text-[11px] text-gray-500 break-all">{record.localContext || record.context}</div>
        </div>
      )
    },
    {
      title: 'AI 填写结果 / 手动修改',
      key: 'value',
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
                onClick={() => { setStep('upload'); setScannedBlanks([]); setManualEdits({}); setTenderContext(''); }}
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
<div className="h-[40vh] xl:h-auto xl:w-[48vw] xl:max-w-[900px] bg-white border-b xl:border-b-0 xl:border-r border-gray-200 flex flex-col shrink-0">
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

          {/* ========== 中间：表格编辑区 ========== */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <div className="bg-white border-b border-gray-100 p-4 shrink-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-base font-bold text-gray-800 flex items-center">
                  <Edit3 size={16} className="mr-2 text-indigo-500" />
                  待填写字段
                  <Tag color="blue" className="ml-2">{scannedBlanks.length} 处</Tag>
                </h3>
                <p className="text-xs text-gray-400">
                  {isReviewed
                    ? 'AI 已完成填写，可直接修改后导出'
                    : '点击任意行 ↔ 左右双向联动定位'}
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-auto min-w-0">
              <Table
                dataSource={scannedBlanks}
                columns={blankColumns}
                rowKey="id"
                pagination={false}
                size="middle"
                className="blank-table"
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

            <div className="p-3 xl:p-4 bg-white border-t border-gray-100 shrink-0 overflow-auto">
              <div className="flex flex-col gap-2.5 xl:gap-3">
                <div className="flex flex-wrap items-center gap-2.5 xl:gap-3">
                  <span className="text-sm font-bold text-gray-700 shrink-0">投标主体：</span>
                  <div className="flex min-w-[260px] flex-1 max-w-[380px] items-center shadow-sm rounded-lg overflow-hidden border border-indigo-200 bg-gray-50">
                    <Input
                      placeholder="输入公司名称"
                      value={targetCompany}
                       onChange={(e) => {
                          setTargetCompany(e.target.value);
                          setProductCompanyName(e.target.value);
                        }}
                      className="flex-1 border-none h-8 xl:h-9 bg-transparent font-medium text-sm"
                    />
                    <Button
                      type="text"
                      icon={<Database size={14} />}
                      onClick={fetchCompanyList}
                      className="bg-indigo-100 text-indigo-700 h-8 xl:h-9 px-2.5 xl:px-3 rounded-none border-l border-indigo-200 font-medium text-xs shrink-0"
                    >
                      从库中选
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 xl:gap-3">
                  <Button 
                    type={tenderContext ? "primary" : "default"}
                    ghost={!!tenderContext}
                    icon={<FileText size={16} />} 
                    onClick={() => setIsContextModalVisible(true)}
                    className={`h-8 xl:h-9 px-3 xl:px-4 rounded-lg font-medium transition-colors shrink-0 text-xs xl:text-sm ${tenderContext ? 'border-indigo-500 text-indigo-600' : 'text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-500'}`}
                  >
                    {tenderContext ? '已补充招标上下文' : '📎 贴入招标原文 (推荐)'}
                  </Button>

                  <div className="flex min-w-[220px] flex-1 max-w-[320px] items-center shrink-0">
                    <Package size={14} className="text-gray-500 mr-1" />
                    <TreeSelect
                      treeData={productTreeData}
                       value={[...selectedProductIds, ...selectedServiceManualIds]}
                       onChange={handleTreeSelectChange}
                      treeCheckable={true}
                      showCheckedStrategy={TreeSelect.SHOW_CHILD}
                      placeholder="关联产品资质"
                      loading={loadingProducts}
                      disabled={!productCompanyName.trim() || loadingProducts}
                      className="w-full min-w-0"
                      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
                      allowClear
                      treeDefaultExpandAll
                    />
                  </div>

                  {Object.keys(matchedTemplateSlots).length > 0 && (
                    <Tag color="purple" className="h-8 leading-7 px-3 rounded-lg">
                      已匹配模板学习槽位 {Object.keys(matchedTemplateSlots).length} 项
                    </Tag>
                  )}

                  <div className="ml-auto shrink-0">
                    {!isReviewed ? (
                      <Button
                        type="primary"
                        size="large"
                        onClick={handleAutoFill}
                        loading={isFilling}
                        className="bg-indigo-600 hover:bg-indigo-700 rounded-xl h-9 xl:h-11 font-bold border-0 px-5 xl:px-8 shadow-md shrink-0 text-xs xl:text-sm"
                      >
                        AI 自动填写
                      </Button>
                    ) : (
                      <Button
                        onClick={handleAutoFill}
                        loading={isFilling}
                        className="rounded-xl h-9 xl:h-11 font-bold px-4 xl:px-6 border-gray-300 text-gray-700 shrink-0 text-xs xl:text-sm"
                      >
                        重新 AI 填写
                      </Button>
                    )}
                  </div>
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
