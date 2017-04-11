const path = require('path'),
      config = require('../config');

// 路线: index
// 路径: /ghost/
// 方法: GET
module.exports = function adminController(req, res) {
    const defaultTemplate = config.get('env') === 'production' ? 'default-prod.html' : 'default.html',
          templatePath = path.resolve(config.get('paths').adminViews, defaultTemplate);
    
    res.sendFile(templatePath);
};
