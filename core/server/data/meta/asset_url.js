"use strict";
const config = require('../../config'),generateAssetHash = require('../../utils/asset-hash');

function getAssetUrl(path, isAdmin, minify) {
    let output = `${config.paths.subdir}/`;
    if (!path.match(/^favicon\.ico$/) && !path.match(/^shared/) && !path.match(/^asset/)) {
        if (isAdmin) {output += 'ghost/';} 
        else {output += 'assets/';}
    }
    path = path.replace(/^\//, '');

    if (minify) {path = path.replace(/\.([^\.]*)$/, '.min.$1');}
    output += path;

    if (!path.match(/^favicon\.ico$/)) {
        if (!config.assetHash) {
            config.set({assetHash: generateAssetHash()});
        }
        output = output + '?v=' + config.assetHash;
    }
    return output;
}

module.exports = getAssetUrl;
