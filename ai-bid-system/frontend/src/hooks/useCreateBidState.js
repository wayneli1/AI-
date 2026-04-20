import { useState } from 'react';

/**
 * CreateBid组件的状态管理Hook
 * 整合所有useState声明，避免主组件过于臃肿
 */
export const useCreateBidState = () => {
  const [step, setStep] = useState('upload');
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
  const [imageUrlMap, setImageUrlMap] = useState({});
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
  const [selectedPersonRoles, setSelectedPersonRoles] = useState({});
  const [tempPersonSelection, setTempPersonSelection] = useState({});
  const [filledTableHtmls, setFilledTableHtmls] = useState({});
  const [manualFillModes, setManualFillModes] = useState({});

  return {
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
  };
};
