@echo off
chcp 65001 >nul
echo ========================================
echo     服务手册合并工具 - 一键运行版
echo ========================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到Python，请先安装Python 3.8或更高版本
    echo 下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 检查必需依赖
echo 检查Python依赖库...
python -c "import docx, requests, lxml" 2>nul
if errorlevel 1 (
    echo 安装必需依赖库...
    pip install python-docx requests lxml --quiet
    if errorlevel 1 (
        echo [错误] 依赖库安装失败
        pause
        exit /b 1
    )
    echo 依赖库安装完成
)

echo.
echo 请将需要合并的文件拖放到此窗口，然后按回车键
echo 或者直接输入文件路径
echo.

set /p filepath="请输入文件路径: "

REM 移除路径两端的引号（如果存在）
set filepath=%filepath:"=%

if "%filepath%"=="" (
    echo [错误] 未输入文件路径
    pause
    exit /b 1
)

if not exist "%filepath%" (
    echo [错误] 文件不存在: %filepath%
    pause
    exit /b 1
)

REM 检查文件扩展名
if not "%filepath:~-5%"==".docx" (
    echo [错误] 文件必须是.docx格式
    pause
    exit /b 1
)

echo.
echo 开始处理文件: %filepath%
echo.

REM 运行合并脚本
python merge_manuals_final.py "%filepath%"

if errorlevel 1 (
    echo.
    echo [错误] 合并过程失败
    echo 请检查:
    echo 1. 是否同时导出了mapping.json文件
    echo 2. 网络连接是否正常
    echo 3. 服务手册文件是否可访问
    pause
    exit /b 1
)

echo.
echo ========================================
echo     合并完成！
echo ========================================
echo.
echo 输出文件: 最终_%filepath%
echo.
echo 按任意键退出...
pause >nul