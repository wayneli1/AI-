const BACKEND_API_BASE = import.meta.env.VITE_BACKEND_API_BASE || 'http://localhost:8000';

export async function parseBidDocx(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BACKEND_API_BASE}/api/parse-bid-docx`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`解析失败: ${errorText}`);
  }

  return response.json();
}

export async function checkBackendHealth() {
  const response = await fetch(`${BACKEND_API_BASE}/health`);
  if (!response.ok) {
    throw new Error('后端服务不可用');
  }
  return response.json();
}
