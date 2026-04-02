import PizZip from 'pizzip';

// 💡 保持原有词库不变
function determineFillRole(text) {
  const manualPatterns = [
    /报价|总价|单价|合同价|投标价|费率|偏离度|交货期|质保期/
  ];
  for (const pattern of manualPatterns) {
    if (pattern.test(text)) return 'manual';
  }
  return 'auto'; // 安全兜底：相信 AI！不知道的统统算 auto
}

// 标准化产品名称：处理中英文混合的空格问题
function normalizeProductName(name) {
  if (!name || typeof name !== 'string') return '';
  // 1. 统一处理连字符前后的空格
  let normalized = name.replace(/\s*-\s*/g, '-');
  // 2. 移除所有空格
  normalized = normalized.replace(/\s+/g, '');
  // 3. 在英文单词和中文之间添加空格
  normalized = normalized.replace(/([a-zA-Z])([\u4e00-\u9fa5])/g, '$1 $2');
  normalized = normalized.replace(/([\u4e00-\u9fa5])([a-zA-Z])/g, '$1 $2');
  // 4. 在英文单词和数字之间添加空格
  normalized = normalized.replace(/([a-zA-Z])(\d)/g, '$1 $2');
  normalized = normalized.replace(/(\d)([a-zA-Z])/g, '$1 $2');
  // 5. 移除多余空格，保留单词间单个空格
  return normalized.replace(/\s+/g, ' ').trim();
}

// 构建占位符正则表达式
function buildPlaceholderRegex(placeholder) {
  // 转义特殊字符
  const escaped = placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 将空格替换为 \\s*（允许0个或多个空格）
  const pattern = escaped.replace(/\\s+/g, '\\\\s*');
  return new RegExp(pattern, 'g');
}

function getVisibleTextFromXml(xml) {
  const textParts = [];
  const textRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m;
  while ((m = textRegex.exec(xml)) !== null) textParts.push(m[1]);
  return textParts.join('');
}

// 🚀🚀🚀 核心重构：2D 表格空间雷达（精准抓取表头和行号）
function buildTableStructureMap(xmlString) {
  const cellInfos = [];
  const tblRegex = /<w:tbl[\s>][\s\S]*?<\/w:tbl>/g;
  let tblMatch;

  while ((tblMatch = tblRegex.exec(xmlString)) !== null) {
    const tblXml = tblMatch[0];
    const tblGlobalOffset = tblMatch.index;

    const rowRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/g;
    let rowMatch;
    let rowIndex = 0;
    const columnHeaders = []; // 用于记忆第一行的表头

    while ((rowMatch = rowRegex.exec(tblXml)) !== null) {
      const rowXml = rowMatch[0];
      const rowGlobalOffset = tblGlobalOffset + rowMatch.index;

      // 抓取该行第一个单元格的文本，作为行标识（如：序号 1）
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

        // 识别单元格合并（跨列），确保表头对齐不错位
        let span = 1;
        const spanMatch = tcXml.match(/<w:gridSpan w:val="(\d+)"/);
        if (spanMatch) span = parseInt(spanMatch[1], 10);

        // 如果是第一行，死死记住列名（表头）
        if (rowIndex === 0) {
          for(let s=0; s<span; s++) columnHeaders[colIndex + s] = text;
        }

        const pRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
        let pMatch;
        while ((pMatch = pRegex.exec(tcXml)) !== null) {
          const pLocalOffset = pMatch.index;
          const pGlobalOffset = tcGlobalOffset + pLocalOffset;
          const paraIdx = countParagraphsBefore(xmlString, pGlobalOffset);

          cellInfos.push({
            paraIndex: paraIdx,
            cellXml: tcXml,
            cellText: getVisibleTextFromXml(pMatch[0]).trim(),
            rowIndex,
            colIndex,
            headerText: columnHeaders[colIndex] || '', // 头顶上的表头
            rowHeader // 左侧的行标识
          });
        }
        colIndex += span;
      }
      rowIndex++;
    }
  }
  return cellInfos;
}

function countParagraphsBefore(xmlString, globalOffset) {
  return (xmlString.substring(0, globalOffset).match(/<w:p[\s>]/g) || []).length;
}

// （保留该函数以防其他地方可能用到，但表格扫描核心已不再依赖它）
function getPreviousCellLabel(rowXml, currentCellLocalOffset) {
  const tcRegex = /<w:tc[\s>]([\s\S]*?)<\/w:tc>/g;
  let tcMatch;
  let prevText = '';
  while ((tcMatch = tcRegex.exec(rowXml)) !== null) {
    if (tcMatch.index >= currentCellLocalOffset) break;
    const text = getVisibleTextFromXml(tcMatch[0]).trim();
    if (text) prevText = text;
  }
  return prevText;
}

function isImageUrl(value) {
  if (!value || typeof value !== 'string') {
    console.log(`🔍 [isImageUrl] 输入无效:`, value);
    return false;
  }
  const v = value.trim();
  
  // 检查是否是占位符格式 {{IMG_...}}
  const isPlaceholder = /^\{\{IMG_.+?\}\}$/.test(v);
  if (isPlaceholder) {
    console.log(`🔍 [isImageUrl] 识别为占位符: "${v}"`);
    return true;
  }
  
  // 检查是否是URL格式
  const test1 = /^https?:\/\/.+\.(png|jpg|jpeg|gif|bmp|webp|svg)(\?.*)?$/i.test(v);
  const test2 = /^https?:\/\/.+\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(v);
  const test3 = /^https?:\/\/.*\/storage\/v1\/object\/public\//i.test(v);
  const result = test1 || test2 || test3;
  
  console.log(`🔍 [isImageUrl] 测试 "${v.substring(0, 50)}...":`, { 
    isPlaceholder, 
    test1, 
    test2, 
    test3, 
    result 
  });
  return result;
}

// 检测是否为文档URL（Word、PDF等）
function isDocumentUrl(value) {
  if (!value || typeof value !== 'string') {
    console.log(`🔍 [isDocumentUrl] 输入无效:`, value);
    return false;
  }
  const v = value.trim();
  
  // 检查是否是文档URL（Word、PDF等）
  const docPatterns = [
    /^https?:\/\/.*\.(docx?|pdf|txt)(\?.*)?$/i,
    /^https?:\/\/.*\/storage\/v1\/object\/public\/.*\.(docx?|pdf|txt)/i,
    /^https?:\/\/.*\.supabase\.(co|in)\/storage\/v1\/object\/public\/.*/i
  ];
  
  const result = docPatterns.some(pattern => pattern.test(v));
  
  console.log(`🔍 [isDocumentUrl] 测试 "${v.substring(0, 50)}...":`, { 
    result,
    patterns: docPatterns.map(p => p.test(v))
  });
  
  return result;
}

// 从URL提取显示文本
function getDisplayTextFromUrl(url, context) {
  if (!url || typeof url !== 'string') return '服务手册';
  
  console.log(`🔍 [getDisplayTextFromUrl] 提取显示文本:`, { url: url.substring(0, 50), context: context?.substring(0, 50) });
  
  // 如果有上下文，尝试从中提取产品名称
  if (context && typeof context === 'string') {
    // 尝试匹配类似"Coremail产品VIP级售后服务手册"的模式
    // 先检查是否已经包含"售后服务手册"
    if (context.includes('售后服务手册')) {
      const manualMatch = context.match(/([^：:（）(]+)(?:售后服务手册)/);
      if (manualMatch && manualMatch[1]) {
        const productName = manualMatch[1].trim();
        if (productName && productName.length > 0) {
          const displayText = `${productName}售后服务手册`;
          console.log(`🔍 [getDisplayTextFromUrl] 从上下文提取: "${displayText}"`);
          return displayText;
        }
      }
    }
    // 检查是否包含"服务手册"
    else if (context.includes('服务手册')) {
      const manualMatch = context.match(/([^：:（）(]+)(?:服务手册)/);
      if (manualMatch && manualMatch[1]) {
        const productName = manualMatch[1].trim();
        if (productName && productName.length > 0) {
          const displayText = `${productName}服务手册`;
          console.log(`🔍 [getDisplayTextFromUrl] 从上下文提取: "${displayText}"`);
          return displayText;
        }
      }
    }
    
    // 尝试提取产品名称（更通用的模式）
    const productMatch = context.match(/([a-zA-Z0-9\u4e00-\u9fa5]+产品|[a-zA-Z0-9\u4e00-\u9fa5]+系统)/);
    if (productMatch && productMatch[1]) {
      const productName = productMatch[1].trim();
      const displayText = `${productName}售后服务手册`;
      console.log(`🔍 [getDisplayTextFromUrl] 提取产品名称: "${displayText}"`);
      return displayText;
    }
  }
  
  // 从URL提取文件名
  const fileName = url.split('/').pop().split('?')[0];
  const cleanName = fileName.replace(/[_-]/g, ' ').replace(/\.[^/.]+$/, '');
  
  console.log(`🔍 [getDisplayTextFromUrl] 从URL提取文件名: "${fileName}" -> "${cleanName}"`);
  
  // 如果文件名有意义，使用它
  if (cleanName && cleanName.length > 3 && !cleanName.match(/^[0-9a-f]{32}$/i)) {
    // 尝试美化文件名
    let prettyName = cleanName;
    
    // 移除常见的时间戳和ID
    prettyName = prettyName.replace(/\d{4}[-_]?\d{2}[-_]?\d{2}/g, ''); // 日期
    prettyName = prettyName.replace(/\d{10,}/g, ''); // 长数字
    prettyName = prettyName.replace(/^[\s_-]+|[\s_-]+$/g, ''); // 首尾空格和下划线
    
    // 如果美化后有内容，使用它
    if (prettyName && prettyName.length > 2) {
      console.log(`🔍 [getDisplayTextFromUrl] 美化文件名: "${prettyName}"`);
      return prettyName;
    }
    
    console.log(`🔍 [getDisplayTextFromUrl] 使用原始文件名: "${cleanName}"`);
    return cleanName;
  }
  
  console.log(`🔍 [getDisplayTextFromUrl] 使用默认文本: "服务手册"`);
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

// 构建超链接XML
function buildHyperlinkXml(rId, displayText, url) {
  return `<w:hyperlink r:id="${rId}" w:history="1" w:tooltip="${escapeXml(url)}">
    <w:r>
      <w:rPr>
        <w:rStyle w:val="Hyperlink"/>
        <w:color w:val="0000FF"/>
        <w:u w:val="single"/>
      </w:rPr>
      <w:t>${escapeXml(displayText)}</w:t>
    </w:r>
  </w:hyperlink>`;
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

// ===================== Core scanning =====================

export function scanBlanksFromXml(xmlString) {
  const blanks = [];
  let blankCounter = 0;

  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  let currentParaIndex = 0;

  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const paragraphText = getVisibleTextFromXml(paraMatch[0]);

    if (paragraphText.trim().length > 0) {
      const text = paragraphText;

      const underscorePattern = /_{3,}/g;
      let m;
      while ((m = underscorePattern.exec(text)) !== null) {
        if (m[0].length >= 2) {
          blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, type: 'underscore', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text, 'underscore') });
        }
      }

      const dashPattern = /-{4,}/g;
      while ((m = dashPattern.exec(text)) !== null) {
        if (m[0].length >= 3) {
          blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, type: 'dash', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text, 'dash') });
        }
      }

      const spacePattern = /([：:])(\s{3,})/g;
      while ((m = spacePattern.exec(text)) !== null) {
        const colonStr = m[1];
        const spaceStr = m[2];
        const spaceIndex = m.index + colonStr.length; 
        blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: spaceStr, index: spaceIndex, type: 'keyword_space', confidence: 'medium', paraIndex: currentParaIndex, fill_role: determineFillRole(text, 'keyword_space') });
      }

      const roundBracketPattern = /[（(]\s*(盖章处|签章处|盖章|签字|请填写[^）)]*|待补充|待定|填写[^）)]*|请盖章)\s*[)）]/g;
      while ((m = roundBracketPattern.exec(text)) !== null) {
        blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, type: 'brackets', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text, 'brackets') });
      }

      const squareBracketPattern = /[[【]\s*(填写[^\]】]*|待补充|待定|请填写[^\]】]*)\s*[\]】]/g;
      while ((m = squareBracketPattern.exec(text)) !== null) {
        blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, type: 'brackets', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text, 'brackets') });
      }

      const placeholderPattern = /待补充|待填/g;
      while ((m = placeholderPattern.exec(text)) !== null) {
        blanks.push({ id: `blank_${++blankCounter}`, context: text, matchText: m[0], index: m.index, type: 'placeholder', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text, 'placeholder') });
      }

      const attachmentKeywords = ['营业执照', '审计报告', '资信证明', '法人证书', '资质证书', '财务报表', '无重大违法记录', '资格证明文件', '声明', '承诺函'];
      const hasAttachmentHint = attachmentKeywords.some(kw => text.includes(kw));
      const hasBlankMarker = /_{3,}|-{4,}|[：:]\s{3,}/.test(text);
      const isRequirement = /复印件|原件|提供|出具|须具备|副本|声明|加盖公章/.test(text) || hasBlankMarker;
      const alreadyHasBlank = blanks.some(
        b => b.paraIndex === currentParaIndex && 
             ['underscore', 'dash', 'keyword_space', 'brackets', 'placeholder'].includes(b.type)
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

  // 🚀🚀🚀 全新升级的表格结构处理
  const cellInfos = buildTableStructureMap(xmlString);
  
  for (const cell of cellInfos) {
    if (cell.cellText !== '' && !/^[\s　_－-]+$/.test(cell.cellText)) continue;
    if (cell.rowIndex === 0) continue; // 绝对跳过第一行表头

    let label = '';
    // 智能拼接：表头（项：行号） => 偏差说明（项：1）
    if (cell.headerText && cell.rowHeader && cell.headerText !== cell.rowHeader) {
      label = `${cell.headerText}（项：${cell.rowHeader}）`;
    } else if (cell.headerText) {
      label = cell.headerText;
    } else if (cell.rowHeader) {
      label = cell.rowHeader;
    }

    if (!label || /^[0-9]+$/.test(label)) continue; // 过滤无意义的纯数字

    const context = `${label}：[空白单元格]`;
    blanks.push({
      id: `blank_${++blankCounter}`,
      context,
      matchText: '[空白单元格]',
      _cellLabel: label,
      index: label.length + 1, 
      type: 'empty_cell',
      confidence: 'medium',
      paraIndex: cell.paraIndex,
      fill_role: determineFillRole(label, 'empty_cell')
    });
  }

  const uniqueBlanks = [];
  const seen = new Set();
  for (const b of blanks) {
    const key = `${b.paraIndex}::${b.matchText}::${b.index}`;
    if (!seen.has(key)) { seen.add(key); uniqueBlanks.push(b); }
  }
  const attachmentKeywordsList = ['营业执照', '审计报告', '资信证明', '法人证书', '资质证书', '财务报表', '无重大违法记录', '资格证明文件', '声明', '承诺函'];
  for (const b of uniqueBlanks) {
    if (['underscore', 'dash', 'keyword_space'].includes(b.type) && 
        attachmentKeywordsList.some(kw => (b.context || '').includes(kw))) {
      b.need_image = true;
    }
  }
  return uniqueBlanks;
}

// ===================== Text Mapping engine =====================

function buildTextNodeMap(paragraphXml) {
  const WT_REGEX = /(<w:t(\s[^>]*)?>)([^<]*)(<\/w:t>)/g;
  const nodes = [];
  let offset = 0;
  let m;
  while ((m = WT_REGEX.exec(paragraphXml)) !== null) {
    const text = m[3];
    nodes.push({ fullMatch: m[0], openTag: m[1], text, closeTag: m[4], matchStart: m.index, matchEnd: m.index + m[0].length, textStart: offset, textEnd: offset + text.length });
    offset += text.length;
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
      const newFull = node.openTag + node._newText + node.closeTag;
      const oldStart = node.matchStart + delta;
      const oldEnd = oldStart + node.fullMatch.length;
      result = result.substring(0, oldStart) + newFull + result.substring(oldEnd);
      delta += newFull.length - node.fullMatch.length;
    }
  }
  return result;
}

function findBlankInFullText(fullText, blank) {
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

// ===================== Replace blanks =====================

export function replaceBlanksInXml(xmlString, blanks, filledValues, imageRidMap, hyperlinkRidMap = {}) {
  console.log('🔍 [replaceBlanksInXml] 开始替换空白');
  console.log('🔍 传入参数:', { 
    blanksCount: blanks.length, 
    filledValuesCount: Object.keys(filledValues).length,
    imageRidMapKeys: Object.keys(imageRidMap || {}),
    imageRidMap: imageRidMap,
    hyperlinkRidMapKeys: Object.keys(hyperlinkRidMap),
    hyperlinkRidMap: hyperlinkRidMap
  });
  
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
  
  console.log('🔍 解析出段落数:', paragraphs.length);

  for (const blank of blanks) {
    const value = filledValues[blank.id];
    console.log(`🔍 处理空白 ${blank.id}:`, { 
      value, 
      blankType: blank.type,
      matchText: blank.matchText,
      paraIndex: blank.paraIndex,
      isImageUrl: isImageUrl(value),
      hasImageRid: !!(imageRidMap && imageRidMap[blank.id])
    });
    
    if (value === undefined || value === null || value === '') {
      console.log(`🔍 空白 ${blank.id} 值为空，跳过`);
      continue;
    }
    if (processedIds.has(blank.id)) {
      console.log(`🔍 空白 ${blank.id} 已处理过，跳过`);
      continue;
    }
    processedIds.add(blank.id);

    const matchingParagraph = paragraphs.find(p => p.paraIndex === blank.paraIndex);
    if (!matchingParagraph) {
      console.log(`🔍 找不到段落 paraIndex=${blank.paraIndex}，跳过`);
      continue;
    }

    const paraXml = matchingParagraph.xml;
    const isImage = isImageUrl(value) && imageRidMap && imageRidMap[blank.id];
    const isDocUrl = isDocumentUrl(value);
    const hyperlinkRId = hyperlinkRidMap && hyperlinkRidMap[blank.id];
    console.log(`🔍 空白 ${blank.id} 是否为图片: ${isImage}, 是否为文档URL: ${isDocUrl}, imageRidMap[blank.id]:`, imageRidMap?.[blank.id], `hyperlinkRidMap[blank.id]:`, hyperlinkRId);
    let newParaXml = paraXml;

    if (blank.type === 'empty_cell' || blank.matchText === '[空白单元格]') {
      console.log(`🔍 空白 ${blank.id} 类型: empty_cell`);
      if (isImage) {
        const imgInfo = imageRidMap[blank.id];
        console.log(`🔍 插入图片到 empty_cell: rId=${imgInfo.rId}, cx=${imgInfo.cxEmu}, cy=${imgInfo.cyEmu}`);
        newParaXml = paraXml.replace(/<\/w:p>/, buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu) + '</w:p>');
        console.log(`✅ empty_cell 图片插入完成`);
      } else if (isDocUrl) {
        // 处理文档URL：插入超链接
        const displayText = getDisplayTextFromUrl(value, blank.context);
        if (hyperlinkRId) {
          console.log(`🔍 插入文档超链接到 empty_cell: ${displayText} -> ${value}, 使用映射ID: ${hyperlinkRId}`);
          newParaXml = paraXml.replace(/<\/w:p>/, buildHyperlinkXml(hyperlinkRId, displayText, value) + '</w:p>');
          console.log(`✅ empty_cell 文档超链接插入完成`);
        } else {
          console.warn(`⚠️ 空白 ${blank.id} 是文档URL但没有对应的超链接关系ID，插入为纯文本`);
          newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
        }
      } else {
        console.log(`🔍 插入文本到 empty_cell: ${value.substring(0, 50)}...`);
        newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
      }
    } else {
      console.log(`🔍 空白 ${blank.id} 类型: ${blank.type}, matchText: ${blank.matchText}`);
      const { nodes, fullText } = buildTextNodeMap(paraXml);
      let matchText = blank.matchText;
      
      const searchBlank = { ...blank, matchText };
      const blankPos = findBlankInFullText(fullText, searchBlank);
      console.log(`🔍 在段落中查找空白位置: blankPos=${blankPos}, fullText长度=${fullText.length}`);
      
      if (blankPos === -1 || blank.type === 'attachment') {
        console.log(`🔍 空白位置未找到或类型为attachment: blankPos=${blankPos}, type=${blank.type}`);
        if (isImage) {
          const imgInfo = imageRidMap[blank.id];
          console.log(`🔍 插入图片到段落末尾: rId=${imgInfo.rId}`);
          newParaXml = paraXml.replace(/<\/w:p>/, buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu) + '</w:p>');
          console.log(`✅ attachment 图片插入完成`);
        } else if (isDocUrl) {
          // 处理文档URL：插入超链接
          const displayText = getDisplayTextFromUrl(value, blank.context);
          if (hyperlinkRId) {
            console.log(`🔍 插入文档超链接到段落末尾: ${displayText} -> ${value}, 使用映射ID: ${hyperlinkRId}`);
            newParaXml = paraXml.replace(/<\/w:p>/, buildHyperlinkXml(hyperlinkRId, displayText, value) + '</w:p>');
            console.log(`✅ attachment 文档超链接插入完成`);
          } else {
            console.warn(`⚠️ 空白 ${blank.id} 是文档URL但没有对应的超链接关系ID，插入为纯文本`);
            newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
          }
        } else {
          console.log(`🔍 插入文本到段落末尾: ${value.substring(0, 50)}...`);
          newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
        }
      } else {
        const blankEnd = blankPos + matchText.length;
        const coveredNodes = getOverlappingNodes(nodes, blankPos, blankEnd);
        if (coveredNodes.length > 0) {
          if (isImage) {
            const imgInfo = imageRidMap[blank.id];
            for (const node of coveredNodes) { node._replaced = true; node._newText = ''; }
            let tempParaXml = rebuildParagraphXml(paraXml, nodes);
            newParaXml = tempParaXml.replace(/<\/w:p>/, buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu) + '</w:p>');
          } else if (isDocUrl) {
            // 处理文档URL：插入超链接
            const displayText = getDisplayTextFromUrl(value, blank.context);
            if (hyperlinkRId) {
              console.log(`🔍 插入文档超链接替换空白: ${displayText} -> ${value}, 使用映射ID: ${hyperlinkRId}`);
              
              // 清空原有文本节点
              for (const node of coveredNodes) { node._replaced = true; node._newText = ''; }
              let tempParaXml = rebuildParagraphXml(paraXml, nodes);
              
              // 插入超链接
              newParaXml = tempParaXml.replace(/<\/w:p>/, buildHyperlinkXml(hyperlinkRId, displayText, value) + '</w:p>');
              console.log(`✅ 文档超链接替换完成`);
            } else {
              console.warn(`⚠️ 空白 ${blank.id} 是文档URL但没有对应的超链接关系ID，插入为纯文本`);
              for (let i = 0; i < coveredNodes.length; i++) {
                coveredNodes[i]._replaced = true;
                coveredNodes[i]._newText = i === 0 ? escapeXml(value) : '';
              }
              newParaXml = rebuildParagraphXml(paraXml, nodes);
            }
          } else {
            for (let i = 0; i < coveredNodes.length; i++) {
              coveredNodes[i]._replaced = true;
              coveredNodes[i]._newText = i === 0 ? escapeXml(value) : '';
            }
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

// ===================== Public helpers =====================

// 🚀🚀🚀 同步升级：为左侧预览提供准确标签
export function extractIndexedParagraphs(xmlString) {
  const paragraphs = [];
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  let paraIndex = 0;

  const cellInfos = buildTableStructureMap(xmlString);
  const tableParaSet = new Set();
  const paraToLabel = new Map();

  for (const cell of cellInfos) {
    tableParaSet.add(cell.paraIndex);
    if (cell.cellText === '' || /^[\s　_－-]+$/.test(cell.cellText)) {
      if (cell.rowIndex === 0) continue;
      
      let label = '';
      if (cell.headerText && cell.rowHeader && cell.headerText !== cell.rowHeader) {
        label = `${cell.headerText}（项：${cell.rowHeader}）`;
      } else if (cell.headerText) {
        label = cell.headerText;
      } else if (cell.rowHeader) {
        label = cell.rowHeader;
      }
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
      if (label && !/^[0-9]+$/.test(label)) { // 同样过滤掉纯数字标签
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
      merged.push({ 
        ...aiBlank, 
        id: `blank_ai_${merged.length + 1}`, 
        confidence: aiBlank.confidence || 'medium',
        fill_role: aiBlank.fill_role || determineFillRole(aiBlank.context || '', aiBlank.type || ''),
        index: computedIndex >= 0 ? computedIndex : 0
      });
      existingKeys.add(key);
    }
  });
  return merged;
}

export function extractParagraphsForPreview(xmlString, blanks) {
  const paragraphs = [];
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  let paraIndex = 0;

  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const xml = paraMatch[0];
    const text = getVisibleTextFromXml(xml).trim();
    const matchedBlanks = blanks.filter(b => b.paraIndex === paraIndex);

    if (text.length > 0 || matchedBlanks.length > 0) {
      let displayText = text;
      
      const attachmentBlanks = matchedBlanks.filter(b => b.type === 'attachment');
      if (attachmentBlanks.length > 0) {
        displayText += ' ' + attachmentBlanks.map(b => b.matchText).join(' ');
      }

      if (displayText.length === 0 && matchedBlanks.length > 0) {
        displayText = matchedBlanks[0].context; 
      }
      paragraphs.push({ text: displayText || '[空段落]', blankIds: matchedBlanks.map(b => b.id) });
    }
    paraIndex++;
  }
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

// ===================== Async export with image injection =====================

export async function generateFilledDocx(zip, modifiedXml, blanks, filledValues, imageUrlMap = {}) {
  console.log('🔍 [generateFilledDocx] 开始生成填充的Word文档');
  console.log('🔍 传入参数:', { 
    blanksCount: blanks.length, 
    filledValuesCount: Object.keys(filledValues).length,
    imageUrlMapCount: Object.keys(imageUrlMap).length 
  });
  console.log('🔍 imageUrlMap内容:', imageUrlMap);
  
  const imageRidMap = {};
  const hyperlinkRidMap = {};
  const imageEntries = [];
  const hyperlinkEntries = [];

  for (const blank of blanks) {
    let val = filledValues[blank.id];
    console.log(`🔍 检查空白 ${blank.id}:`, { 
      value: val, 
      isImageUrl: isImageUrl(val),
      isDocumentUrl: isDocumentUrl(val),
      blankType: blank.type,
      matchText: blank.matchText,
      context: blank.context?.substring(0, 50) + '...'
    });
    
    // 如果是占位符，替换为真实URL
    if (val && typeof val === 'string' && val.startsWith('{{IMG_')) {
      console.log(`🔍 空白 ${blank.id} 包含占位符: "${val}"`);
      // 查找匹配的占位符（使用模糊匹配）
      for (const [placeholder, realUrl] of Object.entries(imageUrlMap)) {
        // 标准化比较
        const normalizedVal = normalizeProductName(val);
        const normalizedPlaceholder = normalizeProductName(placeholder);
        
        if (normalizedVal.includes(normalizedPlaceholder)) {
          console.log(`✅ 找到占位符匹配: ${placeholder} -> ${realUrl}`);
          // 使用正则表达式替换，忽略空格差异
          const oldVal = val;
          const regex = buildPlaceholderRegex(placeholder);
          const newVal = val.replace(regex, realUrl);
          
          console.log(`🔍 [generateFilledDocx] 替换测试: 正则表达式 ${regex}`);
          console.log(`🔍 [generateFilledDocx] 替换测试: 旧值 "${oldVal}"`);
          console.log(`🔍 [generateFilledDocx] 替换测试: 新值 "${newVal}"`);
          
          if (oldVal !== newVal) {
            val = newVal;
            console.log(`✅ [generateFilledDocx] 替换成功`);
          } else {
            console.log(`❌ [generateFilledDocx] 正则表达式替换失败，尝试直接替换`);
            // 如果正则表达式替换失败，尝试直接替换
            val = realUrl;
          }
          break;
        }
      }
      console.log(`🔍 空白 ${blank.id} 替换后值: "${val}"`);
    }
    
    // 收集图片条目
    if (val && isImageUrl(val)) {
      imageEntries.push({ blankId: blank.id, url: val.trim() });
    }
    
    // 收集文档URL条目（用于超链接）
    if (val && isDocumentUrl(val)) {
      hyperlinkEntries.push({ blankId: blank.id, url: val.trim() });
      console.log(`✅ 收集文档URL: ${blank.id} -> ${val.substring(0, 50)}...`);
    }
  }
  
  console.log('🔍 图片条目收集结果:', { imageEntriesCount: imageEntries.length, imageEntries });

  const fetchedImages = [];
  if (imageEntries.length > 0) {
    console.log('🔍 开始下载图片，共', imageEntries.length, '个图片需要下载');
    const results = await Promise.allSettled(
      imageEntries.map(async (entry) => {
        try {
          console.log(`🔍 下载图片 ${entry.blankId}: ${entry.url}`);
          const { buffer, mime } = await fetchImageAsArrayBuffer(entry.url);
          const { w, h } = await loadImageNaturalSize(buffer);
          console.log(`✅ 图片下载成功 ${entry.blankId}: ${w}x${h}, ${mime}`);
          return { ...entry, buffer, mime, naturalW: w, naturalH: h };
        } catch (error) {
          console.error(`❌ 图片下载失败 ${entry.blankId}:`, error.message);
          throw error;
        }
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        fetchedImages.push(r.value);
        console.log(`✅ 图片处理完成: ${r.value.blankId}`);
      } else {
        console.error('❌ 图片处理失败:', r.reason);
      }
    }
    console.log('🔍 图片下载结果:', { fetchedImagesCount: fetchedImages.length, fetchedImages });
  } else {
    console.log('🔍 没有需要下载的图片');
  }

  let relsObj = null;
  const IMAGE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
  const RELS_PATH = 'word/_rels/document.xml.rels';

  if (fetchedImages.length > 0) {
    console.log('🔍 开始将图片插入Word文档');
    let relsXml = zip.file(RELS_PATH)?.asText();
    if (!relsXml) {
      console.log('🔍 创建新的关系文件');
      relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    }
    relsObj = parseRelsXml(relsXml);
    console.log('🔍 关系文件解析完成，当前最大rId:', relsObj.maxId);

    let ctXml = zip.file('[Content_Types].xml')?.asText() || '';
    const ensureExt = (ext, mime) => {
      if (!ctXml.includes(`Extension="${ext}"`)) {
        console.log(`🔍 添加Content-Type: ${ext} -> ${mime}`);
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
      console.log(`🔍 写入图片文件: ${mediaFileName}, 大小: ${img.buffer.byteLength} bytes`);
      zip.file(mediaFileName, img.buffer);
      const rId = addRelationship(relsObj, target, IMAGE_REL_TYPE);
      const TARGET_PX = 160;
      const { cx, cy } = getImageDimensionsEmu(TARGET_PX, img.naturalW, img.naturalH);
      imageRidMap[img.blankId] = { rId, cxEmu: cx, cyEmu: cy };
      console.log(`✅ 图片 ${img.blankId} 映射到 rId: ${rId}, 尺寸: ${cx}x${cy} EMU`);
    }
    zip.file(RELS_PATH, relsObj.xml);
    console.log('🔍 关系文件更新完成，imageRidMap:', imageRidMap);
  } else {
    console.log('🔍 没有图片需要插入到Word文档');
  }

  // 处理超链接关系（如果需要）
  if (hyperlinkEntries.length > 0) {
    console.log('🔍 发现超链接条目，需要添加到关系文件:', hyperlinkEntries.length);
    
    // 确保有_rels文件
    let relsXml = zip.file(RELS_PATH)?.asText();
    if (!relsXml) {
      relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
      zip.file(RELS_PATH, relsXml);
    }
    
    const HYPERLINK_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
    let updatedRelsXml = relsXml;
    
    // 为每个超链接添加关系并创建映射
    hyperlinkEntries.forEach((entry, index) => {
      const rId = `rId_hyperlink_${index + 1}`;
      // 在</Relationships>标签前插入关系
      updatedRelsXml = updatedRelsXml.replace('</Relationships>', 
        `<Relationship Id="${rId}" Type="${HYPERLINK_REL_TYPE}" Target="${entry.url}" TargetMode="External"/>\n</Relationships>`);
      
      // 创建超链接ID映射
      hyperlinkRidMap[entry.blankId] = rId;
      
      console.log(`✅ 添加超链接关系: ${rId} -> ${entry.url.substring(0, 50)}..., 映射到空白ID: ${entry.blankId}`);
    });
    
    zip.file(RELS_PATH, updatedRelsXml);
    console.log('🔍 超链接关系添加完成, hyperlinkRidMap:', hyperlinkRidMap);
  }

  const finalXml = replaceBlanksInXml(modifiedXml, blanks, filledValues, imageRidMap, hyperlinkRidMap);
  zip.file('word/document.xml', finalXml);
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}