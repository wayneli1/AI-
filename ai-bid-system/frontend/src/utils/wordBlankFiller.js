import PizZip from 'pizzip';

function determineFillRole(text) {
  const manualPatterns = [
    /报价|总价|单价|合同价|投标价|费率|偏离度|交货期|质保期/
  ];
  for (const pattern of manualPatterns) {
    if (pattern.test(text)) return 'manual';
  }
  return 'auto';
}

function normalizeProductName(name) {
  if (!name || typeof name !== 'string') return '';
  let normalized = name.replace(/\s*-\s*/g, '-');
  normalized = normalized.replace(/\s+/g, '');
  normalized = normalized.replace(/([a-zA-Z])([\u4e00-\u9fa5])/g, '$1 $2');
  normalized = normalized.replace(/([\u4e00-\u9fa5])([a-zA-Z])/g, '$1 $2');
  normalized = normalized.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  normalized = normalized.replace(/(\d)([a-zA-Z])/g, '$1 $2');
  return normalized.replace(/\s+/g, ' ').trim();
}

function buildPlaceholderRegex(placeholder) {
  const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = escaped.replace(/\\s+/g, '\\\\s*');
  return new RegExp(pattern, 'g');
}

// 💡 核心修复 1：过滤 Fallback 冗余文本，并将 Word 制表符转化为普通空格
function getVisibleTextFromXml(xml) {
  if (!xml) return '';
  
  // 智能XML清理：只删除Fallback，保留Choice
  let cleanXml = xml;
  
  // 调试：记录原始XML长度
  const originalLength = xml.length;
  
  // 💡 改进：使用多次迭代确保所有Fallback被完全移除
  // 方法：迭代直到没有变化为止，处理嵌套的Fallback标签
  
  let iterations = 0;
  const maxIterations = 5;
  let hasFallback = true;
  
  while (iterations < maxIterations && hasFallback) {
    // 使用更精确的正则：匹配 mc:Fallback 标签及其所有内容（包括嵌套情况）
    cleanXml = cleanXml.replace(/<mc:Fallback(?:\s+[^>]*)?>[\s\S]*?<\/mc:Fallback>/gi, '');
    cleanXml = cleanXml.replace(/<mc:Fallback[\s\S]*?\/>/gi, ''); // 处理自闭合的Fallback
    hasFallback = cleanXml.includes('<mc:Fallback', 0) || cleanXml.includes('mc:Fallback', 0);
    iterations++;
  }
  
  // 2. 移除<mc:AlternateContent>标签本身（因为我们已经移除了Fallback，只需清理外壳）
  // 注意：这比之前更保守，不会删除整个块
  cleanXml = cleanXml.replace(/<mc:AlternateContent[^>]*>|<\/mc:AlternateContent>/gi, '');
  cleanXml = cleanXml.replace(/<mc:Choice(?:\s+[^>]*)?>[\s\S]*?<\/mc:Choice>/gi, '');
  cleanXml = cleanXml.replace(/<mc:Choice[^>]*\/>/gi, ''); // 处理自闭合的Choice
  
  // 3. 清理其他不需要的内容
  cleanXml = cleanXml.replace(/<w:del[\s\S]*?>[\s\S]*?<\/w:del>/g, '');
  cleanXml = cleanXml.replace(/<w:ins[\s\S]*?>[\s\S]*?<\/w:ins>/g, '');
  cleanXml = cleanXml.replace(/<w:comment[\s\S]*?>[\s\S]*?<\/w:comment>/g, '');
  
  // 调试：检查清理结果
  if (originalLength > cleanXml.length && originalLength - cleanXml.length > 1000) {
    console.log(`⚡ XML清理: 原始长度 ${originalLength} -> 清理后 ${cleanXml.length}, 减少了 ${originalLength - cleanXml.length} 字符`);
    console.log(`⚡ 清理比例: ${((originalLength - cleanXml.length) / originalLength * 100).toFixed(1)}%`);
    
    // 特别检查是否有重复问题相关的内容
    const originalSample = xml.substring(0, Math.min(500, xml.length));
    const cleanedSample = cleanXml.substring(0, Math.min(500, cleanXml.length));
    
    if (originalSample.includes('承诺人') || originalSample.includes('单位名称')) {
      console.log('🔍 检查清理前后的"承诺人"/"单位名称"相关片段:');
      console.log('  清理前:', originalSample.replace(/\n/g, ' ').substring(0, 300));
      console.log('  清理后:', cleanedSample.replace(/\n/g, ' ').substring(0, 300));
    }
  }

  const textParts = [];
  // 同时匹配普通文本和制表符
  const NODE_REGEX = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab(?:\s[^>]*)?\/>/g;
  let m;
  
  // 调试：检测重复文本
  let lastText = '';
  let duplicateCount = 0;
  let duplicateSamples = [];
  
  while ((m = NODE_REGEX.exec(cleanXml)) !== null) {
    if (m[0].startsWith('<w:tab')) {
      textParts.push('    '); // 将制表符当做 4 个空格提取
      continue;
    }
    
    const text = m[1];
    
    // 检测重复文本
    if (text === lastText && text.trim().length > 2) {
      duplicateCount++;
      if (duplicateCount <= 3 && !duplicateSamples.includes(text)) {
        duplicateSamples.push(text);
        console.warn(`⚠️ getVisibleTextFromXml 检测到重复文本: "${text}"`);
      }
    }
    
    lastText = text;
    textParts.push(text);
  }
  
  if (duplicateCount > 0) {
    console.log(`📊 getVisibleTextFromXml: 总共检测到 ${duplicateCount} 次文本重复`);
  }
  
  // 💡 后处理：使用 Set 去重连续的重复文本
  const dedupedParts = [];
  for (let i = 0; i < textParts.length; i++) {
    const current = textParts[i];
    const next = textParts[i + 1];
    // 如果当前文本和下一个文本完全相同（且不是空格），跳过重复
    if (current === next && current.trim().length > 0) {
      continue;
    }
    dedupedParts.push(current);
  }
  
  return dedupedParts.join('');
}

function buildTableStructureMap(xmlString) {
  const cellInfos = [];
  const tblRegex = /<w:tbl[\s>][\s\S]*?<\/w:tbl>/g;
  let tblMatch;
  let tableIndex = 0;

  while ((tblMatch = tblRegex.exec(xmlString)) !== null) {
    const tblXml = tblMatch[0];
    const tblGlobalOffset = tblMatch.index;
    const verticalMergeTracker = new Map();

    const rowRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
    let rowMatch;
    let rowIndex = 0;
    const columnHeaders = [];

    while ((rowMatch = rowRegex.exec(tblXml)) !== null) {
      const rowXml = rowMatch[0];
      const rowGlobalOffset = tblGlobalOffset + rowMatch.index;

      const tempTcRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
      let tempTcMatch;
      const rowCells = [];
      while ((tempTcMatch = tempTcRegex.exec(rowXml)) !== null) {
         rowCells.push(getVisibleTextFromXml(tempTcMatch[0]).trim());
      }
      const rowHeader = rowCells[0] || '';

      const tcRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
      let tcMatch;
      let colIndex = 0;

      while ((tcMatch = tcRegex.exec(rowXml)) !== null) {
        const tcXml = tcMatch[0];
        const tcGlobalOffset = rowGlobalOffset + tcMatch.index;
        const text = getVisibleTextFromXml(tcXml).trim();
        const vMergeMatch = tcXml.match(/<w:vMerge(?:\s+w:val="(restart|continue)")?\s*\/?>/);
        const vMergeState = vMergeMatch ? (vMergeMatch[1] || 'continue') : null;

        let span = 1;
        const spanMatch = tcXml.match(/<w:gridSpan w:val="(\d+)"/);
        if (spanMatch) span = parseInt(spanMatch[1], 10);

        const cellColumnKey = `${tableIndex}:${colIndex}`;
        if (vMergeState === 'continue' && verticalMergeTracker.has(cellColumnKey)) {
          colIndex += span;
          continue;
        }

        if (vMergeState === 'restart') {
          verticalMergeTracker.set(cellColumnKey, true);
        } else if (!vMergeState) {
          verticalMergeTracker.delete(cellColumnKey);
        }

        if (rowIndex === 0) {
          for(let s=0; s<span; s++) columnHeaders[colIndex + s] = text;
        }

        const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
        let pMatch;
        const cellParagraphs = []; // 收集该单元格的所有段落去重
        
        while ((pMatch = pRegex.exec(tcXml)) !== null) {
          const pLocalOffset = pMatch.index;
          const pGlobalOffset = tcGlobalOffset + pLocalOffset;
          const paraIdx = countParagraphsBefore(xmlString, pGlobalOffset);
          const cellText = getVisibleTextFromXml(pMatch[0]).trim();
          
          cellParagraphs.push({
            paraIndex: paraIdx,
            cellText
          });
        }
        
        // 💡 修复：对于同一个单元格的多个段落，只使用第一个（非空的）段落
        // 避免同一单元格被识别为多个空白
        if (cellParagraphs.length > 0) {
          // 尝试找到第一个非空段落
          let targetPara = cellParagraphs[0];
          for (const para of cellParagraphs) {
            if (para.cellText.trim().length > 0) {
              targetPara = para;
              break;
            }
          }
          
          cellInfos.push({
            paraIndex: targetPara.paraIndex,
            cellXml: tcXml,
            cellText: targetPara.cellText,
            tableIndex,
            rowIndex,
            colIndex,
            headerText: columnHeaders[colIndex] || '',
            rowHeader
          });
        }
        colIndex += span;
      }
      rowIndex++;
    }
    tableIndex++;
  }
  return cellInfos;
}

function buildLocalContext(text, start, end, marker = '【🎯】') {
  if (!text) return '';
  const safeStart = Math.max(0, Math.min(start ?? 0, text.length));
  const safeEnd = Math.max(safeStart, Math.min(end ?? safeStart, text.length));
  const windowStart = Math.max(0, safeStart - 20);
  const windowEnd = Math.min(text.length, safeEnd + 20);
  const prefix = text.slice(windowStart, safeStart);
  const suffix = text.slice(safeEnd, windowEnd);
  return `${prefix}${marker}${suffix}`.replace(/\s+/g, ' ').trim();
}

function inferFieldHint(context, matchText = '') {
  const text = `${context || ''} ${matchText || ''}`;
  const hintPatterns = [
    ['投标人名称', /投标人名称|投标单位|投标人(?!代表|签字)/],
    ['承诺人', /承诺人/],
    ['国家或地区', /国家或地区/],
    ['法定代表人信息', /法定代表人姓名|法定代表人.*身份证|法定代表人/],
    ['被授权人信息', /被授权人|委托代理人|授权代表/],
    ['职务', /职务/],
    ['性别', /性别/],
    ['身份证号码', /身份证号码|身份证号/],
    ['单位名称', /单位名称|公司名称|企业名称|供应商名称/],
    ['地址', /地址|住所|通讯地址/],
    ['电话', /电话|联系电话|联系方式/],
    ['邮编', /邮编|邮政编码/],
    ['开户行', /开户行|开户银行/],
    ['银行账号', /银行账号|账号/],
    ['统一社会信用代码', /统一社会信用代码|信用代码/],
    ['签字', /签字|签名/],
    ['盖章', /盖章|公章|签章/]
  ];

  for (const [hint, pattern] of hintPatterns) {
    if (pattern.test(text)) return hint;
  }

  return '';
}

function enrichBlankMetadata(blanks) {
  const grouped = new Map();

  blanks.forEach((blank) => {
    const key = blank.paraIndex;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(blank);
  });

  grouped.forEach((items) => {
    items.sort((a, b) => {
      const aStart = Number.isInteger(a.textStart) ? a.textStart : (a.index ?? 0);
      const bStart = Number.isInteger(b.textStart) ? b.textStart : (b.index ?? 0);
      return aStart - bStart;
    });

    items.forEach((blank, idx) => {
      const start = Number.isInteger(blank.textStart) ? blank.textStart : (blank.index ?? 0);
      const end = Number.isInteger(blank.textEnd) ? blank.textEnd : start + ((blank.matchText || '').length || 0);
      blank.textStart = start;
      blank.textEnd = end;
      blank.blankOrdinalInParagraph = idx + 1;
      blank.localContext = buildLocalContext(blank.context || '', start, end);
      if (!blank.fieldHint) {
        blank.fieldHint = inferFieldHint(blank.context || '', blank.matchText || '');
      }
    });
  });

  return blanks;
}

function buildCellLabel(cell) {
  if (cell.headerText && cell.rowHeader && cell.headerText !== cell.rowHeader) {
    return `${cell.headerText}（项：${cell.rowHeader}）`;
  }
  if (cell.headerText) return cell.headerText;
  if (cell.rowHeader) return cell.rowHeader;
  return '';
}

function shouldSkipEmptyCellLabel(label) {
  if (!label) return true;

  const normalizedLabel = label.replace(/\s+/g, ' ').trim();
  if (!normalizedLabel) return true;

  const nonReusablePatterns = [
    /^报价项目$/,
    /^报价（元）$/,
    /^总报价（元）$/,
    /^采购报价单$/,
    /^分项报价表$/,
    /^报价明细表$/,
    /^货物名称$/,
    /^规格型号$/,
    /^数量$/,
    /^单位$/,
    /^单价（元）$/,
    /^合计（元）$/,
    /报价（元）（项：/,
    /采购报价单/,
    /分项报价/,
    /明细报价/
  ];

  return nonReusablePatterns.some((pattern) => pattern.test(normalizedLabel));
}

function normalizeInlineFieldLabel(text = '') {
  return String(text)
    .replace(/^\s*\d+(?:\.\d+)*[.、]\s*/, '')
    .replace(/[：:]\s*$/, '')
    .trim();
}

function isLikelyInlineFieldLabel(text = '') {
  const label = normalizeInlineFieldLabel(text);
  if (!label || label.length < 2 || label.length > 120) return false;
  if (/。|；|;|，|,/.test(label)) return false;
  if (/复印件|原件|提供|详见|证明材料|证明文件|说明如下|如下所示|是否|要求|不得|应当|包括/.test(label)) return false;
  return /(?:名称|姓名|单位|地址|电话|邮箱|邮编|账号|代码|编号|日期|期限|时间|内容|版本|型号|系统|平台|网关|软件|硬件|产品|服务|代表人|联系人|供应商|投标人|申请人)/.test(label)
    || /[A-Za-z].*V\d+(?:\.\d+)?/i.test(label)
    || /^[A-Za-z0-9（）()\-\u4e00-\u9fa5]+$/.test(label);
}

function isDocReferenceContext(text) {
  if (!text || typeof text !== 'string') return false;
  return /服务手册|售后服务手册|技术方案|实施方案|产品说明书|白皮书|产品彩页|手册|系统|平台|网关|软件|硬件|产品|版本|V\d+(?:\.\d+)?/i.test(text)
    || isLikelyInlineFieldLabel(text);
}

function isInlineBlankType(type) {
  return ['underscore', 'dash', 'keyword_space', 'brackets', 'placeholder'].includes(type);
}

function shouldAppendAfterAnchor(blank) {
  const hint = blank.fieldHint || '';
  const context = `${blank.context || ''} ${blank.localContext || ''}`;

  if (/签字|签名/.test(hint) || /签字|签名/.test(context)) return false;

  const appendableHints = [
    '投标人名称',
    '投标单位',
    '承诺人',
    '单位名称',
    '法定代表人信息',
    '被授权人信息',
    '职务',
    '地址',
    '电话',
    '邮编',
    '开户行',
    '银行账号',
    '统一社会信用代码'
  ];

  if (appendableHints.includes(hint)) return true;

  return /^【🎯】/.test(blank.localContext || '') && /：|:/.test(blank.context || '');
}

function countParagraphsBefore(xmlString, globalOffset) {
  return (xmlString.substring(0, globalOffset).match(/<w:p[\s>]/g) || []).length;
}

function isImageUrl(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (/^\{\{IMG_.+?\}\}$/.test(v)) return true;
  return /^https?:\/\/.+\.(png|jpg|jpeg|gif|bmp|webp|svg)(\?.*)?$/i.test(v) ||
         /^https?:\/\/.+\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(v) ||
         /^https?:\/\/.*\/storage\/v1\/object\/public\//i.test(v);
}

function isDocumentUrl(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  const docPatterns = [
    /^https?:\/\/.*\.(docx?|pdf|txt)(\?.*)?$/i,
    /^https?:\/\/.*\/storage\/v1\/object\/public\/.*\.(docx?|pdf|txt)/i,
    /^https?:\/\/.*\.supabase\.(co|in)\/storage\/v1\/object\/public\/.*/i
  ];
  return docPatterns.some(pattern => pattern.test(v));
}

function getDisplayTextFromUrl(url, context) {
  if (!url || typeof url !== 'string') return '服务手册';
  if (context && typeof context === 'string') {
    if (context.includes('售后服务手册')) {
      const manualMatch = context.match(/([^：:（）(]+)(?:售后服务手册)/);
      if (manualMatch && manualMatch[1] && manualMatch[1].trim().length > 0) return `${manualMatch[1].trim()}售后服务手册`;
    } else if (context.includes('服务手册')) {
      const manualMatch = context.match(/([^：:（）(]+)(?:服务手册)/);
      if (manualMatch && manualMatch[1] && manualMatch[1].trim().length > 0) return `${manualMatch[1].trim()}服务手册`;
    }
    const productMatch = context.match(/([a-zA-Z0-9\u4e00-\u9fa5]+产品|[a-zA-Z0-9\u4e00-\u9fa5]+系统)/);
    if (productMatch && productMatch[1]) return `${productMatch[1].trim()}售后服务手册`;
  }
  const fileName = url.split('/').pop().split('?')[0];
  const cleanName = fileName.replace(/[_-]/g, ' ').replace(/\.[^/.]+$/, '');
  if (cleanName && cleanName.length > 3 && !cleanName.match(/^[0-9a-f]{32}$/i)) {
    let prettyName = cleanName.replace(/\d{4}[-_]?\d{2}[-_]?\d{2}/g, '').replace(/\d{10,}/g, '').replace(/^[\s_-]+|[\s_-]+$/g, '');
    if (prettyName && prettyName.length > 2) return prettyName;
    return cleanName;
  }
  return '服务手册';
}

function guessImageMime(url) {
  const lower = url.toLowerCase().split('?')[0];
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'image/png';
}

function guessImageExt(mime) {
  const map = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif' };
  return map[mime] || 'png';
}

async function fetchImageAsArrayBuffer(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`图片下载失败: ${url}`);
  const ct = resp.headers.get('content-type') || '';
  const buf = await resp.arrayBuffer();
  let mime = guessImageMime(url);
  if (ct && ct.startsWith('image/')) mime = ct.split(';')[0];
  return { buffer: buf, mime };
}

function buildImageRunXml(rId, cxEmu, cyEmu) {
  return `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cxEmu}" cy="${cyEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${Math.floor(Math.random() * 100000)}" name="injected_image"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="injected.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cxEmu}" cy="${cyEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
}

function buildHyperlinkXml(rId, displayText, url) {
  return `<w:hyperlink r:id="${rId}" w:history="1" w:tooltip="${escapeXml(url)}"><w:r><w:rPr><w:rStyle w:val="Hyperlink"/><w:color w:val="0000FF"/><w:u w:val="single"/></w:rPr><w:t>${escapeXml(displayText)}</w:t></w:r></w:hyperlink>`;
}

function parseRelsXml(relsXml) {
  let maxId = 0;
  const ridRegex = /Id="rId(\d+)"/g;
  let m;
  while ((m = ridRegex.exec(relsXml)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > maxId) maxId = n;
  }
  return { xml: relsXml, maxId };
}

function addRelationship(relsObj, target, type) {
  const newId = ++relsObj.maxId;
  const rId = `rId${newId}`;
  relsObj.xml = relsObj.xml.replace('</Relationships>', `<Relationship Id="${rId}" Type="${type}" Target="${target}"/></Relationships>`);
  return rId;
}

const PX_TO_EMU = 914400 / 96;
function getImageDimensionsEmu(pxWidth, naturalW, naturalH) {
  const cx = Math.round(pxWidth * PX_TO_EMU);
  const ratio = naturalH / naturalW;
  return { cx, cy: Math.round(cx * ratio) };
}

function loadImageNaturalSize(buffer) {
  return new Promise((resolve) => {
    const blob = new Blob([buffer]);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve({ w: 400, h: 300 }); };
    img.src = url;
  });
}

function escapeXml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function scanBlanksFromXml(xmlString) {
  const blanks = [];
  let blankCounter = 0;
  console.log('🔍 [scanBlanksFromXml] 开始扫描XML空白');

  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  let currentParaIndex = 0;

  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const text = getVisibleTextFromXml(paraMatch[0]);

    if (text.trim().length > 0) {
      let m;

      // 识别纯文字贴图提示
      const imagePlaceholderPattern1 = /贴.*(?:复印件|扫描件|照片|图片)处/;
      const imagePlaceholderPattern2 = /(?:复印件|扫描件|证明文件)粘贴处/;
      if ((imagePlaceholderPattern1.test(text) || imagePlaceholderPattern2.test(text)) &&
          !blanks.some(b => b.paraIndex === currentParaIndex && b.type === 'image_placeholder')) {
        blanks.push({
          id: `blank_${++blankCounter}`,
          context: "[图片插入位置：]【🎯】",
          matchText: text,
          index: 0,
          type: 'image_placeholder',
          confidence: 'high',
          paraIndex: currentParaIndex,
          fill_role: 'auto'
        });
      }

      const underscorePattern = /_{3,}/g;
      while ((m = underscorePattern.exec(text)) !== null) {
        if (m[0].length >= 2) {
          blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, textStart: m.index, textEnd: m.index + m[0].length, type: 'underscore', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text), fieldHint: inferFieldHint(text, m[0]) });
        }
      }

      // 文档引用、产品名称等位置经常只给两个下划线，例如：Coremail XT电子邮件系统V6.0：__
      if (isDocReferenceContext(text)) {
        const shortUnderscorePattern = /_{2,}/g;
        while ((m = shortUnderscorePattern.exec(text)) !== null) {
          const alreadyExists = blanks.some(
            (b) => b.paraIndex === currentParaIndex && b.matchText === m[0] && b.index === m.index
          );
          if (!alreadyExists) {
            blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, textStart: m.index, textEnd: m.index + m[0].length, type: 'underscore', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text), fieldHint: inferFieldHint(text, m[0]) });
          }
        }
      }

      const dashPattern = /[-－—─﹣]{3,}/g;
      while ((m = dashPattern.exec(text)) !== null) {
        if (m[0].length >= 3) {
          blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, textStart: m.index, textEnd: m.index + m[0].length, type: 'dash', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text), fieldHint: inferFieldHint(text, m[0]) });
        }
      }

      // 匹配冒号后带有至少 2 个空格/全角空格的空白（得益于我们转化了 tab 符，这里能完美抓取长空格）
      const spacePattern = /([：:])([\s\u3000]{2,})/g;
      while ((m = spacePattern.exec(text)) !== null) {
        const colonStr = m[1];
        const spaceStr = m[2];
        const spaceIndex = m.index + colonStr.length; 
        blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: spaceStr, index: spaceIndex, textStart: spaceIndex, textEnd: spaceIndex + spaceStr.length, type: 'keyword_space', confidence: 'medium', paraIndex: currentParaIndex, fill_role: determineFillRole(text), fieldHint: inferFieldHint(text, spaceStr) });
      }

      // 无冒号但字段名后直接跟随空格的场景，例如：承诺人      、投标人      
      const trailingSpacePattern = /((?:投标人|承诺人|供应商|投标主体|投标单位|申请人|法定代表人|委托代理人|授权代表|联系人|地址|电话|传真|邮编|开户行|银行账号|统一社会信用代码|单位名称))([\s\u3000]{2,})/g;
      while ((m = trailingSpacePattern.exec(text)) !== null) {
        const spaceStr = m[2];
        const spaceIndex = m.index + m[1].length;
        const alreadyExists = blanks.some(
          (b) => b.paraIndex === currentParaIndex && b.matchText === spaceStr && b.index === spaceIndex
        );
        if (!alreadyExists) {
          blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: spaceStr, index: spaceIndex, textStart: spaceIndex, textEnd: spaceIndex + spaceStr.length, type: 'keyword_space', confidence: 'medium', paraIndex: currentParaIndex, fill_role: determineFillRole(text), fieldHint: inferFieldHint(text, spaceStr) });
        }
      }

      // 识别“字段名：”或“产品名：”后面直接为空的场景，例如：单位名称： / Coremail XT电子邮件系统V6.0:
      const colonEndPattern = /^\s*((?:\d+(?:\.\d+)*[.、]\s*)?[^：:\n]{2,120})([：:])\s*$/;
      const colonEndMatch = text.match(colonEndPattern);
      if (colonEndMatch && isLikelyInlineFieldLabel(colonEndMatch[1])) {
        const colonIndex = text.lastIndexOf(colonEndMatch[2]);
        const blankIndex = colonIndex + colonEndMatch[2].length;
        const alreadyExists = blanks.some(
          (b) => b.paraIndex === currentParaIndex && (b.index ?? -1) === blankIndex
        );
        if (!alreadyExists) {
          blanks.push({
            id: `blank_${++blankCounter}`,
            context: text,
            matchText: '',
            index: blankIndex,
            textStart: blankIndex,
            textEnd: blankIndex,
            type: 'keyword_space',
            confidence: 'medium',
            paraIndex: currentParaIndex,
            fill_role: determineFillRole(text),
            fieldHint: inferFieldHint(text, '') || normalizeInlineFieldLabel(colonEndMatch[1])
          });
        }
      }

      const roundBracketPattern = /[（(]\s*(盖章处|签章处|盖章|签字|请填写[^）)]*|待补充|待定|填写[^）)]*|请盖章)\s*[)）]/g;
      while ((m = roundBracketPattern.exec(text)) !== null) {
        blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, textStart: m.index, textEnd: m.index + m[0].length, type: 'brackets', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text), fieldHint: inferFieldHint(text, m[0]) });
      }

      const squareBracketPattern = /[[【]\s*(填写[^\]】]*|待补充|待定|请填写[^\]】]*)\s*[\]】]/g;
      while ((m = squareBracketPattern.exec(text)) !== null) {
        blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, textStart: m.index, textEnd: m.index + m[0].length, type: 'brackets', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text), fieldHint: inferFieldHint(text, m[0]) });
      }

      const bracketFieldPattern = /[（(]\s*([^（）()]{1,50}(?:名称|姓名|职务|性别|身份证号码|国家或地区|地址|电话|邮编|开户行|账号|代码|单位|投标人|供应商|法定代表人|被授权人|委托代理人|授权代表))\s*[)）]/g;
      while ((m = bracketFieldPattern.exec(text)) !== null) {
        const alreadyExists = blanks.some(
          (b) => b.paraIndex === currentParaIndex && b.matchText === m[0] && b.index === m.index
        );
        if (!alreadyExists) {
          blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, textStart: m.index, textEnd: m.index + m[0].length, type: 'brackets', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text), fieldHint: inferFieldHint(text, m[0]) });
        }
      }

      const placeholderPattern = /待补充|待填/g;
      while ((m = placeholderPattern.exec(text)) !== null) {
        blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, type: 'placeholder', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text) });
      }

      const attachmentKeywords = ['营业执照', '审计报告', '资信证明', '法人证书', '资质证书', '财务报表', '无重大违法记录', '资格证明文件', '声明', '承诺函'];
      const hasAttachmentHint = attachmentKeywords.some(kw => text.includes(kw));
      const hasBlankMarker = /_{3,}|-{4,}|[：:]\s{3,}/.test(text);
      const isRequirement = /复印件|原件|提供|出具|须具备|副本|声明|加盖公章/.test(text) || hasBlankMarker;
      const alreadyHasBlank = blanks.some(
        b => b.paraIndex === currentParaIndex && 
             ['underscore', 'dash', 'keyword_space', 'brackets', 'placeholder', 'image_placeholder'].includes(b.type)
      );

      if (hasAttachmentHint && isRequirement && !alreadyHasBlank && text.length > 5 && text.length < 300) {
        blanks.push({
          id: `blank_${++blankCounter}`,
          context: text,
          matchText: '[附件/资质插入位]',
          index: text.length, 
          type: 'attachment',
          confidence: 'high',
          paraIndex: currentParaIndex,
          fill_role: 'auto' 
        });
      }
    }
    currentParaIndex++;
  }

  const cellInfos = buildTableStructureMap(xmlString);
  console.log(`📊 表格解析结果: ${cellInfos.length} 个单元格`);
  const seenEmptyCells = new Set();
  
  for (const cell of cellInfos) {
    if (cell.cellText !== '' && !/^[\s_－-]+$/.test(cell.cellText)) continue;
    if (cell.rowIndex === 0) continue;
    
    // 记录关键单元格信息
    if (cell.headerText?.includes('承诺人') || cell.rowHeader?.includes('单位名称') || 
        cell.headerText?.includes('单位名称') || cell.rowHeader?.includes('承诺人')) {
      console.log(`🔍 发现相关单元格: headerText="${cell.headerText}", rowHeader="${cell.rowHeader}", paraIndex: ${cell.paraIndex}`);
    }

    const label = buildCellLabel(cell);

    if (!label || /^[0-9]+$/.test(label) || shouldSkipEmptyCellLabel(label)) continue;

    const cellKey = `${cell.tableIndex}:${cell.rowIndex}:${cell.colIndex}:${label}`;
    if (seenEmptyCells.has(cellKey)) continue;
    seenEmptyCells.add(cellKey);

    const context = `${label}：[空白单元格]`;
      blanks.push({
        id: `blank_${++blankCounter}`,
        context,
        matchText: '[空白单元格]',
        _cellLabel: label,
        index: label.length + 1, 
        textStart: label.length + 1,
        textEnd: label.length + 1 + '[空白单元格]'.length,
        type: 'empty_cell',
        confidence: 'medium',
        paraIndex: cell.paraIndex,
        fill_role: determineFillRole(label),
        fieldHint: label
      });
  }

  const uniqueBlanks = [];
  const seen = new Set();
  for (const b of blanks) {
    let key;
    if (b.type === 'image_placeholder') {
      key = `${b.paraIndex}::${b.type}`;
    } else {
      key = `${b.paraIndex}::${b.matchText}::${b.index}`;
    }
    if (!seen.has(key)) { 
      seen.add(key); 
      uniqueBlanks.push(b); 
    }
  }
  
  const attachmentKeywordsList = ['营业执照', '审计报告', '资信证明', '法人证书', '资质证书', '财务报表', '无重大违法记录', '资格证明文件', '声明', '承诺函'];
  for (const b of uniqueBlanks) {
    if (['underscore', 'dash', 'keyword_space'].includes(b.type) && 
        attachmentKeywordsList.some(kw => (b.context || '').includes(kw))) {
      b.need_image = true;
    }
  }
  return enrichBlankMetadata(uniqueBlanks);
}

// 💡 核心修复 2：在替换引擎中同样支持 <w:tab/> 的抓取，确保文字和空格映射不错位
function buildTextNodeMap(paragraphXml) {
  const NODE_REGEX = /(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)|(<w:tab(?:\s[^>]*)?\/>)/g;
  const nodes = [];
  let offset = 0;
  let m;
  
  while ((m = NODE_REGEX.exec(paragraphXml)) !== null) {
    if (m[4]) {
      // 这是一个制表符节点
      const text = '    ';
      nodes.push({ fullMatch: m[0], openTag: '', text, closeTag: '', matchStart: m.index, matchEnd: m.index + m[0].length, textStart: offset, textEnd: offset + text.length, isTab: true });
      offset += text.length;
    } else {
      // 这是一个普通文本节点
      const text = m[2] || '';
      nodes.push({ fullMatch: m[0], openTag: m[1], text, closeTag: m[3], matchStart: m.index, matchEnd: m.index + m[0].length, textStart: offset, textEnd: offset + text.length, isTab: false });
      offset += text.length;
    }
  }
  let fullText = '';
  for (const n of nodes) fullText += n.text;
  return { nodes, fullText };
}

function rebuildParagraphXml(paragraphXml, nodes) {
  let result = paragraphXml;
  let delta = 0;
  for (const node of nodes) {
    if (node._replaced) {
      let newFull;
      if (node.isTab) {
        // 如果我们替换掉的是一个 <w:tab/>，需要将其包装为标准的文本节点插入
        newFull = node._newText ? `<w:t>${node._newText}</w:t>` : '';
      } else {
        newFull = node.openTag + node._newText + node.closeTag;
      }
      const oldStart = node.matchStart + delta;
      const oldEnd = oldStart + node.fullMatch.length;
      result = result.substring(0, oldStart) + newFull + result.substring(oldEnd);
      delta += newFull.length - node.fullMatch.length;
    }
  }
  return result;
}

function findBlankInFullText(fullText, blank) {
  if (!blank.matchText) {
    return Number.isInteger(blank.index) ? blank.index : -1;
  }
  let searchFrom = Math.max(0, (blank.index || 0) - 5);
  let idx = fullText.indexOf(blank.matchText, searchFrom);
  if (idx !== -1) return idx;
  return fullText.indexOf(blank.matchText);
}

function getOverlappingNodes(nodes, textStart, textEnd) {
  const result = [];
  for (const node of nodes) {
    if (node.textEnd <= textStart || node.textStart >= textEnd) continue;
    result.push(node);
  }
  return result;
}

function replaceTextRangeInNodes(nodes, textStart, textEnd, replacementText) {
  let overlappingNodes = getOverlappingNodes(nodes, textStart, textEnd);
  if (overlappingNodes.length === 0 && textStart === textEnd) {
    const insertNode = nodes.find((node) => textStart >= node.textStart && textStart <= node.textEnd);
    if (insertNode) {
      overlappingNodes = [insertNode];
    }
  }
  if (overlappingNodes.length === 0) return false;

  const safeReplacement = replacementText ?? '';

  for (let i = 0; i < overlappingNodes.length; i++) {
    const node = overlappingNodes[i];
    const sliceStart = Math.max(textStart, node.textStart) - node.textStart;
    const sliceEnd = Math.min(textEnd, node.textEnd) - node.textStart;
    const prefix = node.text.slice(0, sliceStart);
    const suffix = node.text.slice(sliceEnd);

    node._replaced = true;
    if (i === 0) {
      node._newText = prefix + safeReplacement + suffix;
    } else {
      node._newText = prefix + suffix;
    }
  }

  return true;
}

export function replaceBlanksInXml(xmlString, blanks, filledValues, imageRidMap, hyperlinkRidMap = {}) {
  let modifiedXml = xmlString;
  const processedIds = new Set();

  const paragraphs = [];
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let pMatch;
  let pIdx = 0;

  while ((pMatch = paragraphRegex.exec(modifiedXml)) !== null) {
    paragraphs.push({ start: pMatch.index, end: pMatch.index + pMatch[0].length, xml: pMatch[0], text: getVisibleTextFromXml(pMatch[0]), paraIndex: pIdx });
    pIdx++;
  }

  for (const blank of blanks) {
    const value = filledValues[blank.id];
    
    if (value === undefined || value === null || value === '') continue;
    if (processedIds.has(blank.id)) continue;
    processedIds.add(blank.id);

    const matchingParagraph = paragraphs.find(p => p.paraIndex === blank.paraIndex);
    if (!matchingParagraph) continue;

    const paraXml = matchingParagraph.xml;
    const isImage = isImageUrl(value) && imageRidMap && imageRidMap[blank.id];
    const isDocUrl = isDocumentUrl(value);
    const hyperlinkRId = hyperlinkRidMap && hyperlinkRidMap[blank.id];
    let newParaXml = paraXml;

    if (blank.type === 'empty_cell' || blank.matchText === '[空白单元格]') {
      if (isImage) {
        const imgInfo = imageRidMap[blank.id];
        newParaXml = paraXml.replace(/<\/w:p>/, buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu) + '</w:p>');
      } else if (isDocUrl) {
        const displayText = getDisplayTextFromUrl(value, blank.context);
        if (hyperlinkRId) {
          newParaXml = paraXml.replace(/<\/w:p>/, buildHyperlinkXml(hyperlinkRId, displayText, value) + '</w:p>');
        } else {
          newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
        }
      } else {
        newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
      }
    } else {
      const { nodes, fullText } = buildTextNodeMap(paraXml);
      let matchText = blank.matchText;
      
      const searchBlank = { ...blank, matchText };
      let blankPos = findBlankInFullText(fullText, searchBlank);
      if (blankPos === -1 && Number.isInteger(blank.index) && blank.index >= 0 && blank.index <= fullText.length) {
        blankPos = blank.index;
      }
      
      if (blank.type === 'attachment') {
        if (isImage) {
          const imgInfo = imageRidMap[blank.id];
          newParaXml = paraXml.replace(/<\/w:p>/, buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu) + '</w:p>');
        } else if (isDocUrl) {
          const displayText = getDisplayTextFromUrl(value, blank.context);
          if (hyperlinkRId) {
            newParaXml = paraXml.replace(/<\/w:p>/, buildHyperlinkXml(hyperlinkRId, displayText, value) + '</w:p>');
          } else {
            newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
          }
        } else {
          newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
        }
      } else if (blankPos === -1) {
        if (shouldAppendAfterAnchor(blank)) {
          if (replaceTextRangeInNodes(nodes, fullText.length, fullText.length, escapeXml(value))) {
            newParaXml = rebuildParagraphXml(paraXml, nodes);
          }
        } else if (!isInlineBlankType(blank.type)) {
          if (isImage) {
            const imgInfo = imageRidMap[blank.id];
            newParaXml = paraXml.replace(/<\/w:p>/, buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu) + '</w:p>');
          } else if (isDocUrl) {
            const displayText = getDisplayTextFromUrl(value, blank.context);
            if (hyperlinkRId) {
              newParaXml = paraXml.replace(/<\/w:p>/, buildHyperlinkXml(hyperlinkRId, displayText, value) + '</w:p>');
            } else {
              newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
            }
          } else {
            newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
          }
        } else {
          console.warn(`⚠️ 未定位到空白位置，跳过追加以避免写到后缀后面: ${blank.id}`, {
            paraIndex: blank.paraIndex,
            matchText: blank.matchText,
            context: blank.context
          });
        }
      } else {
        const blankEnd = blankPos + matchText.length;
        const preserveAnchorText = blank.type === 'brackets' && /盖章|公章|签章/.test(blank.matchText || blank.context || '');
        const replaceStart = preserveAnchorText ? blankEnd : blankPos;
        const replaceEnd = preserveAnchorText ? blankEnd : blankEnd;
        const inlineReplacement = (!isImage && !isDocUrl) ? escapeXml(value) : '';

        if (replaceTextRangeInNodes(nodes, replaceStart, replaceEnd, inlineReplacement)) {
          if (isImage) {
            const imgInfo = imageRidMap[blank.id];
            let tempParaXml = rebuildParagraphXml(paraXml, nodes);
            newParaXml = tempParaXml.replace(/<\/w:p>/, buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu) + '</w:p>');
          } else if (isDocUrl) {
            const displayText = getDisplayTextFromUrl(value, blank.context);
            if (hyperlinkRId) {
              let tempParaXml = rebuildParagraphXml(paraXml, nodes);
              newParaXml = tempParaXml.replace(/<\/w:p>/, buildHyperlinkXml(hyperlinkRId, displayText, value) + '</w:p>');
            } else {
              newParaXml = rebuildParagraphXml(paraXml, nodes);
            }
          } else {
            newParaXml = rebuildParagraphXml(paraXml, nodes);
          }
        }
      }
    }

    if (newParaXml !== matchingParagraph.xml) {
      modifiedXml = modifiedXml.substring(0, matchingParagraph.start) + newParaXml + modifiedXml.substring(matchingParagraph.end);
      const diff = newParaXml.length - matchingParagraph.xml.length;
      paragraphs.forEach(p => {
        if (p.start > matchingParagraph.start) { p.start += diff; p.end += diff; }
        else if (p.start === matchingParagraph.start) { p.xml = newParaXml; p.end = p.start + newParaXml.length; }
      });
      matchingParagraph.xml = newParaXml;
    }
  }

  return modifiedXml;
}

export function extractIndexedParagraphs(xmlString) {
  const paragraphs = [];
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  let paraIndex = 0;

  const cellInfos = buildTableStructureMap(xmlString);
  const tableParaSet = new Set();
  const paraToLabel = new Map();
  const seenPreviewCells = new Set();

  for (const cell of cellInfos) {
    const label = buildCellLabel(cell);
    const cellKey = `${cell.tableIndex}:${cell.rowIndex}:${cell.colIndex}:${label}`;
    if (seenPreviewCells.has(cellKey)) continue;
    seenPreviewCells.add(cellKey);

    tableParaSet.add(cell.paraIndex);
    if (cell.cellText === '' || /^[\s_－-]+$/.test(cell.cellText)) {
      if (cell.rowIndex === 0) continue;
      if (!label || shouldSkipEmptyCellLabel(label)) continue;

      paraToLabel.set(cell.paraIndex, label);
    }
  }

  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const xml = paraMatch[0];
    const text = getVisibleTextFromXml(xml);
    if (text.trim().length > 0) {
      paragraphs.push({ paraIndex, text, xml }); 
    } else if (tableParaSet.has(paraIndex)) {
      const label = paraToLabel.get(paraIndex) || '';
      if (label && !/^[0-9]+$/.test(label)) {
        paragraphs.push({ paraIndex, text: `${label}：[空白单元格]`, xml });
      }
    }
    paraIndex++;
  }
  return paragraphs;
}

export function mergeBlanks(regexBlanks, aiBlanks) {
  const merged = [...regexBlanks];
  const existingKeys = new Set(regexBlanks.map(b => `${b.paraIndex}|${b.matchText}|${b.index ?? 0}`));
  aiBlanks.forEach(aiBlank => {
    const computedIndex = aiBlank.index ?? 
      (aiBlank.context && aiBlank.matchText 
        ? aiBlank.context.indexOf(aiBlank.matchText) 
        : 0);
    const key = `${aiBlank.paraIndex}|${aiBlank.matchText}|${computedIndex}`;
    if (!existingKeys.has(key)) {
      const textStart = computedIndex >= 0 ? computedIndex : 0;
      const textEnd = textStart + ((aiBlank.matchText || '').length || 0);
      merged.push({ 
        ...aiBlank, 
        id: `blank_ai_${merged.length + 1}`, 
        confidence: aiBlank.confidence || 'medium',
        fill_role: aiBlank.fill_role || determineFillRole(aiBlank.context || '', aiBlank.type || ''),
        index: textStart,
        textStart,
        textEnd,
        fieldHint: aiBlank.field_hint || inferFieldHint(aiBlank.context || '', aiBlank.matchText || '')
      });
      existingKeys.add(key);
    }
  });
  return enrichBlankMetadata(merged);
}

export function extractParagraphsForPreview(xmlString, blanks) {
  const paragraphs = [];
  console.log('🔍 [extractParagraphsForPreview] 开始，空白总数:', blanks.length);
  
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  let paraIndex = 0;
  let lastDisplayText = '';
  let lastBlankSignature = '';

  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const xml = paraMatch[0];
    let text = getVisibleTextFromXml(xml).trim();
    const matchedBlanks = blanks.filter(b => b.paraIndex === paraIndex);

    // 增强的重复检测：使用正则表达式匹配任何文本在冒号后的重复
    if (text) {
      // 模式1：检测 "文本：文本："
      const colonDuplicatePattern = /([^：\n]+：)\1/;
      // 模式2：检测具体已知的重复模式
      const specificPatterns = [
        /承诺人（公章）：承诺人（公章）：/,
        /单位名称：单位名称：/,
        /承诺日期：承诺日期：/,
        /地 址：地 址：/,
        /单位性质：单位性质：/,
        /经营期限：经营期限：/
      ];
      
      let hasDuplicate = false;
      let duplicateMatch = null;
      
      // 先检查通用的冒号重复
      const colonMatch = text.match(colonDuplicatePattern);
      if (colonMatch) {
        hasDuplicate = true;
        duplicateMatch = colonMatch[0];
      } else {
        // 检查具体的重复模式
        for (const pattern of specificPatterns) {
          if (pattern.test(text)) {
            hasDuplicate = true;
            duplicateMatch = pattern.toString().replace(/^\/|\/$/g, '');
            break;
          }
        }
      }
      
      if (hasDuplicate) {
        console.warn(`⚠️⚠️⚠️ [extractParagraphsForPreview] 段落 ${paraIndex} 检测到重复文本！`);
        console.log(`  重复模式: ${duplicateMatch}`);
        console.log(`  完整文本（前200字符）: "${text.substring(0, 200)}${text.length > 200 ? '...' : ''}"`);
        console.log(`  关联空白数量: ${matchedBlanks.length}`);
        if (matchedBlanks.length > 0) {
          console.log('  关联空白详情:', matchedBlanks.map(b => ({
            id: b.id,
            type: b.type,
            matchText: b.matchText,
            context: b.context ? b.context.substring(0, 80) + (b.context.length > 80 ? '...' : '') : null
          })));
        }
        
        // 💡 修复：使用正则表达式替换移除重复的文本
        // 例如："承诺人（公章）：承诺人（公章）：" -> "承诺人（公章）："
        text = text.replace(/([^：\n]+：)\1/g, '$1');
        console.log(`  ✅ 修复后文本: "${text.substring(0, 200)}${text.length > 200 ? '...' : ''}"`);
      }
    }

    if (text.length > 0 || matchedBlanks.length > 0) {
      let displayText = text;
      
      const attachmentBlanks = matchedBlanks.filter(b => b.type === 'attachment');
      if (attachmentBlanks.length > 0) {
        displayText += ' ' + attachmentBlanks.map(b => b.matchText).join(' ');
      }

      if (displayText.length === 0 && matchedBlanks.length > 0) {
        displayText = matchedBlanks[0].context; 
        console.log(`ℹ️ 段落 ${paraIndex} 为空，使用空白上下文: "${displayText}"`);
      }
      const blankIds = matchedBlanks.map(b => b.id);
      const blankSignature = matchedBlanks
        .map((b) => `${b.type}:${b._cellLabel || b.matchText}:${b.paraIndex}`)
        .join('|');

      if (!(displayText === lastDisplayText && blankSignature === lastBlankSignature)) {
        paragraphs.push({ text: displayText || '[空段落]', blankIds });
        lastDisplayText = displayText;
        lastBlankSignature = blankSignature;
      }
    }
    paraIndex++;
  }
  
  console.log(`📊 [extractParagraphsForPreview] 生成 ${paragraphs.length} 个段落`);
  return paragraphs;
}

export function extractDocumentXml(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const zip = new PizZip(e.target.result);
        const xmlFile = zip.file('word/document.xml');
        if (!xmlFile) { reject(new Error('无法找到 word/document.xml')); return; }
        resolve({ xmlString: xmlFile.asText(), zip });
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

export async function generateFilledDocx(zip, modifiedXml, blanks, filledValues, imageUrlMap = {}) {
  const imageRidMap = {};
  const hyperlinkRidMap = {};
  const imageEntries = [];
  const hyperlinkEntries = [];

  for (const blank of blanks) {
    let val = filledValues[blank.id];
    
    if (val && typeof val === 'string' && val.startsWith('{{IMG_')) {
      for (const [placeholder, realUrl] of Object.entries(imageUrlMap)) {
        const normalizedVal = normalizeProductName(val);
        const normalizedPlaceholder = normalizeProductName(placeholder);
        
        if (normalizedVal.includes(normalizedPlaceholder)) {
          const oldVal = val;
          const regex = buildPlaceholderRegex(placeholder);
          const newVal = val.replace(regex, realUrl);
          
          if (oldVal !== newVal) {
            val = newVal;
          } else {
            val = realUrl;
          }
          break;
        }
      }
    }
    
    if (val && isImageUrl(val)) {
      imageEntries.push({ blankId: blank.id, url: val.trim() });
    }
    
    if (val && isDocumentUrl(val)) {
      let manualName = getDisplayTextFromUrl(val, blank.context);
      const docCode = `[INSERT_DOC:${manualName}]`;
      filledValues[blank.id] = docCode;
    }
  }

  const fetchedImages = [];
  if (imageEntries.length > 0) {
    const results = await Promise.allSettled(
      imageEntries.map(async (entry) => {
        const { buffer, mime } = await fetchImageAsArrayBuffer(entry.url);
        const { w, h } = await loadImageNaturalSize(buffer);
        return { ...entry, buffer, mime, naturalW: w, naturalH: h };
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        fetchedImages.push(r.value);
      }
    }
  }

  let relsObj = null;
  const IMAGE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
  const RELS_PATH = 'word/_rels/document.xml.rels';

  if (fetchedImages.length > 0) {
    let relsXml = zip.file(RELS_PATH)?.asText();
    if (!relsXml) {
      relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    }
    relsObj = parseRelsXml(relsXml);

    let ctXml = zip.file('[Content_Types].xml')?.asText() || '';
    const ensureExt = (ext, mime) => {
      if (!ctXml.includes(`Extension="${ext}"`)) {
        ctXml = ctXml.replace('</Types>', `<Default Extension="${ext}" ContentType="${mime}"/></Types>`);
      }
    };
    ensureExt('png', 'image/png'); ensureExt('jpeg', 'image/jpeg'); ensureExt('gif', 'image/gif'); ensureExt('bmp', 'image/bmp');
    zip.file('[Content_Types].xml', ctXml);

    for (let i = 0; i < fetchedImages.length; i++) {
      const img = fetchedImages[i];
      const ext = guessImageExt(img.mime);
      const mediaFileName = `word/media/injected_${i + 1}.${ext}`;
      const target = `media/injected_${i + 1}.${ext}`;
      zip.file(mediaFileName, img.buffer);
      const rId = addRelationship(relsObj, target, IMAGE_REL_TYPE);
      const TARGET_PX = 160;
      const { cx, cy } = getImageDimensionsEmu(TARGET_PX, img.naturalW, img.naturalH);
      imageRidMap[img.blankId] = { rId, cxEmu: cx, cyEmu: cy };
    }
    zip.file(RELS_PATH, relsObj.xml);
  }

  if (hyperlinkEntries.length > 0) {
    let relsXml = zip.file(RELS_PATH)?.asText();
    if (!relsXml) {
      relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
      zip.file(RELS_PATH, relsXml);
    }
    
    const HYPERLINK_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
    let updatedRelsXml = relsXml;
    
    hyperlinkEntries.forEach((entry, index) => {
      const rId = `rId_hyperlink_${index + 1}`;
      updatedRelsXml = updatedRelsXml.replace('</Relationships>', 
        `<Relationship Id="${rId}" Type="${HYPERLINK_REL_TYPE}" Target="${entry.url}" TargetMode="External"/>\n</Relationships>`);
      hyperlinkRidMap[entry.blankId] = rId;
    });
    
    zip.file(RELS_PATH, updatedRelsXml);
  }

  const finalXml = replaceBlanksInXml(modifiedXml, blanks, filledValues, imageRidMap, hyperlinkRidMap);
  zip.file('word/document.xml', finalXml);
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}
