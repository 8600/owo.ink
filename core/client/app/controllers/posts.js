import Controller from 'ember-controller';
import computed from 'ember-computed';
import injectService from 'ember-service/inject';
import get from 'ember-metal/get';

export default Controller.extend({

    session: injectService(),
    store: injectService(),

    queryParams: ['type', 'author', 'tag', 'order'],
    type: null,
    author: null,
    tag: null,
    order: null,

    _hasLoadedTags: false,
    _hasLoadedAuthors: false,

    showDeletePostModal: false,

    availableTypes: [{
        name: '所有',
        value: null
    }, {
        name: '草稿',
        value: 'draft'
    }, {
        name: '已发布',
        value: 'published'
    }, {
        name: '定时发布',
        value: 'scheduled'
    }, {
        name: '页面',
        value: 'page'
    }],

    availableOrders: [{
        name: '最新',
        value: null
    }, {
        name: '最早',
        value: 'published_at asc'
    }],

    showingAll: computed('type', 'author', 'tag', function () {
        let {type, author, tag} = this.getProperties(['type', 'author', 'tag']);

        return !type && !author && !tag;
    }),

    selectedType: computed('type', function () {
        let types = this.get('availableTypes');
        return types.findBy('value', this.get('type'));
    }),

    selectedOrder: computed('order', function () {
        let orders = this.get('availableOrders');
        return orders.findBy('value', this.get('order'));
    }),

    _availableTags: computed(function () {
        return this.get('store').peekAll('tag');
    }),

    availableTags: computed('_availableTags.[]', function () {
        let tags = this.get('_availableTags');
        let options = tags.toArray();

        options.unshiftObject({name: '所有标签', slug: null});

        return options;
    }),

    selectedTag: computed('tag', '_availableTags.[]', function () {
        let tag = this.get('tag');
        let tags = this.get('availableTags');

        return tags.findBy('slug', tag);
    }),

    _availableAuthors: computed(function () {
        return this.get('store').peekAll('user');
    }),

    availableAuthors: computed('_availableAuthors.[]', function () {
        let authors = this.get('_availableAuthors');
        let options = authors.toArray();

        options.unshiftObject({name: '所有作者', slug: null});

        return options;
    }),

    selectedAuthor: computed('author', 'availableAuthors.[]', function () {
        let author = this.get('author');
        let authors = this.get('availableAuthors');

        return authors.findBy('slug', author);
    }),

    actions: {
        toggleDeletePostModal() {
            this.toggleProperty('showDeletePostModal');
        },

        changeType(type) {
            this.set('type', get(type, 'value'));
        },

        changeAuthor(author) {
            this.set('author', get(author, 'slug'));
        },

        changeTag(tag) {
            this.set('tag', get(tag, 'slug'));
        },

        changeOrder(order) {
            this.set('order', get(order, 'value'));
        }
    }
});
