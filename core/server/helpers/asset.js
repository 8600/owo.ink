// # Asset helper
// Usage: `{{asset "css/screen.css"}}`, `{{asset "css/screen.css" ghost="true"}}`
// 返回资源存储的路径
"use strict";
const getAssetUrl = require('../data/meta/asset_url'),hbs = require('express-hbs');

function asset(path, options) {
    let [isAdmin,minify]=[false,false];
    if (options && options.hash) {
        isAdmin = options.hash.ghost;
        minify = options.hash.minifyInProduction;
    }
    if (process.env.NODE_ENV !== 'production') {
        minify = false;
    }
    return new hbs.handlebars.SafeString(
        getAssetUrl(path, isAdmin, minify)
    );
}

module.exports = asset;
