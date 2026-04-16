import { useState, useEffect } from 'react';
import { Button, Table, message, Drawer, Form, Input, Select, DatePicker, Upload, Divider, Tag, Popconfirm, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, UserOutlined, ProjectOutlined, PaperClipOutlined, MinusCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import dayjs from 'dayjs';

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

  const handleAdd = () => {
    setEditingRecord(null);
    form.resetFields();
    setAttachmentUrls(emptyAttachments());
    setDrawerVisible(true);
  };

  const handleEdit = async (record) => {
    setEditingRecord(record);
    const cf = record.custom_fields || {};
    const pe = cf.project_experiences || [];

    form.setFieldsValue({
      name: record.name,
      gender: record.gender,
      education: record.education,
      title: record.title || record.job_title,
      job_title: record.job_title || record.title,
      phone: record.phone,
      id_number: record.id_number,
      school: record.school,
      major: record.major,
      degree: record.degree,
      birth_date: record.birth_date ? dayjs(record.birth_date) : null,
      organization: record.organization,
      department: record.department,
      assigned_role: record.assigned_role,
      project_experiences: pe.map(p => ({
        project_name: p.project_name || '',
        time_range: p.time_range ? [dayjs(p.time_range[0]), dayjs(p.time_range[1])] : undefined,
        role: p.role || '',
        description: p.description || '',
      })),
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

      const projectExperiences = (values.project_experiences || []).map(pe => ({
        project_name: pe.project_name || '',
        time_range: pe.time_range
          ? [pe.time_range[0].format('YYYY-MM-DD'), pe.time_range[1].format('YYYY-MM-DD')]
          : null,
        role: pe.role || '',
        description: pe.description || '',
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
        organization: values.organization || null,
        department: values.department || null,
        assigned_role: values.assigned_role || null,
        custom_fields: { project_experiences: projectExperiences },
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

  const makeUploadProps = (section) => ({
    listType: 'picture-card',
    fileList: attachmentUrls[section.key],
    accept: section.accept,
    maxCount: section.maxCount,
    beforeUpload: () => false,
    onChange: ({ fileList }) => {
      setAttachmentUrls(prev => ({ ...prev, [section.key]: fileList }));
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
        const n = (r.custom_fields?.project_experiences || []).length;
        if (n === 0) return <span className="text-gray-300 text-xs">无</span>;
        return <Tag color="blue">{n} 个</Tag>;
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
          scroll={{ x: 880 }}
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
              <Form.Item label="出生日期" name="birth_date">
                <DatePicker className="w-full" placeholder="选择日期" />
              </Form.Item>
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
              <Form.Item label="毕业院校" name="school">
                <Input placeholder="毕业院校" />
              </Form.Item>
              <Form.Item label="专业" name="major">
                <Input placeholder="所学专业" />
              </Form.Item>
              <Form.Item label="现所在机构" name="organization">
                <Input placeholder="现所在机构名称" />
              </Form.Item>
              <Form.Item label="现所在部门" name="department">
                <Input placeholder="部门/科室" />
              </Form.Item>
              <Form.Item label="拟在本项目担任职务" name="assigned_role">
                <Input placeholder="如：项目经理、技术负责人" />
              </Form.Item>
            </div>
          </div>

          {/* 区块 B：项目经历 */}
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-4 mt-2">
              <div className="w-1 h-4 bg-emerald-500 rounded-full" />
              <span className="font-bold text-sm text-gray-700">项目经历</span>
            </div>

            <Form.List name="project_experiences">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <div key={key} className="mb-3 p-3 bg-gray-50/80 rounded-lg border border-gray-100 relative group hover:border-indigo-200 transition-colors">
                      <div className="grid grid-cols-2 gap-x-4">
                        <Form.Item {...restField} name={[name, 'project_name']} label="项目名称" className="mb-2">
                          <Input placeholder="项目名称" />
                        </Form.Item>
                        <Form.Item {...restField} name={[name, 'role']} label="担任角色" className="mb-2">
                          <Input placeholder="如：项目经理" />
                        </Form.Item>
                      </div>
                      <Form.Item {...restField} name={[name, 'time_range']} label="起止时间" className="mb-2">
                        <RangePicker className="w-full" />
                      </Form.Item>
                      <Form.Item {...restField} name={[name, 'description']} label="工作内容" className="mb-0">
                        <TextArea rows={2} placeholder="描述工作内容" />
                      </Form.Item>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<MinusCircleOutlined />}
                        onClick={() => remove(name)}
                        className="!absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </div>
                  ))}
                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />} className="rounded-lg">
                    添加项目经历
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
        </Form>
      </Drawer>
    </div>
  );
}
