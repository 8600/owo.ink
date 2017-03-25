/**
 * 检查URL是否合法
 * 合法的URL地址开头应该是 http://, https://, 或 /.
 */
let url = function (url) {
    url = url.toString().replace(/['"]+/g, '');
    if (/^https?:\/\//.test(url) || /^\//.test(url)) {
        return url;
    }
};

/**
 * 检查ID是否合法
 * 目前所有ID都是合法的
 */
let id = function (id) {
    return id;
};

export default {
    url,
    id
};
