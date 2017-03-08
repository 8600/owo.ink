// https://github.com/image-size/image-size:
// 支持的格式
// BMP, GIF, JPEG, PNG, PSD, TIFF, WebP, SVG
// ***
// Takes the url of the image and an optional timeout
// 返回格式
// {
//     height: 50,
//     url: 'http://myblog.com/images/cat.jpg',
//     width: 50
// };

const sizeOf       = require('image-size'),
      url          = require('url'),
      Promise      = require('bluebird'),
      http         = require('http'),
      https        = require('https'),
      config       = require('../config');
let   dimensions,
      request,
      requestHandler;

/**
 * @description 从URL读取图像尺寸
 * @param {String} imagePath
 * @param {Number} timeout (optional)
 * @returns {Promise<Object>} imageObject or error
 */
module.exports.getImageSizeFromUrl = function getImageSizeFromUrl(imagePath, timeout) {
    return new Promise(function imageSizeRequest(resolve, reject) {
        let imageObject = {},options;
        imageObject.url = imagePath;

        // 纠正不正确的URL格式
        if (imagePath.indexOf('http') === -1) {
            // our gravatar urls start with '//' in that case add 'http:'
            if (imagePath.indexOf('//') === 0) {
                // it's a gravatar url
                imagePath = 'http:' + imagePath;
            } else {
                // 获取图像的绝对url
                imagePath = config.urlFor('image', {image: imagePath}, true);
            }
        }

        options = url.parse(imagePath);
        //判断是否为HTTPS
        requestHandler = imagePath.indexOf('https') === 0 ? https : http;
        options.headers = {'User-Agent': 'Mozilla/5.0'};

        request = requestHandler.get(options, function (res) {
            //存储数据
            let chunks = [];
            res.on('data', function (chunk) {
                chunks.push(chunk);
            });

            res.on('end', function () {
                if (res.statusCode === 200) {
                    try {
                        dimensions = sizeOf(Buffer.concat(chunks));

                        imageObject.width = dimensions.width;
                        imageObject.height = dimensions.height;

                        return resolve(imageObject);
                    } catch (err) {
                        // 如果出错返回错误信息
                        return reject(err);
                    }
                } else {
                    let err = new Error();
                    err.message = imagePath;
                    err.statusCode = res.statusCode;
                    return reject(err);
                }
            });
        }).on('socket', function (socket) {
            // 如果没有超时作为参数，则不设置超时
            if (timeout) {
                socket.setTimeout(timeout);
                socket.on('timeout', function () {
                    request.abort();
                });
            }
        }).on('error', function (err) {
            return reject(err);
        });
    });
};
