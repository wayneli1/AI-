import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Form, Input, Card, message, Typography } from 'antd';
import { Mail, Lock, User, UserPlus } from 'lucide-react';

const { Title, Text } = Typography;

const Register = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const userData = {
        full_name: values.fullName,
      };

      const { error } = await signUp(values.email, values.password, userData);
      
      if (error) {
        message.error(error.message);
      } else {
        message.success('注册成功！请检查您的邮箱以验证账户');
        navigate('/login');
      }
    } catch (error) {
      message.error('注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl rounded-2xl border-0">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
          </div>
          <Title level={2} className="mb-2">创建账户</Title>
          <Text type="secondary">注册新账户开始使用AI标书系统</Text>
        </div>

        <Form
          name="register"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            label="姓名"
            name="fullName"
            rules={[{ required: true, message: '请输入您的姓名' }]}
          >
            <Input
              prefix={<User className="w-4 h-4 text-gray-400" />}
              placeholder="请输入您的姓名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="邮箱"
            name="email"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input
              prefix={<Mail className="w-4 h-4 text-gray-400" />}
              placeholder="请输入邮箱地址"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' },
            ]}
          >
            <Input.Password
              prefix={<Lock className="w-4 h-4 text-gray-400" />}
              placeholder="请输入密码（至少6位）"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="确认密码"
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<Lock className="w-4 h-4 text-gray-400" />}
              placeholder="请再次输入密码"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
              className="h-12 text-base font-medium"
            >
              注册
            </Button>
          </Form.Item>

          <div className="text-center mt-6">
            <Text type="secondary">已有账户？</Text>
            <Link to="/login" className="ml-2 text-blue-600 hover:text-blue-800 font-medium">
              立即登录
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Register;