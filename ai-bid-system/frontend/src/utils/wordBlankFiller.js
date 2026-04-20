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

function isStructuralEmptyParagraph(paragraphXml = '') {
  if (!paragraphXml) return false;

  const visibleText = getVisibleTextFromXml(paragraphXml).replace(/[\s\u3000]/g, '');
  if (visibleText.length > 0) return false;

  // 节分隔、书签、仅段落属性这类“视觉留白段”也视为可填写留白。
  return /<w:sectPr[\s>]|<w:bookmarkStart[\s>]|<w:bookmarkEnd[\s>]|<w:pPr[\s>]/.test(paragraphXml);
}

function isStandaloneLabelParagraph(text = '') {
  const normalized = String(text || '').replace(/\s+/g, '').trim();
  if (!normalized) return false;

  return /(?:签字或盖章|签字|盖章|法人公章|法定代表人|被授权人|委托代理人|授权代表|投标人|职务|日期|年月日)[：:]?$/.test(normalized);
}

function isDateLikeLabel(text = '') {
  const normalized = String(text || '').replace(/\s+/g, '').trim();
  if (!normalized) return false;
  return /^(?:投标)?日期[：:]?$|^年月日[：:]?$/.test(normalized);
}

function isDateLikeBlankContent(text = '') {
  const normalized = String(text || '').replace(/\s+/g, '').trim();
  if (!normalized) return false;

  return /(?:投标)?日期|年月日|成立日期|出生日期|注册日期|签字生效|有效期|自.*?年.*?月.*?日.*?至.*?年.*?月.*?日|于.*?年.*?月.*?日/.test(normalized);
}

export function filterIgnoredBlanks(blanks = []) {
  return blanks.filter((blank) => {
    const haystack = `${blank.context || ''} ${blank.markedContext || ''} ${blank.matchText || ''} ${blank.auditFieldHint || ''} ${blank.fieldHint || ''}`;
    return !isDateLikeBlankContent(haystack);
  });
}

function getVisibleTextFromXml(xml) {
  if (!xml) return '';
  let cleanXml = xml.replace(/<mc:Fallback[\s\S]*?<\/mc:Fallback>/g, '');
  cleanXml = cleanXml.replace(/<w:del[\s\S]*?<\/w:del>/g, '');

  const textParts = [];
  // 💡 增加对 <w:br/> (软回车) 的识别
  const NODE_REGEX = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab(?:\s[^>]*)?\/>|<w:br(?:\s[^>]*)?\/>/g;
  let m;
  while ((m = NODE_REGEX.exec(cleanXml)) !== null) {
    if (m[0].startsWith('<w:tab')) {
      textParts.push('    ');
    } else if (m[0].startsWith('<w:br')) {
      textParts.push('\n'); // 将软回车转为物理换行符
    } else {
      textParts.push(m[1]);
    }
  }
  return textParts.join('');
}

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

        let span = 1;
        const spanMatch = tcXml.match(/<w:gridSpan w:val="(\d+)"/);
        if (spanMatch) span = parseInt(spanMatch[1], 10);

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
            headerText: columnHeaders[colIndex] || '',
            rowHeader
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

// 获取表格同行左侧相邻单元格的文本
const getAdjacentCellLabel = (currentCellInfo, allCellInfos) => {
  if (!currentCellInfo || typeof currentCellInfo.rowIndex !== 'number' || typeof currentCellInfo.colIndex !== 'number') {
    return null;
  }
  const prevCell = allCellInfos.find(c => 
    c.rowIndex === currentCellInfo.rowIndex && 
    c.colIndex === currentCellInfo.colIndex - 1
  );
  if (prevCell && prevCell.cellText) {
    return prevCell.cellText.replace(/[\r\n\t]+/g, '').trim();
  }
  return null;
};

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
const CM_TO_EMU = 360000;
function getImageDimensionsEmu(pxWidth, naturalW, naturalH) {
  const cx = Math.round(pxWidth * PX_TO_EMU);
  const ratio = naturalH / naturalW;
  return { cx, cy: Math.round(cx * ratio) };
}

function getCmDimensionsEmu(widthCm, heightCm) {
  return {
    cx: Math.round(widthCm * CM_TO_EMU),
    cy: Math.round(heightCm * CM_TO_EMU)
  };
}

function detectImageInsertType(blank = {}, imageUrl = '', naturalW = 0, naturalH = 0) {
  const text = `${blank.context || ''} ${blank.markedContext || ''} ${imageUrl || ''}`.toLowerCase();
  const isPortrait = naturalH > naturalW * 1.15;
  if (/身份证|身份证正面|身份证反面|人像面|国徽面|法人身份证/.test(text)) return 'id_card';
  if (/营业执照/.test(text)) return 'business_license';
  if (/学位证|毕业证|学历/.test(text)) return 'degree';
  if (/资质证书|证书|许可证|认证证书|检验报告|检测报告|iso|体系认证/.test(text)) return 'certificate';
  if (isPortrait && /系统|网关|平台|软件|硬件|产品|v\d+(?:\.\d+)?|xt电子邮件系统|邮件安全卫士|coremail|cacter/i.test(text)) return 'certificate';
  return 'generic';
}

function getImageSizeStrategy(type, naturalW, naturalH) {
  const safeW = naturalW || 400;
  const safeH = naturalH || 300;
  if (type === 'id_card') return getCmDimensionsEmu(7.05, 5.07);
  if (type === 'business_license') return getCmDimensionsEmu(14.65, 9.5);
  if (type === 'certificate') return getCmDimensionsEmu(14.64, 20.63);
   if (type === 'degree') return getCmDimensionsEmu(14.5, 10.56);
  return getImageDimensionsEmu(220, safeW, safeH);
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

  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  const paragraphs = [...xmlString.matchAll(paragraphRegex)];
  let paraMatch;
  let currentParaIndex = 0;

  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const text = getVisibleTextFromXml(paraMatch[0]);

    if (text.trim().length > 0) {
      let m;

      // 识别"复读机式"占位符
      const repeatedKeywordPattern = /(单位名称|单位性质|地\s*址|经营期限|法定代表人)[:：]\s*\1[:：]?/g;
      while ((m = repeatedKeywordPattern.exec(text)) !== null) {
        const markedCtx = text.substring(0, m.index) + '【🎯】' + text.substring(m.index + m[0].length);
        const isDuplicate = blanks.some(b => b.paraIndex === currentParaIndex && b.index === m.index && b.type === 'repeated_keyword');
        if (!isDuplicate) {
          blanks.push({ id: `blank_${++blankCounter}`, context: text, markedContext: markedCtx, matchText: m[1], index: m.index, type: 'repeated_keyword', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text) });
        }
      }

      // 识别纯文字贴图提示
      const imagePlaceholderPattern1 = /贴.*(?:复印件|扫描件|照片|图片)处/;
      const imagePlaceholderPattern2 = /(?:复印件|扫描件|证明文件)粘贴处/;
    if ((imagePlaceholderPattern1.test(text) || imagePlaceholderPattern2.test(text)) &&
          !blanks.some(b => b.paraIndex === currentParaIndex && b.type === 'image_placeholder')) {
        blanks.push({
          id: `blank_${++blankCounter}`,
          context: text,
          markedContext: "[图片插入位置：]【🎯】",
          matchText: text,
          index: 0,
          type: 'image_placeholder',
          confidence: 'high',
          paraIndex: currentParaIndex,
          fill_role: 'auto'
        });
      }

      const colonEndPattern = /([^：:\n]{2,120})([：:])\s*$/;
      const colonEndMatch = text.match(colonEndPattern);
      if (colonEndMatch && !isDateLikeLabel(text)) {
        const colonIndex = text.lastIndexOf(colonEndMatch[2]);
        blanks.push({
          id: `blank_${++blankCounter}`,
          context: text,
          markedContext: `${text.slice(0, colonIndex + 1)}【🎯】`,
          matchText: '',
          index: colonIndex + 1,
          textStart: colonIndex + 1,
          textEnd: colonIndex + 1,
          type: 'keyword_space',
          confidence: 'medium',
          paraIndex: currentParaIndex,
          fill_role: determineFillRole(text)
        });
      }

      // 坐标切片生成 markedContext (下划线)
      const underscorePattern = /_{2,}/g;
      while ((m = underscorePattern.exec(text)) !== null) {
        const markedCtx = text.substring(0, m.index) + '【🎯】' + text.substring(m.index + m[0].length);
        blanks.push({ id: `blank_${++blankCounter}`, context: text, markedContext: markedCtx, matchText: m[0], index: m.index, type: 'underscore', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text) });
      }

      // 坐标切片生成 markedContext (短横线)
      const dashPattern = /-{3,}/g;
      while ((m = dashPattern.exec(text)) !== null) {
        const markedCtx = text.substring(0, m.index) + '【🎯】' + text.substring(m.index + m[0].length);
        blanks.push({ id: `blank_${++blankCounter}`, context: text, markedContext: markedCtx, matchText: m[0], index: m.index, type: 'dash', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text) });
      }

      // 坐标切片生成 markedContext (关键词+长空格)
      const spacePattern = /([：:])(\s{3,})/g;
      while ((m = spacePattern.exec(text)) !== null) {
        const colonStr = m[1];
        const spaceStr = m[2];
        const spaceIndex = m.index + colonStr.length; 
        const markedCtx = text.substring(0, spaceIndex) + '【🎯】' + text.substring(spaceIndex + spaceStr.length);
        blanks.push({ id: `blank_${++blankCounter}`, context: text, markedContext: markedCtx, matchText: spaceStr, index: spaceIndex, type: 'keyword_space', confidence: 'medium', paraIndex: currentParaIndex, fill_role: determineFillRole(text) });
      }

      // 坐标切片生成 markedContext (括号填空)
      const roundBracketPattern = /[（(]\s*(盖章处|签章处|盖章|签字|请填写[^）)]*|待补充|待定|填写[^）)]*|请盖章)\s*[)）]/g;
      while ((m = roundBracketPattern.exec(text)) !== null) {
        const markedCtx = text.substring(0, m.index) + '【🎯】' + text.substring(m.index + m[0].length);
        blanks.push({ id: `blank_${++blankCounter}`, context: text, markedContext: markedCtx, matchText: m[0], index: m.index, type: 'brackets', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text) });
      }

      const squareBracketPattern = /[[【]\s*(填写[^\]】]*|待补充|待定|请填写[^\]】]*)\s*[\]】]/g;
      while ((m = squareBracketPattern.exec(text)) !== null) {
        const markedCtx = text.substring(0, m.index) + '【🎯】' + text.substring(m.index + m[0].length);
        blanks.push({ id: `blank_${++blankCounter}`, context: text, markedContext: markedCtx, matchText: m[0], index: m.index, type: 'brackets', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text) });
      }

      const placeholderPattern = /待补充|待填/g;
      while ((m = placeholderPattern.exec(text)) !== null) {
        const markedCtx = text.substring(0, m.index) + '【🎯】' + text.substring(m.index + m[0].length);
        blanks.push({ id: `blank_${++blankCounter}`, context: text, markedContext: markedCtx, matchText: m[0], index: m.index, type: 'placeholder', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text) });
      }

      const attachmentKeywords = ['营业执照', '审计报告', '资信证明', '法人证书', '资质证书', '财务报表', '无重大违法记录', '资格证明文件', '声明', '承诺函'];
      const hasAttachmentHint = attachmentKeywords.some(kw => text.includes(kw));
      const hasBlankMarker = /_{3,}|-{4,}|[：:]\s{3,}/.test(text);
      const isRequirement = /复印件|原件|提供|出具|须具备|副本|声明|加盖公章/.test(text) || hasBlankMarker;
      const alreadyHasBlank = blanks.some(
        b => b.paraIndex === currentParaIndex && 
             ['underscore', 'dash', 'keyword_space', 'brackets', 'placeholder', 'image_placeholder', 'repeated_keyword'].includes(b.type)
      );

      if (hasAttachmentHint && isRequirement && !alreadyHasBlank && text.length > 5 && text.length < 300) {
        blanks.push({
          id: `blank_${++blankCounter}`,
          context: text,
          markedContext: "【🎯】" + text,
          matchText: '[附件/资质插入位]',
          index: text.length, 
          type: 'attachment',
          confidence: 'high',
          paraIndex: currentParaIndex,
          fill_role: 'auto' 
        });
      }

      const nextParagraphXml = paragraphs[currentParaIndex + 1]?.[0] || '';
      const shouldInferBlankAfterLabel =
        isStandaloneLabelParagraph(text) &&
        !isDateLikeLabel(text) &&
        isStructuralEmptyParagraph(nextParagraphXml) &&
        !alreadyHasBlank;

      if (shouldInferBlankAfterLabel) {
        const colonMatch = text.match(/[：:]/);
        const colonIndex = colonMatch ? text.lastIndexOf(colonMatch[0]) : text.length;
        blanks.push({
          id: `blank_${++blankCounter}`,
          context: text,
          markedContext: `${text.slice(0, colonIndex + (colonMatch ? 1 : 0))}【🎯】`,
          matchText: '',
          index: colonIndex + (colonMatch ? 1 : 0),
          textStart: colonIndex + (colonMatch ? 1 : 0),
          textEnd: colonIndex + (colonMatch ? 1 : 0),
          type: 'keyword_space',
          confidence: 'medium',
          paraIndex: currentParaIndex,
          fill_role: determineFillRole(text),
          inferredFromNextParagraph: true
        });
      }
    }
    currentParaIndex++;
  }

  const cellInfos = buildTableStructureMap(xmlString);
  
  const cellInfoMap = new Map();
  for (const cell of cellInfos) {
    if (cell.paraIndex !== undefined) cellInfoMap.set(cell.paraIndex, cell);
  }

  for (const blank of blanks) {
    if (!['underscore', 'dash', 'keyword_space', 'spaces'].includes(blank.type)) continue;
    const cellInfo = cellInfoMap.get(blank.paraIndex);
    if (!cellInfo) continue;

    const currentText = blank.context.replace('【🎯】', '').replace(/[_－\-\s]/g, '').trim();
    const chineseChars = (currentText.match(/[\u4e00-\u9fa5]/g) || []).length;
    
    if (chineseChars < 3) {
      let label = getAdjacentCellLabel(cellInfo, cellInfos);
      if (!label && cellInfo.rowHeader) label = cellInfo.rowHeader;
      if (!label && cellInfo.headerText) label = cellInfo.headerText;

      if (label) {
        blank.context = `${label}：${blank.context}`;
        if (blank.markedContext) blank.markedContext = `${label}：${blank.markedContext}`;
        blank._tableContextEnhanced = true;
      }
    }
  }

  for (const cell of cellInfos) {
    if (cell.cellText !== '' && !/^[\s\u3000_－-]+$/.test(cell.cellText)) continue;
    if (cell.rowIndex === 0) continue;

    let label = '';
    if (cell.headerText && cell.rowHeader && cell.headerText !== cell.rowHeader) {
      label = `${cell.headerText}（项：${cell.rowHeader}）`;
    } else if (cell.headerText) {
      label = cell.headerText;
    } else if (cell.rowHeader) {
      label = cell.rowHeader;
    }

    if (!label || /^[0-9]+$/.test(label)) continue;

    const context = `${label}：[空白单元格]`;
    blanks.push({
      id: `blank_${++blankCounter}`,
      context,
      markedContext: `${label}：【🎯】`,
      matchText: '[空白单元格]',
      _cellLabel: label,
      index: label.length + 1, 
      type: 'empty_cell',
      confidence: 'medium',
      paraIndex: cell.paraIndex,
      fill_role: determineFillRole(label)
    });
  }

  const uniqueBlanks = [];
  const seen = new Set();
  for (const b of blanks) {
    let key;
    if (b.type === 'repeated_keyword') {
      key = `${b.paraIndex}::${b.type}::${b.index}`;
    } else if (b.type === 'image_placeholder') {
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
  return uniqueBlanks;
}

function buildTextNodeMap(paragraphXml) {
  // 💡 增加第五个捕获组，用于捕获 <w:br/>
  const NODE_REGEX = /(<w:t(?:\s[^>]*)?>)([^<]*)(<\/w:t>)|(<w:tab(?:\s[^>]*)?\/>)|(<w:br(?:\s[^>]*)?\/>)/g;
  const nodes = [];
  let offset = 0;
  let m;
  
  while ((m = NODE_REGEX.exec(paragraphXml)) !== null) {
    if (m[4]) {
      const text = '    ';
      nodes.push({ fullMatch: m[0], openTag: '', text, closeTag: '', matchStart: m.index, matchEnd: m.index + m[0].length, textStart: offset, textEnd: offset + text.length, isTab: true });
      offset += text.length;
    } else if (m[5]) {
      const text = '\n'; // 处理软回车节点
      nodes.push({ fullMatch: m[0], openTag: '', text, closeTag: '', matchStart: m.index, matchEnd: m.index + m[0].length, textStart: offset, textEnd: offset + text.length, isTab: false, isBr: true });
      offset += text.length;
    } else {
      const text = m[2]; 
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
        newFull = node._newText ? `<w:t>${node._newText}</w:t>` : '';
      } else {
        newFull = node.openTag + node._newText + node.closeTag;
      }
      const oldStart = node.matchStart + delta;
      const oldEnd = oldStart + node.fullMatch.length;
      result = result.substring(0, oldStart) + newFull + result.substring(oldEnd);
      delta += newFull.length - node.fullMatch.length;
    }else if (node.isBr) { newFull = node._newText ? '<w:t>' + node._newText + '</w:t>' : ''; }
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

function getExpandedPlaceholderRange(fullText, start, blank) {
  const matchText = blank.matchText || '';
  let rangeStart = start;
  let rangeEnd = start + matchText.length;
  if (blank.type === 'underscore') {
    while (rangeStart > 0 && /[_＿]/.test(fullText[rangeStart - 1])) rangeStart -= 1;
    while (rangeEnd < fullText.length && /[_＿]/.test(fullText[rangeEnd])) rangeEnd += 1;
  } else if (blank.type === 'dash') {
    while (rangeStart > 0 && /[-－—─﹣]/.test(fullText[rangeStart - 1])) rangeStart -= 1;
    while (rangeEnd < fullText.length && /[-－—─﹣]/.test(fullText[rangeEnd])) rangeEnd += 1;
  }
  return { start: rangeStart, end: rangeEnd };
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
    if (insertNode) overlappingNodes = [insertNode];
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
    node._newText = i === 0 ? prefix + safeReplacement + suffix : prefix + suffix;
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
      
      if (blankPos === -1 || blank.type === 'attachment') {
        if (blank.type !== 'attachment' && replaceTextRangeInNodes(nodes, blank.index || fullText.length, blank.index || fullText.length, !isImage && !isDocUrl ? escapeXml(value) : '')) {
          let tempParaXml = rebuildParagraphXml(paraXml, nodes);
          if (isImage) {
            const imgInfo = imageRidMap[blank.id];
            newParaXml = tempParaXml.replace(/<\/w:p>/, buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu) + '</w:p>');
          } else if (isDocUrl) {
            const displayText = getDisplayTextFromUrl(value, blank.context);
            if (hyperlinkRId) {
              newParaXml = tempParaXml.replace(/<\/w:p>/, buildHyperlinkXml(hyperlinkRId, displayText, value) + '</w:p>');
            } else {
              newParaXml = tempParaXml;
            }
          } else {
            newParaXml = tempParaXml;
          }
        } else if (isImage) {
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
        const expandedRange = getExpandedPlaceholderRange(fullText, blankPos, blank);
        let coveredNodes = getOverlappingNodes(nodes, expandedRange.start, expandedRange.end);
        
        // 🐛 BUG 修复：针对冒号后直接为空（0长度插入，start === end）的极端边界情况
        // 因为 getOverlappingNodes 在边界上会返回空数组，导致替换逻辑直接被跳过，致使数据丢失
        if (coveredNodes.length === 0 && expandedRange.start === expandedRange.end) {
          const insertNode = nodes.find((node) => expandedRange.start >= node.textStart && expandedRange.start <= node.textEnd);
          if (insertNode) coveredNodes = [insertNode];
        }
        if (coveredNodes.length > 0) {
          if (isImage) {
            const imgInfo = imageRidMap[blank.id];
            for (const node of coveredNodes) { node._replaced = true; node._newText = ''; }
            let tempParaXml = rebuildParagraphXml(paraXml, nodes);
            newParaXml = tempParaXml.replace(/<\/w:p>/, buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu) + '</w:p>');
          } else if (isDocUrl) {
            const displayText = getDisplayTextFromUrl(value, blank.context);
            if (hyperlinkRId) {
              for (const node of coveredNodes) { node._replaced = true; node._newText = ''; }
              let tempParaXml = rebuildParagraphXml(paraXml, nodes);
              newParaXml = tempParaXml.replace(/<\/w:p>/, buildHyperlinkXml(hyperlinkRId, displayText, value) + '</w:p>');
            } else {
              for (let i = 0; i < coveredNodes.length; i++) {
                coveredNodes[i]._replaced = true;
                coveredNodes[i]._newText = i === 0 ? escapeXml(value) : '';
              }
              newParaXml = rebuildParagraphXml(paraXml, nodes);
            }
          } else {
            replaceTextRangeInNodes(nodes, expandedRange.start, expandedRange.end, escapeXml(value));
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

  for (const cell of cellInfos) {
    tableParaSet.add(cell.paraIndex);
    if (cell.cellText === '' || /^[\s\u3000_－-]+$/.test(cell.cellText)) {
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
      if (label && !/^[0-9]+$/.test(label)) {
        paragraphs.push({ paraIndex, text: `${label}：[空白单元格]`, xml });
      }
    }
    paraIndex++;
  }
  return paragraphs;
}

// ====== 替换 wordBlankFiller.js 最底部的 mergeBlanks 函数 ======

export function mergeBlanks(regexBlanks, aiBlanks) {
  const merged = [...regexBlanks];
  
  const regexParaMatches = new Set();
  const regexParaHasLines = new Set();
  
  regexBlanks.forEach(b => {
    // 剔除所有空格后记录，防止 AI 扫描因多一个空格导致去重失败
    const matchTrim = (b.matchText || '').replace(/\s+/g, '');
    regexParaMatches.add(`${b.paraIndex}|${matchTrim}`);
    if (b.type === 'underscore' || b.type === 'dash') {
      regexParaHasLines.add(b.paraIndex);
    }
  });

  aiBlanks.forEach(aiBlank => {
    const matchTrim = (aiBlank.matchText || '').replace(/\s+/g, '');
    const key = `${aiBlank.paraIndex}|${matchTrim}`;
    
    // 1. 去重：正则已经找到完全一样的填空词，坚决丢弃！
    if (regexParaMatches.has(key)) return;
    
    // 2. 去重：如果 AI 找到的仅仅是下划线，且该段落正则已经扫过下划线，直接拦截！
    const isJustLines = /^[_－\-\s]+$/.test(aiBlank.matchText || '');
    if (isJustLines && regexParaHasLines.has(aiBlank.paraIndex)) return;
    
    const computedIndex = aiBlank.index ?? 
      (aiBlank.context && aiBlank.matchText ? aiBlank.context.indexOf(aiBlank.matchText) : -1);
        
    // 3. 强行给 AI 扫描的空白补上靶心 markedContext
    let markedCtx = aiBlank.markedContext;
    if (!markedCtx && aiBlank.context && aiBlank.matchText) {
      if (computedIndex >= 0) {
         markedCtx = aiBlank.context.substring(0, computedIndex) + '【🎯】' + aiBlank.context.substring(computedIndex + aiBlank.matchText.length);
      } else {
         markedCtx = aiBlank.context.replace(aiBlank.matchText, '【🎯】');
      }
    }
    
    merged.push({ 
      ...aiBlank, 
      id: `blank_ai_${merged.length + 1}`, 
      confidence: aiBlank.confidence || 'medium',
      fill_role: aiBlank.fill_role || determineFillRole(aiBlank.context || '', aiBlank.type || ''),
      index: computedIndex >= 0 ? computedIndex : 0,
      markedContext: markedCtx || (aiBlank.context + '【🎯】')
    });
    
    regexParaMatches.add(key);
  });
  
  // ================= 🚨 新增：严格排序与动态序号计算 =================
  // 将所有填空题严格按照物理文档的阅读顺序排序
  merged.sort((a, b) => {
    // 1. 先按段落先后排序
    if (a.paraIndex !== b.paraIndex) return (a.paraIndex || 0) - (b.paraIndex || 0);
    // 2. 同一段落内，按字符坐标(index)从左到右排序
    return (a.index || 0) - (b.index || 0);
  });

  // 动态分配段落内的第几空（blankOrdinalInParagraph）
  let currentPara = -1;
  let ordinal = 1;
  merged.forEach(b => {
    if (b.paraIndex !== currentPara) {
      currentPara = b.paraIndex;
      ordinal = 1; // 遇到新段落，重新从 1 开始计数
    }
    b.blankOrdinalInParagraph = ordinal++;
  });
  // ====================================================================

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
      imageEntries.push({ blankId: blank.id, url: val.trim(), blank });
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
      const imageType = detectImageInsertType(img.blank, img.url, img.naturalW, img.naturalH);
      const { cx, cy } = getImageSizeStrategy(imageType, img.naturalW, img.naturalH);
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
