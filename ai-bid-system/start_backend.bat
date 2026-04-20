@echo off
echo ========================================
echo   启动后端解析服务
echo ========================================

cd /d "%~dp0"

echo.
echo [1/3] 检查 Python 是否安装...
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未找到 Python，请先安装 Python 3.9+
    pause
    exit /b 1
)

echo.
echo [2/3] 检查/安装依赖...
pip show python-docx >nul 2>&1
if errorlevel 1 (
    echo 正在安装依赖...
    pip install -r backend/requirements.txt
)

echo.
echo [3/3] 启动 FastAPI 服务...
echo 服务地址: http://localhost:8000
echo API文档: http://localhost:8000/docs
echo.
echo 按 Ctrl+C 停止服务
echo.

cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

pause
