const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_BASE || 'http://localhost:8000';

export async function parseBidDocx(file) {
  const formData = new FormData();
  formData.append('file', file);

  const url = `${BACKEND_API_BASE}/api/parse-bid-docx`;
  console.log('🚀 [backendApi] 发送请求到:', url);
  console.log('🚀 [backendApi] 文件:', file.name, file.size, 'bytes');

  const response = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  console.log('🚀 [backendApi] 响应状态:', response.status);

  if (!response.ok) {
    const errorText = await response.text();
    console.error('🚀 [backendApi] 请求失败:', response.status, errorText);
    throw new Error(`解析失败: ${errorText}`);
  }

  const result = await response.json();
  console.log('🚀 [backendApi] 响应数据:', {
    success: result.success,
    normalBlanks: result.normalBlanks?.length,
    dynamicTables: result.dynamicTables?.length,
    manualTables: result.manualTables?.length,
    meta: result.meta,
  });
  return result;
}

export async function checkBackendHealth() {
  const response = await fetch(`${BACKEND_API_BASE}/health`);
  if (!response.ok) {
    throw new Error('后端服务不可用');
  }
  return response.json();
}
