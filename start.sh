#!/bin/bash
set -e

# 检查环境变量
echo "Checking environment..."
echo "PORT: ${PORT:-2300}"

# 安装 Node.js 依赖
echo "Installing Node.js dependencies..."
npm install

# 构建 Tailwind CSS
echo "Building Tailwind CSS..."
npm run build:css

# 安装 Python 依赖
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

# 启动应用
echo "Starting application..."
exec gunicorn --bind "0.0.0.0:${PORT:-2300}" app:app
