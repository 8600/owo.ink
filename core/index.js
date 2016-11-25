// ## 启动服务
// 通过设置返回一个服务器实例
"use strict";
const server = require('./server');

// 设置默认模式为开发模式
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
function makeGhost(options) {
    options = options || {};
    return server(options);
}

module.exports = makeGhost;
