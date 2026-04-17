const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_BASE || 'http://localhost:8000';

/**
 * 调用后端智能填充接口（用户选人后调用）
 * @param {Object} params
 * @param {number} params.tableId
 * @param {string} params.tableType
 * @param {string} params.anchorContext
 * @param {string[]} params.headers
 * @param {Array} params.blankCells - 空白单元格列表
 * @param {Object} params.personData - 人员库中的完整数据
 * @param {string} params.positionName - 选择的职位名称
 * @param {string} params.tableHtml - 🆕 完整的表格HTML结构
 * @param {string} params.fillMode - 🆕 填充模式：multi_person 或 single_person_detail
 * @returns {Promise<Object>} { tableId, fills: [{row, col, header, value}], success }
 */
export async function callSmartFill({ tableId, tableType, anchorContext, headers, blankCells, personData, positionName, tableHtml, fillMode }) {
  const url = `${BACKEND_API_BASE}/api/intelligent-field-mapping`;

  // 精简人员数据，只发必要字段
  const slimPerson = {
    name: personData.name || '',
    gender: personData.gender || '',
    birth_date: personData.birth_date || '',
    education: personData.education || '',
    degree: personData.degree || '',
    major: personData.major || '',
    school: personData.school || '',
    title: personData.title || '',
    job_title: personData.job_title || '',
    phone: personData.phone || '',
    id_number: personData.id_number || '',
    organization: personData.organization || '',
    department: personData.department || '',
    assigned_role: personData.assigned_role || '',
    custom_fields: personData.custom_fields || {},
  };

  // 精简空白单元格
  const slimBlanks = (blankCells || []).map(bc => ({
    row: bc.row,
    col: bc.col,
    label: bc.label || '',
    headerText: bc.headerText || '',
    rowHeader: bc.rowHeader || '',
    text: bc.text || '',
  }));

  const payload = {
    tableId,
    tableType: tableType || 'unknown',
    anchorContext: anchorContext || '',
    headers: headers || [],
    blankCells: slimBlanks,
    personData: slimPerson,
    positionName: positionName || '',
    tableHtml: tableHtml || '',  // 🆕 传递完整的表格HTML
    fillMode: fillMode || 'multi_person',  // 🆕 传递填充模式
  };

  console.log(`🤖 [智能填充] 调用: 表格${tableId}, 人员=${slimPerson.name}, 职位=${positionName}, 模式=${fillMode}, 空白数=${slimBlanks.length}, HTML长度=${tableHtml?.length || 0}`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    console.log(`✅ [智能填充] 成功: 表格${tableId}, ${result.fills?.length || 0} 个填充值`);
    return result;
  } catch (error) {
    console.error(`❌ [智能填充] 失败:`, error);
    throw error;
  }
}

export default { callSmartFill };
