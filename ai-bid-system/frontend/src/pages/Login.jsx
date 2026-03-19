import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Form, Input, Card, message, Typography } from 'antd';
import { Mail, Lock, LogIn } from 'lucide-react';

const { Title, Text } = Typography;

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const { error } = await signIn(values.email, values.password);
      
      if (error) {
        message.error(error.message);
      } else {
        message.success('登录成功！');
        navigate('/');
      }
    } catch (error) {
      message.error('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl rounded-2xl border-0">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>
          <Title level={2} className="mb-2">欢迎回来</Title>
          <Text type="secondary">登录您的账户继续使用AI标书系统</Text>
        </div>

        <Form
          name="login"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
        >
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
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<Lock className="w-4 h-4 text-gray-400" />}
              placeholder="请输入密码"
              size="large"
            />
          </Form.Item>

          <div className="mb-6 text-right">
            <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800">
              忘记密码？
            </Link>
          </div>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
              className="h-12 text-base font-medium"
            >
              登录
            </Button>
          </Form.Item>

          <div className="text-center mt-6">
            <Text type="secondary">还没有账户？</Text>
            <Link to="/register" className="ml-2 text-blue-600 hover:text-blue-800 font-medium">
              立即注册
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;