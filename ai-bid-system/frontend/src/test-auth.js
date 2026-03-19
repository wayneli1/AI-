// 认证功能测试脚本
// 在浏览器控制台中运行以下代码测试Supabase连接

async function testSupabaseConnection() {
  console.log('🔗 测试Supabase连接...');
  
  try {
    const { supabase } = await import('./lib/supabase.js');
    
    // 测试获取当前会话
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ 获取会话失败:', sessionError.message);
      return false;
    }
    
    console.log('✅ Supabase连接成功');
    console.log('📊 当前会话:', session.session ? '已登录' : '未登录');
    
    if (session.session?.user) {
      console.log('👤 当前用户:', session.session.user.email);
      console.log('🆔 用户ID:', session.session.user.id);
    }
    
    return true;
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return false;
  }
}

// 测试注册功能
async function testSignUp(email, password) {
  console.log(`📝 测试注册: ${email}`);
  
  try {
    const { supabase } = await import('./lib/supabase.js');
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: '测试用户',
        },
      },
    });
    
    if (error) {
      console.error('❌ 注册失败:', error.message);
      return { success: false, error };
    }
    
    console.log('✅ 注册成功');
    console.log('📧 用户:', data.user?.email);
    console.log('📋 需要验证邮箱:', data.user?.email_confirmed_at ? '否' : '是');
    
    return { success: true, data };
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return { success: false, error };
  }
}

// 测试登录功能
async function testSignIn(email, password) {
  console.log(`🔐 测试登录: ${email}`);
  
  try {
    const { supabase } = await import('./lib/supabase.js');
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('❌ 登录失败:', error.message);
      return { success: false, error };
    }
    
    console.log('✅ 登录成功');
    console.log('👤 用户:', data.user.email);
    console.log('🔑 访问令牌:', data.session?.access_token?.substring(0, 20) + '...');
    
    return { success: true, data };
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return { success: false, error };
  }
}

// 测试获取用户资料
async function testGetProfile(userId) {
  console.log(`📋 测试获取用户资料: ${userId}`);
  
  try {
    const { supabase } = await import('./lib/supabase.js');
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('❌ 获取资料失败:', error.message);
      return { success: false, error };
    }
    
    console.log('✅ 获取资料成功');
    console.log('👤 用户资料:', data);
    
    return { success: true, data };
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return { success: false, error };
  }
}

// 运行完整测试
async function runFullTest() {
  console.log('🚀 开始完整认证测试\n');
  
  // 1. 测试连接
  const connectionOk = await testSupabaseConnection();
  if (!connectionOk) {
    console.log('\n❌ 连接测试失败，停止测试');
    return;
  }
  
  console.log('\n---\n');
  
  // 2. 测试注册（使用随机邮箱避免冲突）
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'password123';
  
  const signUpResult = await testSignUp(testEmail, testPassword);
  
  console.log('\n---\n');
  
  // 3. 测试登录
  if (signUpResult.success) {
    const signInResult = await testSignIn(testEmail, testPassword);
    
    console.log('\n---\n');
    
    // 4. 测试获取资料
    if (signInResult.success && signInResult.data?.user?.id) {
      await testGetProfile(signInResult.data.user.id);
    }
  }
  
  console.log('\n🎉 测试完成');
}

// 导出测试函数供控制台使用
window.testAuth = {
  testSupabaseConnection,
  testSignUp,
  testSignIn,
  testGetProfile,
  runFullTest,
};

console.log('🔧 认证测试工具已加载');
console.log('使用方法:');
console.log('1. testAuth.testSupabaseConnection() - 测试连接');
console.log('2. testAuth.testSignUp("email@example.com", "password") - 测试注册');
console.log('3. testAuth.testSignIn("email@example.com", "password") - 测试登录');
console.log('4. testAuth.runFullTest() - 运行完整测试');