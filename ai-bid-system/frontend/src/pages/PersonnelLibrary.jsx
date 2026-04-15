import { useState, useEffect } from 'react';
import { Button, Table, message, Modal, Drawer, Form, Input, Select, DatePicker, Upload, Divider, Tag, Popconfirm, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined, UserOutlined, ProjectOutlined, PaperClipOutlined, MinusCircleOutlined } from '@ant-design/icons';
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

const ATTACHMENT_TYPE_MAP = {
  id_card: { label: '身份证', accept: 'image/*' },
  degree_certificate: { label: '学位证书', accept: 'image/*,.pdf' },
  qualification_certificate: { label: '资质证书', accept: 'image/*,.pdf' },
};

export default function PersonnelLibrary() {
  const { user } = useAuth();
  const [personnel, setPersonnel] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const [attachmentUrls, setAttachmentUrls] = useState({
    id_card: [],
    degree_certificate: [],
    qualification_certificate: [],
  });

  useEffect(() => {
    if (user) fetchPersonnel();
  }, [user]);

  const fetchPersonnel = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('personnel_profiles')
        .select('*, company_profiles:company_profile_id(company_name)')
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
    setAttachmentUrls({ id_card: [], degree_certificate: [], qualification_certificate: [] });
    setDrawerVisible(true);
  };

  const handleEdit = async (record) => {
    setEditingRecord(record);
    const customFields = record.custom_fields || {};
    const projectExperiences = customFields.project_experiences || [];

    form.setFieldsValue({
      name: record.name,
      gender: record.gender,
      education: record.education,
      title: record.title || record.job_title,
      phone: record.phone,
      id_number: record.id_number,
      school: record.school,
      major: record.major,
      project_experiences: projectExperiences.map(pe => ({
        project_name: pe.project_name || '',
        time_range: pe.time_range ? [dayjs(pe.time_range[0]), dayjs(pe.time_range[1])] : undefined,
        role: pe.role || '',
        description: pe.description || '',
      })),
    });

    try {
      const { data: attachments, error } = await supabase
        .from('personnel_attachments')
        .select('*')
        .eq('personnel_profile_id', record.id)
        .eq('enabled', true);
      if (error) throw error;

      const urls = { id_card: [], degree_certificate: [], qualification_certificate: [] };
      (attachments || []).forEach(att => {
        if (urls[att.attachment_type]) {
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
      setAttachmentUrls({ id_card: [], degree_certificate: [], qualification_certificate: [] });
    }

    setDrawerVisible(true);
  };

  const handleDelete = async (record) => {
    try {
      const { data: attachments } = await supabase
        .from('personnel_attachments')
        .select('file_url')
        .eq('personnel_profile_id', record.id);

      if (attachments && attachments.length > 0) {
        const paths = attachments.map(a => {
          const url = new URL(a.file_url);
          return decodeURIComponent(url.pathname.split('/personnel-attachments/')[1] || '');
        }).filter(Boolean);
        if (paths.length > 0) {
          await supabase.storage.from('personnel-attachments').remove(paths);
        }
      }

      const { error } = await supabase
        .from('personnel_profiles')
        .delete()
        .eq('id', record.id);
      if (error) throw error;
      message.success('删除成功');
      fetchPersonnel();
    } catch (err) {
      message.error('删除失败: ' + err.message);
    }
  };

  const uploadFile = async (file, attachmentType) => {
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
        title: values.title || null,
        job_title: values.title || null,
        phone: values.phone || null,
        id_number: values.id_number || null,
        school: values.school || null,
        major: values.major || null,
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
            const uploaded = await uploadFile(f.originFileObj, attachType);
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

  const columns = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (text) => <span className="font-medium">{text}</span>,
    },
    { title: '性别', dataIndex: 'gender', key: 'gender', width: 60 },
    { title: '学历', dataIndex: 'education', key: 'education', width: 80 },
    { title: '职称', dataIndex: 'title', key: 'title', width: 120, ellipsis: true },
    { title: '电话', dataIndex: 'phone', key: 'phone', width: 130 },
    {
      title: '项目经历',
      key: 'projects',
      width: 120,
      render: (_, record) => {
        const exps = record.custom_fields?.project_experiences || [];
        if (exps.length === 0) return <span className="text-gray-400">无</span>;
        return <Tag color="blue">{exps.length} 个项目</Tag>;
      },
    },
    {
      title: '附件',
      key: 'attachments',
      width: 100,
      render: (_, record) => {
        const attachTags = [];
        if (record.attachments && Array.isArray(record.attachments)) {
          const types = new Set(record.attachments.map(a => a.attachment_type || a.type));
          types.forEach(t => {
            const info = ATTACHMENT_TYPE_MAP[t];
            if (info) attachTags.push(info.label);
          });
        }
        if (attachTags.length === 0) return <span className="text-gray-400">无</span>;
        return attachTags.map(t => <Tag key={t}>{t}</Tag>);
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确定删除该人员？" onConfirm={() => handleDelete(record)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const makeUploadProps = (attachType) => ({
    listType: 'picture-card',
    fileList: attachmentUrls[attachType],
    accept: ATTACHMENT_TYPE_MAP[attachType].accept,
    maxCount: 4,
    beforeUpload: () => false,
    onChange: ({ fileList }) => {
      setAttachmentUrls(prev => ({ ...prev, [attachType]: fileList }));
    },
    onRemove: (file) => handleRemoveAttachment(file, attachType),
    customRequest: async ({ file, onSuccess, onError }) => {
      try {
        const result = await uploadFile(file, attachType);
        setAttachmentUrls(prev => ({
          ...prev,
          [attachType]: prev[attachType].map(f =>
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

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <span className="text-gray-500 text-sm">共 {personnel.length} 条记录</span>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增人员
        </Button>
      </div>

      <Table
        dataSource={personnel}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
        size="middle"
      />

      <Drawer
        title={editingRecord ? '编辑人员' : '新增人员'}
        open={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        width={680}
        extra={
          <Space>
            <Button onClick={() => setDrawerVisible(false)}>取消</Button>
            <Button type="primary" loading={saving} onClick={handleSave}>保存</Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" orientationMargin={0}>
            <UserOutlined className="mr-1" /> 基础信息
          </Divider>

          <div className="grid grid-cols-2 gap-x-4">
            <Form.Item label="姓名" name="name" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input placeholder="请输入姓名" />
            </Form.Item>
            <Form.Item label="性别" name="gender">
              <Select placeholder="请选择" allowClear options={GENDER_OPTIONS} />
            </Form.Item>
            <Form.Item label="学历" name="education">
              <Select placeholder="请选择" allowClear options={EDUCATION_OPTIONS} />
            </Form.Item>
            <Form.Item label="职称" name="title">
              <Input placeholder="如：高级工程师" />
            </Form.Item>
            <Form.Item label="电话" name="phone">
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
          </div>

          <Divider orientation="left" orientationMargin={0}>
            <ProjectOutlined className="mr-1" /> 项目经历
          </Divider>

          <Form.List name="project_experiences">
            {(fields, { add, remove }) => (
              <>
                {fields.map(({ key, name, ...restField }) => (
                  <div key={key} className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200 relative">
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
                      className="absolute top-2 right-2"
                    />
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                  添加项目经历
                </Button>
              </>
            )}
          </Form.List>

          <Divider orientation="left" orientationMargin={0}>
            <PaperClipOutlined className="mr-1" /> 证件附件
          </Divider>

          {Object.entries(ATTACHMENT_TYPE_MAP).map(([type, info]) => (
            <div key={type} className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">{info.label}</div>
              <Upload {...makeUploadProps(type)}>
                {attachmentUrls[type].length >= 4 ? null : (
                  <div>
                    <UploadOutlined />
                    <div className="text-xs mt-1">上传{info.label}</div>
                  </div>
                )}
              </Upload>
            </div>
          ))}
        </Form>
      </Drawer>
    </div>
  );
}
