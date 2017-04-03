var debug = require('debug')('ghost:admin:controller'),
    _ = require('lodash'),
    path = require('path'),
    config = require('../config'),
    api = require('../api'),
    logging = require('../logging'),
    i18n = require('../i18n');

// Route: index
// Path: /ghost/
// Method: GET
module.exports = function adminController(req, res) {
    const defaultTemplate = config.get('env') === 'production' ? 'default-prod.html' : 'default.html',
          templatePath = path.resolve(config.get('paths').adminViews, defaultTemplate);
    
    res.sendFile(templatePath);
};
