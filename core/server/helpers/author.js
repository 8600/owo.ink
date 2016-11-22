// # Author Helper
// Usage: `{{author}}` OR `{{#author}}{{/author}}`
//
// Can be used as either an output or a block helper
//
// Output helper: `{{author}}`
//Block helper: `{{#author}}{{/author}}`
// 返回一个名称为 作者本人 名字 并且指向作者主页的a标签

"use strict";
const hbs= require('express-hbs'),_= require('lodash'),config= require('../config'),utils= require('./utils');
const author = function (options) {
    if (options.fn) {
        return hbs.handlebars.helpers.with.call(this, this.author, options);
    }
    const autolink = _.isString(options.hash.autolink) && options.hash.autolink === 'false' ? false : true;
    let output = '';
    if (this.author && this.author.name) {
        if (autolink) {
            output = utils.linkTemplate({
                url: config.urlFor('author', {author: this.author}),
                text: _.escape(this.author.name)
            });
        } else {
            output = _.escape(this.author.name);
        }
    }
    return new hbs.handlebars.SafeString(output);
};

module.exports = author;
