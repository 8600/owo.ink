"use strict";
const time = {
    //将秒转换为秒/分钟/小时/天
    secondToTime:function(value){
        const theTime = parseInt(value);// 秒
        if(theTime>=60){
            if(theTime>=3600){
                if(theTime>=86400){
                    return `${theTime/86400} 天`;
                }
                else{
                    return `${theTime/3600} 小时`;
                }
            }
            else{
                return `${theTime/60} 分钟`;
            }
        }
        else{
            return `${theTime} 秒`;
        }
    }
};
module.exports = time;