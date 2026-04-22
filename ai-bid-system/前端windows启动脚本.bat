@echo off
chcp 65001 >nul
title AI投标系统 - 前端服务

echo ========================================
echo   AI投标系统 - 前端启动
echo ========================================
echo.

REM 切换到脚本所在目录
cd /d "%~dp0"

REM 检查 frontend 目录是否存在
if not exist "frontend" (
    echo [错误] 未找到 frontend 目录，请确认在项目根目录运行此脚本！
    pause
    exit /b 1
)

REM 检查 Node.js 是否安装
echo [1/3] 检查 Node.js ...
node --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 18+
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo       Node.js 版本: %%i

REM 检查依赖是否已安装
echo.
echo [2/3] 检查依赖 ...
if not exist "frontend\node_modules" (
    echo       首次运行，正在安装依赖，请稍候...
    cd frontend
    call npm install
    if errorlevel 1 (
        echo [错误] 依赖安装失败，请检查网络连接！
        pause
        exit /b 1
    )
    cd ..
    echo       依赖安装完成！
) else (
    echo       依赖已安装，跳过安装步骤。
)

REM 检查环境变量配置
echo.
echo [3/3] 检查环境变量 ...
if not exist "frontend\.env.local" (
    echo [警告] 未找到 frontend\.env.local 文件！
    echo         请先复制 .env.example 为 .env.local 并填写配置。
    echo.
    echo 需要配置的变量：
    echo   VITE_SUPABASE_URL       - Supabase 项目地址
    echo   VITE_SUPABASE_ANON_KEY  - Supabase 匿名密钥
    echo   VITE_DIFY_API_KEY       - Dify API 密钥
    echo.
    pause
    exit /b 1
)
echo       环境变量配置文件已找到。

echo.
echo ========================================
echo   正在启动前端开发服务器...
echo ========================================
echo.
echo   访问地址: http://localhost:5173
echo   按 Ctrl+C 停止服务
echo.

cd frontend
call npm run dev

pause