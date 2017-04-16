"use strict";
// # Ghost Server
// Handles the creation of an HTTP Server for Ghost
const debug = require('debug')('ghost:server'),
      Promise = require('bluebird'),
      chalk = require('chalk'),
      fs = require('fs'),
      path = require('path'),
      errors = require('./errors'),
      events = require('./events'),
      config = require('./config'),
      utils = require('./utils'),
      i18n   = require('./i18n'),
      moment = require('moment');

/**
 * ## 博客服务
 * @constructor
 * @param {Object} rootApp - parent express instance
 */
function GhostServer(rootApp) {
    this.rootApp = rootApp;
    this.httpServer = null;
    this.connections = {};
    this.connectionId = 0;
    // 导入配置项.
    this.config = config;
}

/**
 * ## 公共API方法
 *
 * ### 启动
 * 启动博客服务并监听配置端口,或者一个express实例
 * @param  {Object} externalApp - 可选的express实例.
 * @return {Promise} Resolves once Ghost has started
 */
GhostServer.prototype.start = function (externalApp) {
    debug('正在启动...');
    const self = this,
          rootApp = externalApp ? externalApp : self.rootApp
    let   socketConfig, socketValues = {
              path: path.join(config.get('paths').contentPath, config.get('env') + '.socket'),
              permissions: '660'
          };

    return new Promise(function (resolve, reject) {
        if (config.get('server').hasOwnProperty('socket')) {
            socketConfig = config.get('server').socket;
            switch(typeof socketConfig){
                case 'string':
                    socketValues.path = socketConfig;
                    break;
                case 'object':
                    socketValues.path = socketConfig.path || socketValues.path;
                    socketValues.permissions = socketConfig.permissions || socketValues.permissions;
                    break;
                default:
                    console.error("socketConfig格式错误!")
            }
            // 创建前保证这个文件不存在
            fs.unlinkSync(socketValues.path);

            self.httpServer = rootApp.listen(socketValues.path);
            fs.chmod(socketValues.path, socketValues.permissions);
            config.set('server:socket', socketValues);
        } else {
            self.httpServer = rootApp.listen(
                config.get('server').port,
                config.get('server').host
            );
        }

        self.httpServer.on('error', function (error) {
            var ghostError;

            if (error.errno === 'EADDRINUSE') {
                ghostError = new errors.GhostError({
                    message: i18n.t('errors.httpServer.addressInUse.error'),
                    context: i18n.t('errors.httpServer.addressInUse.context', {port: config.get('server').port}),
                    help: i18n.t('errors.httpServer.addressInUse.help')
                });
            } else {
                ghostError = new errors.GhostError({
                    message: i18n.t('errors.httpServer.otherError.error', {errorNumber: error.errno}),
                    context: i18n.t('errors.httpServer.otherError.context'),
                    help: i18n.t('errors.httpServer.otherError.help')
                });
            }

            reject(ghostError);
        });
        self.httpServer.on('connection', self.connection.bind(self));
        self.httpServer.on('listening', function () {
            debug('...Started');
            events.emit('server:start');
            self.logStartMessages();
            resolve(self);
        });
    });
};

/**
 * ### Stop
 * Returns a promise that will be fulfilled when the server stops. If the server has not been started,
 * the promise will be fulfilled immediately
 * @returns {Promise} Resolves once Ghost has stopped
 */
GhostServer.prototype.stop = function () {
    var self = this;

    return new Promise(function (resolve) {
        if (self.httpServer === null) {
            resolve(self);
        } else {
            self.httpServer.close(function () {
                events.emit('server:stop');
                self.httpServer = null;
                self.logShutdownMessages();
                resolve(self);
            });

            self.closeConnections();
        }
    });
};

/**
 * ### Restart
 * Restarts the ghost application
 * @returns {Promise} Resolves once Ghost has restarted
 */
GhostServer.prototype.restart = function () {
    return this.stop().then(function (ghostServer) {
        return ghostServer.start();
    });
};

/**
 * ### Hammertime
 * To be called after `stop`
 */
GhostServer.prototype.hammertime = function () {
    console.log(chalk.green(i18n.t('notices.httpServer.cantTouchThis')));

    return Promise.resolve(this);
};

/**
 * ## Private (internal) methods
 *
 * ### 连接
 * @param {Object} socket
 */
GhostServer.prototype.connection = function (socket) {
    const self = this;
    self.connectionId += 1;
    socket._ghostId = self.connectionId;

    socket.on('close', function () {
        delete self.connections[this._ghostId];
    });

    self.connections[socket._ghostId] = socket;
};

/**
 * ### 关闭连接
 * 大多数浏览器会保持和服务器的持续连接，所以我们要手动关闭连接
 */
GhostServer.prototype.closeConnections = function () {
    const self = this;
    Object.keys(self.connections).forEach(function (socketId) {
        const socket = self.connections[socketId];
        if (socket) {
            socket.destroy();
        }
    });
};

/**
 * ### 消息/日志
 */
GhostServer.prototype.logStartMessages = function () {
    // 博客系统欢迎提示
    console.log(
        chalk.blue('----------欢迎使用owo博客系统!----------')
    );
    console.log(
        chalk.green(i18n.t('notices.httpServer.ghostIsRunningIn', {env: config.get('env')})),
        i18n.t('notices.httpServer.listeningOn'),
        config.get('server').socket || config.get('server').host + ':' + config.get('server').port,
        i18n.t('notices.httpServer.urlConfiguredAs', {url: utils.url.urlFor('home', true)}),
        chalk.gray(i18n.t('notices.httpServer.ctrlCToShutDown'))
    );

    function shutdown() {
        console.log(chalk.red(i18n.t('notices.httpServer.ghostHasShutdown')));
        //如果是生产环境 提示博客已离线 否则 提示博客运行时长
        if (config.get('env') === 'production') {
            console.log(
                i18n.t('notices.httpServer.yourBlogIsNowOffline')
            );
        } else {
            console.log(
                i18n.t('notices.httpServer.ghostWasRunningFor'),
                moment.duration(process.uptime(), 'seconds').humanize()
            );
        }
        process.exit(0);
    }
    // 确保用户下达终止命令后博客正常退出
    process.
        removeAllListeners('SIGINT').on('SIGINT', shutdown).
        removeAllListeners('SIGTERM').on('SIGTERM', shutdown);
};

/**
 * ### Log Shutdown Messages
 */
GhostServer.prototype.logShutdownMessages = function () {
    console.log(chalk.red(i18n.t('notices.httpServer.ghostIsClosingConnections')));
};

module.exports = GhostServer;
