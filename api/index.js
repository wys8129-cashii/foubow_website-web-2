// Vercel Serverless 入口：自动识别 api/ 目录下的文件为 Serverless 函数
const app = require('../server.js');
module.exports = app;