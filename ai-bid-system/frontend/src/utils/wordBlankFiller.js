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

// ===== 以下函数已废弃，由后端处理 =====
// isImageUrl, isDocumentUrl, getDisplayTextFromUrl, guessImageMime, guessImageExt
// fetchImageAsArrayBuffer, buildImageRunXml, buildHyperlinkXml, parseRelsXml
// addRelationship, getImageDimensionsEmu, getCmDimensionsEmu, detectImageInsertType
// getImageSizeStrategy, loadImageNaturalSize, escapeXml
// 这些函数用于前端 XML 操作和图片处理，现已迁移到后端 python-docx 实现

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

      // 坐标切片生成 markedContext (关键词+长空格，合并紧跟的装饰性括号如"（盖章）")
      const decorativeBracketRe = /\s*[（(]\s*(?:盖章处|签章处|盖章|签字|请填写[^）)]*|待补充|待定|填写[^）)]*|请盖章)\s*[)）]/;
      const spacePattern = /([：:])(\s{3,})/g;
      while ((m = spacePattern.exec(text)) !== null) {
        const colonStr = m[1];
        const spaceStr = m[2];
        const spaceIndex = m.index + colonStr.length;
        // 检查空格后是否紧跟装饰性括号，若是则合并
        const afterSpace = text.substring(spaceIndex + spaceStr.length);
        const bracketM = decorativeBracketRe.exec(afterSpace);
        let fullMatchText = spaceStr;
        let markedCtx;
        if (bracketM && bracketM.index === 0) {
          fullMatchText = spaceStr + bracketM[0];
          markedCtx = text.substring(0, spaceIndex) + '【🎯】' + text.substring(spaceIndex + fullMatchText.length);
        } else {
          markedCtx = text.substring(0, spaceIndex) + '【🎯】' + text.substring(spaceIndex + spaceStr.length);
        }
        blanks.push({ id: `blank_${++blankCounter}`, context: text, markedContext: markedCtx, matchText: fullMatchText, index: spaceIndex, type: 'keyword_space', confidence: 'medium', paraIndex: currentParaIndex, fill_role: determineFillRole(text) });
      }

      // 检查当前段是否已有实质空白（用于防止同位置装饰性括号重复）
      const alreadyHasSubstantiveBlank = blanks.some(b =>
        b.paraIndex === currentParaIndex &&
        ['underscore', 'dash', 'keyword_space', 'repeated_keyword', 'image_placeholder'].includes(b.type)
      );

      // 坐标切片生成 markedContext (括号填空 - 装饰性括号在已有空白时跳过，避免同位置重复)
      const roundBracketPattern = /[（(]\s*(盖章处|签章处|盖章|签字|请填写[^）)]*|待补充|待定|填写[^）)]*|请盖章)\s*[)）]/g;
      while ((m = roundBracketPattern.exec(text)) !== null) {
        if (alreadyHasSubstantiveBlank) continue;
        const markedCtx = text.substring(0, m.index) + '【🎯】' + text.substring(m.index + m[0].length);
        blanks.push({ id: `blank_${++blankCounter}`, context: text, markedContext: markedCtx, matchText: m[0], index: m.index, type: 'brackets', confidence: 'high', paraIndex: currentParaIndex, fill_role: determineFillRole(text) });
      }

      const squareBracketPattern = /[[【]\s*(填写[^\]】]*|待补充|待定|请填写[^\]】]*)\s*[\]】]/g;
      while ((m = squareBracketPattern.exec(text)) !== null) {
        if (alreadyHasSubstantiveBlank) continue;
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

  // 合并同一段落中仅由空格分隔的相邻下划线/横线组（语义上是同一个填空位）
  // 例如 "__________     ___________________" 应合并为单个blank
  const mergedBlanks = [];
  for (const b of uniqueBlanks) {
    if (
      (b.type === 'underscore' || b.type === 'dash') &&
      mergedBlanks.length > 0
    ) {
      const prev = mergedBlanks[mergedBlanks.length - 1];
      if (
        prev.paraIndex === b.paraIndex &&
        (prev.type === 'underscore' || prev.type === 'dash')
      ) {
        const prevEnd = prev.index + (prev.matchText || '').length;
        if (prevEnd <= b.index && prev.context === b.context) {
          const gap = b.context.substring(prevEnd, b.index);
          // 仅当间隔是纯空格（含中文空格）时合并
          if (/^[\s\u3000]*$/.test(gap)) {
            const combinedMatch = prev.matchText + gap + b.matchText;
            const combinedEnd = b.index + (b.matchText || '').length;
            prev.matchText = combinedMatch;
            prev.markedContext = b.context.substring(0, prev.index) + '【🎯】' + b.context.substring(combinedEnd);
            continue;
          }
        }
      }
    }
    mergedBlanks.push(b);
  }

  return mergedBlanks;
}

// ===== 以下函数已废弃，由后端 /api/fill-blanks 处理 =====
// replaceBlanksInXml - XML 文本替换逻辑已迁移到后端 python-docx
// 相关辅助函数也已废弃：buildTextNodeMap, rebuildParagraphXml, findBlankInFullText,
// getExpandedPlaceholderRange, getOverlappingNodes, replaceTextRangeInNodes

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

// ===== generateFilledDocx 函数已废弃 =====
// 文档生成逻辑已完全迁移到后端 /api/fill-blanks 接口
// 前端现在通过 exportFilledDocument() 调用后端 API
