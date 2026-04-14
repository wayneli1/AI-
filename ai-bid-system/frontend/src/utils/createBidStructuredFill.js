import { isPersonnelTableBlank } from './personnelTableClassifier';
import { deriveAuditFieldHint } from './createBidAudit';

export const buildStructuredProfile = (company) => {
  if (!company) return '';
  const labelMap = {
    company_name: '公司名称',
    uscc: '统一社会信用代码',
    registered_capital: '注册资金',
    company_type: '公司性质',
    establish_date: '成立日期',
    operating_period: '经营期限',
    phone: '联系电话',
    email: '公司邮箱',
    address: '公司地址',
    zip_code: '邮政编码',
    registration_authority: '登记机关',
    business_scope: '经营范围',
    legal_rep_name: '法定代表人',
    id_number: '身份证号',
    gender: '性别',
    birth_date: '出生日期',
    id_expiry: '身份证有效期',
    position: '职位',
    id_photo_front_url: '身份证正面照片',
    id_photo_back_url: '身份证反面照片',
  };

  let text = '【投标主体权威档案】\n';
  for (const [key, label] of Object.entries(labelMap)) {
    if (company[key]) {
      text += `${label}：${company[key]}\n`;
    }
  }

  if (company.custom_fields && typeof company.custom_fields === 'object') {
    const keys = Object.keys(company.custom_fields);
    if (keys.length > 0) {
      text += '【自定义扩展信息】\n';
      for (const [k, v] of Object.entries(company.custom_fields)) {
        if (v) text += `${k}：${v}\n`;
      }
    }
  }

  return text;
};

export const getStructuredFieldValue = (blank, company, classifications = {}) => {
  if (!blank || !company) return '';
  if (isPersonnelTableBlank(blank, classifications)) return '';

  const hint = deriveAuditFieldHint(blank);
  const localContext = String(blank.localContext || '');

  if (/投标人名称|单位名称|公司名称/.test(hint)) {
    return company.company_name || '';
  }

  if (blank.type === 'brackets') {
    if (/报价人单位名称|投标人名称|单位名称|公司名称|供应商名称/.test(localContext)) {
      return company.company_name || '';
    }
    if (/法定代表人姓名|法人代表|法定代表人/.test(localContext)) {
      return company.legal_rep_name || '';
    }
    if (/被授权人姓名|委托代理人|授权代表|被授权人/.test(localContext)) {
      return company.legal_rep_name || '';
    }
    return '';
  }

  if (/法定代表人信息|法定代表人姓名|法人代表|法定代表人/.test(hint)) {
    return company.legal_rep_name || '';
  }
  if (/被授权人信息|委托代理人|授权代表/.test(hint)) {
    return company.legal_rep_name || '';
  }
  if (/性别/.test(hint)) {
    return company.gender || '';
  }
  if (/年龄/.test(hint)) {
    return '';
  }
  if (/职务/.test(hint)) {
    return company.position || '';
  }
  if (/身份证号码|身份证号/.test(hint)) {
    return company.id_number || '';
  }
  if (/电话|联系电话|联系方式/.test(hint)) {
    return company.phone || '';
  }
  if (/地址|联系地址|通讯地址/.test(hint)) {
    return company.address || '';
  }
  if (/统一社会信用代码|信用代码/.test(hint)) {
    return company.uscc || '';
  }

  return '';
};
