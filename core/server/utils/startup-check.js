const packages = require('../../../package.json'),
      path = require('path'),
      crypto = require('crypto'),
      fs = require('fs'),
      mode = process.env.NODE_ENV === undefined ? 'development' : process.env.NODE_ENV,
      appRoot = path.resolve(__dirname, '../../../');
let   exitCodes = {
        NODE_VERSION_UNSUPPORTED: 231,
        NODE_ENV_CONFIG_MISSING: 232,
        DEPENDENCIES_MISSING: 233,
        CONTENT_PATH_NOT_ACCESSIBLE: 234,
        CONTENT_PATH_NOT_WRITABLE: 235,
        SQLITE_DB_NOT_WRITABLE: 236,
        BUILT_FILES_DO_NOT_EXIST: 237
      },
      configFilePath = process.env.GHOST_CONFIG || path.join(appRoot, 'config.js');

const checks = {
    check: function check() {
        this.nodeVersion();
        this.nodeEnv();
        this.contentPath();
        this.mail();
        this.sqlite();
        this.builtFilesExist();
    },

    // 确保node版本正确
    nodeVersion: function checkNodeVersion() {
        // 如果使用了不支持的node版本，退出程序
        const semver = require('semver');
        if (process.env.GHOST_NODE_VERSION_CHECK !== 'false' &&
            !semver.satisfies(process.versions.node, packages.engines.node)) {
            console.error('\x1B[31m错误: 不支持的node版本');
            console.error('\x1B[31m博客建议Node版本:' + packages.engines.node +
                          '\n本机安装Node版本:' + process.versions.node + '\033[0m\n');
            process.exit(exitCodes.NODE_VERSION_UNSUPPORTED);
        }
        console.log("√ Node版本符合要求");
    },

    nodeEnv: function checkNodeEnvState() {
        // 检查配置文件是否存在
        let fd,configFile,config;
        try {
            fd = fs.openSync(configFilePath, 'r');
            fs.closeSync(fd);
        } catch (e) {
            //如果不存在将config.example作为配置文件
            configFilePath = path.join(appRoot, 'config.example.js');
        }
        configFile = require(configFilePath);
        config = configFile[mode];
        if (!config) {
            console.error('\x1B[31m错误: 找不到配置项NODE_ENV: ' +process.env.NODE_ENV + '\033[0m\n');
            console.error('\x1B[32m请确认你的config.js配置了NODE_ENV' +' 并且格式正确.\033[0m');
            process.exit(exitCodes.NODE_ENV_CONFIG_MISSING);
        }
        console.log("√ 配置文件没有错误");
    },

    // 检查content文件夹权限
    contentPath: function checkContentPaths() {
        if (mode !== 'production' && mode !== 'development') {
            return;
        }
        let configFile,
            config,
            contentPath,
            contentSubPaths = ['apps', 'data', 'images', 'themes'],
            fd,
            errorHeader = '\x1B[31m× access目录权限异常:\033[0m';

        // 获取content文件夹路径.  如果config.js中有定义，则使用config.js中的路径
        try {
            configFile = require(configFilePath);
            config = configFile[mode];
            if (config && config.paths && config.paths.contentPath) {
                contentPath = config.paths.contentPath;
            } else {
                contentPath = path.join(appRoot, 'content');
            }
        } catch (e) {
            // 如果config.js没有定义, 使用默认路径
            contentPath = path.join(appRoot, 'content');
        }

        try {
            fd = fs.openSync(contentPath, 'r');
            fs.closeSync(fd);
        } catch (e) {
            console.error(errorHeader);
            console.error('  ' + e.message);

            process.exit(exitCodes.CONTENT_PATH_NOT_ACCESSIBLE);
        }

        // 遍历检查content子目录
        try {
            contentSubPaths.forEach(function (sub) {
                const dir = path.join(contentPath, sub);
                if(!fs.existsSync(dir)){
                    console.log(`! ${dir}目录不存在`);
                    console.log(`√ ${dir}目录已创建`);
                    fs.mkdirSync(dir);
                }
                const    randomFile = path.join(dir, crypto.randomBytes(8).toString('hex'));
                fd = fs.openSync(dir, 'r');
                fs.closeSync(fd);

                // 检查写权限，写一个随机文件
                fd = fs.openSync(randomFile, 'wx+');
                fs.closeSync(fd);
                fs.unlinkSync(randomFile);
            });
        } catch (e) {
            console.error(errorHeader);
            console.error('  ' + e.message);
            process.exit(exitCodes.CONTENT_PATH_NOT_WRITABLE);
        }
        console.log("√ content目录权限正常");
    },

    // 确保sqlite3数据库可以读写
    sqlite: function checkSqlite() {
        if (mode !== 'production' && mode !== 'development') {
            return;
        }

        let configFile,
            config,
            appRoot = path.resolve(__dirname, '../../../'),
            dbPath,
            fd;

        try {
            configFile = require(configFilePath);
            config = configFile[mode];

            // 检查数据库文件是否为sqlite3
            if (config && config.database && config.database.client !== 'sqlite3') {
                return;
            }

            if (config && config.database && config.database.connection) {
                dbPath = config.database.connection.filename;
            }
        } catch (e) {
            //如果config.js没有配置, 使用默认目录
            dbPath = path.join(appRoot, 'content', 'data', mode === 'production' ? 'ghost.db' : 'ghost-dev.db');
        }

        // 检查数据库读／写权限
        try {
            fd = fs.openSync(dbPath, 'r+');
            fs.closeSync(fd);
        } catch (e) {
            // 数据库文件如果不存在，sqlite3会创建一个
            if (e.code === 'ENOENT') {
                console.log("! 数据库文件不存在");
                console.log("√ 数据库文件以创建");
                return;
            }

            console.error('\x1B[31m错误: 无法正常读写数据库\033[0m');
            console.error('  ' + e.message);
            process.exit(exitCodes.SQLITE_DB_NOT_WRITABLE);
        }
        console.log("√ 数据库文件正常");
    },

    mail: function checkMail() {
        var configFile,
            config;

        try {
            configFile = require(configFilePath);
            config = configFile[mode];
        } catch (e) {
            configFilePath = path.join(appRoot, 'config.example.js');
        }

        if (!config.mail || !config.mail.transport) {
            console.log("! 邮件系统未配置");
            console.error('\x1B[32m你可以查阅帮助文档 http://support.ghost.org/mail.\033[0m\n');
        }
        console.log("√ 邮件系统已配置");
    },

    builtFilesExist: function builtFilesExist() {
        var configFile,
            config,
            location,
            fileNames = ['ghost.js', 'vendor.js', 'ghost.css', 'vendor.css'];

        try {
            configFile = require(configFilePath);
            config = configFile[mode];

            if (config.paths && config.paths.clientAssets) {
                location = config.paths.clientAssets;
            } else {
                location = path.join(appRoot, '/core/built/assets/');
            }
        } catch (e) {
            location = path.join(appRoot, '/core/built/assets/');
        }

        if (process.env.NODE_ENV === 'production') {
            // Production uses `.min` files
            fileNames = fileNames.map(function (file) {
                return file.replace('.', '.min.');
            });
        }

        function checkExist(fileName) {
            try {
                fs.statSync(fileName);
            } catch (e) {
                console.error('\x1B[31mERROR: Javascript files have not been built.\033[0m');
                console.error('\n\x1B[32mPlease read the getting started instructions at:');
                console.error('https://github.com/TryGhost/Ghost#getting-started\033[0m');
                process.exit(exitCodes.BUILT_FILES_DO_NOT_EXIST);
            }
        }

        fileNames.forEach(function (fileName) {
            checkExist(location + fileName);
        });
    }
};

module.exports = checks;
