// # 启动博客

const owo = require('./core'),
      express = require('express'),
      errors = require('./core/server/errors'),
      parentApp = express();

// 确保依赖模块正确安装并且文件系统权限正确。
require('./core/server/utils/startup-check').check();

owo().then(function (server) {
    // Mount our Ghost instance on our desired subdirectory path if it exists.
    parentApp.use(server.config.paths.subdir, server.rootApp);

    // 启动服务器实例
    server.start(parentApp);
}).catch(function (err) {
    errors.logErrorAndExit(err, err.context, err.help);
});
