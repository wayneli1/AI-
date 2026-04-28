import { useState, useEffect, useRef } from 'react';
import { Button, Table, message, Drawer, Form, Input, Select, DatePicker, Upload, Divider, Tag, Popconfirm, Space, Modal, Alert, Progress, Tooltip } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, UserOutlined, ProjectOutlined, PaperClipOutlined, MinusCircleOutlined, SearchOutlined, DownloadOutlined, FileExcelOutlined, ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { extractIDCardBack } from '../utils/ocr';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

const GENDER_OPTIONS = [
  { label: '男', value: '男' },
  { label: '女', value: '女' },
];

const EDUCATION_OPTIONS = [
  { label: '博士', value: '博士' },
  { label: '硕士', value: '硕士' },
  { label: '本科', value: '本科' },
  { label: '大专', value: '大专' },
  { label: '中专', value: '中专' },
  { label: '高中', value: '高中' },
  { label: '其他', value: '其他' },
];

const DEGREE_OPTIONS = [
  { label: '博士', value: '博士' },
  { label: '硕士', value: '硕士' },
  { label: '学士', value: '学士' },
  { label: '无学位', value: '无学位' },
];

const ATTACHMENT_SECTIONS = [
  { key: 'id_card_front', label: '身份证（正面）', accept: 'image/*', maxCount: 1 },
  { key: 'id_card_back', label: '身份证（反面）', accept: 'image/*', maxCount: 1 },
  { key: 'degree_certificate', label: '学位证书', accept: 'image/*,.pdf', maxCount: 4 },
  { key: 'qualification_certificate', label: '资质证书', accept: 'image/*,.pdf', maxCount: 4 },
];

const emptyAttachments = () => {
  const o = {};
  ATTACHMENT_SECTIONS.forEach(s => o[s.key] = []);
  return o;
};

// Excel 导入模板列定义（基础信息 + 职位/项目经历）
const IMPORT_COLUMNS = [
  { key: 'name', label: '姓名*', desc: '必填，同一人多行时姓名保持一致', group: 'basic' },
  { key: 'gender', label: '性别', desc: '男/女', group: 'basic' },
  { key: 'birth_date', label: '出生日期', desc: '如：1990-01-15', group: 'basic' },
  { key: 'id_number', label: '身份证号', desc: '', group: 'basic' },
  { key: 'phone', label: '联系电话', desc: '', group: 'basic' },
  { key: 'education', label: '学历', desc: '博士/硕士/本科/大专/中专/高中/其他', group: 'basic' },
  { key: 'degree', label: '学位', desc: '博士/硕士/学士/无学位', group: 'basic' },
  { key: 'school', label: '毕业院校', desc: '', group: 'basic' },
  { key: 'major', label: '专业', desc: '', group: 'basic' },
  { key: 'title', label: '职称', desc: '如：高级工程师', group: 'basic' },
  { key: 'job_title', label: '职务', desc: '现任职务', group: 'basic' },
  { key: 'organization', label: '现所在机构', desc: '', group: 'basic' },
  { key: 'department', label: '现所在部门', desc: '', group: 'basic' },
  { key: 'certificate_summary', label: '资质证书', desc: '如：一级建造师、注册监理工程师', group: 'basic' },
  { key: 'assigned_role', label: '拟在本项目担任职务', desc: '如：项目经理', group: 'basic' },
  { key: 'work_start_date', label: '入职时间', desc: '如：2020-12-01', group: 'basic' },
  { key: 'graduation_date', label: '毕业时间', desc: '如：2012-06-30', group: 'basic' },
  { key: 'position_name', label: '职位名称', desc: '如：项目经理（同一人可有多行不同职位）', group: 'project' },
  { key: 'project_name', label: '项目名称', desc: '', group: 'project' },
  { key: 'project_start_date', label: '项目开始日期', desc: '如：2020-01', group: 'project' },
  { key: 'project_end_date', label: '项目结束日期', desc: '如：2021-06', group: 'project' },
  { key: 'project_role', label: '担任角色', desc: '如：项目经理', group: 'project' },
  { key: 'project_description', label: '工作内容', desc: '简要描述工作内容', group: 'project' },
];

const VALID_EDUCATIONS = ['博士', '硕士', '本科', '大专', '中专', '高中', '其他'];
const VALID_DEGREES = ['博士', '硕士', '学士', '无学位'];
const VALID_GENDERS = ['男', '女'];

// 计算型字段工具函数：根据日期实时计算年龄/年限
const calcYearsDiff = (startDate, endDate) => {
  if (!startDate) return null;
  const start = dayjs(startDate);
  const end = endDate ? dayjs(endDate) : dayjs();
  if (!start.isValid()) return null;
  let years = end.year() - start.year();
  if (end.month() < start.month() || (end.month() === start.month() && end.date() < start.date())) {
    years--;
  }
  return years < 0 ? 0 : years;
};

const calcAge = (birthDate) => calcYearsDiff(birthDate);
const calcCompanyWorkYears = (workStartDate) => calcYearsDiff(workStartDate);
const calcTotalWorkYears = (graduationDate) => calcYearsDiff(graduationDate);

/**
 * 身份证有效期状态判断
 * @returns {{ label: string, color: string, daysLeft: number|null }}
 */
const getIdCardExpiryStatus = (validEnd, isPermanent) => {
  if (isPermanent) return { label: '长期', color: 'blue', daysLeft: null };
  if (!validEnd) return { label: '未录入', color: 'default', daysLeft: null };

  const end = dayjs(validEnd);
  const now = dayjs();
  const daysLeft = end.diff(now, 'day');

  if (daysLeft < 0) return { label: '已过期', color: 'red', daysLeft };
  if (daysLeft <= 30) return { label: '即将过期', color: 'red', daysLeft };
  if (daysLeft <= 90) return { label: '临近过期', color: 'orange', daysLeft };
  return { label: '有效', color: 'green', daysLeft };
};

export default function PersonnelLibrary() {
  const { user } = useAuth();
  const [personnel, setPersonnel] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [form] = Form.useForm();
  const [attachmentUrls, setAttachmentUrls] = useState(emptyAttachments());
  const [idCardOcrLoading, setIdCardOcrLoading] = useState(false);
  const [idCardValidity, setIdCardValidity] = useState({ valid_start: null, valid_end: null, is_permanent: false });

  // Excel 导入相关状态
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importStep, setImportStep] = useState(0); // 0=上传, 1=预览, 2=导入中
  const [importData, setImportData] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef(null);

  useEffect(() => {
    if (user) fetchPersonnel();
  }, [user]);

  useEffect(() => {
    if (!searchText.trim()) {
      setFiltered(personnel);
      return;
    }
    const kw = searchText.toLowerCase();
    setFiltered(personnel.filter(p =>
      (p.name || '').toLowerCase().includes(kw) ||
      (p.phone || '').includes(kw) ||
      (p.education || '').includes(kw) ||
      (p.title || '').toLowerCase().includes(kw) ||
      (p.school || '').toLowerCase().includes(kw)
    ));
  }, [searchText, personnel]);

  const fetchPersonnel = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('personnel_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPersonnel(data || []);
    } catch (err) {
      message.error('加载人员列表失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // =================== Excel 导入功能 ===================

  /** 下载导入模板 */
  const handleDownloadTemplate = () => {
    const header = IMPORT_COLUMNS.map(c => c.label);
    const descRow = IMPORT_COLUMNS.map(c => c.desc || '');

    // 示例行1：张三 的两个项目（同一人，两行不同项目经历）
    const example1 = ['张三', '男', '1985-03-15', '110101198503150012', '13800138000', '硕士', '硕士', '清华大学', '计算机科学', '高级工程师', '技术总监', 'XX科技有限公司', '研发部', '一级建造师、PMP', '项目经理', '2018-06-01', '2009-07-01', '技术负责人', '智慧城市一体化平台', '2020-01', '2022-06', '技术负责人', '负责系统整体架构设计与技术团队管理'];
    const example2 = ['张三', '男', '1985-03-15', '110101198503150012', '13800138000', '硕士', '硕士', '清华大学', '计算机科学', '高级工程师', '技术总监', 'XX科技有限公司', '研发部', '一级建造师、PMP', '项目经理', '2018-06-01', '2009-07-01', '技术负责人', '数据中心建设项目', '2022-07', '2023-12', '项目经理', '全面负责项目进度与交付'];
    const example3 = ['李四', '女', '1990-08-20', '', '13900139000', '本科', '学士', '北京大学', '软件工程', '工程师', '部门经理', 'YY集团有限公司', '项目部', '注册造价工程师', '造价工程师', '2019-03-15', '2012-06-30', '造价工程师', '城市轨道交通4号线工程造价审计', '2019-05', '2021-03', '造价负责人', '负责全过程工程造价审计与结算审核'];
    const example4 = ['王五', '男', '1978-11-02', '320102197811020035', '13700137000', '博士', '博士', '浙江大学', '土木工程', '正高级工程师', '副总经理', 'ZZ建设集团股份有限公司', '总工办', '一级建造师、注册监理工程师', '项目总监', '2005-08-01', '2003-06-30', '', '', '', '', '', ''];

    const ws = XLSX.utils.aoa_to_sheet([header, descRow, example1, example2, example3, example4]);
    // 设置列宽
    ws['!cols'] = IMPORT_COLUMNS.map(c => {
      if (c.key === 'name') return { wch: 10 };
      if (c.key === 'id_number') return { wch: 22 };
      if (c.key === 'project_description') return { wch: 30 };
      if (c.key === 'project_name') return { wch: 22 };
      if (c.key === 'assigned_role') return { wch: 18 };
      return { wch: 14 };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '人员信息');
    XLSX.writeFile(wb, '人员信息导入模板.xlsx');
    message.success('模板已下载，请按模板格式填写人员数据');
  };

  /** 解析 Excel 文件 */
  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheetName || !sheet) {
          message.error('无法读取工作表');
          return;
        }
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        if (json.length === 0) {
          message.error('Excel 文件中没有数据行');
          return;
        }

        // 生成列名映射表（支持中英文列头）
        const headerMap = {};
        IMPORT_COLUMNS.forEach(col => {
          headerMap[col.label] = col.key;
          headerMap[col.key] = col.key;
        });
        // 额外兼容别名
        headerMap['姓名'] = 'name';
        headerMap['性别'] = 'gender';
        headerMap['出生日期'] = 'birth_date';
        headerMap['身份证号'] = 'id_number';
        headerMap['联系电话'] = 'phone';
        headerMap['电话'] = 'phone';
        headerMap['学历'] = 'education';
        headerMap['学位'] = 'degree';
        headerMap['毕业院校'] = 'school';
        headerMap['学校'] = 'school';
        headerMap['专业'] = 'major';
        headerMap['职称'] = 'title';
        headerMap['职务'] = 'job_title';
        headerMap['现所在机构'] = 'organization';
        headerMap['机构'] = 'organization';
        headerMap['现所在部门'] = 'department';
        headerMap['部门'] = 'department';
        headerMap['拟在本项目担任职务'] = 'assigned_role';
        headerMap['资质证书'] = 'certificate_summary';
        headerMap['证书'] = 'certificate_summary';
        headerMap['拟任职务'] = 'assigned_role';
        headerMap['本项目职务'] = 'assigned_role';
        headerMap['入职时间'] = 'work_start_date';
        headerMap['入职日期'] = 'work_start_date';
        headerMap['毕业时间'] = 'graduation_date';
        headerMap['毕业日期'] = 'graduation_date';
        headerMap['职位名称'] = 'position_name';
        headerMap['职位'] = 'position_name';
        headerMap['项目名称'] = 'project_name';
        headerMap['项目开始日期'] = 'project_start_date';
        headerMap['项目开始'] = 'project_start_date';
        headerMap['项目结束日期'] = 'project_end_date';
        headerMap['项目结束'] = 'project_end_date';
        headerMap['担任角色'] = 'project_role';
        headerMap['项目角色'] = 'project_role';
        headerMap['工作内容'] = 'project_description';

        const rawRows = [];
        const parseErrors = [];

        json.forEach((row, idx) => {
          const mapped = {};
          Object.entries(row).forEach(([key, val]) => {
            const k = key.trim();
            const fieldKey = headerMap[k];
            if (fieldKey) {
              mapped[fieldKey] = val !== undefined && val !== null ? String(val).trim() : '';
            }
          });

          // 日期字段处理
          const dateFields = ['birth_date', 'work_start_date', 'graduation_date'];
          dateFields.forEach(field => {
            if (mapped[field]) {
              if (mapped[field] instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(mapped[field])) {
                const d = dayjs(mapped[field] instanceof Date ? mapped[field] : mapped[field]);
                mapped[field] = d.isValid() ? d.format('YYYY-MM-DD') : '';
              } else {
                const d = dayjs(mapped[field]);
                mapped[field] = d.isValid() ? d.format('YYYY-MM-DD') : '';
              }
            }
          });

          // 校验必填字段
          if (!mapped.name) {
            parseErrors.push(`第 ${idx + 2} 行：姓名为空，已跳过`);
            return;
          }

          // 校验枚举字段
          if (mapped.gender && !VALID_GENDERS.includes(mapped.gender)) {
            parseErrors.push(`第 ${idx + 2} 行：性别 "${mapped.gender}" 无效，应为 男/女`);
            mapped.gender = '';
          }
          if (mapped.education && !VALID_EDUCATIONS.includes(mapped.education)) {
            parseErrors.push(`第 ${idx + 2} 行：学历 "${mapped.education}" 无效，应为 ${VALID_EDUCATIONS.join('/')}`);
            mapped.education = '';
          }
          if (mapped.degree && !VALID_DEGREES.includes(mapped.degree)) {
            parseErrors.push(`第 ${idx + 2} 行：学位 "${mapped.degree}" 无效，应为 ${VALID_DEGREES.join('/')}`);
            mapped.degree = '';
          }

          rawRows.push({ ...mapped, _rowIndex: idx + 2 });
        });

        if (rawRows.length === 0 && json.length > 0) {
          message.error('所有行的姓名都为空，无法导入');
          return;
        }

        // ===== 按姓名分组，合并同一人的多行为一个人的完整记录 =====
        const groupedMap = new Map(); // name -> { basic fields, jobPositions: Map<positionName, { project_experiences }> }
        const groupOrder = []; // 保持插入顺序

        rawRows.forEach(row => {
          const name = row.name;
          if (!groupedMap.has(name)) {
            groupedMap.set(name, {
              // 基础信息取第一次出现的值（非空的优先）
              basic: { ...row },
              // 职位 -> 项目经历列表（按 position_name 分组）
              jobPositions: new Map(),
            });
            groupOrder.push(name);
          } else {
            // 合并基础信息：用非空值覆盖空值
            const existing = groupedMap.get(name);
            const basicFields = ['gender', 'birth_date', 'id_number', 'phone', 'education', 'degree', 'school', 'major', 'title', 'job_title', 'organization', 'department', 'assigned_role', 'work_start_date', 'graduation_date', 'certificate_summary'];
            basicFields.forEach(f => {
              if (!existing.basic[f] && row[f]) {
                existing.basic[f] = row[f];
              }
            });
          }

          // 处理职位与项目经历
          const positionName = row.position_name || row.job_title || '默认职位';
          const hasProject = row.project_name || row.project_role || row.project_start_date || row.project_end_date || row.project_description;

          if (!groupedMap.get(name).jobPositions.has(positionName)) {
            groupedMap.get(name).jobPositions.set(positionName, []);
          }

          if (hasProject) {
            const projExp = {
              project_name: row.project_name || '',
              role: row.project_role || '',
              time_range: null,
              description: row.project_description || '',
            };

            // 拼接起止时间
            const start = row.project_start_date;
            const end = row.project_end_date;
            if (start || end) {
              projExp.time_range = [start || '', end || ''];
            }

            groupedMap.get(name).jobPositions.get(positionName).push(projExp);
          }
        });

        // 转换为导入数据格式
        const parsedRows = [];
        groupOrder.forEach(name => {
          const group = groupedMap.get(name);
          const basic = group.basic;
          const jobPositions = [];

          group.jobPositions.forEach((projectExperiences, positionName) => {
            jobPositions.push({
              position_name: positionName,
              project_experiences: projectExperiences,
            });
          });

          parsedRows.push({
            ...basic,
            _rowIndex: basic._rowIndex,
            _jobPositions: jobPositions,
            _jobPositionCount: jobPositions.length,
            _projectCount: jobPositions.reduce((s, p) => s + p.project_experiences.length, 0),
          });
        });

        // 检查与现有人员姓名重复
        const existingNames = new Set(personnel.map(p => p.name));
        parsedRows.forEach(row => {
          if (existingNames.has(row.name)) {
            row._duplicate = true;
          }
        });

        setImportData(parsedRows);
        setImportErrors(parseErrors);
        setImportStep(1);
      } catch (err) {
        console.error('解析 Excel 失败:', err);
        message.error('解析 Excel 文件失败: ' + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    return false; // 阻止 antd Upload 自动上传
  };

  /** 执行批量导入 */
  const handleDoImport = async () => {
    const validRows = importData.filter(r => !r._duplicate);
    if (validRows.length === 0) {
      message.warning('没有可导入的数据');
      return;
    }

    // 获取 company_profile_id
    const { data: companies } = await supabase
      .from('company_profiles')
      .select('id')
      .eq('user_id', user.id)
      .limit(1);
    const companyId = companies && companies.length > 0 ? companies[0].id : null;
    if (!companyId) {
      message.error('请先在投标主体库中创建至少一个公司');
      return;
    }

    setImporting(true);
    setImportStep(2);
    setImportProgress({ current: 0, total: validRows.length });

    let successCount = 0;
    let failCount = 0;
    const failErrors = [];

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        const profileData = {
          user_id: user.id,
          company_profile_id: companyId,
          name: row.name,
          gender: row.gender || null,
          birth_date: row.birth_date || null,
          id_number: row.id_number || null,
          phone: row.phone || null,
          education: row.education || null,
          degree: row.degree || null,
          school: row.school || null,
          major: row.major || null,
          title: row.title || null,
          job_title: row.job_title || null,
          organization: row.organization || null,
          department: row.department || null,
          assigned_role: row.assigned_role || null,
          certificate_summary: row.certificate_summary || null,
          work_start_date: row.work_start_date || null,
          graduation_date: row.graduation_date || null,
          custom_fields: { job_positions: row._jobPositions || [] },
          id_card_valid_start: null,
          id_card_valid_end: null,
          id_card_is_permanent: false,
        };

        const { error } = await supabase
          .from('personnel_profiles')
          .insert(profileData);

        if (error) {
          failCount++;
          failErrors.push(`"${row.name}" 导入失败: ${error.message}`);
        } else {
          successCount++;
        }
      } catch (err) {
        failCount++;
        failErrors.push(`"${row.name}" 导入异常: ${err.message}`);
      }
      setImportProgress({ current: i + 1, total: validRows.length });
    }

    setImporting(false);

    if (failCount === 0) {
      message.success(`成功导入 ${successCount} 条人员数据`);
      setImportModalVisible(false);
      fetchPersonnel();
    } else {
      message.warning(`导入完成：成功 ${successCount} 条，失败 ${failCount} 条`);
      setImportErrors(prev => [...prev, ...failErrors]);
    }
  };

  /** 重置导入状态 */
  const resetImportState = () => {
    setImportStep(0);
    setImportData([]);
    setImportErrors([]);
    setImportProgress({ current: 0, total: 0 });
    setImporting(false);
  };

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    // 为新增人员设置默认的空职位结构
    form.setFieldsValue({
      job_positions: [{
        position_name: '',
        project_experiences: []
      }]
    });
    setAttachmentUrls(emptyAttachments());
    setIdCardValidity({ valid_start: null, valid_end: null, is_permanent: false });
    setDrawerVisible(true);
  };

  const handleEdit = async (record) => {
    setEditingRecord(record);
    const cf = record.custom_fields || {};
    
    // 加载身份证有效期
    setIdCardValidity({
      valid_start: record.id_card_valid_start || null,
      valid_end: record.id_card_valid_end || null,
      is_permanent: record.id_card_is_permanent || false,
    });
    
    // 兼容新旧数据格式
    let jobPositions = [];
    if (cf.job_positions && Array.isArray(cf.job_positions)) {
      // 新格式：多职位
      jobPositions = cf.job_positions;
    } else if (cf.project_experiences && Array.isArray(cf.project_experiences)) {
      // 旧格式：单职位，自动转换
      jobPositions = [{
        position_name: record.job_title || '未分类',
        project_experiences: cf.project_experiences
      }];
    }

    form.setFieldsValue({
      name: record.name,
      gender: record.gender,
      education: record.education,
      title: record.title || null,
      job_title: record.job_title || null,
      phone: record.phone,
      id_number: record.id_number,
      school: record.school,
      major: record.major,
      degree: record.degree,
      birth_date: record.birth_date ? dayjs(record.birth_date) : null,
      work_start_date: record.work_start_date ? dayjs(record.work_start_date) : null,
      graduation_date: record.graduation_date ? dayjs(record.graduation_date) : null,
      organization: record.organization,
      department: record.department,
      assigned_role: record.assigned_role,
      certificate_summary: record.certificate_summary,
      job_positions: jobPositions.map(pos => ({
        position_name: pos.position_name || '',
        project_experiences: (pos.project_experiences || []).map(p => ({
          project_name: p.project_name || '',
          time_range: p.time_range ? [dayjs(p.time_range[0]), dayjs(p.time_range[1])] : undefined,
          role: p.role || '',
          description: p.description || '',
        }))
      }))
    });

    try {
      const { data: attachments, error } = await supabase
        .from('personnel_attachments')
        .select('*')
        .eq('personnel_profile_id', record.id)
        .eq('enabled', true);
      if (error) throw error;

      const urls = emptyAttachments();
      (attachments || []).forEach(att => {
        if (urls[att.attachment_type] !== undefined) {
          urls[att.attachment_type].push({
            uid: att.id,
            name: att.attachment_name,
            status: 'done',
            url: att.file_url,
            _dbId: att.id,
          });
        }
      });
      setAttachmentUrls(urls);
    } catch (err) {
      console.error('加载附件失败:', err);
      setAttachmentUrls(emptyAttachments());
    }

    setDrawerVisible(true);
  };

  const handleDelete = async (record) => {
    try {
      await deletePersonnelAttachments([record.id]);
      const { error } = await supabase.from('personnel_profiles').delete().eq('id', record.id);
      if (error) throw error;
      message.success('删除成功');
      fetchPersonnel();
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRowKeys.length === 0) return;
    try {
      for (const id of selectedRowKeys) {
        await deletePersonnelAttachments([id]);
      }
      const { error } = await supabase.from('personnel_profiles').delete().in('id', selectedRowKeys);
      if (error) throw error;
      message.success(`已删除 ${selectedRowKeys.length} 条记录`);
      setSelectedRowKeys([]);
      fetchPersonnel();
    } catch (err) {
      message.error('批量删除失败: ' + err.message);
    }
  };

  const deletePersonnelAttachments = async (profileIds) => {
    const { data: attachments } = await supabase
      .from('personnel_attachments')
      .select('id, file_url')
      .in('personnel_profile_id', profileIds);

    if (attachments && attachments.length > 0) {
      const paths = attachments.map(a => {
        try {
          const url = new URL(a.file_url);
          return decodeURIComponent(url.pathname.split('/personnel-attachments/')[1] || '');
        } catch { return ''; }
      }).filter(Boolean);
      if (paths.length > 0) {
        await supabase.storage.from('personnel-attachments').remove(paths);
      }
      const ids = attachments.map(a => a.id);
      await supabase.from('personnel_attachments').delete().in('id', ids);
    }
  };

  const uploadFile = async (file) => {
    const ext = file.name.split('.').pop();
    const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
    const filePath = `${user.id}/${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from('personnel-attachments')
      .upload(filePath, file);
    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from('personnel-attachments')
      .getPublicUrl(filePath);

    return {
      file_url: urlData.publicUrl,
      file_path: filePath,
      attachment_name: file.name,
      file_type: file.type,
      file_size: file.size,
    };
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      // 新格式：多职位结构
      const jobPositions = (values.job_positions || []).map(pos => ({
        position_name: pos.position_name || '',
        project_experiences: (pos.project_experiences || []).map(pe => ({
          project_name: pe.project_name || '',
          time_range: pe.time_range
            ? [pe.time_range[0].format('YYYY-MM-DD'), pe.time_range[1].format('YYYY-MM-DD')]
            : null,
          role: pe.role || '',
          description: pe.description || '',
        }))
      }));

      const profileData = {
        user_id: user.id,
        name: values.name,
        gender: values.gender || null,
        education: values.education || null,
        degree: values.degree || null,
        title: values.title || null,
        job_title: values.job_title || null,
        phone: values.phone || null,
        id_number: values.id_number || null,
        school: values.school || null,
        major: values.major || null,
        birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : null,
        work_start_date: values.work_start_date ? values.work_start_date.format('YYYY-MM-DD') : null,
        graduation_date: values.graduation_date ? values.graduation_date.format('YYYY-MM-DD') : null,
        organization: values.organization || null,
        department: values.department || null,
        assigned_role: values.assigned_role || null,
        certificate_summary: values.certificate_summary || null,
        custom_fields: { job_positions: jobPositions },
        // 身份证有效期
        id_card_valid_start: idCardValidity.valid_start || null,
        id_card_valid_end: idCardValidity.valid_end || null,
        id_card_is_permanent: idCardValidity.is_permanent || false,
      };

      let profileId;

      if (editingRecord) {
        const { error } = await supabase
          .from('personnel_profiles')
          .update(profileData)
          .eq('id', editingRecord.id);
        if (error) throw error;
        profileId = editingRecord.id;
      } else {
        const { data: companies } = await supabase
          .from('company_profiles')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);
        const companyId = companies && companies.length > 0 ? companies[0].id : null;
        if (!companyId) {
          message.error('请先在投标主体库中创建至少一个公司');
          setSaving(false);
          return;
        }
        profileData.company_profile_id = companyId;
        const { data, error } = await supabase
          .from('personnel_profiles')
          .insert(profileData)
          .select()
          .single();
        if (error) throw error;
        profileId = data.id;
      }

      const newAttachments = [];
      for (const [attachType, files] of Object.entries(attachmentUrls)) {
        for (const f of files) {
          if (f._dbId) continue;
          if (f.originFileObj) {
            const uploaded = await uploadFile(f.originFileObj);
            newAttachments.push({
              user_id: user.id,
              personnel_profile_id: profileId,
              attachment_type: attachType,
              attachment_name: uploaded.attachment_name,
              file_url: uploaded.file_url,
              file_type: uploaded.file_type,
              file_size: uploaded.file_size,
              enabled: true,
            });
          }
        }
      }

      if (newAttachments.length > 0) {
        const { error: attachError } = await supabase
          .from('personnel_attachments')
          .insert(newAttachments);
        if (attachError) throw attachError;
      }

      message.success(editingRecord ? '保存成功' : '新增成功');
      setDrawerVisible(false);
      fetchPersonnel();
    } catch (err) {
      if (err.errorFields) return;
      message.error('保存失败: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveAttachment = async (file, attachType) => {
    if (file._dbId) {
      try {
        if (file.url) {
          const url = new URL(file.url);
          const path = decodeURIComponent(url.pathname.split('/personnel-attachments/')[1] || '');
          if (path) await supabase.storage.from('personnel-attachments').remove([path]);
        }
        await supabase.from('personnel_attachments').delete().eq('id', file._dbId);
      } catch (err) {
        console.error('删除附件失败:', err);
      }
    }
    setAttachmentUrls(prev => ({
      ...prev,
      [attachType]: prev[attachType].filter(f => f.uid !== file.uid),
    }));
  };

  /** 身份证反面上传后自动 OCR 识别有效期 */
  const handleIDCardBackOCR = async (file) => {
    if (!file || !file.originFileObj) return;
    setIdCardOcrLoading(true);
    try {
      const result = await extractIDCardBack(file.originFileObj);
      if (result.valid_start || result.valid_end || result.is_permanent) {
        setIdCardValidity({
          valid_start: result.valid_start,
          valid_end: result.valid_end,
          is_permanent: result.is_permanent,
        });
        message.success(`身份证有效期识别成功：${result.is_permanent ? '长期有效' : `${result.valid_start || '?'} 至 ${result.valid_end || '?'}`}`);
      } else {
        message.warning('未能识别到身份证有效期，请手动填写');
      }
    } catch (err) {
      console.error('身份证OCR识别失败:', err);
      message.warning(`身份证识别失败：${err.message}，请手动填写有效期`);
    } finally {
      setIdCardOcrLoading(false);
    }
  };

  const makeUploadProps = (section) => ({
    listType: 'picture-card',
    fileList: attachmentUrls[section.key],
    accept: section.accept,
    maxCount: section.maxCount,
    beforeUpload: () => false,
    onChange: ({ fileList }) => {
      setAttachmentUrls(prev => ({ ...prev, [section.key]: fileList }));
      // 身份证反面上传后自动触发 OCR（仅在新文件添加且状态非 done 时触发，避免重复调用）
      if (section.key === 'id_card_back' && fileList.length > 0) {
        const latestFile = fileList[fileList.length - 1];
        if (latestFile.originFileObj && latestFile.status !== 'done' && latestFile.status !== 'removed') {
          handleIDCardBackOCR(latestFile);
        }
      }
    },
    onRemove: (file) => handleRemoveAttachment(file, section.key),
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const result = await uploadFile(file);
        setAttachmentUrls(prev => ({
          ...prev,
          [section.key]: prev[section.key].map(f =>
            f.uid === file.uid ? { ...f, status: 'done', url: result.file_url } : f
          ),
        }));
        onSuccess(result);
      } catch (err) {
        onError(err);
        message.error(`上传失败: ${err.message}`);
      }
    },
  });

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 90,
      render: (t) => <span className="font-semibold text-gray-800">{t}</span>,
    },
    {
      title: '性别',
      dataIndex: 'gender',
      key: 'gender',
      width: 50,
      align: 'center',
    },
    {
      title: '出生日期',
      dataIndex: 'birth_date',
      key: 'birth_date',
      width: 100,
      render: (t) => t ? t.slice(0, 10) : <span className="text-gray-300">-</span>,
    },
    {
      title: '年龄',
      key: 'age',
      width: 60,
      align: 'center',
      render: (_, r) => {
        const age = calcAge(r.birth_date);
        return age !== null ? <span className="text-gray-700 font-medium">{age}</span> : <span className="text-gray-300">-</span>;
      },
    },
    {
      title: '学历',
      dataIndex: 'education',
      key: 'education',
      width: 70,
      align: 'center',
      render: (t) => t ? <Tag>{t}</Tag> : <span className="text-gray-300">-</span>,
    },
    {
      title: '学位',
      dataIndex: 'degree',
      key: 'degree',
      width: 70,
      align: 'center',
      render: (t) => t ? <Tag color="green">{t}</Tag> : <span className="text-gray-300">-</span>,
    },
    {
      title: '职称/职务',
      key: 'title_job',
      width: 120,
      ellipsis: true,
      render: (_, r) => {
        const parts = [];
        if (r.title) parts.push(r.title);
        if (r.job_title) parts.push(r.job_title);
        return parts.length > 0 ? <span className="text-xs">{parts.join(' / ')}</span> : <span className="text-gray-300">-</span>;
      },
    },
    {
      title: '入职时间',
      dataIndex: 'work_start_date',
      key: 'work_start_date',
      width: 100,
      render: (t) => t ? t.slice(0, 10) : <span className="text-gray-300">-</span>,
    },
    {
      title: '本公司年限',
      key: 'company_years',
      width: 90,
      align: 'center',
      render: (_, r) => {
        const y = calcCompanyWorkYears(r.work_start_date);
        return y !== null ? <span className="text-emerald-600 font-medium">{y} 年</span> : <span className="text-gray-300">-</span>;
      },
    },
    {
      title: '毕业时间',
      dataIndex: 'graduation_date',
      key: 'graduation_date',
      width: 100,
      render: (t) => t ? t.slice(0, 10) : <span className="text-gray-300">-</span>,
    },
    {
      title: '工作年限',
      key: 'work_years',
      width: 90,
      align: 'center',
      render: (_, r) => {
        const y = calcTotalWorkYears(r.graduation_date);
        return y !== null ? <span className="text-blue-600 font-medium">{y} 年</span> : <span className="text-gray-300">-</span>;
      },
    },
    {
      title: '资质证书',
      dataIndex: 'certificate_summary',
      key: 'certificate_summary',
      width: 160,
      ellipsis: true,
      render: (t) => t ? <span className="text-xs text-gray-700">{t}</span> : <span className="text-gray-300">-</span>,
    },
    {
      title: '现所在机构/部门',
      key: 'org',
      width: 150,
      ellipsis: true,
      render: (_, r) => {
        const parts = [];
        if (r.organization) parts.push(r.organization);
        if (r.department) parts.push(r.department);
        return parts.length > 0 ? <span className="text-xs text-gray-600">{parts.join(' / ')}</span> : <span className="text-gray-300">-</span>;
      },
    },
    {
      title: '拟任本项目职务',
      dataIndex: 'assigned_role',
      key: 'assigned_role',
      width: 120,
      ellipsis: true,
      render: (t) => t ? <Tag color="blue">{t}</Tag> : <span className="text-gray-300">-</span>,
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 120,
    },
    {
      title: '项目经历',
      key: 'projects',
      width: 90,
      align: 'center',
      render: (_, r) => {
        const cf = r.custom_fields || {};
        let totalProjects = 0;
        
        // 兼容新旧格式
        if (cf.job_positions && Array.isArray(cf.job_positions)) {
          totalProjects = cf.job_positions.reduce((sum, pos) => 
            sum + (pos.project_experiences || []).length, 0);
        } else if (cf.project_experiences && Array.isArray(cf.project_experiences)) {
          totalProjects = cf.project_experiences.length;
        }
        
        if (totalProjects === 0) return <span className="text-gray-300 text-xs">无</span>;
        return <Tag color="blue">{totalProjects} 个</Tag>;
      },
    },
    {
      title: '证件',
      key: 'attachments',
      width: 160,
      render: (_, r) => {
        const tags = [];
        if (r.attachments && Array.isArray(r.attachments)) {
          const types = new Set(r.attachments.map(a => a.attachment_type || a.type));
          const labelMap = { id_card_front: '身份证', id_card_back: '身份证', degree_certificate: '学位证', qualification_certificate: '资质证' };
          types.forEach(t => { if (labelMap[t]) tags.push(labelMap[t]); });
        }
        const unique = [...new Set(tags)];
        if (unique.length === 0) return <span className="text-gray-300 text-xs">无</span>;
        return unique.map(t => <Tag key={t} className="text-xs">{t}</Tag>);
      },
    },
    {
      title: '身份证有效期',
      key: 'id_card_validity',
      width: 140,
      render: (_, r) => {
        if (r.id_card_is_permanent) {
          return <Tag color="blue">长期有效</Tag>;
        }
        if (!r.id_card_valid_end && !r.id_card_valid_start) {
          return <span className="text-gray-300 text-xs">未录入</span>;
        }
        const status = getIdCardExpiryStatus(r.id_card_valid_end, r.id_card_is_permanent);
        const endStr = r.id_card_valid_end ? r.id_card_valid_end.slice(0, 10) : '?';
        return (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-600">{endStr}</span>
            <Tag color={status.color} className="!text-xs !px-1.5 !py-0 !m-0 inline-block" style={{ width: 'fit-content' }}>
              {status.label}{status.daysLeft !== null && status.daysLeft >= 0 ? ` ${status.daysLeft}天` : ''}
              {status.daysLeft !== null && status.daysLeft < 0 ? ` ${Math.abs(status.daysLeft)}天` : ''}
            </Tag>
          </div>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该人员？" onConfirm={() => handleDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between bg-white rounded-xl px-5 py-3 shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className="rounded-lg shadow-sm"
          >
            新增人员
          </Button>

          <Button
            icon={<FileExcelOutlined />}
            onClick={() => { resetImportState(); setImportModalVisible(true); }}
            className="rounded-lg bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300"
          >
            一键导入
          </Button>

          <Popconfirm
            title={`确定删除选中的 ${selectedRowKeys.length} 条记录？`}
            onConfirm={handleBatchDelete}
            disabled={selectedRowKeys.length === 0}
          >
            <Button
              danger={selectedRowKeys.length > 0}
              disabled={selectedRowKeys.length === 0}
              icon={<DeleteOutlined />}
              className="rounded-lg"
            >
              批量删除 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length})`}
            </Button>
          </Popconfirm>

          <span className="text-xs text-gray-400 ml-1">
            共 {personnel.length} 条 · 已筛选 {filtered.length} 条
          </span>
        </div>

        <Input
          placeholder="搜索姓名 / 电话 / 学历 / 职称..."
          prefix={<SearchOutlined className="text-gray-300" />}
          allowClear
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="w-72 rounded-lg"
        />
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: t => `共 ${t} 条` }}
          size="middle"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          scroll={{ x: 1420 }}
          className="[&_.ant-table-thead>tr>th]:bg-gray-50/80 [&_.ant-table-thead>tr>th]:font-semibold [&_.ant-table-thead>tr>th]:text-xs"
          locale={{ emptyText: (
            <div className="py-8 text-center">
              <UserOutlined className="text-3xl text-gray-200 mb-2 block" />
              <p className="text-gray-400 text-sm">暂无人员数据</p>
              <p className="text-gray-300 text-xs mt-1">点击"新增人员"开始录入</p>
            </div>
          )}}
        />
      </div>

      {/* 新增/编辑 Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
              <UserOutlined className="text-indigo-500" />
            </div>
            <div>
              <div className="font-bold text-base">{editingRecord ? '编辑人员' : '新增人员'}</div>
              <div className="text-xs text-gray-400 font-normal">填写基础信息和项目经历</div>
            </div>
          </div>
        }
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={700}
        styles={{ body: { padding: '0 24px 24px' } }}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={handleSave} className="rounded-lg">
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" className="mt-4">
          {/* 区块 A：基础信息 */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 bg-indigo-500 rounded-full" />
              <span className="font-bold text-sm text-gray-700">基础信息</span>
            </div>

            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
              <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
                <Input placeholder="请输入姓名" />
              </Form.Item>
              <Form.Item label="性别" name="gender">
                <Select placeholder="请选择" allowClear options={GENDER_OPTIONS} />
              </Form.Item>
              <div className="flex gap-2">
                <Form.Item label="出生日期" name="birth_date" className="flex-1">
                  <DatePicker className="w-full" placeholder="选择日期" />
                </Form.Item>
                <Form.Item label="年龄" className="w-[72px]">
                  <Input value={(() => { const v = form.getFieldValue('birth_date'); const a = v ? calcAge(v) : ''; return a !== null && a !== undefined && a !== '' ? a + ' 岁' : ''; })()} disabled className="!bg-gray-50 !text-gray-500" />
                </Form.Item>
              </div>
              <Form.Item label="学历" name="education">
                <Select placeholder="请选择" allowClear options={EDUCATION_OPTIONS} />
              </Form.Item>
              <Form.Item label="学位" name="degree">
                <Select placeholder="请选择" allowClear options={DEGREE_OPTIONS} />
              </Form.Item>
              <Form.Item label="职称" name="title">
                <Input placeholder="如：高级工程师" />
              </Form.Item>
              <Form.Item label="职务" name="job_title">
                <Input placeholder="现任职务" />
              </Form.Item>
              <Form.Item label="联系电话" name="phone">
                <Input placeholder="联系电话" />
              </Form.Item>
              <Form.Item label="身份证号" name="id_number">
                <Input placeholder="身份证号码" />
              </Form.Item>
              <div className="flex gap-2">
                <Form.Item label="毕业院校" name="school" className="flex-1">
                  <Input placeholder="毕业院校" />
                </Form.Item>
                <div className="w-[140px]">
                  <Form.Item label="毕业时间" name="graduation_date">
                    <DatePicker className="w-full" placeholder="选择日期" />
                  </Form.Item>
                </div>
              </div>
              <Form.Item label="专业" name="major">
                <Input placeholder="所学专业" />
              </Form.Item>
              <div className="flex gap-2">
                <Form.Item label="入职时间" name="work_start_date" className="flex-1">
                  <DatePicker className="w-full" placeholder="选择日期" />
                </Form.Item>
                <Form.Item label="本公司年限" className="w-[90px]">
                  <Input value={(() => { const v = form.getFieldValue('work_start_date'); const y = v ? calcCompanyWorkYears(v) : ''; return y !== null && y !== undefined && y !== '' ? y + ' 年' : ''; })()} disabled className="!bg-gray-50 !text-gray-500" />
                </Form.Item>
              </div>
              <Form.Item label="现所在机构" name="organization">
                <Input placeholder="现所在机构名称" />
              </Form.Item>
              <Form.Item label="现所在部门" name="department">
                <Input placeholder="部门/科室" />
              </Form.Item>
              <Form.Item label="拟在本项目担任职务" name="assigned_role">
                <Input placeholder="如：项目经理、技术负责人" />
              </Form.Item>
              <Form.Item label="资质证书" name="certificate_summary">
                <Input placeholder="如：一级建造师、注册监理工程师" />
              </Form.Item>
            </div>
          </div>

          {/* 区块 B：职位与项目经历 */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-4 mt-2">
              <div className="w-1 h-4 bg-emerald-500 rounded-full" />
              <span className="font-bold text-sm text-gray-700">职位与项目经历</span>
            </div>

            <Form.List name="job_positions">
              {(posFields, { add: addPos, remove: removePos }) => (
                <>
                  {posFields.map(({ key: posKey, name: posName, ...posRestField }) => (
                    <div key={posKey} className="mb-4 p-4 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-xl border border-blue-100 relative group hover:border-indigo-300 transition-all">
                      {/* 职位名称 */}
                      <div className="flex items-center gap-3 mb-3">
                        <Form.Item 
                          {...posRestField} 
                          name={[posName, 'position_name']} 
                          label={<span className="text-sm font-semibold text-gray-700">职位名称</span>}
                          className="mb-0 flex-1"
                          rules={[{ required: true, message: '请输入职位名称' }]}
                        >
                          <Input placeholder="如：产品经理、研发工程师" className="font-medium" />
                        </Form.Item>
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<MinusCircleOutlined />}
                          onClick={() => removePos(posName)}
                          className="!mt-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          删除职位
                        </Button>
                      </div>

                      {/* 该职位下的项目经历 */}
                      <div className="ml-2">
                        <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                          <ProjectOutlined className="text-emerald-500" />
                          项目经历
                        </div>
                        <Form.List name={[posName, 'project_experiences']}>
                          {(projFields, { add: addProj, remove: removeProj }) => (
                            <>
                              {projFields.map(({ key: projKey, name: projName, ...projRestField }) => (
                                <div key={projKey} className="mb-3 p-3 bg-white rounded-lg border border-gray-200 relative group/proj hover:border-emerald-300 transition-colors">
                                  <div className="grid grid-cols-2 gap-x-4">
                                    <Form.Item {...projRestField} name={[projName, 'project_name']} label="项目名称" className="mb-2">
                                      <Input placeholder="项目名称" />
                                    </Form.Item>
                                    <Form.Item {...projRestField} name={[projName, 'role']} label="担任角色" className="mb-2">
                                      <Input placeholder="如：项目经理" />
                                    </Form.Item>
                                  </div>
                                  <Form.Item {...projRestField} name={[projName, 'time_range']} label="起止时间" className="mb-2">
                                    <RangePicker className="w-full" />
                                  </Form.Item>
                                  <Form.Item {...projRestField} name={[projName, 'description']} label="工作内容" className="mb-0">
                                    <TextArea rows={2} placeholder="描述工作内容" />
                                  </Form.Item>
                                  <Button
                                    type="text"
                                    danger
                                    size="small"
                                    icon={<MinusCircleOutlined />}
                                    onClick={() => removeProj(projName)}
                                    className="!absolute top-2 right-2 opacity-0 group-hover/proj:opacity-100 transition-opacity"
                                  />
                                </div>
                              ))}
                              <Button 
                                type="dashed" 
                                onClick={() => addProj()} 
                                block 
                                icon={<PlusOutlined />} 
                                className="rounded-lg border-emerald-200 text-emerald-600 hover:border-emerald-400 hover:text-emerald-700"
                                size="small"
                              >
                                添加项目经历
                              </Button>
                            </>
                          )}
                        </Form.List>
                      </div>
                    </div>
                  ))}
                  <Button 
                    type="dashed" 
                    onClick={() => addPos({ position_name: '', project_experiences: [] })} 
                    block 
                    icon={<PlusOutlined />} 
                    className="rounded-lg border-blue-200 text-blue-600 hover:border-blue-400 hover:text-blue-700"
                  >
                    添加职位
                  </Button>
                </>
              )}
            </Form.List>
          </div>

          {/* 区块 C：证件附件 */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-4 mt-2">
              <div className="w-1 h-4 bg-amber-500 rounded-full" />
              <span className="font-bold text-sm text-gray-700">证件附件</span>
            </div>

            <div className="space-y-5">
              {ATTACHMENT_SECTIONS.map(section => (
                <div key={section.key}>
                  <div className="text-sm font-medium text-gray-600 mb-2">{section.label}</div>
                  <Upload {...makeUploadProps(section)}>
                    {attachmentUrls[section.key].length >= section.maxCount ? null : (
                      <div className="w-[104px] h-[104px] rounded-lg border-2 border-dashed border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all flex flex-col items-center justify-center cursor-pointer">
                        <UploadOutlined className="text-lg text-gray-300" />
                        <div className="text-[11px] text-gray-400 mt-1">点击上传</div>
                      </div>
                    )}
                  </Upload>
                </div>
              ))}
            </div>
          </div>

          {/* 区块 D：身份证有效期（上传反面后自动识别，也可手动填写） */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-4 mt-2">
              <div className="w-1 h-4 bg-rose-500 rounded-full" />
              <span className="font-bold text-sm text-gray-700">身份证有效期</span>
              {idCardOcrLoading && (
                <span className="text-xs text-blue-500 animate-pulse">正在识别中...</span>
              )}
            </div>

            <div className="bg-gradient-to-r from-rose-50/50 to-orange-50/30 rounded-xl p-4 border border-rose-100">
              <div className="flex items-center gap-4 mb-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={idCardValidity.is_permanent}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setIdCardValidity(prev => ({
                        ...prev,
                        is_permanent: checked,
                        valid_end: checked ? '9999-12-31' : null,
                      }));
                    }}
                    className="w-4 h-4 rounded border-gray-300 text-rose-500 focus:ring-rose-400"
                  />
                  <span className="text-sm text-gray-700">长期有效</span>
                </label>
                <span className="text-xs text-gray-400">上传身份证反面后自动识别，也可手动填写</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">有效起始日期</label>
                  <DatePicker
                    className="w-full"
                    placeholder="如：2020-01-15"
                    value={idCardValidity.valid_start ? dayjs(idCardValidity.valid_start) : null}
                    onChange={(date) => {
                      setIdCardValidity(prev => ({
                        ...prev,
                        valid_start: date ? date.format('YYYY-MM-DD') : null,
                      }));
                    }}
                  />
                </div>
                <span className="text-gray-300 mt-5">—</span>
                <div className="flex-1">
                  <label className="block text-xs text-gray-500 mb-1">有效截止日期</label>
                  <DatePicker
                    className="w-full"
                    placeholder={idCardValidity.is_permanent ? '长期有效' : '如：2040-01-15'}
                    value={idCardValidity.valid_end && !idCardValidity.is_permanent ? dayjs(idCardValidity.valid_end) : null}
                    disabled={idCardValidity.is_permanent}
                    onChange={(date) => {
                      setIdCardValidity(prev => ({
                        ...prev,
                        valid_end: date ? date.format('YYYY-MM-DD') : null,
                      }));
                    }}
                  />
                </div>
                {idCardValidity.valid_end && !idCardValidity.is_permanent && (() => {
                  const status = getIdCardExpiryStatus(idCardValidity.valid_end, false);
                  return (
                    <Tag color={status.color} className="!mt-5">
                      {status.label}{status.daysLeft !== null ? ` (${status.daysLeft > 0 ? status.daysLeft + '天' : '已超期' + Math.abs(status.daysLeft) + '天'})` : ''}
                    </Tag>
                  );
                })()}
                {idCardValidity.is_permanent && (
                  <Tag color="blue" className="!mt-5">长期有效</Tag>
                )}
              </div>
            </div>
          </div>
        </Form>
      </Drawer>

      {/* Excel 导入 Modal */}
      <Modal
        title={null}
        open={importModalVisible}
        onCancel={() => { if (!importing) setImportModalVisible(false); }}
        footer={null}
        width={importStep === 0 ? 640 : importStep === 1 ? 1100 : 520}
        destroyOnClose
        closable={!importing}
        maskClosable={!importing}
        styles={{ body: { padding: 0 } }}
      >
        {/* 顶部标题栏 */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-5 -mt-4 -mx-6 mb-0 rounded-t-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <FileExcelOutlined className="text-white text-xl" />
            </div>
            <div>
              <h3 className="text-white font-bold text-lg m-0">批量导入人员信息</h3>
              <p className="text-emerald-100 text-xs mt-0.5">
                {importStep === 0 && '上传 Excel 文件，快速录入大量人员数据'}
                {importStep === 1 && '确认数据无误后开始导入'}
                {importStep === 2 && (importing ? '正在导入中...' : '导入完成')}
              </p>
            </div>
          </div>
          {/* 步骤条 */}
          <div className="flex items-center gap-2 mt-4">
            {[
              { step: 0, label: '上传文件', icon: '1' },
              { step: 1, label: '数据预览', icon: '2' },
              { step: 2, label: '导入', icon: '3' },
            ].map((s, i) => (
              <div key={s.step} className="flex items-center gap-2">
                {i > 0 && <div className={`w-8 h-0.5 rounded ${importStep >= s.step ? 'bg-white' : 'bg-white/30'}`} />}
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                  importStep === s.step ? 'bg-white text-emerald-600' 
                  : importStep > s.step ? 'bg-white/30 text-white' 
                  : 'bg-white/10 text-white/60'
                }`}>
                  <span className="w-4 h-4 rounded-full bg-current/10 text-current flex items-center justify-center text-[10px] font-bold">{s.icon}</span>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-8 py-6">
          {/* Step 0: 上传文件 */}
          {importStep === 0 && (
            <div className="space-y-5">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-5 h-full flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center">
                      <DownloadOutlined className="text-emerald-600 text-2xl" />
                    </div>
                    <p className="text-gray-700 text-sm font-medium">下载导入模板</p>
                    <p className="text-gray-400 text-xs text-center leading-relaxed">包含所有字段和填写示例<br />按格式填写后上传即可</p>
                    <Button
                      icon={<DownloadOutlined />}
                      onClick={handleDownloadTemplate}
                      size="middle"
                      type="primary"
                      className="rounded-lg mt-1"
                      style={{ background: '#10b981', borderColor: '#10b981' }}
                    >
                      下载模板
                    </Button>
                  </div>
                </div>
                <div className="flex-1">
                  <Upload
                    accept=".xlsx,.xls,.csv"
                    showUploadList={false}
                    beforeUpload={(file) => {
                      handleImportFile(file);
                      return false;
                    }}
                  >
                    <div className="border-2 border-dashed border-gray-200 hover:border-emerald-400 hover:bg-emerald-50/30 rounded-xl p-5 h-full flex flex-col items-center justify-center gap-3 cursor-pointer transition-all group">
                      <div className="w-14 h-14 bg-gray-50 group-hover:bg-emerald-100 rounded-2xl flex items-center justify-center transition-colors">
                        <FileExcelOutlined className="text-gray-300 group-hover:text-emerald-500 text-2xl transition-colors" />
                      </div>
                      <p className="text-gray-600 text-sm font-medium">点击选择 Excel 文件</p>
                      <p className="text-gray-400 text-xs">支持 .xlsx / .xls / .csv</p>
                    </div>
                  </Upload>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <ExclamationCircleOutlined className="text-amber-500 text-base mt-0.5" />
                  <div className="flex-1">
                    <p className="text-gray-700 text-sm font-medium mb-2">填写说明</p>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-gray-500">
                      <div className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span><b className="text-gray-700">姓名</b>为必填，其他选填</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span>性别：男 / 女</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span>学历：博士/硕士/本科/大专/中专/高中/其他</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span>学位：博士/硕士/学士/无学位</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span>出生日期格式：YYYY-MM-DD</span>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="text-emerald-500 font-bold mt-0.5">•</span>
                        <span>与现有同名人员将标记跳过</span>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-emerald-700 font-medium mb-1.5">📌 同一人多条项目经历的处理方式：</p>
                      <p className="text-xs text-gray-500 leading-relaxed">在 Excel 中复制该人行，仅修改<b className="text-gray-700">职位名称</b>和<b className="text-gray-700">项目相关列</b>，基础信息保持一致即可自动合并为一个人的完整记录。</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 1: 数据预览与校验 */}
          {importStep === 1 && (
            <div className="space-y-4">
              {importErrors.length > 0 && (
                <Alert
                  type="warning"
                  showIcon
                  message={`发现 ${importErrors.length} 条提示`}
                  description={
                    <div className="max-h-28 overflow-y-auto text-xs space-y-0.5">
                      {importErrors.map((err, i) => <div key={i}>{err}</div>)}
                    </div>
                  }
                  className="!rounded-xl"
                />
              )}

              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <Tag color="green" className="!text-sm !px-3 !py-0.5 !rounded-lg">{importData.filter(r => !r._duplicate).length} 人可导入</Tag>
                  {importData.some(r => r._duplicate) && (
                    <Tag color="orange" className="!text-sm !px-3 !py-0.5 !rounded-lg">{importData.filter(r => r._duplicate).length} 人同名跳过</Tag>
                  )}
                  {importData.some(r => (r._projectCount || 0) > 0) && (
                    <Tag color="blue" className="!text-sm !px-3 !py-0.5 !rounded-lg">{importData.reduce((s, r) => s + (r._projectCount || 0), 0)} 个项目经历</Tag>
                  )}
                </div>
                <Button
                  size="small"
                  type="link"
                  onClick={() => { resetImportState(); }}
                >
                  重新选择文件
                </Button>
              </div>

              <Table
                dataSource={importData}
                rowKey="_rowIndex"
                size="middle"
                pagination={false}
                scroll={{ y: 380 }}
                rowClassName={(record) => record._duplicate ? 'bg-amber-50/60' : ''}
                expandable={{
                  rowExpandable: (r) => (r._jobPositionCount || 0) > 0,
                  expandedRowRender: (record) => {
                    const positions = record._jobPositions || [];
                    if (positions.length === 0) return null;
                    return (
                      <div className="space-y-2 py-3 px-2">
                        {positions.map((pos, pi) => (
                          <div key={pi} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100/50">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-1.5 h-4 bg-blue-500 rounded-full" />
                              <span className="text-sm font-semibold text-blue-700">{pos.position_name}</span>
                            </div>
                            {(pos.project_experiences || []).length > 0 ? (
                              <div className="space-y-1.5 ml-3.5">
                                {pos.project_experiences.map((pe, ji) => (
                                  <div key={ji} className="flex items-start gap-2 text-xs">
                                    <span className="text-emerald-500 mt-0.5">●</span>
                                    <div className="flex-1">
                                      <span className="text-gray-800 font-medium">{pe.project_name}</span>
                                      {pe.time_range && <span className="text-gray-400 ml-2">{pe.time_range[0]} ~ {pe.time_range[1]}</span>}
                                      {pe.role && <Tag color="blue" className="!text-xs !mx-1.5 !px-1.5 !py-0">{pe.role}</Tag>}
                                      {pe.description && <p className="text-gray-400 mt-0.5 leading-relaxed">{pe.description}</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 ml-3.5">暂无项目经历</p>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  },
                }}
                columns={[
                  {
                    title: '',
                    width: 40,
                    align: 'center',
                    render: (_, r) => r._duplicate
                      ? <Tooltip title="与现有人员同名，将跳过"><ExclamationCircleOutlined className="text-amber-500" /></Tooltip>
                      : <CheckCircleOutlined className="text-emerald-500" />,
                  },
                  { title: '姓名', dataIndex: 'name', width: 90, ellipsis: true, fixed: 'left',
                    render: (t) => <span className="font-semibold text-gray-800">{t}</span> },
                  { title: '性别', dataIndex: 'gender', width: 55, align: 'center',
                    render: (t) => t || <span className="text-gray-300">-</span> },
                  { title: '出生日期', dataIndex: 'birth_date', width: 100,
                    render: (t) => t || <span className="text-gray-300">-</span> },
                  { title: '年龄', width: 55, align: 'center',
                    render: (_, r) => { const a = calcAge(r.birth_date); return a !== null ? <span className="font-medium">{a}</span> : <span className="text-gray-300">-</span>; } },
                  { title: '学历', dataIndex: 'education', width: 65, align: 'center',
                    render: (t) => t ? <Tag className="!text-xs">{t}</Tag> : <span className="text-gray-300">-</span> },
                  { title: '学位', dataIndex: 'degree', width: 65, align: 'center',
                    render: (t) => t ? <Tag color="green" className="!text-xs">{t}</Tag> : <span className="text-gray-300">-</span> },
                  { title: '职称', dataIndex: 'title', width: 100, ellipsis: true,
                    render: (t) => t || <span className="text-gray-300">-</span> },
                  { title: '职务', dataIndex: 'job_title', width: 100, ellipsis: true,
                    render: (t) => t || <span className="text-gray-300">-</span> },
                  { title: '入职时间', dataIndex: 'work_start_date', width: 100,
                    render: (t) => t || <span className="text-gray-300">-</span> },
                  { title: '本公司年限', width: 85, align: 'center',
                    render: (_, r) => { const y = calcCompanyWorkYears(r.work_start_date); return y !== null ? <span className="text-emerald-600 font-medium">{y}年</span> : <span className="text-gray-300">-</span>; } },
                  { title: '毕业时间', dataIndex: 'graduation_date', width: 100,
                    render: (t) => t || <span className="text-gray-300">-</span> },
                  { title: '工作年限', width: 85, align: 'center',
                    render: (_, r) => { const y = calcTotalWorkYears(r.graduation_date); return y !== null ? <span className="text-blue-600 font-medium">{y}年</span> : <span className="text-gray-300">-</span>; } },
                  { title: '机构', dataIndex: 'organization', width: 130, ellipsis: true,
                    render: (t) => t || <span className="text-gray-300">-</span> },
                  { title: '项目职务', dataIndex: 'assigned_role', width: 100, ellipsis: true,
                    render: (t) => t ? <Tag color="blue" className="!text-xs">{t}</Tag> : <span className="text-gray-300">-</span> },
                  { title: '资质证书', dataIndex: 'certificate_summary', width: 140, ellipsis: true,
                    render: (t) => t || <span className="text-gray-300">-</span> },
                  {
                    title: '职位',
                    dataIndex: '_jobPositionCount',
                    width: 60,
                    align: 'center',
                    render: (v) => v ? <Tag color="geekblue" className="!text-xs">{v}</Tag> : <span className="text-gray-300">-</span>,
                  },
                  {
                    title: '项目',
                    dataIndex: '_projectCount',
                    width: 60,
                    align: 'center',
                    render: (v) => v ? <Tag color="green" className="!text-xs">{v}</Tag> : <span className="text-gray-300">-</span>,
                  },
                ]}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button onClick={() => { resetImportState(); setImportModalVisible(false); }} className="rounded-lg min-w-[80px]">取消</Button>
                <Button
                  type="primary"
                  icon={<FileExcelOutlined />}
                  loading={importing}
                  disabled={importData.filter(r => !r._duplicate).length === 0}
                  onClick={handleDoImport}
                  className="rounded-lg min-w-[140px]"
                  style={{ background: '#10b981', borderColor: '#10b981' }}
                >
                  确认导入 {importData.filter(r => !r._duplicate).length} 人
                </Button>
              </div>
            </div>
          )}

          {/* Step 2: 导入进度 */}
          {importStep === 2 && (
            <div className="py-12 flex flex-col items-center gap-5">
              {importing ? (
                <>
                  <Progress
                    type="circle"
                    percent={Math.round((importProgress.current / importProgress.total) * 100)}
                    size={140}
                    strokeColor={{ '0%': '#10b981', '100%': '#059669' }}
                    strokeWidth={8}
                  />
                  <div className="text-center">
                    <p className="text-gray-700 font-semibold text-base">正在导入人员数据...</p>
                    <p className="text-gray-400 text-sm mt-1">{importProgress.current} / {importProgress.total} 人</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center">
                    <CheckCircleOutlined className="text-4xl text-emerald-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-800 font-bold text-xl">导入完成</p>
                    <p className="text-gray-500 text-sm mt-1">
                      成功导入 <b className="text-emerald-600">{importProgress.current}</b> 人
                      {importErrors.length > 0 && <span>，<b className="text-amber-500">{importErrors.length}</b> 条提示</span>}
                    </p>
                  </div>
                  <div className="flex gap-3 mt-4">
                    {importErrors.length > 0 && (
                      <Button onClick={() => setImportStep(1)} className="rounded-lg min-w-[80px]">查看详情</Button>
                    )}
                    <Button
                      type="primary"
                      onClick={() => {
                        setImportModalVisible(false);
                        resetImportState();
                        fetchPersonnel();
                      }}
                      className="rounded-lg min-w-[120px]"
                      style={{ background: '#10b981', borderColor: '#10b981' }}
                    >
                      完成
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
