import moment from 'moment';
const parseDateFormats = [
    'DD MMM YY @ HH:mm', 'DD MMM YY HH:mm',
    'D MMM YY @ HH:mm', 'D MMM YY HH:mm',
    'DD MMM YYYY @ HH:mm', 'DD MMM YYYY HH:mm',
    'D MMM YYYY @ HH:mm', 'D MMM YYYY HH:mm',
    'DD/MM/YY @ HH:mm', 'DD/MM/YY HH:mm',
    'DD/MM/YYYY @ HH:mm', 'DD/MM/YYYY HH:mm',
    'DD-MM-YY @ HH:mm', 'DD-MM-YY HH:mm',
    'DD-MM-YYYY @ HH:mm', 'DD-MM-YYYY HH:mm',
    'YYYY-MM-DD @ HH:mm', 'YYYY-MM-DD HH:mm',
    'DD MMM @ HH:mm', 'DD MMM HH:mm',
    'D MMM @ HH:mm', 'D MMM HH:mm'
];

const displayDateFormat = 'DD MMM YY @ HH:mm';

// 补全时间戳
function verifyTimeStamp(dateString) {
    if (dateString && !dateString.slice(-5).match(/\d+:\d\d/)) {
        dateString += ' 12:00';
    }
    return dateString;
}

// 将字符串解析为时刻
function parseDateString(value, timezone) {
    // We need the timezone here, otherwise the date will be parsed
    // in UTC timezone
    moment.tz.setDefault(timezone);

    return value ? moment(verifyTimeStamp(value), parseDateFormats, true) : undefined;
}

// 格式化时间和时刻
function formatDate(value, timezone) {
    // we output the date adjusted to the blog timezone selected in settings
    return verifyTimeStamp(value ? moment(value).tz(timezone).format(displayDateFormat) : '');
}

export {
    parseDateString,
    formatDate
};
