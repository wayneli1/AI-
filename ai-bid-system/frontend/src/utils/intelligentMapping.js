/**
 * 智能字段映射工具
 * 调用后端 Dify 工作流进行 AI 驱动的字段映射
 */

const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_BASE || 'http://localhost:8000';

/**
 * 人员库字段定义（与后端保持一致）
 */
export const PERSONNEL_FIELDS_SCHEMA = [
  // 基本信息
  { fieldName: "name", fieldLabel: "姓名", fieldType: "string", fieldPath: "name", description: "人员姓名" },
  { fieldName: "gender", fieldLabel: "性别", fieldType: "string", fieldPath: "gender", description: "性别（男/女）" },
  { fieldName: "birthDate", fieldLabel: "出生日期", fieldType: "date", fieldPath: "birth_date", description: "出生日期" },
  { fieldName: "idNumber", fieldLabel: "身份证号", fieldType: "string", fieldPath: "id_number", description: "身份证号码" },
  { fieldName: "nationality", fieldLabel: "国籍", fieldType: "string", fieldPath: "nationality", description: "国籍" },
  { fieldName: "politicalStatus", fieldLabel: "政治面貌", fieldType: "string", fieldPath: "political_status", description: "政治面貌" },
  
  // 联系方式
  { fieldName: "phone", fieldLabel: "手机号", fieldType: "string", fieldPath: "phone", description: "手机号码" },
  { fieldName: "email", fieldLabel: "邮箱", fieldType: "string", fieldPath: "email", description: "电子邮箱" },
  { fieldName: "address", fieldLabel: "地址", fieldType: "string", fieldPath: "address", description: "联系地址" },
  
  // 教育背景
  { fieldName: "education", fieldLabel: "学历", fieldType: "string", fieldPath: "education", description: "最高学历" },
  { fieldName: "degree", fieldLabel: "学位", fieldType: "string", fieldPath: "degree", description: "学位" },
  { fieldName: "major", fieldLabel: "专业", fieldType: "string", fieldPath: "major", description: "所学专业" },
  { fieldName: "graduationSchool", fieldLabel: "毕业院校", fieldType: "string", fieldPath: "graduation_school", description: "毕业院校" },
  { fieldName: "graduationDate", fieldLabel: "毕业时间", fieldType: "date", fieldPath: "graduation_date", description: "毕业时间" },
  
  // 职业信息
  { fieldName: "jobTitle", fieldLabel: "职务", fieldType: "string", fieldPath: "custom_fields.job_positions[0].title", description: "当前职务" },
  { fieldName: "professionalTitle", fieldLabel: "职称", fieldType: "string", fieldPath: "professional_title", description: "专业技术职称" },
  { fieldName: "department", fieldLabel: "部门", fieldType: "string", fieldPath: "custom_fields.job_positions[0].department", description: "所属部门" },
  { fieldName: "employeeId", fieldLabel: "工号", fieldType: "string", fieldPath: "employee_id", description: "员工工号" },
  { fieldName: "entryDate", fieldLabel: "入职时间", fieldType: "date", fieldPath: "entry_date", description: "入职日期" },
  
  // 资质证书
  { fieldName: "certificates", fieldLabel: "证书", fieldType: "array", fieldPath: "custom_fields.certificates[]", description: "持有的证书列表" },
  { fieldName: "certificateName", fieldLabel: "证书名称", fieldType: "string", fieldPath: "custom_fields.certificates[].name", description: "证书名称" },
  { fieldName: "certificateNumber", fieldLabel: "证书编号", fieldType: "string", fieldPath: "custom_fields.certificates[].number", description: "证书编号" },
  
  // 项目经历
  { fieldName: "projectExperiences", fieldLabel: "项目经历", fieldType: "array", fieldPath: "custom_fields.job_positions[].project_experiences[]", description: "项目经历列表" },
  { fieldName: "projectName", fieldLabel: "项目名称", fieldType: "string", fieldPath: "custom_fields.job_positions[].project_experiences[].project_name", description: "项目名称" },
  { fieldName: "projectRole", fieldLabel: "项目角色", fieldType: "string", fieldPath: "custom_fields.job_positions[].project_experiences[].role", description: "项目角色" },
  { fieldName: "projectStartDate", fieldLabel: "项目开始时间", fieldType: "date", fieldPath: "custom_fields.job_positions[].project_experiences[].start_date", description: "项目开始日期" },
  { fieldName: "projectEndDate", fieldLabel: "项目结束时间", fieldType: "date", fieldPath: "custom_fields.job_positions[].project_experiences[].end_date", description: "项目结束日期" },
  { fieldName: "projectDescription", fieldLabel: "项目描述", fieldType: "string", fieldPath: "custom_fields.job_positions[].project_experiences[].description", description: "项目描述" },
  
  // 技能特长
  { fieldName: "skills", fieldLabel: "技能", fieldType: "array", fieldPath: "custom_fields.skills[]", description: "技能列表" },
  { fieldName: "specialties", fieldLabel: "专业特长", fieldType: "string", fieldPath: "custom_fields.specialties", description: "专业特长" },
  
  // 其他
  { fieldName: "awards", fieldLabel: "获奖情况", fieldType: "array", fieldPath: "custom_fields.awards[]", description: "获奖记录" },
  { fieldName: "remarks", fieldLabel: "备注", fieldType: "string", fieldPath: "remarks", description: "备注信息" }
];

/**
 * 调用后端智能映射接口
 * @param {Object} tableData - 表格数据
 * @param {number} tableData.tableId - 表格ID
 * @param {string} tableData.tableType - 表格类型
 * @param {string} tableData.anchorContext - 表格上下文
 * @param {Array} tableData.headers - 表头
 * @param {Array} tableData.blankCells - 空白单元格列表
 * @returns {Promise<Object>} 映射结果
 */
export async function callIntelligentMapping(tableData) {
  const url = `${BACKEND_API_BASE}/api/intelligent-field-mapping`;
  
  const payload = {
    tableId: tableData.tableId,
    tableType: tableData.tableType || 'unknown',
    anchorContext: tableData.anchorContext || '',
    headers: tableData.headers || [],
    blankCells: tableData.blankCells || [],
    personnelFields: PERSONNEL_FIELDS_SCHEMA
  };
  
  console.log('🤖 [智能映射] 调用后端接口:', url);
  console.log('🤖 [智能映射] 请求数据:', payload);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ [智能映射] 映射成功:', result);
    
    return result;
  } catch (error) {
    console.error('❌ [智能映射] 调用失败:', error);
    throw error;
  }
}

/**
 * 批量调用智能映射
 * @param {Array} tablesData - 多个表格数据
 * @returns {Promise<Array>} 映射结果数组
 */
export async function batchIntelligentMapping(tablesData) {
  const url = `${BACKEND_API_BASE}/api/batch-intelligent-mapping`;
  
  const payload = tablesData.map(td => ({
    tableId: td.tableId,
    tableType: td.tableType || 'unknown',
    anchorContext: td.anchorContext || '',
    headers: td.headers || [],
    blankCells: td.blankCells || [],
    personnelFields: PERSONNEL_FIELDS_SCHEMA
  }));
  
  console.log('🤖 [批量智能映射] 调用后端接口:', url);
  console.log('🤖 [批量智能映射] 表格数量:', tablesData.length);
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ [批量智能映射] 映射成功:', result);
    
    return result.results || [];
  } catch (error) {
    console.error('❌ [批量智能映射] 调用失败:', error);
    throw error;
  }
}

/**
 * 将 Dify 返回的映射结果转换为 cellMap 格式
 * @param {Object} mappingResult - Dify 返回的映射结果
 * @param {Object} tableStructure - 表格结构
 * @returns {Object} cellMap
 */
export function convertMappingToCellMap(mappingResult, tableStructure) {
  const cellMap = {};
  
  // 1. 初始化所有单元格
  if (tableStructure && tableStructure.cells) {
    tableStructure.cells.forEach(cell => {
      const key = `${cell.row}-${cell.col}`;
      cellMap[key] = {
        ...cell,
        isBlank: false,
        label: null,
        mappedField: null,
        mappedFieldPath: null,
        confidence: 'none',
        reasoning: null
      };
    });
  }
  
  // 2. 应用 Dify 的映射结果
  if (mappingResult && mappingResult.mappings) {
    mappingResult.mappings.forEach(mapping => {
      const key = `${mapping.row}-${mapping.col}`;
      if (cellMap[key]) {
        cellMap[key].isBlank = true;
        cellMap[key].label = mapping.label;
        cellMap[key].mappedField = mapping.mappedField;
        cellMap[key].mappedFieldPath = mapping.mappedFieldPath;
        cellMap[key].confidence = mapping.confidence || 'medium';
        cellMap[key].reasoning = mapping.reasoning;
      }
    });
  }
  
  return cellMap;
}

/**
 * 从人员数据中提取字段值（支持复杂路径）
 * @param {Object} person - 人员对象
 * @param {string} fieldPath - 字段路径
 * @returns {any} 字段值
 */
export function extractPersonFieldValue(person, fieldPath) {
  if (!person || !fieldPath) return undefined;
  
  // 处理数组路径（如 custom_fields.job_positions[].project_experiences[]）
  if (fieldPath.includes('[]')) {
    const parts = fieldPath.split('[]');
    let current = person;
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].replace(/^\./, ''); // 移除开头的点
      
      if (part) {
        // 导航到数组字段
        const keys = part.split('.');
        for (const key of keys) {
          if (!current) return undefined;
          current = current[key];
        }
      }
      
      // 如果是数组，取第一个元素或拼接所有元素
      if (Array.isArray(current)) {
        if (i === parts.length - 1) {
          // 最后一层数组：拼接所有值
          return current.map(item => {
            if (typeof item === 'object') {
              return Object.values(item).join(' ');
            }
            return item;
          }).filter(Boolean).join('；');
        } else {
          // 中间层数组：取第一个元素继续
          current = current[0];
        }
      }
    }
    
    return current;
  }
  
  // 普通路径
  return fieldPath.split('.').reduce((current, key) => current?.[key], person);
}

export default {
  callIntelligentMapping,
  batchIntelligentMapping,
  convertMappingToCellMap,
  extractPersonFieldValue,
  PERSONNEL_FIELDS_SCHEMA
};
