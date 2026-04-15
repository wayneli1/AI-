#!/bin/bash
echo "========================================"
echo "  启动后端解析服务"
echo "========================================"

cd "$(dirname "$0")"

echo ""
echo "[1/3] 检查 Python 是否安装..."
if ! command -v python3 &> /dev/null; then
    echo "[错误] 未找到 Python，请先安装 Python 3.9+"
    read -p "按 Enter 退出..."
    exit 1
fi

echo ""
echo "[2/3] 检查/安装依赖..."
pip3 show python-docx >/dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "正在安装依赖..."
    pip3 install -r backend/requirements.txt
fi

echo ""
echo "[3/3] 启动 FastAPI 服务..."
echo "服务地址: http://localhost:8000"
echo "API文档: http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

cd backend
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
