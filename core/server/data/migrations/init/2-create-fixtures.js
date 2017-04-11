var Promise = require('bluebird'),
    _ = require('lodash'),
    fixtures = require('../../schema/fixtures'),
    logging = require('../../../logging');

module.exports = function insertFixtures(options) {
    var localOptions = _.merge({
        context: {internal: true}
    }, options);

    return Promise.mapSeries(fixtures.models, function (model) {
        logging.info('加载模块: ' + model.name);
        return fixtures.utils.addFixturesForModel(model, localOptions);
    }).then(function () {
        return Promise.mapSeries(fixtures.relations, function (relation) {
            logging.info('建立关系: ' + relation.from.model + ' to ' + relation.to.model);
            return fixtures.utils.addFixturesForRelation(relation, localOptions);
        });
    });
};
