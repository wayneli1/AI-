// 表格处理相关的工具函数

/**
 * 将新人员的数据行追加到累积表格中（汇总表模式）
 * @param {string} accumulatedHtml - 累积的表格HTML
 * @param {string} newPersonHtml - Dify返回的新人员表格HTML
 * @param {string} personName - 人员姓名（用于日志）
 * @returns {string} 更新后的表格HTML
 */
export const appendPersonRowToTable = (accumulatedHtml, newPersonHtml, personName) => {
  const parser = new DOMParser();
  
  // 解析累积表格
  const accDoc = parser.parseFromString(accumulatedHtml, 'text/html');
  const accTable = accDoc.querySelector('table');
  
  // 解析新人员表格
  const newDoc = parser.parseFromString(newPersonHtml, 'text/html');
  const newTable = newDoc.querySelector('table');
  
  if (!accTable || !newTable) {
    console.error('表格解析失败');
    return accumulatedHtml;
  }
  
// 🐛 修复：动态识别表头行，而不是硬编码取第 1 行
  // 场景：有些表格第一行是跨列的大标题（如"项目团队人员情况"），第二行才是表头
  const newRows = Array.from(newTable.querySelectorAll('tr'));
  let headerRowIndex = 0;
  for (let i = 0; i < newRows.length; i++) {
    const text = newRows[i].textContent.toLowerCase();
    // 检查是否包含表头特征关键词
    if (text.includes('序号') || text.includes('姓名') || text.includes('name')) {
      headerRowIndex = i;
      break;
    }
  }

  const dataRowIndex = headerRowIndex + 1;
  if (dataRowIndex >= newRows.length) {
    console.warn('未找到数据行');
    return accumulatedHtml;
  }
  
  const dataRow = newRows[dataRowIndex];
  
  // 检查是否有实际数据（不是全[空白]）
  const hasData = Array.from(dataRow.querySelectorAll('td')).some(td => {
    const text = td.textContent.trim();
    return text && text !== '[空白]';
  });
  
  if (!hasData) {
    return accumulatedHtml;
  }
  
  // 在累积表格中找到第一个可填充的空行，替换它
  // 🐛 修复：智能识别累积表格的表头行，跳过表头和大标题行
  const accRows = Array.from(accTable.querySelectorAll('tr'));
  let accHeaderRowIndex = 0;
  for (let i = 0; i < accRows.length; i++) {
    const text = accRows[i].textContent.toLowerCase();
    if (text.includes('序号') || text.includes('姓名') || text.includes('name')) {
      accHeaderRowIndex = i;
      break;
    }
  }
  
  let inserted = false;
  
  for (let i = accHeaderRowIndex + 1; i < accRows.length; i++) {  // 跳过表头和大标题
    const row = accRows[i];
    const cells = Array.from(row.querySelectorAll('td'));
    const isBlankRow = cells.every(td => {
      const text = td.textContent.trim();
      if (!text || text === '[空白]') return true;
      // 允许序号列（纯数字），表格中有序号列时该行仍视为可填充的空行
      return /^\d+$/.test(text);
    });
    
    if (isBlankRow) {
      // 替换这一行
      const clonedRow = dataRow.cloneNode(true);
      row.parentNode.replaceChild(clonedRow, row);
      inserted = true;
      break;
    }
  }
  
  if (!inserted) {
    // 如果没有空白行，直接追加到表格末尾
    const clonedRow = dataRow.cloneNode(true);
    accTable.appendChild(clonedRow);
  }
  
  return accTable.outerHTML;
};

/**
 * 获取表格的实际填充模式（优先使用用户手动选择的值）
 * @param {number} tableId - 表格ID
 * @param {object} manualFillModes - 用户手动选择的填充模式
 * @param {array} dynamicTables - 动态表格列表
 * @returns {string} 'multi_person' 或 'single_person_detail'
 */
export const getEffectiveFillMode = (tableId, manualFillModes, dynamicTables) => {
  const table = dynamicTables?.find(t => t.tableId === tableId);
  return manualFillModes?.[tableId] || table?.fillMode || 'multi_person';
};
