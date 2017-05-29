import NewUserValidator from 'ghost-admin/validators/new-user';

export default NewUserValidator.create({
    properties: ['name', 'email', 'password', 'blogTitle'],

    blogTitle(model) {
        let blogTitle = model.get('blogTitle');

        if (!validator.isLength(blogTitle, 1)) {
            model.get('errors').add('blogTitle', '请输入博客标题。');
            this.invalidate();
        }
    }
});
