import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Card, Button, Form, Input, Select, DatePicker, Drawer, message,
  Popconfirm, Empty, Spin, Collapse, Space, Tag
} from 'antd';
import { PlusCircle, Building2, Edit3, Trash2, Phone, Mail, MapPin, User, FileText, Briefcase, Hash, Calendar, Clock, CreditCard, Shield, Settings } from 'lucide-react';
import dayjs from 'dayjs';

const FIELD_LABELS = {
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
  id_photo_front_url: '身份证正面照片URL',
  id_photo_back_url: '身份证反面照片URL',
};

const CompanyProfile = () => {
  const { user } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (user) fetchCompanies();
  }, [user]);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error('加载企业列表失败:', err);
      message.error('加载企业列表失败');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingRecord(null);
    form.resetFields();
    form.setFieldsValue({ custom_fields: [] });
    setDrawerOpen(true);
  };

  const openEdit = (record) => {
    setEditingRecord(record);
    const customFields = record.custom_fields && Object.keys(record.custom_fields).length > 0
      ? Object.entries(record.custom_fields).map(([fieldName, fieldValue]) => ({ fieldName, fieldValue: String(fieldValue) }))
      : [];
    form.setFieldsValue({
      ...record,
      establish_date: record.establish_date ? dayjs(record.establish_date) : null,
      birth_date: record.birth_date ? dayjs(record.birth_date) : null,
      custom_fields: customFields,
    });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const customFieldsArr = values.custom_fields || [];
      const customFieldsObj = {};
      for (const item of customFieldsArr) {
        if (item.fieldName && item.fieldName.trim()) {
          customFieldsObj[item.fieldName.trim()] = item.fieldValue || '';
        }
      }

      const payload = {
        user_id: user.id,
        company_name: values.company_name,
        uscc: values.uscc || null,
        registered_capital: values.registered_capital || null,
        company_type: values.company_type || null,
        establish_date: values.establish_date ? values.establish_date.format('YYYY-MM-DD') : null,
        operating_period: values.operating_period || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        zip_code: values.zip_code || null,
        registration_authority: values.registration_authority || null,
        business_scope: values.business_scope || null,
        legal_rep_name: values.legal_rep_name || null,
        id_number: values.id_number || null,
        gender: values.gender || null,
        birth_date: values.birth_date ? values.birth_date.format('YYYY-MM-DD') : null,
        id_expiry: values.id_expiry || null,
        position: values.position || null,
        id_photo_front_url: values.id_photo_front_url || null,
        id_photo_back_url: values.id_photo_back_url || null,
        custom_fields: customFieldsObj,
      };

      if (editingRecord) {
        const { error } = await supabase
          .from('company_profiles')
          .update(payload)
          .eq('id', editingRecord.id);
        if (error) throw error;
        message.success('企业信息已更新');
      } else {
        const { error } = await supabase
          .from('company_profiles')
          .insert(payload);
        if (error) throw error;
        message.success('企业添加成功');
      }

      setDrawerOpen(false);
      fetchCompanies();
    } catch (err) {
      if (err.errorFields) return;
      console.error('保存失败:', err);
      message.error('保存失败: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('company_profiles')
        .delete()
        .eq('id', id);
      if (error) throw error;
      message.success('已删除');
      fetchCompanies();
    } catch (err) {
      console.error('删除失败:', err);
      message.error('删除失败');
    }
  };

  const genderOptions = [
    { value: '男', label: '男' },
    { value: '女', label: '女' },
  ];

  const companyTypeOptions = [
    { value: '有限责任公司', label: '有限责任公司' },
    { value: '股份有限公司', label: '股份有限公司' },
    { value: '国有企业', label: '国有企业' },
    { value: '外商投资企业', label: '外商投资企业' },
    { value: '个人独资企业', label: '个人独资企业' },
    { value: '合伙企业', label: '合伙企业' },
    { value: '个体工商户', label: '个体工商户' },
    { value: '其他', label: '其他' },
  ];

  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">公司信息库</h2>
          <p className="text-sm text-gray-500 mt-1">管理多个投标公司主体，AI 填报时自动注入完整企业档案</p>
        </div>
        <Button
          type="primary"
          icon={<PlusCircle size={16} />}
          onClick={openCreate}
          className="rounded-lg h-10 font-medium"
        >
          添加投标主体
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Spin size="large" /></div>
      ) : companies.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 py-20 flex flex-col items-center">
          <Building2 size={48} className="text-gray-300 mb-4" />
          <p className="text-gray-400 mb-4">暂无投标主体，请点击上方按钮添加</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {companies.map((c) => (
            <Card
              key={c.id}
              className="rounded-2xl border border-gray-100 hover:shadow-lg hover:border-indigo-200 transition-all duration-200"
              styles={{ body: { padding: '20px 24px' } }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-base leading-tight">{c.company_name}</h3>
                    {c.company_type && (
                      <Tag color="blue" className="mt-1 text-xs">{c.company_type}</Tag>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    type="text"
                    size="small"
                    icon={<Edit3 size={14} />}
                    onClick={() => openEdit(c)}
                    className="text-gray-400 hover:text-indigo-600"
                  />
                  <Popconfirm
                    title="确认删除该投标主体？"
                    description="删除后无法恢复"
                    onConfirm={() => handleDelete(c.id)}
                    okText="确认"
                    cancelText="取消"
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<Trash2 size={14} />}
                      className="text-gray-400 hover:text-red-500"
                    />
                  </Popconfirm>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {c.uscc && (
                  <div className="flex items-center text-gray-500">
                    <Hash size={13} className="mr-2 shrink-0 text-gray-400" />
                    <span className="truncate">信用代码：{c.uscc}</span>
                  </div>
                )}
                {c.legal_rep_name && (
                  <div className="flex items-center text-gray-500">
                    <User size={13} className="mr-2 shrink-0 text-gray-400" />
                    <span>法定代表人：{c.legal_rep_name}{c.position ? `（${c.position}）` : ''}</span>
                  </div>
                )}
                {c.registered_capital && (
                  <div className="flex items-center text-gray-500">
                    <CreditCard size={13} className="mr-2 shrink-0 text-gray-400" />
                    <span>注册资金：{c.registered_capital}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center text-gray-500">
                    <Phone size={13} className="mr-2 shrink-0 text-gray-400" />
                    <span>{c.phone}</span>
                  </div>
                )}
                {c.address && (
                  <div className="flex items-center text-gray-500">
                    <MapPin size={13} className="mr-2 shrink-0 text-gray-400" />
                    <span className="truncate">{c.address}</span>
                  </div>
                )}
              </div>

              {c.custom_fields && Object.keys(c.custom_fields).length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(c.custom_fields).slice(0, 3).map(([k, v]) => (
                      <Tag key={k} className="text-xs bg-gray-50 border-gray-200">{k}: {String(v)}</Tag>
                    ))}
                    {Object.keys(c.custom_fields).length > 3 && (
                      <Tag className="text-xs bg-gray-50 border-gray-200">+{Object.keys(c.custom_fields).length - 3}项</Tag>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Drawer
        title={editingRecord ? '编辑投标主体' : '添加投标主体'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
        extra={
          <Space>
            <Button onClick={() => setDrawerOpen(false)}>取消</Button>
            <Button type="primary" onClick={handleSave} loading={saving}>
              {editingRecord ? '保存修改' : '确认添加'}
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          autoComplete="off"
        >
          <Collapse
            defaultActiveKey={['basic', 'legal', 'custom']}
            ghost
            items={[
              {
                key: 'basic',
                label: <span className="font-bold text-gray-700"><Building2 size={15} className="inline mr-2 text-indigo-500" />基础信息</span>,
                children: (
                  <div className="grid grid-cols-2 gap-x-4">
                    <Form.Item
                      label="公司名称"
                      name="company_name"
                      rules={[{ required: true, message: '请输入公司名称' }]}
                    >
                      <Input placeholder="公司全称" />
                    </Form.Item>
                    <Form.Item label="统一社会信用代码" name="uscc">
                      <Input placeholder="18位信用代码" />
                    </Form.Item>
                    <Form.Item label="注册资金" name="registered_capital">
                      <Input placeholder="如：1000万元人民币" />
                    </Form.Item>
                    <Form.Item label="公司性质" name="company_type">
                      <Select placeholder="请选择" allowClear options={companyTypeOptions} />
                    </Form.Item>
                    <Form.Item label="成立日期" name="establish_date">
                      <DatePicker className="w-full" placeholder="选择日期" />
                    </Form.Item>
                    <Form.Item label="经营期限" name="operating_period">
                      <Input placeholder="如：2020-01-01 至 2050-01-01" />
                    </Form.Item>
                    <Form.Item label="联系电话" name="phone">
                      <Input placeholder="公司电话" />
                    </Form.Item>
                    <Form.Item label="公司邮箱" name="email">
                      <Input placeholder="company@example.com" />
                    </Form.Item>
                    <Form.Item label="公司地址" name="address" className="col-span-2">
                      <Input placeholder="注册地址" />
                    </Form.Item>
                    <Form.Item label="邮政编码" name="zip_code">
                      <Input placeholder="邮编" />
                    </Form.Item>
                    <Form.Item label="登记机关" name="registration_authority">
                      <Input placeholder="如：深圳市市场监督管理局" />
                    </Form.Item>
                    <Form.Item label="经营范围" name="business_scope" className="col-span-2">
                      <Input.TextArea rows={3} placeholder="营业执照上的经营范围" />
                    </Form.Item>
                  </div>
                ),
              },
              {
                key: 'legal',
                label: <span className="font-bold text-gray-700"><User size={15} className="inline mr-2 text-indigo-500" />法人信息</span>,
                children: (
                  <div className="grid grid-cols-2 gap-x-4">
                    <Form.Item label="法定代表人" name="legal_rep_name">
                      <Input placeholder="姓名" />
                    </Form.Item>
                    <Form.Item label="身份证号" name="id_number">
                      <Input placeholder="18位身份证号" />
                    </Form.Item>
                    <Form.Item label="性别" name="gender">
                      <Select placeholder="请选择" allowClear options={genderOptions} />
                    </Form.Item>
                    <Form.Item label="出生日期" name="birth_date">
                      <DatePicker className="w-full" placeholder="选择日期" />
                    </Form.Item>
                    <Form.Item label="身份证有效期" name="id_expiry">
                      <Input placeholder="如：2025-01-01 至 2045-01-01" />
                    </Form.Item>
                    <Form.Item label="职位" name="position">
                      <Input placeholder="如：执行董事" />
                    </Form.Item>
                    <Form.Item label="身份证正面照片URL（人像面）" name="id_photo_front_url">
                      <Input placeholder="身份证正面照片的存储地址（选填）" />
                    </Form.Item>
                    <Form.Item label="身份证反面照片URL（国徽面）" name="id_photo_back_url">
                      <Input placeholder="身份证反面照片的存储地址（选填）" />
                    </Form.Item>
                  </div>
                ),
              },
              {
                key: 'custom',
                label: <span className="font-bold text-gray-700"><Settings size={15} className="inline mr-2 text-indigo-500" />自定义扩展信息</span>,
                children: (
                  <>
                    <p className="text-xs text-gray-400 mb-3">可添加任意自定义字段，保存后将以键值对形式存储。</p>
                    <Form.List name="custom_fields">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map(({ key, name, ...restField }) => (
                            <div key={key} className="flex items-start gap-2 mb-2">
                              <Form.Item {...restField} name={[name, 'fieldName']} className="flex-1 mb-0">
                                <Input placeholder="字段名" />
                              </Form.Item>
                              <Form.Item {...restField} name={[name, 'fieldValue']} className="flex-[2] mb-0">
                                <Input placeholder="字段值" />
                              </Form.Item>
                              <Button
                                type="text"
                                danger
                                icon={<Trash2 size={14} />}
                                onClick={() => remove(name)}
                                className="mt-1"
                              />
                            </div>
                          ))}
                          <Button
                            type="dashed"
                            onClick={() => add()}
                            block
                            icon={<PlusCircle size={14} />}
                            className="mt-1"
                          >
                            添加自定义字段
                          </Button>
                        </>
                      )}
                    </Form.List>
                  </>
                ),
              },
            ]}
          />
        </Form>
      </Drawer>
    </div>
  );
};

export default CompanyProfile;
