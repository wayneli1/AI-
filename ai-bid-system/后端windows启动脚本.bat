@echo off
chcp 65001 >nul
title AI投标系统 - 后端服务

echo ========================================
echo   AI投标系统 - 后端启动
echo ========================================
echo.

REM 切换到脚本所在目录
cd /d "%~dp0"

REM 检查 backend 目录是否存在
if not exist "backend" (
    echo [错误] 未找到 backend 目录，请确认在项目根目录运行此脚本！
    pause
    exit /b 1
)

REM 检查 Python 是否安装
echo [1/3] 检查 Python ...
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.8+
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do echo       Python 版本: %%i

REM 检查/安装依赖
echo.
echo [2/3] 检查依赖 ...
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo       首次运行，正在安装 Python 依赖，请稍候...
    cd backend
    pip install -r requirements.txt
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
if not exist "backend\.env" (
    echo [警告] 未找到 backend\.env 文件！
    echo         请先创建 .env 文件并填写配置。
    echo.
    echo 需要配置的变量：
    echo   DIFY_BASE_URL                  - Dify API 基础地址
    echo   DIFY_FIELD_MAPPING_API_KEY     - 字段映射 API Key
    echo   ENABLE_INTELLIGENT_MAPPING     - 是否启用智能映射 (true/false)
    echo.
    pause
    exit /b 1
)
echo       环境变量配置文件已找到。

echo.
echo ========================================
echo   正在启动后端服务...
echo ========================================
echo.
echo   API 地址:  http://localhost:8000
echo   API 文档:  http://localhost:8000/docs
echo   按 Ctrl+C 停止服务
echo.

cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause