// src/utils/ocr.js

const AK = import.meta.env.VITE_BAIDU_OCR_API_KEY;
const SK = import.meta.env.VITE_BAIDU_OCR_SECRET_KEY;

/**
 * 获取百度 OCR access_token（复用）
 */
const getAccessToken = async () => {
  if (!AK || !SK) throw new Error("缺少百度 OCR API 密钥配置！");
  const res = await fetch(`/baidu-api/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("获取鉴权 Token 失败");
  return data.access_token;
};

/**
 * File 对象转 Base64（复用）
 */
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = reject;
});

/**
 * 智能提取图片文字 (调用百度 OCR 高精度版 - Base64直传方案)
 * @param {File} file - 用户上传的文件对象本体，而不是 URL
 * @returns {Promise<string>} - 提取出的纯文本
 */
export const extractTextFromImage = async (file) => {
  try {
    const accessToken = await getAccessToken();
    const base64Data = await fileToBase64(file);

    const ocrResponse = await fetch(`/baidu-api/rest/2.0/ocr/v1/accurate_basic?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `image=${encodeURIComponent(base64Data)}`
    });

    const ocrData = await ocrResponse.json();

    if (ocrData.words_result) {
      return ocrData.words_result.map(item => item.words).join('\n');
    } else {
      throw new Error(ocrData.error_msg || '百度接口未返回识别结果');
    }
  } catch (error) {
    console.error("❌ OCR 识别流程报错:", error);
    throw error;
  }
};

/**
 * 识别身份证反面（国徽面）- 提取有效期
 * 调用百度 OCR 身份证专用接口，返回结构化有效期信息
 * @param {File} file - 身份证反面图片文件
 * @returns {Promise<{ valid_start: string|null, valid_end: string|null, is_permanent: boolean, issue_authority: string|null }>}
 */
export const extractIDCardBack = async (file) => {
  try {
    const accessToken = await getAccessToken();
    const base64Data = await fileToBase64(file);

    const ocrResponse = await fetch(`/baidu-api/rest/2.0/ocr/v1/idcard?access_token=${accessToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `image=${encodeURIComponent(base64Data)}&id_card_side=back&detect_card=true`
    });

    const ocrData = await ocrResponse.json();
    console.log('[身份证OCR] 百度API返回:', JSON.stringify(ocrData, null, 2));

    // 检查错误码（百度错误码可能是数字或字符串）
    if (ocrData.error_code !== undefined && ocrData.error_code !== 0 && ocrData.error_code !== '0') {
      const errMap = {
        '216201': '图片中未检测到身份证，请确保上传的是清晰的身份证反面（国徽面）照片',
        '216202': '身份证图片质量不佳，请重新拍摄',
        '216500': '身份证检测失败，请重试',
        '216600': '身份证识别失败，请重试',
        '216601': '身份证正面照片上传的是反面，请确认图片',
        '216602': '身份证反面照片上传的是正面，请确认图片',
        '17': '百度身份证识别API每日调用次数已达上限，请检查是否已在百度智能云控制台开通「身份证识别」服务',
        '18': '百度身份证识别API调用频率超限，请稍后重试',
        '110': '百度OCR Access Token无效，请检查API密钥配置',
        '111': '百度OCR Access Token过期，请刷新',
      };
      const code = String(ocrData.error_code);
      const friendlyMsg = errMap[code] || `百度API错误(${code}): ${ocrData.error_msg || '未知错误'}`;
      throw new Error(friendlyMsg);
    }

    const result = {
      valid_start: null,
      valid_end: null,
      is_permanent: false,
      issue_authority: null,
    };

    const words = ocrData.words_result || {};
    console.log('[身份证OCR] words_result:', JSON.stringify(words));

    // 日期格式统一：YYYYMMDD / YYYY.MM.DD / YYYY-MM-DD → YYYY-MM-DD
    const normalizeDate = (s) => {
      if (!s) return null;
      const digits = s.replace(/[.\-/]/g, '');
      if (digits.length === 8) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
      }
      return s.replace(/[.\-/]/g, '-');
    };

    // 检查是否有识别结果
    const resultNum = ocrData.words_result_num || 0;
    if (resultNum === 0 || Object.keys(words).length === 0) {
      throw new Error('未能识别身份证信息，请确保上传的是清晰的身份证反面（国徽面）照片');
    }

    // 签发机关
    if (words['签发机关']) {
      result.issue_authority = words['签发机关'].words || null;
    }

    // 百度身份证OCR返回的字段名：
    //   "签发日期": "20150326"  (开始日期，YYYYMMDD格式)
    //   "失效日期": "20350326"  (结束日期，YYYYMMDD格式)
    //   注：部分老版API可能返回"有效期限"字段，格式为"2020.01.15-2040.01.15"
    // 兼容两种返回格式

    // 格式一：签发日期 + 失效日期（百度新版API实际返回）
    if (words['签发日期']) {
      const rawStart = words['签发日期'].words || '';
      if (rawStart) {
        result.valid_start = normalizeDate(rawStart);
      }
    }
    if (words['失效日期']) {
      const rawEnd = words['失效日期'].words || '';
      if (rawEnd) {
        if (rawEnd.includes('长期')) {
          result.is_permanent = true;
          result.valid_end = '9999-12-31';
        } else {
          result.valid_end = normalizeDate(rawEnd);
        }
      }
    }

    // 格式二：有效期限（部分API版本可能返回此字段）作为补充
    if (!result.valid_start && !result.valid_end && words['有效期限']) {
      const periodStr = words['有效期限'].words || '';
      console.log('[身份证OCR] 有效期限原始值:', periodStr);
      if (periodStr) {
        result.is_permanent = periodStr.includes('长期');
        const match = periodStr.match(/(\d{4}[.\-/]?\d{2}[.\-/]?\d{2})\s*[-—–]\s*(.*)/);
        if (match) {
          result.valid_start = normalizeDate(match[1]);
          const endPart = match[2].trim();
          if (endPart.includes('长期')) {
            result.is_permanent = true;
            result.valid_end = '9999-12-31';
          } else {
            const endMatch = endPart.match(/(\d{4}[.\-/]?\d{2}[.\-/]?\d{2})/);
            if (endMatch) {
              result.valid_end = normalizeDate(endMatch[1]);
            }
          }
        }
      }
    }

    console.log('[身份证OCR] 解析结果:', result);

    return result;
  } catch (error) {
    console.error("❌ 身份证反面识别报错:", error);
    throw error;
  }
};