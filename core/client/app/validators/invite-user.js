import BaseValidator from './base';

export default BaseValidator.create({
    properties: ['email'],

    email(model) {
        let email = model.get('email');

        if (validator.empty(email)) {
            model.get('errors').add('email', '请输入电子邮件。');
            this.invalidate();
        } else if (!validator.isEmail(email)) {
            model.get('errors').add('email', '错误的邮件地址。');
            this.invalidate();
        }
    }
});
