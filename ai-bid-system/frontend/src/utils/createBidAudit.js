import { isPersonnelTableBlank } from './personnelTableClassifier';

export const normalizeAuditText = (value = '') => String(value || '').replace(/\s+/g, '').trim().toLowerCase();

export const deriveAuditFieldHint = (blank) => {
  const rawHint = String(blank?.fieldHint || '').trim();
  const localContext = String(blank?.markedContext || blank?.localContext || blank?.context || '');
  const marker = '【🎯】';
  const markerIndex = localContext.indexOf(marker);
  const before = markerIndex >= 0 ? localContext.slice(0, markerIndex) : localContext;
  const after = markerIndex >= 0 ? localContext.slice(markerIndex + marker.length) : '';

  const lastColonMatch = before.match(/([^：:，。,；;（）()\n]{1,24})[：:]\s*$/);
  if (lastColonMatch?.[1]) {
    return lastColonMatch[1].replace(/[_－\-\s]+/g, '').trim();
  }

  const cleanBefore = before.replace(/[_－\-\s]+/g, '');
  const cleanAfter = after.replace(/[_－\-\s]+/g, '');

  if (/(?:系|是|为)$/.test(cleanBefore) && /^的?(?:法定代表人|法人代表|法人|委托代理人|授权代表)/.test(cleanAfter)) {
    return '投标人名称';
  }
  if (cleanBefore.endsWith('（') || cleanBefore.endsWith('(')) {
    if (/^(?:法定代表人|法人代表|法人|委托代理人|授权代表)/.test(cleanAfter)) {
      return '投标人名称';
    }
  }

  const nearestBefore = [...before.matchAll(/(单位名称|投标人名称|供应商名称|报价人单位名称|法定代表人姓名|法定代表人|被授权人姓名|被授权人|委托代理人|授权代表|姓名|性别|年龄|职务|身份证号码|身份证号|联系电话|电子邮箱|开户地址|联系地址|注册地址|详细通讯地址|地址|邮编|开户行|银行账号|统一社会信用代码|项目名称|项目|报价|版本号|型号)/g)];
  const nearestAfter = after.match(/^.{0,3}?(单位名称|投标人名称|供应商名称|报价人单位名称|法定代表人姓名|法定代表人|被授权人姓名|被授权人|委托代理人|授权代表|姓名|性别|年龄|职务|身份证号码|身份证号|联系电话|电子邮箱|开户地址|联系地址|注册地址|详细通讯地址|地址|邮编|开户行|银行账号|统一社会信用代码|项目名称|项目|报价|版本号|型号)/);

  const candidate = nearestAfter?.[1] || nearestBefore.at(-1)?.[1] || rawHint;
  if (/开户地址|联系地址|注册地址|详细通讯地址/.test(candidate)) return '地址';
  if (/报价人单位名称|投标人名称|供应商名称|单位名称|公司名称/.test(candidate)) return '投标人名称';
  if (/法定代表人姓名|法定代表人/.test(candidate)) return '法定代表人信息';
  if (/被授权人姓名|被授权人|委托代理人|授权代表/.test(candidate)) return '被授权人信息';
  if (/身份证号码|身份证号/.test(candidate)) return '身份证号码';
  if (/联系电话/.test(candidate)) return '电话';
  if (/电子邮箱/.test(candidate)) return '邮箱';
  return candidate;
};

export const getRuleSuggestion = (blank, company, classifications = {}) => {
  if (!blank || !company) return '';
  if (isPersonnelTableBlank(blank, classifications)) return '';
  const hint = deriveAuditFieldHint(blank);
  if (/投标人名称|单位名称|公司名称/.test(hint)) return company.company_name || '';
  if (/法定代表人信息|法定代表人姓名/.test(hint)) return company.legal_rep_name || '';
  if (/被授权人信息|委托代理人|授权代表/.test(hint)) return company.legal_rep_name || '';
  if (/性别/.test(hint)) return company.gender || '';
  if (/职务/.test(hint)) return company.position || '';
  if (/身份证号码|身份证号/.test(hint)) return company.id_number || '';
  if (/电话|联系电话|联系方式/.test(hint)) return company.phone || '';
  if (/邮箱|电子邮箱/.test(hint)) return company.email || '';
  if (/地址|联系地址|通讯地址/.test(hint)) return company.address || '';
  if (/统一社会信用代码|信用代码/.test(hint)) return company.uscc || '';
  return '';
};

export const validateFilledBlanksWithRules = (blanks = [], values = {}, company = null, classifications = {}) => {
  const results = {};

  blanks.forEach((blank) => {
    const value = String(values[blank.id] || '').trim();
    if (!value) return;

    const hint = deriveAuditFieldHint(blank);
    const normalizedValue = normalizeAuditText(value);
    const normalizedCompanyName = normalizeAuditText(company?.company_name || '');
    const isPersonnelBlank = isPersonnelTableBlank(blank, classifications);
    const result = {
      blankId: blank.id,
      fieldHint: hint || '未命名字段',
      status: 'pass',
      source: 'rule',
      reason: '规则校验通过',
      suggestedValue: ''
    };

    const companyLikeInWrongField = !isPersonnelBlank && normalizedCompanyName && normalizedValue === normalizedCompanyName && !/投标人名称|单位名称|公司名称/.test(hint);
    if (companyLikeInWrongField) {
      result.status = 'error';
      result.reason = `${hint || '该字段'} 不应填写为公司名称`;
      result.suggestedValue = getRuleSuggestion(blank, company, classifications);
      results[blank.id] = result;
      return;
    }

    if (isPersonnelBlank) {
      if (/性别/.test(hint) && !['男', '女'].includes(value)) {
        result.status = 'error';
        result.reason = '人员性别字段只能填写“男”或“女”';
      } else if (/年龄/.test(hint) && !/^\d{1,3}$/.test(value)) {
        result.status = 'warning';
        result.reason = '人员年龄字段建议填写纯数字';
      }
    } else if (/性别/.test(hint)) {
      if (!['男', '女'].includes(value)) {
        result.status = 'error';
        result.reason = '性别字段只能填写“男”或“女”';
        result.suggestedValue = company?.gender || '';
      }
    } else if (/年龄/.test(hint)) {
      if (!/^\d{1,3}$/.test(value)) {
        result.status = 'warning';
        result.reason = '年龄字段建议填写纯数字';
      }
    } else if (/邮箱|电子邮箱/.test(hint)) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        result.status = 'error';
        result.reason = '邮箱格式不正确';
        result.suggestedValue = company?.email || '';
      }
    } else if (/身份证号码|身份证号/.test(hint)) {
      if (!/^(\d{17}[\dXx]|\d{15})$/.test(value)) {
        result.status = 'error';
        result.reason = '身份证号码格式不正确';
        result.suggestedValue = company?.id_number || '';
      }
    } else if (/电话|联系电话|联系方式/.test(hint)) {
      if (!/^[\d\-+()\s]{7,20}$/.test(value)) {
        result.status = 'warning';
        result.reason = '联系电话格式看起来不合理';
        result.suggestedValue = company?.phone || '';
      }
    } else if (/统一社会信用代码|信用代码/.test(hint)) {
      if (!/^[0-9A-Z]{18}$/.test(value.toUpperCase())) {
        result.status = 'error';
        result.reason = '统一社会信用代码格式不正确';
        result.suggestedValue = company?.uscc || '';
      }
    } else if (/投标人名称|单位名称|公司名称/.test(hint)) {
      if (normalizedCompanyName && normalizedValue !== normalizedCompanyName) {
        result.status = 'warning';
        result.reason = '单位名称与当前投标主体档案不一致';
        result.suggestedValue = company?.company_name || '';
      }
    } else if (/法定代表人信息|法定代表人姓名/.test(hint)) {
      const normalizedLegalRep = normalizeAuditText(company?.legal_rep_name || '');
      if (normalizedLegalRep && normalizedValue !== normalizedLegalRep) {
        result.status = 'warning';
        result.reason = '姓名与当前投标主体档案中的法定代表人不一致';
        result.suggestedValue = company?.legal_rep_name || '';
      }
    }

    results[blank.id] = result;
  });

  return results;
};

export const mergeAuditResults = (blanks = [], values = {}, ruleResults = {}, aiResults = {}) => {
  return blanks
    .filter((blank) => values[blank.id])
    .map((blank) => {
      const ruleResult = ruleResults[blank.id] || null;
      const aiResult = aiResults[blank.id] || null;
      let status = 'pass';
      if (ruleResult?.status === 'error' || aiResult?.status === 'error') status = 'error';
      else if (ruleResult?.status === 'warning' || aiResult?.status === 'warning') status = 'warning';

      return {
        blankId: blank.id,
        fieldHint: deriveAuditFieldHint(blank) || blank.fieldHint || '未命名字段',
        localContext: blank.localContext || blank.context || '',
        value: values[blank.id] || '',
        status,
        ruleResult,
        aiResult,
        suggestedValue: aiResult?.suggestedValue || ruleResult?.suggestedValue || ''
      };
    });
};

export const summarizeAuditResults = (results = []) => ({
  total: results.length,
  pass: results.filter((item) => item.status === 'pass').length,
  warning: results.filter((item) => item.status === 'warning').length,
  error: results.filter((item) => item.status === 'error').length,
  suggested: results.filter((item) => item.suggestedValue).length
});
