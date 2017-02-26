const readThemes = require('./read-themes'),
      Promise = require('bluebird'),
      _ = require('lodash'),
      i18n = require('../i18n');

//检查主题是否有 package.json

function validateThemes(dir) {
    let result = {warnings: [],errors: []};
    return readThemes(dir).tap(function (themes) {
            _.each(themes, function (theme, name) {
                let hasPackageJson, warning;

                hasPackageJson = theme['package.json'] !== undefined;

                if (!hasPackageJson) {
                    warning = {
                        message: i18n.t('errors.utils.validatethemes.themeWithNoPackage.message'),
                        context: i18n.t('errors.utils.validatethemes.themeWithNoPackage.context', {name: name})        
                    };
                    result.warnings.push(warning);
                }

                // 如果package.json值为`null`, 则意味着它存在
                // 但是 JSON.parse 会报错
                if (hasPackageJson && theme['package.json'] === null) {
                    warning = {
                        message: i18n.t('errors.utils.validatethemes.malformedPackage.message'),
                        context: i18n.t('errors.utils.validatethemes.malformedPackage.context', {name: name})
                    };

                    result.warnings.push(warning);
                }
            });
        })
        .then(function () {
            const hasNotifications = result.warnings.length || result.errors.length;
            if (hasNotifications) {
                return Promise.reject(result);
            }
        });
}
module.exports = validateThemes;
