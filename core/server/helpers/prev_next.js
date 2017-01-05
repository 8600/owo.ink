// ### 返回 下一篇文章 和 上一篇文章 HTML代码的函数.
// http://owo.ink/core-server-helpers-prev_next/
//  Example usages
// `{{#prev_post}}<a href ="{{url}}>previous post</a>{{/prev_post}}'
// `{{#next_post}}<a href ="{{url absolute="true">next post</a>{{/next_post}}'

const api             = require('../api'),
      schema          = require('../data/schema').checks,
      Promise         = require('bluebird');

const fetch = function (apiOptions, options) {
    return api.posts.read(apiOptions).then(function (result) {
        // 存储文章详细信息以及前后文章的变量
        const related = result.posts[0];
        if (related.previous) {
            //console.log(options.fn(related.previous));
            return options.fn(related.previous);
        } else if (related.next) {
            return options.fn(related.next);
        } else {
            return options.inverse(this);
        }
    });
};

// If prevNext method is called without valid post data then we must return a promise, if there is valid post data
// then the promise is handled in the api call.

const prevNext = function (options) {
    //console.log(options.fn);
    options = options || {};
    let apiOptions = {
        include: options.name === 'prev_post' ? 'previous,previous.author,previous.tags' : 'next,next.author,next.tags'
    };
    //判断是否为私密文章 如果是则不反回上下文章
    if (schema.isPost(this) && this.status === 'published') {
        apiOptions.slug = this.slug;
        return fetch(apiOptions, options);
    } else {
        return Promise.resolve(options.inverse(this));
    }
};

module.exports = prevNext;
