const postScheduling = require(__dirname + '/post-scheduling');

/**
 * 定时发送模块:
 * 在指定时刻发布文章
 */
exports.init = function init(options) {
    options = options || {};
    return postScheduling.init(options);
};
