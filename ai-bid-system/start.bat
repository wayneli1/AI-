@echo off
echo 🚀 启动AI标书系统...

REM 检查是否在项目根目录
if not exist "supabase" (
    echo ❌ 错误：请在项目根目录运行此脚本
    pause
    exit /b 1
)

if not exist "frontend" (
    echo ❌ 错误：请在项目根目录运行此脚本
    pause
    exit /b 1
)

echo 🔧 启动Supabase服务...
supabase start

REM 等待Supabase完全启动
echo ⏳ 等待Supabase服务就绪...
timeout /t 5 /nobreak >nul

echo 🌐 启动前端开发服务器...
cd frontend
start "前端开发服务器" cmd /c "npm run dev"

echo.
echo ✅ 启动完成！
echo.
echo 📊 服务地址：
echo   前端应用: http://localhost:5174
echo   Supabase Studio: http://127.0.0.1:54323
echo   邮件测试: http://127.0.0.1:54324
echo.
echo 📝 使用说明：
echo   1. 访问 http://localhost:5174/register 注册新用户
echo   2. 检查 http://127.0.0.1:54324 查看验证邮件
echo   3. 登录后开始使用AI标书系统
echo.
echo 🛑 按任意键停止脚本（服务将继续运行）...
pause >nul