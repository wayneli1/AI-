/**
 * 智能表格字段映射引擎
 * 功能：将表格空白单元格的语义标签映射到人员库字段
 */

// 字段映射规则：人员库字段 -> 可能的表格标签
const FIELD_MAPPING_RULES = {
  // 基本信息
  name: ['姓名', '人员姓名', '名字', '拟投入人员', '人员', '投入人员'],
  gender: ['性别'],
  birth_date: ['出生日期', '出生年月', '生日', '出生'],
  age: ['年龄'],
  
  // 教育背景
  education: ['学历', '最高学历', '文化程度', '学历学位'],
  degree: ['学位', '学位证书', '学位情况'],
  school: ['毕业院校', '毕业学校', '院校', '毕业于'],
  major: ['专业', '所学专业', '毕业专业', '专业方向'],
  
  // 职业信息
  title: ['职称', '专业技术职称', '技术职称', '职称等级'],
  job_title: ['职务', '现任职务', '岗位', '现职务'],
  organization: ['工作单位', '现所在机构', '单位', '所在单位', '现单位'],
  department: ['部门', '所在部门', '现部门'],
  
  // 项目相关
  assigned_role: ['拟任职务', '拟担任职务', '在本项目担任职务', '项目职务', '本项目职务', '拟任岗位'],
  work_experience: ['工作经验', '工作年限', '从业年限', '工作时间', '相关工作经验'],
  
  // 联系方式
  phone: ['联系电话', '手机号', '电话', '联系方式', '手机'],
  id_number: ['身份证号', '身份证号码', '证件号码', '身份证'],
  
  // 项目经历字段（用于项目经历表）
  'work_experience[].project_name': ['项目名称', '项目', '工程名称', '参与项目'],
  'work_experience[].role': ['担任角色', '项目角色', '职责', '角色'],
  'work_experience[].time_range': ['起止时间', '时间', '项目时间', '工作时间', '时间段'],
  'work_experience[].description': ['工作内容', '项目描述', '主要工作', '工作职责', '项目内容', '描述']
};

/**
 * 标准化标签文本（去除标点符号和空格）
 */
function normalizeLabel(label) {
  if (!label) return '';
  return label
    .replace(/[：:（）()\s]/g, '')
    .replace(/项：/g, '')
    .trim();
}

/**
 * 智能匹配字段到标签
 * @param {string} label - 空白单元格的语义标签
 * @returns {Object} { field, confidence, originalLabel }
 */
export function matchFieldToLabel(label) {
  if (!label) {
    return { field: null, confidence: 'none', originalLabel: label };
  }

  const normalizedLabel = normalizeLabel(label);
  
  // 1. 精确匹配
  for (const [field, aliases] of Object.entries(FIELD_MAPPING_RULES)) {
    if (aliases.includes(normalizedLabel)) {
      return { field, confidence: 'high', originalLabel: label };
    }
  }
  
  // 2. 包含匹配
  for (const [field, aliases] of Object.entries(FIELD_MAPPING_RULES)) {
    for (const alias of aliases) {
      if (normalizedLabel.includes(alias) || alias.includes(normalizedLabel)) {
        return { field, confidence: 'medium', originalLabel: label };
      }
    }
  }
  
  // 3. 未匹配
  return { field: null, confidence: 'low', originalLabel: label };
}

/**
 * 批量匹配多个标签
 * @param {Array} labels - 标签数组
 * @returns {Array} 匹配结果数组
 */
export function batchMatchFields(labels) {
  return labels.map(label => matchFieldToLabel(label));
}

/**
 * 从嵌套对象中获取值（支持数组路径如 work_experience[].project_name）
 * @param {Object} obj - 数据对象
 * @param {string} path - 字段路径
 * @returns {any} 字段值
 */
export function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  
  // 处理数组路径（如 work_experience[].project_name）
  if (path.includes('[]')) {
    const [arrayField, subField] = path.split('[].');
    const array = obj[arrayField];
    if (Array.isArray(array) && array.length > 0) {
      // 返回第一个项目的字段值，或者拼接所有项目
      return array.map(item => item[subField]).filter(Boolean).join('；');
    }
    return undefined;
  }
  
  // 普通路径
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * 设置嵌套对象的值
 * @param {Object} obj - 数据对象
 * @param {string} path - 字段路径
 * @param {any} value - 要设置的值
 */
export function setNestedValue(obj, path, value) {
  if (!obj || !path) return;
  
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  
  target[lastKey] = value;
}

/**
 * 构建单元格映射表
 * @param {Object} dynamicTable - 动态表格对象
 * @param {Object} tableStructure - 表格结构对象
 * @returns {Object} 单元格映射表 { "row-col": cellInfo }
 */
export function buildCellMapping(dynamicTable, tableStructure) {
  const cellMap = {};
  
  if (!tableStructure || !tableStructure.cells) {
    return cellMap;
  }
  
  // 1. 从 tableStructures 获取所有单元格
  tableStructure.cells.forEach(cell => {
    const key = `${cell.row}-${cell.col}`;
    cellMap[key] = {
      ...cell,
      isBlank: false,
      label: null,
      mappedField: null,
      confidence: 'none'
    };
  });
  
  // 2. 标记空白单元格并映射字段
  if (dynamicTable.blankCells && Array.isArray(dynamicTable.blankCells)) {
    dynamicTable.blankCells.forEach(blank => {
      const key = `${blank.row}-${blank.col}`;
      if (cellMap[key]) {
        const mapping = matchFieldToLabel(blank.label);
        cellMap[key].isBlank = true;
        cellMap[key].label = blank.label;
        cellMap[key].mappedField = mapping.field;
        cellMap[key].confidence = mapping.confidence;
      }
    });
  }
  
  return cellMap;
}

/**
 * 从人员数据自动填充到表格行
 * @param {Object} person - 人员对象
 * @param {string} positionName - 职位名称
 * @param {Object} cellMap - 单元格映射表
 * @param {Array} headers - 表头数组
 * @param {number} templateRowIndex - 模板行索引
 * @returns {Object} 填充后的行数据
 */
export function fillPersonDataToRow(person, positionName, cellMap, headers, templateRowIndex = 1) {
  const rowData = {
    _personName: person.name || '',
    _positionName: positionName || '',
    _personId: person.id || null
  };
  
  // 遍历表头，为每列生成数据
  headers.forEach((header, colIndex) => {
    const key = `${templateRowIndex}-${colIndex}`;
    const cellInfo = cellMap[key];
    
    if (cellInfo && cellInfo.isBlank && cellInfo.mappedField) {
      // 空白单元格：从人员数据中提取
      const value = getNestedValue(person, cellInfo.mappedField);
      rowData[header] = value || '';
    } else if (cellInfo) {
      // 非空白单元格：保留原值
      rowData[header] = cellInfo.text || '';
    } else {
      // 未找到单元格信息
      rowData[header] = '';
    }
  });
  
  return rowData;
}

/**
 * 获取所有空白单元格的映射信息
 * @param {Object} cellMap - 单元格映射表
 * @returns {Array} 空白单元格数组
 */
export function getBlankCellsMappingInfo(cellMap) {
  return Object.entries(cellMap)
    .filter(([_, cell]) => cell.isBlank)
    .map(([key, cell]) => ({
      position: key,
      row: cell.row,
      col: cell.col,
      label: cell.label,
      header: cell.headerText,
      mappedField: cell.mappedField,
      confidence: cell.confidence
    }))
    .sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    });
}

/**
 * 获取映射统计信息
 * @param {Object} cellMap - 单元格映射表
 * @returns {Object} 统计信息
 */
export function getMappingStats(cellMap) {
  const blankCells = Object.values(cellMap).filter(cell => cell.isBlank);
  const mapped = blankCells.filter(cell => cell.mappedField);
  const highConfidence = mapped.filter(cell => cell.confidence === 'high');
  const mediumConfidence = mapped.filter(cell => cell.confidence === 'medium');
  const unmapped = blankCells.filter(cell => !cell.mappedField);
  
  return {
    totalBlanks: blankCells.length,
    mapped: mapped.length,
    unmapped: unmapped.length,
    highConfidence: highConfidence.length,
    mediumConfidence: mediumConfidence.length,
    mappingRate: blankCells.length > 0 ? (mapped.length / blankCells.length * 100).toFixed(1) : 0
  };
}

/**
 * 获取所有可用的字段列表（用于手动映射）
 * @returns {Array} 字段列表
 */
export function getAvailableFields() {
  return Object.keys(FIELD_MAPPING_RULES).map(field => ({
    value: field,
    label: field,
    aliases: FIELD_MAPPING_RULES[field]
  }));
}

export default {
  matchFieldToLabel,
  batchMatchFields,
  getNestedValue,
  setNestedValue,
  buildCellMapping,
  fillPersonDataToRow,
  getBlankCellsMappingInfo,
  getMappingStats,
  getAvailableFields
};
