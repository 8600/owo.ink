// # 启动
// This file needs serious love & refactoring

/**
 *
 * 调用顺序如下：
 * - root index requires core module
 * - core index requires server
 */

// 依赖模块
const express = require('express'),
      _ = require('lodash'),
      uuid = require('node-uuid'),
      Promise = require('bluebird'),
      i18n = require('./i18n'),
      api = require('./api'),
      config = require('./config'),
      errors = require('./errors'),
      middleware = require('./middleware'),
      migrations = require('./data/migration'),
      versioning = require('./data/schema/versioning'),
      models = require('./models'),
      permissions = require('./permissions'),
      apps = require('./apps'),
      xmlrpc = require('./data/xml/xmlrpc'),
      slack = require('./data/slack'),
      BlogServer = require('./blogServer'),
      scheduling = require('./scheduling'),
      validateThemes = require('./utils/validate-themes')
let   dbHash;

//注册数据库
function initDbHashAndFirstRun() {
    return api.settings.read({key: 'dbHash', context: {internal: true}}).then(function (response) {
        //数据库Hash信息
        dbHash = response.settings[0].value;
        if (dbHash === null) {
            let initHash = uuid.v4();
            console.log(initHash);
            return api.settings.edit({settings: [{key: 'dbHash', value: initHash}]}, {context: {internal: true}})
                .then(function (response) {
                    dbHash = response.settings[0].value;
                    return dbHash;
                    // Use `then` here to do 'first run' actions
                });
        }

        return dbHash;
    });
}

// ## 初始化博客服务器
// 返回一个服务器实例
function init(options) {
    options = options || {};

    let blogServer = null, settingsMigrations, currentDatabaseVersion;

    // ### 初始化
    // 国际化初始
    i18n.init();

    // 从本地文件系统加载配置文件config.js。
    return config.load(options.config).then(function () {
        return config.checkDeprecated();
    }).then(function () {
        models.init();
    }).then(function () {
        return versioning.getDatabaseVersion()
            .then(function () {
                return models.Settings.populateDefaults();
            })
            .catch(function (err) {
                if (err instanceof errors.DatabaseNotPopulated) {
                    return migrations.populate();
                }

                return Promise.reject(err);
            });
    }).then(function () {
        /**
         * 确保数据库版本正确
         */
        return versioning.getDatabaseVersion()
            .then(function (_currentDatabaseVersion) {
                currentDatabaseVersion = _currentDatabaseVersion;
            });
    }).then(function () {
        if (currentDatabaseVersion !== '008') {
            return;
        }

        if (config.database.client !== 'sqlite3') {
            return;
        }

        return models.Settings.findOne({key: 'migrations'}, options)
            .then(function fetchedMigrationsSettings(result) {
                try {
                    settingsMigrations = JSON.parse(result.attributes.value) || {};
                } catch (err) {
                    return;
                }

                if (settingsMigrations.hasOwnProperty('006/01')) {
                    return;
                }

                // 强迫重新运行008
                currentDatabaseVersion = '007';
                return versioning.setDatabaseVersion(null, '007');
            });
    }).then(function () {
        let response = migrations.update.isDatabaseOutOfDate({
            fromVersion: currentDatabaseVersion,
            toVersion: versioning.getNewestDatabaseVersion(),
            forceMigration: process.env.FORCE_MIGRATION
        }), maintenanceState;

        if (response.migrate === true) {
            maintenanceState = config.maintenance.enabled || false;
            config.maintenance.enabled = true;

            migrations.update.execute({
                fromVersion: currentDatabaseVersion,
                toVersion: versioning.getNewestDatabaseVersion(),
                forceMigration: process.env.FORCE_MIGRATION
            }).then(function () {
                config.maintenance.enabled = maintenanceState;
            }).catch(function (err) {
                if (!err) {
                    return;
                }

                errors.logErrorAndExit(err, err.context, err.help);
            });
        } else if (response.error) {
            return Promise.reject(response.error);
        }
    }).then(function () {
        // 初始化设置缓存
        return api.init();
    }).then(function () {
        // 初始化权限操作和对象
        // 注意：必须在initDbHashAndFirstRun调用之前完成
        return permissions.init();
    }).then(function () {
        return Promise.join(
            // 检查并初始化dbHash。
            initDbHashAndFirstRun(),
            // 初始化应用程序
            apps.init(),
            xmlrpc.listen(),
            slack.listen()
        );
    }).then(function () {
        const parentApp = express();

        // ## 中间件和路由
        middleware(parentApp);

        // 记录所有主题错误和警告
        validateThemes(config.paths.themePath)
            .catch(function (result) {
                // TODO: change `result` to something better
                result.errors.forEach(function (err) {
                    errors.logError(err.message, err.context, err.help);
                });

                result.warnings.forEach(function (warn) {
                    errors.logWarn(warn.message, warn.context, warn.help);
                });
            });

        return new BlogServer(parentApp);
    }).then(function (_blogServer) {
        blogServer = _blogServer;

        // scheduling can trigger api requests, that's why we initialize the module after the server creation
        // scheduling module can create x schedulers with different adapters
        return scheduling.init(_.extend(config.scheduling, {apiUrl: config.apiUrl()}));
    }).then(function () {
        return blogServer;
    });
}

module.exports = init;
