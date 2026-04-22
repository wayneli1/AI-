import React, { useRef, useCallback, useEffect, useMemo } from 'react';
import { Alert, Button, Input, message, Modal, Table, Tag, Empty, Spin, TreeSelect, Select, Popconfirm } from 'antd';
import {
  UploadCloud, ArrowLeft, Download, FileText, Cpu, Database, Edit3, Eye, Trash2, Package, ShieldCheck, TriangleAlert
} from 'lucide-react';
import { saveAs } from 'file-saver';
import { useSearchParams } from 'react-router-dom';
import EditableHtmlTable from '../components/EditableHtmlTable';

import { fillDocumentBlanks, reviewFilledBlanksWithAI } from '../utils/difyWorkflow';
import { extractTextFromDocument } from '../utils/documentParser';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  extractDocumentXml,
  filterIgnoredBlanks
} from '../utils/wordBlankFiller';
import { buildTemplateLearningPrompt, matchSlotForBlank } from '../utils/templateLearning';
import { parseBidDocx, exportFilledDocument } from '../utils/backendApi';
import { 
  callSmartFill
} from '../utils/intelligentMapping';

// 导入拆分的模块
import { useCreateBidState } from '../hooks/useCreateBidState';
import { useProductManagement } from '../hooks/useProductManagement';
import { usePreviewPanel } from '../hooks/usePreviewPanel';
import { useProjectLoader } from '../hooks/useProjectLoader';
import {
  deriveAuditFieldHint,
  getRuleSuggestion,
  validateFilledBlanksWithRules,
  mergeAuditResults,
  summarizeAuditResults
} from '../utils/createBidHelpers';
import { appendPersonRowToTable, getEffectiveFillMode } from '../utils/tableHelpers';

export default function CreateBid() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const urlProjectId = searchParams.get('id');

  // 使用状态管理Hook
  const state = useCreateBidState();
  const {
    step, setStep,
    originalFile, setOriginalFile,
    originalZip, setOriginalZip,
    originalXml, setOriginalXml,
    scannedBlanks, setScannedBlanks,
    manualEdits, setManualEdits,
    targetCompany, setTargetCompany,
    isCompanyModalVisible, setIsCompanyModalVisible,
    companyList, setCompanyList,
    fetchingCompanies, setFetchingCompanies,
    companyProfiles, setCompanyProfiles,
    selectedCompany, setSelectedCompany,
    tempSelectedCompany, setTempSelectedCompany,
    tempKbName, setTempKbName,
    tenderContext, setTenderContext,
    isContextModalVisible, setIsContextModalVisible,
    isExtractingTender, setIsExtractingTender,
    selectedProductIds, setSelectedProductIds,
    selectedServiceManualIds, setSelectedServiceManualIds,
    productTreeData, setProductTreeData,
    loadingProducts, setLoadingProducts,
    productCompanyName, setProductCompanyName,
    templateSlots, setTemplateSlots,
    templateSlotAssets, setTemplateSlotAssets,
    templateSlotSamples, setTemplateSlotSamples,
    isScanning, setIsScanning,
    isFilling, setIsFilling,
    isAuditing, setIsAuditing,
    currentProjectId, setCurrentProjectId,
    imageUrlMap, setImageUrlMap,
    auditResults, setAuditResults,
    normalBlanks, setNormalBlanks,
    dynamicTables, setDynamicTables,
    manualTables, setManualTables,
    tableStructures, setTableStructures,
    parseMeta, setParseMeta,
    dynamicTableEdits, setDynamicTableEdits,
    isTableModalVisible, setIsTableModalVisible,
    dynamicTableImages, setDynamicTableImages,
    personnelProfiles, setPersonnelProfiles,
    selectedPersonRoles, setSelectedPersonRoles,
    tempPersonSelection, setTempPersonSelection,
    filledTableHtmls, setFilledTableHtmls,
    manualFillModes, setManualFillModes,
  } = state;

  // 使用产品管理Hook
  const { normalizeProductName, fuzzyMatchPlaceholder, buildPlaceholderRegex } = useProductManagement();

  // 使用预览面板Hook
  const {
    highlightBlankId,
    setHighlightBlankId,
    previewRef,
    previewScrollRef,
    isRenderingPreview,
    previewError,
    isDesktopViewport,
    isResizingPreview,
    previewPanelWidth,
    scrollToBlank,
    handlePreviewResizeStart,
  } = usePreviewPanel(originalFile, step, scannedBlanks, manualEdits);

  // 使用项目加载Hook
  useProjectLoader(
    urlProjectId,
    user,
    currentProjectId,
    step,
    manualEdits,
    dynamicTableEdits,
    dynamicTableImages,
    selectedPersonRoles,
    filledTableHtmls,
    manualFillModes,
    setCurrentProjectId,
    setOriginalFile,
    setOriginalXml,
    setOriginalZip,
    setScannedBlanks,
    setDynamicTables,
    setManualTables,
    setTableStructures,
    setParseMeta,
    setManualEdits,
    setDynamicTableEdits,
    setDynamicTableImages,
    setSelectedPersonRoles,
    setFilledTableHtmls,
    setManualFillModes,
    setAuditResults,
    setStep
  );

  const fileInputRef = useRef(null);
  const tenderFileInputRef = useRef(null);

  /**
   * 获取表格的实际填充模式（优先使用用户手动选择的值）
   */
  const getEffectiveFillModeWrapper = useCallback((tableId) => {
    return getEffectiveFillMode(tableId, manualFillModes, dynamicTables);
  }, [manualFillModes, dynamicTables]);

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
    
    setSelectedProductIds(productIds);
    setSelectedServiceManualIds(serviceManualIds);
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
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
      const parseResult = await parseBidDocx(file);
      
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
      
      // 处理服务手册选择
      const serviceManualAssetIds = [];
      selectedServiceManualIds.forEach(id => {
        if (id.startsWith('manual-')) {
          const idWithoutPrefix = id.substring(7);
          if (idWithoutPrefix.length >= 36) {
            const productId = idWithoutPrefix.substring(0, 36);
            const assetId = idWithoutPrefix.substring(37);
            
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(assetId)) {
              serviceManualAssetIds.push(assetId);
            }
          }
        }
      });

      if ((productUuids.length > 0 || serviceManualAssetIds.length > 0) && user) {
        try {
          let assets = [];
          
          if (serviceManualAssetIds.length > 0) {
            const { data: manualAssets, error: manualError } = await supabase
              .from('product_assets')
              .select('*, products!inner(product_name, version)')
              .in('id', serviceManualAssetIds);
            
            if (manualError) {
              console.error('❌ 查询服务手册资产失败:', manualError);
              throw manualError;
            }
            assets.push(...(manualAssets || []));
          }
          
          if (productUuids.length > 0) {
            const { data: productAssets, error: productError } = await supabase
              .from('product_assets')
              .select('*, products!inner(product_name, version)')
              .in('product_id', productUuids);
            
            if (productError) throw productError;
            assets.push(...(productAssets || []));
          }
          
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

          // 构建提示词
          if (Object.keys(grouped).length > 0) {
            assetPrompt = '\n\n【产品资产库（如需引用产品信息或插入图片，请严格使用以下占位符和文本内容）】\n';
            Object.entries(grouped).forEach(([productLabel, items]) => {
              assetPrompt += `\n--- [产品：${productLabel}] ---\n`;
              
              const images = items.filter(i => i.asset_type === 'image');
              const texts = items.filter(i => i.asset_type === 'text' || i.asset_type === 'document');
              
if (images.length > 0) {
                assetPrompt += '包含图片占位符（如需插入本产品图片，请严格输出此占位符，严禁输出真实链接）：\n';
                images.forEach(img => {
                  const normalizedProductLabel = normalizeProductName(productLabel);
                  const normalizedAssetName = normalizeProductName(img.asset_name);
                  const placeholder = `{{IMG_${normalizedProductLabel}_${normalizedAssetName}}}`;
                  assetPrompt += `- ${placeholder}\n`;
                  if (img.file_url) {
                    localImageUrlMap[placeholder] = img.file_url;
                  }
                });
              }
              
              if (texts.length > 0) {
                assetPrompt += '包含文本资产内容（如需引用产品信息，请参考以下内容）：\n';
                texts.forEach(txt => {
                  const isServiceManual = txt.asset_name && (
                    txt.asset_name.includes('售后服务手册') || 
                    txt.asset_name.includes('服务手册') ||
                    (txt.asset_type === 'document' && txt.file_url && 
                     (txt.file_url.includes('.doc') || txt.file_url.includes('.docx')))
                  );
                  
                  if (isServiceManual && txt.file_url) {
                    let manualName = txt.asset_name;
                    manualName = manualName.replace(/[（）()]/g, '');
                    manualName = manualName.replace(/\d{4,}/g, '');
                    manualName = manualName.replace(/[\s_-]+/g, ' ').trim();
                    
                    const docCode = `[INSERT_DOC:${manualName}]`;
                    assetPrompt += `- [${txt.asset_name}]：文档暗号 - ${docCode}\n`;
                    localManualUrlMap[docCode] = txt.file_url;
                  } else {
                    const contentPreview = txt.text_content && txt.text_content.length > 5000 
                      ? `${txt.text_content.substring(0, 5000)}...(全文共 ${txt.text_content.length} 字，已截断)` 
                      : txt.text_content || '';
                    assetPrompt += `- [${txt.asset_name}]：${contentPreview}\n`;
                  }
                });
              }
            });
          }
          } catch (assetError) {
            console.warn('加载产品资产失败，继续执行:', assetError);
          }
        }
        
        // 保存到状态，供导出时使用
        setImageUrlMap(localImageUrlMap);

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

      const enrichedContext = (structuredProfile ? structuredProfile + '\n' : '') 
        + (tenderContext || '') 
        + (templateLearningPrompt ? `\n${templateLearningPrompt}` : '')
        + assetPrompt;
      
      const result = await fillDocumentBlanks(scannedBlanks, targetCompany, enrichedContext);

      // 处理 AI 返回结果：将占位符替换为真实 URL
      const processedResult = {};
      for (const blankId in result) {
        let value = result[blankId] || '';
        
        // 替换所有图片占位符为真实 URL
        if (value && typeof value === 'string') {
          let replaced = false;
          
          for (const [placeholder, realUrl] of Object.entries(localImageUrlMap)) {
            // 使用模糊匹配
            if (fuzzyMatchPlaceholder(value, placeholder)) {
              const regex = buildPlaceholderRegex(placeholder);
              const newValue = value.replace(regex, realUrl);
              
              if (value !== newValue) {
                value = newValue;
                replaced = true;
              } else {
                value = realUrl;
                replaced = true;
              }
              break;
            } else if (value.includes(placeholder)) {
              value = value.replace(new RegExp(placeholder, 'g'), realUrl);
              replaced = true;
              break;
            }
          }
          // === 新增：如果 LLM 输出了 Markdown 图片格式，提取纯 URL ===
          const mdImgMatch = value.match(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/);
          if (mdImgMatch) {
            value = mdImgMatch[1];
          }
        }
        
        processedResult[blankId] = value;
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

      const merged = { ...manualEdits };
      
      // ===== 🔧 修复：改进合并逻辑，确保所有processedResult的值都被合并 =====
      const scannedBlankIds = new Set(scannedBlanks.map(b => b.id));
      // 策略1：优先合并scannedBlanks中的blanks（正常路径）
      for (const blank of scannedBlanks) {
        if (processedResult[blank.id] !== undefined && processedResult[blank.id] !== null) {
          merged[blank.id] = processedResult[blank.id] || '';
        }
      }
      
      // 策略2：合并processedResult中所有有值的项
      for (const [blankId, value] of Object.entries(processedResult)) {
        if (value !== undefined && value !== null && value !== '') {
          if (!merged[blankId]) {
            merged[blankId] = value;
          }
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

      // 数据完整性验证
      const scannedBlankIds = new Set(scannedBlanks.map(b => b.id));
      const manualEditsKeys = Object.keys(manualEdits);
      
      const orphanedBlanks = manualEditsKeys.filter(id => 
        manualEdits[id] && manualEdits[id].trim() !== '' && !scannedBlankIds.has(id)
      );
      
      if (orphanedBlanks.length > 0) {
        // 静默处理，不影响用户
      }

      message.loading({ content: '正在生成已填报的 Word 文件...', key: 'export', duration: 0 });

      // ===== 新架构：构建 normal_blanks 数据 =====
      const normalBlanksData = scannedBlanks
        .filter(blank => manualEdits[blank.id] && manualEdits[blank.id].trim() !== '')
        .map(blank => ({
          paraIndex: blank.paraIndex,
          originalText: blank.matchText || '',
          filledText: manualEdits[blank.id],
          type: blank.type || '',
          context: blank.context || '',
        }));

      // 从 manualEdits 中提取所有 [INSERT_DOC:xxx] 暗号
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


      // 提取动态表格数据（根据fillMode选择不同的HTML）
      const dynamicTableDataList = Object.keys(filledTableHtmls || {})
        .map(tableId => {
          const fillMode = getEffectiveFillModeWrapper(parseInt(tableId));
          const tableData = filledTableHtmls[tableId];
          
          let filledHtml = '';
          
          if (fillMode === 'multi_person') {
            // 汇总表：使用累积的完整表格
            filledHtml = tableData?.accumulated || '';
          } else {
            // 单人简历表：使用单个表格
            filledHtml = tableData?.single || '';
          }
          
          if (!filledHtml) {
            return null;
          }
          
          return {
            table_id: parseInt(tableId),
            fill_mode: fillMode,
            filled_html: filledHtml,
            append_images_by_person: dynamicTableImages[tableId] || {},
          };
        })
        .filter(item => item && item.filled_html);


      // ===== 如果有服务手册暗号，需要查询 Supabase 构建 mapping =====
      let dynamicManualUrlMap = {};
      
      if (codesToResolve.size > 0) {

        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id')
          .eq('user_id', user.id);

        if (productsError) throw productsError;

        const productIds = (products || []).map(p => p.id);

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

          // 静默过滤结果
        }

        // ===== 用标准化名称模糊匹配暗号与资产 =====
        for (const [fullCode, { name: codeName }] of codesToResolve) {
          const normalizedCodeName = normalizeProductName(codeName);

          let matched = false;
          for (const manual of serviceManuals) {
            let manualName = manual.asset_name;
            manualName = manualName.replace(/[（）()]/g, '');
            manualName = manualName.replace(/\d{4,}/g, '');
            manualName = manualName.replace(/[\s_-]+/g, ' ').trim();
            const normalizedManualName = normalizeProductName(manualName);


            if (normalizedCodeName === normalizedManualName ||
                normalizedManualName.includes(normalizedCodeName) ||
                normalizedCodeName.includes(normalizedManualName)) {
              dynamicManualUrlMap[fullCode] = manual.file_url;
              matched = true;
              break;
            }
          }

          if (!matched) {
            // 未找到匹配资产，静默处理
          }
        }
      }

      // 调用新的后端 API：/api/fill-blanks
      const filledBlob = await exportFilledDocument(
        originalFile,
        normalBlanksData,
        dynamicTableDataList,
        dynamicManualUrlMap
      );

      // 下载文件
      saveAs(filledBlob, `已填报_${originalFile.name}`);
      message.success({ content: '导出成功！格式 100% 还原原文件。', key: 'export' });

    } catch (err) {
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
            <Button
              type="primary"
              icon={<Download size={16} />}
              onClick={handleExportFilledWord}
              className="bg-green-600 hover:bg-green-700 rounded-full px-6 border-0 font-bold"
            >
              导出已填报文件 (.docx)
            </Button>
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
                    {/* 🆕 表格类型选择器 */}
                    <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-700 shrink-0">表格类型:</span>
                        <Select
                          value={getEffectiveFillModeWrapper(dt.tableId)}
                          onChange={(value) => {
                            setManualFillModes(prev => ({ ...prev, [dt.tableId]: value }));
                            message.success(`已设置为${value === 'multi_person' ? '汇总表（多人）' : '单人简历表'}`);
                          }}
                          style={{ width: 200 }}
                          size="small"
                        >
                          <Select.Option value="multi_person">
                            📊 汇总表（多人）
                          </Select.Option>
                          <Select.Option value="single_person_detail">
                            👤 单人简历表
                          </Select.Option>
                        </Select>
                        <span className="text-xs text-gray-500">
                          {getEffectiveFillMode(dt.tableId) === 'multi_person' 
                            ? '可添加多个人员，每人占一行' 
                            : '只能添加一个人员'}
                        </span>
                      </div>
                      {manualFillModes[dt.tableId] && manualFillModes[dt.tableId] !== dt.fillMode && (
                        <div className="text-xs text-orange-600 mt-2">
                          ⚠️ 已手动覆盖系统检测（原检测为: {dt.fillMode === 'multi_person' ? '汇总表' : '单人简历表'}）
                        </div>
                      )}
                    </div>

                    {/* 🆕 新的HTML渲染方式 */}
                    <div className="space-y-4">
                      {/* 未填充时的提示 */}
                      {(!filledTableHtmls[dt.tableId] || Object.keys(filledTableHtmls[dt.tableId]).length === 0) && (
                        <div className="text-sm text-gray-600 mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          💡 请选择人员和职位，然后点击"智能填充"按钮，AI将自动填写表格
                        </div>
                      )}
                      
                      {/* 填充后的表格 */}
                      {filledTableHtmls[dt.tableId] && (
                        <div>
                          <div className="text-xs font-medium text-green-700 mb-2">
                            ✅ AI填充结果
                          </div>
                          <div className="text-xs text-gray-500 mb-2">
                            以下是AI填充后的表格，导出时将自动填入Word文档
                          </div>
                          
                          {/* 显示累积表格（汇总表）或单个表格（单人简历表） */}
                          {(() => {
                            const fillMode = getEffectiveFillModeWrapper(dt.tableId);
                            const tableData = filledTableHtmls[dt.tableId];
                            const displayHtml = fillMode === 'multi_person' 
                              ? tableData?.accumulated 
                              : tableData?.single;
                            
                            if (!displayHtml) return null;
                            
                            return (
                              <div className="mb-4">
                                <div className="text-xs font-medium text-blue-600 mb-1">
                                  📊 {fillMode === 'multi_person' ? '汇总表（所有人员）' : '单人简历表'}
                                </div>
                                <div 
                                  className="border border-green-400 rounded overflow-auto p-2 bg-white filled-table-container"
                                  style={{
                                    maxHeight: '400px'
                                  }}
                                >
                                  <EditableHtmlTable
                                    htmlString={displayHtml}
                                    tableId={dt.tableId}
                                    onHtmlChange={(newHtml) => {
                                      // 更新 filledTableHtmls 状态
                                      setFilledTableHtmls(prev => {
                                        const currentData = prev[dt.tableId];
                                        if (!currentData) return prev;
                                        
                                        return {
                                          ...prev,
                                          [dt.tableId]: {
                                            ...currentData,
                                            // 根据 fillMode 更新对应字段
                                            ...(fillMode === 'multi_person' 
                                              ? { accumulated: newHtml }
                                              : { single: newHtml }
                                            )
                                          }
                                        };
                                      });
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                          
                          {/* 显示已添加的人员列表 */}
                          {filledTableHtmls[dt.tableId]?.byPerson && Object.keys(filledTableHtmls[dt.tableId].byPerson).length > 0 && (
                            <div className="mt-3">
                              <div className="text-xs font-medium text-gray-600 mb-2">已添加人员：</div>
                              <div className="flex flex-wrap gap-2">
                                {Object.keys(filledTableHtmls[dt.tableId].byPerson).map(personName => (
                                  <Tag
                                    key={personName}
                                    closable
                                    onClose={() => {
                                      const fillMode = getEffectiveFillModeWrapper(dt.tableId);
                                      
                                      setFilledTableHtmls(prev => {
                                        const tableData = prev[dt.tableId];
                                        if (!tableData) return prev;
                                        
                                        // 删除该人员
                                        const newByPerson = { ...tableData.byPerson };
                                        delete newByPerson[personName];
                                        
                                        if (Object.keys(newByPerson).length === 0) {
                                          // 如果没有人员了，删除整个表格数据
                                          const newHtmls = { ...prev };
                                          delete newHtmls[dt.tableId];
                                          return newHtmls;
                                        }
                                        
                                        if (fillMode === 'multi_person') {
                                          // 汇总表：需要重新构建累积表格
                                          let rebuiltHtml = dt.tableHtml;
                                          Object.entries(newByPerson).forEach(([name, html]) => {
                                            rebuiltHtml = appendPersonRowToTable(rebuiltHtml, html, name);
                                          });
                                          
                                          return {
                                            ...prev,
                                            [dt.tableId]: {
                                              accumulated: rebuiltHtml,
                                              byPerson: newByPerson
                                            }
                                          };
                                        } else {
                                          // 单人简历表：直接删除
                                          return {
                                            ...prev,
                                            [dt.tableId]: {
                                              single: '',
                                              byPerson: {}
                                            }
                                          };
                                        }
                                      });
                                      
                                      setSelectedPersonRoles(prev => {
                                        const newSelections = { ...(prev[dt.tableId] || {}) };
                                        delete newSelections[personName];
                                        return { ...prev, [dt.tableId]: newSelections };
                                      });
                                       
                                      setDynamicTableImages(prev => {
                                        const tableImages = prev[dt.tableId];
                                        if (!tableImages || !tableImages[personName]) return prev;
                                        const newTableImages = { ...tableImages };
                                        delete newTableImages[personName];
                                        if (Object.keys(newTableImages).length === 0) {
                                          const newImages = { ...prev };
                                          delete newImages[dt.tableId];
                                          return newImages;
                                        }
                                        return { ...prev, [dt.tableId]: newTableImages };
                                      });
                                       
                                      message.success(`已删除 ${personName} 的数据`);
                                    }}
                                  >
                                    {personName} - {selectedPersonRoles[dt.tableId]?.[personName] || '未知职位'}
                                  </Tag>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
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
                                const fillMode = getEffectiveFillModeWrapper(dt.tableId);
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
                                         allImages.push({ url: att.file_url, type: att.attachment_type });
                                       }
                                     });
                                   }
                                } catch (err) {
                                  console.warn(`查询人员 ${personName} 附件失败:`, err);
                                }
                                 setDynamicTableImages(prev => ({
                                   ...prev,
                                   [dt.tableId]: {
                                     ...(prev[dt.tableId] || {}),
                                     [personName]: allImages
                                   }
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
                                      tableHtml: dt.tableHtml || '',  // 🆕 传递完整的表格HTML
                                      fillMode: fillMode,  // 🆕 传递填充模式
                                    });

                                    if (result.success && result.filled_table_html) {
                                      // 🆕 根据fillMode采用不同的存储策略
                                      if (fillMode === 'multi_person') {
                                        // 汇总表：提取当前人员的数据行，追加到累积表格中
                                        setFilledTableHtmls(prev => {
                                          const existingHtml = prev[dt.tableId]?.accumulated || dt.tableHtml;
                                          const newAccumulatedHtml = appendPersonRowToTable(
                                            existingHtml, 
                                            result.filled_table_html,
                                            personName
                                          );
                                          
                                          return {
                                            ...prev,
                                            [dt.tableId]: {
                                              accumulated: newAccumulatedHtml,  // 累积的完整表格
                                              byPerson: {
                                                ...(prev[dt.tableId]?.byPerson || {}),
                                                [personName]: result.filled_table_html  // 保留单个人的HTML（用于删除）
                                              }
                                            }
                                          };
                                        });
                                        
                                      } else {
                                        // 单人简历表：直接存储
                                        setFilledTableHtmls(prev => ({
                                          ...prev,
                                          [dt.tableId]: {
                                            single: result.filled_table_html,
                                            byPerson: { [personName]: result.filled_table_html }
                                          }
                                        }));
                                      }
                                      
                                      message.success(`✅ ${personName} 填充完成`);
                                    } else {
                                      throw new Error('Dify返回空结果或格式错误');
                                    }
                                  } else {
                                    throw new Error('无空白单元格');
                                  }

                                } catch (difyError) {
                                  // ===== Dify 失败：直接报错，不再回退 =====
                                  console.error(`❌ [Dify填充失败]:`, difyError);
                                  message.error(`智能填充失败: ${difyError.message}`);
                                  return;
                                }

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
