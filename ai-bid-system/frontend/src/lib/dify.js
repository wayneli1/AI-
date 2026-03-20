export async function runDifyAnalysis(file, user_id) {
  const API_BASE = import.meta.env.VITE_DIFY_API_BASE || '/v1';
  const API_KEY = import.meta.env.VITE_DIFY_API_KEY || 'app-SsnDAJZJBp6q3I67dv37eTiP';

  try {
    // 1. 上传文件 (关键修正：这里必须是 /files/upload)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('user', user_id);

    console.log('Dify API 请求 URL:', `${API_BASE}/files/upload`);
    console.log('API Key:', API_KEY);
    
    const uploadResponse = await fetch(`${API_BASE}/files/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      },
      body: formData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('文件上传失败响应:', uploadResponse.status, uploadResponse.statusText, errorText);
      throw new Error(`文件上传失败: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
    }

    const uploadResult = await uploadResponse.json();
    const fileId = uploadResult.id;
    if (!fileId) {
      throw new Error('上传响应中未找到文件 ID');
    }

    // 2. 运行工作流
    const workflowResponse = await fetch(`${API_BASE}/workflows/run`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          tender_file: {
            transfer_method: 'local_file',
            upload_file_id: fileId,
            type: 'document',
          },
        },
        response_mode: 'blocking',
        user: user_id,
      }),
    });

    if (!workflowResponse.ok) {
      const errorText = await workflowResponse.text();
      throw new Error(`工作流运行失败: ${workflowResponse.status} ${workflowResponse.statusText} - ${errorText}`);
    }

    const workflowResult = await workflowResponse.json();
    // 根据说明，返回 outputs 对象（包含 report, framework, checklist）
    return workflowResult.data?.outputs;
  } catch (error) {
    console.error('Dify API 调用失败:', error);
    throw error;
  }
  
}
// 验证标书文件格式和大小
export function validateBidFile(file) {
  if (!file) return { isValid: false, message: '请选择文件' };
  
  const isValidFormat = file.name.match(/\.(pdf|doc|docx)$/i);
  const isLt50M = file.size / 1024 / 1024 <= 50;
  
  if (!isValidFormat) {
    return { isValid: false, message: '只支持 PDF、DOC、DOCX 格式的文件' };
  }
  if (!isLt50M) {
    return { isValid: false, message: '文件大小不能超过 50MB' };
  }
  
  return { isValid: true };
}