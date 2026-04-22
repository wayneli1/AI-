const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_BASE || 'http://localhost:8000';

export async function parseBidDocx(file) {
  const formData = new FormData();
  formData.append('file', file);

  const url = `${BACKEND_API_BASE}/api/parse-bid-docx`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });


  if (!response.ok) {
    const errorText = await response.text();
    console.error('🚀 [backendApi] 请求失败:', response.status, errorText);
    throw new Error(`解析失败: ${errorText}`);
  }

  const result = await response.json();
  return result;
}

export async function checkBackendHealth() {
  const response = await fetch(`${BACKEND_API_BASE}/health`);
  if (!response.ok) {
    throw new Error('后端服务不可用');
  }
  return response.json();
}

/**
 * 导出填充后的Word文档（新架构：后端处理）
 * 
 * @param {File} templateFile - 原始Word模板文件
 * @param {Array} normalBlanks - 普通填空数据 [{paraIndex, originalText, filledText}]
 * @param {Array} dynamicTables - 动态表格数据（可选）
 * @param {Object} mapping - 附件URL映射（可选）
 * @returns {Promise<Blob>} - 填充后的Word文档Blob
 */
export async function exportFilledDocument(templateFile, normalBlanks = [], dynamicTables = [], mapping = {}) {
  const formData = new FormData();
  formData.append('file', templateFile);
  formData.append('normal_blanks', JSON.stringify(normalBlanks));
  formData.append('dynamic_tables', JSON.stringify(dynamicTables));
  formData.append('mapping', JSON.stringify(mapping));

  const url = `${BACKEND_API_BASE}/api/fill-blanks`;

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });


  if (!response.ok) {
    const errorText = await response.text();
    console.error('📤 [exportFilledDocument] 请求失败:', response.status, errorText);
    throw new Error(`导出失败: ${errorText}`);
  }

  const blob = await response.blob();
  return blob;
}
