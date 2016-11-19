// # Content Helper
// 使用方法: `{{content}}`
// 返回页面内容

let hbs = require('express-hbs'),content;
content = function (options) {
    return new hbs.handlebars.SafeString(this.html);
};
module.exports = content;
