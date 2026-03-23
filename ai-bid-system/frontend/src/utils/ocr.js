// src/utils/ocr.js

const AK = import.meta.env.VITE_BAIDU_OCR_API_KEY;
const SK = import.meta.env.VITE_BAIDU_OCR_SECRET_KEY;

/**
 * 智能提取图片文字 (调用百度 OCR 高精度版 - Base64直传方案)
 * @param {File} file - 用户上传的文件对象本体，而不是 URL
 * @returns {Promise<string>} - 提取出的纯文本
 */
export const extractTextFromImage = async (file) => {
  if (!AK || !SK) throw new Error("缺少百度 OCR API 密钥配置！");

  try {
    // 1. 获取通行证 Token
    const tokenResponse = await fetch(`/baidu-api/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`);
    const tokenData = await tokenResponse.json();
    if (!tokenData.access_token) throw new Error("获取鉴权 Token 失败");
    const accessToken = tokenData.access_token;

    // 2. 将本地 File 对象转换为 Base64 字符串
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // 百度只需要逗号后面的纯编码部分，不需要前面的 data:image/jpeg;base64,
        const base64Str = reader.result.split(',')[1];
        resolve(base64Str);
      };
      reader.onerror = (error) => reject(error);
    });

    // 3. 把庞大的 Base64 直接塞进请求体发给百度
    const ocrResponse = await fetch(`/baidu-api/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      // 注意：这里用的是 image= ，而不是 url= 了！
      body: `image=${encodeURIComponent(base64Data)}`
    });

    const ocrData = await ocrResponse.json();

    // 4. 解析结果
    if (ocrData.words_result) {
      const fullText = ocrData.words_result.map(item => item.words).join('\n');
      console.log("✅ OCR 提取成功，共提取", fullText.length, "个字符");
      return fullText;
    } else {
      throw new Error(ocrData.error_msg || '百度接口未返回识别结果');
    }
  } catch (error) {
    console.error("❌ OCR 识别流程报错:", error);
    throw error;
  }
};