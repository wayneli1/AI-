import PizZip from 'pizzip';

const BLANK_KEYWORDS = [
  '供应商', '投标人', '报价人', '中标人', '承包商', '厂商',
  '名称', '公司', '单位', '法定代表人', '授权代表', '委托代理人', '代理人',
  '地址', '邮政编码', '邮编', '电话', '传真', '联系人',
  '开户银行', '银行账号', '账号', '开户行',
  '签字', '盖章', '签名', '签章', '公章', '印章',
  '日期', '时间', '期限', '有效期',
  '报价', '总价', '合计', '金额', '合同价', '投标价',
  '项目名称', '项目编号', '标段', '包号',
  '规格', '型号', '品牌', '产地', '制造商',
  '数量', '单价', '交货期', '质保期',
  '备注', '说明', '承诺', '响应'
];

function getVisibleTextFromParagraph(paragraphXml) {
  const textParts = [];
  const textRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m;
  while ((m = textRegex.exec(paragraphXml)) !== null) {
    textParts.push(m[1]);
  }
  return textParts.join('');
}

function extractBlankFromMatch(matchText, fullParagraphText) {
  const trimmed = matchText.trim();
  if (trimmed === '') return null;

  if (/^_+$/.test(trimmed) && trimmed.length >= 2) {
    return { matchText: trimmed, type: 'underscore', confidence: 'high' };
  }
  if (/^-+$/.test(trimmed) && trimmed.length >= 3) {
    return { matchText: trimmed, type: 'dash', confidence: 'high' };
  }
  if (/^[\s　]+$/.test(trimmed) && trimmed.length >= 3) {
    return { matchText: trimmed, type: 'spaces', confidence: 'high' };
  }
  if (/年\s*月\s*日/.test(trimmed) && /[\s　]{2,}/.test(trimmed)) {
    return { matchText: trimmed, type: 'date_pattern', confidence: 'high' };
  }
  if (/^第\s*[一二三四五六七八九十\d]+\s*页\s*/.test(trimmed)) return null;
  if (/^共\s*[一二三四五六七八九十\d]+\s*页/.test(trimmed)) return null;
  return null;
}

function hasKeywordNearby(paragraphText, matchIndex, matchLength, windowSize = 30) {
  const before = paragraphText.substring(Math.max(0, matchIndex - windowSize), matchIndex);
  const after = paragraphText.substring(matchIndex + matchLength, matchIndex + matchLength + windowSize);
  const context = before + after;
  return BLANK_KEYWORDS.some(kw => context.includes(kw));
}

// ===================== Image helpers =====================

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
  if (lower.endsWith('.bmp')) return 'image/bmp';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'image/png';
}

function guessImageExt(mime) {
  const map = {
    'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif',
    'image/bmp': 'bmp', 'image/webp': 'webp'
  };
  return map[mime] || 'png';
}

async function fetchImageAsArrayBuffer(url) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`下载图片失败: HTTP ${resp.status} - ${url}`);
  const ct = resp.headers.get('content-type') || '';
  const buf = await resp.arrayBuffer();
  let mime = guessImageMime(url);
  if (ct && ct.startsWith('image/')) mime = ct.split(';')[0];
  return { buffer: buf, mime };
}

function buildImageRunXml(rId, cxEmu, cyEmu) {
  return (
    `<w:r>` +
      `<w:rPr><w:noProof/></w:rPr>` +
      `<w:drawing>` +
        `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
          `<wp:extent cx="${cxEmu}" cy="${cyEmu}"/>` +
          `<wp:effectExtent l="0" t="0" r="0" b="0"/>` +
          `<wp:docPr id="${Math.floor(Math.random() * 100000)}" name="injected_image"/>` +
          `<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"/></wp:cNvGraphicFramePr>` +
          `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
            `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
              `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
                `<pic:nvPicPr>` +
                  `<pic:cNvPr id="0" name="injected.png"/>` +
                  `<pic:cNvPicPr/>` +
                `</pic:nvPicPr>` +
                `<pic:blipFill>` +
                  `<a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
                  `<a:stretch><a:fillRect/></a:stretch>` +
                `</pic:blipFill>` +
                `<pic:spPr>` +
                  `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${cxEmu}" cy="${cyEmu}"/></a:xfrm>` +
                  `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
                `</pic:spPr>` +
              `</pic:pic>` +
            `</a:graphicData>` +
          `</a:graphic>` +
        `</wp:inline>` +
      `</w:drawing>` +
    `</w:r>`
  );
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
  const tag = `<Relationship Id="${rId}" Type="${type}" Target="${target}"/>`;
  relsObj.xml = relsObj.xml.replace('</Relationships>', `${tag}</Relationships>`);
  return rId;
}

// px -> EMU (1 inch = 914400 EMU, assume 96 DPI)
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
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ w: 400, h: 300 });
    };
    img.src = url;
  });
}

// ===================== Core scanning (unchanged) =====================

export function scanBlanksFromXml(xmlString) {
  const blanks = [];
  let blankCounter = 0;
  let paraIndex = 0;

  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;

  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const paragraphXml = paraMatch[0];
    const paragraphText = getVisibleTextFromParagraph(paragraphXml);

    if (!paragraphText || paragraphText.trim().length === 0) { paraIndex++; continue; }

    const underscorePattern = /_{3,}/g;
    let m;
    while ((m = underscorePattern.exec(paragraphText)) !== null) {
      const blank = extractBlankFromMatch(m[0], paragraphText);
      if (blank) {
        blank.id = `blank_${++blankCounter}`;
        blank.context = paragraphText.trim();
        blank.index = m.index;
        blank.paraIndex = paraIndex;
        blanks.push(blank);
      }
    }

    const dashPattern = /-{4,}/g;
    while ((m = dashPattern.exec(paragraphText)) !== null) {
      const blank = extractBlankFromMatch(m[0], paragraphText);
      if (blank) {
        blank.id = `blank_${++blankCounter}`;
        blank.context = paragraphText.trim();
        blank.index = m.index;
        blank.paraIndex = paraIndex;
        blanks.push(blank);
      }
    }

    const datePattern = /\s{2,}年\s+月\s+日/g;
    while ((m = datePattern.exec(paragraphText)) !== null) {
      blankCounter++;
      blanks.push({
        id: `blank_${blankCounter}`, context: paragraphText.trim(),
        matchText: m[0], index: m.index, type: 'date_pattern',
        confidence: 'high', paraIndex
      });
    }

    const spacePattern = /[：:]\s{3,}/g;
    while ((m = spacePattern.exec(paragraphText)) !== null) {
      if (hasKeywordNearby(paragraphText, m.index, m[0].length)) {
        blankCounter++;
        blanks.push({
          id: `blank_${blankCounter}`, context: paragraphText.trim(),
          matchText: m[0], index: m.index, type: 'keyword_space',
          confidence: 'medium', paraIndex
        });
      }
    }
    paraIndex++;
  }

  const cellRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
  let cellMatch;
  while ((cellMatch = cellRegex.exec(xmlString)) !== null) {
    const cellXml = cellMatch[0];
    const cellText = getVisibleTextFromParagraph(cellXml).trim();
    if (cellText === '' || /^[\s　_－-]+$/.test(cellText)) {
      let surroundingContext = '';
      const parentRowMatch = cellMatch.input.substring(
        Math.max(0, cellMatch.index - 2000),
        Math.min(cellMatch.index + cellMatch[0].length + 2000, cellMatch.input.length)
      );
      const rowMatch = parentRowMatch.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/);
      if (rowMatch) surroundingContext = getVisibleTextFromParagraph(rowMatch[0]).trim();
      if (surroundingContext && hasKeywordNearby(surroundingContext, 0, surroundingContext.length, surroundingContext.length)) {
        blankCounter++;
        blanks.push({
          id: `blank_${blankCounter}`,
          context: `[表格空白单元格] ${surroundingContext}`,
          matchText: cellText || '(空)', type: 'empty_cell', confidence: 'medium'
        });
      }
    }
  }

  const uniqueBlanks = [];
  const seenContexts = new Set();
  for (const b of blanks) {
    const key = `${b.context}::${b.index}`;
    if (!seenContexts.has(key)) { seenContexts.add(key); uniqueBlanks.push(b); }
  }
  return uniqueBlanks;
}

// ===================== Text Mapping engine (fragmentation-proof) =====================

function buildTextNodeMap(paragraphXml) {
  const WT_REGEX = /(<w:t(\s[^>]*)?>)([^<]*)(<\/w:t>)/g;
  const nodes = [];
  let offset = 0;
  let m;
  while ((m = WT_REGEX.exec(paragraphXml)) !== null) {
    const text = m[3];
    nodes.push({
      fullMatch: m[0],
      openTag: m[1],
      text,
      closeTag: m[4],
      matchStart: m.index,
      matchEnd: m.index + m[0].length,
      textStart: offset,
      textEnd: offset + text.length
    });
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

// ===================== Replace blanks (text-mapping, image-aware) =====================

export function replaceBlanksInXml(xmlString, blanks, filledValues, imageRidMap) {
  let modifiedXml = xmlString;
  const processedIds = new Set();

  // 1. Parse paragraphs with positions
  const paragraphs = [];
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let pMatch;
  while ((pMatch = paragraphRegex.exec(modifiedXml)) !== null) {
    paragraphs.push({
      start: pMatch.index,
      end: pMatch.index + pMatch[0].length,
      xml: pMatch[0],
      text: getVisibleTextFromParagraph(pMatch[0])
    });
  }

  // 2. Process each blank
  for (const blank of blanks) {
    const value = filledValues[blank.id];
    if (value === undefined || value === null) continue;
    if (processedIds.has(blank.id)) continue;
    processedIds.add(blank.id);

    const matchingParagraph = paragraphs.find(p => p.text.trim() === blank.context);
    if (!matchingParagraph) continue;

    const paraXml = matchingParagraph.xml;
    const { nodes, fullText } = buildTextNodeMap(paraXml);

    const blankPos = findBlankInFullText(fullText, blank);
    if (blankPos === -1) continue;

    const blankEnd = blankPos + blank.matchText.length;
    const coveredNodes = getOverlappingNodes(nodes, blankPos, blankEnd);
    if (coveredNodes.length === 0) continue;

    const isImage = isImageUrl(value) && imageRidMap && imageRidMap[blank.id];

    if (isImage) {
      // Image injection: clear all covered text nodes, insert <w:drawing> before first covered run
      const imgInfo = imageRidMap[blank.id];
      const drawingXml = buildImageRunXml(imgInfo.rId, imgInfo.cxEmu, imgInfo.cyEmu);

      let newParaXml = paraXml;

      // We need to work on the current state of the paragraph XML
      // Clear all covered text nodes first
      for (const node of coveredNodes) {
        node._replaced = true;
        node._newText = '';
      }
      newParaXml = rebuildParagraphXml(paraXml, nodes);

      // Now find the first <w:r> that contained a covered node and replace it with drawingXml
      const updatedMap = buildTextNodeMap(newParaXml);
      // Find the first run that now has empty text where our blank was
      const runRegex2 = /<w:r[\s>][\s\S]*?<\/w:r>/g;
      let rMatch2;
      // Find the run closest to the blank position
      // Strategy: find the first <w:r> whose <w:t> content was cleared
      let bestRun = null;
      let bestRunStart = -1;
      // Re-parse nodes to find cleared ones
      for (const un of updatedMap.nodes) {
        if (un.text === '' && un.textStart <= blankPos && un.textEnd >= blankPos) {
          // Find the <w:r> containing this <w:t>
          const rr = /<w:r[\s>][\s\S]*?<\/w:r>/g;
          let rm;
          while ((rm = rr.exec(newParaXml)) !== null) {
            if (rm.index <= un.matchStart && rm.index + rm[0].length >= un.matchEnd) {
              if (bestRunStart === -1 || rm.index < bestRunStart) {
                bestRun = rm;
                bestRunStart = rm.index;
              }
            }
          }
        }
      }

      if (bestRun) {
        newParaXml = newParaXml.substring(0, bestRun.index) + drawingXml + newParaXml.substring(bestRun.index + bestRun[0].length);
      } else {
        // Fallback: insert before </w:p>
        newParaXml = newParaXml.replace(/<\/w:p>/, drawingXml + '</w:p>');
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
    } else {
      // Text replacement: write value into first covered node, clear the rest
      for (let i = 0; i < coveredNodes.length; i++) {
        coveredNodes[i]._replaced = true;
        if (i === 0) {
          coveredNodes[i]._newText = escapeXml(value);
        } else {
          coveredNodes[i]._newText = '';
        }
      }

      const newParaXml = rebuildParagraphXml(paraXml, nodes);

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
  }

  return modifiedXml;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ===================== Public helpers =====================

export function extractIndexedParagraphs(xmlString) {
  const paragraphs = [];
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  let paraIndex = 0;
  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const xml = paraMatch[0];
    const text = getVisibleTextFromParagraph(xml).trim();
    if (text.length === 0) continue;
    paragraphs.push({ paraIndex, text, xml });
    paraIndex++;
  }
  return paragraphs;
}

export function mergeBlanks(regexBlanks, aiBlanks) {
  const merged = [...regexBlanks];
  const existingContexts = new Set(regexBlanks.map(b => `${b.context}|${b.index}`));
  aiBlanks.forEach(aiBlank => {
    const key = `${aiBlank.context}|${aiBlank.index}`;
    if (!existingContexts.has(key)) {
      merged.push({ ...aiBlank, id: `blank_ai_${merged.length + 1}`, confidence: aiBlank.confidence || 'medium' });
    }
  });
  return merged;
}

export function extractParagraphsForPreview(xmlString, blanks) {
  const paragraphs = [];
  const blankContextMap = new Map();
  blanks.forEach(blank => {
    const existing = blankContextMap.get(blank.context) || [];
    blankContextMap.set(blank.context, [...existing, blank.id]);
  });
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;
  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const xml = paraMatch[0];
    const text = getVisibleTextFromParagraph(xml).trim();
    if (text.length === 0) continue;
    const matchedBlankIds = blankContextMap.get(text) || [];
    paragraphs.push({ text, blankIds: matchedBlankIds });
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
        if (!xmlFile) {
          reject(new Error('无法找到 word/document.xml'));
          return;
        }
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

  // 1. Collect image blanks
  for (const blank of blanks) {
    const val = filledValues[blank.id];
    if (!val || !isImageUrl(val)) continue;
    imageEntries.push({ blankId: blank.id, url: val.trim() });
  }

  // 2. Fetch all images in parallel
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
      else console.warn('图片下载失败:', r.reason);
    }
  }

  // 3. Update rels
  let relsObj = null;
  const IMAGE_REL_TYPE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image';
  const RELS_PATH = 'word/_rels/document.xml.rels';

  if (fetchedImages.length > 0) {
    let relsXml = zip.file(RELS_PATH)?.asText();
    if (!relsXml) {
      relsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
    }
    relsObj = parseRelsXml(relsXml);

    // [Content_Types].xml — ensure png/jpeg extensions are registered
    let ctXml = zip.file('[Content_Types].xml')?.asText() || '';
    const ensureExt = (ext, mime) => {
      if (!ctXml.includes(`Extension="${ext}"`)) {
        ctXml = ctXml.replace('</Types>', `<Default Extension="${ext}" ContentType="${mime}"/></Types>`);
      }
    };
    ensureExt('png', 'image/png');
    ensureExt('jpeg', 'image/jpeg');
    ensureExt('gif', 'image/gif');
    ensureExt('bmp', 'image/bmp');
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

  // 4. Re-run replaceBlanksInXml with image rId map (even if 0 images, this is fine)
  const finalXml = replaceBlanksInXml(modifiedXml, blanks, filledValues, imageRidMap);

  zip.file('word/document.xml', finalXml);

  return zip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}
