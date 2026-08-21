#!/bin/bash
# ======================
# 火山引擎 veFaaS Web 应用函数启动脚本
# ======================
# veFaaS 运行时会注入环境变量 _FAAS_RUNTIME_PORT，
# server.js 会自动监听 0.0.0.0:$_FAAS_RUNTIME_PORT。
# 必须用 exec，让 node 成为 1 号进程，正确接收平台的停止信号。

exec node server.js
