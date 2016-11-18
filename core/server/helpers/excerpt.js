// # Excerpt Helper
// Usage: `{{excerpt}}`, `{{excerpt words="50"}}`, `{{excerpt characters="256"}}`
//
// Attempts to remove all HTML from the string, and then shortens the result according to the provided option.
//
// Defaults to words="50"
"use strict";
const hbs = require('express-hbs'),
    _   = require('lodash'),
    getMetaDataExcerpt = require('../data/meta/excerpt');

function excerpt(options) {
    const truncateOptions = (options || {}).hash || {};
    //如果传来的参数小于0那么返回全部文本
    let runt = String(this.html);
    if(truncateOptions.words>0){
        runt = getMetaDataExcerpt(String(this.html), truncateOptions);
    }
    return new hbs.handlebars.SafeString(runt);
}

module.exports = excerpt;
