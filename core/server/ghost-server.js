// # Ghost Server
// 创建一个HTTP服务器
"use strict";
const promise = require('bluebird'),
      chalk = require('chalk'),
      fs = require('fs'),
      errors = require('./errors'),
      config = require('./config'),
      i18n   = require('./i18n'),
      time = require('./helpers/time');
/**
 * ## 博客服务器
 * @constructor
 * @param {Object} rootApp - parent express instance
 */
function GhostServer(rootApp) {
    this.rootApp = rootApp;
    this.httpServer = null;
    this.connections = {};
    this.connectionId = 0;

    // Expose config module for use externally.
    this.config = config;
}

/**
 * ## Public API methods
 *
 * ### 开始点
 * 开始监听配置的端口.
 * @param  {Object} externalApp - 可选的应用表达实例
 * @return {promise} 博客已经运行过
 */
GhostServer.prototype.start = function (externalApp) {
    const self = this,rootApp = externalApp ? externalApp : self.rootApp;
    return new promise(function (resolve) {
        const socketConfig = config.getSocket();
        if (socketConfig) {
            // 确保可以找到socketConfig文件
            try {
                fs.unlinkSync(socketConfig.path);
            } catch (e) {
                // We can ignore this.
            }

            self.httpServer = rootApp.listen(socketConfig.path);

            fs.chmod(socketConfig.path, socketConfig.permissions);
        } else {
            self.httpServer = rootApp.listen(
                config.server.port,
                config.server.host
            );
        }
        //HTTP监听发生错误事件
        self.httpServer.on('error', function (error) {
            if (error.errno === 'EADDRINUSE') {
                errors.logError(
                    i18n.t('errors.httpServer.addressInUse.error'),
                    i18n.t('errors.httpServer.addressInUse.context', {port: config.server.port}),
                    i18n.t('errors.httpServer.addressInUse.help')
                );
            } else {
                errors.logError(
                    i18n.t('errors.httpServer.otherError.error', {errorNumber: error.errno}),
                    i18n.t('errors.httpServer.otherError.context'),
                    i18n.t('errors.httpServer.otherError.help')
                );
            }
            process.exit(-1);
        });
        self.httpServer.on('connection', self.connection.bind(self));
        self.httpServer.on('listening', function () {
            self.logStartMessages();
            resolve(self);
        });
    });
};

/**
 * ### 结束
 * Returns a promise that will be fulfilled when the server stops. If the server has not been started,
 * the promise will be fulfilled immediately
 * @returns {promise} Resolves once Ghost has stopped
 */
GhostServer.prototype.stop = function () {
    const self = this;

    return new promise(function (resolve) {
        if (self.httpServer === null) {
            resolve(self);
        } else {
            self.httpServer.close(function () {
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
 * @returns {promise} Resolves once Ghost has restarted
 */
GhostServer.prototype.restart = function () {
    return this.stop().then(this.start.bind(this));
};

/**
 * ### Hammertime
 * To be called after `stop`
 */
GhostServer.prototype.hammertime = function () {
    console.log(chalk.green(i18n.t('notices.httpServer.cantTouchThis')));

    return promise.resolve(this);
};

/**
 * ## Private (internal) methods
 *
 * ### Connection
 * @param {Object} socket
 */
GhostServer.prototype.connection = function (socket) {
    var self = this;

    self.connectionId += 1;
    socket._ghostId = self.connectionId;

    socket.on('close', function () {
        delete self.connections[this._ghostId];
    });

    self.connections[socket._ghostId] = socket;
};

/**
 * ### Close Connections
 * Most browsers keep a persistent connection open to the server, which prevents the close callback of
 * httpServer from returning. We need to destroy all connections manually.
 */
GhostServer.prototype.closeConnections = function () {
    var self = this;

    Object.keys(self.connections).forEach(function (socketId) {
        var socket = self.connections[socketId];

        if (socket) {
            socket.destroy();
        }
    });
};

/**
 * ### 打印启动系统日志
 */
GhostServer.prototype.logStartMessages = function () {
    // 启动 & 关闭 日志
    if (process.env.NODE_ENV === 'production') {
        console.log(
            chalk.green(i18n.t('notices.httpServer.ghostIsRunningIn', {env: process.env.NODE_ENV})),
            i18n.t('notices.httpServer.yourBlogIsAvailableOn', {url: config.url}),
            chalk.gray(i18n.t('notices.httpServer.ctrlCToShutDown'))
        );
    } else {
        console.log(
            chalk.green(i18n.t('notices.httpServer.ghostIsRunningIn', {env: process.env.NODE_ENV})),
            i18n.t('notices.httpServer.listeningOn'),
            config.getSocket() || config.server.host + ':' + config.server.port,
            i18n.t('notices.httpServer.urlConfiguredAs', {url: config.url}),
            chalk.gray(i18n.t('notices.httpServer.ctrlCToShutDown'))
        );
    }

    function shutdown() {
        console.log(chalk.red(i18n.t('notices.httpServer.ghostHasShutdown')));
        if (process.env.NODE_ENV === 'production') {
            console.log(
                i18n.t('notices.httpServer.yourBlogIsNowOffline')
            );
        } else {
            console.log(process.uptime());
            console.log(
                i18n.t('notices.httpServer.ghostWasRunningFor'),
                time.secondToTime(process.uptime())
            );
        }
        process.exit(0);
    }
    // ensure that Ghost exits correctly on Ctrl+C and SIGTERM
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
