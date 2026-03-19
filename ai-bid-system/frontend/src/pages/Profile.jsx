import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Card, Button, Form, Input, message, Typography, Avatar, Space } from 'antd';
import { User, Mail, Building, Save } from 'lucide-react';

const { Title, Text } = Typography;

const Profile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      
      setProfile(data);
      form.setFieldsValue({
        username: data.username || '',
        company_name: data.company_name || '',
      });
    } catch (error) {
      console.error('获取用户资料失败:', error);
    }
  };

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: values.username,
          company_name: values.company_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;
      
      message.success('资料更新成功！');
      fetchProfile();
    } catch (error) {
      message.error('更新失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Title level={2}>个人资料</Title>
        <Text type="secondary">管理您的个人信息和账户设置</Text>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card className="text-center">
            <div className="mb-4">
              <Avatar
                size={120}
                className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white text-4xl mx-auto"
              >
                {user.user_metadata?.full_name?.charAt(0) || user.email?.charAt(0) || 'U'}
              </Avatar>
            </div>
            <Title level={4} className="mb-1">
              {user.user_metadata?.full_name || user.email?.split('@')[0]}
            </Title>
            <Text type="secondary" className="block mb-4">
              {user.email}
            </Text>
            <div className="space-y-2 text-left">
              <div className="flex items-center text-gray-600">
                <Mail className="w-4 h-4 mr-2" />
                <span className="text-sm">{user.email}</span>
              </div>
              {profile?.company_name && (
                <div className="flex items-center text-gray-600">
                  <Building className="w-4 h-4 mr-2" />
                  <span className="text-sm">{profile.company_name}</span>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card>
            <Form
              form={form}
              name="profile"
              layout="vertical"
              onFinish={onFinish}
              autoComplete="off"
            >
              <Form.Item
                label="用户名"
                name="username"
                rules={[{ required: true, message: '请输入用户名' }]}
              >
                <Input
                  prefix={<User className="w-4 h-4 text-gray-400" />}
                  placeholder="请输入用户名"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                label="公司名称"
                name="company_name"
              >
                <Input
                  prefix={<Building className="w-4 h-4 text-gray-400" />}
                  placeholder="请输入公司名称（可选）"
                  size="large"
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    loading={loading}
                    icon={<Save className="w-4 h-4" />}
                    size="large"
                  >
                    保存更改
                  </Button>
                  <Button
                    onClick={() => form.resetFields()}
                    size="large"
                  >
                    重置
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>

          <Card className="mt-6">
            <Title level={4} className="mb-4">账户信息</Title>
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <div>
                  <Text strong>用户ID</Text>
                  <div className="text-sm text-gray-500 mt-1">{user.id}</div>
                </div>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <div>
                  <Text strong>注册时间</Text>
                  <div className="text-sm text-gray-500 mt-1">
                    {new Date(user.created_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center py-3">
                <div>
                  <Text strong>最后登录</Text>
                  <div className="text-sm text-gray-500 mt-1">
                    {new Date(user.last_sign_in_at).toLocaleString('zh-CN')}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;