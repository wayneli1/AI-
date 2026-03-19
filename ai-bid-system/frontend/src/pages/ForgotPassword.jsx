import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button, Form, Input, Card, message, Typography } from 'antd';
import { Mail, ArrowLeft, KeyRound } from 'lucide-react';

const { Title, Text } = Typography;

const ForgotPassword = () => {
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();
  const { resetPassword } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const { error } = await resetPassword(values.email);
      
      if (error) {
        message.error(error.message);
      } else {
        setEmailSent(true);
        message.success('重置密码邮件已发送，请检查您的邮箱');
      }
    } catch (error) {
      message.error('发送重置邮件失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl rounded-2xl border-0">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-orange-500 to-amber-600 rounded-full flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
          </div>
          <Title level={2} className="mb-2">重置密码</Title>
          <Text type="secondary">
            {emailSent 
              ? '重置密码链接已发送到您的邮箱' 
              : '请输入您的邮箱地址，我们将发送重置密码链接'}
          </Text>
        </div>

        {emailSent ? (
          <div className="text-center">
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-700">
                重置密码链接已发送到您的邮箱，请按照邮件中的指示重置密码。
              </p>
            </div>
            <Button
              type="primary"
              onClick={() => navigate('/login')}
              size="large"
              block
              className="h-12 text-base font-medium mb-4"
            >
              返回登录
            </Button>
          </div>
        ) : (
          <Form
            name="forgotPassword"
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
                placeholder="请输入注册时使用的邮箱"
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
                className="h-12 text-base font-medium mb-4"
              >
                发送重置链接
              </Button>
            </Form.Item>
          </Form>
        )}

        <div className="text-center mt-6">
          <Link to="/login" className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center">
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回登录
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default ForgotPassword;