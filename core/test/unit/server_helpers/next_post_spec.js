var should = require('should'),
    sinon = require('sinon'),
    Promise = require('bluebird'),
    hbs = require('express-hbs'),
    utils = require('./utils'),

// Stuff we are testing
    handlebars = hbs.handlebars,
    helpers = require('../../../server/helpers'),
    api = require('../../../server/api'),

    sandbox = sinon.sandbox.create();

describe('{{next_post}} helper', function () {
    var readPostStub;

    afterEach(function () {
        sandbox.restore();
    });

    describe('with valid post data - ', function () {
        beforeEach(function () {
            utils.loadHelpers();
            readPostStub = sandbox.stub(api.posts, 'read', function (options) {
                if (options.include.indexOf('next') === 0) {
                    return Promise.resolve({
                        posts: [{slug: '/current/', title: 'post 2', next: {slug: '/next/', title: 'post 3'}}]
                    });
                }
            });
        });

        it('has loaded next_post helper', function () {
            should.exist(handlebars.helpers.prev_post);
        });

        it('shows \'if\' template with next post data', function (done) {
            var fn = sinon.spy(),
                inverse = sinon.spy(),
                optionsData = {name: 'next_post', fn: fn, inverse: inverse};

            helpers.prev_post.call({
                html: 'content',
                status: 'published',
                markdown: 'ff',
                title: 'post2',
                slug: 'current',
                created_at: new Date(0),
                url: '/current/'
            }, optionsData).then(function () {
                fn.calledOnce.should.be.true();
                inverse.calledOnce.should.be.false();

                readPostStub.calledOnce.should.be.true();
                readPostStub.firstCall.args[0].include.should.eql('next,next.author,next.tags');
                done();
            }).catch(function (err) {
                console.log('err ', err);
                done(err);
            });
        });
    });

    describe('for valid post with no next post', function () {
        beforeEach(function () {
            utils.loadHelpers();
            readPostStub = sandbox.stub(api.posts, 'read', function (options) {
                if (options.include.indexOf('next') === 0) {
                    return Promise.resolve({posts: [{slug: '/current/', title: 'post 2'}]});
                }
            });
        });

        it('shows \'else\' template', function (done) {
            var fn = sinon.spy(),
                inverse = sinon.spy(),
                optionsData = {name: 'next_post', fn: fn, inverse: inverse};

            helpers.prev_post.call({
                html: 'content',
                markdown: 'ff',
                title: 'post2',
                slug: 'current',
                created_at: new Date(0),
                url: '/current/'
            }, optionsData).then(function () {
                fn.called.should.be.false();
                inverse.called.should.be.true();
                done();
            }).catch(function (err) {
                done(err);
            });
        });
    });

    describe('for invalid post data', function () {
        beforeEach(function () {
            utils.loadHelpers();
            readPostStub = sandbox.stub(api.posts, 'read', function (options) {
                if (options.include.indexOf('next') === 0) {
                    return Promise.resolve({});
                }
            });
        });

        it('shows \'else\' template', function (done) {
            var fn = sinon.spy(),
                inverse = sinon.spy(),
                optionsData = {name: 'next_post', fn: fn, inverse: inverse};

            helpers.prev_post.call({}, optionsData).then(function () {
                fn.called.should.be.false();
                inverse.called.should.be.true();
                readPostStub.called.should.be.false();
                done();
            }).catch(function (err) {
                done(err);
            });
        });
    });

    describe('for unpublished post', function () {
        beforeEach(function () {
            utils.loadHelpers();
            readPostStub = sandbox.stub(api.posts, 'read', function (options) {
                if (options.include.indexOf('next') === 0) {
                    return Promise.resolve({
                        posts: [{slug: '/current/', title: 'post 2', next: {slug: '/next/', title: 'post 3'}}]
                    });
                }
            });
        });

        it('shows \'else\' template', function (done) {
            var fn = sinon.spy(),
                inverse = sinon.spy(),
                optionsData = {name: 'next_post', fn: fn, inverse: inverse};

            helpers.prev_post.call({
                html: 'content',
                status: 'published',
                markdown: 'ff',
                title: 'post2',
                slug: 'current',
                created_at: new Date(0),
                url: '/current/'
            }, optionsData)
                .then(function () {
                    fn.called.should.be.true();
                    inverse.called.should.be.false();
                    done();
                }).catch(function (err) {
                done(err);
            });
        });
    });
});
