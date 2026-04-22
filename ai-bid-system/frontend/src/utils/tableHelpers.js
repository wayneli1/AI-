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
  
  // 提取新表格的第1行数据（跳过表头第0行）
  const newRows = Array.from(newTable.querySelectorAll('tr'));
  if (newRows.length < 2) {
    console.error('新表格没有数据行');
    return accumulatedHtml;
  }
  
  const dataRow = newRows[1];  // 第1行是数据行
  
  // 检查是否有实际数据（不是全[空白]）
  const hasData = Array.from(dataRow.querySelectorAll('td')).some(td => {
    const text = td.textContent.trim();
    return text && text !== '[空白]';
  });
  
  if (!hasData) {
    return accumulatedHtml;
  }
  
  // 在累积表格中找到第一个全[空白]的行，替换它
  const accRows = Array.from(accTable.querySelectorAll('tr'));
  let inserted = false;
  
  for (let i = 1; i < accRows.length; i++) {  // 跳过表头
    const row = accRows[i];
    const cells = Array.from(row.querySelectorAll('td'));
    const isBlankRow = cells.every(td => {
      const text = td.textContent.trim();
      return !text || text === '[空白]';
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
