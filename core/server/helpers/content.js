// # 内容插件
// 使用方法: `{{content}}`
// 返回页面内容

const hbs = require('express-hbs');
const content = function (options) {
    return new hbs.handlebars.SafeString(this.html);
};
module.exports = content;
 