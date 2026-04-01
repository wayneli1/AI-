import PizZip from 'pizzip';

const BLANK_KEYWORDS = [
  '供应商', '投标人', '报价人', '中标人', '承包商', '厂商',
  '甲方', '乙方', '买方', '卖方', '采购人', '招标人',
  '名称', '公司', '单位', '法定代表人', '授权代表', '委托代理人', '代理人',
  '地址', '邮政编码', '邮编', '电话', '传真', '联系人', '手机',
  '开户银行', '银行账号', '账号', '开户行', '税号',
  '签字', '盖章', '签名', '签章', '公章', '印章',
  '日期', '时间', '期限', '有效期',
  '报价', '总价', '合计', '金额', '合同价', '投标价', '价格',
  '项目名称', '项目编号', '标段', '包号',
  '规格', '型号', '品牌', '产地', '制造商',
  '数量', '单价', '交货期', '质保期',
  '备注', '说明', '承诺', '响应',
  '合同编号', '合同名称', '合同金额',
  '收货人', '送货人', '验收人', '验收单位', '送货单位', '收货单位',
  '承包商', '单位名称', '签约', '签订',
  '大写', '小写', '人民币', '元',
  '序号', '项目', '货物', '服务', '内容', '备注'
];

function getVisibleTextFromXml(xml) {
  const textParts = [];
  const textRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m;
  while ((m = textRegex.exec(xml)) !== null) {
    textParts.push(m[1]);
  }
  return textParts.join('');
}

function buildTableStructureMap(xmlString) {
  const cellInfos = [];
  const rowRegex = /<w:tr[\s>]([\s\S]*?)<\/w:tr>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(xmlString)) !== null) {
    const rowXml = rowMatch[0];
    const rowStartGlobal = rowMatch.index;

    const tcRegex = /<w:tc[\s>]([\s\S]*?)<\/w:tc>/g;
    let tcMatch;
    while ((tcMatch = tcRegex.exec(rowXml)) !== null) {
      const tcXml = tcMatch[0];
      const tcLocalOffset = tcMatch.index;
      const tcGlobalOffset = rowStartGlobal + tcLocalOffset;

      const pRegex = /<w:p[\s>]([\s\S]*?)<\/w:p>/g;
      let pMatch;
      while ((pMatch = pRegex.exec(tcXml)) !== null) {
        const pLocalOffset = pMatch.index;
        const pGlobalOffset = tcGlobalOffset + pLocalOffset;
        const paraIdx = countParagraphsBefore(xmlString, pGlobalOffset);
        const text = getVisibleTextFromXml(pMatch[0]).trim();

        cellInfos.push({
          paraIndex: paraIdx,
          cellXml: tcXml,
          cellLocalOffset: tcLocalOffset,
          rowXml,
          rowLocalStart: 0,
          cellText: text,
          cellGlobalOffset: tcGlobalOffset
        });
      }
    }
  }
  return cellInfos;
}

function countParagraphsBefore(xmlString, globalOffset) {
  const slice = xmlString.substring(0, globalOffset);
  return (slice.match(/<w:p[\s>]/g) || []).length;
}

function getPreviousCellLabel(rowXml, currentCellLocalOffset) {
  const tcRegex = /<w:tc[\s>]([\s\S]*?)<\/w:tc>/g;
  let tcMatch;
  let prevText = '';
  while ((tcMatch = tcRegex.exec(rowXml)) !== null) {
    if (tcMatch.index >= currentCellLocalOffset) break;
    const text = getVisibleTextFromXml(tcMatch[0]).trim();
    if (text) {
      prevText = text;
    }
  }
  return prevText;
}

function isImageUrl(value) {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  return /^https?:\/\/.+\.(png|jpg|jpeg|gif|bmp|webp|svg)(\?.*)?$/i.test(v)
    || /^https?:\/\/.+\.(png|jpg|jpeg|gif|bmp|webp|svg)$/i.test(v)
    || /^https?:\/\/.*\/storage\/v1\/object\/public\//i.test(v);
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
  const cy = Math.round(cx * ratio);
  return { cx, cy };
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
      let foundBlanksInPara = false;

      const underscorePattern = /_{3,}/g;
      let m;
      while ((m = underscorePattern.exec(text)) !== null) {
        if (m[0].length >= 2) {
          blanks.push({
            id: `blank_${++blankCounter}`, context: text,
            matchText: m[0], index: m.index, type: 'underscore',
            confidence: 'high', paraIndex: currentParaIndex
          });
          foundBlanksInPara = true;
        }
      }

      const dashPattern = /-{4,}/g;
      while ((m = dashPattern.exec(text)) !== null) {
        if (m[0].length >= 3) {
          blanks.push({
            id: `blank_${++blankCounter}`, context: text,
            matchText: m[0], index: m.index, type: 'dash',
            confidence: 'high', paraIndex: currentParaIndex
          });
          foundBlanksInPara = true;
        }
      }

      const datePatterns = [ /\s{2,}年\s*月\s*日/g, /\s{2,}年\s{2,}月\s{2,}日/g, /\s*年\s+月\s+日/g ];
      for (const dp of datePatterns) {
        while ((m = dp.exec(text)) !== null) {
          blanks.push({
            id: `blank_${++blankCounter}`, context: text,
            matchText: m[0], index: m.index, type: 'date_pattern',
            confidence: 'high', paraIndex: currentParaIndex
          });
          foundBlanksInPara = true;
        }
      }

      const spacePattern = /([：:])(\s{3,})/g;
      while ((m = spacePattern.exec(text)) !== null) {
        const colonStr = m[1];
        const spaceStr = m[2];
        const spaceIndex = m.index + colonStr.length; 
        const before = text.substring(Math.max(0, spaceIndex - 30), spaceIndex);
        if (BLANK_KEYWORDS.some(kw => before.includes(kw))) {
          blanks.push({
            id: `blank_${++blankCounter}`, context: text,
            matchText: spaceStr, index: spaceIndex, type: 'keyword_space',
            confidence: 'medium', paraIndex: currentParaIndex
          });
          foundBlanksInPara = true;
        }
      }

      const roundBracketPattern = /[（(]\s*(盖章处|签章处|盖章|签字|请填写[^）)]*|待补充|待定|填写[^）)]*|请盖章)\s*[)）]/g;
      while ((m = roundBracketPattern.exec(text)) !== null) {
        blanks.push({
          id: `blank_${++blankCounter}`, context: text,
          matchText: m[0], index: m.index, type: 'brackets',
          confidence: 'high', paraIndex: currentParaIndex
        });
        foundBlanksInPara = true;
      }

      const squareBracketPattern = /[\[【]\s*(填写[^\]】]*|待补充|待定|请填写[^\]】]*)\s*[\]】]/g;
      while ((m = squareBracketPattern.exec(text)) !== null) {
        blanks.push({
          id: `blank_${++blankCounter}`, context: text,
          matchText: m[0], index: m.index, type: 'brackets',
          confidence: 'high', paraIndex: currentParaIndex
        });
        foundBlanksInPara = true;
      }

      const placeholderPattern = /待补充|待填/g;
      while ((m = placeholderPattern.exec(text)) !== null) {
        blanks.push({
          id: `blank_${++blankCounter}`, context: text,
          matchText: m[0], index: m.index, type: 'placeholder',
          confidence: 'high', paraIndex: currentParaIndex
        });
        foundBlanksInPara = true;
      }

      // 💡 终极杀招：资质附件类暗示（无中生有生成虚拟占位符贴图）
      const attachmentKeywords = ['营业执照', '营业执照复印件', '审计报告', '资信证明', '法人证书', '资质证书', '财务报表', '无重大违法记录', '资格证明文件', '声明', '承诺函'];
      const hasAttachmentHint = attachmentKeywords.some(kw => text.includes(kw));
      const isRequirement = /复印件|原件|提供|出具|须具备|副本|声明|加盖公章/.test(text);

      if (!foundBlanksInPara && hasAttachmentHint && isRequirement && text.length > 5 && text.length < 300) {
        blanks.push({
          id: `blank_${++blankCounter}`,
          context: text,
          matchText: '[附件/资质插入位]', 
          index: text.length, 
          type: 'attachment',
          confidence: 'high',
          paraIndex: currentParaIndex
        });
      }
    }
    currentParaIndex++;
  }

  // ========== 表格空单元格识别 ==========
  const cellInfos = buildTableStructureMap(xmlString);
  const rowBuckets = new Map();
  for (const ci of cellInfos) {
    const rowKey = ci.rowXml;
    if (!rowBuckets.has(rowKey)) rowBuckets.set(rowKey, []);
    rowBuckets.get(rowKey).push(ci);
  }

  for (const [, cells] of rowBuckets) {
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      if (cell.cellText !== '' && !/^[\s　_－-]+$/.test(cell.cellText)) continue;

      let label = '';
      if (i > 0) label = getPreviousCellLabel(cell.rowXml, cell.cellLocalOffset);
      if (!label && i === 0 && cells.length > 1) {
        label = cells[1] ? getVisibleTextFromXml(cells[1].cellXml).trim() : '';
      }

      const rowFullText = getVisibleTextFromXml(cell.rowXml).trim();
      const checkText = label || rowFullText;

      if (!BLANK_KEYWORDS.some(kw => checkText.includes(kw))) {
        continue;
      }

      const context = label ? `${label}：[空白单元格]` : `${rowFullText}`;

      blanks.push({
        id: `blank_${++blankCounter}`,
        context,
        matchText: '[空白单元格]',
        _cellLabel: label,
        index: label ? label.length + 1 : 0, 
        type: 'empty_cell',
        confidence: 'medium',
        paraIndex: cell.paraIndex
      });
    }
  }

  // 去重
  const uniqueBlanks = [];
  const seen = new Set();
  for (const b of blanks) {
    const key = `${b.paraIndex}::${b.matchText}::${b.index}`;
    if (!seen.has(key)) { seen.add(key); uniqueBlanks.push(b); }
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
  idx = fullText.indexOf(blank.matchText);
  return idx;
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

export function replaceBlanksInXml(xmlString, blanks, filledValues, imageRidMap) {
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
    let newParaXml = paraXml;

    // 💡 引擎升级：处理空单元格 或 虚拟附件位 (无论找不到字符串，都暴力追加到末尾)
    if (blank.type === 'empty_cell' || blank.matchText === '[空白单元格]') {
      if (isImage) {
        const imgInfo = imageRidMap[blank.id];
        const drawingXml = buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu);
        newParaXml = paraXml.replace(/<\/w:p>/, drawingXml + '</w:p>');
      } else {
        newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
      }
    } else {
      const { nodes, fullText } = buildTextNodeMap(paraXml);

      let matchText = blank.matchText;
      if (!matchText && blank.type === 'keyword_space') {
        const colonMatch = fullText.match(/[：:]\s{2,}/);
        if (colonMatch) matchText = colonMatch[0];
      }
      if (!matchText && blank.type === 'date_pattern') {
        const dateMatch = fullText.match(/\s{2,}年\s*月\s*日/);
        if (dateMatch) matchText = dateMatch[0];
      }
      if (!matchText && blank.type === 'brackets') {
        const bracketMatch = fullText.match(/[（(\[【].*?[）)\]】]/);
        if (bracketMatch) matchText = bracketMatch[0];
      }
      if (!matchText && blank.type === 'placeholder') {
        const phMatch = fullText.match(/待补充|待填/);
        if (phMatch) matchText = phMatch[0];
      }

      const searchBlank = { ...blank, matchText };
      const blankPos = findBlankInFullText(fullText, searchBlank);
      
      // 💡 引擎升级：如果是虚拟的资质占位符，或者实在找不到匹配文字，安全降级追加到段落末尾！
      if (blankPos === -1 || blank.type === 'attachment') {
        if (isImage) {
          const imgInfo = imageRidMap[blank.id];
          const drawingXml = buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu);
          newParaXml = paraXml.replace(/<\/w:p>/, drawingXml + '</w:p>');
        } else {
          newParaXml = paraXml.replace(/<\/w:p>/, `<w:r><w:t>${escapeXml(value)}</w:t></w:r></w:p>`);
        }
      } else {
        const blankEnd = blankPos + matchText.length;
        const coveredNodes = getOverlappingNodes(nodes, blankPos, blankEnd);
        if (coveredNodes.length > 0) {
          if (isImage) {
            const imgInfo = imageRidMap[blank.id];
            const drawingXml = buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu);
            for (const node of coveredNodes) { node._replaced = true; node._newText = ''; }
            let tempParaXml = rebuildParagraphXml(paraXml, nodes);

            const updatedMap = buildTextNodeMap(tempParaXml);
            let bestRun = null;
            let bestRunStart = -1;
            const rr = /<w:r[\s>][\s\S]*?<\/w:r>/g;
            let rm;
            while ((rm = rr.exec(tempParaXml)) !== null) {
              for (const un of updatedMap.nodes) {
                if (un.text === '' && un.textStart <= blankPos && un.textEnd >= blankPos) {
                  if (rm.index <= un.matchStart && rm.index + rm[0].length >= un.matchEnd) {
                    if (bestRunStart === -1 || rm.index < bestRunStart) { bestRun = rm; bestRunStart = rm.index; }
                  }
                }
              }
            }
            if (bestRun) {
              newParaXml = tempParaXml.substring(0, bestRun.index) + drawingXml + tempParaXml.substring(bestRun.index + bestRun[0].length);
            } else {
              newParaXml = tempParaXml.replace(/<\/w:p>/, drawingXml + '</w:p>');
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

export function extractIndexedParagraphs(xmlString) {
  const paragraphs = [];
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  let paraIndex = 0;

  const cellInfos = buildTableStructureMap(xmlString);
  const tableParaSet = new Set();
  const paraToLabel = new Map();
  const paraToRowText = new Map();

  for (const ci of cellInfos) {
    tableParaSet.add(ci.paraIndex);
    if (ci.cellText === '' || /^[\s　_－-]+$/.test(ci.cellText)) {
      paraToLabel.set(ci.paraIndex, getPreviousCellLabel(ci.rowXml, ci.cellLocalOffset) || '');
      paraToRowText.set(ci.paraIndex, getVisibleTextFromXml(ci.rowXml).trim());
    }
  }

  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const xml = paraMatch[0];
    const text = getVisibleTextFromXml(xml);
    if (text.trim().length > 0) {
      paragraphs.push({ paraIndex, text, xml }); 
    } else if (tableParaSet.has(paraIndex)) {
      const label = paraToLabel.get(paraIndex) || '';
      const rowText = paraToRowText.get(paraIndex) || '';
      if (BLANK_KEYWORDS.some(kw => label.includes(kw) || rowText.includes(kw))) {
        paragraphs.push({ paraIndex, text: label ? `${label}：[空白单元格]` : (rowText || '[表格空单元格]'), xml });
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
    const key = `${aiBlank.paraIndex}|${aiBlank.matchText}|${aiBlank.index ?? 0}`;
    if (!existingKeys.has(key)) {
      merged.push({ ...aiBlank, id: `blank_ai_${merged.length + 1}`, confidence: aiBlank.confidence || 'medium' });
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

export async function generateFilledDocx(zip, modifiedXml, blanks, filledValues) {
  const imageRidMap = {};
  const imageEntries = [];

  for (const blank of blanks) {
    const val = filledValues[blank.id];
    if (!val || !isImageUrl(val)) continue;
    imageEntries.push({ blankId: blank.id, url: val.trim() });
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
      if (r.status === 'fulfilled') fetchedImages.push(r.value);
    }
  }

  let relsObj = null;
  const IMAGE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
  const RELS_PATH = 'word/_rels/document.xml.rels';

  if (fetchedImages.length > 0) {
    let relsXml = zip.file(RELS_PATH)?.asText();
    if (!relsXml) relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    relsObj = parseRelsXml(relsXml);

    let ctXml = zip.file('[Content_Types].xml')?.asText() || '';
    const ensureExt = (ext, mime) => {
      if (!ctXml.includes(`Extension="${ext}"`)) ctXml = ctXml.replace('</Types>', `<Default Extension="${ext}" ContentType="${mime}"/></Types>`);
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

  const finalXml = replaceBlanksInXml(modifiedXml, blanks, filledValues, imageRidMap);
  zip.file('word/document.xml', finalXml);
  return zip.generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
}