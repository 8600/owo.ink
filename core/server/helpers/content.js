// # Content Helper
// Usage: `{{content}}`, `{{content words="20"}}`, `{{content characters="256"}}`
//
// Turns content html into a safestring so that the user doesn't have to
// escape it or tell handlebars to leave it alone with a triple-brace.
//
// Enables tag-safe truncation of content by characters or words.

var hbs = require('express-hbs'),content;

content = function (options) {
    return new hbs.handlebars.SafeString(this.html);
};

module.exports = content;
