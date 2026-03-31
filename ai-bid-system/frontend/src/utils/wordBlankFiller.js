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
    return {
      matchText: trimmed,
      type: 'underscore',
      confidence: 'high'
    };
  }

  if (/^-+$/.test(trimmed) && trimmed.length >= 3) {
    return {
      matchText: trimmed,
      type: 'dash',
      confidence: 'high'
    };
  }

  if (/^[\s　]+$/.test(trimmed) && trimmed.length >= 3) {
    return {
      matchText: trimmed,
      type: 'spaces',
      confidence: 'high'
    };
  }

  if (/年\s*月\s*日/.test(trimmed) && /[\s　]{2,}/.test(trimmed)) {
    return {
      matchText: trimmed,
      type: 'date_pattern',
      confidence: 'high'
    };
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

export function scanBlanksFromXml(xmlString) {
  const blanks = [];
  let blankCounter = 0;

  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch;

  while ((paraMatch = paragraphRegex.exec(xmlString)) !== null) {
    const paragraphXml = paraMatch[0];
    const paragraphText = getVisibleTextFromParagraph(paragraphXml);

    if (!paragraphText || paragraphText.trim().length === 0) continue;

    const underscorePattern = /_{3,}/g;
    let m;
    while ((m = underscorePattern.exec(paragraphText)) !== null) {
      const blank = extractBlankFromMatch(m[0], paragraphText);
      if (blank) {
        blank.id = `blank_${++blankCounter}`;
        blank.context = paragraphText.trim();
        blank.index = m.index;
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
        blanks.push(blank);
      }
    }

    const datePattern = /\s{2,}年\s+月\s+日/g;
    while ((m = datePattern.exec(paragraphText)) !== null) {
      blankCounter++;
      blanks.push({
        id: `blank_${blankCounter}`,
        context: paragraphText.trim(),
        matchText: m[0],
        index: m.index,
        type: 'date_pattern',
        confidence: 'high'
      });
    }

    const spacePattern = /[：:]\s{3,}/g;
    while ((m = spacePattern.exec(paragraphText)) !== null) {
      if (hasKeywordNearby(paragraphText, m.index, m[0].length)) {
        blankCounter++;
        blanks.push({
          id: `blank_${blankCounter}`,
          context: paragraphText.trim(),
          matchText: m[0],
          index: m.index,
          type: 'keyword_space',
          confidence: 'medium'
        });
      }
    }
  }

  const cellRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
  let cellMatch;
  while ((cellMatch = cellRegex.exec(xmlString)) !== null) {
    const cellXml = cellMatch[0];
    const cellText = getVisibleTextFromParagraph(cellXml).trim();

    if (cellText === '' || /^[\s　_－-]+$/.test(cellText)) {
      let surroundingContext = '';
      const surroundingCells = [];
      const siblingCellRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/g;
      const parentRowMatch = cellMatch.input.substring(
        Math.max(0, cellMatch.index - 2000),
        Math.min(cellMatch.index + cellMatch[0].length + 2000, cellMatch.input.length)
      );
      const rowMatch = parentRowMatch.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/);
      if (rowMatch) {
        surroundingContext = getVisibleTextFromParagraph(rowMatch[0]).trim();
      }

      if (surroundingContext && hasKeywordNearby(surroundingContext, 0, surroundingContext.length, surroundingContext.length)) {
        blankCounter++;
        blanks.push({
          id: `blank_${blankCounter}`,
          context: `[表格空白单元格] ${surroundingContext}`,
          matchText: cellText || '(空)',
          type: 'empty_cell',
          confidence: 'medium'
        });
      }
    }
  }

  const uniqueBlanks = [];
  const seenContexts = new Set();
  for (const b of blanks) {
    const key = `${b.context}::${b.index}`;
    if (!seenContexts.has(key)) {
      seenContexts.add(key);
      uniqueBlanks.push(b);
    }
  }

  return uniqueBlanks;
}

export function replaceBlanksInXml(xmlString, blanks, filledValues) {
  let modifiedXml = xmlString;
  const processedIds = new Set();

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

  for (const blank of blanks) {
    const value = filledValues[blank.id];
    if (value === undefined || value === null) continue;
    if (processedIds.has(blank.id)) continue;
    processedIds.add(blank.id);

    const matchingParagraph = paragraphs.find(p => p.text.trim() === blank.context);

    if (!matchingParagraph) continue;

    let paraXml = matchingParagraph.xml;

    if (blank.type === 'underscore') {
      const underscoreXmlRegex = /(<w:t(?:\s[^>]*)?>)(_+)(<\/w:t>)/g;
      let replaced = false;
      paraXml = paraXml.replace(underscoreXmlRegex, (fullMatch, open, content, close) => {
        if (!replaced && /^_+$/.test(content) && content.length >= 2) {
          replaced = true;
          return `${open}${escapeXml(value)}${close}`;
        }
        return fullMatch;
      });
    } else if (blank.type === 'dash') {
      const dashXmlRegex = /(<w:t(?:\s[^>]*)?>)(-+)(<\/w:t>)/g;
      let replaced = false;
      paraXml = paraXml.replace(dashXmlRegex, (fullMatch, open, content, close) => {
        if (!replaced && /^-+$/.test(content) && content.length >= 3) {
          replaced = true;
          return `${open}${escapeXml(value)}${close}`;
        }
        return fullMatch;
      });
    } else if (blank.type === 'spaces' || blank.type === 'keyword_space') {
      const spaceXmlRegex = /(<w:t(?:\s[^>]*)?>)(\s+)(<\/w:t>)/g;
      let replaced = false;
      paraXml = paraXml.replace(spaceXmlRegex, (fullMatch, open, content, close) => {
        if (!replaced && /^[\s　]+$/.test(content) && content.length >= 2) {
          replaced = true;
          return `${open}${escapeXml(value)}${close}`;
        }
        return fullMatch;
      });
    } else if (blank.type === 'date_pattern') {
      paraXml = paraXml.replace(
        /(<w:t(?:\s[^>]*)?>)(\s*年\s*月\s*日)(<\/w:t>)/g,
        `$1${escapeXml(value)}$3`
      );
    } else if (blank.type === 'empty_cell') {
      const emptyTRegex = /(<w:t(?:\s[^>]*)?>)(?:<\/w:t>)/g;
      let replaced = false;
      paraXml = paraXml.replace(emptyTRegex, (fullMatch, open) => {
        if (!replaced) {
          replaced = true;
          return `${open}${escapeXml(value)}</w:t>`;
        }
        return fullMatch;
      });
    }

    if (paraXml !== matchingParagraph.xml) {
      modifiedXml =
        modifiedXml.substring(0, matchingParagraph.start) +
        paraXml +
        modifiedXml.substring(matchingParagraph.end);

      paragraphs.forEach(p => {
        if (p.start > matchingParagraph.start) {
          const diff = paraXml.length - matchingParagraph.xml.length;
          p.start += diff;
          p.end += diff;
          p.xml = modifiedXml.substring(p.start, p.end);
        } else if (p.start === matchingParagraph.start) {
          p.xml = paraXml;
        }
      });
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

export function extractParagraphsForPreview(xmlString, blanks) {
  const paragraphs = [];
  const blankContextMap = new Map();
  for (const b of blanks) {
    const ctx = b.context.trim();
    if (!blankContextMap.has(ctx)) blankContextMap.set(ctx, []);
    blankContextMap.get(ctx).push(b.id);
  }

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
          reject(new Error('无法找到 word/document.xml，请确保上传的是有效的 .docx 文件'));
          return;
        }
        const xmlString = xmlFile.asText();
        resolve({ xmlString, zip });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

export function generateFilledDocx(originalZip, modifiedXml) {
  const newZip = originalZip;
  newZip.file('word/document.xml', modifiedXml);

  return newZip.generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}
