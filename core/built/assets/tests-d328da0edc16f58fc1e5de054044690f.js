'use strict';

define('ghost-admin/tests/acceptance/authentication-test', ['exports', 'mocha', 'chai', 'jquery', 'ember-runloop', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth', 'ember-cli-mirage', 'ghost-admin/utils/window-proxy', 'ghost-admin/utils/ghost-paths', 'ghost-admin/authenticators/oauth2'], function (exports, _mocha, _chai, _jquery, _emberRunloop, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth, _emberCliMirage, _ghostAdminUtilsWindowProxy, _ghostAdminUtilsGhostPaths, _ghostAdminAuthenticatorsOauth2) {

    var Ghost = (0, _ghostAdminUtilsGhostPaths['default'])();

    (0, _mocha.describe)('Acceptance: Authentication', function () {
        var application = undefined,
            originalReplaceLocation = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.describe)('setup redirect', function () {
            (0, _mocha.beforeEach)(function () {
                server.get('authentication/setup', function () {
                    return { setup: [{ status: false }] };
                });
            });

            (0, _mocha.it)('redirects to setup when setup isn\'t complete', function () {
                visit('settings/labs');

                andThen(function () {
                    (0, _chai.expect)(currentURL()).to.equal('/setup/one');
                });
            });
        });

        (0, _mocha.describe)('token handling', function () {
            (0, _mocha.beforeEach)(function () {
                // replace the default test authenticator with our own authenticator
                application.register('authenticator:test', _ghostAdminAuthenticatorsOauth2['default']);

                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role], slug: 'test-user' });
            });

            (0, _mocha.it)('refreshes app tokens on boot', function () {
                /* eslint-disable camelcase */
                (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application, {
                    access_token: 'testAccessToken',
                    refresh_token: 'refreshAccessToken'
                });
                /* eslint-enable camelcase */

                visit('/');

                andThen(function () {
                    var requests = server.pretender.handledRequests;
                    var refreshRequest = requests.findBy('url', '/ghost/api/v0.1/authentication/token');

                    (0, _chai.expect)(refreshRequest).to.exist;
                    (0, _chai.expect)(refreshRequest.method, 'method').to.equal('POST');

                    var requestBody = _jquery['default'].deparam(refreshRequest.requestBody);
                    (0, _chai.expect)(requestBody.grant_type, 'grant_type').to.equal('password');
                    (0, _chai.expect)(requestBody.username.access_token, 'access_token').to.equal('testAccessToken');
                    (0, _chai.expect)(requestBody.username.refresh_token, 'refresh_token').to.equal('refreshAccessToken');
                });
            });
        });

        (0, _mocha.describe)('general page', function () {
            (0, _mocha.beforeEach)(function () {
                originalReplaceLocation = _ghostAdminUtilsWindowProxy['default'].replaceLocation;
                _ghostAdminUtilsWindowProxy['default'].replaceLocation = function (url) {
                    url = url.replace(/^\/ghost\//, '/');
                    visit(url);
                };

                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role], slug: 'test-user' });
            });

            (0, _mocha.afterEach)(function () {
                _ghostAdminUtilsWindowProxy['default'].replaceLocation = originalReplaceLocation;
            });

            (0, _mocha.it)('invalidates session on 401 API response', function () {
                // return a 401 when attempting to retrieve users
                server.get('/users/', function () {
                    return new _emberCliMirage.Response(401, {}, {
                        errors: [{ message: 'Access denied.', errorType: 'UnauthorizedError' }]
                    });
                });

                (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
                visit('/team');

                andThen(function () {
                    // NOTE: seems to be a test issue where this is running
                    // mid transition
                });

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'url after 401').to.equal('/signin');
                });
            });

            (0, _mocha.it)('doesn\'t show navigation menu on invalid url when not authenticated', function () {
                (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);

                visit('/');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'current url').to.equal('/signin');
                    (0, _chai.expect)(find('nav.gh-nav').length, 'nav menu presence').to.equal(0);
                });

                visit('/signin/invalidurl/');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'url after invalid url').to.equal('/signin/invalidurl/');
                    (0, _chai.expect)(currentPath(), 'path after invalid url').to.equal('error404');
                    (0, _chai.expect)(find('nav.gh-nav').length, 'nav menu presence').to.equal(0);
                });
            });

            (0, _mocha.it)('shows nav menu on invalid url when authenticated', function () {
                (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
                visit('/signin/invalidurl/');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'url after invalid url').to.equal('/signin/invalidurl/');
                    (0, _chai.expect)(currentPath(), 'path after invalid url').to.equal('error404');
                    (0, _chai.expect)(find('nav.gh-nav').length, 'nav menu presence').to.equal(1);
                });
            });
        });

        // TODO: re-enable once modal reappears correctly
        _mocha.describe.skip('editor', function () {
            var origDebounce = _emberRunloop['default'].debounce;
            var origThrottle = _emberRunloop['default'].throttle;

            // we don't want the autosave interfering in this test
            (0, _mocha.beforeEach)(function () {
                _emberRunloop['default'].debounce = function () {};
                _emberRunloop['default'].throttle = function () {};
            });

            (0, _mocha.it)('displays re-auth modal attempting to save with invalid session', function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });

                // simulate an invalid session when saving the edited post
                server.put('/posts/:id/', function (_ref, _ref2) {
                    var posts = _ref.posts;
                    var params = _ref2.params;

                    var post = posts.find(params.id);
                    var attrs = this.normalizedRequestAttrs();

                    if (attrs.markdown === 'Edited post body') {
                        return new _emberCliMirage.Response(401, {}, {
                            errors: [{ message: 'Access denied.', errorType: 'UnauthorizedError' }]
                        });
                    } else {
                        return post.update(attrs);
                    }
                });

                (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);

                visit('/editor');

                // create the post
                fillIn('#entry-title', 'Test Post');
                fillIn('.__mobiledoc-editor', 'Test post body');
                click('.js-publish-button');

                andThen(function () {
                    // we shouldn't have a modal at this point
                    (0, _chai.expect)(find('.modal-container #login').length, 'modal exists').to.equal(0);
                    // we also shouldn't have any alerts
                    (0, _chai.expect)(find('.gh-alert').length, 'no of alerts').to.equal(0);
                });

                // update the post
                fillIn('.__mobiledoc-editor', 'Edited post body');
                click('.js-publish-button');

                andThen(function () {
                    // we should see a re-auth modal
                    (0, _chai.expect)(find('.fullscreen-modal #login').length, 'modal exists').to.equal(1);
                });
            });

            // don't clobber debounce/throttle for future tests
            (0, _mocha.afterEach)(function () {
                _emberRunloop['default'].debounce = origDebounce;
                _emberRunloop['default'].throttle = origThrottle;
            });
        });

        (0, _mocha.it)('adds auth headers to jquery ajax', function (done) {
            var role = server.create('role', { name: 'Administrator' });
            server.create('user', { roles: [role] });

            server.post('/uploads', function (schema, request) {
                return request;
            });

            /* eslint-disable camelcase */
            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application, {
                access_token: 'test_token',
                expires_in: 3600,
                token_type: 'Bearer'
            });
            /* eslint-enable camelcase */

            // necessary to visit a page to fully boot the app in testing
            visit('/').andThen(function () {
                _jquery['default'].ajax({
                    type: 'POST',
                    url: Ghost.apiRoot + '/uploads/',
                    data: { test: 'Test' }
                }).then(function (request) {
                    (0, _chai.expect)(request.requestHeaders.Authorization, 'Authorization header').to.exist;
                    (0, _chai.expect)(request.requestHeaders.Authorization, 'Authotization header content').to.equal('Bearer test_token');
                }).always(function () {
                    done();
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/authentication-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/authentication-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/content-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth', 'ember-test-selectors'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth, _emberTestSelectors) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    (0, _mocha.describe)('Acceptance: Content', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects to signin when not authenticated', function () {
            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
            visit('/');

            andThen(function () {
                (0, _chai.expect)(currentURL()).to.equal('/signin');
            });
        });

        (0, _mocha.describe)('as admin', function () {
            var admin = undefined,
                editor = undefined,
                publishedPost = undefined,
                scheduledPost = undefined,
                draftPost = undefined,
                publishedPage = undefined,
                authorPost = undefined;

            (0, _mocha.beforeEach)(function () {
                var adminRole = server.create('role', { name: 'Administrator' });
                admin = server.create('user', { roles: [adminRole] });
                var editorRole = server.create('role', { name: 'Editor' });
                editor = server.create('user', { roles: [editorRole] });

                publishedPost = server.create('post', { authorId: admin.id, status: 'published', title: 'Published Post' });
                scheduledPost = server.create('post', { authorId: admin.id, status: 'scheduled', title: 'Scheduled Post' });
                draftPost = server.create('post', { authorId: admin.id, status: 'draft', title: 'Draft Post' });
                publishedPage = server.create('post', { authorId: admin.id, status: 'published', page: true, title: 'Published Page' });
                authorPost = server.create('post', { authorId: editor.id, status: 'published', title: 'Editor Published Post' });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('displays and filters posts', function () {
                visit('/');

                andThen(function () {
                    // Not checking request here as it won't be the last request made
                    // Displays all posts + pages
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id')).length, 'all posts count').to.equal(5);
                });

                selectChoose((0, _emberTestSelectors['default'])('type-select'), 'Draft posts');

                andThen(function () {
                    // API request is correct

                    var _server$pretender$handledRequests$slice = server.pretender.handledRequests.slice(-1);

                    var _server$pretender$handledRequests$slice2 = _slicedToArray(_server$pretender$handledRequests$slice, 1);

                    var lastRequest = _server$pretender$handledRequests$slice2[0];

                    (0, _chai.expect)(lastRequest.queryParams.status, '"drafts" request status param').to.equal('draft');
                    (0, _chai.expect)(lastRequest.queryParams.staticPages, '"drafts" request staticPages param').to.equal('false');
                    // Displays draft post
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id')).length, 'drafts count').to.equal(1);
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id', draftPost.id)), 'draft post').to.exist;
                });

                selectChoose((0, _emberTestSelectors['default'])('type-select'), 'Published posts');

                andThen(function () {
                    // API request is correct

                    var _server$pretender$handledRequests$slice3 = server.pretender.handledRequests.slice(-1);

                    var _server$pretender$handledRequests$slice32 = _slicedToArray(_server$pretender$handledRequests$slice3, 1);

                    var lastRequest = _server$pretender$handledRequests$slice32[0];

                    (0, _chai.expect)(lastRequest.queryParams.status, '"published" request status param').to.equal('published');
                    (0, _chai.expect)(lastRequest.queryParams.staticPages, '"published" request staticPages param').to.equal('false');
                    // Displays three published posts + pages
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id')).length, 'published count').to.equal(2);
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id', publishedPost.id)), 'admin published post').to.exist;
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id', authorPost.id)), 'author published post').to.exist;
                });

                selectChoose((0, _emberTestSelectors['default'])('type-select'), 'Scheduled posts');

                andThen(function () {
                    // API request is correct

                    var _server$pretender$handledRequests$slice4 = server.pretender.handledRequests.slice(-1);

                    var _server$pretender$handledRequests$slice42 = _slicedToArray(_server$pretender$handledRequests$slice4, 1);

                    var lastRequest = _server$pretender$handledRequests$slice42[0];

                    (0, _chai.expect)(lastRequest.queryParams.status, '"scheduled" request status param').to.equal('scheduled');
                    (0, _chai.expect)(lastRequest.queryParams.staticPages, '"scheduled" request staticPages param').to.equal('false');
                    // Displays scheduled post
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id')).length, 'scheduled count').to.equal(1);
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id', scheduledPost.id)), 'scheduled post').to.exist;
                });

                selectChoose((0, _emberTestSelectors['default'])('type-select'), 'Pages');

                andThen(function () {
                    // API request is correct

                    var _server$pretender$handledRequests$slice5 = server.pretender.handledRequests.slice(-1);

                    var _server$pretender$handledRequests$slice52 = _slicedToArray(_server$pretender$handledRequests$slice5, 1);

                    var lastRequest = _server$pretender$handledRequests$slice52[0];

                    (0, _chai.expect)(lastRequest.queryParams.status, '"pages" request status param').to.equal('all');
                    (0, _chai.expect)(lastRequest.queryParams.staticPages, '"pages" request staticPages param').to.equal('true');
                    // Displays page
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id')).length, 'pages count').to.equal(1);
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id', publishedPage.id)), 'page post').to.exist;
                });

                selectChoose((0, _emberTestSelectors['default'])('type-select'), 'All posts');

                andThen(function () {
                    // API request is correct

                    var _server$pretender$handledRequests$slice6 = server.pretender.handledRequests.slice(-1);

                    var _server$pretender$handledRequests$slice62 = _slicedToArray(_server$pretender$handledRequests$slice6, 1);

                    var lastRequest = _server$pretender$handledRequests$slice62[0];

                    (0, _chai.expect)(lastRequest.queryParams.status, '"all" request status param').to.equal('all');
                    (0, _chai.expect)(lastRequest.queryParams.staticPages, '"all" request staticPages param').to.equal('all');
                });

                selectChoose((0, _emberTestSelectors['default'])('author-select'), editor.name);

                andThen(function () {
                    // API request is correct

                    var _server$pretender$handledRequests$slice7 = server.pretender.handledRequests.slice(-1);

                    var _server$pretender$handledRequests$slice72 = _slicedToArray(_server$pretender$handledRequests$slice7, 1);

                    var lastRequest = _server$pretender$handledRequests$slice72[0];

                    (0, _chai.expect)(lastRequest.queryParams.status, '"all" request status param').to.equal('all');
                    (0, _chai.expect)(lastRequest.queryParams.staticPages, '"all" request staticPages param').to.equal('all');
                    (0, _chai.expect)(lastRequest.queryParams.filter, '"editor" request filter param').to.equal('author:' + editor.slug);
                    // Displays editor post
                    // TODO: implement "filter" param support and fix mirage post->author association
                    // expect(find(testSelector('post-id')).length, 'editor post count').to.equal(1);
                    // expect(find(testSelector('post-id', authorPost.id)), 'author post').to.exist;
                });

                // TODO: test tags dropdown
            });
        });

        (0, _mocha.describe)('as author', function () {
            var author = undefined,
                authorPost = undefined;

            (0, _mocha.beforeEach)(function () {
                var authorRole = server.create('role', { name: 'Author' });
                author = server.create('user', { roles: [authorRole] });
                var adminRole = server.create('role', { name: 'Administrator' });
                var admin = server.create('user', { roles: [adminRole] });

                // create posts
                authorPost = server.create('post', { authorId: author.id, status: 'published', title: 'Author Post' });
                server.create('post', { authorId: admin.id, status: 'scheduled', title: 'Admin Post' });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('only fetches the author\'s posts', function () {
                visit('/');
                // trigger a filter request so we can grab the posts API request easily
                selectChoose((0, _emberTestSelectors['default'])('type-select'), 'Published posts');

                andThen(function () {
                    // API request includes author filter

                    var _server$pretender$handledRequests$slice8 = server.pretender.handledRequests.slice(-1);

                    var _server$pretender$handledRequests$slice82 = _slicedToArray(_server$pretender$handledRequests$slice8, 1);

                    var lastRequest = _server$pretender$handledRequests$slice82[0];

                    (0, _chai.expect)(lastRequest.queryParams.filter).to.equal('author:' + author.slug);

                    // only author's post is shown
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id')).length, 'post count').to.equal(1);
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('post-id', authorPost.id)), 'author post').to.exist;
                });
            });
        });
    });
});
define('ghost-admin/tests/acceptance/content-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/content-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/editor-markdown-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/editor-helpers', 'ghost-admin/tests/helpers/ember-simple-auth'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEditorHelpers, _ghostAdminTestsHelpersEmberSimpleAuth) {

    (0, _mocha.describe)('Acceptance: Editor', function () {
        this.timeout(25000);
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.describe)('Markerable markdown support.', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });
                server.loadFixtures('settings');

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('the editor renders correctly', function () {
                server.createList('post', 1);

                visit('/editor/1');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/editor/1');
                    (0, _chai.expect)(find('.surface').prop('contenteditable'), 'editor is editable').to.equal('true');
                    (0, _chai.expect)(window.editor).to.be.an('object');
                });
            });

            (0, _mocha.it)('plain text inputs (placebo)', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('abcdef', '<p>abcdef</p>', _chai.expect);
                });
            });

            // bold
            (0, _mocha.it)('** bolds at start of line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('**test**', '<p><strong>test</strong></p>', _chai.expect);
                });
            });

            (0, _mocha.it)('** bolds in a line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('123**test**', '<p>123<strong>test</strong></p>', _chai.expect);
                });
            });

            (0, _mocha.it)('__ bolds at start of line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('__test__', '<p><strong>test</strong></p>', _chai.expect);
                });
            });

            (0, _mocha.it)('__ bolds in a line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('123__test__', '<p>123<strong>test</strong></p>', _chai.expect);
                });
            });

            // italic
            (0, _mocha.it)('* italicises at start of line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('*test*', '<p><em>test</em></p>', _chai.expect);
                });
            });

            (0, _mocha.it)('* italicises in a line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('123*test*', '<p>123<em>test</em></p>', _chai.expect);
                });
            });

            (0, _mocha.it)('_ italicises at start of line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('_test_', '<p><em>test</em></p>', _chai.expect);
                });
            });

            (0, _mocha.it)('_ italicises in a line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('123_test_', '<p>123<em>test</em></p>', _chai.expect);
                });
            });

            // strikethrough
            (0, _mocha.it)('~~ strikethroughs at start of line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('~~test~~', '<p><s>test</s></p>', _chai.expect);
                });
            });

            (0, _mocha.it)('~~ strikethroughs in a line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('123~~test~~', '<p>123<s>test</s></p>', _chai.expect);
                });
            });

            // links
            (0, _mocha.it)('[]() creates a link at start of line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('[ghost](https://www.ghost.org/)', '<p><a href="https://www.ghost.org/">ghost</a></p>', _chai.expect);
                });
            });

            (0, _mocha.it)('[]() creates a link in a line', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('123[ghost](https://www.ghost.org/)', '<p>123<a href="https://www.ghost.org/">ghost</a></p>', _chai.expect);
                });
            });
        });

        (0, _mocha.describe)('Block markdown support.', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });
                server.loadFixtures('settings');

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            // headings
            (0, _mocha.it)('# creates an H1', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('# ', '<h1><br></h1>', _chai.expect);
                });
            });
            (0, _mocha.it)('## creates an H2', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('## ', '<h2><br></h2>', _chai.expect);
                });
            });

            (0, _mocha.it)('### creates an H3', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('### ', '<h3><br></h3>', _chai.expect);
                });
            });

            // lists
            (0, _mocha.it)('* creates an UL', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('* ', '<ul><li><br></li></ul>', _chai.expect);
                });
            });

            (0, _mocha.it)('- creates an UL', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('- ', '<ul><li><br></li></ul>', _chai.expect);
                });
            });
            (0, _mocha.it)('1. creates an OL', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('1. ', '<ol><li><br></li></ol>', _chai.expect);
                });
            });

            // quote
            (0, _mocha.it)('> creates an blockquote', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('> ', '<blockquote><br></blockquote>', _chai.expect);
                });
            });
        });

        // card interactions and styling are still a WIP
        _mocha.describe.skip('Card markdown support.', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });
                server.loadFixtures('settings');

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('![]() creates an image card.', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('![image of something](https://unsplash.it/200/300/?random) ', '...', _chai.expect);
                });
            });

            (0, _mocha.it)('``` creates a markdown card.', function () {
                server.createList('post', 1);

                visit('/editor/1');
                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)();
                });

                andThen(function () {
                    return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)('```some code``` ', '...', _chai.expect);
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/editor-markdown-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/editor-markdown-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/editor-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth', 'ember-cli-mirage', 'sinon', 'ember-test-selectors'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth, _emberCliMirage, _sinon, _emberTestSelectors) {

    (0, _mocha.describe)('Acceptance: Editor', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects to signin when not authenticated', function () {
            server.create('user'); // necessray for post-author association
            server.create('post');

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
            visit('/editor/1');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/signin');
            });
        });

        (0, _mocha.it)('does not redirect to team page when authenticated as author', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role], slug: 'test-user' });
            server.create('post');

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/editor/1');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/editor/1');
            });
        });

        (0, _mocha.it)('does not redirect to team page when authenticated as editor', function () {
            var role = server.create('role', { name: 'Editor' });
            server.create('user', { roles: [role], slug: 'test-user' });
            server.create('post');

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/editor/1');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/editor/1');
            });
        });

        (0, _mocha.it)('displays 404 when post does not exist', function () {
            var role = server.create('role', { name: 'Editor' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/editor/1');

            andThen(function () {
                (0, _chai.expect)(currentPath()).to.equal('error404');
                (0, _chai.expect)(currentURL()).to.equal('/editor/1');
            });
        });

        (0, _mocha.describe)('when logged in', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });
                server.loadFixtures('settings');

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('renders the editor correctly, PSM Publish Date and Save Button', function () {
                server.createList('post', 2);
                var plusTenMinPacific = moment().tz('Pacific/Kwajalein').add(10, 'minutes').format('DD MMM YY @ HH:mm').toString();
                var plusTwoMinPacific = moment().tz('Pacific/Kwajalein').add(2, 'minutes').format('DD MMM YY @ HH:mm').toString();

                // post id 1 is a draft, checking for draft behaviour now
                visit('/editor/1');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/editor/1');
                });

                // should error, if the date input is in a wrong format
                fillIn('input[name="post-setting-date"]', 'testdate');
                triggerEvent('input[name="post-setting-date"]', 'blur');

                andThen(function () {
                    (0, _chai.expect)(find('.ember-view.response').text().trim(), 'inline error response for invalid date').to.equal('Published Date must be a valid date with format: DD MMM YY @ HH:mm (e.g. 6 Dec 14 @ 15:00)');
                });

                // saves the post with the new date
                fillIn('input[name="post-setting-date"]', '10 May 16 @ 10:00');
                triggerEvent('input[name="post-setting-date"]', 'blur');
                // saving
                click('.gh-btn.gh-btn-sm.js-publish-button');

                andThen(function () {
                    (0, _chai.expect)(find('input[name="post-setting-date"]').val(), 'date after saving').to.equal('10 May 16 @ 10:00');
                });

                // should not do anything if the input date is not different
                fillIn('input[name="post-setting-date"]', '10 May 16 @ 10:00');
                triggerEvent('input[name="post-setting-date"]', 'blur');

                andThen(function () {
                    (0, _chai.expect)(find('input[name="post-setting-date"]').val(), 'date didn\'t change').to.equal('10 May 16 @ 10:00');
                });

                // checking the flow of the saving button for a draft
                andThen(function () {
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').hasClass('gh-btn-red'), 'no red button expected').to.be['false'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button').to.equal('Save Draft');
                    (0, _chai.expect)(find('.post-save-draft').hasClass('active'), 'highlights the default active button state for a draft').to.be['true'];
                });

                // click on publish now
                click('.post-save-publish a');

                andThen(function () {
                    (0, _chai.expect)(find('.post-save-publish').hasClass('active'), 'highlights the selected active button state').to.be['true'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').hasClass('gh-btn-red'), 'red button to change from draft to published').to.be['true'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button after click on \'publish now\'').to.equal('Publish Now');
                });

                // Publish the post
                click('.gh-btn.gh-btn-sm.js-publish-button');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button after publishing').to.equal('Update Post');
                    (0, _chai.expect)(find('.post-save-publish').hasClass('active'), 'highlights the default active button state for a published post').to.be['true'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').hasClass('gh-btn-red'), 'no red button expected').to.be['false'];
                });

                // post id 2 is a published post, checking for published post behaviour now
                visit('/editor/2');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/editor/2');
                    (0, _chai.expect)(find('input[name="post-setting-date"]').val()).to.equal('19 Dec 15 @ 16:25');
                });

                // should reset the date if the input field is blank
                fillIn('input[name="post-setting-date"]', '');
                triggerEvent('input[name="post-setting-date"]', 'blur');

                andThen(function () {
                    (0, _chai.expect)(find('input[name="post-setting-date"]').val(), 'empty date input').to.equal('');
                });

                // saving
                click('.gh-btn.gh-btn-sm.js-publish-button');

                andThen(function () {
                    (0, _chai.expect)(find('input[name="post-setting-date"]').val(), 'date value restored').to.equal('19 Dec 15 @ 16:25');
                });

                // saves the post with a new date
                fillIn('input[name="post-setting-date"]', '10 May 16 @ 10:00');
                triggerEvent('input[name="post-setting-date"]', 'blur');
                // saving
                click('.gh-btn.gh-btn-sm.js-publish-button');

                andThen(function () {
                    (0, _chai.expect)(find('input[name="post-setting-date"]').val(), 'new date after saving').to.equal('10 May 16 @ 10:00');
                });

                // go to settings to change the timezone
                visit('/settings/general');
                click((0, _emberTestSelectors['default'])('toggle-timezone'));

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'currentURL for settings').to.equal('/settings/general');
                    (0, _chai.expect)(find('#activeTimezone option:selected').text().trim(), 'default timezone').to.equal('(GMT) UTC');
                    // select a new timezone
                    find('#activeTimezone option[value="Pacific/Kwajalein"]').prop('selected', true);
                });

                triggerEvent('#activeTimezone', 'change');
                // save the settings
                click('.gh-btn.gh-btn-blue');

                andThen(function () {
                    (0, _chai.expect)(find('#activeTimezone option:selected').text().trim(), 'new timezone after saving').to.equal('(GMT +12:00) International Date Line West');
                });

                // and now go back to the editor
                visit('/editor/2');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'currentURL in editor').to.equal('/editor/2');
                    (0, _chai.expect)(find('input[name="post-setting-date"]').val(), 'date with blog timezone').to.equal('10 May 16 @ 22:00');
                });

                // should not do anything if the input date is not different
                fillIn('input[name="post-setting-date"]', '10 May 16 @ 22:00');
                triggerEvent('input[name="post-setting-date"]', 'blur');

                andThen(function () {
                    (0, _chai.expect)(find('input[name="post-setting-date"]').val(), 'date didn\'t change').to.equal('10 May 16 @ 22:00');
                });

                // click on unpublish
                click('.post-save-draft a');

                andThen(function () {
                    (0, _chai.expect)(find('.post-save-draft').hasClass('active'), 'highlights the active button state for a draft').to.be['true'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').hasClass('gh-btn-red'), 'red button to change from published to draft').to.be['true'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button for post to unpublish').to.equal('Unpublish');
                });

                // Unpublish the post
                click('.gh-btn.gh-btn-sm.js-publish-button');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button for draft').to.equal('Save Draft');
                    (0, _chai.expect)(find('.post-save-draft').hasClass('active'), 'highlights the default active button state for a draft').to.be['true'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').hasClass('gh-btn-red'), 'no red button expected').to.be['false'];
                });

                // Set the publish date 2 minute to the future to find an error message
                fillIn('input[name="post-setting-date"]', plusTwoMinPacific);
                triggerEvent('input[name="post-setting-date"]', 'blur');

                andThen(function () {
                    andThen(function () {
                        (0, _chai.expect)(find('.ember-view.response').text().trim(), 'inline error response for invalid date in future').to.equal('Must be at least 2 minutes from now.');
                    });
                });

                // Set the publish date into the future (best to have it 10 minutes from now in the future)
                fillIn('input[name="post-setting-date"]', plusTenMinPacific);
                triggerEvent('input[name="post-setting-date"]', 'blur');

                andThen(function () {
                    (0, _chai.expect)(find('label[for="post-setting-date"]').text().trim(), 'label changes to \'Scheduled Date\'').to.equal('Scheduled Date');
                });

                // click on 'Schedule Post'
                click('.post-save-schedule a');

                // button should show 'schedule post'
                andThen(function () {
                    (0, _chai.expect)(find('.post-save-schedule').hasClass('active'), 'highlights the active button state for a draft').to.be['true'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').hasClass('gh-btn-red'), 'red button to change from published to draft').to.be['true'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button for post to schedule').to.equal('Schedule Post');
                });

                // click on schedule post and save
                click('.gh-btn.gh-btn-sm.js-publish-button');

                andThen(function () {
                    // Dropdown menu should be 'Update Post' and 'Unschedule'
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button for scheduled post').to.equal('Update Post');
                    (0, _chai.expect)(find('.post-save-schedule').hasClass('active'), 'highlights the default active button state for a scheduled post').to.be['true'];
                    (0, _chai.expect)(find('.post-save-draft').text().trim(), 'not active option should say \'Unschedule\'').to.equal('Unschedule');
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').hasClass('gh-btn-red'), 'no red button expected').to.be['false'];
                    // expect countdown to show warning, that post will be published in x minutes
                    (0, _chai.expect)(find('.gh-notification.gh-notification-schedule').text().trim(), 'notification countdown').to.contain('Post will be published in');
                });

                // click on 'Unschedule'
                click('.post-save-draft a');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button to unscheduled post').to.equal('Unschedule');
                    (0, _chai.expect)(find('.post-save-draft').hasClass('active'), 'highlights the default active button state for a scheduled post').to.be['true'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').hasClass('gh-btn-red'), 'red button expected due to status change').to.be['true'];
                });

                // click on unschedule post and save
                click('.gh-btn.gh-btn-sm.js-publish-button');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button for a draft').to.equal('Save Draft');
                    (0, _chai.expect)(find('.post-save-draft').hasClass('active'), 'highlights the default active button state for a draft post').to.be['true'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').hasClass('gh-btn-red'), 'red button expected due to status change').to.be['false'];
                    // expect no countdown notification after unscheduling
                    (0, _chai.expect)(find('.gh-notification.gh-notification-schedule').text().trim(), 'notification countdown').to.equal('');
                });
            });

            (0, _mocha.it)('handles validation errors when scheduling', function () {
                var saveCount = 0;

                server.put('/posts/:id/', function (_ref, _ref2) {
                    var posts = _ref.posts;
                    var params = _ref2.params;

                    // we have three saves occurring here :-(
                    // 1. Auto-save of draft
                    // 2. Change of publish time
                    // 3. Pressing the Schedule button
                    saveCount++;
                    if (saveCount === 3) {
                        return new _emberCliMirage['default'].Response(422, {}, {
                            errors: [{
                                errorType: 'ValidationError',
                                message: 'Error test'
                            }]
                        });
                    } else {
                        var attrs = this.normalizedRequestAttrs();

                        return posts.find(params.id).update(attrs);
                    }
                });

                var post = server.create('post', 1);
                var plusTenMin = moment().add(10, 'minutes').format('DD MMM YY @ HH:mm').toString();

                visit('/editor/' + post.id);

                fillIn('input[name="post-setting-date"]', plusTenMin);
                triggerEvent('input[name="post-setting-date"]', 'blur');
                click('.post-save-schedule a');
                click('.gh-btn.gh-btn-sm.js-publish-button');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-alert').length, 'number of alerts after failed schedule').to.equal(1);

                    (0, _chai.expect)(find('.gh-alert').text(), 'alert text after failed schedule').to.match(/Scheduling failed: Error test/);
                });
            });

            (0, _mocha.it)('handles title validation errors correctly', function () {
                server.createList('post', 1);

                // post id 1 is a draft, checking for draft behaviour now
                visit('/editor/1');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/editor/1');
                });

                // Test title validation
                fillIn('input[id="entry-title"]', Array(160).join('a'));
                triggerEvent('input[id="entry-title"]', 'blur');
                click('.gh-btn.gh-btn-sm.js-publish-button');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-alert').length, 'number of alerts after invalid title').to.equal(1);

                    (0, _chai.expect)(find('.gh-alert').text(), 'alert text after invalid title').to.match(/Title cannot be longer than 150 characters/);
                });
            });

            (0, _mocha.it)('renders first countdown notification before scheduled time', function () {
                var clock = _sinon['default'].useFakeTimers(moment().valueOf());
                var compareDate = moment().tz('Etc/UTC').add(4, 'minutes').format('DD MMM YY @ HH:mm').toString();
                server.create('post', { publishedAt: moment.utc().add(4, 'minutes'), status: 'scheduled' });
                server.create('setting', { activeTimezone: 'Europe/Dublin' });
                clock.restore();

                visit('/editor/1');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/editor/1');
                    (0, _chai.expect)(find('input[name="post-setting-date"]').val(), 'scheduled date').to.equal(compareDate);
                    // Dropdown menu should be 'Update Post' and 'Unschedule'
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button for scheduled post').to.equal('Update Post');
                    (0, _chai.expect)(find('.post-save-schedule').hasClass('active'), 'highlights the default active button state for a scheduled post').to.be['true'];
                    (0, _chai.expect)(find('.post-save-draft').text().trim(), 'not active option should say \'Unschedule\'').to.equal('Unschedule');
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').hasClass('gh-btn-red'), 'no red button expected').to.be['false'];
                    // expect countdown to show warning, that post will be published in x minutes
                    (0, _chai.expect)(find('.gh-notification.gh-notification-schedule').text().trim(), 'notification countdown').to.contain('Post will be published in');
                });
            });

            (0, _mocha.it)('only shows option to unschedule post 2 minutes before scheduled time', function () {
                var clock = _sinon['default'].useFakeTimers(moment().valueOf());
                server.create('post', { publishedAt: moment.utc().add(2, 'minutes'), status: 'scheduled' });
                server.create('setting', { activeTimezone: 'Europe/Dublin' });
                clock.restore();

                visit('/editor/1');

                andThen(function () {
                    // Save button should say 'Unschedule'
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button for scheduled post in status freeze mode').to.equal('Unschedule');
                    // expect countdown to show warning, that post will be published in x minutes
                    (0, _chai.expect)(find('.gh-notification.gh-notification-schedule').text().trim(), 'notification countdown').to.contain('Post will be published in');
                    // no dropdown menu
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.dropdown-toggle').hasClass('active'), 'no dropdown menu').to.be['false'];
                });
            });

            _mocha.it.skip('lets user unschedule the post shortly before scheduled date', function () {
                var clock = _sinon['default'].useFakeTimers(moment().valueOf());
                server.create('post', { publishedAt: moment.utc().add(1, 'minute'), status: 'scheduled' });
                server.create('setting', { activeTimezone: 'Europe/Dublin' });
                clock.restore();

                visit('/editor/1');

                // change some text
                fillIn('.markdown-editor', 'Let\'s make some markdown changes');

                andThen(function () {
                    // Save button should say 'Unschedule'
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button for scheduled post in status freeze mode').to.equal('Unschedule');
                    // expect countdown to show warning, that post will be published in x minutes
                    (0, _chai.expect)(find('.gh-notification.gh-notification-schedule').text().trim(), 'notification countdown').to.contain('Post will be published in');
                    // no dropdown menu
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.dropdown-toggle').hasClass('active'), 'no dropdown menu').to.be['false'];
                });

                // click on Unschedule
                click('.gh-btn.gh-btn-sm.js-publish-button');

                andThen(function () {
                    (0, _chai.expect)(find('.markdown-editor').val(), 'changed text in markdown editor').to.equal('Let\'s make some markdown changes');
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').text().trim(), 'text in save button for a draft').to.equal('Save Draft');
                    (0, _chai.expect)(find('.post-save-draft').hasClass('active'), 'highlights the default active button state for a draft post').to.be['true'];
                    (0, _chai.expect)(find('.gh-btn.gh-btn-sm.js-publish-button').hasClass('gh-btn-red'), 'red button expected due to status change').to.be['false'];
                    // expect no countdown notification after unscheduling
                    (0, _chai.expect)(find('.gh-notification.gh-notification-schedule').text().trim(), 'notification countdown').to.equal('');
                });
            });

            (0, _mocha.it)('shows author list and allows switching of author in PSM', function () {
                server.create('post', { authorId: 1 });
                var role = server.create('role', { name: 'Author' });
                var author = server.create('user', { name: 'Waldo', roles: [role] });

                visit('/editor/1');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/editor/1');
                });

                click('button.post-settings');

                andThen(function () {
                    (0, _chai.expect)(find('select[name="post-setting-author"]').val()).to.equal('1');
                    (0, _chai.expect)(find('select[name="post-setting-author"] option[value="2"]')).to.be.ok;
                });

                fillIn('select[name="post-setting-author"]', '2');

                andThen(function () {
                    (0, _chai.expect)(find('select[name="post-setting-author"]').val()).to.equal('2');
                    (0, _chai.expect)(server.db.posts[0].authorId).to.equal(author.id);
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/editor-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/editor-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/ghost-desktop-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth) {

    var originalAgent = window.navigator.userAgent;

    var setUserAgent = function setUserAgent(userAgent) {
        var userAgentProp = {
            get: function get() {
                return userAgent;
            },
            configurable: true
        };

        try {
            Object.defineProperty(window.navigator, 'userAgent', userAgentProp);
        } catch (e) {
            window.navigator = Object.create(window.navigator, {
                userAgent: userAgentProp
            });
        }
    };

    var restoreUserAgent = function restoreUserAgent() {
        setUserAgent(originalAgent);
    };

    (0, _mocha.describe)('Acceptance: Ghost Desktop', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.describe)('update alerts for broken versions', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.afterEach)(function () {
                restoreUserAgent();
            });

            (0, _mocha.it)('displays alert for broken version', function () {
                setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) ghost-desktop/0.4.0 Chrome/51.0.2704.84 Electron/1.2.2 Safari/537.36');

                visit('/');

                andThen(function () {
                    // has an alert with matching text
                    (0, _chai.expect)(find('.gh-alert-yellow').length, 'number of warning alerts').to.equal(1);
                    (0, _chai.expect)(find('.gh-alert-yellow').text().trim(), 'alert text').to.match(/Your version of Ghost Desktop needs to be manually updated/);
                });
            });

            (0, _mocha.it)('doesn\'t display alert for working version', function () {
                setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_5) AppleWebKit/537.36 (KHTML, like Gecko) ghost-desktop/0.5.1 Chrome/51.0.2704.84 Electron/1.2.2 Safari/537.36');

                visit('/');

                andThen(function () {
                    // no alerts
                    (0, _chai.expect)(find('.gh-alert').length, 'number of alerts').to.equal(0);
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/ghost-desktop-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/ghost-desktop-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/password-reset-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp) {

    (0, _mocha.describe)('Acceptance: Password Reset', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.describe)('request reset', function () {
            (0, _mocha.it)('is successful with valid data', function () {
                visit('/signin');
                fillIn('input[name="identification"]', 'test@example.com');
                click('.forgotten-link');

                andThen(function () {
                    // an alert with instructions is displayed
                    (0, _chai.expect)(find('.gh-alert-blue').length, 'alert count').to.equal(1);
                });
            });

            (0, _mocha.it)('shows error messages with invalid data', function () {
                visit('/signin');

                // no email provided
                click('.forgotten-link');

                andThen(function () {
                    // email field is invalid
                    (0, _chai.expect)(find('input[name="identification"]').closest('.form-group').hasClass('error'), 'email field has error class (no email)').to.be['true'];

                    // password field is valid
                    (0, _chai.expect)(find('input[name="password"]').closest('.form-group').hasClass('error'), 'password field has error class (no email)').to.be['false'];

                    // error message shown
                    (0, _chai.expect)(find('p.main-error').text().trim(), 'error message').to.equal('We need your email address to reset your password!');
                });

                // invalid email provided
                fillIn('input[name="identification"]', 'test');
                click('.forgotten-link');

                andThen(function () {
                    // email field is invalid
                    (0, _chai.expect)(find('input[name="identification"]').closest('.form-group').hasClass('error'), 'email field has error class (invalid email)').to.be['true'];

                    // password field is valid
                    (0, _chai.expect)(find('input[name="password"]').closest('.form-group').hasClass('error'), 'password field has error class (invalid email)').to.be['false'];

                    // error message
                    (0, _chai.expect)(find('p.main-error').text().trim(), 'error message').to.equal('We need your email address to reset your password!');
                });

                // unknown email provided
                fillIn('input[name="identification"]', 'unknown@example.com');
                click('.forgotten-link');

                andThen(function () {
                    // email field is invalid
                    (0, _chai.expect)(find('input[name="identification"]').closest('.form-group').hasClass('error'), 'email field has error class (unknown email)').to.be['true'];

                    // password field is valid
                    (0, _chai.expect)(find('input[name="password"]').closest('.form-group').hasClass('error'), 'password field has error class (unknown email)').to.be['false'];

                    // error message
                    (0, _chai.expect)(find('p.main-error').text().trim(), 'error message').to.equal('There is no user with that email address.');
                });
            });
        });

        // TODO: add tests for the change password screen
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/password-reset-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/password-reset-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/settings/apps-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth) {

    (0, _mocha.describe)('Acceptance: Settings - Apps', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects to signin when not authenticated', function () {
            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
            visit('/settings/apps');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/signin');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as author', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/apps');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team/test-user');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as editor', function () {
            var role = server.create('role', { name: 'Editor' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/apps');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team');
            });
        });

        (0, _mocha.describe)('when logged in', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('it redirects to Slack when clicking on the grid', function () {
                visit('/settings/apps');

                andThen(function () {
                    // has correct url
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/settings/apps');
                });

                click('#slack-link');

                andThen(function () {
                    // has correct url
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/settings/apps/slack');
                });
            });
            (0, _mocha.it)('it redirects to AMP when clicking on the grid', function () {
                visit('/settings/apps');

                andThen(function () {
                    // has correct url
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/settings/apps');
                });

                click('#amp-link');

                andThen(function () {
                    // has correct url
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/settings/apps/amp');
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/settings/apps-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/settings/apps-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/settings/code-injection-test', ['exports', 'mocha', 'chai', 'jquery', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth', 'ember-test-selectors'], function (exports, _mocha, _chai, _jquery, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth, _emberTestSelectors) {

    (0, _mocha.describe)('Acceptance: Settings - Code-Injection', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects to signin when not authenticated', function () {
            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
            visit('/settings/code-injection');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/signin');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as author', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/code-injection');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team/test-user');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as editor', function () {
            var role = server.create('role', { name: 'Editor' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/code-injection');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team');
            });
        });

        (0, _mocha.describe)('when logged in', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('it renders, loads editors correctly', function () {
                visit('/settings/code-injection');

                andThen(function () {
                    // has correct url
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/settings/code-injection');

                    // has correct page title
                    (0, _chai.expect)(document.title, 'page title').to.equal('Settings - Code injection - Test Blog');

                    // highlights nav menu
                    (0, _chai.expect)((0, _jquery['default'])('.gh-nav-settings-code-injection').hasClass('active'), 'highlights nav menu item').to.be['true'];

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('save-button')).text().trim(), 'save button text').to.equal('Save');

                    (0, _chai.expect)(find('#ghost-head .CodeMirror').length, 'ghost head codemirror element').to.equal(1);
                    (0, _chai.expect)((0, _jquery['default'])('#ghost-head .CodeMirror').hasClass('cm-s-xq-light'), 'ghost head editor theme').to.be['true'];

                    (0, _chai.expect)(find('#ghost-foot .CodeMirror').length, 'ghost head codemirror element').to.equal(1);
                    (0, _chai.expect)((0, _jquery['default'])('#ghost-foot .CodeMirror').hasClass('cm-s-xq-light'), 'ghost head editor theme').to.be['true'];
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/settings/code-injection-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/settings/code-injection-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/settings/design-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth', 'ember-cli-mirage', 'ghost-admin/mirage/config/themes', 'ember-test-selectors'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth, _emberCliMirage, _ghostAdminMirageConfigThemes, _emberTestSelectors) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    (0, _mocha.describe)('Acceptance: Settings - Design', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects to signin when not authenticated', function () {
            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
            visit('/settings/design');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/signin');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as author', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/design');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team/test-user');
            });
        });

        (0, _mocha.describe)('when logged in', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });

                (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('can visit /settings/design', function () {
                visit('/settings/design');

                andThen(function () {
                    (0, _chai.expect)(currentPath()).to.equal('settings.design.index');

                    // fixtures contain two nav items, check for three rows as we
                    // should have one extra that's blank
                    (0, _chai.expect)(find('.gh-blognav-item').length, 'navigation items count').to.equal(3);
                });
            });

            (0, _mocha.it)('saves navigation settings', function () {
                visit('/settings/design');
                fillIn('.gh-blognav-label:first input', 'Test');
                fillIn('.gh-blognav-url:first input', '/test');
                triggerEvent('.gh-blognav-url:first input', 'blur');

                click('.gh-btn-blue');

                andThen(function () {
                    var _server$db$settings$where = server.db.settings.where({ key: 'navigation' });

                    var _server$db$settings$where2 = _slicedToArray(_server$db$settings$where, 1);

                    var navSetting = _server$db$settings$where2[0];

                    (0, _chai.expect)(navSetting.value).to.equal('[{"label":"Test","url":"/test/"},{"label":"About","url":"/about"}]');

                    // don't test against .error directly as it will pick up failed
                    // tests "pre.error" elements
                    (0, _chai.expect)(find('span.error').length, 'error fields count').to.equal(0);
                    (0, _chai.expect)(find('.gh-alert').length, 'alerts count').to.equal(0);
                    (0, _chai.expect)(find('.response:visible').length, 'validation errors count').to.equal(0);
                });
            });

            (0, _mocha.it)('validates new item correctly on save', function () {
                visit('/settings/design');

                click('.gh-btn-blue');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-blognav-item').length, 'number of nav items after saving with blank new item').to.equal(3);
                });

                fillIn('.gh-blognav-label:last input', 'Test');
                fillIn('.gh-blognav-url:last input', 'http://invalid domain/');
                triggerEvent('.gh-blognav-url:last input', 'blur');

                click('.gh-btn-blue');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-blognav-item').length, 'number of nav items after saving with invalid new item').to.equal(3);

                    (0, _chai.expect)(find('.gh-blognav-item:last .error').length, 'number of invalid fields in new item').to.equal(1);
                });
            });

            (0, _mocha.it)('clears unsaved settings when navigating away', function () {
                visit('/settings/design');
                fillIn('.gh-blognav-label:first input', 'Test');
                triggerEvent('.gh-blognav-label:first input', 'blur');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-blognav-label:first input').val()).to.equal('Test');
                });

                visit('/settings/code-injection');
                visit('/settings/design');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-blognav-label:first input').val()).to.equal('Home');
                });
            });

            (0, _mocha.it)('can add and remove items', function (done) {
                visit('/settings/design');

                click('.gh-blognav-add');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-blognav-label:last .response').is(':visible'), 'blank label has validation error').to.be['true'];
                });

                fillIn('.gh-blognav-label:last input', 'New');
                triggerEvent('.gh-blognav-label:last input', 'keypress', {});

                andThen(function () {
                    (0, _chai.expect)(find('.gh-blognav-label:last .response').is(':visible'), 'label validation is visible after typing').to.be['false'];
                });

                fillIn('.gh-blognav-url:last input', '/new');
                triggerEvent('.gh-blognav-url:last input', 'keypress', {});
                triggerEvent('.gh-blognav-url:last input', 'blur');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-blognav-url:last .response').is(':visible'), 'url validation is visible after typing').to.be['false'];

                    (0, _chai.expect)(find('.gh-blognav-url:last input').val()).to.equal(window.location.protocol + '//' + window.location.host + '/new/');
                });

                click('.gh-blognav-add');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-blognav-item').length, 'number of nav items after successful add').to.equal(4);

                    (0, _chai.expect)(find('.gh-blognav-label:last input').val(), 'new item label value after successful add').to.be.blank;

                    (0, _chai.expect)(find('.gh-blognav-url:last input').val(), 'new item url value after successful add').to.equal(window.location.protocol + '//' + window.location.host + '/');

                    (0, _chai.expect)(find('.gh-blognav-item .response:visible').length, 'number or validation errors shown after successful add').to.equal(0);
                });

                click('.gh-blognav-item:first .gh-blognav-delete');

                andThen(function () {
                    (0, _chai.expect)(find('.gh-blognav-item').length, 'number of nav items after successful remove').to.equal(3);
                });

                click('.gh-btn-blue');

                andThen(function () {
                    var _server$db$settings$where3 = server.db.settings.where({ key: 'navigation' });

                    var _server$db$settings$where32 = _slicedToArray(_server$db$settings$where3, 1);

                    var navSetting = _server$db$settings$where32[0];

                    (0, _chai.expect)(navSetting.value).to.equal('[{"label":"About","url":"/about"},{"label":"New","url":"/new/"}]');

                    done();
                });
            });

            (0, _mocha.it)('allows management of themes', function () {
                // lists available themes + active theme is highlighted

                // theme upload
                // - displays modal
                // - validates mime type
                // - validates casper.zip
                // - handles validation errors
                // - handles upload and close
                // - handles upload and activate
                // - displays overwrite warning if theme already exists

                // theme activation
                // - switches theme

                // theme deletion
                // - displays modal
                // - deletes theme and refreshes list

                server.loadFixtures('themes');
                visit('/settings/design');

                // lists available themes (themes are specified in mirage/fixtures/settings)
                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-id')).length, 'shows correct number of themes').to.equal(3);

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-active', 'true') + ' ' + (0, _emberTestSelectors['default'])('theme-title')).text().trim(), 'Blog theme marked as active').to.equal('Blog (default)');
                });

                // theme upload displays modal
                click((0, _emberTestSelectors['default'])('upload-theme-button'));
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal .modal-content:contains("Upload a theme")').length, 'theme upload modal displayed after button click').to.equal(1);
                });

                // cancelling theme upload closes modal
                click('.fullscreen-modal ' + (0, _emberTestSelectors['default'])('close-button'));
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal').length === 0, 'upload theme modal is closed when cancelling').to.be['true'];
                });

                // theme upload validates mime type
                click((0, _emberTestSelectors['default'])('upload-theme-button'));
                fileUpload('.fullscreen-modal input[type="file"]', ['test'], { type: 'text/csv' });
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal .failed').text(), 'validation error is shown for invalid mime type').to.match(/is not supported/);
                });

                // theme upload validates casper.zip
                click((0, _emberTestSelectors['default'])('upload-try-again-button'));
                fileUpload('.fullscreen-modal input[type="file"]', ['test'], { name: 'casper.zip', type: 'application/zip' });
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal .failed').text(), 'validation error is shown when uploading casper.zip').to.match(/default Casper theme cannot be overwritten/);
                });

                // theme upload handles upload errors
                andThen(function () {
                    server.post('/themes/upload/', function () {
                        return new _emberCliMirage['default'].Response(422, {}, {
                            errors: [{
                                message: 'Invalid theme'
                            }]
                        });
                    });
                });
                click((0, _emberTestSelectors['default'])('upload-try-again-button'));
                fileUpload('.fullscreen-modal input[type="file"]', ['test'], { name: 'error.zip', type: 'application/zip' });
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal .failed').text().trim(), 'validation error is passed through from server').to.equal('Invalid theme');

                    // reset to default mirage handlers
                    (0, _ghostAdminMirageConfigThemes['default'])(server);
                });

                // theme upload handles validation errors
                andThen(function () {
                    server.post('/themes/upload/', function () {
                        return new _emberCliMirage['default'].Response(422, {}, {
                            errors: [{
                                message: 'Theme is not compatible or contains errors.',
                                errorType: 'ThemeValidationError',
                                errorDetails: [{
                                    level: 'error',
                                    rule: 'Templates must contain valid Handlebars.',
                                    failures: [{
                                        ref: 'index.hbs',
                                        message: 'The partial index_meta could not be found'
                                    }, {
                                        ref: 'tag.hbs',
                                        message: 'The partial index_meta could not be found'
                                    }]
                                }, {
                                    level: 'error',
                                    rule: 'Assets such as CSS & JS must use the <code>{{asset}}</code> helper',
                                    details: '<p>The listed files should be included using the <code>{{asset}}</code> helper.</p>',
                                    failures: [{
                                        ref: '/assets/javascripts/ui.js'
                                    }]
                                }]
                            }]
                        });
                    });
                });
                click((0, _emberTestSelectors['default'])('upload-try-again-button'));
                fileUpload('.fullscreen-modal input[type="file"]', ['test'], { name: 'bad-theme.zip', type: 'application/zip' });
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal h1').text().trim(), 'modal title after uploading invalid theme').to.equal('Invalid theme');

                    (0, _chai.expect)(find('.theme-validation-errors').text(), 'top-level errors are displayed').to.match(/Templates must contain valid Handlebars/);

                    (0, _chai.expect)(find('.theme-validation-errors').text(), 'top-level errors do not escape HTML').to.match(/The listed files should be included using the {{asset}} helper/);

                    (0, _chai.expect)(find('.theme-validation-errors').text(), 'individual failures are displayed').to.match(/index\.hbs: The partial index_meta could not be found/);

                    // reset to default mirage handlers
                    (0, _ghostAdminMirageConfigThemes['default'])(server);
                });
                click('.fullscreen-modal ' + (0, _emberTestSelectors['default'])('try-again-button'));
                andThen(function () {
                    (0, _chai.expect)(find('.theme-validation-errors').length, '"Try Again" resets form after theme validation error').to.equal(0);

                    (0, _chai.expect)(find('.gh-image-uploader').length, '"Try Again" resets form after theme validation error').to.equal(1);

                    (0, _chai.expect)(find('.fullscreen-modal h1').text().trim(), '"Try Again" resets form after theme validation error').to.equal('Upload a theme');
                });

                // theme upload handles validation warnings
                andThen(function () {
                    server.post('/themes/upload/', function (_ref) {
                        var themes = _ref.themes;

                        var theme = {
                            name: 'blackpalm',
                            'package': {
                                name: 'BlackPalm',
                                version: '1.0.0'
                            }
                        };

                        themes.create(theme);

                        theme.warnings = [{
                            level: 'warning',
                            rule: 'Assets such as CSS & JS must use the <code>{{asset}}</code> helper',
                            details: '<p>The listed files should be included using the <code>{{asset}}</code> helper.  For more information, please see the <a href="http://themes.ghost.org/docs/asset">asset helper documentation</a>.</p>',
                            failures: [{
                                ref: '/assets/dist/img/apple-touch-icon.png'
                            }, {
                                ref: '/assets/dist/img/favicon.ico'
                            }, {
                                ref: '/assets/dist/css/blackpalm.min.css'
                            }, {
                                ref: '/assets/dist/js/blackpalm.min.js'
                            }],
                            code: 'GS030-ASSET-REQ'
                        }];

                        return new _emberCliMirage['default'].Response(200, {}, {
                            themes: [theme]
                        });
                    });
                });
                fileUpload('.fullscreen-modal input[type="file"]', ['test'], { name: 'warning-theme.zip', type: 'application/zip' });
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal h1').text().trim(), 'modal title after uploading theme with warnings').to.equal('Uploaded with warnings');

                    (0, _chai.expect)(find('.theme-validation-errors').text(), 'top-level warnings are displayed').to.match(/The listed files should be included using the {{asset}} helper/);

                    (0, _chai.expect)(find('.theme-validation-errors').text(), 'individual warning failures are displayed').to.match(/\/assets\/dist\/img\/apple-touch-icon\.png/);

                    // reset to default mirage handlers
                    (0, _ghostAdminMirageConfigThemes['default'])(server);
                });
                click('.fullscreen-modal ' + (0, _emberTestSelectors['default'])('close-button'));

                // theme upload handles success then close
                click((0, _emberTestSelectors['default'])('upload-theme-button'));
                fileUpload('.fullscreen-modal input[type="file"]', ['test'], { name: 'theme-1.zip', type: 'application/zip' });

                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal h1').text().trim(), 'modal header after successful upload').to.equal('Upload successful!');

                    (0, _chai.expect)(find('.modal-body').text(), 'modal displays theme name after successful upload').to.match(/"Test 1 - 0\.1" uploaded successfully/);

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-id')).length, 'number of themes in list grows after upload').to.equal(5);

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-active', 'true') + ' ' + (0, _emberTestSelectors['default'])('theme-title')).text().trim(), 'newly uploaded theme is not active').to.equal('Blog (default)');
                });
                click('.fullscreen-modal ' + (0, _emberTestSelectors['default'])('close-button'));

                // theme upload handles success then activate
                click((0, _emberTestSelectors['default'])('upload-theme-button'));
                fileUpload('.fullscreen-modal input[type="file"]', ['test'], { name: 'theme-2.zip', type: 'application/zip' });
                click('.fullscreen-modal ' + (0, _emberTestSelectors['default'])('activate-now-button'));
                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-id')).length, 'number of themes in list grows after upload and activate').to.equal(6);

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-active', 'true') + ' ' + (0, _emberTestSelectors['default'])('theme-title')).text().trim(), 'newly uploaded+activated theme is active').to.equal('Test 2');
                });

                // theme activation switches active theme
                click((0, _emberTestSelectors['default'])('theme-id', 'casper') + ' ' + (0, _emberTestSelectors['default'])('theme-activate-button'));
                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-id', 'test-2') + ' .apps-card-app').hasClass('theme-list-item--active'), 'previously active theme is not active').to.be['false'];

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-id', 'casper') + ' .apps-card-app').hasClass('theme-list-item--active'), 'activated theme is active').to.be['true'];
                });

                // theme activation shows errors
                andThen(function () {
                    server.put('themes/:theme/activate', function () {
                        return new _emberCliMirage['default'].Response(422, {}, {
                            errors: [{
                                message: 'Theme is not compatible or contains errors.',
                                errorType: 'ThemeValidationError',
                                errorDetails: [{
                                    level: 'error',
                                    rule: 'Templates must contain valid Handlebars.',
                                    failures: [{
                                        ref: 'index.hbs',
                                        message: 'The partial index_meta could not be found'
                                    }, {
                                        ref: 'tag.hbs',
                                        message: 'The partial index_meta could not be found'
                                    }]
                                }, {
                                    level: 'error',
                                    rule: 'Assets such as CSS & JS must use the <code>{{asset}}</code> helper',
                                    details: '<p>The listed files should be included using the <code>{{asset}}</code> helper.</p>',
                                    failures: [{
                                        ref: '/assets/javascripts/ui.js'
                                    }]
                                }]
                            }]
                        });
                    });
                });
                click((0, _emberTestSelectors['default'])('theme-id', 'test-2') + ' ' + (0, _emberTestSelectors['default'])('theme-activate-button'));
                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-warnings-modal'))).to.exist;

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-warnings-title')).text().trim(), 'modal title after activating invalid theme').to.equal('Theme activation failed');

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-warnings')).text(), 'top-level errors are displayed in activation errors').to.match(/Templates must contain valid Handlebars/);

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-warnings')).text(), 'top-level errors do not escape HTML in activation errors').to.match(/The listed files should be included using the {{asset}} helper/);

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-warnings')).text(), 'individual failures are displayed in activation errors').to.match(/index\.hbs: The partial index_meta could not be found/);

                    // restore default mirage handlers
                    (0, _ghostAdminMirageConfigThemes['default'])(server);
                });
                click((0, _emberTestSelectors['default'])('modal-close-button'));
                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-warnings-modal'))).to.not.exist;
                });

                // theme activation shows warnings
                andThen(function () {
                    server.put('themes/:theme/activate', function (_ref2, _ref3) {
                        var themes = _ref2.themes;
                        var params = _ref3.params;

                        themes.all().update('active', false);
                        var theme = themes.findBy({ name: params.theme }).update({ active: true });

                        theme.update({ warnings: [{
                                level: 'warning',
                                rule: 'Assets such as CSS & JS must use the <code>{{asset}}</code> helper',
                                details: '<p>The listed files should be included using the <code>{{asset}}</code> helper.  For more information, please see the <a href="http://themes.ghost.org/docs/asset">asset helper documentation</a>.</p>',
                                failures: [{
                                    ref: '/assets/dist/img/apple-touch-icon.png'
                                }, {
                                    ref: '/assets/dist/img/favicon.ico'
                                }, {
                                    ref: '/assets/dist/css/blackpalm.min.css'
                                }, {
                                    ref: '/assets/dist/js/blackpalm.min.js'
                                }],
                                code: 'GS030-ASSET-REQ'
                            }] });

                        return { themes: [theme] };
                    });
                });
                click((0, _emberTestSelectors['default'])('theme-id', 'test-2') + ' ' + (0, _emberTestSelectors['default'])('theme-activate-button'));
                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-warnings-modal'))).to.exist;

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-warnings-title')).text().trim(), 'modal title after activating theme with warnings').to.equal('Theme activated with warnings');

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-warnings')).text(), 'top-level warnings are displayed in activation warnings').to.match(/The listed files should be included using the {{asset}} helper/);

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-warnings')).text(), 'individual warning failures are displayed in activation warnings').to.match(/\/assets\/dist\/img\/apple-touch-icon\.png/);

                    // restore default mirage handlers
                    (0, _ghostAdminMirageConfigThemes['default'])(server);
                });
                click((0, _emberTestSelectors['default'])('modal-close-button'));
                // reactivate casper to continue tests
                click((0, _emberTestSelectors['default'])('theme-id', 'casper') + ' ' + (0, _emberTestSelectors['default'])('theme-activate-button'));

                // theme deletion displays modal
                click((0, _emberTestSelectors['default'])('theme-id', 'test-1') + ' ' + (0, _emberTestSelectors['default'])('theme-delete-button'));
                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('delete-theme-modal')).length, 'theme deletion modal displayed after button click').to.equal(1);
                });

                // cancelling theme deletion closes modal
                click('.fullscreen-modal ' + (0, _emberTestSelectors['default'])('cancel-button'));
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal').length === 0, 'delete theme modal is closed when cancelling').to.be['true'];
                });

                // confirming theme deletion closes modal and refreshes list
                click((0, _emberTestSelectors['default'])('theme-id', 'test-1') + ' ' + (0, _emberTestSelectors['default'])('theme-delete-button'));
                click('.fullscreen-modal ' + (0, _emberTestSelectors['default'])('delete-button'));
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal').length === 0, 'delete theme modal closes after deletion').to.be['true'];
                });

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-id')).length, 'number of themes in list shrinks after delete').to.equal(5);

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('theme-title')).text(), 'correct theme is removed from theme list after deletion').to.not.match(/Test 1/);
                });

                // validation errors are handled when deleting a theme
                andThen(function () {
                    server.del('/themes/:theme/', function () {
                        return new _emberCliMirage['default'].Response(422, {}, {
                            errors: [{
                                message: 'Can\'t delete theme'
                            }]
                        });
                    });
                });
                click((0, _emberTestSelectors['default'])('theme-id', 'test-2') + ' ' + (0, _emberTestSelectors['default'])('theme-delete-button'));
                click('.fullscreen-modal ' + (0, _emberTestSelectors['default'])('delete-button'));
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal').length === 0, 'delete theme modal closes after failed deletion').to.be['true'];

                    (0, _chai.expect)(find('.gh-alert').length, 'alert is shown when deletion fails').to.equal(1);

                    (0, _chai.expect)(find('.gh-alert').text(), 'failed deletion alert has correct text').to.match(/Can't delete theme/);

                    // restore default mirage handlers
                    (0, _ghostAdminMirageConfigThemes['default'])(server);
                });
            });
        });
    });
});
/* jshint expr:true */
/* eslint-disable camelcase */
define('ghost-admin/tests/acceptance/settings/design-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/settings/design-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/settings/general-test', ['exports', 'mocha', 'chai', 'ember-test-selectors', 'jquery', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth'], function (exports, _mocha, _chai, _emberTestSelectors, _jquery, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth) {

    (0, _mocha.describe)('Acceptance: Settings - General', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects to signin when not authenticated', function () {
            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
            visit('/settings/general');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/signin');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as author', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/general');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team/test-user');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as editor', function () {
            var role = server.create('role', { name: 'Editor' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/general');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team');
            });
        });

        (0, _mocha.describe)('when logged in', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('it renders, shows image uploader modals', function () {
                visit('/settings/general');

                andThen(function () {
                    // has correct url
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/settings/general');

                    // has correct page title
                    (0, _chai.expect)(document.title, 'page title').to.equal('Settings - General - Test Blog');

                    // highlights nav menu
                    (0, _chai.expect)((0, _jquery['default'])('.gh-nav-settings-general').hasClass('active'), 'highlights nav menu item').to.be['true'];

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('save-button')).text().trim(), 'save button text').to.equal('Save settings');

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('dated-permalinks-checkbox')).prop('checked'), 'date permalinks checkbox').to.be['false'];
                });

                click((0, _emberTestSelectors['default'])('toggle-pub-info'));
                fillIn((0, _emberTestSelectors['default'])('title-input'), 'New Blog Title');
                click((0, _emberTestSelectors['default'])('save-button'));

                andThen(function () {
                    (0, _chai.expect)(document.title, 'page title').to.equal('Settings - General - New Blog Title');
                });

                click('.blog-logo');

                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal .modal-content .gh-image-uploader').length, 'modal selector').to.equal(1);
                });

                click('.fullscreen-modal .modal-content .gh-image-uploader .image-cancel');

                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal .modal-content .gh-image-uploader .description').text()).to.equal('Upload an image');
                });

                // click cancel button
                click('.fullscreen-modal .modal-footer .gh-btn');

                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal').length).to.equal(0);
                });

                click('.blog-icon');

                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal .modal-content .gh-image-uploader').length, 'modal selector').to.equal(1);
                });

                click('.fullscreen-modal .modal-content .gh-image-uploader .image-cancel');

                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal .modal-content .gh-image-uploader .description').text()).to.equal('Upload an image');
                });

                // click cancel button
                click('.fullscreen-modal .modal-footer .gh-btn');

                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal').length).to.equal(0);
                });

                click('.blog-cover');

                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal .modal-content .gh-image-uploader').length, 'modal selector').to.equal(1);
                });

                click((0, _emberTestSelectors['default'])('modal-accept-button'));

                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal').length).to.equal(0);
                });
            });

            (0, _mocha.it)('renders timezone selector correctly', function () {
                visit('/settings/general');
                click((0, _emberTestSelectors['default'])('toggle-timezone'));

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/settings/general');

                    (0, _chai.expect)(find('#activeTimezone option').length, 'available timezones').to.equal(66);
                    (0, _chai.expect)(find('#activeTimezone option:selected').text().trim()).to.equal('(GMT) UTC');
                    find('#activeTimezone option[value="Africa/Cairo"]').prop('selected', true);
                });

                triggerEvent('#activeTimezone', 'change');
                click((0, _emberTestSelectors['default'])('save-button'));

                andThen(function () {
                    (0, _chai.expect)(find('#activeTimezone option:selected').text().trim()).to.equal('(GMT +2:00) Cairo, Egypt');
                });
            });

            (0, _mocha.it)('handles private blog settings correctly', function () {
                visit('/settings/general');

                // handles private blog settings correctly
                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('private-checkbox')).prop('checked'), 'isPrivate checkbox').to.be['false'];
                });

                click((0, _emberTestSelectors['default'])('private-checkbox'));

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('private-checkbox')).prop('checked'), 'isPrivate checkbox').to.be['true'];
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('password-input')).length, 'password input').to.equal(1);
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('password-input')).val(), 'password default value').to.not.equal('');
                });

                fillIn((0, _emberTestSelectors['default'])('password-input'), '');
                triggerEvent((0, _emberTestSelectors['default'])('password-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('password-error')).text().trim(), 'empty password error').to.equal('Password must be supplied');
                });

                fillIn((0, _emberTestSelectors['default'])('password-input'), 'asdfg');
                triggerEvent((0, _emberTestSelectors['default'])('password-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('password-error')).text().trim(), 'present password error').to.equal('');
                });
            });

            (0, _mocha.it)('handles social blog settings correctly', function () {
                visit('/settings/general');
                click((0, _emberTestSelectors['default'])('toggle-social'));

                // validates a facebook url correctly
                andThen(function () {
                    // loads fixtures and performs transform
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-input')).val(), 'initial facebook value').to.equal('https://www.facebook.com/test');
                });

                triggerEvent((0, _emberTestSelectors['default'])('facebook-input'), 'focus');
                triggerEvent((0, _emberTestSelectors['default'])('facebook-input'), 'blur');

                andThen(function () {
                    // regression test: we still have a value after the input is
                    // focused and then blurred without any changes
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-input')).val(), 'facebook value after blur with no change').to.equal('https://www.facebook.com/test');
                });

                fillIn((0, _emberTestSelectors['default'])('facebook-input'), 'facebook.com/username');
                triggerEvent((0, _emberTestSelectors['default'])('facebook-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-input')).val()).to.be.equal('https://www.facebook.com/username');
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-error')).text().trim(), 'inline validation response').to.equal('');
                });

                fillIn((0, _emberTestSelectors['default'])('facebook-input'), 'facebook.com/pages/some-facebook-page/857469375913?ref=ts');
                triggerEvent((0, _emberTestSelectors['default'])('facebook-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-input')).val()).to.be.equal('https://www.facebook.com/pages/some-facebook-page/857469375913?ref=ts');
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-error')).text().trim(), 'inline validation response').to.equal('');
                });

                fillIn((0, _emberTestSelectors['default'])('facebook-input'), '*(&*(%%))');
                triggerEvent((0, _emberTestSelectors['default'])('facebook-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-error')).text().trim(), 'inline validation response').to.equal('The URL must be in a format like https://www.facebook.com/yourPage');
                });

                fillIn((0, _emberTestSelectors['default'])('facebook-input'), 'http://github.com/username');
                triggerEvent((0, _emberTestSelectors['default'])('facebook-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-input')).val()).to.be.equal('https://www.facebook.com/username');
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-error')).text().trim(), 'inline validation response').to.equal('');
                });

                fillIn((0, _emberTestSelectors['default'])('facebook-input'), 'http://github.com/pages/username');
                triggerEvent((0, _emberTestSelectors['default'])('facebook-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-input')).val()).to.be.equal('https://www.facebook.com/pages/username');
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-error')).text().trim(), 'inline validation response').to.equal('');
                });

                fillIn((0, _emberTestSelectors['default'])('facebook-input'), 'testuser');
                triggerEvent((0, _emberTestSelectors['default'])('facebook-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-input')).val()).to.be.equal('https://www.facebook.com/testuser');
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-error')).text().trim(), 'inline validation response').to.equal('');
                });

                fillIn((0, _emberTestSelectors['default'])('facebook-input'), 'ab99');
                triggerEvent((0, _emberTestSelectors['default'])('facebook-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-error')).text().trim(), 'inline validation response').to.equal('Your Page name is not a valid Facebook Page name');
                });

                fillIn((0, _emberTestSelectors['default'])('facebook-input'), 'page/ab99');
                triggerEvent((0, _emberTestSelectors['default'])('facebook-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-input')).val()).to.be.equal('https://www.facebook.com/page/ab99');
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-error')).text().trim(), 'inline validation response').to.equal('');
                });

                fillIn((0, _emberTestSelectors['default'])('facebook-input'), 'page/*(&*(%%))');
                triggerEvent((0, _emberTestSelectors['default'])('facebook-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-input')).val()).to.be.equal('https://www.facebook.com/page/*(&*(%%))');
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('facebook-error')).text().trim(), 'inline validation response').to.equal('');
                });

                // validates a twitter url correctly

                andThen(function () {
                    // loads fixtures and performs transform
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('twitter-input')).val(), 'initial twitter value').to.equal('https://twitter.com/test');
                });

                triggerEvent((0, _emberTestSelectors['default'])('twitter-input'), 'focus');
                triggerEvent((0, _emberTestSelectors['default'])('twitter-input'), 'blur');

                andThen(function () {
                    // regression test: we still have a value after the input is
                    // focused and then blurred without any changes
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('twitter-input')).val(), 'twitter value after blur with no change').to.equal('https://twitter.com/test');
                });

                fillIn((0, _emberTestSelectors['default'])('twitter-input'), 'twitter.com/username');
                triggerEvent((0, _emberTestSelectors['default'])('twitter-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('twitter-input')).val()).to.be.equal('https://twitter.com/username');
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('twitter-error')).text().trim(), 'inline validation response').to.equal('');
                });

                fillIn((0, _emberTestSelectors['default'])('twitter-input'), '*(&*(%%))');
                triggerEvent((0, _emberTestSelectors['default'])('twitter-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('twitter-error')).text().trim(), 'inline validation response').to.equal('The URL must be in a format like https://twitter.com/yourUsername');
                });

                fillIn((0, _emberTestSelectors['default'])('twitter-input'), 'http://github.com/username');
                triggerEvent((0, _emberTestSelectors['default'])('twitter-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('twitter-input')).val()).to.be.equal('https://twitter.com/username');
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('twitter-error')).text().trim(), 'inline validation response').to.equal('');
                });

                fillIn((0, _emberTestSelectors['default'])('twitter-input'), 'thisusernamehasmorethan15characters');
                triggerEvent((0, _emberTestSelectors['default'])('twitter-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('twitter-error')).text().trim(), 'inline validation response').to.equal('Your Username is not a valid Twitter Username');
                });

                fillIn((0, _emberTestSelectors['default'])('twitter-input'), 'testuser');
                triggerEvent((0, _emberTestSelectors['default'])('twitter-input'), 'blur');

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('twitter-input')).val()).to.be.equal('https://twitter.com/testuser');
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('twitter-error')).text().trim(), 'inline validation response').to.equal('');
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/settings/general-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/settings/general-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/settings/labs-test', ['exports', 'mocha', 'chai', 'jquery', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth'], function (exports, _mocha, _chai, _jquery, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth) {

    (0, _mocha.describe)('Acceptance: Settings - Labs', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects to signin when not authenticated', function () {
            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
            visit('/settings/labs');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/signin');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as author', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/labs');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team/test-user');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as editor', function () {
            var role = server.create('role', { name: 'Editor' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/labs');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team');
            });
        });

        (0, _mocha.describe)('when logged in', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            _mocha.it.skip('it renders, loads modals correctly', function () {
                visit('/settings/labs');

                andThen(function () {
                    // has correct url
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/settings/labs');

                    // has correct page title
                    (0, _chai.expect)(document.title, 'page title').to.equal('Settings - Labs - Test Blog');

                    // highlights nav menu
                    (0, _chai.expect)((0, _jquery['default'])('.gh-nav-settings-labs').hasClass('active'), 'highlights nav menu item').to.be['true'];
                });

                click('#settings-resetdb .js-delete');

                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal .modal-content').length, 'modal element').to.equal(1);
                });

                click('.fullscreen-modal .modal-footer .gh-btn');

                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal').length, 'modal element').to.equal(0);
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/settings/labs-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/settings/labs-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/settings/slack-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ember-cli-mirage', 'ghost-admin/tests/helpers/ember-simple-auth', 'ember-test-selectors'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _emberCliMirage, _ghostAdminTestsHelpersEmberSimpleAuth, _emberTestSelectors) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    (0, _mocha.describe)('Acceptance: Settings - Apps - Slack', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects to signin when not authenticated', function () {
            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
            visit('/settings/apps/slack');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/signin');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as author', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/apps/slack');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team/test-user');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as editor', function () {
            var role = server.create('role', { name: 'Editor' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/apps/slack');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team');
            });
        });

        (0, _mocha.describe)('when logged in', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('it validates and saves a slack url properly', function () {
                visit('/settings/apps/slack');

                andThen(function () {
                    // has correct url
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/settings/apps/slack');
                });

                fillIn('#slack-settings input[name="slack[url]"]', 'notacorrecturl');
                click((0, _emberTestSelectors['default'])('save-button'));

                andThen(function () {
                    (0, _chai.expect)(find('#slack-settings .error .response').text().trim(), 'inline validation response').to.equal('The URL must be in a format like https://hooks.slack.com/services/<your personal key>');
                });

                fillIn('#slack-settings input[name="slack[url]"]', 'https://hooks.slack.com/services/1275958430');
                click((0, _emberTestSelectors['default'])('send-notification-button'));

                andThen(function () {
                    (0, _chai.expect)(find('.gh-alert-blue').length, 'modal element').to.equal(1);
                    (0, _chai.expect)(find('#slack-settings .error .response').text().trim(), 'inline validation response').to.equal('');
                });

                andThen(function () {
                    server.put('/settings/', function () {
                        return new _emberCliMirage['default'].Response(422, {}, {
                            errors: [{
                                errorType: 'ValidationError',
                                message: 'Test error'
                            }]
                        });
                    });
                });

                click('.gh-alert-blue .gh-alert-close');
                click((0, _emberTestSelectors['default'])('send-notification-button'));

                // we shouldn't try to send the test request if the save fails
                andThen(function () {
                    var _server$pretender$handledRequests$slice = server.pretender.handledRequests.slice(-1);

                    var _server$pretender$handledRequests$slice2 = _slicedToArray(_server$pretender$handledRequests$slice, 1);

                    var lastRequest = _server$pretender$handledRequests$slice2[0];

                    (0, _chai.expect)(lastRequest.url).to.not.match(/\/slack\/test/);
                    (0, _chai.expect)(find('.gh-alert-blue').length, 'check slack alert after api validation error').to.equal(0);
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/settings/slack-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/settings/slack-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/settings/tags-test', ['exports', 'mocha', 'chai', 'jquery', 'ember-runloop', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth', 'ghost-admin/tests/helpers/adapter-error', 'ember-cli-mirage'], function (exports, _mocha, _chai, _jquery, _emberRunloop, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth, _ghostAdminTestsHelpersAdapterError, _emberCliMirage) {

    // Grabbed from keymaster's testing code because Ember's `keyEvent` helper
    // is for some reason not triggering the events in a way that keymaster detects:
    // https://github.com/madrobby/keymaster/blob/master/test/keymaster.html#L31
    var modifierMap = {
        16: 'shiftKey',
        18: 'altKey',
        17: 'ctrlKey',
        91: 'metaKey'
    };
    var keydown = function keydown(code, modifiers, el) {
        var event = document.createEvent('Event');
        event.initEvent('keydown', true, true);
        event.keyCode = code;
        if (modifiers && modifiers.length > 0) {
            for (var i in modifiers) {
                event[modifierMap[modifiers[i]]] = true;
            }
        }
        (el || document).dispatchEvent(event);
    };
    var keyup = function keyup(code, el) {
        var event = document.createEvent('Event');
        event.initEvent('keyup', true, true);
        event.keyCode = code;
        (el || document).dispatchEvent(event);
    };

    (0, _mocha.describe)('Acceptance: Settings - Tags', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects to signin when not authenticated', function () {
            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
            visit('/settings/tags');

            andThen(function () {
                (0, _chai.expect)(currentURL()).to.equal('/signin');
            });
        });

        (0, _mocha.it)('redirects to team page when authenticated as author', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/settings/design');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team/test-user');
            });
        });

        (0, _mocha.describe)('when logged in', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('it renders, can be navigated, can edit, create & delete tags', function () {
                var tag1 = server.create('tag');
                var tag2 = server.create('tag');

                visit('/settings/tags');

                andThen(function () {
                    // it redirects to first tag
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/settings/tags/' + tag1.slug);

                    // it has correct page title
                    (0, _chai.expect)(document.title, 'page title').to.equal('Settings - Tags - Test Blog');

                    // it highlights nav menu
                    (0, _chai.expect)((0, _jquery['default'])('.gh-nav-settings-tags').hasClass('active'), 'highlights nav menu item').to.be['true'];

                    // it lists all tags
                    (0, _chai.expect)(find('.settings-tags .settings-tag').length, 'tag list count').to.equal(2);
                    (0, _chai.expect)(find('.settings-tags .settings-tag:first .tag-title').text(), 'tag list item title').to.equal(tag1.name);

                    // it highlights selected tag
                    (0, _chai.expect)(find('a[href="/ghost/settings/tags/' + tag1.slug + '"]').hasClass('active'), 'highlights selected tag').to.be['true'];

                    // it shows selected tag form
                    (0, _chai.expect)(find('.tag-settings-pane h4').text(), 'settings pane title').to.equal('Tag Settings');
                    (0, _chai.expect)(find('.tag-settings-pane input[name="name"]').val(), 'loads correct tag into form').to.equal(tag1.name);
                });

                // click the second tag in the list
                click('.tag-edit-button:last');

                andThen(function () {
                    // it navigates to selected tag
                    (0, _chai.expect)(currentURL(), 'url after clicking tag').to.equal('/settings/tags/' + tag2.slug);

                    // it highlights selected tag
                    (0, _chai.expect)(find('a[href="/ghost/settings/tags/' + tag2.slug + '"]').hasClass('active'), 'highlights selected tag').to.be['true'];

                    // it shows selected tag form
                    (0, _chai.expect)(find('.tag-settings-pane input[name="name"]').val(), 'loads correct tag into form').to.equal(tag2.name);
                });

                andThen(function () {
                    // simulate up arrow press
                    (0, _emberRunloop['default'])(function () {
                        keydown(38);
                        keyup(38);
                    });
                });

                andThen(function () {
                    // it navigates to previous tag
                    (0, _chai.expect)(currentURL(), 'url after keyboard up arrow').to.equal('/settings/tags/' + tag1.slug);

                    // it highlights selected tag
                    (0, _chai.expect)(find('a[href="/ghost/settings/tags/' + tag1.slug + '"]').hasClass('active'), 'selects previous tag').to.be['true'];
                });

                andThen(function () {
                    // simulate down arrow press
                    (0, _emberRunloop['default'])(function () {
                        keydown(40);
                        keyup(40);
                    });
                });

                andThen(function () {
                    // it navigates to previous tag
                    (0, _chai.expect)(currentURL(), 'url after keyboard down arrow').to.equal('/settings/tags/' + tag2.slug);

                    // it highlights selected tag
                    (0, _chai.expect)(find('a[href="/ghost/settings/tags/' + tag2.slug + '"]').hasClass('active'), 'selects next tag').to.be['true'];
                });

                // trigger save
                fillIn('.tag-settings-pane input[name="name"]', 'New Name');
                triggerEvent('.tag-settings-pane input[name="name"]', 'blur');
                andThen(function () {
                    // check we update with the data returned from the server
                    (0, _chai.expect)(find('.settings-tags .settings-tag:last .tag-title').text(), 'tag list updates on save').to.equal('New Name');
                    (0, _chai.expect)(find('.tag-settings-pane input[name="name"]').val(), 'settings form updates on save').to.equal('New Name');
                });

                // start new tag
                click('.view-actions .gh-btn-green');

                andThen(function () {
                    // it navigates to the new tag route
                    (0, _chai.expect)(currentURL(), 'new tag URL').to.equal('/settings/tags/new');

                    // it displays the new tag form
                    (0, _chai.expect)(find('.tag-settings-pane h4').text(), 'settings pane title').to.equal('New Tag');

                    // all fields start blank
                    find('.tag-settings-pane input, .tag-settings-pane textarea').each(function () {
                        (0, _chai.expect)((0, _jquery['default'])(this).val(), 'input field for ' + (0, _jquery['default'])(this).attr('name')).to.be.blank;
                    });
                });

                // save new tag
                fillIn('.tag-settings-pane input[name="name"]', 'New Tag');
                triggerEvent('.tag-settings-pane input[name="name"]', 'blur');

                andThen(function () {
                    // it redirects to the new tag's URL
                    (0, _chai.expect)(currentURL(), 'URL after tag creation').to.equal('/settings/tags/new-tag');

                    // it adds the tag to the list and selects
                    (0, _chai.expect)(find('.settings-tags .settings-tag').length, 'tag list count after creation').to.equal(3);
                    (0, _chai.expect)(find('.settings-tags .settings-tag:last .tag-title').text(), 'new tag list item title').to.equal('New Tag');
                    (0, _chai.expect)(find('a[href="/ghost/settings/tags/new-tag"]').hasClass('active'), 'highlights new tag').to.be['true'];
                });

                // delete tag
                click('.tag-delete-button');
                click('.fullscreen-modal .gh-btn-red');

                andThen(function () {
                    // it redirects to the first tag
                    (0, _chai.expect)(currentURL(), 'URL after tag deletion').to.equal('/settings/tags/' + tag1.slug);

                    // it removes the tag from the list
                    (0, _chai.expect)(find('.settings-tags .settings-tag').length, 'tag list count after deletion').to.equal(2);
                });
            });

            (0, _mocha.it)('loads tag via slug when accessed directly', function () {
                server.createList('tag', 2);

                visit('/settings/tags/tag-1');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'URL after direct load').to.equal('/settings/tags/tag-1');

                    // it loads all other tags
                    (0, _chai.expect)(find('.settings-tags .settings-tag').length, 'tag list count after direct load').to.equal(2);

                    // selects tag in list
                    (0, _chai.expect)(find('a[href="/ghost/settings/tags/tag-1"]').hasClass('active'), 'highlights requested tag').to.be['true'];

                    // shows requested tag in settings pane
                    (0, _chai.expect)(find('.tag-settings-pane input[name="name"]').val(), 'loads correct tag into form').to.equal('Tag 1');
                });
            });

            (0, _mocha.it)('has infinite scroll pagination of tags list', function () {
                server.createList('tag', 32);

                visit('settings/tags/tag-0');

                andThen(function () {
                    // it loads first page
                    (0, _chai.expect)(find('.settings-tags .settings-tag').length, 'tag list count on first load').to.equal(15);

                    find('.tag-list').scrollTop(find('.tag-list-content').height());
                });

                triggerEvent('.tag-list', 'scroll');

                andThen(function () {
                    // it loads the second page
                    (0, _chai.expect)(find('.settings-tags .settings-tag').length, 'tag list count on second load').to.equal(30);

                    find('.tag-list').scrollTop(find('.tag-list-content').height());
                });

                // NOTE: FF has issues with scrolling further in acceptance tests
                // but works fine outside of tests
                //
                // triggerEvent('.tag-list', 'scroll');
                //
                // andThen(() => {
                //     // it loads the final page
                //     expect(find('.settings-tags .settings-tag').length, 'tag list count on third load')
                //         .to.equal(32);
                // });
            });

            (0, _mocha.it)('shows the internal tag label', function () {
                server.create('tag', { name: '#internal-tag', slug: 'hash-internal-tag', visibility: 'internal' });

                visit('settings/tags/');

                andThen(function () {
                    (0, _chai.expect)(currentURL()).to.equal('/settings/tags/hash-internal-tag');

                    (0, _chai.expect)(find('.settings-tags .settings-tag').length, 'tag list count').to.equal(1);

                    (0, _chai.expect)(find('.settings-tags .settings-tag:first .label.label-blue').length, 'internal tag label').to.equal(1);

                    (0, _chai.expect)(find('.settings-tags .settings-tag:first .label.label-blue').text().trim(), 'internal tag label text').to.equal('internal');
                });
            });

            (0, _mocha.it)('redirects to 404 when tag does not exist', function () {
                server.get('/tags/slug/unknown/', function () {
                    return new _emberCliMirage.Response(404, { 'Content-Type': 'application/json' }, { errors: [{ message: 'Tag not found.', errorType: 'NotFoundError' }] });
                });

                (0, _ghostAdminTestsHelpersAdapterError.errorOverride)();

                visit('settings/tags/unknown');

                andThen(function () {
                    (0, _ghostAdminTestsHelpersAdapterError.errorReset)();
                    (0, _chai.expect)(currentPath()).to.equal('error404');
                    (0, _chai.expect)(currentURL()).to.equal('/settings/tags/unknown');
                });
            });
        });
    });
});
/* jshint expr:true */
/* eslint-disable camelcase */
define('ghost-admin/tests/acceptance/settings/tags-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/settings/tags-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/setup-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth', 'ghost-admin/tests/helpers/configuration', 'ember-cli-mirage', 'ghost-admin/tests/helpers/oauth'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth, _ghostAdminTestsHelpersConfiguration, _emberCliMirage, _ghostAdminTestsHelpersOauth) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    (0, _mocha.describe)('Acceptance: Setup', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects if already authenticated', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);

            visit('/setup/one');
            andThen(function () {
                (0, _chai.expect)(currentURL()).to.equal('/');
            });

            visit('/setup/two');
            andThen(function () {
                (0, _chai.expect)(currentURL()).to.equal('/');
            });

            visit('/setup/three');
            andThen(function () {
                (0, _chai.expect)(currentURL()).to.equal('/');
            });
        });

        (0, _mocha.it)('redirects to signin if already set up', function () {
            // mimick an already setup blog
            server.get('/authentication/setup/', function () {
                return {
                    setup: [{ status: true }]
                };
            });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);

            visit('/setup');
            andThen(function () {
                (0, _chai.expect)(currentURL()).to.equal('/signin');
            });
        });

        (0, _mocha.describe)('with a new blog', function () {
            (0, _mocha.beforeEach)(function () {
                // mimick a new blog
                server.get('/authentication/setup/', function () {
                    return {
                        setup: [{ status: false }]
                    };
                });
            });

            (0, _mocha.it)('has a successful happy path', function () {
                (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
                server.loadFixtures('roles');

                visit('/setup');

                andThen(function () {
                    // it redirects to step one
                    (0, _chai.expect)(currentURL(), 'url after accessing /setup').to.equal('/setup/one');

                    // it highlights first step
                    (0, _chai.expect)(find('.gh-flow-nav .step:first-of-type').hasClass('active')).to.be['true'];
                    (0, _chai.expect)(find('.gh-flow-nav .step:nth-of-type(2)').hasClass('active')).to.be['false'];
                    (0, _chai.expect)(find('.gh-flow-nav .step:nth-of-type(3)').hasClass('active')).to.be['false'];

                    // it displays download count (count increments for each ajax call
                    // and polling is disabled in testing so our count should be "2" -
                    // 1 for first load and 1 for first poll)
                    (0, _chai.expect)(find('.gh-flow-content em').text()).to.equal('2');
                });

                click('.gh-btn-green');

                andThen(function () {
                    // it transitions to step two
                    (0, _chai.expect)(currentURL(), 'url after clicking "Create your account"').to.equal('/setup/two');

                    // email field is focused by default
                    // NOTE: $('x').is(':focus') doesn't work in phantomjs CLI runner
                    // https://github.com/ariya/phantomjs/issues/10427
                    (0, _chai.expect)(find('[name="email"]').get(0) === document.activeElement, 'email field has focus').to.be['true'];
                });

                click('.gh-btn-green');

                andThen(function () {
                    // it marks fields as invalid
                    (0, _chai.expect)(find('.form-group.error').length, 'number of invalid fields').to.equal(4);

                    // it displays error messages
                    (0, _chai.expect)(find('.error .response').length, 'number of in-line validation messages').to.equal(4);

                    // it displays main error
                    (0, _chai.expect)(find('.main-error').length, 'main error is displayed').to.equal(1);
                });

                // enter valid details and submit
                fillIn('[name="email"]', 'test@example.com');
                fillIn('[name="name"]', 'Test User');
                fillIn('[name="password"]', 'password');
                fillIn('[name="blog-title"]', 'Blog Title');
                click('.gh-btn-green');

                andThen(function () {
                    // it transitions to step 3
                    (0, _chai.expect)(currentURL(), 'url after submitting step two').to.equal('/setup/three');

                    // submit button is "disabled"
                    (0, _chai.expect)(find('button[type="submit"]').hasClass('gh-btn-green'), 'invite button with no emails is white').to.be['false'];
                });

                // fill in a valid email
                fillIn('[name="users"]', 'new-user@example.com');

                andThen(function () {
                    // submit button is "enabled"
                    (0, _chai.expect)(find('button[type="submit"]').hasClass('gh-btn-green'), 'invite button is green with valid email address').to.be['true'];
                });

                // submit the invite form
                click('button[type="submit"]');

                andThen(function () {
                    // it redirects to the home / "content" screen
                    (0, _chai.expect)(currentURL(), 'url after submitting invites').to.equal('/');

                    // it displays success alert
                    (0, _chai.expect)(find('.gh-alert-green').length, 'number of success alerts').to.equal(1);
                });
            });

            (0, _mocha.it)('handles validation errors in step 2', function () {
                var postCount = 0;

                (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
                server.loadFixtures('roles');

                server.post('/authentication/setup', function () {
                    postCount++;

                    // validation error
                    if (postCount === 1) {
                        return new _emberCliMirage.Response(422, {}, {
                            errors: [{
                                errorType: 'ValidationError',
                                message: 'Server response message'
                            }]
                        });
                    }

                    // server error
                    if (postCount === 2) {
                        return new _emberCliMirage.Response(500, {}, null);
                    }
                });

                visit('/setup/two');
                click('.gh-btn-green');

                andThen(function () {
                    // non-server validation
                    (0, _chai.expect)(find('.main-error').text().trim(), 'error text').to.not.be.blank;
                });

                fillIn('[name="email"]', 'test@example.com');
                fillIn('[name="name"]', 'Test User');
                fillIn('[name="password"]', 'password');
                fillIn('[name="blog-title"]', 'Blog Title');

                // first post - simulated validation error
                click('.gh-btn-green');

                andThen(function () {
                    (0, _chai.expect)(find('.main-error').text().trim(), 'error text').to.equal('Server response message');
                });

                // second post - simulated server error
                click('.gh-btn-green');

                andThen(function () {
                    (0, _chai.expect)(find('.main-error').text().trim(), 'error text').to.be.blank;

                    (0, _chai.expect)(find('.gh-alert-red').length, 'number of alerts').to.equal(1);
                });
            });

            (0, _mocha.it)('handles invalid origin error on step 2', function () {
                // mimick the API response for an invalid origin
                server.post('/authentication/token', function () {
                    return new _emberCliMirage.Response(401, {}, {
                        errors: [{
                            errorType: 'UnauthorizedError',
                            message: 'Access Denied from url: unknown.com. Please use the url configured in config.js.'
                        }]
                    });
                });

                (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
                server.loadFixtures('roles');

                visit('/setup/two');
                fillIn('[name="email"]', 'test@example.com');
                fillIn('[name="name"]', 'Test User');
                fillIn('[name="password"]', 'password');
                fillIn('[name="blog-title"]', 'Blog Title');
                click('.gh-btn-green');

                andThen(function () {
                    // button should not be spinning
                    (0, _chai.expect)(find('.gh-btn-green .spinner').length, 'button has spinner').to.equal(0);
                    // we should show an error message
                    (0, _chai.expect)(find('.main-error').text(), 'error text').to.equal('Access Denied from url: unknown.com. Please use the url configured in config.js.');
                });
            });

            (0, _mocha.it)('handles validation errors in step 3', function () {
                var input = '[name="users"]';
                var postCount = 0;
                var button = undefined,
                    formGroup = undefined;

                (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
                server.loadFixtures('roles');

                server.post('/invites', function (_ref, request) {
                    var invites = _ref.invites;

                    var _JSON$parse$invites = _slicedToArray(JSON.parse(request.requestBody).invites, 1);

                    var params = _JSON$parse$invites[0];

                    postCount++;

                    // invalid
                    if (postCount === 1) {
                        return new _emberCliMirage.Response(422, {}, {
                            errors: [{
                                errorType: 'ValidationError',
                                message: 'Dummy validation error'
                            }]
                        });
                    }

                    // TODO: duplicated from mirage/config/invites - extract method?
                    /* eslint-disable camelcase */
                    params.token = invites.all().models.length + '-token';
                    params.expires = moment.utc().add(1, 'day').valueOf();
                    params.created_at = moment.utc().format();
                    params.created_by = 1;
                    params.updated_at = moment.utc().format();
                    params.updated_by = 1;
                    params.status = 'sent';
                    /* eslint-enable camelcase */

                    return invites.create(params);
                });

                // complete step 2 so we can access step 3
                visit('/setup/two');
                fillIn('[name="email"]', 'test@example.com');
                fillIn('[name="name"]', 'Test User');
                fillIn('[name="password"]', 'password');
                fillIn('[name="blog-title"]', 'Blog Title');
                click('.gh-btn-green');

                // default field/button state
                andThen(function () {
                    formGroup = find('.gh-flow-invite .form-group');
                    button = find('.gh-flow-invite button[type="submit"]');

                    (0, _chai.expect)(formGroup.hasClass('error'), 'default field has error class').to.be['false'];

                    (0, _chai.expect)(button.text().trim(), 'default button text').to.equal('Invite some users');

                    (0, _chai.expect)(button.hasClass('gh-btn-minor'), 'default button is disabled').to.be['true'];
                });

                // no users submitted state
                click('.gh-flow-invite button[type="submit"]');

                andThen(function () {
                    (0, _chai.expect)(formGroup.hasClass('error'), 'no users submitted field has error class').to.be['true'];

                    (0, _chai.expect)(button.text().trim(), 'no users submitted button text').to.equal('No users to invite');

                    (0, _chai.expect)(button.hasClass('gh-btn-minor'), 'no users submitted button is disabled').to.be['true'];
                });

                // single invalid email
                fillIn(input, 'invalid email');
                triggerEvent(input, 'blur');

                andThen(function () {
                    (0, _chai.expect)(formGroup.hasClass('error'), 'invalid field has error class').to.be['true'];

                    (0, _chai.expect)(button.text().trim(), 'single invalid button text').to.equal('1 invalid email address');

                    (0, _chai.expect)(button.hasClass('gh-btn-minor'), 'invalid email button is disabled').to.be['true'];
                });

                // multiple invalid emails
                fillIn(input, 'invalid email\nanother invalid address');
                triggerEvent(input, 'blur');

                andThen(function () {
                    (0, _chai.expect)(button.text().trim(), 'multiple invalid button text').to.equal('2 invalid email addresses');
                });

                // single valid email
                fillIn(input, 'invited@example.com');
                triggerEvent(input, 'blur');

                andThen(function () {
                    (0, _chai.expect)(formGroup.hasClass('error'), 'valid field has error class').to.be['false'];

                    (0, _chai.expect)(button.text().trim(), 'single valid button text').to.equal('Invite 1 user');

                    (0, _chai.expect)(button.hasClass('gh-btn-green'), 'valid email button is enabled').to.be['true'];
                });

                // multiple valid emails
                fillIn(input, 'invited1@example.com\ninvited2@example.com');
                triggerEvent(input, 'blur');

                andThen(function () {
                    (0, _chai.expect)(button.text().trim(), 'multiple valid button text').to.equal('Invite 2 users');
                });

                // submit invitations with simulated failure on 1 invite
                click('.gh-btn-green');

                andThen(function () {
                    // it redirects to the home / "content" screen
                    (0, _chai.expect)(currentURL(), 'url after submitting invites').to.equal('/');

                    // it displays success alert
                    (0, _chai.expect)(find('.gh-alert-green').length, 'number of success alerts').to.equal(1);

                    // it displays failure alert
                    (0, _chai.expect)(find('.gh-alert-red').length, 'number of failure alerts').to.equal(1);
                });
            });
        });

        (0, _mocha.describe)('using Ghost OAuth', function () {
            (0, _mocha.beforeEach)(function () {
                // mimic a new install
                server.get('/authentication/setup/', function () {
                    return {
                        setup: [{ status: false }]
                    };
                });

                // ensure we have settings (to pass validation) and roles available
                (0, _ghostAdminTestsHelpersConfiguration.enableGhostOAuth)(server);
                server.loadFixtures('settings');
                server.loadFixtures('roles');
            });

            (0, _mocha.it)('displays the connect form and validates', function () {
                (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);

                visit('/setup');

                andThen(function () {
                    // it redirects to step one
                    (0, _chai.expect)(currentURL(), 'url after accessing /setup').to.equal('/setup/one');
                });

                click('.gh-btn-green');

                andThen(function () {
                    (0, _chai.expect)(find('button.login').text().trim(), 'login button text').to.equal('Sign in with Ghost');
                });

                click('.gh-btn-green');

                andThen(function () {
                    var sessionFG = find('button.login').closest('.form-group');
                    var titleFG = find('input[name="blog-title"]').closest('.form-group');

                    // session is validated
                    (0, _chai.expect)(sessionFG.hasClass('error'), 'session form group has error class').to.be['true'];

                    (0, _chai.expect)(sessionFG.find('.response').text().trim(), 'session validation text').to.match(/Please connect a Ghost\.org account/i);

                    // blog title is validated
                    (0, _chai.expect)(titleFG.hasClass('error'), 'title form group has error class').to.be['true'];

                    (0, _chai.expect)(titleFG.find('.response').text().trim(), 'title validation text').to.match(/please enter a blog title/i);
                });

                // TODO: test that connecting clears session validation error
                // TODO: test that typing in blog title clears validation error
            });

            (0, _mocha.it)('can connect and setup successfully', function () {
                (0, _ghostAdminTestsHelpersOauth.stubSuccessfulOAuthConnect)(application);

                visit('/setup/two');
                click('button.login');

                andThen(function () {
                    (0, _chai.expect)(find('button.login').text().trim(), 'login button text when connected').to.equal('Connected: oauthtest@example.com');
                });

                fillIn('input[name="blog-title"]', 'Ghostbusters');
                click('.gh-btn-green');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'url after submitting').to.equal('/setup/three');
                });
            });

            (0, _mocha.it)('handles failed connect', function () {
                (0, _ghostAdminTestsHelpersOauth.stubFailedOAuthConnect)(application);

                visit('/setup/two');
                click('button.login');

                andThen(function () {
                    (0, _chai.expect)(find('.main-error').text().trim(), 'error text after failed oauth connect').to.match(/authentication with ghost\.org denied or failed/i);
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/setup-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/setup-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/signin-test', ['exports', 'mocha', 'jquery', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth', 'ghost-admin/tests/helpers/configuration', 'ember-cli-mirage', 'ghost-admin/tests/helpers/oauth'], function (exports, _mocha, _jquery, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth, _ghostAdminTestsHelpersConfiguration, _emberCliMirage, _ghostAdminTestsHelpersOauth) {

    (0, _mocha.describe)('Acceptance: Signin', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects if already authenticated', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role], slug: 'test-user' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);

            visit('/signin');
            andThen(function () {
                (0, _chai.expect)(currentURL(), 'current url').to.equal('/');
            });
        });

        (0, _mocha.describe)('when attempting to signin', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role], slug: 'test-user' });

                server.post('/authentication/token', function (schema, _ref) {
                    var requestBody = _ref.requestBody;

                    /* eslint-disable camelcase */

                    var _$$deparam = _jquery['default'].deparam(requestBody);

                    var grantType = _$$deparam.grant_type;
                    var username = _$$deparam.username;
                    var password = _$$deparam.password;
                    var clientId = _$$deparam.client_id;

                    (0, _chai.expect)(grantType, 'grant type').to.equal('password');
                    (0, _chai.expect)(username, 'username').to.equal('test@example.com');
                    (0, _chai.expect)(clientId, 'client id').to.equal('ghost-admin');

                    if (password === 'testpass') {
                        return {
                            access_token: '5JhTdKI7PpoZv4ROsFoERc6wCHALKFH5jxozwOOAErmUzWrFNARuH1q01TYTKeZkPW7FmV5MJ2fU00pg9sm4jtH3Z1LjCf8D6nNqLYCfFb2YEKyuvG7zHj4jZqSYVodN2YTCkcHv6k8oJ54QXzNTLIDMlCevkOebm5OjxGiJpafMxncm043q9u1QhdU9eee3zouGRMVVp8zkKVoo5zlGMi3zvS2XDpx7xsfk8hKHpUgd7EDDQxmMueifWv7hv6n',
                            expires_in: 3600,
                            refresh_token: 'XP13eDjwV5mxOcrq1jkIY9idhdvN3R1Br5vxYpYIub2P5Hdc8pdWMOGmwFyoUshiEB62JWHTl8H1kACJR18Z8aMXbnk5orG28br2kmVgtVZKqOSoiiWrQoeKTqrRV0t7ua8uY5HdDUaKpnYKyOdpagsSPn3WEj8op4vHctGL3svOWOjZhq6F2XeVPMR7YsbiwBE8fjT3VhTB3KRlBtWZd1rE0Qo2EtSplWyjGKv1liAEiL0ndQoLeeSOCH4rTP7',
                            token_type: 'Bearer'
                        };
                    } else {
                        return new _emberCliMirage.Response(401, {}, {
                            errors: [{
                                errorType: 'UnauthorizedError',
                                message: 'Invalid Password'
                            }]
                        });
                    }
                    /* eslint-enable camelcase */
                });
            });

            (0, _mocha.it)('errors correctly', function () {
                (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);

                visit('/signin');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'signin url').to.equal('/signin');

                    (0, _chai.expect)(find('input[name="identification"]').length, 'email input field').to.equal(1);
                    (0, _chai.expect)(find('input[name="password"]').length, 'password input field').to.equal(1);
                });

                click('.gh-btn-blue');

                andThen(function () {
                    (0, _chai.expect)(find('.form-group.error').length, 'number of invalid fields').to.equal(2);

                    (0, _chai.expect)(find('.main-error').length, 'main error is displayed').to.equal(1);
                });

                fillIn('[name="identification"]', 'test@example.com');
                fillIn('[name="password"]', 'invalid');
                click('.gh-btn-blue');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'current url').to.equal('/signin');

                    (0, _chai.expect)(find('.main-error').length, 'main error is displayed').to.equal(1);

                    (0, _chai.expect)(find('.main-error').text().trim(), 'main error text').to.equal('Invalid Password');
                });
            });

            (0, _mocha.it)('submits successfully', function () {
                (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);

                visit('/signin');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'current url').to.equal('/signin');
                });

                fillIn('[name="identification"]', 'test@example.com');
                fillIn('[name="password"]', 'testpass');
                click('.gh-btn-blue');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/');
                });
            });
        });

        (0, _mocha.describe)('using Ghost OAuth', function () {
            (0, _mocha.beforeEach)(function () {
                (0, _ghostAdminTestsHelpersConfiguration.enableGhostOAuth)(server);
            });

            (0, _mocha.it)('can sign in successfully', function () {
                server.loadFixtures('roles');
                (0, _ghostAdminTestsHelpersOauth.stubSuccessfulOAuthConnect)(application);

                visit('/signin');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'current url').to.equal('/signin');

                    (0, _chai.expect)(find('button.login').text().trim(), 'login button text').to.equal('Sign in with Ghost');
                });

                click('button.login');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'url after connect').to.equal('/');
                });
            });

            (0, _mocha.it)('handles a failed connect', function () {
                (0, _ghostAdminTestsHelpersOauth.stubFailedOAuthConnect)(application);

                visit('/signin');
                click('button.login');

                andThen(function () {
                    (0, _chai.expect)(currentURL(), 'current url').to.equal('/signin');

                    (0, _chai.expect)(find('.main-error').text().trim(), 'sign-in error').to.match(/Authentication with Ghost\.org denied or failed/i);
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/signin-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/signin-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/signup-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/configuration', 'ghost-admin/tests/helpers/oauth'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersConfiguration, _ghostAdminTestsHelpersOauth) {

    (0, _mocha.describe)('Acceptance: Signup', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('can signup successfully', function () {
            server.get('/authentication/invitation', function () {
                return {
                    invitation: [{ valid: true }]
                };
            });

            server.post('/authentication/invitation/', function (_ref, _ref2) {
                var users = _ref.users;
                var requestBody = _ref2.requestBody;

                var params = JSON.parse(requestBody);
                (0, _chai.expect)(params.invitation[0].name).to.equal('Test User');
                (0, _chai.expect)(params.invitation[0].email).to.equal('kevin+test2@ghost.org');
                (0, _chai.expect)(params.invitation[0].password).to.equal('ValidPassword');
                (0, _chai.expect)(params.invitation[0].token).to.equal('MTQ3MDM0NjAxNzkyOXxrZXZpbit0ZXN0MkBnaG9zdC5vcmd8MmNEblFjM2c3ZlFUajluTks0aUdQU0dmdm9ta0xkWGY2OEZ1V2dTNjZVZz0');

                // ensure that `/users/me/` request returns a user
                var role = server.create('role', { name: 'Author' });
                users.create({ email: 'kevin@test2@ghost.org', roles: [role] });

                return {
                    invitation: [{
                        message: 'Invitation accepted.'
                    }]
                };
            });

            // token details:
            // "1470346017929|kevin+test2@ghost.org|2cDnQc3g7fQTj9nNK4iGPSGfvomkLdXf68FuWgS66Ug="
            visit('/signup/MTQ3MDM0NjAxNzkyOXxrZXZpbit0ZXN0MkBnaG9zdC5vcmd8MmNEblFjM2c3ZlFUajluTks0aUdQU0dmdm9ta0xkWGY2OEZ1V2dTNjZVZz0');

            andThen(function () {
                (0, _chai.expect)(currentPath()).to.equal('signup');

                // email address should be pre-filled and disabled
                (0, _chai.expect)(find('input[name="email"]').val(), 'email field value').to.equal('kevin+test2@ghost.org');

                (0, _chai.expect)(find('input[name="email"]').is(':disabled'), 'email field is disabled').to.be['true'];
            });

            // focus out in Name field triggers inline error
            triggerEvent('input[name="name"]', 'blur');

            andThen(function () {
                (0, _chai.expect)(find('input[name="name"]').closest('.form-group').hasClass('error'), 'name field group has error class when empty').to.be['true'];

                (0, _chai.expect)(find('input[name="name"]').closest('.form-group').find('.response').text().trim(), 'name inline-error text').to.match(/Please enter a name/);
            });

            // entering text in Name field clears error
            fillIn('input[name="name"]', 'Test User');
            triggerEvent('input[name="name"]', 'blur');

            andThen(function () {
                (0, _chai.expect)(find('input[name="name"]').closest('.form-group').hasClass('error'), 'name field loses error class after text input').to.be['false'];

                (0, _chai.expect)(find('input[name="name"]').closest('.form-group').find('.response').text().trim(), 'name field error is removed after text input').to.equal('');
            });

            // focus out in Name field triggers inline error
            triggerEvent('input[name="password"]', 'blur');

            andThen(function () {
                (0, _chai.expect)(find('input[name="password"]').closest('.form-group').hasClass('error'), 'password field group has error class when empty').to.be['true'];

                (0, _chai.expect)(find('input[name="password"]').closest('.form-group').find('.response').text().trim(), 'password field error text').to.match(/must be at least 8 characters/);
            });

            // entering valid text in Password field clears error
            fillIn('input[name="password"]', 'ValidPassword');
            triggerEvent('input[name="password"]', 'blur');

            andThen(function () {
                (0, _chai.expect)(find('input[name="password"]').closest('.form-group').hasClass('error'), 'password field loses error class after text input').to.be['false'];

                (0, _chai.expect)(find('input[name="password"]').closest('.form-group').find('.response').text().trim(), 'password field error is removed after text input').to.equal('');
            });

            // submitting sends correct details and redirects to content screen
            click('.gh-btn-green');

            andThen(function () {
                (0, _chai.expect)(currentPath()).to.equal('posts.index');
            });
        });

        (0, _mocha.it)('redirects if already logged in');
        (0, _mocha.it)('redirects with alert on invalid token');
        (0, _mocha.it)('redirects with alert on non-existant or expired token');

        (0, _mocha.describe)('using Ghost OAuth', function () {
            (0, _mocha.beforeEach)(function () {
                (0, _ghostAdminTestsHelpersConfiguration.enableGhostOAuth)(server);

                var _server$schema = server.schema;
                var invites = _server$schema.invites;
                var users = _server$schema.users;

                var user = users.create({ name: 'Test Invite Creator' });

                invites.create({
                    email: 'kevin+test2@ghost.org',
                    createdBy: user.id
                });
            });

            (0, _mocha.it)('can sign up sucessfully', function () {
                (0, _ghostAdminTestsHelpersOauth.stubSuccessfulOAuthConnect)(application);

                // token details:
                // "1470346017929|kevin+test2@ghost.org|2cDnQc3g7fQTj9nNK4iGPSGfvomkLdXf68FuWgS66Ug="
                visit('/signup/MTQ3MDM0NjAxNzkyOXxrZXZpbit0ZXN0MkBnaG9zdC5vcmd8MmNEblFjM2c3ZlFUajluTks0aUdQU0dmdm9ta0xkWGY2OEZ1V2dTNjZVZz0');

                andThen(function () {
                    (0, _chai.expect)(currentPath()).to.equal('signup');

                    (0, _chai.expect)(find('.gh-flow-content header p').text().trim(), 'form header text').to.equal('Accept your invite from Test Invite Creator');
                });

                click('button.login');

                andThen(function () {
                    (0, _chai.expect)(currentPath()).to.equal('posts.index');
                });
            });

            (0, _mocha.it)('handles failed connect', function () {
                (0, _ghostAdminTestsHelpersOauth.stubFailedOAuthConnect)(application);

                // token details:
                // "1470346017929|kevin+test2@ghost.org|2cDnQc3g7fQTj9nNK4iGPSGfvomkLdXf68FuWgS66Ug="
                visit('/signup/MTQ3MDM0NjAxNzkyOXxrZXZpbit0ZXN0MkBnaG9zdC5vcmd8MmNEblFjM2c3ZlFUajluTks0aUdQU0dmdm9ta0xkWGY2OEZ1V2dTNjZVZz0');

                click('button.login');

                andThen(function () {
                    (0, _chai.expect)(currentPath()).to.equal('signup');

                    (0, _chai.expect)(find('.main-error').text().trim(), 'flow error text').to.match(/authentication with ghost\.org denied or failed/i);
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/signup-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/signup-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/subscribers-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth', 'ember-test-selectors'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth, _emberTestSelectors) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    (0, _mocha.describe)('Acceptance: Subscribers', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects to signin when not authenticated', function () {
            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
            visit('/subscribers');

            andThen(function () {
                (0, _chai.expect)(currentURL()).to.equal('/signin');
            });
        });

        (0, _mocha.it)('redirects editors to posts', function () {
            var role = server.create('role', { name: 'Editor' });
            server.create('user', { roles: [role] });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/subscribers');

            andThen(function () {
                (0, _chai.expect)(currentURL()).to.equal('/');
                (0, _chai.expect)(find('.gh-nav-main a:contains("Subscribers")').length, 'sidebar link is visible').to.equal(0);
            });
        });

        (0, _mocha.it)('redirects authors to posts', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role] });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/subscribers');

            andThen(function () {
                (0, _chai.expect)(currentURL()).to.equal('/');
                (0, _chai.expect)(find('.gh-nav-main a:contains("Subscribers")').length, 'sidebar link is visible').to.equal(0);
            });
        });

        (0, _mocha.describe)('an admin', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('can manage subscribers', function () {
                server.createList('subscriber', 40);

                (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
                visit('/');
                click('.gh-nav-main a:contains("Subscribers")');

                andThen(function () {
                    // it navigates to the correct page
                    (0, _chai.expect)(currentPath()).to.equal('subscribers.index');

                    // it has correct page title
                    (0, _chai.expect)(document.title, 'page title').to.equal('Subscribers - Test Blog');

                    // it loads the first page
                    (0, _chai.expect)(find('.subscribers-table .lt-body .lt-row').length, 'number of subscriber rows').to.equal(30);

                    // it shows the total number of subscribers
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('total-subscribers')).text().trim(), 'displayed subscribers total').to.equal('(40)');

                    // it defaults to sorting by created_at desc

                    var _server$pretender$handledRequests$slice = server.pretender.handledRequests.slice(-1);

                    var _server$pretender$handledRequests$slice2 = _slicedToArray(_server$pretender$handledRequests$slice, 1);

                    var lastRequest = _server$pretender$handledRequests$slice2[0];

                    (0, _chai.expect)(lastRequest.queryParams.order).to.equal('created_at desc');

                    var createdAtHeader = find('.subscribers-table th:contains("Subscription Date")');
                    (0, _chai.expect)(createdAtHeader.hasClass('is-sorted'), 'createdAt column is sorted').to.be['true'];
                    (0, _chai.expect)(createdAtHeader.find('.icon-descending').length, 'createdAt column has descending icon').to.equal(1);
                });

                // click the column to re-order
                click('th:contains("Subscription Date")');

                andThen(function () {
                    // it flips the directions and re-fetches

                    var _server$pretender$handledRequests$slice3 = server.pretender.handledRequests.slice(-1);

                    var _server$pretender$handledRequests$slice32 = _slicedToArray(_server$pretender$handledRequests$slice3, 1);

                    var lastRequest = _server$pretender$handledRequests$slice32[0];

                    (0, _chai.expect)(lastRequest.queryParams.order).to.equal('created_at asc');

                    var createdAtHeader = find('.subscribers-table th:contains("Subscription Date")');
                    (0, _chai.expect)(createdAtHeader.find('.icon-ascending').length, 'createdAt column has ascending icon').to.equal(1);
                });

                // TODO: scroll test disabled as ember-light-table doesn't calculate
                // the scroll trigger element's positioning against the scroll
                // container - https://github.com/offirgolan/ember-light-table/issues/201
                //
                // andThen(() => {
                //     // scroll to the bottom of the table to simulate infinite scroll
                //     find('.subscribers-table').scrollTop(find('.subscribers-table .ember-light-table').height() - 50);
                // });
                //
                // // trigger infinite scroll
                // triggerEvent('.subscribers-table tbody', 'scroll');
                //
                // andThen(function () {
                //     // it loads the next page
                //     expect(find('.subscribers-table .lt-body .lt-row').length, 'number of subscriber rows after infinite-scroll')
                //         .to.equal(40);
                // });

                // click the add subscriber button
                click('.gh-btn:contains("Add Subscriber")');

                andThen(function () {
                    // it displays the add subscriber modal
                    (0, _chai.expect)(find('.fullscreen-modal').length, 'add subscriber modal displayed').to.equal(1);
                });

                // cancel the modal
                click('.fullscreen-modal .gh-btn:contains("Cancel")');

                andThen(function () {
                    // it closes the add subscriber modal
                    (0, _chai.expect)(find('.fullscreen-modal').length, 'add subscriber modal displayed after cancel').to.equal(0);
                });

                // save a new subscriber
                click('.gh-btn:contains("Add Subscriber")');
                fillIn('.fullscreen-modal input[name="email"]', 'test@example.com');
                click('.fullscreen-modal .gh-btn:contains("Add")');

                andThen(function () {
                    // the add subscriber modal is closed
                    (0, _chai.expect)(find('.fullscreen-modal').length, 'add subscriber modal displayed after save').to.equal(0);

                    // the subscriber is added to the table
                    (0, _chai.expect)(find('.subscribers-table .lt-body .lt-row:first-of-type .lt-cell:first-of-type').text().trim(), 'first email in list after addition').to.equal('test@example.com');

                    // the table is scrolled to the top
                    // TODO: implement scroll to new record after addition
                    // expect(find('.subscribers-table').scrollTop(), 'scroll position after addition')
                    //     .to.equal(0);

                    // the subscriber total is updated
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('total-subscribers')).text().trim(), 'subscribers total after addition').to.equal('(41)');
                });

                // saving a duplicate subscriber
                click('.gh-btn:contains("Add Subscriber")');
                fillIn('.fullscreen-modal input[name="email"]', 'test@example.com');
                click('.fullscreen-modal .gh-btn:contains("Add")');

                andThen(function () {
                    // the validation error is displayed
                    (0, _chai.expect)(find('.fullscreen-modal .error .response').text().trim(), 'duplicate email validation').to.equal('Email already exists.');

                    // the subscriber is not added to the table
                    (0, _chai.expect)(find('.lt-cell:contains(test@example.com)').length, 'number of "test@example.com rows"').to.equal(1);

                    // the subscriber total is unchanged
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('total-subscribers')).text().trim(), 'subscribers total after failed add').to.equal('(41)');
                });

                // deleting a subscriber
                click('.fullscreen-modal .gh-btn:contains("Cancel")');
                click('.subscribers-table tbody tr:first-of-type button:last-of-type');

                andThen(function () {
                    // it displays the delete subscriber modal
                    (0, _chai.expect)(find('.fullscreen-modal').length, 'delete subscriber modal displayed').to.equal(1);
                });

                // cancel the modal
                click('.fullscreen-modal .gh-btn:contains("Cancel")');

                andThen(function () {
                    // it closes the add subscriber modal
                    (0, _chai.expect)(find('.fullscreen-modal').length, 'delete subscriber modal displayed after cancel').to.equal(0);
                });

                click('.subscribers-table tbody tr:first-of-type button:last-of-type');
                click('.fullscreen-modal .gh-btn:contains("Delete")');

                andThen(function () {
                    // the add subscriber modal is closed
                    (0, _chai.expect)(find('.fullscreen-modal').length, 'delete subscriber modal displayed after confirm').to.equal(0);

                    // the subscriber is removed from the table
                    (0, _chai.expect)(find('.subscribers-table .lt-body .lt-row:first-of-type .lt-cell:first-of-type').text().trim(), 'first email in list after addition').to.not.equal('test@example.com');

                    // the subscriber total is updated
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('total-subscribers')).text().trim(), 'subscribers total after addition').to.equal('(40)');
                });

                // click the import subscribers button
                click('.gh-btn:contains("Import CSV")');

                andThen(function () {
                    // it displays the import subscribers modal
                    (0, _chai.expect)(find('.fullscreen-modal').length, 'import subscribers modal displayed').to.equal(1);
                    (0, _chai.expect)(find('.fullscreen-modal input[type="file"]').length, 'import modal contains file input').to.equal(1);
                });

                // cancel the modal
                click('.fullscreen-modal .gh-btn:contains("Cancel")');

                andThen(function () {
                    // it closes the import subscribers modal
                    (0, _chai.expect)(find('.fullscreen-modal').length, 'import subscribers modal displayed after cancel').to.equal(0);
                });

                click('.gh-btn:contains("Import CSV")');
                fileUpload('.fullscreen-modal input[type="file"]', ['test'], { name: 'test.csv' });

                andThen(function () {
                    // modal title changes
                    (0, _chai.expect)(find('.fullscreen-modal h1').text().trim(), 'import modal title after import').to.equal('Import Successful');

                    // modal button changes
                    (0, _chai.expect)(find('.fullscreen-modal .modal-footer button').text().trim(), 'import modal button text after import').to.equal('Close');

                    // subscriber total is updated
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('total-subscribers')).text().trim(), 'subscribers total after import').to.equal('(90)');

                    // table is reset

                    var _server$pretender$handledRequests$slice4 = server.pretender.handledRequests.slice(-1);

                    var _server$pretender$handledRequests$slice42 = _slicedToArray(_server$pretender$handledRequests$slice4, 1);

                    var lastRequest = _server$pretender$handledRequests$slice42[0];

                    (0, _chai.expect)(lastRequest.url, 'endpoint requested after import').to.match(/\/subscribers\/\?/);
                    (0, _chai.expect)(lastRequest.queryParams.page, 'page requested after import').to.equal('1');

                    (0, _chai.expect)(find('.subscribers-table .lt-body .lt-row').length, 'number of rows in table after import').to.equal(30);
                });

                // close modal
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/subscribers-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/subscribers-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/team-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth', 'ghost-admin/tests/helpers/adapter-error', 'ghost-admin/tests/helpers/configuration', 'ember-cli-mirage', 'ember-test-selectors'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth, _ghostAdminTestsHelpersAdapterError, _ghostAdminTestsHelpersConfiguration, _emberCliMirage, _emberTestSelectors) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    (0, _mocha.describe)('Acceptance: Team', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.it)('redirects to signin when not authenticated', function () {
            (0, _ghostAdminTestsHelpersEmberSimpleAuth.invalidateSession)(application);
            visit('/team');

            andThen(function () {
                (0, _chai.expect)(currentURL()).to.equal('/signin');
            });
        });

        (0, _mocha.it)('redirects correctly when authenticated as author', function () {
            var role = server.create('role', { name: 'Author' });
            server.create('user', { roles: [role], slug: 'test-user' });

            server.create('user', { slug: 'no-access' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/team/no-access');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team/test-user');
            });
        });

        (0, _mocha.it)('redirects correctly when authenticated as editor', function () {
            var role = server.create('role', { name: 'Editor' });
            server.create('user', { roles: [role], slug: 'test-user' });

            server.create('user', { slug: 'no-access' });

            (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            visit('/team/no-access');

            andThen(function () {
                (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team');
            });
        });

        (0, _mocha.describe)('when logged in as admin', function () {
            var admin = undefined,
                adminRole = undefined,
                suspendedUser = undefined;

            (0, _mocha.beforeEach)(function () {
                server.loadFixtures('roles');
                adminRole = server.schema.roles.find(1);

                admin = server.create('user', { email: 'admin@example.com', roles: [adminRole] });

                // add an expired invite
                server.create('invite', { expires: moment.utc().subtract(1, 'day').valueOf() });

                // add a suspended user
                suspendedUser = server.create('user', { email: 'suspended@example.com', roles: [adminRole], status: 'inactive' });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('it renders and navigates correctly', function () {
                var user1 = server.create('user');
                var user2 = server.create('user');

                visit('/team');

                andThen(function () {
                    // doesn't do any redirecting
                    (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team');

                    // it has correct page title
                    (0, _chai.expect)(document.title, 'page title').to.equal('Team - Test Blog');

                    // it shows active users in active section
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('active-users') + ' ' + (0, _emberTestSelectors['default'])('user-id')).length, 'number of active users').to.equal(3);
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('active-users') + ' ' + (0, _emberTestSelectors['default'])('user-id', user1.id))).to.exist;
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('active-users') + ' ' + (0, _emberTestSelectors['default'])('user-id', user2.id))).to.exist;
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('active-users') + ' ' + (0, _emberTestSelectors['default'])('user-id', admin.id))).to.exist;

                    // it shows suspended users in suspended section
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('suspended-users') + ' ' + (0, _emberTestSelectors['default'])('user-id')).length, 'number of suspended users').to.equal(1);
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('suspended-users') + ' ' + (0, _emberTestSelectors['default'])('user-id', suspendedUser.id))).to.exist;

                    click((0, _emberTestSelectors['default'])('user-id', user2.id));

                    andThen(function () {
                        // url is correct
                        (0, _chai.expect)(currentURL(), 'url after clicking user').to.equal('/team/' + user2.slug);

                        // title is correct
                        (0, _chai.expect)(document.title, 'title after clicking user').to.equal('Team - User - Test Blog');

                        // view title should exist and be linkable and active
                        (0, _chai.expect)(find('.view-title a[href="/ghost/team"]').hasClass('active'), 'has linkable url back to team main page').to.be['true'];
                    });

                    click('.view-title a');

                    andThen(function () {
                        // url should be /team again
                        (0, _chai.expect)(currentURL(), 'url after clicking back').to.equal('/team');
                    });
                });
            });

            (0, _mocha.it)('can manage invites', function () {
                visit('/team');

                andThen(function () {
                    // invite user button exists
                    (0, _chai.expect)(find('.view-actions .gh-btn-green').text().trim(), 'invite people button text').to.equal('Invite People');

                    // existing users are listed
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('user-id')).length, 'initial number of active users').to.equal(2);

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('user-id', '1')).find((0, _emberTestSelectors['default'])('role-name')).text().trim(), 'active user\'s role label').to.equal('Administrator');

                    // existing invites are shown
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id')).length, 'initial number of invited users').to.equal(1);

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id', '1')).find((0, _emberTestSelectors['default'])('invite-description')).text(), 'expired invite description').to.match(/expired/);
                });

                // remove expired invite
                click((0, _emberTestSelectors['default'])('invite-id', '1') + ' ' + (0, _emberTestSelectors['default'])('revoke-button'));

                andThen(function () {
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id')).length, 'initial number of invited users').to.equal(0);
                });

                // click the invite people button
                click('.view-actions .gh-btn-green');

                andThen(function () {
                    var roleOptions = find('.fullscreen-modal select[name="role"] option');

                    function checkOwnerExists() {
                        for (var i in roleOptions) {
                            if (roleOptions[i].tagName === 'option' && roleOptions[i].text === 'Owner') {
                                return true;
                            }
                        }
                        return false;
                    }

                    function checkSelectedIsAuthor() {
                        for (var i in roleOptions) {
                            if (roleOptions[i].selected) {
                                return roleOptions[i].text === 'Author';
                            }
                        }
                        return false;
                    }

                    // modal is displayed
                    (0, _chai.expect)(find('.fullscreen-modal h1').text().trim(), 'correct modal is displayed').to.equal('Invite a New User');

                    // number of roles is correct
                    (0, _chai.expect)(find('.fullscreen-modal select[name="role"] option').length, 'number of selectable roles').to.equal(3);

                    (0, _chai.expect)(checkOwnerExists(), 'owner role isn\'t available').to.be['false'];
                    (0, _chai.expect)(checkSelectedIsAuthor(), 'author role is selected initially').to.be['true'];
                });

                // submit valid invite form
                fillIn('.fullscreen-modal input[name="email"]', 'invite1@example.com');
                click('.fullscreen-modal .gh-btn-green');

                andThen(function () {
                    // modal closes
                    (0, _chai.expect)(find('.fullscreen-modal').length, 'number of modals after sending invite').to.equal(0);

                    // invite is displayed, has correct e-mail + role
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id')).length, 'number of invites after first invite').to.equal(1);

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id', '2')).find((0, _emberTestSelectors['default'])('email')).text().trim(), 'displayed email of first invite').to.equal('invite1@example.com');

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id', '2')).find((0, _emberTestSelectors['default'])('role-name')).text().trim(), 'displayed role of first invite').to.equal('Author');

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id', '2')).find((0, _emberTestSelectors['default'])('invite-description')).text(), 'new invite description').to.match(/expires/);

                    // number of users is unchanged
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('user-id')).length, 'number of active users after first invite').to.equal(2);
                });

                // submit new invite with different role
                click('.view-actions .gh-btn-green');
                fillIn('.fullscreen-modal input[name="email"]', 'invite2@example.com');
                fillIn('.fullscreen-modal select[name="role"]', '2');
                click('.fullscreen-modal .gh-btn-green');

                andThen(function () {
                    // number of invites increases
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id')).length, 'number of invites after second invite').to.equal(2);

                    // invite has correct e-mail + role
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id', '3')).find((0, _emberTestSelectors['default'])('email')).text().trim(), 'displayed email of second invite').to.equal('invite2@example.com');

                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id', '3')).find((0, _emberTestSelectors['default'])('role-name')).text().trim(), 'displayed role of second invite').to.equal('Editor');
                });

                // submit invite form with existing user
                click('.view-actions .gh-btn-green');
                fillIn('.fullscreen-modal input[name="email"]', 'admin@example.com');
                click('.fullscreen-modal .gh-btn-green');

                andThen(function () {
                    // validation message is displayed
                    (0, _chai.expect)(find('.fullscreen-modal .error .response').text().trim(), 'inviting existing user error').to.equal('A user with that email address already exists.');
                });

                // submit invite form with existing invite
                fillIn('.fullscreen-modal input[name="email"]', 'invite1@example.com');
                click('.fullscreen-modal .gh-btn-green');

                andThen(function () {
                    // validation message is displayed
                    (0, _chai.expect)(find('.fullscreen-modal .error .response').text().trim(), 'inviting invited user error').to.equal('A user with that email address was already invited.');
                });

                // submit invite form with an invalid email
                fillIn('.fullscreen-modal input[name="email"]', 'test');
                click('.fullscreen-modal .gh-btn-green');

                andThen(function () {
                    // validation message is displayed
                    (0, _chai.expect)(find('.fullscreen-modal .error .response').text().trim(), 'inviting invalid email error').to.equal('Invalid Email.');
                });

                click('.fullscreen-modal a.close');
                // revoke latest invite
                click((0, _emberTestSelectors['default'])('invite-id', '3') + ' ' + (0, _emberTestSelectors['default'])('revoke-button'));

                andThen(function () {
                    // number of invites decreases
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id')).length, 'number of invites after revoke').to.equal(1);

                    // notification is displayed
                    (0, _chai.expect)(find('.gh-notification').text().trim(), 'notifications contain revoke').to.match(/Invitation revoked\. \(invite2@example\.com\)/);

                    // correct invite is removed
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id')).find((0, _emberTestSelectors['default'])('email')).text().trim(), 'displayed email of remaining invite').to.equal('invite1@example.com');
                });

                // add another invite to test ordering on resend
                click('.view-actions .gh-btn-green');
                fillIn('.fullscreen-modal input[name="email"]', 'invite3@example.com');
                click('.fullscreen-modal .gh-btn-green');

                andThen(function () {
                    // new invite should be last in the list
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id') + ':last').find((0, _emberTestSelectors['default'])('email')).text().trim(), 'last invite email in list').to.equal('invite3@example.com');
                });

                // resend first invite
                click((0, _emberTestSelectors['default'])('invite-id', '2') + ' ' + (0, _emberTestSelectors['default'])('resend-button'));

                andThen(function () {
                    // notification is displayed
                    (0, _chai.expect)(find('.gh-notification').text().trim(), 'notifications contain resend').to.match(/Invitation resent! \(invite1@example\.com\)/);

                    // first invite is still at the top
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id') + ':first-of-type').find((0, _emberTestSelectors['default'])('email')).text().trim(), 'first invite email in list').to.equal('invite1@example.com');
                });

                // regression test: can revoke a resent invite
                click((0, _emberTestSelectors['default'])('invite-id') + ':first-of-type ' + (0, _emberTestSelectors['default'])('resend-button'));
                click((0, _emberTestSelectors['default'])('invite-id') + ':first-of-type ' + (0, _emberTestSelectors['default'])('revoke-button'));

                andThen(function () {
                    // number of invites decreases
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('invite-id')).length, 'number of invites after resend/revoke').to.equal(1);

                    // notification is displayed
                    (0, _chai.expect)(find('.gh-notification').text().trim(), 'notifications contain revoke after resend/revoke').to.match(/Invitation revoked\. \(invite1@example\.com\)/);
                });
            });

            (0, _mocha.it)('can manage suspended users', function () {
                visit('/team');
                click((0, _emberTestSelectors['default'])('user-id', suspendedUser.id));

                andThen(function () {
                    (0, _chai.expect)((0, _emberTestSelectors['default'])('suspended-badge')).to.exist;
                });

                click((0, _emberTestSelectors['default'])('user-actions'));
                click((0, _emberTestSelectors['default'])('unsuspend-button'));
                click((0, _emberTestSelectors['default'])('modal-confirm'));

                // NOTE: there seems to be a timing issue with this test - pausing
                // here confirms that the badge is removed but the andThen is firing
                // before the page is updated
                // andThen(() => {
                //     expect(testSelector('suspended-badge')).to.not.exist;
                // });

                click((0, _emberTestSelectors['default'])('team-link'));

                andThen(function () {
                    // suspendedUser is now in active list
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('active-users') + ' ' + (0, _emberTestSelectors['default'])('user-id', suspendedUser.id))).to.exist;

                    // no suspended users
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('suspended-users') + ' ' + (0, _emberTestSelectors['default'])('user-id')).length).to.equal(0);
                });

                click((0, _emberTestSelectors['default'])('user-id', suspendedUser.id));

                click((0, _emberTestSelectors['default'])('user-actions'));
                click((0, _emberTestSelectors['default'])('suspend-button'));
                click((0, _emberTestSelectors['default'])('modal-confirm'));

                andThen(function () {
                    (0, _chai.expect)((0, _emberTestSelectors['default'])('suspended-badge')).to.exist;
                });
            });

            (0, _mocha.it)('can delete users', function () {
                var user1 = server.create('user');
                var user2 = server.create('user');
                var post = server.create('post');

                user2.posts = [post];

                visit('/team');
                click((0, _emberTestSelectors['default'])('user-id', user1.id));

                // user deletion displays modal
                click('button.delete');
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal .modal-content:contains("delete this user")').length, 'user deletion modal displayed after button click').to.equal(1);

                    // user has no posts so no warning about post deletion
                    (0, _chai.expect)(find('.fullscreen-modal .modal-content:contains("is the author of")').length, 'deleting user with no posts has no post count').to.equal(0);
                });

                // cancelling user deletion closes modal
                click('.fullscreen-modal button:contains("Cancel")');
                andThen(function () {
                    (0, _chai.expect)(find('.fullscreen-modal').length === 0, 'delete user modal is closed when cancelling').to.be['true'];
                });

                // deleting a user with posts
                visit('/team');
                click((0, _emberTestSelectors['default'])('user-id', user2.id));

                click('button.delete');
                andThen(function () {
                    // user has  posts so should warn about post deletion
                    (0, _chai.expect)(find('.fullscreen-modal .modal-content:contains("is the author of 1 post")').length, 'deleting user with posts has post count').to.equal(1);
                });

                click('.fullscreen-modal button:contains("Delete")');
                andThen(function () {
                    // redirected to team page
                    (0, _chai.expect)(currentURL()).to.equal('/team');

                    // deleted user is not in list
                    (0, _chai.expect)(find((0, _emberTestSelectors['default'])('user-id', user2.id)).length, 'deleted user is not in user list after deletion').to.equal(0);
                });
            });

            (0, _mocha.describe)('existing user', function () {
                var user = undefined;

                (0, _mocha.beforeEach)(function () {
                    user = server.create('user', {
                        slug: 'test-1',
                        name: 'Test User',
                        facebook: 'test',
                        twitter: '@test'
                    });
                });

                (0, _mocha.it)('input fields reset and validate correctly', function () {
                    // test user name
                    visit('/team/test-1');

                    andThen(function () {
                        (0, _chai.expect)(currentURL(), 'currentURL').to.equal('/team/test-1');
                        (0, _chai.expect)(find('.user-details-top .first-form-group input.user-name').val(), 'current user name').to.equal('Test User');
                    });

                    // test empty user name
                    fillIn('.user-details-top .first-form-group input.user-name', '');
                    triggerEvent('.user-details-top .first-form-group input.user-name', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('.user-details-top .first-form-group').hasClass('error'), 'username input is in error state with blank input').to.be['true'];
                    });

                    // test too long user name
                    fillIn('.user-details-top .first-form-group input.user-name', new Array(160).join('a'));
                    triggerEvent('.user-details-top .first-form-group input.user-name', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('.user-details-top .first-form-group').hasClass('error'), 'username input is in error state with too long input').to.be['true'];
                    });

                    // reset name field
                    fillIn('.user-details-top .first-form-group input.user-name', 'Test User');

                    andThen(function () {
                        (0, _chai.expect)(find('.user-details-bottom input[name="user"]').val(), 'slug value is default').to.equal('test-1');
                    });

                    fillIn('.user-details-bottom input[name="user"]', '');
                    triggerEvent('.user-details-bottom input[name="user"]', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('.user-details-bottom input[name="user"]').val(), 'slug value is reset to original upon empty string').to.equal('test-1');
                    });

                    fillIn('.user-details-bottom input[name="user"]', 'white space');
                    triggerEvent('.user-details-bottom input[name="user"]', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('.user-details-bottom input[name="user"]').val(), 'slug value is correctly dasherized').to.equal('white-space');
                    });

                    fillIn('.user-details-bottom input[name="email"]', 'thisisnotanemail');
                    triggerEvent('.user-details-bottom input[name="email"]', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('.user-details-bottom .form-group:nth-of-type(2)').hasClass('error'), 'email input should be in error state with invalid email').to.be['true'];
                    });

                    fillIn('.user-details-bottom input[name="email"]', 'test@example.com');
                    fillIn('#user-location', new Array(160).join('a'));
                    triggerEvent('#user-location', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-location').closest('.form-group').hasClass('error'), 'location input should be in error state').to.be['true'];
                    });

                    fillIn('#user-location', '');
                    fillIn('#user-website', 'thisisntawebsite');
                    triggerEvent('#user-website', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-website').closest('.form-group').hasClass('error'), 'website input should be in error state').to.be['true'];
                    });

                    // Testing Facebook input

                    andThen(function () {
                        // displays initial value
                        (0, _chai.expect)(find('#user-facebook').val(), 'initial facebook value').to.equal('https://www.facebook.com/test');
                    });

                    triggerEvent('#user-facebook', 'focus');
                    triggerEvent('#user-facebook', 'blur');

                    andThen(function () {
                        // regression test: we still have a value after the input is
                        // focused and then blurred without any changes
                        (0, _chai.expect)(find('#user-facebook').val(), 'facebook value after blur with no change').to.equal('https://www.facebook.com/test');
                    });

                    fillIn('#user-facebook', '');
                    fillIn('#user-facebook', ')(*&%^%)');
                    triggerEvent('#user-facebook', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-facebook').closest('.form-group').hasClass('error'), 'facebook input should be in error state').to.be['true'];
                    });

                    fillIn('#user-facebook', '');
                    fillIn('#user-facebook', 'pages/)(*&%^%)');
                    triggerEvent('#user-facebook', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-facebook').val()).to.be.equal('https://www.facebook.com/pages/)(*&%^%)');
                        (0, _chai.expect)(find('#user-facebook').closest('.form-group').hasClass('error'), 'facebook input should be in error state').to.be['false'];
                    });

                    fillIn('#user-facebook', '');
                    fillIn('#user-facebook', 'testing');
                    triggerEvent('#user-facebook', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-facebook').val()).to.be.equal('https://www.facebook.com/testing');
                        (0, _chai.expect)(find('#user-facebook').closest('.form-group').hasClass('error'), 'facebook input should be in error state').to.be['false'];
                    });

                    fillIn('#user-facebook', '');
                    fillIn('#user-facebook', 'somewebsite.com/pages/some-facebook-page/857469375913?ref=ts');
                    triggerEvent('#user-facebook', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-facebook').val()).to.be.equal('https://www.facebook.com/pages/some-facebook-page/857469375913?ref=ts');
                        (0, _chai.expect)(find('#user-facebook').closest('.form-group').hasClass('error'), 'facebook input should be in error state').to.be['false'];
                    });

                    fillIn('#user-facebook', '');
                    fillIn('#user-facebook', 'test');
                    triggerEvent('#user-facebook', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-facebook').closest('.form-group').hasClass('error'), 'facebook input should be in error state').to.be['true'];
                    });

                    fillIn('#user-facebook', '');
                    fillIn('#user-facebook', 'http://twitter.com/testuser');
                    triggerEvent('#user-facebook', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-facebook').val()).to.be.equal('https://www.facebook.com/testuser');
                        (0, _chai.expect)(find('#user-facebook').closest('.form-group').hasClass('error'), 'facebook input should be in error state').to.be['false'];
                    });

                    fillIn('#user-facebook', '');
                    fillIn('#user-facebook', 'facebook.com/testing');
                    triggerEvent('#user-facebook', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-facebook').val()).to.be.equal('https://www.facebook.com/testing');
                        (0, _chai.expect)(find('#user-facebook').closest('.form-group').hasClass('error'), 'facebook input should be in error state').to.be['false'];
                    });

                    // Testing Twitter input

                    andThen(function () {
                        // loads fixtures and performs transform
                        (0, _chai.expect)(find('#user-twitter').val(), 'initial twitter value').to.equal('https://twitter.com/test');
                    });

                    triggerEvent('#user-twitter', 'focus');
                    triggerEvent('#user-twitter', 'blur');

                    andThen(function () {
                        // regression test: we still have a value after the input is
                        // focused and then blurred without any changes
                        (0, _chai.expect)(find('#user-twitter').val(), 'twitter value after blur with no change').to.equal('https://twitter.com/test');
                    });

                    fillIn('#user-twitter', '');
                    fillIn('#user-twitter', ')(*&%^%)');
                    triggerEvent('#user-twitter', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-twitter').closest('.form-group').hasClass('error'), 'twitter input should be in error state').to.be['true'];
                    });

                    fillIn('#user-twitter', '');
                    fillIn('#user-twitter', 'name');
                    triggerEvent('#user-twitter', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-twitter').val()).to.be.equal('https://twitter.com/name');
                        (0, _chai.expect)(find('#user-twitter').closest('.form-group').hasClass('error'), 'twitter input should be in error state').to.be['false'];
                    });

                    fillIn('#user-twitter', '');
                    fillIn('#user-twitter', 'http://github.com/user');
                    triggerEvent('#user-twitter', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-twitter').val()).to.be.equal('https://twitter.com/user');
                        (0, _chai.expect)(find('#user-twitter').closest('.form-group').hasClass('error'), 'twitter input should be in error state').to.be['false'];
                    });

                    fillIn('#user-twitter', '');
                    fillIn('#user-twitter', 'twitter.com/user');
                    triggerEvent('#user-twitter', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-twitter').val()).to.be.equal('https://twitter.com/user');
                        (0, _chai.expect)(find('#user-twitter').closest('.form-group').hasClass('error'), 'twitter input should be in error state').to.be['false'];
                    });

                    fillIn('#user-website', '');
                    fillIn('#user-bio', new Array(210).join('a'));
                    triggerEvent('#user-bio', 'blur');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-bio').closest('.form-group').hasClass('error'), 'bio input should be in error state').to.be['true'];
                    });

                    // password reset ------

                    // button triggers validation
                    click('.button-change-password');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-password-new').closest('.form-group').hasClass('error'), 'new password has error class when blank').to.be['true'];

                        (0, _chai.expect)(find('#user-password-new').siblings('.response').text(), 'new password error when blank').to.match(/can't be blank/);
                    });

                    // typing in inputs clears validation
                    fillIn('#user-password-new', 'password');
                    triggerEvent('#user-password-new', 'input');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-password-new').closest('.form-group').hasClass('error'), 'password validation is visible after typing').to.be['false'];
                    });

                    // enter key triggers action
                    keyEvent('#user-password-new', 'keyup', 13);

                    andThen(function () {
                        (0, _chai.expect)(find('#user-new-password-verification').closest('.form-group').hasClass('error'), 'confirm password has error class when it doesn\'t match').to.be['true'];

                        (0, _chai.expect)(find('#user-new-password-verification').siblings('.response').text(), 'confirm password error when it doesn\'t match').to.match(/do not match/);
                    });

                    // submits with correct details
                    fillIn('#user-new-password-verification', 'password');
                    click('.button-change-password');

                    andThen(function () {
                        // hits the endpoint

                        var _server$pretender$handledRequests$slice = server.pretender.handledRequests.slice(-1);

                        var _server$pretender$handledRequests$slice2 = _slicedToArray(_server$pretender$handledRequests$slice, 1);

                        var lastRequest = _server$pretender$handledRequests$slice2[0];

                        var params = JSON.parse(lastRequest.requestBody);

                        (0, _chai.expect)(lastRequest.url, 'password request URL').to.match(/\/users\/password/);

                        // eslint-disable-next-line camelcase
                        (0, _chai.expect)(params.password[0].user_id).to.equal(user.id.toString());
                        (0, _chai.expect)(params.password[0].newPassword).to.equal('password');
                        (0, _chai.expect)(params.password[0].ne2Password).to.equal('password');

                        // clears the fields
                        (0, _chai.expect)(find('#user-password-new').val(), 'password field after submit').to.be.blank;

                        (0, _chai.expect)(find('#user-new-password-verification').val(), 'password verification field after submit').to.be.blank;

                        // displays a notification
                        (0, _chai.expect)(find('.gh-notifications .gh-notification').length, 'password saved notification is displayed').to.equal(1);
                    });
                });
            });

            (0, _mocha.describe)('using Ghost OAuth', function () {
                (0, _mocha.beforeEach)(function () {
                    (0, _ghostAdminTestsHelpersConfiguration.enableGhostOAuth)(server);
                });

                (0, _mocha.it)('doesn\'t show the password reset form', function () {
                    visit('/team/' + admin.slug);

                    andThen(function () {
                        // ensure that the normal form is displayed so we don't get
                        // false positives
                        (0, _chai.expect)(find('input#user-slug').length, 'profile form is displayed').to.equal(1);

                        // check that the password form is hidden
                        (0, _chai.expect)(find('#password-reset').length, 'presence of password reset form').to.equal(0);

                        (0, _chai.expect)(find('#user-password-new').length, 'presence of new password field').to.equal(0);
                    });
                });
            });

            (0, _mocha.describe)('own user', function () {
                (0, _mocha.it)('requires current password when changing password', function () {
                    visit('/team/' + admin.slug);

                    // test the "old password" field is validated
                    click('.button-change-password');

                    andThen(function () {
                        // old password has error
                        (0, _chai.expect)(find('#user-password-old').closest('.form-group').hasClass('error'), 'old password has error class when blank').to.be['true'];

                        (0, _chai.expect)(find('#user-password-old').siblings('.response').text(), 'old password error when blank').to.match(/is required/);

                        // new password has error
                        (0, _chai.expect)(find('#user-password-new').closest('.form-group').hasClass('error'), 'new password has error class when blank').to.be['true'];

                        (0, _chai.expect)(find('#user-password-new').siblings('.response').text(), 'new password error when blank').to.match(/can't be blank/);
                    });

                    // validation is cleared when typing
                    fillIn('#user-password-old', 'password');
                    triggerEvent('#user-password-old', 'input');

                    andThen(function () {
                        (0, _chai.expect)(find('#user-password-old').closest('.form-group').hasClass('error'), 'old password validation is in error state after typing').to.be['false'];
                    });
                });
            });

            (0, _mocha.it)('redirects to 404 when user does not exist', function () {
                server.get('/users/slug/unknown/', function () {
                    return new _emberCliMirage.Response(404, { 'Content-Type': 'application/json' }, { errors: [{ message: 'User not found.', errorType: 'NotFoundError' }] });
                });

                (0, _ghostAdminTestsHelpersAdapterError.errorOverride)();

                visit('/team/unknown');

                andThen(function () {
                    (0, _ghostAdminTestsHelpersAdapterError.errorReset)();
                    (0, _chai.expect)(currentPath()).to.equal('error404');
                    (0, _chai.expect)(currentURL()).to.equal('/team/unknown');
                });
            });
        });

        (0, _mocha.describe)('when logged in as author', function () {
            var adminRole = undefined,
                authorRole = undefined;

            (0, _mocha.beforeEach)(function () {
                adminRole = server.create('role', { name: 'Administrator' });
                authorRole = server.create('role', { name: 'Author' });
                server.create('user', { roles: [authorRole] });

                server.get('/invites/', function () {
                    return new _emberCliMirage.Response(403, {}, {
                        errors: [{
                            errorType: 'NoPermissionError',
                            message: 'You do not have permission to perform this action'
                        }]
                    });
                });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('can access the team page', function () {
                server.create('user', { roles: [adminRole] });
                server.create('invite', { roles: [authorRole] });

                (0, _ghostAdminTestsHelpersAdapterError.errorOverride)();

                visit('/team');

                andThen(function () {
                    (0, _ghostAdminTestsHelpersAdapterError.errorReset)();
                    (0, _chai.expect)(currentPath()).to.equal('team.index');
                    (0, _chai.expect)(find('.gh-alert').length).to.equal(0);
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/team-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/team-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/acceptance/version-mismatch-test', ['exports', 'mocha', 'chai', 'ghost-admin/tests/helpers/start-app', 'ghost-admin/tests/helpers/destroy-app', 'ghost-admin/tests/helpers/ember-simple-auth', 'ghost-admin/mirage/utils'], function (exports, _mocha, _chai, _ghostAdminTestsHelpersStartApp, _ghostAdminTestsHelpersDestroyApp, _ghostAdminTestsHelpersEmberSimpleAuth, _ghostAdminMirageUtils) {

    (0, _mocha.describe)('Acceptance: Version Mismatch', function () {
        var application = undefined;

        (0, _mocha.beforeEach)(function () {
            application = (0, _ghostAdminTestsHelpersStartApp['default'])();
        });

        (0, _mocha.afterEach)(function () {
            (0, _ghostAdminTestsHelpersDestroyApp['default'])(application);
        });

        (0, _mocha.describe)('logged in', function () {
            (0, _mocha.beforeEach)(function () {
                var role = server.create('role', { name: 'Administrator' });
                server.create('user', { roles: [role] });

                return (0, _ghostAdminTestsHelpersEmberSimpleAuth.authenticateSession)(application);
            });

            (0, _mocha.it)('displays an alert and disables navigation when saving', function () {
                server.createList('post', 3);

                // mock the post save endpoint to return version mismatch
                server.put('/posts/:id', _ghostAdminMirageUtils.versionMismatchResponse);

                visit('/');
                click('.posts-list li:nth-of-type(2) a'); // select second post
                click('.js-publish-button'); // "Save post"

                andThen(function () {
                    // has the refresh to update alert
                    (0, _chai.expect)(find('.gh-alert').length).to.equal(1);
                    (0, _chai.expect)(find('.gh-alert').text()).to.match(/refresh/);
                });

                // try navigating back to the content list
                click('.gh-nav-main-content');

                andThen(function () {
                    (0, _chai.expect)(currentPath()).to.equal('editor.edit');
                });
            });

            (0, _mocha.it)('displays alert and aborts the transition when navigating', function () {
                visit('/');

                andThen(function () {
                    // mock the tags endpoint to return version mismatch
                    server.get('/tags/', _ghostAdminMirageUtils.versionMismatchResponse);
                });

                click('.gh-nav-settings-tags');

                andThen(function () {
                    // navigation is blocked on loading screen
                    (0, _chai.expect)(currentPath()).to.equal('settings.tags_loading');

                    // has the refresh to update alert
                    (0, _chai.expect)(find('.gh-alert').length).to.equal(1);
                    (0, _chai.expect)(find('.gh-alert').text()).to.match(/refresh/);
                });
            });

            (0, _mocha.it)('displays alert and aborts the transition when an ember-ajax error is thrown whilst navigating', function () {
                server.get('/configuration/timezones/', _ghostAdminMirageUtils.versionMismatchResponse);

                visit('/settings/tags');
                click('.gh-nav-settings-general');

                andThen(function () {
                    // navigation is blocked
                    (0, _chai.expect)(currentPath()).to.equal('settings.general_loading');

                    // has the refresh to update alert
                    (0, _chai.expect)(find('.gh-alert').length).to.equal(1);
                    (0, _chai.expect)(find('.gh-alert').text()).to.match(/refresh/);
                });
            });

            (0, _mocha.it)('can be triggered when passed in to a component', function () {
                server.post('/subscribers/csv/', _ghostAdminMirageUtils.versionMismatchResponse);

                visit('/subscribers');
                click('.gh-btn:contains("Import CSV")');
                fileUpload('.fullscreen-modal input[type="file"]', ['test'], { name: 'test.csv' });

                andThen(function () {
                    // alert is shown
                    (0, _chai.expect)(find('.gh-alert').length).to.equal(1);
                    (0, _chai.expect)(find('.gh-alert').text()).to.match(/refresh/);
                });
            });
        });

        (0, _mocha.describe)('logged out', function () {
            (0, _mocha.it)('displays alert', function () {
                server.post('/authentication/token', _ghostAdminMirageUtils.versionMismatchResponse);

                visit('/signin');
                fillIn('[name="identification"]', 'test@example.com');
                fillIn('[name="password"]', 'password');
                click('.gh-btn-blue');

                andThen(function () {
                    // has the refresh to update alert
                    (0, _chai.expect)(find('.gh-alert').length).to.equal(1);
                    (0, _chai.expect)(find('.gh-alert').text()).to.match(/refresh/);
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/acceptance/version-mismatch-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - acceptance/version-mismatch-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/adapters/application.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - adapters/application.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/adapters/base.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - adapters/base.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/adapters/embedded-relation-adapter.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - adapters/embedded-relation-adapter.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/adapters/setting.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - adapters/setting.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/adapters/tag.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - adapters/tag.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/adapters/theme.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - adapters/theme.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/adapters/user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - adapters/user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/app.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - app.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/authenticators/oauth2-ghost.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - authenticators/oauth2-ghost-d4c6e1e9448da6630953397cde85eac8.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/authenticators/oauth2.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - authenticators/oauth2.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/authorizers/oauth2.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - authorizers/oauth2.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-activating-list-item.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-activating-list-item.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-alert.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-alert.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-alerts.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-alerts.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-app.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-app.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-blog-url.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-blog-url.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-cm-editor.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-cm-editor.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-content-cover.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-content-cover.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-datetime-input.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-datetime-input.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-dropdown-button.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-dropdown-button.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-dropdown.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-dropdown.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-editor-save-button.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-editor-save-button.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-error-message.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-error-message.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-feature-flag.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-feature-flag.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-file-input.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-file-input.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-file-upload.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-file-upload.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-file-uploader.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-file-uploader.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-form-group.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-form-group.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-fullscreen-modal.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-fullscreen-modal.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-image-uploader-with-preview.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-image-uploader-with-preview.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-image-uploader.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-image-uploader.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-infinite-scroll.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-infinite-scroll.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-input.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-input.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-loading-spinner.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-loading-spinner.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-main.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-main.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-menu-toggle.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-menu-toggle.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-mobile-nav-bar.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-mobile-nav-bar.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-nav-menu.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-nav-menu.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-navigation.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-navigation.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-navitem-url-input.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-navitem-url-input.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-navitem.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-navitem.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-notification.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-notification.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-notifications.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-notifications.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-popover-button.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-popover-button.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-popover.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-popover.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-post-settings-menu.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-post-settings-menu.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-posts-list-item.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-posts-list-item.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-profile-image.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-profile-image.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-search-input.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-search-input.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-search-input/trigger.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-search-input/trigger.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-selectize.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-selectize.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-skip-link.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-skip-link.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-spin-button.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-spin-button.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-subscribers-table.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-subscribers-table.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-tab-pane.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-tab-pane.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-tab.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-tab.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-tabs-manager.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-tabs-manager.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-tag-settings-form.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-tag-settings-form.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-tag.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-tag.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-tags-management-container.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-tags-management-container.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-task-button.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-task-button.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-textarea.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-textarea.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-theme-error-li.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-theme-error-li.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-theme-table.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-theme-table.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-timezone-select.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-timezone-select.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-trim-focus-input.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-trim-focus-input.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-upgrade-notification.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-upgrade-notification.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-url-preview.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-url-preview.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-user-active.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-user-active.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-user-invited.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-user-invited.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-validation-status-container.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-validation-status-container.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/gh-view-title.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/gh-view-title.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/base.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/base.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/copy-html.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/copy-html.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/delete-all.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/delete-all.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/delete-post.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/delete-post.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/delete-subscriber.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/delete-subscriber.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/delete-tag.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/delete-tag.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/delete-theme.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/delete-theme.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/delete-user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/delete-user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/import-subscribers.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/import-subscribers.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/invite-new-user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/invite-new-user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/leave-editor.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/leave-editor.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/markdown-help.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/markdown-help.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/new-subscriber.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/new-subscriber.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/re-authenticate.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/re-authenticate.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/suspend-user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/suspend-user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/theme-warnings.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/theme-warnings.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/transfer-owner.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/transfer-owner.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/unsuspend-user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/unsuspend-user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/upload-image.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/upload-image.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/components/modals/upload-theme.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - components/modals/upload-theme.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/about.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/about.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/application.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/application.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/editor/edit.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/editor/edit.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/editor/new.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/editor/new.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/error.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/error.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/posts-loading.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/posts-loading.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/posts.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/posts.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/reset.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/reset.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/settings/apps/amp.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/settings/apps/amp.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/settings/apps/index.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/settings/apps/index.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/settings/apps/slack.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/settings/apps/slack.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/settings/code-injection.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/settings/code-injection.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/settings/design.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/settings/design.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/settings/general.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/settings/general.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/settings/labs.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/settings/labs.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/settings/tags.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/settings/tags.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/settings/tags/tag.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/settings/tags/tag.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/setup.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/setup.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/setup/three.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/setup/three.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/setup/two.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/setup/two.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/signin.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/signin.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/signup.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/signup.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/subscribers.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/subscribers.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/team/index.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/team/index.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/controllers/team/user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - controllers/team/user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/adapter-error', ['exports', 'ember', 'ember-test'], function (exports, _ember, _emberTest) {
    exports.errorOverride = errorOverride;
    exports.errorReset = errorReset;

    // This is needed for testing error responses in acceptance tests
    // See http://williamsbdev.com/posts/testing-rsvp-errors-handled-globally/

    // ember-cli-shims doesn't export Logger
    var Logger = _ember['default'].Logger;

    var originalException = undefined,
        originalLoggerError = undefined;

    function errorOverride() {
        originalException = _emberTest['default'].adapter.exception;
        originalLoggerError = Logger.error;
        _emberTest['default'].adapter.exception = function () {};
        Logger.error = function () {};
    }

    function errorReset() {
        _emberTest['default'].adapter.exception = originalException;
        Logger.error = originalLoggerError;
    }
});
define('ghost-admin/tests/helpers/adapter-error.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/adapter-error.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/configuration', ['exports', 'ember-utils'], function (exports, _emberUtils) {
    exports.enableGhostOAuth = enableGhostOAuth;

    function enableGhostOAuth(server) {
        if ((0, _emberUtils.isEmpty)(server.db.configurations)) {
            server.loadFixtures('configurations');
        }

        server.db.configurations.update(1, {
            ghostAuthId: '6e0704b3-c653-4c12-8da7-584232b5c629',
            ghostAuthUrl: 'http://devauth.ghost.org:8080'
        });
    }
});
define('ghost-admin/tests/helpers/configuration.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/configuration.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/destroy-app', ['exports', 'ember-runloop'], function (exports, _emberRunloop) {
    exports['default'] = destroyApp;

    function destroyApp(application) {
        // this is required to fix "second Pretender instance" warnings
        if (server) {
            server.shutdown();
        }

        (0, _emberRunloop['default'])(application, 'destroy');
    }
});
define('ghost-admin/tests/helpers/destroy-app.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/destroy-app.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/editor-helpers', ['exports', 'ember', 'jquery'], function (exports, _ember, _jquery) {
    exports.editorRendered = editorRendered;
    exports.inputText = inputText;
    exports.testInput = testInput;
    exports.waitForRender = waitForRender;

    // polls the editor until it's started.

    function editorRendered() {
        return _ember['default'].Test.promise(function (resolve) {
            // eslint-disable-line
            function checkEditor() {
                if (window.editor) {
                    return resolve();
                } else {
                    window.requestAnimationFrame(checkEditor);
                }
            }
            checkEditor();
        });
    }

    // simulates text inputs into the editor, unfortunately the helper Ember helper functions
    // don't work on content editable so we have to manipuate the text input event manager
    // in mobiledoc-kit directly. This is a private API.

    function inputText(editor, text) {
        editor._eventManager._textInputHandler.handle(text);
    }

    // inputs text and waits for the editor to modify the dom with the desired result or timesout.

    function testInput(input, output, expect) {
        window.editor.element.focus(); // for some reason the editor doesn't work until it's focused when run in ghost-admin.
        return _ember['default'].Test.promise(function (resolve, reject) {
            // eslint-disable-line
            var lastRender = '';
            var isRejected = false;
            var rejectTimeout = window.setTimeout(function () {
                expect(lastRender).to.equal(output); // we know this is false but include it for the output.
                reject(lastRender);
                isRejected = true;
            }, 500);
            window.editor.didRender(function () {
                lastRender = window.editor.element.innerHTML;
                if (window.editor.element.innerHTML === output && !isRejected) {
                    window.clearTimeout(rejectTimeout);
                    expect(lastRender).to.equal(output); // we know this is true but include it for the output.
                    return resolve(lastRender);
                }
            });
            inputText(window.editor, input);
        });
    }

    function waitForRender(selector) {
        var isRejected = false;
        return _ember['default'].Test.promise(function (resolve, reject) {
            // eslint-disable-line
            var rejectTimeout = window.setTimeout(function () {
                reject('element didn\'t render');
                isRejected = true;
            }, 1500);

            function checkIsRendered() {
                if ((0, _jquery['default'])(selector)[0] && !isRejected) {
                    window.clearTimeout(rejectTimeout);
                    return resolve();
                } else {
                    window.requestAnimationFrame(checkIsRendered);
                }
            }
            checkIsRendered();
        });
    }
});
define('ghost-admin/tests/helpers/editor-helpers.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/editor-helpers.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/ember-basic-dropdown', ['exports', 'ember', 'ember-runloop', 'jquery', 'ember-native-dom-helpers/test-support/helpers'], function (exports, _ember, _emberRunloop, _jquery, _emberNativeDomHelpersTestSupportHelpers) {
  exports.nativeTap = nativeTap;
  exports.clickTrigger = clickTrigger;
  exports.tapTrigger = tapTrigger;
  exports.fireKeydown = fireKeydown;
  var nativeClick = _emberNativeDomHelpersTestSupportHelpers.click;

  exports.nativeClick = nativeClick;

  function nativeTap(selector) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    var touchStartEvent = new window.Event('touchstart', { bubbles: true, cancelable: true, view: window });
    Object.keys(options).forEach(function (key) {
      return touchStartEvent[key] = options[key];
    });
    (0, _emberRunloop['default'])(function () {
      return document.querySelector(selector).dispatchEvent(touchStartEvent);
    });
    var touchEndEvent = new window.Event('touchend', { bubbles: true, cancelable: true, view: window });
    Object.keys(options).forEach(function (key) {
      return touchEndEvent[key] = options[key];
    });
    (0, _emberRunloop['default'])(function () {
      return document.querySelector(selector).dispatchEvent(touchEndEvent);
    });
  }

  function clickTrigger(scope) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    var selector = '.ember-basic-dropdown-trigger';
    if (scope) {
      var $element = (0, _jquery['default'])(scope);
      if ($element.hasClass('ember-basic-dropdown-trigger')) {
        selector = scope;
      } else {
        selector = scope + ' ' + selector;
      }
    }
    (0, _emberNativeDomHelpersTestSupportHelpers.click)(selector, options);
  }

  function tapTrigger(scope) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    var selector = '.ember-basic-dropdown-trigger';
    if (scope) {
      selector = scope + ' ' + selector;
    }
    nativeTap(selector, options);
  }

  function fireKeydown(selector, k) {
    var oEvent = document.createEvent('Events');
    oEvent.initEvent('keydown', true, true);
    _jquery['default'].extend(oEvent, {
      view: window,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      keyCode: k,
      charCode: k
    });
    (0, _emberRunloop['default'])(function () {
      return document.querySelector(selector).dispatchEvent(oEvent);
    });
  }

  // acceptance helpers

  exports['default'] = function () {
    _ember['default'].Test.registerAsyncHelper('clickDropdown', function (app, cssPath) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      clickTrigger(cssPath, options);
    });

    _ember['default'].Test.registerAsyncHelper('tapDropdown', function (app, cssPath) {
      var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

      tapTrigger(cssPath, options);
    });
  };
});
define('ghost-admin/tests/helpers/ember-power-select', ['exports', 'jquery', 'ember-runloop', 'ember-test', 'ember-native-dom-helpers/test-support/helpers'], function (exports, _jquery, _emberRunloop, _emberTest, _emberNativeDomHelpersTestSupportHelpers) {
  exports.nativeMouseDown = nativeMouseDown;
  exports.nativeMouseUp = nativeMouseUp;
  exports.triggerKeydown = triggerKeydown;
  exports.typeInSearch = typeInSearch;
  exports.clickTrigger = clickTrigger;
  exports.nativeTouch = nativeTouch;
  exports.touchTrigger = touchTrigger;

  // Helpers for integration tests
  function fireNativeMouseEvent(eventType, selectorOrDomElement) {
    var options = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    var event = undefined,
        target = undefined;
    try {
      event = new window.Event(eventType, { bubbles: true, cancelable: true, view: window });
    } catch (e) {
      // fix IE11: "Object doesn't support this action"
      event = document.createEvent('Event');
      var bubbles = true;
      var cancelable = true;
      event.initEvent(eventType, bubbles, cancelable);
    }

    Object.keys(options).forEach(function (key) {
      return event[key] = options[key];
    });
    if (typeof selectorOrDomElement === 'string') {
      target = (0, _jquery['default'])(selectorOrDomElement)[0];
    } else {
      target = selectorOrDomElement;
    }
    (0, _emberRunloop['default'])(function () {
      return target.dispatchEvent(event);
    });
  }

  function nativeMouseDown(selectorOrDomElement, options) {
    fireNativeMouseEvent('mousedown', selectorOrDomElement, options);
  }

  function nativeMouseUp(selectorOrDomElement, options) {
    fireNativeMouseEvent('mouseup', selectorOrDomElement, options);
  }

  function triggerKeydown(domElement, k) {
    var oEvent = document.createEvent('Events');
    oEvent.initEvent('keydown', true, true);
    _jquery['default'].extend(oEvent, {
      view: window,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      keyCode: k,
      charCode: k
    });
    (0, _emberRunloop['default'])(function () {
      domElement.dispatchEvent(oEvent);
    });
  }

  function typeInSearch(scopeOrText, text) {
    var scope = '';

    if (typeof text === 'undefined') {
      text = scopeOrText;
    } else {
      scope = scopeOrText;
    }

    var selectors = ['.ember-power-select-search-input', '.ember-power-select-search input', '.ember-power-select-trigger-multiple-input', 'input[type="search"]'].map(function (selector) {
      return scope + ' ' + selector;
    }).join(', ');

    return (0, _emberNativeDomHelpersTestSupportHelpers.fillIn)(selectors, text);
  }

  function clickTrigger(scope) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

    var selector = '.ember-power-select-trigger';
    if (scope) {
      selector = scope + ' ' + selector;
    }
    return (0, _emberNativeDomHelpersTestSupportHelpers.click)(selector, options);
  }

  function nativeTouch(selectorOrDomElement) {
    var event = new window.Event('touchstart', { bubbles: true, cancelable: true, view: window });
    var target = undefined;

    if (typeof selectorOrDomElement === 'string') {
      target = (0, _jquery['default'])(selectorOrDomElement)[0];
    } else {
      target = selectorOrDomElement;
    }
    (0, _emberRunloop['default'])(function () {
      return target.dispatchEvent(event);
    });
    (0, _emberRunloop['default'])(function () {
      event = new window.Event('touchend', { bubbles: true, cancelable: true, view: window });
      target.dispatchEvent(event);
    });
  }

  function touchTrigger() {
    var selector = '.ember-power-select-trigger';
    nativeTouch(selector);
  }

  // Helpers for acceptance tests

  exports['default'] = function () {
    _emberTest['default'].registerAsyncHelper('selectChoose', function (app, cssPath, valueOrSelector) {
      var $trigger = find(cssPath + ' .ember-power-select-trigger');

      if ($trigger === undefined || $trigger.length === 0) {
        $trigger = find(cssPath);
      }

      if ($trigger.length === 0) {
        throw new Error('You called "selectChoose(\'' + cssPath + '\', \'' + valueOrSelector + '\')" but no select was found using selector "' + cssPath + '"');
      }

      var contentId = '' + $trigger.attr('aria-owns');
      var $content = find('#' + contentId);
      // If the dropdown is closed, open it
      if ($content.length === 0 || $content.hasClass('ember-basic-dropdown-content-placeholder')) {
        nativeMouseDown($trigger.get(0));
        wait();
      }

      // Select the option with the given text
      andThen(function () {
        var potentialTargets = (0, _jquery['default'])('#' + contentId + ' .ember-power-select-option:contains("' + valueOrSelector + '")').toArray();
        var target = undefined;
        if (potentialTargets.length === 0) {
          // If treating the value as text doesn't gave use any result, let's try if it's a css selector
          potentialTargets = (0, _jquery['default'])('#' + contentId + ' ' + valueOrSelector).toArray();
        }
        if (potentialTargets.length > 1) {
          target = potentialTargets.filter(function (t) {
            return t.textContent.trim() === valueOrSelector;
          })[0] || potentialTargets[0];
        } else {
          target = potentialTargets[0];
        }
        if (!target) {
          throw new Error('You called "selectChoose(\'' + cssPath + '\', \'' + valueOrSelector + '\')" but "' + valueOrSelector + '" didn\'t match any option');
        }
        nativeMouseUp(target);
      });
    });

    _emberTest['default'].registerAsyncHelper('selectSearch', function (app, cssPath, value) {
      var triggerPath = cssPath + ' .ember-power-select-trigger';
      var $trigger = find(triggerPath);
      if ($trigger === undefined || $trigger.length === 0) {
        triggerPath = cssPath;
        $trigger = find(triggerPath);
      }

      if ($trigger.length === 0) {
        throw new Error('You called "selectSearch(\'' + cssPath + '\', \'' + value + '\')" but no select was found using selector "' + cssPath + '"');
      }

      var contentId = '' + $trigger.attr('aria-owns');
      var isMultipleSelect = (0, _jquery['default'])(cssPath + ' .ember-power-select-trigger-multiple-input').length > 0;

      var $content = (0, _jquery['default'])('#' + contentId);
      var dropdownIsClosed = $content.length === 0 || $content.hasClass('ember-basic-dropdown-content-placeholder');
      if (dropdownIsClosed) {
        nativeMouseDown(triggerPath);
        wait();
      }
      var isDefaultSingleSelect = (0, _jquery['default'])('.ember-power-select-search-input').length > 0;

      if (isMultipleSelect) {
        (0, _emberNativeDomHelpersTestSupportHelpers.fillIn)(triggerPath + ' .ember-power-select-trigger-multiple-input', value);
      } else if (isDefaultSingleSelect) {
        (0, _emberNativeDomHelpersTestSupportHelpers.fillIn)('.ember-power-select-search-input', value);
      } else {
        // It's probably a customized version
        var inputIsInTrigger = !!find(cssPath + ' .ember-power-select-trigger input[type=search]')[0];
        if (inputIsInTrigger) {
          (0, _emberNativeDomHelpersTestSupportHelpers.fillIn)(triggerPath + ' input[type=search]', value);
        } else {
          (0, _emberNativeDomHelpersTestSupportHelpers.fillIn)('#' + contentId + ' .ember-power-select-search-input[type=search]', 'input');
        }
      }
    });

    _emberTest['default'].registerAsyncHelper('removeMultipleOption', function (app, cssPath, value) {
      var elem = find(cssPath + ' .ember-power-select-multiple-options > li:contains(' + value + ') > .ember-power-select-multiple-remove-btn').get(0);
      try {
        nativeMouseDown(elem);
        wait();
      } catch (e) {
        console.warn('css path to remove btn not found');
        throw e;
      }
    });

    _emberTest['default'].registerAsyncHelper('clearSelected', function (app, cssPath) {
      var elem = find(cssPath + ' .ember-power-select-clear-btn').get(0);
      try {
        nativeMouseDown(elem);
        wait();
      } catch (e) {
        console.warn('css path to clear btn not found');
        throw e;
      }
    });
  };
});
define('ghost-admin/tests/helpers/ember-simple-auth', ['exports', 'ember-simple-auth/authenticators/test'], function (exports, _emberSimpleAuthAuthenticatorsTest) {
  exports.authenticateSession = authenticateSession;
  exports.currentSession = currentSession;
  exports.invalidateSession = invalidateSession;

  var TEST_CONTAINER_KEY = 'authenticator:test';

  function ensureAuthenticator(app, container) {
    var authenticator = container.lookup(TEST_CONTAINER_KEY);
    if (!authenticator) {
      app.register(TEST_CONTAINER_KEY, _emberSimpleAuthAuthenticatorsTest['default']);
    }
  }

  function authenticateSession(app, sessionData) {
    var container = app.__container__;

    var session = container.lookup('service:session');
    ensureAuthenticator(app, container);
    session.authenticate(TEST_CONTAINER_KEY, sessionData);
    return wait();
  }

  function currentSession(app) {
    return app.__container__.lookup('service:session');
  }

  function invalidateSession(app) {
    var session = app.__container__.lookup('service:session');
    if (session.get('isAuthenticated')) {
      session.invalidate();
    }
    return wait();
  }
});
/* global wait */
define('ghost-admin/tests/helpers/ember-sortable/test-helpers', ['exports', 'ember-sortable/helpers/drag', 'ember-sortable/helpers/reorder'], function (exports, _emberSortableHelpersDrag, _emberSortableHelpersReorder) {});
define('ghost-admin/tests/helpers/ember-test-selectors', ['exports', 'ember', 'ember-test-selectors'], function (exports, _ember, _emberTestSelectors) {

  var message = 'Importing testSelector() from "<appname>/tests/helpers/ember-test-selectors" is deprecated. ' + 'Please import testSelector() from "ember-test-selectors" instead.';

  _ember['default'].deprecate(message, false, {
    id: 'ember-test-selectors.test-selector-import',
    until: '0.2.0',
    url: 'https://github.com/simplabs/ember-test-selectors#usage'
  });

  exports['default'] = _emberTestSelectors['default'];
});
define('ghost-admin/tests/helpers/file-upload', ['exports', 'jquery', 'ember-test'], function (exports, _jquery, _emberTest) {
    exports.createFile = createFile;
    exports.fileUpload = fileUpload;

    function createFile() {
        var content = arguments.length <= 0 || arguments[0] === undefined ? ['test'] : arguments[0];
        var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
        var name = options.name;
        var type = options.type;

        var file = new Blob(content, { type: type ? type : 'text/plain' });
        file.name = name ? name : 'test.txt';

        return file;
    }

    function fileUpload($element, content, options) {
        var file = createFile(content, options);
        // eslint-disable-next-line new-cap
        var event = _jquery['default'].Event('change', {
            testingFiles: [file]
        });

        $element.trigger(event);
    }

    exports['default'] = _emberTest['default'].registerAsyncHelper('fileUpload', function (app, selector, content, options) {
        var file = createFile(content, options);

        return triggerEvent(selector, 'change', { foor: 'bar', testingFiles: [file] });
    });
});
/* global Blob */
define('ghost-admin/tests/helpers/file-upload.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/file-upload.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/gh-count-characters.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/gh-count-characters.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/gh-count-down-characters.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/gh-count-down-characters.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/gh-count-words.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/gh-count-words.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/gh-format-html.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/gh-format-html.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/gh-format-time-scheduled.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/gh-format-time-scheduled.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/gh-format-timeago.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/gh-format-timeago.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/gh-path.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/gh-path.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/gh-user-can-admin.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/gh-user-can-admin.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/highlighted-text.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/highlighted-text.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/is-equal.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/is-equal.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/is-not.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/is-not.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/oauth', ['exports', 'ember-cli-mirage', 'rsvp'], function (exports, _emberCliMirage, _rsvp) {

    var generateCode = function generateCode() {
        return _emberCliMirage.faker.internet.password(32, false, /[a-zA-Z0-9]/);
    };

    var generateSecret = function generateSecret() {
        return _emberCliMirage.faker.internet.password(12, false, /[a-f0-9]/);
    };

    var stubSuccessfulOAuthConnect = function stubSuccessfulOAuthConnect(application) {
        var provider = application.__container__.lookup('torii-provider:ghost-oauth2');

        provider.open = function () {
            return _rsvp['default'].Promise.resolve({
                /* eslint-disable camelcase */
                authorizationCode: generateCode(),
                client_id: 'ghost-admin',
                client_secret: generateSecret(),
                provider: 'ghost-oauth2',
                redirectUrl: 'http://localhost:2368/ghost/'
                /* eslint-enable camelcase */
            });
        };
    };

    var stubFailedOAuthConnect = function stubFailedOAuthConnect(application) {
        var provider = application.__container__.lookup('torii-provider:ghost-oauth2');

        provider.open = function () {
            return _rsvp['default'].Promise.reject();
        };
    };

    exports.stubSuccessfulOAuthConnect = stubSuccessfulOAuthConnect;
    exports.stubFailedOAuthConnect = stubFailedOAuthConnect;
});
define('ghost-admin/tests/helpers/oauth.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/oauth.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/resolver', ['exports', 'ghost-admin/resolver', 'ghost-admin/config/environment'], function (exports, _ghostAdminResolver, _ghostAdminConfigEnvironment) {

    var resolver = _ghostAdminResolver['default'].create();

    resolver.namespace = {
        modulePrefix: _ghostAdminConfigEnvironment['default'].modulePrefix,
        podModulePrefix: _ghostAdminConfigEnvironment['default'].podModulePrefix
    };

    exports['default'] = resolver;
});
define('ghost-admin/tests/helpers/resolver.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/resolver.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/start-app', ['exports', 'ember-platform', 'ember-runloop', 'ghost-admin/app', 'ghost-admin/config/environment', 'ghost-admin/tests/helpers/ember-power-select', 'ghost-admin/tests/helpers/file-upload'], function (exports, _emberPlatform, _emberRunloop, _ghostAdminApp, _ghostAdminConfigEnvironment, _ghostAdminTestsHelpersEmberPowerSelect, _ghostAdminTestsHelpersFileUpload) {
    exports['default'] = startApp;

    (0, _ghostAdminTestsHelpersEmberPowerSelect['default'])();

    function startApp(attrs) {
        var application = undefined;

        var attributes = (0, _emberPlatform.assign)({}, _ghostAdminConfigEnvironment['default'].APP);
        attributes = (0, _emberPlatform.assign)(attributes, attrs); // use defaults, but you can override;

        (0, _emberRunloop['default'])(function () {
            application = _ghostAdminApp['default'].create(attributes);
            application.setupForTesting();
            application.injectTestHelpers();
        });

        return application;
    }
});

// eslint-disable-next-line no-unused-vars
define('ghost-admin/tests/helpers/start-app.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - helpers/start-app.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/helpers/torii', ['exports'], function (exports) {
  exports.stubValidSession = stubValidSession;

  function stubValidSession(application, sessionData) {
    var session = application.__container__.lookup('service:session');
    var sm = session.get('stateMachine');
    Ember.run(function () {
      sm.send('startOpen');
      sm.send('finishOpen', sessionData);
    });
  }
});
define('ghost-admin/tests/initializers/ember-simple-auth.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - initializers/ember-simple-auth.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/initializers/event-dispatcher.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - initializers/event-dispatcher.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/initializers/trailing-hash.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - initializers/trailing-hash.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/initializers/upgrade-status.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - initializers/upgrade-status.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/instance-initializers/jquery-ajax-oauth-prefilter.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - instance-initializers/jquery-ajax-oauth-prefilter.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/adapters/tag-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'pretender'], function (exports, _chai, _mocha, _emberMocha, _pretender) {

    (0, _mocha.describe)('Integration: Adapter: tag', function () {
        (0, _emberMocha.setupTest)('adapter:tag', {
            integration: true
        });

        var server = undefined,
            store = undefined;

        beforeEach(function () {
            store = this.container.lookup('service:store');
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('loads tags from regular endpoint when all are fetched', function (done) {
            server.get('/ghost/api/v0.1/tags/', function () {
                return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ tags: [{
                        id: 1,
                        name: 'Tag 1',
                        slug: 'tag-1'
                    }, {
                        id: 2,
                        name: 'Tag 2',
                        slug: 'tag-2'
                    }] })];
            });

            store.findAll('tag', { reload: true }).then(function (tags) {
                (0, _chai.expect)(tags).to.be.ok;
                (0, _chai.expect)(tags.objectAtContent(0).get('name')).to.equal('Tag 1');
                done();
            });
        });

        (0, _mocha.it)('loads tag from slug endpoint when single tag is queried and slug is passed in', function (done) {
            server.get('/ghost/api/v0.1/tags/slug/tag-1/', function () {
                return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ tags: [{
                        id: 1,
                        slug: 'tag-1',
                        name: 'Tag 1'
                    }] })];
            });

            store.queryRecord('tag', { slug: 'tag-1' }).then(function (tag) {
                (0, _chai.expect)(tag).to.be.ok;
                (0, _chai.expect)(tag.get('name')).to.equal('Tag 1');
                done();
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/adapters/tag-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/adapters/tag-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/adapters/user-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'pretender'], function (exports, _chai, _mocha, _emberMocha, _pretender) {

    (0, _mocha.describe)('Integration: Adapter: user', function () {
        (0, _emberMocha.setupTest)('adapter:user', {
            integration: true
        });

        var server = undefined,
            store = undefined;

        beforeEach(function () {
            store = this.container.lookup('service:store');
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('loads users from regular endpoint when all are fetched', function (done) {
            server.get('/ghost/api/v0.1/users/', function () {
                return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ users: [{
                        id: 1,
                        name: 'User 1',
                        slug: 'user-1'
                    }, {
                        id: 2,
                        name: 'User 2',
                        slug: 'user-2'
                    }] })];
            });

            store.findAll('user', { reload: true }).then(function (users) {
                (0, _chai.expect)(users).to.be.ok;
                (0, _chai.expect)(users.objectAtContent(0).get('name')).to.equal('User 1');
                done();
            });
        });

        (0, _mocha.it)('loads user from slug endpoint when single user is queried and slug is passed in', function (done) {
            server.get('/ghost/api/v0.1/users/slug/user-1/', function () {
                return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ users: [{
                        id: 1,
                        slug: 'user-1',
                        name: 'User 1'
                    }] })];
            });

            store.queryRecord('user', { slug: 'user-1' }).then(function (user) {
                (0, _chai.expect)(user).to.be.ok;
                (0, _chai.expect)(user.get('name')).to.equal('User 1');
                done();
            });
        });

        (0, _mocha.it)('handles "include" parameter when querying single user via slug', function (done) {
            server.get('/ghost/api/v0.1/users/slug/user-1/', function (request) {
                var params = request.queryParams;
                (0, _chai.expect)(params.include, 'include query').to.equal('roles,count.posts');

                return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ users: [{
                        id: 1,
                        slug: 'user-1',
                        name: 'User 1',
                        count: {
                            posts: 5
                        }
                    }] })];
            });

            store.queryRecord('user', { slug: 'user-1', include: 'count.posts' }).then(function (user) {
                (0, _chai.expect)(user).to.be.ok;
                (0, _chai.expect)(user.get('name')).to.equal('User 1');
                (0, _chai.expect)(user.get('count.posts')).to.equal(5);
                done();
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/adapters/user-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/adapters/user-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-alert-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Integration: Component: gh-alert', function () {
        (0, _emberMocha.setupComponentTest)('gh-alert', {
            integration: true
        });

        (0, _mocha.it)('renders', function () {
            this.set('message', { message: 'Test message', type: 'success' });

            this.render(Ember.HTMLBars.template({
                'id': '8qQzEOdi',
                'block': '{"statements":[["append",["helper",["gh-alert"],null,[["message"],[["get",["message"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$('article.gh-alert')).to.have.length(1);
            var $alert = this.$('.gh-alert');

            (0, _chai.expect)($alert.text()).to.match(/Test message/);
        });

        (0, _mocha.it)('maps message types to CSS classes', function () {
            this.set('message', { message: 'Test message', type: 'success' });

            this.render(Ember.HTMLBars.template({
                'id': '8qQzEOdi',
                'block': '{"statements":[["append",["helper",["gh-alert"],null,[["message"],[["get",["message"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $alert = this.$('.gh-alert');

            this.set('message.type', 'success');
            (0, _chai.expect)($alert.hasClass('gh-alert-green'), 'success class isn\'t green').to.be['true'];

            this.set('message.type', 'error');
            (0, _chai.expect)($alert.hasClass('gh-alert-red'), 'success class isn\'t red').to.be['true'];

            this.set('message.type', 'warn');
            (0, _chai.expect)($alert.hasClass('gh-alert-yellow'), 'success class isn\'t yellow').to.be['true'];

            this.set('message.type', 'info');
            (0, _chai.expect)($alert.hasClass('gh-alert-blue'), 'success class isn\'t blue').to.be['true'];
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-alert-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-alert-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-alerts-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-service', 'ember-array/utils'], function (exports, _chai, _mocha, _emberMocha, _emberService, _emberArrayUtils) {

    var notificationsStub = _emberService['default'].extend({
        alerts: (0, _emberArrayUtils.A)()
    });

    (0, _mocha.describe)('Integration: Component: gh-alerts', function () {
        (0, _emberMocha.setupComponentTest)('gh-alerts', {
            integration: true
        });

        beforeEach(function () {
            this.register('service:notifications', notificationsStub);
            this.inject.service('notifications', { as: 'notifications' });

            this.set('notifications.alerts', [{ message: 'First', type: 'error' }, { message: 'Second', type: 'warn' }]);
        });

        (0, _mocha.it)('renders', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'AKAVWpEx',
                'block': '{"statements":[["append",["unknown",["gh-alerts"]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.gh-alerts').length).to.equal(1);
            (0, _chai.expect)(this.$('.gh-alerts').children().length).to.equal(2);

            this.set('notifications.alerts', (0, _emberArrayUtils.A)());
            (0, _chai.expect)(this.$('.gh-alerts').children().length).to.equal(0);
        });

        (0, _mocha.it)('triggers "notify" action when message count changes', function () {
            var expectedCount = 0;

            // test double for notify action
            this.set('notify', function (count) {
                return (0, _chai.expect)(count).to.equal(expectedCount);
            });

            this.render(Ember.HTMLBars.template({
                'id': 't2wOqhRz',
                'block': '{"statements":[["append",["helper",["gh-alerts"],null,[["notify"],[["helper",["action"],[["get",[null]],["get",["notify"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            expectedCount = 3;
            this.get('notifications.alerts').pushObject({ message: 'Third', type: 'success' });

            expectedCount = 0;
            this.set('notifications.alerts', (0, _emberArrayUtils.A)());
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-alerts-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-alerts-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-cm-editor-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-runloop'], function (exports, _chai, _mocha, _emberMocha, _emberRunloop) {

    (0, _mocha.describe)('Integration: Component: gh-cm-editor', function () {
        (0, _emberMocha.setupComponentTest)('gh-cm-editor', {
            integration: true
        });

        (0, _mocha.it)('handles editor events', function () {
            this.set('text', '');

            this.render(Ember.HTMLBars.template({
                'id': 'J601sKUZ',
                'block': '{"statements":[["append",["helper",["gh-cm-editor"],[["get",["text"]]],[["class","update"],["gh-input",["helper",["action"],[["get",[null]],["helper",["mut"],[["get",["text"]]],null]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var input = this.$('.gh-input');

            (0, _chai.expect)(input.hasClass('focused'), 'has focused class on first render').to.be['false'];

            (0, _emberRunloop['default'])(function () {
                input.find('textarea').trigger('focus');
            });

            (0, _chai.expect)(input.hasClass('focused'), 'has focused class after focus').to.be['true'];

            (0, _emberRunloop['default'])(function () {
                input.find('textarea').trigger('blur');
            });

            (0, _chai.expect)(input.hasClass('focused'), 'loses focused class on blur').to.be['false'];

            (0, _emberRunloop['default'])(function () {
                // access CodeMirror directly as it doesn't pick up changes
                // to the textarea
                var cm = input.find('.CodeMirror').get(0).CodeMirror;
                cm.setValue('Testing');
            });

            (0, _chai.expect)(this.get('text'), 'text value after CM editor change').to.equal('Testing');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-cm-editor-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-cm-editor-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-feature-flag-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-service'], function (exports, _chai, _mocha, _emberMocha, _emberService) {

    var featureStub = _emberService['default'].extend({
        testFlag: true
    });

    (0, _mocha.describe)('Integration: Component: gh-feature-flag', function () {
        (0, _emberMocha.setupComponentTest)('gh-feature-flag', {
            integration: true
        });

        beforeEach(function () {
            this.register('service:feature', featureStub);
            this.inject.service('feature', { as: 'feature' });
        });

        (0, _mocha.it)('renders properties correctly', function () {
            this.render(Ember.HTMLBars.template({
                'id': '9kk+zbRp',
                'block': '{"statements":[["append",["helper",["gh-feature-flag"],["testFlag"],null],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);
            (0, _chai.expect)(this.$('label').attr('for')).to.equal(this.$('input[type="checkbox"]').attr('id'));
        });

        (0, _mocha.it)('renders correctly when flag is set to true', function () {
            this.render(Ember.HTMLBars.template({
                'id': '9kk+zbRp',
                'block': '{"statements":[["append",["helper",["gh-feature-flag"],["testFlag"],null],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);
            (0, _chai.expect)(this.$('label input[type="checkbox"]').prop('checked')).to.be['true'];
        });

        (0, _mocha.it)('renders correctly when flag is set to false', function () {
            this.set('feature.testFlag', false);

            this.render(Ember.HTMLBars.template({
                'id': '9kk+zbRp',
                'block': '{"statements":[["append",["helper",["gh-feature-flag"],["testFlag"],null],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);

            (0, _chai.expect)(this.$('label input[type="checkbox"]').prop('checked')).to.be['false'];
        });

        (0, _mocha.it)('updates to reflect changes in flag property', function () {
            this.render(Ember.HTMLBars.template({
                'id': '9kk+zbRp',
                'block': '{"statements":[["append",["helper",["gh-feature-flag"],["testFlag"],null],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);

            (0, _chai.expect)(this.$('label input[type="checkbox"]').prop('checked')).to.be['true'];

            this.$('label').click();

            (0, _chai.expect)(this.$('label input[type="checkbox"]').prop('checked')).to.be['false'];
        });
    });
});
define('ghost-admin/tests/integration/components/gh-feature-flag-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-feature-flag-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-file-uploader-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'jquery', 'ember-runloop', 'pretender', 'ember-test-helpers/wait', 'sinon', 'ghost-admin/tests/helpers/file-upload', 'ember-service', 'ghost-admin/services/ajax'], function (exports, _chai, _mocha, _emberMocha, _jquery, _emberRunloop, _pretender, _emberTestHelpersWait, _sinon, _ghostAdminTestsHelpersFileUpload, _emberService, _ghostAdminServicesAjax) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    var notificationsStub = _emberService['default'].extend({
        showAPIError: function showAPIError() {
            // noop - to be stubbed
        }
    });

    var stubSuccessfulUpload = function stubSuccessfulUpload(server) {
        var delay = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

        server.post('/ghost/api/v0.1/uploads/', function () {
            return [200, { 'Content-Type': 'application/json' }, '"/content/images/test.png"'];
        }, delay);
    };

    var stubFailedUpload = function stubFailedUpload(server, code, error) {
        var delay = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];

        server.post('/ghost/api/v0.1/uploads/', function () {
            return [code, { 'Content-Type': 'application/json' }, JSON.stringify({
                errors: [{
                    errorType: error,
                    message: 'Error: ' + error
                }]
            })];
        }, delay);
    };

    (0, _mocha.describe)('Integration: Component: gh-file-uploader', function () {
        (0, _emberMocha.setupComponentTest)('gh-file-uploader', {
            integration: true
        });

        var server = undefined;

        beforeEach(function () {
            server = new _pretender['default']();
            this.set('uploadUrl', '/ghost/api/v0.1/uploads/');

            this.register('service:notifications', notificationsStub);
            this.inject.service('notifications', { as: 'notifications' });
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('renders', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'TZxN1RA1',
                'block': '{"statements":[["append",["unknown",["gh-file-uploader"]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$('label').text().trim(), 'default label').to.equal('Select or drag-and-drop a file');
        });

        (0, _mocha.it)('allows file input "accept" attribute to be changed', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'TZxN1RA1',
                'block': '{"statements":[["append",["unknown",["gh-file-uploader"]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('input[type="file"]').attr('accept'), 'default "accept" attribute').to.equal('text/csv');

            this.render(Ember.HTMLBars.template({
                'id': 'JsEDYt05',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["accept"],["application/zip"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('input[type="file"]').attr('accept'), 'specified "accept" attribute').to.equal('application/zip');
        });

        (0, _mocha.it)('renders form with supplied label text', function () {
            this.set('labelText', 'My label');
            this.render(Ember.HTMLBars.template({
                'id': '8icxJCJn',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["labelText"],[["get",["labelText"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$('label').text().trim(), 'label').to.equal('My label');
        });

        (0, _mocha.it)('generates request to supplied endpoint', function (done) {
            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'ufeI2sZv',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url"],[["get",["uploadUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(server.handledRequests.length).to.equal(1);
                (0, _chai.expect)(server.handledRequests[0].url).to.equal('/ghost/api/v0.1/uploads/');
                done();
            });
        });

        (0, _mocha.it)('fires uploadSuccess action on successful upload', function (done) {
            var uploadSuccess = _sinon['default'].spy();
            this.set('uploadSuccess', uploadSuccess);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': '9v6sce7S',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url","uploadSuccess"],[["get",["uploadUrl"]],["helper",["action"],[["get",[null]],["get",["uploadSuccess"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadSuccess.calledOnce).to.be['true'];
                (0, _chai.expect)(uploadSuccess.firstCall.args[0]).to.equal('/content/images/test.png');
                done();
            });
        });

        (0, _mocha.it)('doesn\'t fire uploadSuccess action on failed upload', function (done) {
            var uploadSuccess = _sinon['default'].spy();
            this.set('uploadSuccess', uploadSuccess);

            stubFailedUpload(server, 500);

            this.render(Ember.HTMLBars.template({
                'id': '9v6sce7S',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url","uploadSuccess"],[["get",["uploadUrl"]],["helper",["action"],[["get",[null]],["get",["uploadSuccess"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadSuccess.calledOnce).to.be['false'];
                done();
            });
        });

        (0, _mocha.it)('fires fileSelected action on file selection', function (done) {
            var fileSelected = _sinon['default'].spy();
            this.set('fileSelected', fileSelected);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'nRRTLNDs',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url","fileSelected"],[["get",["uploadUrl"]],["helper",["action"],[["get",[null]],["get",["fileSelected"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(fileSelected.calledOnce).to.be['true'];
                (0, _chai.expect)(fileSelected.args[0]).to.not.be.blank;
                done();
            });
        });

        (0, _mocha.it)('fires uploadStarted action on upload start', function (done) {
            var uploadStarted = _sinon['default'].spy();
            this.set('uploadStarted', uploadStarted);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'DGW3k9ek',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url","uploadStarted"],[["get",["uploadUrl"]],["helper",["action"],[["get",[null]],["get",["uploadStarted"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadStarted.calledOnce).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('fires uploadFinished action on successful upload', function (done) {
            var uploadFinished = _sinon['default'].spy();
            this.set('uploadFinished', uploadFinished);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'NcVJW3kV',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url","uploadFinished"],[["get",["uploadUrl"]],["helper",["action"],[["get",[null]],["get",["uploadFinished"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadFinished.calledOnce).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('fires uploadFinished action on failed upload', function (done) {
            var uploadFinished = _sinon['default'].spy();
            this.set('uploadFinished', uploadFinished);

            stubFailedUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'NcVJW3kV',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url","uploadFinished"],[["get",["uploadUrl"]],["helper",["action"],[["get",[null]],["get",["uploadFinished"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadFinished.calledOnce).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('displays invalid file type error', function (done) {
            var _this = this;

            stubFailedUpload(server, 415, 'UnsupportedMediaTypeError');
            this.render(Ember.HTMLBars.template({
                'id': 'ufeI2sZv',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url"],[["get",["uploadUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this.$('.failed').text()).to.match(/The file type you uploaded is not supported/);
                (0, _chai.expect)(_this.$('.gh-btn-green').length, 'reset button is displayed').to.equal(1);
                (0, _chai.expect)(_this.$('.gh-btn-green').text()).to.equal('Try Again');
                done();
            });
        });

        (0, _mocha.it)('displays file too large for server error', function (done) {
            var _this2 = this;

            stubFailedUpload(server, 413, 'RequestEntityTooLargeError');
            this.render(Ember.HTMLBars.template({
                'id': 'ufeI2sZv',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url"],[["get",["uploadUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this2.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this2.$('.failed').text()).to.match(/The file you uploaded was larger/);
                done();
            });
        });

        (0, _mocha.it)('handles file too large error directly from the web server', function (done) {
            var _this3 = this;

            server.post('/ghost/api/v0.1/uploads/', function () {
                return [413, {}, ''];
            });
            this.render(Ember.HTMLBars.template({
                'id': 'ufeI2sZv',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url"],[["get",["uploadUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this3.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this3.$('.failed').text()).to.match(/The file you uploaded was larger/);
                done();
            });
        });

        (0, _mocha.it)('displays other server-side error with message', function (done) {
            var _this4 = this;

            stubFailedUpload(server, 400, 'UnknownError');
            this.render(Ember.HTMLBars.template({
                'id': 'ufeI2sZv',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url"],[["get",["uploadUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this4.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this4.$('.failed').text()).to.match(/Error: UnknownError/);
                done();
            });
        });

        (0, _mocha.it)('handles unknown failure', function (done) {
            var _this5 = this;

            server.post('/ghost/api/v0.1/uploads/', function () {
                return [500, { 'Content-Type': 'application/json' }, ''];
            });
            this.render(Ember.HTMLBars.template({
                'id': 'ufeI2sZv',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url"],[["get",["uploadUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this5.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this5.$('.failed').text()).to.match(/Something went wrong/);
                done();
            });
        });

        (0, _mocha.it)('triggers notifications.showAPIError for VersionMismatchError', function (done) {
            var showAPIError = _sinon['default'].spy();
            this.set('notifications.showAPIError', showAPIError);

            stubFailedUpload(server, 400, 'VersionMismatchError');

            this.render(Ember.HTMLBars.template({
                'id': 'ufeI2sZv',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url"],[["get",["uploadUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(showAPIError.calledOnce).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('doesn\'t trigger notifications.showAPIError for other errors', function (done) {
            var showAPIError = _sinon['default'].spy();
            this.set('notifications.showAPIError', showAPIError);

            stubFailedUpload(server, 400, 'UnknownError');
            this.render(Ember.HTMLBars.template({
                'id': 'ufeI2sZv',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url"],[["get",["uploadUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(showAPIError.called).to.be['false'];
                done();
            });
        });

        (0, _mocha.it)('can be reset after a failed upload', function (done) {
            var _this6 = this;

            stubFailedUpload(server, 400, 'UnknownError');
            this.render(Ember.HTMLBars.template({
                'id': 'ufeI2sZv',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url"],[["get",["uploadUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _emberRunloop['default'])(function () {
                    _this6.$('.gh-btn-green').click();
                });
            });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this6.$('input[type="file"]').length).to.equal(1);
                done();
            });
        });

        (0, _mocha.it)('displays upload progress', function (done) {
            this.set('done', done);

            // pretender fires a progress event every 50ms
            stubSuccessfulUpload(server, 150);

            this.render(Ember.HTMLBars.template({
                'id': 'WTvTEDNs',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url","uploadFinished"],[["get",["uploadUrl"]],["helper",["action"],[["get",[null]],["get",["done"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            // after 75ms we should have had one progress event
            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('.progress .bar').length).to.equal(1);

                var _$$attr$match = this.$('.progress .bar').attr('style').match(/width: (\d+)%?/);

                var _$$attr$match2 = _slicedToArray(_$$attr$match, 2);

                var percentageWidth = _$$attr$match2[1];

                (0, _chai.expect)(percentageWidth).to.be.above(0);
                (0, _chai.expect)(percentageWidth).to.be.below(100);
            }, 75);
        });

        (0, _mocha.it)('handles drag over/leave', function () {
            var _this7 = this;

            this.render(Ember.HTMLBars.template({
                'id': 'TZxN1RA1',
                'block': '{"statements":[["append",["unknown",["gh-file-uploader"]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                // eslint-disable-next-line new-cap
                var dragover = _jquery['default'].Event('dragover', {
                    dataTransfer: {
                        files: []
                    }
                });
                _this7.$('.gh-image-uploader').trigger(dragover);
            });

            (0, _chai.expect)(this.$('.gh-image-uploader').hasClass('-drag-over'), 'has drag-over class').to.be['true'];

            (0, _emberRunloop['default'])(function () {
                _this7.$('.gh-image-uploader').trigger('dragleave');
            });

            (0, _chai.expect)(this.$('.gh-image-uploader').hasClass('-drag-over'), 'has drag-over class').to.be['false'];
        });

        (0, _mocha.it)('triggers file upload on file drop', function (done) {
            var _this8 = this;

            var uploadSuccess = _sinon['default'].spy();
            // eslint-disable-next-line new-cap
            var drop = _jquery['default'].Event('drop', {
                dataTransfer: {
                    files: [(0, _ghostAdminTestsHelpersFileUpload.createFile)(['test'], { name: 'test.csv' })]
                }
            });

            this.set('uploadSuccess', uploadSuccess);

            stubSuccessfulUpload(server);
            this.render(Ember.HTMLBars.template({
                'id': '9v6sce7S',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url","uploadSuccess"],[["get",["uploadUrl"]],["helper",["action"],[["get",[null]],["get",["uploadSuccess"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                _this8.$('.gh-image-uploader').trigger(drop);
            });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadSuccess.calledOnce).to.be['true'];
                (0, _chai.expect)(uploadSuccess.firstCall.args[0]).to.equal('/content/images/test.png');
                done();
            });
        });

        (0, _mocha.it)('validates extension by default', function (done) {
            var _this9 = this;

            var uploadSuccess = _sinon['default'].spy();
            var uploadFailed = _sinon['default'].spy();

            this.set('uploadSuccess', uploadSuccess);
            this.set('uploadFailed', uploadFailed);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'BCVWywlK',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url","uploadSuccess","uploadFailed"],[["get",["uploadUrl"]],["helper",["action"],[["get",[null]],["get",["uploadSuccess"]]],null],["helper",["action"],[["get",[null]],["get",["uploadFailed"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.txt' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadSuccess.called).to.be['false'];
                (0, _chai.expect)(uploadFailed.calledOnce).to.be['true'];
                (0, _chai.expect)(_this9.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this9.$('.failed').text()).to.match(/The file type you uploaded is not supported/);
                done();
            });
        });

        (0, _mocha.it)('uploads if validate action supplied and returns true', function (done) {
            var validate = _sinon['default'].stub().returns(true);
            var uploadSuccess = _sinon['default'].spy();

            this.set('validate', validate);
            this.set('uploadSuccess', uploadSuccess);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'eRECjDto',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url","uploadSuccess","validate"],[["get",["uploadUrl"]],["helper",["action"],[["get",[null]],["get",["uploadSuccess"]]],null],["helper",["action"],[["get",[null]],["get",["validate"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(validate.calledOnce).to.be['true'];
                (0, _chai.expect)(uploadSuccess.calledOnce).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('skips upload and displays error if validate action supplied and doesn\'t return true', function (done) {
            var _this10 = this;

            var validate = _sinon['default'].stub().returns(new _ghostAdminServicesAjax.UnsupportedMediaTypeError());
            var uploadSuccess = _sinon['default'].spy();
            var uploadFailed = _sinon['default'].spy();

            this.set('validate', validate);
            this.set('uploadSuccess', uploadSuccess);
            this.set('uploadFailed', uploadFailed);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'BhrHIlLr',
                'block': '{"statements":[["append",["helper",["gh-file-uploader"],null,[["url","uploadSuccess","uploadFailed","validate"],[["get",["uploadUrl"]],["helper",["action"],[["get",[null]],["get",["uploadSuccess"]]],null],["helper",["action"],[["get",[null]],["get",["uploadFailed"]]],null],["helper",["action"],[["get",[null]],["get",["validate"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.csv' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(validate.calledOnce).to.be['true'];
                (0, _chai.expect)(uploadSuccess.called).to.be['false'];
                (0, _chai.expect)(uploadFailed.calledOnce).to.be['true'];
                (0, _chai.expect)(_this10.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this10.$('.failed').text()).to.match(/The file type you uploaded is not supported/);
                done();
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-file-uploader-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-file-uploader-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-image-uploader-test', ['exports', 'sinon', 'chai', 'mocha', 'ember-mocha', 'pretender', 'ember-test-helpers/wait', 'ghost-admin/tests/helpers/file-upload', 'jquery', 'ember-runloop', 'ember-service', 'ghost-admin/services/ajax'], function (exports, _sinon, _chai, _mocha, _emberMocha, _pretender, _emberTestHelpersWait, _ghostAdminTestsHelpersFileUpload, _jquery, _emberRunloop, _emberService, _ghostAdminServicesAjax) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    var notificationsStub = _emberService['default'].extend({
        showAPIError: function showAPIError() /* error, options */{
            // noop - to be stubbed
        }
    });

    var sessionStub = _emberService['default'].extend({
        isAuthenticated: false,
        authorize: function authorize(authorizer, block) {
            if (this.get('isAuthenticated')) {
                block('Authorization', 'Bearer token');
            }
        }
    });

    var stubSuccessfulUpload = function stubSuccessfulUpload(server) {
        var delay = arguments.length <= 1 || arguments[1] === undefined ? 0 : arguments[1];

        server.post('/ghost/api/v0.1/uploads/', function () {
            return [200, { 'Content-Type': 'application/json' }, '"/content/images/test.png"'];
        }, delay);
    };

    var stubFailedUpload = function stubFailedUpload(server, code, error) {
        var delay = arguments.length <= 3 || arguments[3] === undefined ? 0 : arguments[3];

        server.post('/ghost/api/v0.1/uploads/', function () {
            return [code, { 'Content-Type': 'application/json' }, JSON.stringify({
                errors: [{
                    errorType: error,
                    message: 'Error: ' + error
                }]
            })];
        }, delay);
    };

    (0, _mocha.describe)('Integration: Component: gh-image-uploader', function () {
        (0, _emberMocha.setupComponentTest)('gh-image-upload', {
            integration: true
        });

        var server = undefined;

        beforeEach(function () {
            this.register('service:session', sessionStub);
            this.register('service:notifications', notificationsStub);
            this.inject.service('session', { as: 'sessionService' });
            this.inject.service('notifications', { as: 'notifications' });
            this.set('update', function () {});
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('renders', function () {
            this.set('image', 'http://example.com/test.png');
            this.render(Ember.HTMLBars.template({
                'id': '5OyTx8bS',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image"],[["get",["image"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);
        });

        (0, _mocha.it)('renders form with supplied alt text', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'yDTAW2AE',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","altText"],[["get",["image"]],"text test"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.description').text().trim()).to.equal('Upload image of "text test"');
        });

        (0, _mocha.it)('renders form with supplied text', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'Nddjdzwj',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","text"],[["get",["image"]],"text test"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.description').text().trim()).to.equal('text test');
        });

        (0, _mocha.it)('generates request to correct endpoint', function (done) {
            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(server.handledRequests.length).to.equal(1);
                (0, _chai.expect)(server.handledRequests[0].url).to.equal('/ghost/api/v0.1/uploads/');
                (0, _chai.expect)(server.handledRequests[0].requestHeaders.Authorization).to.be.undefined;
                done();
            });
        });

        (0, _mocha.it)('adds authentication headers to request', function (done) {
            stubSuccessfulUpload(server);

            this.get('sessionService').set('isAuthenticated', true);

            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                var _server$handledRequests = _slicedToArray(server.handledRequests, 1);

                var request = _server$handledRequests[0];

                (0, _chai.expect)(request.requestHeaders.Authorization).to.equal('Bearer token');
                done();
            });
        });

        (0, _mocha.it)('fires update action on successful upload', function (done) {
            var update = _sinon['default'].spy();
            this.set('update', update);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(update.calledOnce).to.be['true'];
                (0, _chai.expect)(update.firstCall.args[0]).to.equal('/content/images/test.png');
                done();
            });
        });

        (0, _mocha.it)('doesn\'t fire update action on failed upload', function (done) {
            var update = _sinon['default'].spy();
            this.set('update', update);

            stubFailedUpload(server, 500);

            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(update.calledOnce).to.be['false'];
                done();
            });
        });

        (0, _mocha.it)('fires fileSelected action on file selection', function (done) {
            var fileSelected = _sinon['default'].spy();
            this.set('fileSelected', fileSelected);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'iSLwP6aJ',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","fileSelected","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["fileSelected"]]],null],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(fileSelected.calledOnce).to.be['true'];
                (0, _chai.expect)(fileSelected.args[0]).to.not.be.blank;
                done();
            });
        });

        (0, _mocha.it)('fires uploadStarted action on upload start', function (done) {
            var uploadStarted = _sinon['default'].spy();
            this.set('uploadStarted', uploadStarted);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'fHpAv2Uo',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","uploadStarted","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["uploadStarted"]]],null],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadStarted.calledOnce).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('fires uploadFinished action on successful upload', function (done) {
            var uploadFinished = _sinon['default'].spy();
            this.set('uploadFinished', uploadFinished);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'vdqYHIrY',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","uploadFinished","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["uploadFinished"]]],null],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadFinished.calledOnce).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('fires uploadFinished action on failed upload', function (done) {
            var uploadFinished = _sinon['default'].spy();
            this.set('uploadFinished', uploadFinished);

            stubFailedUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'vdqYHIrY',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","uploadFinished","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["uploadFinished"]]],null],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadFinished.calledOnce).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('displays invalid file type error', function (done) {
            var _this = this;

            stubFailedUpload(server, 415, 'UnsupportedMediaTypeError');
            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this.$('.failed').text()).to.match(/The image type you uploaded is not supported/);
                (0, _chai.expect)(_this.$('.gh-btn-green').length, 'reset button is displayed').to.equal(1);
                (0, _chai.expect)(_this.$('.gh-btn-green').text()).to.equal('Try Again');
                done();
            });
        });

        (0, _mocha.it)('displays file too large for server error', function (done) {
            var _this2 = this;

            stubFailedUpload(server, 413, 'RequestEntityTooLargeError');
            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this2.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this2.$('.failed').text()).to.match(/The image you uploaded was larger/);
                done();
            });
        });

        (0, _mocha.it)('handles file too large error directly from the web server', function (done) {
            var _this3 = this;

            server.post('/ghost/api/v0.1/uploads/', function () {
                return [413, {}, ''];
            });
            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this3.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this3.$('.failed').text()).to.match(/The image you uploaded was larger/);
                done();
            });
        });

        (0, _mocha.it)('displays other server-side error with message', function (done) {
            var _this4 = this;

            stubFailedUpload(server, 400, 'UnknownError');
            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this4.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this4.$('.failed').text()).to.match(/Error: UnknownError/);
                done();
            });
        });

        (0, _mocha.it)('handles unknown failure', function (done) {
            var _this5 = this;

            server.post('/ghost/api/v0.1/uploads/', function () {
                return [500, { 'Content-Type': 'application/json' }, ''];
            });
            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this5.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this5.$('.failed').text()).to.match(/Something went wrong/);
                done();
            });
        });

        (0, _mocha.it)('triggers notifications.showAPIError for VersionMismatchError', function (done) {
            var showAPIError = _sinon['default'].spy();
            this.set('notifications.showAPIError', showAPIError);

            stubFailedUpload(server, 400, 'VersionMismatchError');

            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(showAPIError.calledOnce).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('doesn\'t trigger notifications.showAPIError for other errors', function (done) {
            var showAPIError = _sinon['default'].spy();
            this.set('notifications.showAPIError', showAPIError);

            stubFailedUpload(server, 400, 'UnknownError');
            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(showAPIError.called).to.be['false'];
                done();
            });
        });

        (0, _mocha.it)('can be reset after a failed upload', function (done) {
            var _this6 = this;

            stubFailedUpload(server, 400, 'UnknownError');
            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { type: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _emberRunloop['default'])(function () {
                    _this6.$('.gh-btn-green').click();
                });
            });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this6.$('input[type="file"]').length).to.equal(1);
                done();
            });
        });

        (0, _mocha.it)('displays upload progress', function (done) {
            this.set('done', done);

            // pretender fires a progress event every 50ms
            stubSuccessfulUpload(server, 150);

            this.render(Ember.HTMLBars.template({
                'id': 'EcRMWTGF',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","uploadFinished","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["done"]]],null],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            // after 75ms we should have had one progress event
            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('.progress .bar').length).to.equal(1);

                var _$$attr$match = this.$('.progress .bar').attr('style').match(/width: (\d+)%?/);

                var _$$attr$match2 = _slicedToArray(_$$attr$match, 2);

                var percentageWidth = _$$attr$match2[1];

                (0, _chai.expect)(percentageWidth).to.be.above(0);
                (0, _chai.expect)(percentageWidth).to.be.below(100);
            }, 75);
        });

        (0, _mocha.it)('handles drag over/leave', function () {
            var _this7 = this;

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'XoaJbYpd',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["image","update"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                // eslint-disable-next-line new-cap
                var dragover = _jquery['default'].Event('dragover', {
                    dataTransfer: {
                        files: []
                    }
                });
                _this7.$('.gh-image-uploader').trigger(dragover);
            });

            (0, _chai.expect)(this.$('.gh-image-uploader').hasClass('-drag-over'), 'has drag-over class').to.be['true'];

            (0, _emberRunloop['default'])(function () {
                _this7.$('.gh-image-uploader').trigger('dragleave');
            });

            (0, _chai.expect)(this.$('.gh-image-uploader').hasClass('-drag-over'), 'has drag-over class').to.be['false'];
        });

        (0, _mocha.it)('triggers file upload on file drop', function (done) {
            var _this8 = this;

            var uploadSuccess = _sinon['default'].spy();
            // eslint-disable-next-line new-cap
            var drop = _jquery['default'].Event('drop', {
                dataTransfer: {
                    files: [(0, _ghostAdminTestsHelpersFileUpload.createFile)(['test'], { name: 'test.png' })]
                }
            });

            this.set('uploadSuccess', uploadSuccess);

            stubSuccessfulUpload(server);
            this.render(Ember.HTMLBars.template({
                'id': 'LBSFTdip',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["uploadSuccess"],[["helper",["action"],[["get",[null]],["get",["uploadSuccess"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                _this8.$('.gh-image-uploader').trigger(drop);
            });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadSuccess.calledOnce).to.be['true'];
                (0, _chai.expect)(uploadSuccess.firstCall.args[0]).to.equal('/content/images/test.png');
                done();
            });
        });

        (0, _mocha.it)('validates extension by default', function (done) {
            var _this9 = this;

            var uploadSuccess = _sinon['default'].spy();
            var uploadFailed = _sinon['default'].spy();

            this.set('uploadSuccess', uploadSuccess);
            this.set('uploadFailed', uploadFailed);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'wfaGx33t',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["uploadSuccess","uploadFailed"],[["helper",["action"],[["get",[null]],["get",["uploadSuccess"]]],null],["helper",["action"],[["get",[null]],["get",["uploadFailed"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.json' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(uploadSuccess.called).to.be['false'];
                (0, _chai.expect)(uploadFailed.calledOnce).to.be['true'];
                (0, _chai.expect)(_this9.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this9.$('.failed').text()).to.match(/The image type you uploaded is not supported/);
                done();
            });
        });

        (0, _mocha.it)('uploads if validate action supplied and returns true', function (done) {
            var validate = _sinon['default'].stub().returns(true);
            var uploadSuccess = _sinon['default'].spy();

            this.set('validate', validate);
            this.set('uploadSuccess', uploadSuccess);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'z6dGVx6B',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["uploadSuccess","validate"],[["helper",["action"],[["get",[null]],["get",["uploadSuccess"]]],null],["helper",["action"],[["get",[null]],["get",["validate"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.txt' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(validate.calledOnce).to.be['true'];
                (0, _chai.expect)(uploadSuccess.calledOnce).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('skips upload and displays error if validate action supplied and doesn\'t return true', function (done) {
            var _this10 = this;

            var validate = _sinon['default'].stub().returns(new _ghostAdminServicesAjax.UnsupportedMediaTypeError());
            var uploadSuccess = _sinon['default'].spy();
            var uploadFailed = _sinon['default'].spy();

            this.set('validate', validate);
            this.set('uploadSuccess', uploadSuccess);
            this.set('uploadFailed', uploadFailed);

            stubSuccessfulUpload(server);

            this.render(Ember.HTMLBars.template({
                'id': 'XiZHwlb1',
                'block': '{"statements":[["append",["helper",["gh-image-uploader"],null,[["uploadSuccess","uploadFailed","validate"],[["helper",["action"],[["get",[null]],["get",["uploadSuccess"]]],null],["helper",["action"],[["get",[null]],["get",["uploadFailed"]]],null],["helper",["action"],[["get",[null]],["get",["validate"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _ghostAdminTestsHelpersFileUpload.fileUpload)(this.$('input[type="file"]'), ['test'], { name: 'test.png' });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(validate.calledOnce).to.be['true'];
                (0, _chai.expect)(uploadSuccess.called).to.be['false'];
                (0, _chai.expect)(uploadFailed.calledOnce).to.be['true'];
                (0, _chai.expect)(_this10.$('.failed').length, 'error message is displayed').to.equal(1);
                (0, _chai.expect)(_this10.$('.failed').text()).to.match(/The image type you uploaded is not supported/);
                done();
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-image-uploader-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-image-uploader-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-image-uploader-with-preview-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-runloop', 'sinon'], function (exports, _chai, _mocha, _emberMocha, _emberRunloop, _sinon) {

    (0, _mocha.describe)('Integration: Component: gh-image-uploader-with-preview', function () {
        (0, _emberMocha.setupComponentTest)('gh-image-uploader-with-preview', {
            integration: true
        });

        (0, _mocha.it)('renders image if provided', function () {
            this.set('image', 'http://example.com/test.png');

            this.render(Ember.HTMLBars.template({
                'id': 'eN5XQcF/',
                'block': '{"statements":[["append",["helper",["gh-image-uploader-with-preview"],null,[["image"],[["get",["image"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$('.gh-image-uploader.-with-image').length).to.equal(1);
            (0, _chai.expect)(this.$('img').attr('src')).to.equal('http://example.com/test.png');
        });

        (0, _mocha.it)('renders upload form when no image provided', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'eN5XQcF/',
                'block': '{"statements":[["append",["helper",["gh-image-uploader-with-preview"],null,[["image"],[["get",["image"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$('input[type="file"]').length).to.equal(1);
        });

        (0, _mocha.it)('triggers remove action when delete icon is clicked', function () {
            var _this = this;

            var remove = _sinon['default'].spy();
            this.set('remove', remove);
            this.set('image', 'http://example.com/test.png');

            this.render(Ember.HTMLBars.template({
                'id': 'bpTikA1w',
                'block': '{"statements":[["append",["helper",["gh-image-uploader-with-preview"],null,[["image","remove"],[["get",["image"]],["helper",["action"],[["get",[null]],["get",["remove"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _emberRunloop['default'])(function () {
                _this.$('.icon-trash').click();
            });

            (0, _chai.expect)(remove.calledOnce).to.be['true'];
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-image-uploader-with-preview-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-image-uploader-with-preview-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-koenig-slashmenu-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ghost-admin/tests/helpers/editor-helpers', 'jquery'], function (exports, _chai, _mocha, _emberMocha, _ghostAdminTestsHelpersEditorHelpers, _jquery) {

    (0, _mocha.describe)('Integration: Component: gh-cm-editor', function () {
        (0, _emberMocha.setupComponentTest)('gh-koenig', {
            integration: true
        });

        (0, _mocha.it)('thge slash menu appears on user input', function (done) {
            this.render(Ember.HTMLBars.template({
                'id': 'Nz9jg5bJ',
                'block': '{"statements":[["append",["helper",["gh-koenig"],null,[["apiRoot","assetPath","containerSelector"],["/todo","/assets",".editor-holder"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)().then(function () {
                var editor = window.editor;

                editor.element.focus();
                (0, _ghostAdminTestsHelpersEditorHelpers.inputText)(editor, '/');
                return (0, _ghostAdminTestsHelpersEditorHelpers.waitForRender)('.gh-cardmenu');
            }).then(function () {
                var cardMenu = (0, _jquery['default'])('.gh-cardmenu');
                (0, _chai.expect)(cardMenu.children().length).to.equal(7);
                done();
            });
        });
        _mocha.it.skip('searches when a user types', function (done) {
            this.render(Ember.HTMLBars.template({
                'id': 'Nz9jg5bJ',
                'block': '{"statements":[["append",["helper",["gh-koenig"],null,[["apiRoot","assetPath","containerSelector"],["/todo","/assets",".editor-holder"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _ghostAdminTestsHelpersEditorHelpers.editorRendered)().then(function () {
                var editor = window.editor;

                editor.element.focus();
                (0, _ghostAdminTestsHelpersEditorHelpers.inputText)(editor, '/');
                return (0, _ghostAdminTestsHelpersEditorHelpers.waitForRender)('.gh-cardmenu');
            }).then(function () {
                var cardMenu = (0, _jquery['default'])('.gh-cardmenu');
                (0, _chai.expect)(cardMenu.children().length).to.equal(7);
                return (0, _ghostAdminTestsHelpersEditorHelpers.testInput)(' lis', '/ lis', _chai.expect);
            }).then(function () {
                var cardMenu = (0, _jquery['default'])('.gh-cardmenu');
                (0, _chai.expect)(cardMenu.children().length).to.equal(2);
                done();
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-koenig-slashmenu-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-koenig-slashmenu-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-navigation-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'jquery', 'ember-runloop', 'ghost-admin/models/navigation-item'], function (exports, _chai, _mocha, _emberMocha, _jquery, _emberRunloop, _ghostAdminModelsNavigationItem) {

    (0, _mocha.describe)('Integration: Component: gh-navigation', function () {
        (0, _emberMocha.setupComponentTest)('gh-navigation', {
            integration: true
        });

        (0, _mocha.it)('renders', function () {
            this.render(Ember.HTMLBars.template({
                'id': '0GSNEHJD',
                'block': '{"statements":[["block",["gh-navigation"],null,null,0]],"locals":[],"named":[],"yields":[],"blocks":[{"statements":[["open-element","div",[]],["static-attr","class","js-gh-blognav"],["flush-element"],["open-element","div",[]],["static-attr","class","gh-blognav-item"],["flush-element"],["close-element"],["close-element"]],"locals":[]}],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('section.gh-view')).to.have.length(1);
            (0, _chai.expect)(this.$('.ui-sortable')).to.have.length(1);
        });

        (0, _mocha.it)('triggers reorder action', function () {
            var _this = this;

            var navItems = [];
            var expectedOldIndex = -1;
            var expectedNewIndex = -1;

            navItems.pushObject(_ghostAdminModelsNavigationItem['default'].create({ label: 'First', url: '/first' }));
            navItems.pushObject(_ghostAdminModelsNavigationItem['default'].create({ label: 'Second', url: '/second' }));
            navItems.pushObject(_ghostAdminModelsNavigationItem['default'].create({ label: 'Third', url: '/third' }));
            navItems.pushObject(_ghostAdminModelsNavigationItem['default'].create({ label: '', url: '', last: true }));
            this.set('navigationItems', navItems);
            this.set('blogUrl', 'http://localhost:2368');

            this.on('moveItem', function (oldIndex, newIndex) {
                (0, _chai.expect)(oldIndex).to.equal(expectedOldIndex);
                (0, _chai.expect)(newIndex).to.equal(expectedNewIndex);
            });

            (0, _emberRunloop['default'])(function () {
                _this.render(Ember.HTMLBars.template({
                    'id': 'K61LItWq',
                    'block': '{"statements":[["text","\\n"],["block",["gh-navigation"],null,[["moveItem"],["moveItem"]],1]],"locals":[],"named":[],"yields":[],"blocks":[{"statements":[["text","                        "],["append",["helper",["gh-navitem"],null,[["navItem","baseUrl","addItem","deleteItem","updateUrl"],[["get",["navItem"]],["get",["blogUrl"]],"addItem","deleteItem","updateUrl"]]],false],["text","\\n"]],"locals":["navItem"]},{"statements":[["text","                "],["open-element","form",[]],["static-attr","id","settings-navigation"],["static-attr","class","gh-blognav js-gh-blognav"],["static-attr","novalidate","novalidate"],["flush-element"],["text","\\n"],["block",["each"],[["get",["navigationItems"]]],null,0],["text","                "],["close-element"],["text","\\n"]],"locals":[]}],"hasPartials":false}',
                    'meta': {}
                }));
            });

            // check it renders the nav item rows
            (0, _chai.expect)(this.$('.gh-blognav-item')).to.have.length(4);

            // move second item up one
            expectedOldIndex = 1;
            expectedNewIndex = 0;
            (0, _emberRunloop['default'])(function () {
                (0, _jquery['default'])(_this.$('.gh-blognav-item')[1]).simulateDragSortable({
                    move: -1,
                    handle: '.gh-blognav-grab'
                });
            });

            // move second item down one
            expectedOldIndex = 1;
            expectedNewIndex = 2;
            (0, _emberRunloop['default'])(function () {
                (0, _jquery['default'])(_this.$('.gh-blognav-item')[1]).simulateDragSortable({
                    move: 1,
                    handle: '.gh-blognav-grab'
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-navigation-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-navigation-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-navitem-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ghost-admin/models/navigation-item', 'ember-test-helpers/wait'], function (exports, _chai, _mocha, _emberMocha, _ghostAdminModelsNavigationItem, _emberTestHelpersWait) {

    (0, _mocha.describe)('Integration: Component: gh-navitem', function () {
        (0, _emberMocha.setupComponentTest)('gh-navitem', {
            integration: true
        });

        beforeEach(function () {
            this.set('baseUrl', 'http://localhost:2368');
        });

        (0, _mocha.it)('renders', function () {
            this.set('navItem', _ghostAdminModelsNavigationItem['default'].create({ label: 'Test', url: '/url' }));

            this.render(Ember.HTMLBars.template({
                'id': 'L+gUQX94',
                'block': '{"statements":[["append",["helper",["gh-navitem"],null,[["navItem","baseUrl"],[["get",["navItem"]],["get",["baseUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $item = this.$('.gh-blognav-item');

            (0, _chai.expect)($item.find('.gh-blognav-grab').length).to.equal(1);
            (0, _chai.expect)($item.find('.gh-blognav-label').length).to.equal(1);
            (0, _chai.expect)($item.find('.gh-blognav-url').length).to.equal(1);
            (0, _chai.expect)($item.find('.gh-blognav-delete').length).to.equal(1);

            // doesn't show any errors
            (0, _chai.expect)($item.hasClass('gh-blognav-item--error')).to.be['false'];
            (0, _chai.expect)($item.find('.error').length).to.equal(0);
            (0, _chai.expect)($item.find('.response:visible').length).to.equal(0);
        });

        (0, _mocha.it)('doesn\'t show drag handle for new items', function () {
            this.set('navItem', _ghostAdminModelsNavigationItem['default'].create({ label: 'Test', url: '/url', isNew: true }));

            this.render(Ember.HTMLBars.template({
                'id': 'L+gUQX94',
                'block': '{"statements":[["append",["helper",["gh-navitem"],null,[["navItem","baseUrl"],[["get",["navItem"]],["get",["baseUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $item = this.$('.gh-blognav-item');

            (0, _chai.expect)($item.find('.gh-blognav-grab').length).to.equal(0);
        });

        (0, _mocha.it)('shows add button for new items', function () {
            this.set('navItem', _ghostAdminModelsNavigationItem['default'].create({ label: 'Test', url: '/url', isNew: true }));

            this.render(Ember.HTMLBars.template({
                'id': 'L+gUQX94',
                'block': '{"statements":[["append",["helper",["gh-navitem"],null,[["navItem","baseUrl"],[["get",["navItem"]],["get",["baseUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $item = this.$('.gh-blognav-item');

            (0, _chai.expect)($item.find('.gh-blognav-add').length).to.equal(1);
            (0, _chai.expect)($item.find('.gh-blognav-delete').length).to.equal(0);
        });

        (0, _mocha.it)('triggers delete action', function () {
            var _this = this;

            this.set('navItem', _ghostAdminModelsNavigationItem['default'].create({ label: 'Test', url: '/url' }));

            var deleteActionCallCount = 0;
            this.on('deleteItem', function (navItem) {
                (0, _chai.expect)(navItem).to.equal(_this.get('navItem'));
                deleteActionCallCount++;
            });

            this.render(Ember.HTMLBars.template({
                'id': '0ewc67pj',
                'block': '{"statements":[["append",["helper",["gh-navitem"],null,[["navItem","baseUrl","deleteItem"],[["get",["navItem"]],["get",["baseUrl"]],"deleteItem"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            this.$('.gh-blognav-delete').trigger('click');

            (0, _chai.expect)(deleteActionCallCount).to.equal(1);
        });

        (0, _mocha.it)('triggers add action', function () {
            this.set('navItem', _ghostAdminModelsNavigationItem['default'].create({ label: 'Test', url: '/url', isNew: true }));

            var addActionCallCount = 0;
            this.on('add', function () {
                addActionCallCount++;
            });

            this.render(Ember.HTMLBars.template({
                'id': 'Kzg9lw64',
                'block': '{"statements":[["append",["helper",["gh-navitem"],null,[["navItem","baseUrl","addItem"],[["get",["navItem"]],["get",["baseUrl"]],"add"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            this.$('.gh-blognav-add').trigger('click');

            (0, _chai.expect)(addActionCallCount).to.equal(1);
        });

        (0, _mocha.it)('triggers update action', function () {
            this.set('navItem', _ghostAdminModelsNavigationItem['default'].create({ label: 'Test', url: '/url' }));

            var updateActionCallCount = 0;
            this.on('update', function () {
                updateActionCallCount++;
            });

            this.render(Ember.HTMLBars.template({
                'id': 'Lv8fUzTP',
                'block': '{"statements":[["append",["helper",["gh-navitem"],null,[["navItem","baseUrl","updateUrl"],[["get",["navItem"]],["get",["baseUrl"]],"update"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            this.$('.gh-blognav-url input').trigger('blur');

            (0, _chai.expect)(updateActionCallCount).to.equal(1);
        });

        (0, _mocha.it)('displays inline errors', function () {
            this.set('navItem', _ghostAdminModelsNavigationItem['default'].create({ label: '', url: '' }));
            this.get('navItem').validate();

            this.render(Ember.HTMLBars.template({
                'id': 'L+gUQX94',
                'block': '{"statements":[["append",["helper",["gh-navitem"],null,[["navItem","baseUrl"],[["get",["navItem"]],["get",["baseUrl"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $item = this.$('.gh-blognav-item');

            return (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)($item.hasClass('gh-blognav-item--error')).to.be['true'];
                (0, _chai.expect)($item.find('.gh-blognav-label').hasClass('error')).to.be['true'];
                (0, _chai.expect)($item.find('.gh-blognav-label .response').text().trim()).to.equal('You must specify a label');
                (0, _chai.expect)($item.find('.gh-blognav-url').hasClass('error')).to.be['true'];
                (0, _chai.expect)($item.find('.gh-blognav-url .response').text().trim()).to.equal('You must specify a URL or relative path');
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-navitem-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-navitem-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-navitem-url-input-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember'], function (exports, _chai, _mocha, _emberMocha, _ember) {
    var $ = _ember['default'].$;
    var run = _ember['default'].run;

    // we want baseUrl to match the running domain so relative URLs are
    // handled as expected (browser auto-sets the domain when using a.href)
    var currentUrl = window.location.protocol + '//' + window.location.host + '/';

    (0, _mocha.describe)('Integration: Component: gh-navitem-url-input', function () {
        (0, _emberMocha.setupComponentTest)('gh-navitem-url-input', {
            integration: true
        });

        beforeEach(function () {
            // set defaults
            this.set('baseUrl', currentUrl);
            this.set('url', '');
            this.set('isNew', false);
            this.on('clearErrors', function () {
                return null;
            });
        });

        (0, _mocha.it)('renders correctly with blank url', function () {
            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            (0, _chai.expect)($input).to.have.length(1);
            (0, _chai.expect)($input.hasClass('gh-input')).to.be['true'];
            (0, _chai.expect)($input.val()).to.equal(currentUrl);
        });

        (0, _mocha.it)('renders correctly with relative urls', function () {
            this.set('url', '/about');
            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            (0, _chai.expect)($input.val()).to.equal(currentUrl + 'about');

            this.set('url', '/about#contact');
            (0, _chai.expect)($input.val()).to.equal(currentUrl + 'about#contact');
        });

        (0, _mocha.it)('renders correctly with absolute urls', function () {
            this.set('url', 'https://example.com:2368/#test');
            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            (0, _chai.expect)($input.val()).to.equal('https://example.com:2368/#test');

            this.set('url', 'mailto:test@example.com');
            (0, _chai.expect)($input.val()).to.equal('mailto:test@example.com');

            this.set('url', 'tel:01234-5678-90');
            (0, _chai.expect)($input.val()).to.equal('tel:01234-5678-90');

            this.set('url', '//protocol-less-url.com');
            (0, _chai.expect)($input.val()).to.equal('//protocol-less-url.com');

            this.set('url', '#anchor');
            (0, _chai.expect)($input.val()).to.equal('#anchor');
        });

        (0, _mocha.it)('deletes base URL on backspace', function () {
            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            (0, _chai.expect)($input.val()).to.equal(currentUrl);
            run(function () {
                // TODO: why is ember's keyEvent helper not available here?
                // eslint-disable-next-line new-cap
                var e = $.Event('keydown');
                e.keyCode = 8;
                $input.trigger(e);
            });
            (0, _chai.expect)($input.val()).to.equal('');
        });

        (0, _mocha.it)('deletes base URL on delete', function () {
            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            (0, _chai.expect)($input.val()).to.equal(currentUrl);
            run(function () {
                // TODO: why is ember's keyEvent helper not available here?
                // eslint-disable-next-line new-cap
                var e = $.Event('keydown');
                e.keyCode = 46;
                $input.trigger(e);
            });
            (0, _chai.expect)($input.val()).to.equal('');
        });

        (0, _mocha.it)('adds base url to relative urls on blur', function () {
            this.on('updateUrl', function () {
                return null;
            });
            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            run(function () {
                $input.val('/about').trigger('input');
            });
            run(function () {
                $input.trigger('blur');
            });

            (0, _chai.expect)($input.val()).to.equal(currentUrl + 'about');
        });

        (0, _mocha.it)('adds "mailto:" to email addresses on blur', function () {
            this.on('updateUrl', function () {
                return null;
            });
            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            run(function () {
                $input.val('test@example.com').trigger('input');
            });
            run(function () {
                $input.trigger('blur');
            });

            (0, _chai.expect)($input.val()).to.equal('mailto:test@example.com');

            // ensure we don't double-up on the mailto:
            run(function () {
                $input.trigger('blur');
            });
            (0, _chai.expect)($input.val()).to.equal('mailto:test@example.com');
        });

        (0, _mocha.it)('doesn\'t add base url to invalid urls on blur', function () {
            this.on('updateUrl', function () {
                return null;
            });
            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            var changeValue = function changeValue(value) {
                run(function () {
                    $input.val(value).trigger('input').trigger('blur');
                });
            };

            changeValue('with spaces');
            (0, _chai.expect)($input.val()).to.equal('with spaces');

            changeValue('/with spaces');
            (0, _chai.expect)($input.val()).to.equal('/with spaces');
        });

        (0, _mocha.it)('doesn\'t mangle invalid urls on blur', function () {
            this.on('updateUrl', function () {
                return null;
            });
            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            run(function () {
                $input.val(currentUrl + ' /test').trigger('input').trigger('blur');
            });

            (0, _chai.expect)($input.val()).to.equal(currentUrl + ' /test');
        });

        (0, _mocha.it)('triggers "change" action on blur', function () {
            var changeActionCallCount = 0;
            this.on('updateUrl', function () {
                changeActionCallCount++;
            });

            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            $input.trigger('blur');

            (0, _chai.expect)(changeActionCallCount).to.equal(1);
        });

        (0, _mocha.it)('triggers "change" action on enter', function () {
            var changeActionCallCount = 0;
            this.on('updateUrl', function () {
                changeActionCallCount++;
            });

            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            run(function () {
                // TODO: why is ember's keyEvent helper not available here?
                // eslint-disable-next-line new-cap
                var e = $.Event('keypress');
                e.keyCode = 13;
                $input.trigger(e);
            });

            (0, _chai.expect)(changeActionCallCount).to.equal(1);
        });

        (0, _mocha.it)('triggers "change" action on CMD-S', function () {
            var changeActionCallCount = 0;
            this.on('updateUrl', function () {
                changeActionCallCount++;
            });

            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            run(function () {
                // TODO: why is ember's keyEvent helper not available here?
                // eslint-disable-next-line new-cap
                var e = $.Event('keydown');
                e.keyCode = 83;
                e.metaKey = true;
                $input.trigger(e);
            });

            (0, _chai.expect)(changeActionCallCount).to.equal(1);
        });

        (0, _mocha.it)('sends absolute urls straight through to change action', function () {
            var expectedUrl = '';

            this.on('updateUrl', function (url) {
                (0, _chai.expect)(url).to.equal(expectedUrl);
            });

            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            var testUrl = function testUrl(url) {
                expectedUrl = url;
                run(function () {
                    $input.val(url).trigger('input');
                });
                run(function () {
                    $input.trigger('blur');
                });
            };

            testUrl('http://example.com');
            testUrl('http://example.com/');
            testUrl('https://example.com');
            testUrl('//example.com');
            testUrl('//localhost:1234');
            testUrl('#anchor');
            testUrl('mailto:test@example.com');
            testUrl('tel:12345-567890');
            testUrl('javascript:alert("testing");');
        });

        (0, _mocha.it)('strips base url from relative urls before sending to change action', function () {
            var expectedUrl = '';

            this.on('updateUrl', function (url) {
                (0, _chai.expect)(url).to.equal(expectedUrl);
            });

            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            var testUrl = function testUrl(url) {
                expectedUrl = '/' + url;
                run(function () {
                    $input.val('' + currentUrl + url).trigger('input');
                });
                run(function () {
                    $input.trigger('blur');
                });
            };

            testUrl('about/');
            testUrl('about#contact');
            testUrl('test/nested/');
        });

        (0, _mocha.it)('handles links to subdomains of blog domain', function () {
            var expectedUrl = '';

            this.set('baseUrl', 'http://example.com/');

            this.on('updateUrl', function (url) {
                (0, _chai.expect)(url).to.equal(expectedUrl);
            });

            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            expectedUrl = 'http://test.example.com/';
            run(function () {
                $input.val(expectedUrl).trigger('input').trigger('blur');
            });
            (0, _chai.expect)($input.val()).to.equal(expectedUrl);
        });

        (0, _mocha.it)('adds trailing slash to relative URL', function () {
            var expectedUrl = '';

            this.on('updateUrl', function (url) {
                (0, _chai.expect)(url).to.equal(expectedUrl);
            });

            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            var testUrl = function testUrl(url) {
                expectedUrl = '/' + url + '/';
                run(function () {
                    $input.val('' + currentUrl + url).trigger('input');
                });
                run(function () {
                    $input.trigger('blur');
                });
            };

            testUrl('about');
            testUrl('test/nested');
        });

        (0, _mocha.it)('does not add trailing slash on relative URL with [.?#]', function () {
            var expectedUrl = '';

            this.on('updateUrl', function (url) {
                (0, _chai.expect)(url).to.equal(expectedUrl);
            });

            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            var testUrl = function testUrl(url) {
                expectedUrl = '/' + url;
                run(function () {
                    $input.val('' + currentUrl + url).trigger('input');
                });
                run(function () {
                    $input.trigger('blur');
                });
            };

            testUrl('about#contact');
            testUrl('test/nested.svg');
            testUrl('test?gho=sties');
            testUrl('test/nested?sli=mer');
        });

        (0, _mocha.it)('does not add trailing slash on non-relative URLs', function () {
            var expectedUrl = '';

            this.on('updateUrl', function (url) {
                (0, _chai.expect)(url).to.equal(expectedUrl);
            });

            this.render(_ember['default'].HTMLBars.template({
                'id': 'GaT2lJpy',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $input = this.$('input');

            var testUrl = function testUrl(url) {
                expectedUrl = '/' + url;
                run(function () {
                    $input.val('' + currentUrl + url).trigger('input');
                });
                run(function () {
                    $input.trigger('blur');
                });
            };

            testUrl('http://woo.ff/test');
            testUrl('http://me.ow:2342/nested/test');
            testUrl('https://wro.om/car#race');
            testUrl('https://kabo.om/explosion?really=now');
        });

        (0, _mocha.describe)('with sub-folder baseUrl', function () {
            beforeEach(function () {
                this.set('baseUrl', currentUrl + 'blog/');
            });

            (0, _mocha.it)('handles URLs relative to base url', function () {
                var expectedUrl = '';

                this.on('updateUrl', function (url) {
                    (0, _chai.expect)(url).to.equal(expectedUrl);
                });

                this.render(_ember['default'].HTMLBars.template({
                    'id': 'npL+EUxf',
                    'block': '{"statements":[["text","\\n                "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n            "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                    'meta': {}
                }));
                var $input = this.$('input');

                var testUrl = function testUrl(url) {
                    expectedUrl = url;
                    run(function () {
                        $input.val(currentUrl + 'blog' + url).trigger('input');
                    });
                    run(function () {
                        $input.trigger('blur');
                    });
                };

                testUrl('/about/');
                testUrl('/about#contact');
                testUrl('/test/nested/');
            });

            (0, _mocha.it)('handles URLs relative to base host', function () {
                var expectedUrl = '';

                this.on('updateUrl', function (url) {
                    (0, _chai.expect)(url).to.equal(expectedUrl);
                });

                this.render(_ember['default'].HTMLBars.template({
                    'id': 'npL+EUxf',
                    'block': '{"statements":[["text","\\n                "],["append",["helper",["gh-navitem-url-input"],null,[["baseUrl","url","isNew","change","clearErrors"],[["get",["baseUrl"]],["get",["url"]],["get",["isNew"]],"updateUrl",["helper",["action"],[["get",[null]],"clearErrors"],null]]]],false],["text","\\n            "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                    'meta': {}
                }));
                var $input = this.$('input');

                var testUrl = function testUrl(url) {
                    expectedUrl = url;
                    run(function () {
                        $input.val(url).trigger('input');
                    });
                    run(function () {
                        $input.trigger('blur');
                    });
                };

                testUrl('http://' + window.location.host);
                testUrl('https://' + window.location.host);
                testUrl('http://' + window.location.host + '/');
                testUrl('https://' + window.location.host + '/');
                testUrl('http://' + window.location.host + '/test');
                testUrl('https://' + window.location.host + '/test');
                testUrl('http://' + window.location.host + '/#test');
                testUrl('https://' + window.location.host + '/#test');
                testUrl('http://' + window.location.host + '/another/folder');
                testUrl('https://' + window.location.host + '/another/folder');
            });
        });
    });
});
/* jshint scripturl:true */
define('ghost-admin/tests/integration/components/gh-navitem-url-input-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-navitem-url-input-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-notification-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Integration: Component: gh-notification', function () {
        (0, _emberMocha.setupComponentTest)('gh-notification', {
            integration: true
        });

        (0, _mocha.it)('renders', function () {
            this.set('message', { message: 'Test message', type: 'success' });

            this.render(Ember.HTMLBars.template({
                'id': 'diRw+xdN',
                'block': '{"statements":[["append",["helper",["gh-notification"],null,[["message"],[["get",["message"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$('article.gh-notification')).to.have.length(1);
            var $notification = this.$('.gh-notification');

            (0, _chai.expect)($notification.hasClass('gh-notification-passive')).to.be['true'];
            (0, _chai.expect)($notification.text()).to.match(/Test message/);
        });

        (0, _mocha.it)('maps message types to CSS classes', function () {
            this.set('message', { message: 'Test message', type: 'success' });

            this.render(Ember.HTMLBars.template({
                'id': 'diRw+xdN',
                'block': '{"statements":[["append",["helper",["gh-notification"],null,[["message"],[["get",["message"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var $notification = this.$('.gh-notification');

            this.set('message.type', 'success');
            (0, _chai.expect)($notification.hasClass('gh-notification-green'), 'success class isn\'t green').to.be['true'];

            this.set('message.type', 'error');
            (0, _chai.expect)($notification.hasClass('gh-notification-red'), 'success class isn\'t red').to.be['true'];

            this.set('message.type', 'warn');
            (0, _chai.expect)($notification.hasClass('gh-notification-yellow'), 'success class isn\'t yellow').to.be['true'];
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-notification-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-notification-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-notifications-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-service', 'ember-array/utils'], function (exports, _chai, _mocha, _emberMocha, _emberService, _emberArrayUtils) {

    var notificationsStub = _emberService['default'].extend({
        notifications: (0, _emberArrayUtils.A)()
    });

    (0, _mocha.describe)('Integration: Component: gh-notifications', function () {
        (0, _emberMocha.setupComponentTest)('gh-notifications', {
            integration: true
        });

        beforeEach(function () {
            this.register('service:notifications', notificationsStub);
            this.inject.service('notifications', { as: 'notifications' });

            this.set('notifications.notifications', [{ message: 'First', type: 'error' }, { message: 'Second', type: 'warn' }]);
        });

        (0, _mocha.it)('renders', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'kQGZ2vKv',
                'block': '{"statements":[["append",["unknown",["gh-notifications"]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.gh-notifications').length).to.equal(1);

            (0, _chai.expect)(this.$('.gh-notifications').children().length).to.equal(2);

            this.set('notifications.notifications', (0, _emberArrayUtils.A)());
            (0, _chai.expect)(this.$('.gh-notifications').children().length).to.equal(0);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-notifications-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-notifications-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-profile-image-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-service', 'ember-runloop', 'pretender', 'ember-test-helpers/wait'], function (exports, _chai, _mocha, _emberMocha, _emberService, _emberRunloop, _pretender, _emberTestHelpersWait) {

    var pathsStub = _emberService['default'].extend({
        url: {
            api: function api() {
                return '';
            },
            asset: function asset(src) {
                return src;
            }
        }
    });

    var stubKnownGravatar = function stubKnownGravatar(server) {
        server.get('http://www.gravatar.com/avatar/:md5', function () {
            return [200, { 'Content-Type': 'image/png' }, ''];
        });
    };

    var stubUnknownGravatar = function stubUnknownGravatar(server) {
        server.get('http://www.gravatar.com/avatar/:md5', function () {
            return [404, {}, ''];
        });
    };

    (0, _mocha.describe)('Integration: Component: gh-profile-image', function () {
        (0, _emberMocha.setupComponentTest)('gh-profile-image', {
            integration: true
        });

        var server = undefined;

        beforeEach(function () {
            this.register('service:ghost-paths', pathsStub);
            this.inject.service('ghost-paths', { as: 'ghost-paths' });

            server = new _pretender['default']();
            stubKnownGravatar(server);
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('renders', function () {
            this.set('email', '');

            this.render(Ember.HTMLBars.template({
                'id': 'Te7yFZMQ',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-profile-image"],null,[["email"],[["get",["email"]]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$()).to.have.length(1);
        });

        (0, _mocha.it)('renders default image if no email supplied', function () {
            this.set('email', null);

            this.render(Ember.HTMLBars.template({
                'id': 'EbwhZm/a',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-profile-image"],null,[["email","size","debounce"],[["get",["email"]],100,50]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$('.gravatar-img').attr('style'), 'gravatar image style').to.be.blank;
        });

        (0, _mocha.it)('renders the gravatar if valid email supplied', function (done) {
            var _this = this;

            var email = 'test@example.com';
            var expectedUrl = '//www.gravatar.com/avatar/' + md5(email) + '?s=100&d=404';

            this.set('email', email);

            this.render(Ember.HTMLBars.template({
                'id': 'EbwhZm/a',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-profile-image"],null,[["email","size","debounce"],[["get",["email"]],100,50]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            // wait for the ajax request to complete
            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this.$('.gravatar-img').attr('style'), 'gravatar image style').to.equal('background-image: url(' + expectedUrl + ')');
                done();
            });
        });

        (0, _mocha.it)('doesn\'t add background url if gravatar image doesn\'t exist', function (done) {
            var _this2 = this;

            stubUnknownGravatar(server);

            this.render(Ember.HTMLBars.template({
                'id': '1USwGODW',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-profile-image"],null,[["email","size","debounce"],["test@example.com",100,50]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this2.$('.gravatar-img').attr('style'), 'gravatar image style').to.be.blank;
                done();
            });
        });

        (0, _mocha.it)('throttles gravatar loading as email is changed', function (done) {
            var _this3 = this;

            var email = 'test@example.com';
            var expectedUrl = '//www.gravatar.com/avatar/' + md5(email) + '?s=100&d=404';

            this.set('email', 'test');

            this.render(Ember.HTMLBars.template({
                'id': 'sqKhV/Vr',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-profile-image"],null,[["email","size","debounce"],[["get",["email"]],100,300]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                _this3.set('email', email);
            });

            (0, _chai.expect)(this.$('.gravatar-img').attr('style'), '.gravatar-img background not immediately changed on email change').to.be.blank;

            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('.gravatar-img').attr('style'), '.gravatar-img background still not changed before debounce timeout').to.be.blank;
            }, 250);

            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('.gravatar-img').attr('style'), '.gravatar-img background changed after debounce timeout').to.equal('background-image: url(' + expectedUrl + ')');
                done();
            }, 400);
        });
    });
});
/* jshint expr:true */
/* global md5 */
define('ghost-admin/tests/integration/components/gh-profile-image-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-profile-image-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-search-input-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-runloop', 'pretender', 'ember-test-helpers/wait'], function (exports, _chai, _mocha, _emberMocha, _emberRunloop, _pretender, _emberTestHelpersWait) {

    (0, _mocha.describe)('Integration: Component: gh-search-input', function () {
        (0, _emberMocha.setupComponentTest)('gh-search-input', {
            integration: true
        });

        var server = undefined;

        beforeEach(function () {
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('renders', function () {
            // renders the component on the page
            this.render(Ember.HTMLBars.template({
                'id': 'E9TTf/SD',
                'block': '{"statements":[["append",["unknown",["gh-search-input"]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$('.ember-power-select-search input')).to.have.length(1);
        });

        (0, _mocha.it)('opens the dropdown on text entry', function (done) {
            var _this = this;

            this.render(Ember.HTMLBars.template({
                'id': 'E9TTf/SD',
                'block': '{"statements":[["append",["unknown",["gh-search-input"]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            // enter text to trigger search
            (0, _emberRunloop['default'])(function () {
                _this.$('input[type="search"]').val('test').trigger('input');
            });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this.$('.ember-basic-dropdown-content').length).to.equal(1);
                done();
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-search-input-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-search-input-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-subscribers-table-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-light-table'], function (exports, _chai, _mocha, _emberMocha, _emberLightTable) {

    (0, _mocha.describe)('Integration: Component: gh-subscribers-table', function () {
        (0, _emberMocha.setupComponentTest)('gh-subscribers-table', {
            integration: true
        });

        (0, _mocha.it)('renders', function () {
            this.set('table', new _emberLightTable['default']([], []));
            this.set('sortByColumn', function () {});
            this.set('delete', function () {});

            this.render(Ember.HTMLBars.template({
                'id': 'erwhqh4f',
                'block': '{"statements":[["append",["helper",["gh-subscribers-table"],null,[["table","sortByColumn","delete"],[["get",["table"]],["helper",["action"],[["get",[null]],["get",["sortByColumn"]]],null],["helper",["action"],[["get",[null]],["get",["delete"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-subscribers-table-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-subscribers-table-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-tag-settings-form-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-service', 'ember-object', 'ember-runloop', 'ember-data', 'ember-test-helpers/wait'], function (exports, _chai, _mocha, _emberMocha, _emberService, _emberObject, _emberRunloop, _emberData, _emberTestHelpersWait) {
    var Errors = _emberData['default'].Errors;

    var configStub = _emberService['default'].extend({
        blogUrl: 'http://localhost:2368'
    });

    var mediaQueriesStub = _emberService['default'].extend({
        maxWidth600: false
    });

    (0, _mocha.describe)('Integration: Component: gh-tag-settings-form', function () {
        (0, _emberMocha.setupComponentTest)('gh-tag-settings-form', {
            integration: true
        });

        beforeEach(function () {
            /* eslint-disable camelcase */
            var tag = _emberObject['default'].create({
                id: 1,
                name: 'Test',
                slug: 'test',
                description: 'Description.',
                metaTitle: 'Meta Title',
                metaDescription: 'Meta description',
                errors: Errors.create(),
                hasValidated: []
            });
            /* eslint-enable camelcase */

            this.set('tag', tag);
            this.set('actions.setProperty', function (property, value) {
                // this should be overridden if a call is expected
                // eslint-disable-next-line no-console
                console.error('setProperty called \'' + property + ': ' + value + '\'');
            });

            this.register('service:config', configStub);
            this.inject.service('config', { as: 'config' });

            this.register('service:media-queries', mediaQueriesStub);
            this.inject.service('media-queries', { as: 'mediaQueries' });
        });

        (0, _mocha.it)('renders', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);
        });

        (0, _mocha.it)('has the correct title', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.tag-settings-pane h4').text(), 'existing tag title').to.equal('Tag Settings');

            this.set('tag.isNew', true);
            (0, _chai.expect)(this.$('.tag-settings-pane h4').text(), 'new tag title').to.equal('New Tag');
        });

        (0, _mocha.it)('renders main settings', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$('.gh-image-uploader').length, 'displays image uploader').to.equal(1);
            (0, _chai.expect)(this.$('input[name="name"]').val(), 'name field value').to.equal('Test');
            (0, _chai.expect)(this.$('input[name="slug"]').val(), 'slug field value').to.equal('test');
            (0, _chai.expect)(this.$('textarea[name="description"]').val(), 'description field value').to.equal('Description.');
            (0, _chai.expect)(this.$('input[name="metaTitle"]').val(), 'metaTitle field value').to.equal('Meta Title');
            (0, _chai.expect)(this.$('textarea[name="metaDescription"]').val(), 'metaDescription field value').to.equal('Meta description');
        });

        (0, _mocha.it)('can switch between main/meta settings', function () {
            var _this = this;

            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$('.tag-settings-pane').hasClass('settings-menu-pane-in'), 'main settings are displayed by default').to.be['true'];
            (0, _chai.expect)(this.$('.tag-meta-settings-pane').hasClass('settings-menu-pane-out-right'), 'meta settings are hidden by default').to.be['true'];

            (0, _emberRunloop['default'])(function () {
                _this.$('.meta-data-button').click();
            });

            (0, _chai.expect)(this.$('.tag-settings-pane').hasClass('settings-menu-pane-out-left'), 'main settings are hidden after clicking Meta Data button').to.be['true'];
            (0, _chai.expect)(this.$('.tag-meta-settings-pane').hasClass('settings-menu-pane-in'), 'meta settings are displayed after clicking Meta Data button').to.be['true'];

            (0, _emberRunloop['default'])(function () {
                _this.$('.back').click();
            });

            (0, _chai.expect)(this.$('.tag-settings-pane').hasClass('settings-menu-pane-in'), 'main settings are displayed after clicking "back"').to.be['true'];
            (0, _chai.expect)(this.$('.tag-meta-settings-pane').hasClass('settings-menu-pane-out-right'), 'meta settings are hidden after clicking "back"').to.be['true'];
        });

        (0, _mocha.it)('has one-way binding for properties', function () {
            var _this2 = this;

            this.set('actions.setProperty', function () {
                // noop
            });

            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                _this2.$('input[name="name"]').val('New name');
                _this2.$('input[name="slug"]').val('new-slug');
                _this2.$('textarea[name="description"]').val('New description');
                _this2.$('input[name="metaTitle"]').val('New metaTitle');
                _this2.$('textarea[name="metaDescription"]').val('New metaDescription');
            });

            (0, _chai.expect)(this.get('tag.name'), 'tag name').to.equal('Test');
            (0, _chai.expect)(this.get('tag.slug'), 'tag slug').to.equal('test');
            (0, _chai.expect)(this.get('tag.description'), 'tag description').to.equal('Description.');
            (0, _chai.expect)(this.get('tag.metaTitle'), 'tag metaTitle').to.equal('Meta Title');
            (0, _chai.expect)(this.get('tag.metaDescription'), 'tag metaDescription').to.equal('Meta description');
        });

        (0, _mocha.it)('triggers setProperty action on blur of all fields', function () {
            var _this3 = this;

            var expectedProperty = '';
            var expectedValue = '';

            this.set('actions.setProperty', function (property, value) {
                (0, _chai.expect)(property, 'property').to.equal(expectedProperty);
                (0, _chai.expect)(value, 'value').to.equal(expectedValue);
            });

            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            expectedProperty = 'name';
            expectedValue = 'new-slug';
            (0, _emberRunloop['default'])(function () {
                _this3.$('input[name="name"]').val('New name');
            });

            expectedProperty = 'url';
            expectedValue = 'new-slug';
            (0, _emberRunloop['default'])(function () {
                _this3.$('input[name="slug"]').val('new-slug');
            });

            expectedProperty = 'description';
            expectedValue = 'New description';
            (0, _emberRunloop['default'])(function () {
                _this3.$('textarea[name="description"]').val('New description');
            });

            expectedProperty = 'metaTitle';
            expectedValue = 'New metaTitle';
            (0, _emberRunloop['default'])(function () {
                _this3.$('input[name="metaTitle"]').val('New metaTitle');
            });

            expectedProperty = 'metaDescription';
            expectedValue = 'New metaDescription';
            (0, _emberRunloop['default'])(function () {
                _this3.$('textarea[name="metaDescription"]').val('New metaDescription');
            });
        });

        (0, _mocha.it)('displays error messages for validated fields', function () {
            var _this4 = this;

            var errors = this.get('tag.errors');
            var hasValidated = this.get('tag.hasValidated');

            errors.add('name', 'must be present');
            hasValidated.push('name');

            errors.add('slug', 'must be present');
            hasValidated.push('slug');

            errors.add('description', 'is too long');
            hasValidated.push('description');

            errors.add('metaTitle', 'is too long');
            hasValidated.push('metaTitle');

            errors.add('metaDescription', 'is too long');
            hasValidated.push('metaDescription');

            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            return (0, _emberTestHelpersWait['default'])().then(function () {
                var nameFormGroup = _this4.$('input[name="name"]').closest('.form-group');
                (0, _chai.expect)(nameFormGroup.hasClass('error'), 'name form group has error state').to.be['true'];
                (0, _chai.expect)(nameFormGroup.find('.response').length, 'name form group has error message').to.equal(1);

                var slugFormGroup = _this4.$('input[name="slug"]').closest('.form-group');
                (0, _chai.expect)(slugFormGroup.hasClass('error'), 'slug form group has error state').to.be['true'];
                (0, _chai.expect)(slugFormGroup.find('.response').length, 'slug form group has error message').to.equal(1);

                var descriptionFormGroup = _this4.$('textarea[name="description"]').closest('.form-group');
                (0, _chai.expect)(descriptionFormGroup.hasClass('error'), 'description form group has error state').to.be['true'];

                var metaTitleFormGroup = _this4.$('input[name="metaTitle"]').closest('.form-group');
                (0, _chai.expect)(metaTitleFormGroup.hasClass('error'), 'metaTitle form group has error state').to.be['true'];
                (0, _chai.expect)(metaTitleFormGroup.find('.response').length, 'metaTitle form group has error message').to.equal(1);

                var metaDescriptionFormGroup = _this4.$('textarea[name="metaDescription"]').closest('.form-group');
                (0, _chai.expect)(metaDescriptionFormGroup.hasClass('error'), 'metaDescription form group has error state').to.be['true'];
                (0, _chai.expect)(metaDescriptionFormGroup.find('.response').length, 'metaDescription form group has error message').to.equal(1);
            });
        });

        (0, _mocha.it)('displays char count for text fields', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            var descriptionFormGroup = this.$('textarea[name="description"]').closest('.form-group');
            (0, _chai.expect)(descriptionFormGroup.find('.word-count').text(), 'description char count').to.equal('12');

            var metaDescriptionFormGroup = this.$('textarea[name="metaDescription"]').closest('.form-group');
            (0, _chai.expect)(metaDescriptionFormGroup.find('.word-count').text(), 'description char count').to.equal('16');
        });

        (0, _mocha.it)('renders SEO title preview', function () {
            var _this5 = this;

            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.seo-preview-title').text(), 'displays meta title if present').to.equal('Meta Title');

            (0, _emberRunloop['default'])(function () {
                _this5.set('tag.metaTitle', '');
            });
            (0, _chai.expect)(this.$('.seo-preview-title').text(), 'falls back to tag name without metaTitle').to.equal('Test');

            (0, _emberRunloop['default'])(function () {
                _this5.set('tag.name', new Array(151).join('x'));
            });
            var expectedLength = 70 + '…'.length;
            (0, _chai.expect)(this.$('.seo-preview-title').text().length, 'cuts title to max 70 chars').to.equal(expectedLength);
        });

        (0, _mocha.it)('renders SEO URL preview', function () {
            var _this6 = this;

            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.seo-preview-link').text(), 'adds url and tag prefix').to.equal('http://localhost:2368/tag/test/');

            (0, _emberRunloop['default'])(function () {
                _this6.set('tag.slug', new Array(151).join('x'));
            });
            var expectedLength = 70 + '…'.length;
            (0, _chai.expect)(this.$('.seo-preview-link').text().length, 'cuts slug to max 70 chars').to.equal(expectedLength);
        });

        (0, _mocha.it)('renders SEO description preview', function () {
            var _this7 = this;

            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.seo-preview-description').text(), 'displays meta description if present').to.equal('Meta description');

            (0, _emberRunloop['default'])(function () {
                _this7.set('tag.metaDescription', '');
            });
            (0, _chai.expect)(this.$('.seo-preview-description').text(), 'falls back to tag description without metaDescription').to.equal('Description.');

            (0, _emberRunloop['default'])(function () {
                _this7.set('tag.description', new Array(200).join('x'));
            });
            var expectedLength = 156 + '…'.length;
            (0, _chai.expect)(this.$('.seo-preview-description').text().length, 'cuts description to max 156 chars').to.equal(expectedLength);
        });

        (0, _mocha.it)('resets if a new tag is received', function () {
            var _this8 = this;

            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _emberRunloop['default'])(function () {
                _this8.$('.meta-data-button').click();
            });
            (0, _chai.expect)(this.$('.tag-meta-settings-pane').hasClass('settings-menu-pane-in'), 'meta data pane is shown').to.be['true'];

            (0, _emberRunloop['default'])(function () {
                _this8.set('tag', _emberObject['default'].create({ id: '2' }));
            });
            (0, _chai.expect)(this.$('.tag-settings-pane').hasClass('settings-menu-pane-in'), 'resets to main settings').to.be['true'];
        });

        (0, _mocha.it)('triggers delete tag modal on delete click', function (done) {
            var _this9 = this;

            // TODO: will time out if this isn't hit, there's probably a better
            // way of testing this
            this.set('actions.openModal', function () {
                done();
            });

            this.render(Ember.HTMLBars.template({
                'id': 'xtCdj3Ym',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty","showDeleteTagModal"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null],["helper",["action"],[["get",[null]],"openModal"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                _this9.$('.tag-delete-button').click();
            });
        });

        (0, _mocha.it)('shows settings.tags arrow link on mobile', function () {
            this.set('mediaQueries.maxWidth600', true);

            this.render(Ember.HTMLBars.template({
                'id': 'HcXaXeyh',
                'block': '{"statements":[["text","\\n            "],["append",["helper",["gh-tag-settings-form"],null,[["tag","setProperty"],[["get",["tag"]],["helper",["action"],[["get",[null]],"setProperty"],null]]]],false],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$('.tag-settings-pane .settings-menu-header .settings-menu-header-action').length, 'settings.tags link is shown').to.equal(1);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-tag-settings-form-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-tag-settings-form-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-tags-management-container-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Integration: Component: gh-tags-management-container', function () {
        (0, _emberMocha.setupComponentTest)('gh-tags-management-container', {
            integration: true
        });

        (0, _mocha.it)('renders', function () {
            this.set('tags', []);
            this.set('selectedTag', null);
            this.on('enteredMobile', function () {
                // noop
            });
            this.on('leftMobile', function () {
                // noop
            });

            this.render(Ember.HTMLBars.template({
                'id': 'R+KjCeI2',
                'block': '{"statements":[["text","\\n            "],["block",["gh-tags-management-container"],null,[["tags","selectedTag","enteredMobile","leftMobile"],[["get",["tags"]],["get",["selectedTag"]],"enteredMobile","leftMobile"]],0],["text","\\n        "]],"locals":[],"named":[],"yields":[],"blocks":[{"statements":[],"locals":[]}],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-tags-management-container-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-tags-management-container-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-task-button-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-concurrency', 'ember-runloop', 'ember-test-helpers/wait'], function (exports, _chai, _mocha, _emberMocha, _emberConcurrency, _emberRunloop, _emberTestHelpersWait) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    (0, _mocha.describe)('Integration: Component: gh-task-button', function () {
        (0, _emberMocha.setupComponentTest)('gh-task-button', {
            integration: true
        });

        (0, _mocha.it)('renders', function () {
            // sets button text using positional param
            this.render(Ember.HTMLBars.template({
                'id': '1X5FUmM3',
                'block': '{"statements":[["append",["helper",["gh-task-button"],["Test"],null],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('button')).to.exist;
            (0, _chai.expect)(this.$('button')).to.contain('Test');
            (0, _chai.expect)(this.$('button')).to.have.prop('disabled', false);

            this.render(Ember.HTMLBars.template({
                'id': 'a/iKsrNy',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["class"],["testing"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('button')).to.have['class']('testing');
            // default button text is "Save"
            (0, _chai.expect)(this.$('button')).to.contain('Save');

            // passes disabled attr
            this.render(Ember.HTMLBars.template({
                'id': '4/K/QmlN',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["disabled","buttonText"],[true,"Test"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('button')).to.have.prop('disabled', true);
            // allows button text to be set via hash param
            (0, _chai.expect)(this.$('button')).to.contain('Test');

            // passes type attr
            this.render(Ember.HTMLBars.template({
                'id': 'E/R0HQdT',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["type"],["submit"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('button')).to.have.attr('type', 'submit');

            // passes tabindex attr
            this.render(Ember.HTMLBars.template({
                'id': '9Slml2WA',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["tabindex"],["-1"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('button')).to.have.attr('tabindex', '-1');
        });

        (0, _mocha.it)('shows spinner whilst running', function (done) {
            this.set('myTask', (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$2$0() {
                return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
                    while (1) switch (context$3$0.prev = context$3$0.next) {
                        case 0:
                            context$3$0.next = 2;
                            return (0, _emberConcurrency.timeout)(50);

                        case 2:
                        case 'end':
                            return context$3$0.stop();
                    }
                }, callee$2$0, this);
            })));

            this.render(Ember.HTMLBars.template({
                'id': 'Wj8ZbuKp',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["task"],[["get",["myTask"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            this.get('myTask').perform();

            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('button')).to.have.descendants('span.spinner');
            }, 20);

            (0, _emberTestHelpersWait['default'])().then(done);
        });

        (0, _mocha.it)('appears disabled whilst running', function (done) {
            this.set('myTask', (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$2$0() {
                return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
                    while (1) switch (context$3$0.prev = context$3$0.next) {
                        case 0:
                            context$3$0.next = 2;
                            return (0, _emberConcurrency.timeout)(50);

                        case 2:
                        case 'end':
                            return context$3$0.stop();
                    }
                }, callee$2$0, this);
            })));

            this.render(Ember.HTMLBars.template({
                'id': 'Wj8ZbuKp',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["task"],[["get",["myTask"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('button'), 'initial class').to.not.have['class']('appear-disabled');

            this.get('myTask').perform();

            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('button'), 'running class').to.have['class']('appear-disabled');
            }, 20);

            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('button'), 'ended class').to.not.have['class']('appear-disabled');
            }, 100);

            (0, _emberTestHelpersWait['default'])().then(done);
        });

        (0, _mocha.it)('shows success on success', function (done) {
            this.set('myTask', (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$2$0() {
                return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
                    while (1) switch (context$3$0.prev = context$3$0.next) {
                        case 0:
                            context$3$0.next = 2;
                            return (0, _emberConcurrency.timeout)(50);

                        case 2:
                            return context$3$0.abrupt('return', true);

                        case 3:
                        case 'end':
                            return context$3$0.stop();
                    }
                }, callee$2$0, this);
            })));

            this.render(Ember.HTMLBars.template({
                'id': 'Wj8ZbuKp',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["task"],[["get",["myTask"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            this.get('myTask').perform();

            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('button')).to.have['class']('gh-btn-green');
                (0, _chai.expect)(this.$('button')).to.contain('Saved');
            }, 100);

            (0, _emberTestHelpersWait['default'])().then(done);
        });

        (0, _mocha.it)('assigns specified success class on success', function (done) {
            this.set('myTask', (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$2$0() {
                return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
                    while (1) switch (context$3$0.prev = context$3$0.next) {
                        case 0:
                            context$3$0.next = 2;
                            return (0, _emberConcurrency.timeout)(50);

                        case 2:
                            return context$3$0.abrupt('return', true);

                        case 3:
                        case 'end':
                            return context$3$0.stop();
                    }
                }, callee$2$0, this);
            })));

            this.render(Ember.HTMLBars.template({
                'id': 'lvfjOuMf',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["task","successClass"],[["get",["myTask"]],"im-a-success"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            this.get('myTask').perform();

            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('button')).to.not.have['class']('gh-btn-green');
                (0, _chai.expect)(this.$('button')).to.have['class']('im-a-success');
                (0, _chai.expect)(this.$('button')).to.contain('Saved');
            }, 100);

            (0, _emberTestHelpersWait['default'])().then(done);
        });

        (0, _mocha.it)('shows failure when task errors', function (done) {
            this.set('myTask', (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$2$0() {
                return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
                    while (1) switch (context$3$0.prev = context$3$0.next) {
                        case 0:
                            context$3$0.prev = 0;
                            context$3$0.next = 3;
                            return (0, _emberConcurrency.timeout)(50);

                        case 3:
                            throw new ReferenceError('test error');

                        case 6:
                            context$3$0.prev = 6;
                            context$3$0.t0 = context$3$0['catch'](0);

                        case 8:
                        case 'end':
                            return context$3$0.stop();
                    }
                }, callee$2$0, this, [[0, 6]]);
            })));

            // noop, prevent mocha triggering unhandled error assert
            this.render(Ember.HTMLBars.template({
                'id': 'Wj8ZbuKp',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["task"],[["get",["myTask"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            this.get('myTask').perform();

            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('button')).to.have['class']('gh-btn-red');
                (0, _chai.expect)(this.$('button')).to.contain('Retry');
            }, 100);

            (0, _emberTestHelpersWait['default'])().then(done);
        });

        (0, _mocha.it)('shows failure on falsy response', function (done) {
            this.set('myTask', (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$2$0() {
                return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
                    while (1) switch (context$3$0.prev = context$3$0.next) {
                        case 0:
                            context$3$0.next = 2;
                            return (0, _emberConcurrency.timeout)(50);

                        case 2:
                            return context$3$0.abrupt('return', false);

                        case 3:
                        case 'end':
                            return context$3$0.stop();
                    }
                }, callee$2$0, this);
            })));

            this.render(Ember.HTMLBars.template({
                'id': 'Wj8ZbuKp',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["task"],[["get",["myTask"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            this.get('myTask').perform();

            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('button')).to.have['class']('gh-btn-red');
                (0, _chai.expect)(this.$('button')).to.contain('Retry');
            }, 100);

            (0, _emberTestHelpersWait['default'])().then(done);
        });

        (0, _mocha.it)('assigns specified failure class on failure', function (done) {
            this.set('myTask', (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$2$0() {
                return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
                    while (1) switch (context$3$0.prev = context$3$0.next) {
                        case 0:
                            context$3$0.next = 2;
                            return (0, _emberConcurrency.timeout)(50);

                        case 2:
                            return context$3$0.abrupt('return', false);

                        case 3:
                        case 'end':
                            return context$3$0.stop();
                    }
                }, callee$2$0, this);
            })));

            this.render(Ember.HTMLBars.template({
                'id': 'KXWiIrGH',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["task","failureClass"],[["get",["myTask"]],"im-a-failure"]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            this.get('myTask').perform();

            _emberRunloop['default'].later(this, function () {
                (0, _chai.expect)(this.$('button')).to.not.have['class']('gh-btn-red');
                (0, _chai.expect)(this.$('button')).to.have['class']('im-a-failure');
                (0, _chai.expect)(this.$('button')).to.contain('Retry');
            }, 100);

            (0, _emberTestHelpersWait['default'])().then(done);
        });

        (0, _mocha.it)('performs task on click', function (done) {
            var taskCount = 0;

            this.set('myTask', (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$2$0() {
                return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
                    while (1) switch (context$3$0.prev = context$3$0.next) {
                        case 0:
                            context$3$0.next = 2;
                            return (0, _emberConcurrency.timeout)(50);

                        case 2:
                            taskCount = taskCount + 1;

                        case 3:
                        case 'end':
                            return context$3$0.stop();
                    }
                }, callee$2$0, this);
            })));

            this.render(Ember.HTMLBars.template({
                'id': 'Wj8ZbuKp',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["task"],[["get",["myTask"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            this.$('button').click();

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(taskCount, 'taskCount').to.equal(1);
                done();
            });
        });

        (0, _mocha.it)('keeps button size when showing spinner', function (done) {
            this.set('myTask', (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$2$0() {
                return regeneratorRuntime.wrap(function callee$2$0$(context$3$0) {
                    while (1) switch (context$3$0.prev = context$3$0.next) {
                        case 0:
                            context$3$0.next = 2;
                            return (0, _emberConcurrency.timeout)(50);

                        case 2:
                        case 'end':
                            return context$3$0.stop();
                    }
                }, callee$2$0, this);
            })));

            this.render(Ember.HTMLBars.template({
                'id': 'Wj8ZbuKp',
                'block': '{"statements":[["append",["helper",["gh-task-button"],null,[["task"],[["get",["myTask"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            var width = this.$('button').width();
            var height = this.$('button').height();
            (0, _chai.expect)(this.$('button')).to.not.have.attr('style');

            this.get('myTask').perform();

            _emberRunloop['default'].later(this, function () {
                // we can't test exact width/height because Chrome/Firefox use different rounding methods
                // expect(this.$('button')).to.have.attr('style', `width: ${width}px; height: ${height}px;`);

                var _width$toString$split = width.toString().split('.');

                var _width$toString$split2 = _slicedToArray(_width$toString$split, 1);

                var widthInt = _width$toString$split2[0];

                var _height$toString$split = height.toString().split('.');

                var _height$toString$split2 = _slicedToArray(_height$toString$split, 1);

                var heightInt = _height$toString$split2[0];

                (0, _chai.expect)(this.$('button').attr('style')).to.have.string('width: ' + widthInt);
                (0, _chai.expect)(this.$('button').attr('style')).to.have.string('height: ' + heightInt);
            }, 20);

            _emberRunloop['default'].later(this, function () {
                // chai-jquery test doesn't work because Firefox outputs blank string
                // expect(this.$('button')).to.not.have.attr('style');
                (0, _chai.expect)(this.$('button').attr('style')).to.be.blank;
            }, 100);

            (0, _emberTestHelpersWait['default'])().then(done);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-task-button-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-task-button-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-theme-table-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'jquery', 'sinon', 'ember-runloop', 'ember-test-selectors'], function (exports, _chai, _mocha, _emberMocha, _jquery, _sinon, _emberRunloop, _emberTestSelectors) {

    (0, _mocha.describe)('Integration: Component: gh-theme-table', function () {
        (0, _emberMocha.setupComponentTest)('gh-theme-table', {
            integration: true
        });

        (0, _mocha.it)('renders', function () {
            this.set('themes', [{ name: 'Daring', 'package': { name: 'Daring', version: '0.1.4' }, active: true }, { name: 'casper', 'package': { name: 'Casper', version: '1.3.1' } }, { name: 'oscar-ghost-1.1.0', 'package': { name: 'Lanyon', version: '1.1.0' } }, { name: 'foo' }]);
            this.set('actionHandler', _sinon['default'].spy());

            this.render(Ember.HTMLBars.template({
                'id': '2vEKsbfI',
                'block': '{"statements":[["append",["helper",["gh-theme-table"],null,[["themes","activateTheme","downloadTheme","deleteTheme"],[["get",["themes"]],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$((0, _emberTestSelectors['default'])('themes-list')).length, 'themes list is present').to.equal(1);
            (0, _chai.expect)(this.$((0, _emberTestSelectors['default'])('theme-id')).length, 'number of rows').to.equal(4);

            var packageNames = this.$((0, _emberTestSelectors['default'])('theme-title')).map(function (i, name) {
                return (0, _jquery['default'])(name).text().trim();
            }).toArray();

            (0, _chai.expect)(packageNames, 'themes are ordered by label, casper has "default"').to.deep.equal(['Casper (default)', 'Daring', 'foo', 'Lanyon']);

            (0, _chai.expect)(this.$((0, _emberTestSelectors['default'])('theme-active', 'true')).find((0, _emberTestSelectors['default'])('theme-title')).text().trim(), 'active theme is highlighted').to.equal('Daring');

            (0, _chai.expect)(this.$((0, _emberTestSelectors['default'])('theme-activate-button')).length === 3, 'non-active themes have an activate link').to.be['true'];

            (0, _chai.expect)(this.$((0, _emberTestSelectors['default'])('theme-active', 'true')).find((0, _emberTestSelectors['default'])('theme-activate-button')).length === 0, 'active theme doesn\'t have an activate link').to.be['true'];

            (0, _chai.expect)(this.$((0, _emberTestSelectors['default'])('theme-download-button')).length, 'all themes have a download link').to.equal(4);

            (0, _chai.expect)(this.$((0, _emberTestSelectors['default'])('theme-id', 'foo')).find((0, _emberTestSelectors['default'])('theme-delete-button')).length === 1, 'non-active, non-casper theme has delete link').to.be['true'];

            (0, _chai.expect)(this.$((0, _emberTestSelectors['default'])('theme-id', 'casper')).find((0, _emberTestSelectors['default'])('theme-delete-button')).length === 0, 'casper doesn\'t have delete link').to.be['true'];

            (0, _chai.expect)(this.$((0, _emberTestSelectors['default'])('theme-active', 'true')).find((0, _emberTestSelectors['default'])('theme-delete-button')).length === 0, 'active theme doesn\'t have delete link').to.be['true'];
        });

        (0, _mocha.it)('delete link triggers passed in action', function () {
            var _this = this;

            var deleteAction = _sinon['default'].spy();
            var actionHandler = _sinon['default'].spy();

            this.set('themes', [{ name: 'Foo', active: true }, { name: 'Bar' }]);
            this.set('deleteAction', deleteAction);
            this.set('actionHandler', actionHandler);

            this.render(Ember.HTMLBars.template({
                'id': 'mjbkRYoA',
                'block': '{"statements":[["append",["helper",["gh-theme-table"],null,[["themes","activateTheme","downloadTheme","deleteTheme"],[["get",["themes"]],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null],["helper",["action"],[["get",[null]],["get",["deleteAction"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                _this.$((0, _emberTestSelectors['default'])('theme-id', 'Bar') + ' ' + (0, _emberTestSelectors['default'])('theme-delete-button')).click();
            });

            (0, _chai.expect)(deleteAction.calledOnce).to.be['true'];
            (0, _chai.expect)(deleteAction.firstCall.args[0].name).to.equal('Bar');
        });

        (0, _mocha.it)('download link triggers passed in action', function () {
            var _this2 = this;

            var downloadAction = _sinon['default'].spy();
            var actionHandler = _sinon['default'].spy();

            this.set('themes', [{ name: 'Foo', active: true }, { name: 'Bar' }]);
            this.set('downloadAction', downloadAction);
            this.set('actionHandler', actionHandler);

            this.render(Ember.HTMLBars.template({
                'id': 'peYk097Z',
                'block': '{"statements":[["append",["helper",["gh-theme-table"],null,[["themes","activateTheme","downloadTheme","deleteTheme"],[["get",["themes"]],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null],["helper",["action"],[["get",[null]],["get",["downloadAction"]]],null],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                _this2.$((0, _emberTestSelectors['default'])('theme-id', 'Foo') + ' ' + (0, _emberTestSelectors['default'])('theme-download-button')).click();
            });

            (0, _chai.expect)(downloadAction.calledOnce).to.be['true'];
            (0, _chai.expect)(downloadAction.firstCall.args[0].name).to.equal('Foo');
        });

        (0, _mocha.it)('activate link triggers passed in action', function () {
            var _this3 = this;

            var activateAction = _sinon['default'].spy();
            var actionHandler = _sinon['default'].spy();

            this.set('themes', [{ name: 'Foo', active: true }, { name: 'Bar' }]);
            this.set('activateAction', activateAction);
            this.set('actionHandler', actionHandler);

            this.render(Ember.HTMLBars.template({
                'id': 'gfA44QUy',
                'block': '{"statements":[["append",["helper",["gh-theme-table"],null,[["themes","activateTheme","downloadTheme","deleteTheme"],[["get",["themes"]],["helper",["action"],[["get",[null]],["get",["activateAction"]]],null],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                _this3.$((0, _emberTestSelectors['default'])('theme-id', 'Bar') + ' ' + (0, _emberTestSelectors['default'])('theme-activate-button')).click();
            });

            (0, _chai.expect)(activateAction.calledOnce).to.be['true'];
            (0, _chai.expect)(activateAction.firstCall.args[0].name).to.equal('Bar');
        });

        (0, _mocha.it)('displays folder names if there are duplicate package names', function () {
            this.set('themes', [{ name: 'daring', 'package': { name: 'Daring', version: '0.1.4' }, active: true }, { name: 'daring-0.1.5', 'package': { name: 'Daring', version: '0.1.4' } }, { name: 'casper', 'package': { name: 'Casper', version: '1.3.1' } }, { name: 'another', 'package': { name: 'Casper', version: '1.3.1' } }, { name: 'mine', 'package': { name: 'Casper', version: '1.3.1' } }, { name: 'foo' }]);
            this.set('actionHandler', _sinon['default'].spy());

            this.render(Ember.HTMLBars.template({
                'id': '2vEKsbfI',
                'block': '{"statements":[["append",["helper",["gh-theme-table"],null,[["themes","activateTheme","downloadTheme","deleteTheme"],[["get",["themes"]],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null],["helper",["action"],[["get",[null]],["get",["actionHandler"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            var packageNames = this.$((0, _emberTestSelectors['default'])('theme-title')).map(function (i, name) {
                return (0, _jquery['default'])(name).text().trim();
            }).toArray();

            (0, _chai.expect)(packageNames, 'themes are ordered by label, folder names shown for duplicates').to.deep.equal(['Casper (another)', 'Casper (default)', 'Casper (mine)', 'Daring (daring)', 'Daring (daring-0.1.5)', 'foo']);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-theme-table-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-theme-table-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-timezone-select-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-runloop', 'ember-test-helpers/wait', 'sinon'], function (exports, _chai, _mocha, _emberMocha, _emberRunloop, _emberTestHelpersWait, _sinon) {

    (0, _mocha.describe)('Integration: Component: gh-timezone-select', function () {
        (0, _emberMocha.setupComponentTest)('gh-timezone-select', {
            integration: true
        });

        beforeEach(function () {
            this.set('availableTimezones', [{ name: 'Pacific/Pago_Pago', label: '(GMT -11:00) Midway Island, Samoa' }, { name: 'Etc/UTC', label: '(GMT) UTC' }, { name: 'Pacific/Kwajalein', label: '(GMT +12:00) International Date Line West' }]);
            this.set('activeTimezone', 'Etc/UTC');
        });

        (0, _mocha.it)('renders', function () {
            this.render(Ember.HTMLBars.template({
                'id': 'ESOgGTRn',
                'block': '{"statements":[["append",["helper",["gh-timezone-select"],null,[["availableTimezones","activeTimezone"],[["get",["availableTimezones"]],["get",["activeTimezone"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _chai.expect)(this.$(), 'top-level elements').to.have.length(1);
            (0, _chai.expect)(this.$('option'), 'number of options').to.have.length(3);
            (0, _chai.expect)(this.$('select').val(), 'selected option value').to.equal('Etc/UTC');
        });

        (0, _mocha.it)('handles an unknown timezone', function () {
            this.set('activeTimezone', 'Europe/London');

            this.render(Ember.HTMLBars.template({
                'id': 'ESOgGTRn',
                'block': '{"statements":[["append",["helper",["gh-timezone-select"],null,[["availableTimezones","activeTimezone"],[["get",["availableTimezones"]],["get",["activeTimezone"]]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            // we have an additional blank option at the top
            (0, _chai.expect)(this.$('option'), 'number of options').to.have.length(4);
            // blank option is selected
            (0, _chai.expect)(this.$('select').val(), 'selected option value').to.equal('');
            // we indicate the manual override
            (0, _chai.expect)(this.$('p').text()).to.match(/Your timezone has been automatically set to Europe\/London/);
        });

        (0, _mocha.it)('triggers update action on change', function (done) {
            var _this = this;

            var update = _sinon['default'].spy();
            this.set('update', update);

            this.render(Ember.HTMLBars.template({
                'id': 'w7rcgXum',
                'block': '{"statements":[["append",["helper",["gh-timezone-select"],null,[["availableTimezones","activeTimezone","update"],[["get",["availableTimezones"]],["get",["activeTimezone"]],["helper",["action"],[["get",[null]],["get",["update"]]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                _this.$('select').val('Pacific/Pago_Pago').change();
            });

            (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(update.calledOnce, 'update was called once').to.be['true'];
                (0, _chai.expect)(update.firstCall.args[0].name, 'update was passed new timezone').to.equal('Pacific/Pago_Pago');
                done();
            });
        });

        // TODO: mock clock service, fake the time, test we have the correct
        // local time and it changes alongside selection changes
        (0, _mocha.it)('renders local time');
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-timezone-select-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-timezone-select-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-trim-focus-input-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-runloop'], function (exports, _chai, _mocha, _emberMocha, _emberRunloop) {

    (0, _mocha.describe)('Integration: Component: gh-trim-focus-input', function () {
        (0, _emberMocha.setupComponentTest)('gh-trim-focus-input', {
            integration: true
        });

        (0, _mocha.it)('trims value on focusOut', function () {
            var _this = this;

            this.set('text', 'some random stuff    ');
            this.render(Ember.HTMLBars.template({
                'id': 'VJVWg1k8',
                'block': '{"statements":[["append",["helper",["gh-trim-focus-input"],[["get",["text"]]],[["update"],[["helper",["action"],[["get",[null]],["helper",["mut"],[["get",["text"]]],null]],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                _this.$('.gh-input').trigger('focusout');
            });

            (0, _chai.expect)(this.get('text')).to.equal('some random stuff');
        });

        (0, _mocha.it)('does not have the autofocus attribute if not set to focus', function () {
            this.set('text', 'some text');
            this.render(Ember.HTMLBars.template({
                'id': 'H+7uIrGM',
                'block': '{"statements":[["append",["helper",["gh-trim-focus-input"],[["get",["text"]]],[["shouldFocus"],[false]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.gh-input').attr('autofocus')).to.not.be.ok;
        });

        (0, _mocha.it)('has the autofocus attribute if set to focus', function () {
            this.set('text', 'some text');
            this.render(Ember.HTMLBars.template({
                'id': 'i97uRl9U',
                'block': '{"statements":[["append",["helper",["gh-trim-focus-input"],[["get",["text"]]],[["shouldFocus"],[true]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.gh-input').attr('autofocus')).to.be.ok;
        });

        (0, _mocha.it)('handles undefined values', function () {
            this.set('text', undefined);
            this.render(Ember.HTMLBars.template({
                'id': 'i97uRl9U',
                'block': '{"statements":[["append",["helper",["gh-trim-focus-input"],[["get",["text"]]],[["shouldFocus"],[true]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.gh-input').attr('autofocus')).to.be.ok;
        });

        (0, _mocha.it)('handles non-string values', function () {
            this.set('text', 10);
            this.render(Ember.HTMLBars.template({
                'id': 'i97uRl9U',
                'block': '{"statements":[["append",["helper",["gh-trim-focus-input"],[["get",["text"]]],[["shouldFocus"],[true]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$('.gh-input').val()).to.equal('10');
        });
    });
});
define('ghost-admin/tests/integration/components/gh-trim-focus-input-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-trim-focus-input-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/gh-validation-status-container-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-object', 'ember-data', 'ember-test-helpers/wait'], function (exports, _chai, _mocha, _emberMocha, _emberObject, _emberData, _emberTestHelpersWait) {
    var Errors = _emberData['default'].Errors;

    (0, _mocha.describe)('Integration: Component: gh-validation-status-container', function () {
        (0, _emberMocha.setupComponentTest)('gh-validation-status-container', {
            integration: true
        });

        beforeEach(function () {
            var testObject = _emberObject['default'].create();
            testObject.set('name', 'Test');
            testObject.set('hasValidated', []);
            testObject.set('errors', Errors.create());

            this.set('testObject', testObject);
        });

        (0, _mocha.it)('has no success/error class by default', function () {
            var _this = this;

            this.render(Ember.HTMLBars.template({
                'id': 'wrV0l1Lx',
                'block': '{"statements":[["text","\\n"],["block",["gh-validation-status-container"],null,[["class","property","errors","hasValidated"],["gh-test","name",["get",["testObject","errors"]],["get",["testObject","hasValidated"]]]],0],["text","        "]],"locals":[],"named":[],"yields":[],"blocks":[{"statements":[],"locals":[]}],"hasPartials":false}',
                'meta': {}
            }));

            return (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this.$('.gh-test')).to.have.length(1);
                (0, _chai.expect)(_this.$('.gh-test').hasClass('success')).to.be['false'];
                (0, _chai.expect)(_this.$('.gh-test').hasClass('error')).to.be['false'];
            });
        });

        (0, _mocha.it)('has success class when valid', function () {
            var _this2 = this;

            this.get('testObject.hasValidated').push('name');

            this.render(Ember.HTMLBars.template({
                'id': 'wrV0l1Lx',
                'block': '{"statements":[["text","\\n"],["block",["gh-validation-status-container"],null,[["class","property","errors","hasValidated"],["gh-test","name",["get",["testObject","errors"]],["get",["testObject","hasValidated"]]]],0],["text","        "]],"locals":[],"named":[],"yields":[],"blocks":[{"statements":[],"locals":[]}],"hasPartials":false}',
                'meta': {}
            }));

            return (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this2.$('.gh-test')).to.have.length(1);
                (0, _chai.expect)(_this2.$('.gh-test').hasClass('success')).to.be['true'];
                (0, _chai.expect)(_this2.$('.gh-test').hasClass('error')).to.be['false'];
            });
        });

        (0, _mocha.it)('has error class when invalid', function () {
            var _this3 = this;

            this.get('testObject.hasValidated').push('name');
            this.get('testObject.errors').add('name', 'has error');

            this.render(Ember.HTMLBars.template({
                'id': 'wrV0l1Lx',
                'block': '{"statements":[["text","\\n"],["block",["gh-validation-status-container"],null,[["class","property","errors","hasValidated"],["gh-test","name",["get",["testObject","errors"]],["get",["testObject","hasValidated"]]]],0],["text","        "]],"locals":[],"named":[],"yields":[],"blocks":[{"statements":[],"locals":[]}],"hasPartials":false}',
                'meta': {}
            }));

            return (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this3.$('.gh-test')).to.have.length(1);
                (0, _chai.expect)(_this3.$('.gh-test').hasClass('success')).to.be['false'];
                (0, _chai.expect)(_this3.$('.gh-test').hasClass('error')).to.be['true'];
            });
        });

        (0, _mocha.it)('still renders if hasValidated is undefined', function () {
            var _this4 = this;

            this.set('testObject.hasValidated', undefined);

            this.render(Ember.HTMLBars.template({
                'id': 'wrV0l1Lx',
                'block': '{"statements":[["text","\\n"],["block",["gh-validation-status-container"],null,[["class","property","errors","hasValidated"],["gh-test","name",["get",["testObject","errors"]],["get",["testObject","hasValidated"]]]],0],["text","        "]],"locals":[],"named":[],"yields":[],"blocks":[{"statements":[],"locals":[]}],"hasPartials":false}',
                'meta': {}
            }));

            return (0, _emberTestHelpersWait['default'])().then(function () {
                (0, _chai.expect)(_this4.$('.gh-test')).to.have.length(1);
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/gh-validation-status-container-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/gh-validation-status-container-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/modals/delete-subscriber-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Integration: Component: modals/delete-subscriber', function () {
        (0, _emberMocha.setupComponentTest)('modals/delete-subscriber', {
            integration: true
        });

        (0, _mocha.it)('renders', function () {
            // Set any properties with this.set('myProperty', 'value');
            // Handle any actions with this.on('myAction', function(val) { ... });
            // Template block usage:
            // this.render(hbs`
            //   {{#modals/delete-subscriber}}
            //     template content
            //   {{/modals/delete-subscriber}}
            // `);

            this.render(Ember.HTMLBars.template({
                'id': 'K2KM5HSm',
                'block': '{"statements":[["append",["unknown",["modals/delete-subscriber"]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/modals/delete-subscriber-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/modals/delete-subscriber-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/modals/import-subscribers-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Integration: Component: modals/import-subscribers', function () {
        (0, _emberMocha.setupComponentTest)('modals/import-subscribers', {
            integration: true
        });

        (0, _mocha.it)('renders', function () {
            // Set any properties with this.set('myProperty', 'value');
            // Handle any actions with this.on('myAction', function(val) { ... });
            // Template block usage:
            // this.render(hbs`
            //   {{#modals/import-subscribers}}
            //     template content
            //   {{/modals/import-subscribers}}
            // `);

            this.render(Ember.HTMLBars.template({
                'id': 'OIu9g3My',
                'block': '{"statements":[["append",["unknown",["modals/import-subscribers"]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/modals/import-subscribers-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/modals/import-subscribers-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/modals/new-subscriber-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Integration: Component: modals/new-subscriber', function () {
        (0, _emberMocha.setupComponentTest)('modals/new-subscriber', {
            integration: true
        });

        (0, _mocha.it)('renders', function () {
            // Set any properties with this.set('myProperty', 'value');
            // Handle any actions with this.on('myAction', function(val) { ... });
            // Template block usage:
            // this.render(hbs`
            //   {{#modals/new-subscriber}}
            //     template content
            //   {{/modals/new-subscriber}}
            // `);

            this.render(Ember.HTMLBars.template({
                'id': 'zvCiXVDN',
                'block': '{"statements":[["append",["unknown",["modals/new-subscriber"]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/modals/new-subscriber-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/modals/new-subscriber-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/modals/upload-theme-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Integration: Component: modals/upload-theme', function () {
        (0, _emberMocha.setupComponentTest)('modals/upload-theme', {
            integration: true
        });

        (0, _mocha.it)('renders', function () {
            // Set any properties with this.set('myProperty', 'value');
            // Handle any actions with this.on('myAction', function(val) { ... });
            // Template block usage:
            // this.render(hbs`
            //   {{#modals/upload-theme}}
            //     template content
            //   {{/modals/upload-theme}}
            // `);

            this.render(Ember.HTMLBars.template({
                'id': 'O3Wlnilq',
                'block': '{"statements":[["append",["unknown",["modals/upload-theme"]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));
            (0, _chai.expect)(this.$()).to.have.length(1);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/modals/upload-theme-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/modals/upload-theme-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/components/transfer-owner-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-runloop', 'rsvp', 'sinon'], function (exports, _chai, _mocha, _emberMocha, _emberRunloop, _rsvp, _sinon) {

    (0, _mocha.describe)('Integration: Component: modals/transfer-owner', function () {
        (0, _emberMocha.setupComponentTest)('transfer-owner', {
            integration: true
        });

        (0, _mocha.it)('triggers confirm action', function () {
            var _this = this;

            var confirm = _sinon['default'].stub();
            var closeModal = _sinon['default'].spy();

            confirm.returns(_rsvp['default'].resolve({}));

            this.on('confirm', confirm);
            this.on('closeModal', closeModal);

            this.render(Ember.HTMLBars.template({
                'id': 'APoyNN/y',
                'block': '{"statements":[["append",["helper",["modals/transfer-owner"],null,[["confirm","closeModal"],[["helper",["action"],[["get",[null]],"confirm"],null],["helper",["action"],[["get",[null]],"closeModal"],null]]]],false]],"locals":[],"named":[],"yields":[],"blocks":[],"hasPartials":false}',
                'meta': {}
            }));

            (0, _emberRunloop['default'])(function () {
                _this.$('.gh-btn.gh-btn-red').click();
            });

            (0, _chai.expect)(confirm.calledOnce, 'confirm called').to.be['true'];
            (0, _chai.expect)(closeModal.calledOnce, 'closeModal called').to.be['true'];
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/components/transfer-owner-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/components/transfer-owner-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/services/ajax-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'pretender', 'ember-ajax/errors', 'ghost-admin/services/ajax', 'ghost-admin/config/environment', 'ember-service', 'rsvp'], function (exports, _chai, _mocha, _emberMocha, _pretender, _emberAjaxErrors, _ghostAdminServicesAjax, _ghostAdminConfigEnvironment, _emberService, _rsvp) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    function stubAjaxEndpoint(server) {
        var response = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
        var code = arguments.length <= 2 || arguments[2] === undefined ? 200 : arguments[2];

        server.get('/test/', function () {
            return [code, { 'Content-Type': 'application/json' }, JSON.stringify(response)];
        });
    }

    (0, _mocha.describe)('Integration: Service: ajax', function () {
        (0, _emberMocha.setupTest)('service:ajax', {
            integration: true
        });

        var server = undefined;

        beforeEach(function () {
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('adds Ghost version header to requests', function (done) {
            var version = _ghostAdminConfigEnvironment['default'].APP.version;

            var ajax = this.subject();

            stubAjaxEndpoint(server, {});

            ajax.request('/test/').then(function () {
                var _server$handledRequests = _slicedToArray(server.handledRequests, 1);

                var request = _server$handledRequests[0];

                (0, _chai.expect)(request.requestHeaders['X-Ghost-Version']).to.equal(version);
                done();
            });
        });

        (0, _mocha.it)('correctly parses single message response text', function (done) {
            var error = { message: 'Test Error' };
            stubAjaxEndpoint(server, error, 500);

            var ajax = this.subject();

            ajax.request('/test/').then(function () {
                (0, _chai.expect)(false).to.be['true']();
            })['catch'](function (error) {
                (0, _chai.expect)(error.errors.length).to.equal(1);
                (0, _chai.expect)(error.errors[0].message).to.equal('Test Error');
                done();
            });
        });

        (0, _mocha.it)('correctly parses single error response text', function (done) {
            var error = { error: 'Test Error' };
            stubAjaxEndpoint(server, error, 500);

            var ajax = this.subject();

            ajax.request('/test/').then(function () {
                (0, _chai.expect)(false).to.be['true']();
            })['catch'](function (error) {
                (0, _chai.expect)(error.errors.length).to.equal(1);
                (0, _chai.expect)(error.errors[0].message).to.equal('Test Error');
                done();
            });
        });

        (0, _mocha.it)('correctly parses multiple error messages', function (done) {
            var error = { errors: ['First Error', 'Second Error'] };
            stubAjaxEndpoint(server, error, 500);

            var ajax = this.subject();

            ajax.request('/test/').then(function () {
                (0, _chai.expect)(false).to.be['true']();
            })['catch'](function (error) {
                (0, _chai.expect)(error.errors.length).to.equal(2);
                (0, _chai.expect)(error.errors[0].message).to.equal('First Error');
                (0, _chai.expect)(error.errors[1].message).to.equal('Second Error');
                done();
            });
        });

        (0, _mocha.it)('returns default error object for non built-in error', function (done) {
            stubAjaxEndpoint(server, {}, 500);

            var ajax = this.subject();

            ajax.request('/test/').then(function () {
                (0, _chai.expect)(false).to.be['true'];
            })['catch'](function (error) {
                (0, _chai.expect)((0, _emberAjaxErrors.isAjaxError)(error)).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('handles error checking for built-in errors', function (done) {
            stubAjaxEndpoint(server, '', 401);

            var ajax = this.subject();

            ajax.request('/test/').then(function () {
                (0, _chai.expect)(false).to.be['true'];
            })['catch'](function (error) {
                (0, _chai.expect)((0, _emberAjaxErrors.isUnauthorizedError)(error)).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('handles error checking for VersionMismatchError', function (done) {
            server.get('/test/', function () {
                return [400, { 'Content-Type': 'application/json' }, JSON.stringify({
                    errors: [{
                        errorType: 'VersionMismatchError',
                        statusCode: 400
                    }]
                })];
            });

            var ajax = this.subject();

            ajax.request('/test/').then(function () {
                (0, _chai.expect)(false).to.be['true'];
            })['catch'](function (error) {
                (0, _chai.expect)((0, _ghostAdminServicesAjax.isVersionMismatchError)(error)).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('handles error checking for RequestEntityTooLargeError on 413 errors', function (done) {
            stubAjaxEndpoint(server, {}, 413);

            var ajax = this.subject();

            ajax.request('/test/').then(function () {
                (0, _chai.expect)(false).to.be['true'];
            })['catch'](function (error) {
                (0, _chai.expect)((0, _ghostAdminServicesAjax.isRequestEntityTooLargeError)(error)).to.be['true'];
                done();
            });
        });

        (0, _mocha.it)('handles error checking for UnsupportedMediaTypeError on 415 errors', function (done) {
            stubAjaxEndpoint(server, {}, 415);

            var ajax = this.subject();

            ajax.request('/test/').then(function () {
                (0, _chai.expect)(false).to.be['true'];
            })['catch'](function (error) {
                (0, _chai.expect)((0, _ghostAdminServicesAjax.isUnsupportedMediaTypeError)(error)).to.be['true'];
                done();
            });
        });

        /* eslint-disable camelcase */
        (0, _mocha.describe)('session handling', function () {
            var successfulRequest = false;

            var sessionStub = _emberService['default'].extend({
                isAuthenticated: true,
                restoreCalled: false,
                authenticated: null,

                init: function init() {
                    this.authenticated = {
                        expires_at: new Date().getTime() - 10000,
                        refresh_token: 'RefreshMe123'
                    };
                },

                restore: function restore() {
                    this.restoreCalled = true;
                    this.authenticated.expires_at = new Date().getTime() + 10000;
                    return _rsvp['default'].resolve();
                },

                authorize: function authorize() {}
            });

            beforeEach(function () {
                server.get('/ghost/api/v0.1/test/', function () {
                    return [200, { 'Content-Type': 'application/json' }, JSON.stringify({
                        success: true
                    })];
                });

                server.post('/ghost/api/v0.1/authentication/token', function () {
                    return [401, { 'Content-Type': 'application/json' }, JSON.stringify({})];
                });
            });

            (0, _mocha.it)('can restore an expired session', function (done) {
                var ajax = this.subject();
                ajax.set('session', sessionStub.create());

                ajax.request('/ghost/api/v0.1/test/');

                ajax.request('/ghost/api/v0.1/test/').then(function (result) {
                    (0, _chai.expect)(ajax.get('session.restoreCalled'), 'restoreCalled').to.be['true'];
                    (0, _chai.expect)(result.success, 'result.success').to.be['true'];
                    done();
                })['catch'](function () {
                    (0, _chai.expect)(true, 'request failed').to.be['false'];
                    done();
                });
            });

            (0, _mocha.it)('errors correctly when session restoration fails', function (done) {
                var ajax = this.subject();
                var invalidateCalled = false;

                ajax.set('session', sessionStub.create());
                ajax.set('session.restore', function () {
                    this.set('restoreCalled', true);
                    return ajax.post('/ghost/api/v0.1/authentication/token');
                });
                ajax.set('session.invalidate', function () {
                    invalidateCalled = true;
                });

                stubAjaxEndpoint(server, {}, 401);

                ajax.request('/ghost/api/v0.1/test/').then(function () {
                    (0, _chai.expect)(true, 'request was successful').to.be['false'];
                    done();
                })['catch'](function () {
                    // TODO: fix the error return when a session restore fails
                    // expect(isUnauthorizedError(error)).to.be.true;
                    (0, _chai.expect)(ajax.get('session.restoreCalled'), 'restoreCalled').to.be['true'];
                    (0, _chai.expect)(successfulRequest, 'successfulRequest').to.be['false'];
                    (0, _chai.expect)(invalidateCalled, 'invalidateCalled').to.be['true'];
                    done();
                });
            });
        });
    });
});
define('ghost-admin/tests/integration/services/ajax-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/services/ajax-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/services/config-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'pretender', 'ember-test-helpers/wait'], function (exports, _chai, _mocha, _emberMocha, _pretender, _emberTestHelpersWait) {

    function stubAvailableTimezonesEndpoint(server) {
        server.get('/ghost/api/v0.1/configuration/timezones', function () {
            return [200, { 'Content-Type': 'application/json' }, JSON.stringify({
                configuration: [{
                    timezones: [{
                        label: '(GMT -11:00) Midway Island, Samoa',
                        name: 'Pacific/Pago_Pago',
                        offset: -660
                    }, {
                        label: '(GMT) Greenwich Mean Time : Dublin, Edinburgh, London',
                        name: 'Europe/Dublin',
                        offset: 0
                    }]
                }]
            })];
        });
    }

    (0, _mocha.describe)('Integration: Service: config', function () {
        (0, _emberMocha.setupTest)('service:config', {
            integration: true
        });

        var server = undefined;

        beforeEach(function () {
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('returns a list of timezones in the expected format', function (done) {
            var service = this.subject();
            stubAvailableTimezonesEndpoint(server);

            service.get('availableTimezones').then(function (timezones) {
                (0, _chai.expect)(timezones.length).to.equal(2);
                (0, _chai.expect)(timezones[0].name).to.equal('Pacific/Pago_Pago');
                (0, _chai.expect)(timezones[0].label).to.equal('(GMT -11:00) Midway Island, Samoa');
                (0, _chai.expect)(timezones[1].name).to.equal('Europe/Dublin');
                (0, _chai.expect)(timezones[1].label).to.equal('(GMT) Greenwich Mean Time : Dublin, Edinburgh, London');
                done();
            });
        });

        (0, _mocha.it)('normalizes blogUrl to non-trailing-slash', function (done) {
            var stubBlogUrl = function stubBlogUrl(blogUrl) {
                server.get('/ghost/api/v0.1/configuration/', function () {
                    return [200, { 'Content-Type': 'application/json' }, JSON.stringify({
                        configuration: [{
                            blogUrl: blogUrl
                        }]
                    })];
                });
            };
            var service = this.subject();

            stubBlogUrl('http://localhost:2368/');

            service.fetch().then(function () {
                (0, _chai.expect)(service.get('blogUrl'), 'trailing-slash').to.equal('http://localhost:2368');
            });

            (0, _emberTestHelpersWait['default'])().then(function () {
                stubBlogUrl('http://localhost:2368');

                service.fetch().then(function () {
                    (0, _chai.expect)(service.get('blogUrl'), 'non-trailing-slash').to.equal('http://localhost:2368');

                    done();
                });
            });
        });
    });
});
define('ghost-admin/tests/integration/services/config-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/services/config-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/services/feature-test', ['exports', 'mocha', 'ember-mocha', 'pretender', 'ember-test-helpers/wait', 'ghost-admin/services/feature', 'ember', 'ember-runloop'], function (exports, _mocha, _emberMocha, _pretender, _emberTestHelpersWait, _ghostAdminServicesFeature, _ember, _emberRunloop) {
    var EmberError = _ember['default'].Error;

    function stubSettings(server, labs) {
        var validSave = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

        var settings = [{
            id: '1',
            type: 'blog',
            key: 'labs',
            value: JSON.stringify(labs)
        }];

        server.get('/ghost/api/v0.1/settings/', function () {
            return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ settings: settings })];
        });

        server.put('/ghost/api/v0.1/settings/', function (request) {
            var statusCode = validSave ? 200 : 400;
            var response = validSave ? request.requestBody : JSON.stringify({
                errors: [{
                    message: 'Test Error'
                }]
            });

            return [statusCode, { 'Content-Type': 'application/json' }, response];
        });
    }

    function stubUser(server, accessibility) {
        var validSave = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

        var users = [{
            id: '1',
            // Add extra properties for the validations
            name: 'Test User',
            email: 'test@example.com',
            accessibility: JSON.stringify(accessibility),
            roles: [{
                id: 1,
                name: 'Owner',
                description: 'Owner'
            }]
        }];

        server.get('/ghost/api/v0.1/users/me/', function () {
            return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ users: users })];
        });

        server.put('/ghost/api/v0.1/users/1/', function (request) {
            var statusCode = validSave ? 200 : 400;
            var response = validSave ? request.requestBody : JSON.stringify({
                errors: [{
                    message: 'Test Error'
                }]
            });

            return [statusCode, { 'Content-Type': 'application/json' }, response];
        });
    }

    function addTestFlag() {
        _ghostAdminServicesFeature['default'].reopen({
            testFlag: (0, _ghostAdminServicesFeature.feature)('testFlag'),
            testUserFlag: (0, _ghostAdminServicesFeature.feature)('testUserFlag', true)
        });
    }

    (0, _mocha.describe)('Integration: Service: feature', function () {
        (0, _emberMocha.setupTest)('service:feature', {
            integration: true
        });

        var server = undefined;

        beforeEach(function () {
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('loads labs and user settings correctly', function () {
            stubSettings(server, { testFlag: true });
            stubUser(server, { testUserFlag: true });

            addTestFlag();

            var service = this.subject();

            return service.fetch().then(function () {
                expect(service.get('testFlag')).to.be['true'];
                expect(service.get('testUserFlag')).to.be['true'];
            });
        });

        (0, _mocha.it)('returns false for set flag with config false and labs false', function () {
            stubSettings(server, { testFlag: false });
            stubUser(server, {});

            addTestFlag();

            var service = this.subject();
            service.get('config').set('testFlag', false);

            return service.fetch().then(function () {
                expect(service.get('labs.testFlag')).to.be['false'];
                expect(service.get('testFlag')).to.be['false'];
            });
        });

        (0, _mocha.it)('returns true for set flag with config true and labs false', function () {
            stubSettings(server, { testFlag: false });
            stubUser(server, {});

            addTestFlag();

            var service = this.subject();
            service.get('config').set('testFlag', true);

            return service.fetch().then(function () {
                expect(service.get('labs.testFlag')).to.be['false'];
                expect(service.get('testFlag')).to.be['true'];
            });
        });

        (0, _mocha.it)('returns true for set flag with config false and labs true', function () {
            stubSettings(server, { testFlag: true });
            stubUser(server, {});

            addTestFlag();

            var service = this.subject();
            service.get('config').set('testFlag', false);

            return service.fetch().then(function () {
                expect(service.get('labs.testFlag')).to.be['true'];
                expect(service.get('testFlag')).to.be['true'];
            });
        });

        (0, _mocha.it)('returns true for set flag with config true and labs true', function () {
            stubSettings(server, { testFlag: true });
            stubUser(server, {});

            addTestFlag();

            var service = this.subject();
            service.get('config').set('testFlag', true);

            return service.fetch().then(function () {
                expect(service.get('labs.testFlag')).to.be['true'];
                expect(service.get('testFlag')).to.be['true'];
            });
        });

        (0, _mocha.it)('returns false for set flag with accessibility false', function () {
            stubSettings(server, {});
            stubUser(server, { testUserFlag: false });

            addTestFlag();

            var service = this.subject();

            return service.fetch().then(function () {
                expect(service.get('accessibility.testUserFlag')).to.be['false'];
                expect(service.get('testUserFlag')).to.be['false'];
            });
        });

        (0, _mocha.it)('returns true for set flag with accessibility true', function () {
            stubSettings(server, {});
            stubUser(server, { testUserFlag: true });

            addTestFlag();

            var service = this.subject();

            return service.fetch().then(function () {
                expect(service.get('accessibility.testUserFlag')).to.be['true'];
                expect(service.get('testUserFlag')).to.be['true'];
            });
        });

        (0, _mocha.it)('saves labs setting correctly', function () {
            stubSettings(server, { testFlag: false });
            stubUser(server, { testUserFlag: false });

            addTestFlag();

            var service = this.subject();
            service.get('config').set('testFlag', false);

            return service.fetch().then(function () {
                expect(service.get('testFlag')).to.be['false'];

                (0, _emberRunloop['default'])(function () {
                    service.set('testFlag', true);
                });

                return (0, _emberTestHelpersWait['default'])().then(function () {
                    expect(server.handlers[1].numberOfCalls).to.equal(1);
                    expect(service.get('testFlag')).to.be['true'];
                });
            });
        });

        (0, _mocha.it)('saves accessibility setting correctly', function () {
            stubSettings(server, {});
            stubUser(server, { testUserFlag: false });

            addTestFlag();

            var service = this.subject();

            return service.fetch().then(function () {
                expect(service.get('testUserFlag')).to.be['false'];

                (0, _emberRunloop['default'])(function () {
                    service.set('testUserFlag', true);
                });

                return (0, _emberTestHelpersWait['default'])().then(function () {
                    expect(server.handlers[3].numberOfCalls).to.equal(1);
                    expect(service.get('testUserFlag')).to.be['true'];
                });
            });
        });

        (0, _mocha.it)('notifies for server errors on labs save', function () {
            stubSettings(server, { testFlag: false }, false);
            stubUser(server, {});

            addTestFlag();

            var service = this.subject();
            service.get('config').set('testFlag', false);

            return service.fetch().then(function () {
                expect(service.get('testFlag')).to.be['false'];

                (0, _emberRunloop['default'])(function () {
                    service.set('testFlag', true);
                });

                return (0, _emberTestHelpersWait['default'])().then(function () {
                    expect(server.handlers[1].numberOfCalls, 'PUT call is made').to.equal(1);

                    expect(service.get('notifications.alerts').length, 'number of alerts shown').to.equal(1);

                    expect(service.get('testFlag')).to.be['false'];
                });
            });
        });

        (0, _mocha.it)('notifies for server errors on accessibility save', function () {
            stubSettings(server, {});
            stubUser(server, { testUserFlag: false }, false);

            addTestFlag();

            var service = this.subject();

            return service.fetch().then(function () {
                expect(service.get('testUserFlag')).to.be['false'];

                (0, _emberRunloop['default'])(function () {
                    service.set('testUserFlag', true);
                });

                return (0, _emberTestHelpersWait['default'])().then(function () {
                    expect(server.handlers[3].numberOfCalls, 'PUT call is made').to.equal(1);

                    expect(service.get('notifications.alerts').length, 'number of alerts shown').to.equal(1);

                    expect(service.get('testUserFlag')).to.be['false'];
                });
            });
        });

        (0, _mocha.it)('notifies for validation errors', function () {
            stubSettings(server, { testFlag: false }, true, false);
            stubUser(server, {});

            addTestFlag();

            var service = this.subject();
            service.get('config').set('testFlag', false);

            return service.fetch().then(function () {
                expect(service.get('testFlag')).to.be['false'];

                (0, _emberRunloop['default'])(function () {
                    expect(function () {
                        service.set('testFlag', true);
                    }, EmberError, 'threw validation error');
                });

                return (0, _emberTestHelpersWait['default'])().then(function () {
                    // ensure validation is happening before the API is hit
                    expect(server.handlers[1].numberOfCalls).to.equal(0);
                    expect(service.get('testFlag')).to.be['false'];
                });
            });
        });
    });
});
define('ghost-admin/tests/integration/services/feature-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/services/feature-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/services/lazy-loader-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'pretender', 'jquery'], function (exports, _chai, _mocha, _emberMocha, _pretender, _jquery) {

    (0, _mocha.describe)('Integration: Service: lazy-loader', function () {
        (0, _emberMocha.setupTest)('service:lazy-loader', { integration: true });
        var server = undefined;
        var ghostPaths = {
            adminRoot: '/assets/'
        };

        beforeEach(function () {
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('loads a script correctly and only once', function () {
            var subject = this.subject({
                ghostPaths: ghostPaths,
                scriptPromises: {},
                testing: false
            });

            server.get('/assets/test.js', function (_ref) {
                var requestHeaders = _ref.requestHeaders;

                (0, _chai.expect)(requestHeaders.Accept).to.match(/text\/javascript/);

                return [200, { 'Content-Type': 'text/javascript' }, 'window.testLoadScript = \'testvalue\''];
            });

            return subject.loadScript('test-script', 'test.js').then(function () {
                (0, _chai.expect)(subject.get('scriptPromises.test-script')).to.exist;
                (0, _chai.expect)(window.testLoadScript).to.equal('testvalue');
                (0, _chai.expect)(server.handlers[0].numberOfCalls).to.equal(1);

                return subject.loadScript('test-script', 'test.js');
            }).then(function () {
                (0, _chai.expect)(server.handlers[0].numberOfCalls).to.equal(1);
            });
        });

        (0, _mocha.it)('loads styles correctly', function () {
            var subject = this.subject({
                ghostPaths: ghostPaths,
                testing: false
            });

            return subject.loadStyle('testing', 'style.css')['catch'](function () {
                // we add a catch handler here because `/assets/style.css` doesn't exist
                (0, _chai.expect)((0, _jquery['default'])('#testing-styles').length).to.equal(1);
                (0, _chai.expect)((0, _jquery['default'])('#testing-styles').attr('href')).to.equal('/assets/style.css');
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/integration/services/lazy-loader-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/services/lazy-loader-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/services/slug-generator-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'pretender', 'ember-string'], function (exports, _chai, _mocha, _emberMocha, _pretender, _emberString) {

    function stubSlugEndpoint(server, type, slug) {
        server.get('/ghost/api/v0.1/slugs/:type/:slug/', function (request) {
            (0, _chai.expect)(request.params.type).to.equal(type);
            (0, _chai.expect)(request.params.slug).to.equal(slug);

            return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ slugs: [{ slug: (0, _emberString.dasherize)(slug) }] })];
        });
    }

    (0, _mocha.describe)('Integration: Service: slug-generator', function () {
        (0, _emberMocha.setupTest)('service:slug-generator', {
            integration: true
        });

        var server = undefined;

        beforeEach(function () {
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('returns empty if no slug is provided', function (done) {
            var service = this.subject();

            service.generateSlug('post', '').then(function (slug) {
                (0, _chai.expect)(slug).to.equal('');
                done();
            });
        });

        (0, _mocha.it)('calls correct endpoint and returns correct data', function (done) {
            var rawSlug = 'a test post';
            stubSlugEndpoint(server, 'post', rawSlug);

            var service = this.subject();

            service.generateSlug('post', rawSlug).then(function (slug) {
                (0, _chai.expect)(slug).to.equal((0, _emberString.dasherize)(rawSlug));
                done();
            });
        });
    });
});
define('ghost-admin/tests/integration/services/slug-generator-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/services/slug-generator-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/services/store-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'pretender', 'ghost-admin/config/environment'], function (exports, _chai, _mocha, _emberMocha, _pretender, _ghostAdminConfigEnvironment) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    (0, _mocha.describe)('Integration: Service: store', function () {
        (0, _emberMocha.setupTest)('service:store', {
            integration: true
        });

        var server = undefined;

        beforeEach(function () {
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('adds Ghost version header to requests', function (done) {
            var version = _ghostAdminConfigEnvironment['default'].APP.version;

            var store = this.subject();

            server.get('/ghost/api/v0.1/posts/1/', function () {
                return [404, { 'Content-Type': 'application/json' }, JSON.stringify({})];
            });

            store.find('post', 1)['catch'](function () {
                var _server$handledRequests = _slicedToArray(server.handledRequests, 1);

                var request = _server$handledRequests[0];

                (0, _chai.expect)(request.requestHeaders['X-Ghost-Version']).to.equal(version);
                done();
            });
        });
    });
});
define('ghost-admin/tests/integration/services/store-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/services/store-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/integration/services/time-zone-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'pretender'], function (exports, _chai, _mocha, _emberMocha, _pretender) {

    function settingsStub(server) {
        var settings = [{
            id: '1',
            type: 'blog',
            key: 'activeTimezone',
            value: 'Africa/Cairo'
        }];

        server.get('/ghost/api/v0.1/settings/', function () {
            return [200, { 'Content-Type': 'application/json' }, JSON.stringify({ settings: settings })];
        });
    }

    (0, _mocha.describe)('Integration: Service: time-zone', function () {
        (0, _emberMocha.setupTest)('service:time-zone', {
            integration: true
        });

        var server = undefined;

        beforeEach(function () {
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('should return the blogs timezone', function (done) {
            var service = this.subject();

            settingsStub(server);

            service.get('blogTimezone').then(function (blogTimezone) {
                (0, _chai.expect)(blogTimezone).to.equal('Africa/Cairo');
                done();
            });
        });
    });
});
define('ghost-admin/tests/integration/services/time-zone-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - integration/services/time-zone-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/body-event-listener.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/body-event-listener.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/current-user-settings.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/current-user-settings.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/dropdown-mixin.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/dropdown-mixin.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/editor-base-controller.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/editor-base-controller.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/editor-base-route.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/editor-base-route.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/infinite-scroll.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/infinite-scroll.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/pagination.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/pagination.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/settings-menu-component.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/settings-menu-component.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/shortcuts-route.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/shortcuts-route.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/shortcuts.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/shortcuts.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/slug-url.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/slug-url.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/style-body.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/style-body.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/text-input.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/text-input.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/unauthenticated-route-mixin.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/unauthenticated-route-mixin.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/validation-engine.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/validation-engine.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/mixins/validation-state.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - mixins/validation-state.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/models/invite.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - models/invite.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/models/navigation-item.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - models/navigation-item.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/models/notification.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - models/notification.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/models/post.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - models/post.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/models/role.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - models/role.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/models/setting.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - models/setting.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/models/slack-integration.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - models/slack-integration.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/models/subscriber.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - models/subscriber.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/models/tag.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - models/tag.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/models/theme.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - models/theme.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/models/user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - models/user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/resolver.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - resolver.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/router.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - router.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/about.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/about.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/application.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/application.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/authenticated.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/authenticated.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/editor/edit.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/editor/edit.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/editor/index.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/editor/index.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/editor/new.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/editor/new.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/error404.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/error404.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/posts.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/posts.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/reset.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/reset.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/apps.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/apps.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/apps/amp.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/apps/amp.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/apps/slack.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/apps/slack.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/code-injection.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/code-injection.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/design.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/design.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/design/uploadtheme.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/design/uploadtheme.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/general.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/general.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/labs.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/labs.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/tags.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/tags.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/tags/index.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/tags/index.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/tags/new.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/tags/new.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/settings/tags/tag.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/settings/tags/tag.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/setup.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/setup.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/setup/index.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/setup/index.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/setup/one.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/setup/one.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/setup/three.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/setup/three.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/setup/two.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/setup/two.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/signin.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/signin.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/signout.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/signout.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/signup.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/signup.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/subscribers.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/subscribers.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/subscribers/import.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/subscribers/import.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/subscribers/new.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/subscribers/new.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/team/index.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/team/index.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/routes/team/user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - routes/team/user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/serializers/application.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - serializers/application.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/serializers/invite.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - serializers/invite.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/serializers/notification.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - serializers/notification.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/serializers/post.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - serializers/post.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/serializers/role.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - serializers/role.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/serializers/setting.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - serializers/setting.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/serializers/subscriber.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - serializers/subscriber.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/serializers/tag.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - serializers/tag.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/serializers/theme.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - serializers/theme.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/serializers/user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - serializers/user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/ajax.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/ajax.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/clock.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/clock.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/config.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/config.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/dropdown.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/dropdown.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/event-bus.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/event-bus.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/feature.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/feature.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/ghost-paths.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/ghost-paths.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/lazy-loader.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/lazy-loader.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/media-queries.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/media-queries.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/notifications.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/notifications.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/session.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/session.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/slug-generator.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/slug-generator.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/time-zone.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/time-zone.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/upgrade-notification.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/upgrade-notification.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/services/upgrade-status.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - services/upgrade-status.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/session-stores/application.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - session-stores/application.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/test-helper', ['exports', 'ghost-admin/tests/helpers/resolver', 'ember-mocha'], function (exports, _ghostAdminTestsHelpersResolver, _emberMocha) {

    (0, _emberMocha.setResolver)(_ghostAdminTestsHelpersResolver['default']);

    /* jshint ignore:start */
    mocha.setup({
        timeout: 15000,
        slow: 500
    });
    /* jshint ignore:end */
});
define('ghost-admin/tests/test-helper.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - test-helper.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/torii-providers/ghost-oauth2.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - torii-providers/ghost-oauth2.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/transforms/facebook-url-user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - transforms/facebook-url-user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/transforms/json-string.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - transforms/json-string.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/transforms/moment-date.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - transforms/moment-date.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/transforms/moment-utc.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - transforms/moment-utc.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/transforms/navigation-settings.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - transforms/navigation-settings.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/transforms/raw.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - transforms/raw.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/transforms/slack-settings.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - transforms/slack-settings.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/transforms/twitter-url-user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - transforms/twitter-url-user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/transitions.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - transitions.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-alert-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'sinon'], function (exports, _chai, _mocha, _emberMocha, _sinon) {

    (0, _mocha.describe)('Unit: Component: gh-alert', function () {
        (0, _emberMocha.setupComponentTest)('gh-alert', {
            unit: true
            // specify the other units that are required for this test
            // needs: ['component:foo', 'helper:bar']
        });

        (0, _mocha.it)('closes notification through notifications service', function () {
            var component = this.subject();
            var notifications = {};
            var notification = { message: 'Test close', type: 'success' };

            notifications.closeNotification = _sinon['default'].spy();
            component.set('notifications', notifications);
            component.set('message', notification);

            this.$().find('button').click();

            (0, _chai.expect)(notifications.closeNotification.calledWith(notification)).to.be['true'];
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/gh-alert-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-alert-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-app-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Component: gh-app', function () {
        (0, _emberMocha.setupComponentTest)('gh-app', {
            unit: true
            // specify the other units that are required for this test
            // needs: ['component:foo', 'helper:bar']
        });

        (0, _mocha.it)('renders', function () {
            // creates the component instance
            var component = this.subject();

            (0, _chai.expect)(component._state).to.equal('preRender');

            // renders the component on the page
            this.render();
            (0, _chai.expect)(component._state).to.equal('inDOM');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/gh-app-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-app-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-editor-save-button-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Component: gh-editor-save-button', function () {
        (0, _emberMocha.setupComponentTest)('gh-editor-save-button', {
            unit: true,
            needs: ['component:gh-dropdown-button', 'component:gh-dropdown', 'component:gh-spin-button', 'service:dropdown']
        });

        (0, _mocha.it)('renders', function () {
            // creates the component instance
            var component = this.subject();

            (0, _chai.expect)(component._state).to.equal('preRender');

            // renders the component on the page
            this.render();
            (0, _chai.expect)(component._state).to.equal('inDOM');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/gh-editor-save-button-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-editor-save-button-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-infinite-scroll-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Component: gh-infinite-scroll', function () {
        (0, _emberMocha.setupComponentTest)('gh-infinite-scroll', {
            unit: true
            // specify the other units that are required for this test
            // needs: ['component:foo', 'helper:bar']
        });

        (0, _mocha.it)('renders', function () {
            // creates the component instance
            var component = this.subject();

            (0, _chai.expect)(component._state).to.equal('preRender');

            // renders the component on the page
            this.render();
            (0, _chai.expect)(component._state).to.equal('inDOM');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/gh-infinite-scroll-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-infinite-scroll-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define("ghost-admin/tests/unit/components/gh-koenig-test", ["exports"], function (exports) {});
define('ghost-admin/tests/unit/components/gh-navitem-url-input-test', ['exports', 'ember-runloop', 'chai', 'mocha', 'ember-mocha'], function (exports, _emberRunloop, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Component: gh-navitem-url-input', function () {
        (0, _emberMocha.setupComponentTest)('gh-navitem-url-input', {
            unit: true
        });

        (0, _mocha.it)('identifies a URL as the base URL', function () {
            var component = this.subject({
                url: '',
                baseUrl: 'http://example.com/'
            });

            this.render();

            (0, _emberRunloop['default'])(function () {
                component.set('value', 'http://example.com/');
            });

            (0, _chai.expect)(component.get('isBaseUrl')).to.be.ok;

            (0, _emberRunloop['default'])(function () {
                component.set('value', 'http://example.com/go/');
            });

            (0, _chai.expect)(component.get('isBaseUrl')).to.not.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/gh-navitem-url-input-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-navitem-url-input-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-notification-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'sinon'], function (exports, _chai, _mocha, _emberMocha, _sinon) {

    (0, _mocha.describe)('Unit: Component: gh-notification', function () {
        (0, _emberMocha.setupComponentTest)('gh-notification', {
            unit: true
            // specify the other units that are required for this test
            // needs: ['component:foo', 'helper:bar']
        });

        (0, _mocha.it)('closes notification through notifications service', function () {
            var component = this.subject();
            var notifications = {};
            var notification = { message: 'Test close', type: 'success' };

            notifications.closeNotification = _sinon['default'].spy();
            component.set('notifications', notifications);
            component.set('message', notification);

            this.$().find('button').click();

            (0, _chai.expect)(notifications.closeNotification.calledWith(notification)).to.be['true'];
        });

        (0, _mocha.it)('closes notification when animationend event is triggered', function (done) {
            var component = this.subject();
            var notifications = {};
            var notification = { message: 'Test close', type: 'success' };

            notifications.closeNotification = _sinon['default'].spy();
            component.set('notifications', notifications);
            component.set('message', notification);

            // shorten the animation delay to speed up test
            this.$().css('animation-delay', '0.1s');
            setTimeout(function () {
                (0, _chai.expect)(notifications.closeNotification.calledWith(notification)).to.be['true'];
                done();
            }, 150);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/gh-notification-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-notification-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-post-settings-menu-test', ['exports', 'ember-runloop', 'rsvp', 'ember-object', 'mocha', 'ember-mocha', 'ghost-admin/utils/bound-one-way'], function (exports, _emberRunloop, _rsvp, _emberObject, _mocha, _emberMocha, _ghostAdminUtilsBoundOneWay) {

    function K() {
        return this;
    }

    // TODO: convert to integration tests
    _mocha.describe.skip('Unit: Component: post-settings-menu', function () {
        (0, _emberMocha.setupComponentTest)('gh-post-settings-menu', {
            needs: ['service:notifications', 'service:slug-generator', 'service:timeZone']
        });

        (0, _mocha.it)('slugValue is one-way bound to model.slug', function () {
            var component = this.subject({
                model: _emberObject['default'].create({
                    slug: 'a-slug'
                })
            });

            expect(component.get('model.slug')).to.equal('a-slug');
            expect(component.get('slugValue')).to.equal('a-slug');

            (0, _emberRunloop['default'])(function () {
                component.set('model.slug', 'changed-slug');

                expect(component.get('slugValue')).to.equal('changed-slug');
            });

            (0, _emberRunloop['default'])(function () {
                component.set('slugValue', 'changed-directly');

                expect(component.get('model.slug')).to.equal('changed-slug');
                expect(component.get('slugValue')).to.equal('changed-directly');
            });

            (0, _emberRunloop['default'])(function () {
                // test that the one-way binding is still in place
                component.set('model.slug', 'should-update');

                expect(component.get('slugValue')).to.equal('should-update');
            });
        });

        (0, _mocha.it)('metaTitleScratch is one-way bound to model.metaTitle', function () {
            var component = this.subject({
                model: _emberObject['default'].extend({
                    metaTitle: 'a title',
                    metaTitleScratch: (0, _ghostAdminUtilsBoundOneWay['default'])('metaTitle')
                }).create()
            });

            expect(component.get('model.metaTitle')).to.equal('a title');
            expect(component.get('metaTitleScratch')).to.equal('a title');

            (0, _emberRunloop['default'])(function () {
                component.set('model.metaTitle', 'a different title');

                expect(component.get('metaTitleScratch')).to.equal('a different title');
            });

            (0, _emberRunloop['default'])(function () {
                component.set('metaTitleScratch', 'changed directly');

                expect(component.get('model.metaTitle')).to.equal('a different title');
                expect(component.get('model.metaTitleScratch')).to.equal('changed directly');
            });

            (0, _emberRunloop['default'])(function () {
                // test that the one-way binding is still in place
                component.set('model.metaTitle', 'should update');

                expect(component.get('metaTitleScratch')).to.equal('should update');
            });
        });

        (0, _mocha.it)('metaDescriptionScratch is one-way bound to model.metaDescription', function () {
            var component = this.subject({
                model: _emberObject['default'].extend({
                    metaDescription: 'a description',
                    metaDescriptionScratch: (0, _ghostAdminUtilsBoundOneWay['default'])('metaDescription')
                }).create()
            });

            expect(component.get('model.metaDescription')).to.equal('a description');
            expect(component.get('metaDescriptionScratch')).to.equal('a description');

            (0, _emberRunloop['default'])(function () {
                component.set('model.metaDescription', 'a different description');

                expect(component.get('metaDescriptionScratch')).to.equal('a different description');
            });

            (0, _emberRunloop['default'])(function () {
                component.set('metaDescriptionScratch', 'changed directly');

                expect(component.get('model.metaDescription')).to.equal('a different description');
                expect(component.get('metaDescriptionScratch')).to.equal('changed directly');
            });

            (0, _emberRunloop['default'])(function () {
                // test that the one-way binding is still in place
                component.set('model.metaDescription', 'should update');

                expect(component.get('metaDescriptionScratch')).to.equal('should update');
            });
        });

        (0, _mocha.describe)('seoTitle', function () {
            (0, _mocha.it)('should be the metaTitle if one exists', function () {
                var component = this.subject({
                    model: _emberObject['default'].extend({
                        metaTitle: 'a meta-title',
                        metaTitleScratch: (0, _ghostAdminUtilsBoundOneWay['default'])('metaTitle'),
                        titleScratch: 'should not be used'
                    }).create()
                });

                expect(component.get('seoTitle')).to.equal('a meta-title');
            });

            (0, _mocha.it)('should default to the title if an explicit meta-title does not exist', function () {
                var component = this.subject({
                    model: _emberObject['default'].create({
                        titleScratch: 'should be the meta-title'
                    })
                });

                expect(component.get('seoTitle')).to.equal('should be the meta-title');
            });

            (0, _mocha.it)('should be the metaTitle if both title and metaTitle exist', function () {
                var component = this.subject({
                    model: _emberObject['default'].extend({
                        metaTitle: 'a meta-title',
                        metaTitleScratch: (0, _ghostAdminUtilsBoundOneWay['default'])('metaTitle'),
                        titleScratch: 'a title'
                    }).create()
                });

                expect(component.get('seoTitle')).to.equal('a meta-title');
            });

            (0, _mocha.it)('should revert to the title if explicit metaTitle is removed', function () {
                var component = this.subject({
                    model: _emberObject['default'].extend({
                        metaTitle: 'a meta-title',
                        metaTitleScratch: (0, _ghostAdminUtilsBoundOneWay['default'])('metaTitle'),
                        titleScratch: 'a title'
                    }).create()
                });

                expect(component.get('seoTitle')).to.equal('a meta-title');

                (0, _emberRunloop['default'])(function () {
                    component.set('model.metaTitle', '');

                    expect(component.get('seoTitle')).to.equal('a title');
                });
            });

            (0, _mocha.it)('should truncate to 70 characters with an appended ellipsis', function () {
                var longTitle = new Array(100).join('a');
                var component = this.subject({
                    model: _emberObject['default'].create()
                });

                expect(longTitle.length).to.equal(99);

                (0, _emberRunloop['default'])(function () {
                    var expected = longTitle.substr(0, 70) + '&hellip;';

                    component.set('metaTitleScratch', longTitle);

                    expect(component.get('seoTitle').toString().length).to.equal(78);
                    expect(component.get('seoTitle').toString()).to.equal(expected);
                });
            });
        });

        (0, _mocha.describe)('seoDescription', function () {
            (0, _mocha.it)('should be the metaDescription if one exists', function () {
                var component = this.subject({
                    model: _emberObject['default'].extend({
                        metaDescription: 'a description',
                        metaDescriptionScratch: (0, _ghostAdminUtilsBoundOneWay['default'])('metaDescription')
                    }).create()
                });

                expect(component.get('seoDescription')).to.equal('a description');
            });

            _mocha.it.skip('should be generated from the rendered markdown if not explicitly set', function () {
                // can't test right now because the rendered markdown is being pulled
                // from the DOM via jquery
            });

            (0, _mocha.it)('should truncate to 156 characters with an appended ellipsis', function () {
                var longDescription = new Array(200).join('a');
                var component = this.subject({
                    model: _emberObject['default'].create()
                });

                expect(longDescription.length).to.equal(199);

                (0, _emberRunloop['default'])(function () {
                    var expected = longDescription.substr(0, 156) + '&hellip;';

                    component.set('metaDescriptionScratch', longDescription);

                    expect(component.get('seoDescription').toString().length).to.equal(164);
                    expect(component.get('seoDescription').toString()).to.equal(expected);
                });
            });
        });

        (0, _mocha.describe)('seoURL', function () {
            (0, _mocha.it)('should be the URL of the blog if no post slug exists', function () {
                var component = this.subject({
                    config: _emberObject['default'].create({ blogUrl: 'http://my-ghost-blog.com' }),
                    model: _emberObject['default'].create()
                });

                expect(component.get('seoURL')).to.equal('http://my-ghost-blog.com/');
            });

            (0, _mocha.it)('should be the URL of the blog plus the post slug', function () {
                var component = this.subject({
                    config: _emberObject['default'].create({ blogUrl: 'http://my-ghost-blog.com' }),
                    model: _emberObject['default'].create({ slug: 'post-slug' })
                });

                expect(component.get('seoURL')).to.equal('http://my-ghost-blog.com/post-slug/');
            });

            (0, _mocha.it)('should update when the post slug changes', function () {
                var component = this.subject({
                    config: _emberObject['default'].create({ blogUrl: 'http://my-ghost-blog.com' }),
                    model: _emberObject['default'].create({ slug: 'post-slug' })
                });

                expect(component.get('seoURL')).to.equal('http://my-ghost-blog.com/post-slug/');

                (0, _emberRunloop['default'])(function () {
                    component.set('model.slug', 'changed-slug');

                    expect(component.get('seoURL')).to.equal('http://my-ghost-blog.com/changed-slug/');
                });
            });

            (0, _mocha.it)('should truncate a long URL to 70 characters with an appended ellipsis', function () {
                var blogURL = 'http://my-ghost-blog.com';
                var longSlug = new Array(75).join('a');
                var component = this.subject({
                    config: _emberObject['default'].create({ blogUrl: blogURL }),
                    model: _emberObject['default'].create({ slug: longSlug })
                });
                var expected = undefined;

                expect(longSlug.length).to.equal(74);

                expected = blogURL + '/' + longSlug + '/';
                expected = expected.substr(0, 70) + '&hellip;';

                expect(component.get('seoURL').toString().length).to.equal(78);
                expect(component.get('seoURL').toString()).to.equal(expected);
            });
        });

        (0, _mocha.describe)('togglePage', function () {
            (0, _mocha.it)('should toggle the page property', function () {
                var component = this.subject({
                    model: _emberObject['default'].create({
                        page: false,
                        isNew: true
                    })
                });

                expect(component.get('model.page')).to.not.be.ok;

                (0, _emberRunloop['default'])(function () {
                    component.send('togglePage');

                    expect(component.get('model.page')).to.be.ok;
                });
            });

            (0, _mocha.it)('should not save the post if it is still new', function () {
                var component = this.subject({
                    model: _emberObject['default'].create({
                        page: false,
                        isNew: true,
                        save: function save() {
                            this.incrementProperty('saved');
                            return _rsvp['default'].resolve();
                        }
                    })
                });

                (0, _emberRunloop['default'])(function () {
                    component.send('togglePage');

                    expect(component.get('model.page')).to.be.ok;
                    expect(component.get('model.saved')).to.not.be.ok;
                });
            });

            (0, _mocha.it)('should save the post if it is not new', function () {
                var component = this.subject({
                    model: _emberObject['default'].create({
                        page: false,
                        isNew: false,
                        save: function save() {
                            this.incrementProperty('saved');
                            return _rsvp['default'].resolve();
                        }
                    })
                });

                (0, _emberRunloop['default'])(function () {
                    component.send('togglePage');

                    expect(component.get('model.page')).to.be.ok;
                    expect(component.get('model.saved')).to.equal(1);
                });
            });
        });

        (0, _mocha.describe)('toggleFeatured', function () {
            (0, _mocha.it)('should toggle the featured property', function () {
                var component = this.subject({
                    model: _emberObject['default'].create({
                        featured: false,
                        isNew: true
                    })
                });

                (0, _emberRunloop['default'])(function () {
                    component.send('toggleFeatured');

                    expect(component.get('model.featured')).to.be.ok;
                });
            });

            (0, _mocha.it)('should not save the post if it is still new', function () {
                var component = this.subject({
                    model: _emberObject['default'].create({
                        featured: false,
                        isNew: true,
                        save: function save() {
                            this.incrementProperty('saved');
                            return _rsvp['default'].resolve();
                        }
                    })
                });

                (0, _emberRunloop['default'])(function () {
                    component.send('toggleFeatured');

                    expect(component.get('model.featured')).to.be.ok;
                    expect(component.get('model.saved')).to.not.be.ok;
                });
            });

            (0, _mocha.it)('should save the post if it is not new', function () {
                var component = this.subject({
                    model: _emberObject['default'].create({
                        featured: false,
                        isNew: false,
                        save: function save() {
                            this.incrementProperty('saved');
                            return _rsvp['default'].resolve();
                        }
                    })
                });

                (0, _emberRunloop['default'])(function () {
                    component.send('toggleFeatured');

                    expect(component.get('model.featured')).to.be.ok;
                    expect(component.get('model.saved')).to.equal(1);
                });
            });
        });

        (0, _mocha.describe)('updateSlug', function () {
            (0, _mocha.it)('should reset slugValue to the previous slug when the new slug is blank or unchanged', function () {
                var component = this.subject({
                    model: _emberObject['default'].create({
                        slug: 'slug'
                    })
                });

                (0, _emberRunloop['default'])(function () {
                    // unchanged
                    component.set('slugValue', 'slug');
                    component.send('updateSlug', component.get('slugValue'));

                    expect(component.get('model.slug')).to.equal('slug');
                    expect(component.get('slugValue')).to.equal('slug');
                });

                (0, _emberRunloop['default'])(function () {
                    // unchanged after trim
                    component.set('slugValue', 'slug  ');
                    component.send('updateSlug', component.get('slugValue'));

                    expect(component.get('model.slug')).to.equal('slug');
                    expect(component.get('slugValue')).to.equal('slug');
                });

                (0, _emberRunloop['default'])(function () {
                    // blank
                    component.set('slugValue', '');
                    component.send('updateSlug', component.get('slugValue'));

                    expect(component.get('model.slug')).to.equal('slug');
                    expect(component.get('slugValue')).to.equal('slug');
                });
            });

            (0, _mocha.it)('should not set a new slug if the server-generated slug matches existing slug', function (done) {
                var component = this.subject({
                    slugGenerator: _emberObject['default'].create({
                        generateSlug: function generateSlug(slugType, str) {
                            var promise = _rsvp['default'].resolve(str.split('#')[0]);
                            this.set('lastPromise', promise);
                            return promise;
                        }
                    }),
                    model: _emberObject['default'].create({
                        slug: 'whatever'
                    })
                });

                (0, _emberRunloop['default'])(function () {
                    component.set('slugValue', 'whatever#slug');
                    component.send('updateSlug', component.get('slugValue'));

                    _rsvp['default'].resolve(component.get('lastPromise')).then(function () {
                        expect(component.get('model.slug')).to.equal('whatever');

                        done();
                    })['catch'](done);
                });
            });

            (0, _mocha.it)('should not set a new slug if the only change is to the appended increment value', function (done) {
                var component = this.subject({
                    slugGenerator: _emberObject['default'].create({
                        generateSlug: function generateSlug(slugType, str) {
                            var sanitizedStr = str.replace(/[^a-zA-Z]/g, '');
                            var promise = _rsvp['default'].resolve(sanitizedStr + '-2');
                            this.set('lastPromise', promise);
                            return promise;
                        }
                    }),
                    model: _emberObject['default'].create({
                        slug: 'whatever'
                    })
                });

                (0, _emberRunloop['default'])(function () {
                    component.set('slugValue', 'whatever!');
                    component.send('updateSlug', component.get('slugValue'));

                    _rsvp['default'].resolve(component.get('lastPromise')).then(function () {
                        expect(component.get('model.slug')).to.equal('whatever');

                        done();
                    })['catch'](done);
                });
            });

            (0, _mocha.it)('should set the slug if the new slug is different', function (done) {
                var component = this.subject({
                    slugGenerator: _emberObject['default'].create({
                        generateSlug: function generateSlug(slugType, str) {
                            var promise = _rsvp['default'].resolve(str);
                            this.set('lastPromise', promise);
                            return promise;
                        }
                    }),
                    model: _emberObject['default'].create({
                        slug: 'whatever',
                        save: K
                    })
                });

                (0, _emberRunloop['default'])(function () {
                    component.set('slugValue', 'changed');
                    component.send('updateSlug', component.get('slugValue'));

                    _rsvp['default'].resolve(component.get('lastPromise')).then(function () {
                        expect(component.get('model.slug')).to.equal('changed');

                        done();
                    })['catch'](done);
                });
            });

            (0, _mocha.it)('should save the post when the slug changes and the post is not new', function (done) {
                var component = this.subject({
                    slugGenerator: _emberObject['default'].create({
                        generateSlug: function generateSlug(slugType, str) {
                            var promise = _rsvp['default'].resolve(str);
                            this.set('lastPromise', promise);
                            return promise;
                        }
                    }),
                    model: _emberObject['default'].create({
                        slug: 'whatever',
                        saved: 0,
                        isNew: false,
                        save: function save() {
                            this.incrementProperty('saved');
                        }
                    })
                });

                (0, _emberRunloop['default'])(function () {
                    component.set('slugValue', 'changed');
                    component.send('updateSlug', component.get('slugValue'));

                    _rsvp['default'].resolve(component.get('lastPromise')).then(function () {
                        expect(component.get('model.slug')).to.equal('changed');
                        expect(component.get('model.saved')).to.equal(1);

                        done();
                    })['catch'](done);
                });
            });

            (0, _mocha.it)('should not save the post when the slug changes and the post is new', function (done) {
                var component = this.subject({
                    slugGenerator: _emberObject['default'].create({
                        generateSlug: function generateSlug(slugType, str) {
                            var promise = _rsvp['default'].resolve(str);
                            this.set('lastPromise', promise);
                            return promise;
                        }
                    }),
                    model: _emberObject['default'].create({
                        slug: 'whatever',
                        saved: 0,
                        isNew: true,
                        save: function save() {
                            this.incrementProperty('saved');
                        }
                    })
                });

                (0, _emberRunloop['default'])(function () {
                    component.set('slugValue', 'changed');
                    component.send('updateSlug', component.get('slugValue'));

                    _rsvp['default'].resolve(component.get('lastPromise')).then(function () {
                        expect(component.get('model.slug')).to.equal('changed');
                        expect(component.get('model.saved')).to.equal(0);

                        done();
                    })['catch'](done);
                });
            });
        });
    });
});
/* eslint-disable camelcase */
define('ghost-admin/tests/unit/components/gh-post-settings-menu-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-post-settings-menu-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-selectize-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-array/utils', 'ember-runloop'], function (exports, _chai, _mocha, _emberMocha, _emberArrayUtils, _emberRunloop) {

    (0, _mocha.describe)('Unit: Component: gh-selectize', function () {
        (0, _emberMocha.setupComponentTest)('gh-selectize', {
            // Specify the other units that are required for this test
            // needs: ['component:foo', 'helper:bar'],
            unit: true
        });

        (0, _mocha.it)('re-orders selection when selectize order is changed', function () {
            var component = this.subject();

            var item1 = { id: '1', name: 'item 1' };
            var item2 = { id: '2', name: 'item 2' };
            var item3 = { id: '3', name: 'item 3' };

            (0, _emberRunloop['default'])(function () {
                component.set('content', (0, _emberArrayUtils.A)([item1, item2, item3]));
                component.set('selection', (0, _emberArrayUtils.A)([item2, item3]));
                component.set('multiple', true);
                component.set('optionValuePath', 'content.id');
                component.set('optionLabelPath', 'content.name');
            });

            this.render();

            (0, _emberRunloop['default'])(function () {
                component._selectize.setValue(['3', '2']);
            });

            (0, _chai.expect)(component.get('selection').toArray(), 'component selection').to.deep.equal([item3, item2]);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/gh-selectize-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-selectize-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-spin-button-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Component: gh-spin-button', function () {
        (0, _emberMocha.setupComponentTest)('gh-spin-button', {
            unit: true
            // specify the other units that are required for this test
            // needs: ['component:foo', 'helper:bar']
        });

        (0, _mocha.it)('renders', function () {
            // creates the component instance
            var component = this.subject();

            (0, _chai.expect)(component._state).to.equal('preRender');

            // renders the component on the page
            this.render();
            (0, _chai.expect)(component._state).to.equal('inDOM');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/gh-spin-button-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-spin-button-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-upgrade-notification-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('GhUpgradeNotificationComponent', function () {
        (0, _emberMocha.setupComponentTest)('gh-upgrade-notification', {
            needs: ['helper:gh-format-html']
        });

        beforeEach(function () {
            var upgradeMessage = { 'content': 'Ghost 10.02.91 is available! Hot Damn. <a href="http://support.ghost.org/how-to-upgrade/" target="_blank">Click here</a> to upgrade.' };
            this.subject().set('upgradeNotification', upgradeMessage);
        });

        (0, _mocha.it)('renders', function () {
            // creates the component instance
            var component = this.subject();
            (0, _chai.expect)(component._state).to.equal('preRender');

            // renders the component on the page
            this.render();
            (0, _chai.expect)(component._state).to.equal('inDOM');

            (0, _chai.expect)(this.$().prop('tagName')).to.equal('SECTION');
            (0, _chai.expect)(this.$().hasClass('gh-upgrade-notification')).to.be['true'];
            // caja tools sanitize target='_blank' attribute
            (0, _chai.expect)(this.$().html()).to.contain('Hot Damn. <a href="http://support.ghost.org/how-to-upgrade/">Click here</a>');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/gh-upgrade-notification-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-upgrade-notification-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-url-preview_test', ['exports', 'mocha', 'ember-mocha'], function (exports, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Component: gh-url-preview', function () {
        (0, _emberMocha.setupComponentTest)('gh-url-preview', {
            unit: true
        });

        (0, _mocha.it)('generates the correct preview URL with a prefix', function () {
            var component = this.subject({
                prefix: 'tag',
                slug: 'test-slug',
                tagName: 'p',
                classNames: 'test-class',

                config: { blogUrl: 'http://my-ghost-blog.com' }
            });

            this.render();

            expect(component.get('url')).to.equal('my-ghost-blog.com/tag/test-slug/');
        });

        (0, _mocha.it)('generates the correct preview URL without a prefix', function () {
            var component = this.subject({
                slug: 'test-slug',
                tagName: 'p',
                classNames: 'test-class',

                config: { blogUrl: 'http://my-ghost-blog.com' }
            });

            this.render();

            expect(component.get('url')).to.equal('my-ghost-blog.com/test-slug/');
        });
    });
});
define('ghost-admin/tests/unit/components/gh-url-preview_test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-url-preview_test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-user-active-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Component: gh-user-active', function () {
        (0, _emberMocha.setupComponentTest)('gh-user-active', {
            unit: true
            // specify the other units that are required for this test
            // needs: ['component:foo', 'helper:bar']
        });

        (0, _mocha.it)('renders', function () {
            // creates the component instance
            var component = this.subject();

            (0, _chai.expect)(component._state).to.equal('preRender');

            // renders the component on the page
            this.render();
            (0, _chai.expect)(component._state).to.equal('inDOM');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/gh-user-active-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-user-active-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/components/gh-user-invited-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Component: gh-user-invited', function () {
        (0, _emberMocha.setupComponentTest)('gh-user-invited', {
            unit: true
            // specify the other units that are required for this test
            // needs: ['component:foo', 'helper:bar']
        });

        (0, _mocha.it)('renders', function () {
            // creates the component instance
            var component = this.subject();

            (0, _chai.expect)(component._state).to.equal('preRender');

            // renders the component on the page
            this.render();
            (0, _chai.expect)(component._state).to.equal('inDOM');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/gh-user-invited-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/components/gh-user-invited-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define("ghost-admin/tests/unit/components/koenig-card-test", ["exports"], function (exports) {});
define("ghost-admin/tests/unit/components/koenig-menu-item-test", ["exports"], function (exports) {});
define('ghost-admin/tests/unit/components/koenig-menu-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ghost-admin/tests/utils'], function (exports, _chai, _mocha, _emberMocha, _ghostAdminTestsUtils) {

    _mocha.describe.skip('Unit: Component: koenig-menu', function () {
        (0, _emberMocha.setupComponentTest)('koenig-menu', {
            unit: true
        });

        (0, _mocha.it)('renders', function () {
            var component = this.subject();
            component.editor = _ghostAdminTestsUtils.editorShim;
            (0, _chai.expect)(component._state).to.equal('preRender');

            // renders the component on the page
            this.render();
            (0, _chai.expect)(component._state).to.equal('inDOM');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/koenig-toolbar-button-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    _mocha.describe.skip('Unit: Component: koenig-toolbar-button', function () {
        (0, _emberMocha.setupComponentTest)('koenig-toolbar-button', {
            unit: true
        });

        (0, _mocha.it)('renders', function () {
            var component = this.subject();
            (0, _chai.expect)(component._state).to.equal('preRender');

            // renders the component on the page
            this.render();
            (0, _chai.expect)(component._state).to.equal('inDOM');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/koenig-toolbar-newitem-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ghost-admin/tests/utils'], function (exports, _chai, _mocha, _emberMocha, _ghostAdminTestsUtils) {

    _mocha.describe.skip('Unit: Component: koenig-toolbar-newitem', function () {
        (0, _emberMocha.setupComponentTest)('koenig-toolbar-newitem', {
            unit: true,
            needs: ['component:koenig-toolbar-button']
        });

        (0, _mocha.it)('renders', function () {

            var component = this.subject();
            component.editor = _ghostAdminTestsUtils.editorShim;
            (0, _chai.expect)(component._state).to.equal('preRender');

            // renders the component on the page
            this.render();
            (0, _chai.expect)(component._state).to.equal('inDOM');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/koenig-toolbar-newitem', ['exports', 'chai', 'mocha', 'ember-mocha', 'sinon'], function (exports, _chai, _mocha, _emberMocha, _sinon) {

    _mocha.describe.skip('Unit: Component: koenig-toolbar', function () {
        (0, _emberMocha.setupComponentTest)('koenig-toolbar', {
            unit: true
        });

        (0, _mocha.it)('The toolbar is not rendered by default.', function () {
            var component = this.subject();
            (0, _chai.expect)(component.isVisible).to.be['false'];
        });

        (0, _mocha.it)('The toolbar contains tools.', function () {
            var component = this.subject();
            (0, _chai.expect)(component.get('toolbar').length).to.be.greaterThan(0); // the standard toolbar tools (strong, em, strikethrough, link)
            (0, _chai.expect)(component.get('toolbarBlocks').length).to.be.greaterThan(0); // extended toolbar block bases tools (h1, h2, quote);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/components/koenig-toolbar-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'sinon'], function (exports, _chai, _mocha, _emberMocha, _sinon) {

    _mocha.describe.skip('Unit: Component: koenig-toolbar', function () {
        (0, _emberMocha.setupComponentTest)('koenig-toolbar', {
            unit: true
        });

        (0, _mocha.it)('The toolbar is not visible by default.', function () {
            var component = this.subject();
            (0, _chai.expect)(component.isVisible).to.be['false'];
        });

        (0, _mocha.it)('The toolbar contains tools.', function () {
            var component = this.subject();
            (0, _chai.expect)(component.get('toolbar').length).to.be.greaterThan(0); // the standard toolbar tools (strong, em, strikethrough, link)
            (0, _chai.expect)(component.get('toolbarBlocks').length).to.be.greaterThan(0); // extended toolbar block bases tools (h1, h2, quote);
        });

        // it('The toolbar appears when a range is selected.', function () {
        //     let component = this.subject();
        // });

        // it('A tool is selected when the cursor moves over text of that style.', function () {
        //     let component = this.subject();
        // });

        // it('A tool manipulates the content.', function () {
        //     let component = this.subject();
        // });

        // it('links stuff', function() {

        // });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/controllers/settings/design-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember', 'ghost-admin/models/navigation-item'], function (exports, _chai, _mocha, _emberMocha, _ember, _ghostAdminModelsNavigationItem) {
    var run = _ember['default'].run;
    var EmberObject = _ember['default'].Object;

    // const navSettingJSON = `[
    //     {"label":"Home","url":"/"},
    //     {"label":"JS Test","url":"javascript:alert('hello');"},
    //     {"label":"About","url":"/about"},
    //     {"label":"Sub Folder","url":"/blah/blah"},
    //     {"label":"Telephone","url":"tel:01234-567890"},
    //     {"label":"Mailto","url":"mailto:test@example.com"},
    //     {"label":"External","url":"https://example.com/testing?query=test#anchor"},
    //     {"label":"No Protocol","url":"//example.com"}
    // ]`;

    (0, _mocha.describe)('Unit: Controller: settings/design', function () {
        (0, _emberMocha.setupTest)('controller:settings/design', {
            // Specify the other units that are required for this test.
            needs: ['service:config', 'service:notifications', 'model:navigation-item', 'service:ajax', 'service:ghostPaths', 'service:upgrade-status']
        });

        (0, _mocha.it)('blogUrl: captures config and ensures trailing slash', function () {
            var ctrl = this.subject();
            ctrl.set('config.blogUrl', 'http://localhost:2368/blog');
            (0, _chai.expect)(ctrl.get('blogUrl')).to.equal('http://localhost:2368/blog/');
        });

        (0, _mocha.it)('init: creates a new navigation item', function () {
            var ctrl = this.subject();

            run(function () {
                (0, _chai.expect)(ctrl.get('newNavItem')).to.exist;
                (0, _chai.expect)(ctrl.get('newNavItem.isNew')).to.be['true'];
            });
        });

        (0, _mocha.it)('blogUrl: captures config and ensures trailing slash', function () {
            var ctrl = this.subject();
            ctrl.set('config.blogUrl', 'http://localhost:2368/blog');
            (0, _chai.expect)(ctrl.get('blogUrl')).to.equal('http://localhost:2368/blog/');
        });

        (0, _mocha.it)('save: validates nav items', function (done) {
            var ctrl = this.subject();

            run(function () {
                ctrl.set('model', EmberObject.create({ navigation: [_ghostAdminModelsNavigationItem['default'].create({ label: 'First', url: '/' }), _ghostAdminModelsNavigationItem['default'].create({ label: '', url: '/second' }), _ghostAdminModelsNavigationItem['default'].create({ label: 'Third', url: '' })] }));
                // blank item won't get added because the last item is incomplete
                (0, _chai.expect)(ctrl.get('model.navigation.length')).to.equal(3);

                ctrl.get('save').perform().then(function passedValidation() {
                    (0, _chai.assert)(false, 'navigationItems weren\'t validated on save');
                    done();
                })['catch'](function failedValidation() {
                    var navItems = ctrl.get('model.navigation');
                    (0, _chai.expect)(navItems[0].get('errors').toArray()).to.be.empty;
                    (0, _chai.expect)(navItems[1].get('errors.firstObject.attribute')).to.equal('label');
                    (0, _chai.expect)(navItems[2].get('errors.firstObject.attribute')).to.equal('url');
                    done();
                });
            });
        });

        (0, _mocha.it)('save: ignores blank last item when saving', function (done) {
            var ctrl = this.subject();

            run(function () {
                ctrl.set('model', EmberObject.create({ navigation: [_ghostAdminModelsNavigationItem['default'].create({ label: 'First', url: '/' }), _ghostAdminModelsNavigationItem['default'].create({ label: '', url: '' })] }));

                (0, _chai.expect)(ctrl.get('model.navigation.length')).to.equal(2);

                ctrl.get('save').perform().then(function passedValidation() {
                    (0, _chai.assert)(false, 'navigationItems weren\'t validated on save');
                    done();
                })['catch'](function failedValidation() {
                    var navItems = ctrl.get('model.navigation');
                    (0, _chai.expect)(navItems[0].get('errors').toArray()).to.be.empty;
                    done();
                });
            });
        });

        (0, _mocha.it)('action - addNavItem: adds item to navigationItems', function () {
            var ctrl = this.subject();

            run(function () {
                ctrl.set('model', EmberObject.create({ navigation: [_ghostAdminModelsNavigationItem['default'].create({ label: 'First', url: '/first', last: true })] }));
            });

            (0, _chai.expect)(ctrl.get('model.navigation.length')).to.equal(1);

            ctrl.set('newNavItem.label', 'New');
            ctrl.set('newNavItem.url', '/new');

            run(function () {
                ctrl.send('addNavItem');
            });

            (0, _chai.expect)(ctrl.get('model.navigation.length')).to.equal(2);
            (0, _chai.expect)(ctrl.get('model.navigation.lastObject.label')).to.equal('New');
            (0, _chai.expect)(ctrl.get('model.navigation.lastObject.url')).to.equal('/new');
            (0, _chai.expect)(ctrl.get('model.navigation.lastObject.isNew')).to.be['false'];
            (0, _chai.expect)(ctrl.get('newNavItem.label')).to.be.blank;
            (0, _chai.expect)(ctrl.get('newNavItem.url')).to.be.blank;
            (0, _chai.expect)(ctrl.get('newNavItem.isNew')).to.be['true'];
        });

        (0, _mocha.it)('action - addNavItem: doesn\'t insert new item if last object is incomplete', function () {
            var ctrl = this.subject();

            run(function () {
                ctrl.set('model', EmberObject.create({ navigation: [_ghostAdminModelsNavigationItem['default'].create({ label: '', url: '', last: true })] }));
                (0, _chai.expect)(ctrl.get('model.navigation.length')).to.equal(1);
                ctrl.send('addNavItem');
                (0, _chai.expect)(ctrl.get('model.navigation.length')).to.equal(1);
            });
        });

        (0, _mocha.it)('action - deleteNavItem: removes item from navigationItems', function () {
            var ctrl = this.subject();
            var navItems = [_ghostAdminModelsNavigationItem['default'].create({ label: 'First', url: '/first' }), _ghostAdminModelsNavigationItem['default'].create({ label: 'Second', url: '/second', last: true })];

            run(function () {
                ctrl.set('model', EmberObject.create({ navigation: navItems }));
                (0, _chai.expect)(ctrl.get('model.navigation').mapBy('label')).to.deep.equal(['First', 'Second']);
                ctrl.send('deleteNavItem', ctrl.get('model.navigation.firstObject'));
                (0, _chai.expect)(ctrl.get('model.navigation').mapBy('label')).to.deep.equal(['Second']);
            });
        });

        (0, _mocha.it)('action - reorderItems: updates navigationItems list', function () {
            var ctrl = this.subject();
            var navItems = [_ghostAdminModelsNavigationItem['default'].create({ label: 'First', url: '/first' }), _ghostAdminModelsNavigationItem['default'].create({ label: 'Second', url: '/second', last: true })];

            run(function () {
                ctrl.set('model', EmberObject.create({ navigation: navItems }));
                (0, _chai.expect)(ctrl.get('model.navigation').mapBy('label')).to.deep.equal(['First', 'Second']);
                ctrl.send('reorderItems', navItems.reverseObjects());
                (0, _chai.expect)(ctrl.get('model.navigation').mapBy('label')).to.deep.equal(['Second', 'First']);
            });
        });

        (0, _mocha.it)('action - updateUrl: updates URL on navigationItem', function () {
            var ctrl = this.subject();
            var navItems = [_ghostAdminModelsNavigationItem['default'].create({ label: 'First', url: '/first' }), _ghostAdminModelsNavigationItem['default'].create({ label: 'Second', url: '/second', last: true })];

            run(function () {
                ctrl.set('model', EmberObject.create({ navigation: navItems }));
                (0, _chai.expect)(ctrl.get('model.navigation').mapBy('url')).to.deep.equal(['/first', '/second']);
                ctrl.send('updateUrl', '/new', ctrl.get('model.navigation.firstObject'));
                (0, _chai.expect)(ctrl.get('model.navigation').mapBy('url')).to.deep.equal(['/new', '/second']);
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/controllers/settings/design-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/controllers/settings/design-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/controllers/settings/general-test', ['exports', 'ember', 'mocha', 'ember-mocha'], function (exports, _ember, _mocha, _emberMocha) {
    var run = _ember['default'].run;
    var EmberObject = _ember['default'].Object;

    (0, _mocha.describe)('Unit: Controller: settings/general', function () {
        (0, _emberMocha.setupTest)('controller:settings/general', {
            needs: ['service:notifications']
        });

        (0, _mocha.it)('isDatedPermalinks should be correct', function () {
            var controller = this.subject({
                model: EmberObject.create({
                    permalinks: '/:year/:month/:day/:slug/'
                })
            });

            expect(controller.get('isDatedPermalinks')).to.be.ok;

            run(function () {
                controller.set('model.permalinks', '/:slug/');

                expect(controller.get('isDatedPermalinks')).to.not.be.ok;
            });
        });

        (0, _mocha.it)('setting isDatedPermalinks should switch between dated and slug', function () {
            var controller = this.subject({
                model: EmberObject.create({
                    permalinks: '/:year/:month/:day/:slug/'
                })
            });

            run(function () {
                controller.set('isDatedPermalinks', false);

                expect(controller.get('isDatedPermalinks')).to.not.be.ok;
                expect(controller.get('model.permalinks')).to.equal('/:slug/');
            });

            run(function () {
                controller.set('isDatedPermalinks', true);

                expect(controller.get('isDatedPermalinks')).to.be.ok;
                expect(controller.get('model.permalinks')).to.equal('/:year/:month/:day/:slug/');
            });
        });
    });
});
define('ghost-admin/tests/unit/controllers/settings/general-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/controllers/settings/general-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/controllers/subscribers-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Controller: subscribers', function () {
        (0, _emberMocha.setupTest)('controller:subscribers', {
            needs: ['service:notifications']
        });

        // Replace this with your real tests.
        (0, _mocha.it)('exists', function () {
            var controller = this.subject();
            (0, _chai.expect)(controller).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/controllers/subscribers-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/controllers/subscribers-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/helpers/gh-count-characters-test', ['exports', 'chai', 'mocha', 'ghost-admin/helpers/gh-count-characters'], function (exports, _chai, _mocha, _ghostAdminHelpersGhCountCharacters) {

    (0, _mocha.describe)('Unit: Helper: gh-count-characters', function () {
        var defaultStyle = 'color: rgb(158, 157, 149);';
        var errorStyle = 'color: rgb(226, 84, 64);';

        (0, _mocha.it)('counts remaining chars', function () {
            var result = (0, _ghostAdminHelpersGhCountCharacters.countCharacters)(['test']);
            (0, _chai.expect)(result.string).to.equal('<span class="word-count" style="' + defaultStyle + '">196</span>');
        });

        (0, _mocha.it)('warns when nearing limit', function () {
            var result = (0, _ghostAdminHelpersGhCountCharacters.countCharacters)([Array(195 + 1).join('x')]);
            (0, _chai.expect)(result.string).to.equal('<span class="word-count" style="' + errorStyle + '">5</span>');
        });

        (0, _mocha.it)('indicates too many chars', function () {
            var result = (0, _ghostAdminHelpersGhCountCharacters.countCharacters)([Array(205 + 1).join('x')]);
            (0, _chai.expect)(result.string).to.equal('<span class="word-count" style="' + errorStyle + '">-5</span>');
        });

        (0, _mocha.it)('counts multibyte correctly', function () {
            var result = (0, _ghostAdminHelpersGhCountCharacters.countCharacters)(['💩']);
            (0, _chai.expect)(result.string).to.equal('<span class="word-count" style="' + defaultStyle + '">199</span>');

            // emoji + modifier is still two chars
            result = (0, _ghostAdminHelpersGhCountCharacters.countCharacters)(['💃🏻']);
            (0, _chai.expect)(result.string).to.equal('<span class="word-count" style="' + defaultStyle + '">198</span>');
        });
    });
});
define('ghost-admin/tests/unit/helpers/gh-count-characters-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/helpers/gh-count-characters-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/helpers/gh-count-down-characters-test', ['exports', 'chai', 'mocha', 'ghost-admin/helpers/gh-count-down-characters'], function (exports, _chai, _mocha, _ghostAdminHelpersGhCountDownCharacters) {

    (0, _mocha.describe)('Unit: Helper: gh-count-down-characters', function () {
        var validStyle = 'color: rgb(159, 187, 88);';
        var errorStyle = 'color: rgb(226, 84, 64);';

        (0, _mocha.it)('counts chars', function () {
            var result = (0, _ghostAdminHelpersGhCountDownCharacters.countDownCharacters)(['test', 200]);
            (0, _chai.expect)(result.string).to.equal('<span class="word-count" style="' + validStyle + '">4</span>');
        });

        (0, _mocha.it)('warns with too many chars', function () {
            var result = (0, _ghostAdminHelpersGhCountDownCharacters.countDownCharacters)([Array(205 + 1).join('x'), 200]);
            (0, _chai.expect)(result.string).to.equal('<span class="word-count" style="' + errorStyle + '">205</span>');
        });

        (0, _mocha.it)('counts multibyte correctly', function () {
            var result = (0, _ghostAdminHelpersGhCountDownCharacters.countDownCharacters)(['💩', 200]);
            (0, _chai.expect)(result.string).to.equal('<span class="word-count" style="' + validStyle + '">1</span>');

            // emoji + modifier is still two chars
            result = (0, _ghostAdminHelpersGhCountDownCharacters.countDownCharacters)(['💃🏻', 200]);
            (0, _chai.expect)(result.string).to.equal('<span class="word-count" style="' + validStyle + '">2</span>');
        });
    });
});
define('ghost-admin/tests/unit/helpers/gh-count-down-characters-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/helpers/gh-count-down-characters-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/helpers/gh-format-time-scheduled-test', ['exports', 'ember-object', 'chai', 'mocha', 'ghost-admin/helpers/gh-format-time-scheduled'], function (exports, _emberObject, _chai, _mocha, _ghostAdminHelpersGhFormatTimeScheduled) {

    (0, _mocha.describe)('Unit: Helper: gh-format-time-scheduled', function () {
        var mockDate = undefined,
            mockTimezone = undefined;

        (0, _mocha.it)('renders the date with the bog timezone', function () {
            mockDate = '2016-05-30T10:00:00.000Z';
            mockTimezone = _emberObject['default'].create({
                content: 'Africa/Cairo',
                isFulfilled: true
            });

            var result = (0, _ghostAdminHelpersGhFormatTimeScheduled.timeToSchedule)([mockDate, mockTimezone]);
            (0, _chai.expect)(result).to.be.equal('30 May 2016, 12:00');
        });
        (0, _mocha.it)('returns only when the timezone promise is fulfilled', function () {
            mockDate = '2016-05-30T10:00:00.000Z';
            mockTimezone = _emberObject['default'].create({
                content: undefined,
                isFulfilled: false
            });

            var result = (0, _ghostAdminHelpersGhFormatTimeScheduled.timeToSchedule)([mockDate, mockTimezone]);
            (0, _chai.expect)(result).to.be.equal(undefined);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/helpers/gh-format-time-scheduled-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/helpers/gh-format-time-scheduled-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/helpers/gh-format-timeago-test', ['exports', 'chai', 'mocha', 'ghost-admin/helpers/gh-format-timeago', 'sinon'], function (exports, _chai, _mocha, _ghostAdminHelpersGhFormatTimeago, _sinon) {

    (0, _mocha.describe)('Unit: Helper: gh-format-timeago', function () {
        // eslint-disable-next-line no-unused-vars
        var mockDate = undefined,
            utcStub = undefined;

        (0, _mocha.it)('calculates the correct time difference', function () {
            mockDate = '2016-05-30T10:00:00.000Z';
            utcStub = _sinon['default'].stub(moment, 'utc').returns('2016-05-30T11:00:00.000Z');

            var result = (0, _ghostAdminHelpersGhFormatTimeago.timeAgo)([mockDate]);
            (0, _chai.expect)(result).to.be.equal('an hour ago');

            moment.utc.restore();
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/helpers/gh-format-timeago-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/helpers/gh-format-timeago-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/helpers/gh-user-can-admin-test', ['exports', 'mocha', 'ghost-admin/helpers/gh-user-can-admin'], function (exports, _mocha, _ghostAdminHelpersGhUserCanAdmin) {

    describe('Unit: Helper: gh-user-can-admin', function () {
        // Mock up roles and test for truthy
        describe('Owner role', function () {
            var user = {
                get: function get(role) {
                    if (role === 'isOwner') {
                        return true;
                    } else if (role === 'isAdmin') {
                        return false;
                    }
                }
            };

            (0, _mocha.it)(' - can be Admin', function () {
                var result = (0, _ghostAdminHelpersGhUserCanAdmin.ghUserCanAdmin)([user]);
                expect(result).to.equal(true);
            });
        });

        describe('Administrator role', function () {
            var user = {
                get: function get(role) {
                    if (role === 'isOwner') {
                        return false;
                    } else if (role === 'isAdmin') {
                        return true;
                    }
                }
            };

            (0, _mocha.it)(' - can be Admin', function () {
                var result = (0, _ghostAdminHelpersGhUserCanAdmin.ghUserCanAdmin)([user]);
                expect(result).to.equal(true);
            });
        });

        describe('Editor and Author roles', function () {
            var user = {
                get: function get(role) {
                    if (role === 'isOwner') {
                        return false;
                    } else if (role === 'isAdmin') {
                        return false;
                    }
                }
            };

            (0, _mocha.it)(' - cannot be Admin', function () {
                var result = (0, _ghostAdminHelpersGhUserCanAdmin.ghUserCanAdmin)([user]);
                expect(result).to.equal(false);
            });
        });
    });
});
define('ghost-admin/tests/unit/helpers/gh-user-can-admin-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/helpers/gh-user-can-admin-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/helpers/highlighted-text-test', ['exports', 'chai', 'mocha', 'ghost-admin/helpers/highlighted-text'], function (exports, _chai, _mocha, _ghostAdminHelpersHighlightedText) {

    (0, _mocha.describe)('Unit: Helper: highlighted-text', function () {

        (0, _mocha.it)('works', function () {
            var result = (0, _ghostAdminHelpersHighlightedText.highlightedText)(['Test', 'e']);
            (0, _chai.expect)(result).to.be.an('object');
            (0, _chai.expect)(result.string).to.equal('T<span class="highlight">e</span>st');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/helpers/highlighted-text-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/helpers/highlighted-text-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/helpers/is-equal-test', ['exports', 'chai', 'mocha', 'ghost-admin/helpers/is-equal'], function (exports, _chai, _mocha, _ghostAdminHelpersIsEqual) {

    (0, _mocha.describe)('Unit: Helper: is-equal', function () {
        // Replace this with your real tests.
        (0, _mocha.it)('works', function () {
            var result = (0, _ghostAdminHelpersIsEqual.isEqual)([42, 42]);

            (0, _chai.expect)(result).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/helpers/is-equal-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/helpers/is-equal-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/helpers/is-not-test', ['exports', 'chai', 'mocha', 'ghost-admin/helpers/is-not'], function (exports, _chai, _mocha, _ghostAdminHelpersIsNot) {

    (0, _mocha.describe)('Unit: Helper: is-not', function () {
        // Replace this with your real tests.
        (0, _mocha.it)('works', function () {
            var result = (0, _ghostAdminHelpersIsNot.isNot)(false);

            (0, _chai.expect)(result).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/helpers/is-not-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/helpers/is-not-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/mixins/editor-base-controller-test', ['exports', 'chai', 'mocha', 'ember-object', 'rsvp', 'ember-runloop', 'ember-concurrency', 'ghost-admin/mixins/editor-base-controller'], function (exports, _chai, _mocha, _emberObject, _rsvp, _emberRunloop, _emberConcurrency, _ghostAdminMixinsEditorBaseController) {
    var resolve = _rsvp['default'].resolve;

    (0, _mocha.describe)('Unit: Mixin: editor-base-controller', function () {
        (0, _mocha.describe)('generateSlug', function () {
            (0, _mocha.it)('should generate a slug and set it on the model', function (done) {
                var object = _emberObject['default'].extend(_ghostAdminMixinsEditorBaseController['default'], {
                    slugGenerator: _emberObject['default'].create({
                        generateSlug: function generateSlug(slugType, str) {
                            return _rsvp['default'].resolve(str + '-slug');
                        }
                    }),
                    model: _emberObject['default'].create({ slug: '' })
                }).create();

                object.set('model.titleScratch', 'title');

                (0, _emberRunloop['default'])(function () {
                    var promise = object.get('generateSlug').perform();

                    (0, _chai.expect)(object.get('model.slug')).to.equal('');

                    promise.then(function () {
                        (0, _chai.expect)(object.get('model.slug')).to.equal('title-slug');

                        done();
                    })['catch'](done);
                });
            });

            (0, _mocha.it)('should not set the destination if the title is "(Untitled)" and the post already has a slug', function (done) {
                var object = _emberObject['default'].extend(_ghostAdminMixinsEditorBaseController['default'], {
                    slugGenerator: _emberObject['default'].create({
                        generateSlug: function generateSlug(slugType, str) {
                            return _rsvp['default'].resolve(str + '-slug');
                        }
                    }),
                    model: _emberObject['default'].create({
                        slug: 'whatever'
                    })
                }).create();

                (0, _chai.expect)(object.get('model.slug')).to.equal('whatever');

                object.set('model.titleScratch', '(Untitled)');

                (0, _emberRunloop['default'])(function () {
                    object.get('generateSlug').perform().then(function () {
                        (0, _chai.expect)(object.get('model.slug')).to.equal('whatever');

                        done();
                    })['catch'](done);
                });
            });
        });

        (0, _mocha.describe)('updateTitle', function () {
            (0, _mocha.it)('should invoke generateSlug if the post is new and a title has not been set', function (done) {
                var object = _emberObject['default'].extend(_ghostAdminMixinsEditorBaseController['default'], {
                    model: _emberObject['default'].create({ isNew: true }),
                    generateSlug: (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$3$0() {
                        return regeneratorRuntime.wrap(function callee$3$0$(context$4$0) {
                            while (1) switch (context$4$0.prev = context$4$0.next) {
                                case 0:
                                    this.set('model.slug', 'test-slug');
                                    context$4$0.next = 3;
                                    return resolve();

                                case 3:
                                case 'end':
                                    return context$4$0.stop();
                            }
                        }, callee$3$0, this);
                    }))
                }).create();

                (0, _chai.expect)(object.get('model.isNew')).to.be['true'];
                (0, _chai.expect)(object.get('model.titleScratch')).to.not.be.ok;

                (0, _emberRunloop['default'])(function () {
                    object.get('updateTitle').perform('test');

                    (0, _emberRunloop.later)(function () {
                        (0, _chai.expect)(object.get('model.titleScratch')).to.equal('test');
                        (0, _chai.expect)(object.get('model.slug')).to.equal('test-slug');

                        done();
                    }, 800);
                });
            });

            (0, _mocha.it)('should invoke generateSlug if the post is not new and a title is "(Untitled)"', function (done) {
                var object = _emberObject['default'].extend(_ghostAdminMixinsEditorBaseController['default'], {
                    model: _emberObject['default'].create({ isNew: false }),
                    generateSlug: (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$3$0() {
                        return regeneratorRuntime.wrap(function callee$3$0$(context$4$0) {
                            while (1) switch (context$4$0.prev = context$4$0.next) {
                                case 0:
                                    this.set('model.slug', 'test-slug');
                                    context$4$0.next = 3;
                                    return resolve();

                                case 3:
                                case 'end':
                                    return context$4$0.stop();
                            }
                        }, callee$3$0, this);
                    }))
                }).create();

                (0, _chai.expect)(object.get('model.isNew')).to.be['false'];
                (0, _chai.expect)(object.get('model.titleScratch')).to.not.be.ok;

                (0, _emberRunloop['default'])(function () {
                    object.get('updateTitle').perform('(Untitled)');

                    (0, _emberRunloop.later)(function () {
                        (0, _chai.expect)(object.get('model.titleScratch')).to.equal('(Untitled)');
                        (0, _chai.expect)(object.get('model.slug')).to.equal('test-slug');

                        done();
                    }, 800);
                });
            });

            (0, _mocha.it)('should not invoke generateSlug if the post is new but has a title', function (done) {
                var object = _emberObject['default'].extend(_ghostAdminMixinsEditorBaseController['default'], {
                    model: _emberObject['default'].create({
                        isNew: true,
                        title: 'a title'
                    }),
                    generateSlug: (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$3$0() {
                        return regeneratorRuntime.wrap(function callee$3$0$(context$4$0) {
                            while (1) switch (context$4$0.prev = context$4$0.next) {
                                case 0:
                                    (0, _chai.expect)(false, 'generateSlug should not be called').to.equal(true);

                                    context$4$0.next = 3;
                                    return resolve();

                                case 3:
                                case 'end':
                                    return context$4$0.stop();
                            }
                        }, callee$3$0, this);
                    }))
                }).create();

                (0, _chai.expect)(object.get('model.isNew')).to.be['true'];
                (0, _chai.expect)(object.get('model.title')).to.equal('a title');
                (0, _chai.expect)(object.get('model.titleScratch')).to.not.be.ok;

                (0, _emberRunloop['default'])(function () {
                    object.get('updateTitle').perform('test');

                    (0, _emberRunloop.later)(function () {
                        (0, _chai.expect)(object.get('model.titleScratch')).to.equal('test');
                        (0, _chai.expect)(object.get('model.slug')).to.not.be.ok;

                        done();
                    }, 800);
                });
            });

            (0, _mocha.it)('should not invoke generateSlug if the post is not new and the title is not "(Untitled)"', function (done) {
                var object = _emberObject['default'].extend(_ghostAdminMixinsEditorBaseController['default'], {
                    model: _emberObject['default'].create({ isNew: false }),
                    generateSlug: (0, _emberConcurrency.task)(regeneratorRuntime.mark(function callee$3$0() {
                        return regeneratorRuntime.wrap(function callee$3$0$(context$4$0) {
                            while (1) switch (context$4$0.prev = context$4$0.next) {
                                case 0:
                                    (0, _chai.expect)(false, 'generateSlug should not be called').to.equal(true);

                                    context$4$0.next = 3;
                                    return resolve();

                                case 3:
                                case 'end':
                                    return context$4$0.stop();
                            }
                        }, callee$3$0, this);
                    }))
                }).create();

                (0, _chai.expect)(object.get('model.isNew')).to.be['false'];
                (0, _chai.expect)(object.get('model.title')).to.not.be.ok;

                (0, _emberRunloop['default'])(function () {
                    object.get('updateTitle').perform('title');

                    (0, _emberRunloop.later)(function () {
                        (0, _chai.expect)(object.get('model.titleScratch')).to.equal('title');
                        (0, _chai.expect)(object.get('model.slug')).to.not.be.ok;

                        done();
                    }, 800);
                });
            });
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/mixins/editor-base-controller-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/mixins/editor-base-controller-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/mixins/infinite-scroll-test', ['exports', 'chai', 'mocha', 'ember-object', 'ghost-admin/mixins/infinite-scroll'], function (exports, _chai, _mocha, _emberObject, _ghostAdminMixinsInfiniteScroll) {

    (0, _mocha.describe)('Unit: Mixin: infinite-scroll', function () {
        // Replace this with your real tests.
        (0, _mocha.it)('works', function () {
            var InfiniteScrollObject = _emberObject['default'].extend(_ghostAdminMixinsInfiniteScroll['default']);
            var subject = InfiniteScrollObject.create();

            (0, _chai.expect)(subject).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/mixins/infinite-scroll-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/mixins/infinite-scroll-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/mixins/validation-engine-test', ['exports', 'mocha'], function (exports, _mocha) {
    // import EmberObject from 'ember-object';
    // import ValidationEngineMixin from 'ghost-admin/mixins/validation-engine';

    (0, _mocha.describe)('ValidationEngineMixin', function () {
        // Replace this with your real tests.
        // it('works', function () {
        //     var ValidationEngineObject = EmberObject.extend(ValidationEngineMixin);
        //     var subject = ValidationEngineObject.create();
        //     expect(subject).to.be.ok;
        // });

        (0, _mocha.describe)('#validate', function () {
            (0, _mocha.it)('loads the correct validator');
            (0, _mocha.it)('rejects if the validator doesn\'t exist');
            (0, _mocha.it)('resolves with valid object');
            (0, _mocha.it)('rejects with invalid object');
            (0, _mocha.it)('clears all existing errors');

            (0, _mocha.describe)('with a specified property', function () {
                (0, _mocha.it)('resolves with valid property');
                (0, _mocha.it)('rejects with invalid property');
                (0, _mocha.it)('adds property to hasValidated array');
                (0, _mocha.it)('clears existing error on specified property');
            });

            (0, _mocha.it)('handles a passed in model');
            (0, _mocha.it)('uses this.model if available');
        });

        (0, _mocha.describe)('#save', function () {
            (0, _mocha.it)('calls validate');
            (0, _mocha.it)('rejects with validation errors');
            (0, _mocha.it)('calls object\'s #save if validation passes');
            (0, _mocha.it)('skips validation if it\'s a deletion');
        });
    });
});
/* jshint expr:true */
// import {expect} from 'chai';
define('ghost-admin/tests/unit/mixins/validation-engine-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/mixins/validation-engine-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/models/invite-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-runloop', 'pretender'], function (exports, _chai, _mocha, _emberMocha, _emberRunloop, _pretender) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    (0, _mocha.describe)('Unit: Model: invite', function () {
        (0, _emberMocha.setupModelTest)('invite', {
            needs: ['model:role', 'serializer:application', 'serializer:invite', 'transform:moment-utc', 'service:ghost-paths', 'service:ajax', 'service:session', 'service:feature']
        });

        (0, _mocha.describe)('with network', function () {
            var server = undefined;

            beforeEach(function () {
                server = new _pretender['default']();
            });

            afterEach(function () {
                server.shutdown();
            });

            (0, _mocha.it)('resend hits correct endpoint', function () {
                var _this = this;

                var model = this.subject();
                var role = undefined;

                server.post('/ghost/api/v0.1/invites/', function () {
                    return [200, {}, '{}'];
                });

                (0, _emberRunloop['default'])(function () {
                    role = _this.store().push({ data: { id: 1, type: 'role', attributes: { name: 'Editor' } } });
                    model.set('email', 'resend-test@example.com');
                    model.set('role', role);
                    model.resend();
                });

                (0, _chai.expect)(server.handledRequests.length, 'number of requests').to.equal(1);

                var _server$handledRequests = _slicedToArray(server.handledRequests, 1);

                var lastRequest = _server$handledRequests[0];

                var requestBody = JSON.parse(lastRequest.requestBody);

                var _requestBody$invites = _slicedToArray(requestBody.invites, 1);

                var invite = _requestBody$invites[0];

                (0, _chai.expect)(requestBody.invites.length, 'number of invites in request body').to.equal(1);

                (0, _chai.expect)(invite.email).to.equal('resend-test@example.com');
                // eslint-disable-next-line camelcase
                (0, _chai.expect)(invite.role_id, 'role ID').to.equal('1');
            });
        });
    });
});
define('ghost-admin/tests/unit/models/invite-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/models/invite-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/models/navigation-item-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Model: navigation-item', function () {
        (0, _emberMocha.setupTest)('model:navigation-item', {
            // Specify the other units that are required for this test.
            needs: []
        });

        (0, _mocha.it)('isComplete is true when label and url are filled', function () {
            var model = this.subject();

            model.set('label', 'test');
            model.set('url', 'test');

            (0, _chai.expect)(model.get('isComplete')).to.be['true'];
        });

        (0, _mocha.it)('isComplete is false when label is blank', function () {
            var model = this.subject();

            model.set('label', '');
            model.set('url', 'test');

            (0, _chai.expect)(model.get('isComplete')).to.be['false'];
        });

        (0, _mocha.it)('isComplete is false when url is blank', function () {
            var model = this.subject();

            model.set('label', 'test');
            model.set('url', '');

            (0, _chai.expect)(model.get('isComplete')).to.be['false'];
        });

        (0, _mocha.it)('isBlank is true when label and url are blank', function () {
            var model = this.subject();

            model.set('label', '');
            model.set('url', '');

            (0, _chai.expect)(model.get('isBlank')).to.be['true'];
        });

        (0, _mocha.it)('isBlank is false when label is present', function () {
            var model = this.subject();

            model.set('label', 'test');
            model.set('url', '');

            (0, _chai.expect)(model.get('isBlank')).to.be['false'];
        });

        (0, _mocha.it)('isBlank is false when url is present', function () {
            var model = this.subject();

            model.set('label', '');
            model.set('url', 'test');

            (0, _chai.expect)(model.get('isBlank')).to.be['false'];
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/models/navigation-item-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/models/navigation-item-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/models/post-test', ['exports', 'ember-runloop', 'ember-object', 'mocha', 'ember-mocha'], function (exports, _emberRunloop, _emberObject, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Model: post', function () {
        (0, _emberMocha.setupModelTest)('post', {
            needs: ['model:user', 'model:tag', 'model:role']
        });

        (0, _mocha.it)('has a validation type of "post"', function () {
            var model = this.subject();

            expect(model.validationType).to.equal('post');
        });

        (0, _mocha.it)('isPublished, isDraft and isScheduled are correct', function () {
            var model = this.subject({
                status: 'published'
            });

            expect(model.get('isPublished')).to.be.ok;
            expect(model.get('isDraft')).to.not.be.ok;
            expect(model.get('isScheduled')).to.not.be.ok;

            (0, _emberRunloop['default'])(function () {
                model.set('status', 'draft');

                expect(model.get('isPublished')).to.not.be.ok;
                expect(model.get('isDraft')).to.be.ok;
                expect(model.get('isScheduled')).to.not.be.ok;
            });

            (0, _emberRunloop['default'])(function () {
                model.set('status', 'scheduled');

                expect(model.get('isScheduled')).to.be.ok;
                expect(model.get('isPublished')).to.not.be.ok;
                expect(model.get('isDraft')).to.not.be.ok;
            });
        });

        (0, _mocha.it)('isAuthoredByUser is correct', function () {
            var model = this.subject({
                authorId: 'abcd1234'
            });
            var user = _emberObject['default'].create({ id: 'abcd1234' });

            expect(model.isAuthoredByUser(user)).to.be.ok;

            (0, _emberRunloop['default'])(function () {
                model.set('authorId', 'wxyz9876');

                expect(model.isAuthoredByUser(user)).to.not.be.ok;
            });
        });

        (0, _mocha.it)('updateTags removes and deletes old tags', function () {
            var model = this.subject();

            (0, _emberRunloop['default'])(this, function () {
                var modelTags = model.get('tags');
                var tag1 = this.store().createRecord('tag', { id: '1' });
                var tag2 = this.store().createRecord('tag', { id: '2' });
                var tag3 = this.store().createRecord('tag');

                // During testing a record created without an explicit id will get
                // an id of 'fixture-n' instead of null
                tag3.set('id', null);

                modelTags.pushObject(tag1);
                modelTags.pushObject(tag2);
                modelTags.pushObject(tag3);

                expect(model.get('tags.length')).to.equal(3);

                model.updateTags();

                expect(model.get('tags.length')).to.equal(2);
                expect(model.get('tags.firstObject.id')).to.equal('1');
                expect(model.get('tags').objectAt(1).get('id')).to.equal('2');
                expect(tag1.get('isDeleted')).to.not.be.ok;
                expect(tag2.get('isDeleted')).to.not.be.ok;
                expect(tag3.get('isDeleted')).to.be.ok;
            });
        });
    });
});
define('ghost-admin/tests/unit/models/post-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/models/post-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/models/role-test', ['exports', 'ember-runloop', 'mocha', 'ember-mocha'], function (exports, _emberRunloop, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Model: role', function () {
        (0, _emberMocha.setupModelTest)('role');
        (0, _mocha.it)('provides a lowercase version of the name', function () {
            var model = this.subject({
                name: 'Author'
            });

            expect(model.get('name')).to.equal('Author');
            expect(model.get('lowerCaseName')).to.equal('author');

            (0, _emberRunloop['default'])(function () {
                model.set('name', 'Editor');

                expect(model.get('name')).to.equal('Editor');
                expect(model.get('lowerCaseName')).to.equal('editor');
            });
        });
    });
});
define('ghost-admin/tests/unit/models/role-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/models/role-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/models/setting-test', ['exports', 'mocha', 'ember-mocha'], function (exports, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Model: setting', function () {
        (0, _emberMocha.setupModelTest)('setting');
        (0, _mocha.it)('has a validation type of "setting"', function () {
            var model = this.subject();

            expect(model.get('validationType')).to.equal('setting');
        });
    });
});
define('ghost-admin/tests/unit/models/setting-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/models/setting-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/models/subscriber-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Model: subscriber', function () {
        (0, _emberMocha.setupModelTest)('subscriber', {
            // Specify the other units that are required for this test.
            needs: ['model:post']
        });

        // Replace this with your real tests.
        (0, _mocha.it)('exists', function () {
            var model = this.subject();
            // var store = this.store();
            (0, _chai.expect)(model).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/models/subscriber-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/models/subscriber-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/models/tag-test', ['exports', 'mocha', 'ember-mocha'], function (exports, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Model: tag', function () {
        (0, _emberMocha.setupModelTest)('tag');
        (0, _mocha.it)('has a validation type of "tag"', function () {
            var model = this.subject();

            expect(model.get('validationType')).to.equal('tag');
        });
    });
});
define('ghost-admin/tests/unit/models/tag-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/models/tag-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/models/user-test', ['exports', 'ember-runloop', 'mocha', 'ember-mocha'], function (exports, _emberRunloop, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Model: user', function () {
        (0, _emberMocha.setupModelTest)('user', {
            needs: ['model:role', 'serializer:application', 'serializer:user']
        });

        (0, _mocha.it)('has a validation type of "user"', function () {
            var model = this.subject();

            expect(model.get('validationType')).to.equal('user');
        });

        (0, _mocha.it)('isActive/isSuspended properties are correct', function () {
            var model = this.subject({
                status: 'active'
            });

            expect(model.get('isActive')).to.be.ok;
            expect(model.get('isSuspended')).to.not.be.ok;

            ['warn-1', 'warn-2', 'warn-3', 'warn-4', 'locked'].forEach(function (status) {
                (0, _emberRunloop['default'])(function () {
                    model.set('status', status);
                });
                expect(model.get('isActive')).to.be.ok;
                expect(model.get('isSuspended')).to.not.be.ok;
            });

            (0, _emberRunloop['default'])(function () {
                model.set('status', 'inactive');
            });
            expect(model.get('isSuspended')).to.be.ok;
            expect(model.get('isActive')).to.not.be.ok;
        });

        (0, _mocha.it)('role property is correct', function () {
            var _this = this;

            var model = this.subject();

            (0, _emberRunloop['default'])(function () {
                var role = _this.store().push({ data: { id: 1, type: 'role', attributes: { name: 'Author' } } });
                model.get('roles').pushObject(role);
            });
            expect(model.get('role.name')).to.equal('Author');

            (0, _emberRunloop['default'])(function () {
                var role = _this.store().push({ data: { id: 1, type: 'role', attributes: { name: 'Editor' } } });
                model.set('role', role);
            });
            expect(model.get('role.name')).to.equal('Editor');
        });

        (0, _mocha.it)('isAuthor property is correct', function () {
            var _this2 = this;

            var model = this.subject();

            (0, _emberRunloop['default'])(function () {
                var role = _this2.store().push({ data: { id: 1, type: 'role', attributes: { name: 'Author' } } });
                model.set('role', role);
            });
            expect(model.get('isAuthor')).to.be.ok;
            expect(model.get('isEditor')).to.not.be.ok;
            expect(model.get('isAdmin')).to.not.be.ok;
            expect(model.get('isOwner')).to.not.be.ok;
        });

        (0, _mocha.it)('isEditor property is correct', function () {
            var _this3 = this;

            var model = this.subject();

            (0, _emberRunloop['default'])(function () {
                var role = _this3.store().push({ data: { id: 1, type: 'role', attributes: { name: 'Editor' } } });
                model.set('role', role);
            });
            expect(model.get('isEditor')).to.be.ok;
            expect(model.get('isAuthor')).to.not.be.ok;
            expect(model.get('isAdmin')).to.not.be.ok;
            expect(model.get('isOwner')).to.not.be.ok;
        });

        (0, _mocha.it)('isAdmin property is correct', function () {
            var _this4 = this;

            var model = this.subject();

            (0, _emberRunloop['default'])(function () {
                var role = _this4.store().push({ data: { id: 1, type: 'role', attributes: { name: 'Administrator' } } });
                model.set('role', role);
            });
            expect(model.get('isAdmin')).to.be.ok;
            expect(model.get('isAuthor')).to.not.be.ok;
            expect(model.get('isEditor')).to.not.be.ok;
            expect(model.get('isOwner')).to.not.be.ok;
        });

        (0, _mocha.it)('isOwner property is correct', function () {
            var _this5 = this;

            var model = this.subject();

            (0, _emberRunloop['default'])(function () {
                var role = _this5.store().push({ data: { id: 1, type: 'role', attributes: { name: 'Owner' } } });
                model.set('role', role);
            });
            expect(model.get('isOwner')).to.be.ok;
            expect(model.get('isAuthor')).to.not.be.ok;
            expect(model.get('isAdmin')).to.not.be.ok;
            expect(model.get('isEditor')).to.not.be.ok;
        });
    });
});
define('ghost-admin/tests/unit/models/user-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/models/user-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/routes/subscribers-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Route: subscribers', function () {
        (0, _emberMocha.setupTest)('route:subscribers', {
            needs: ['service:notifications']
        });

        (0, _mocha.it)('exists', function () {
            var route = this.subject();
            (0, _chai.expect)(route).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/routes/subscribers-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/routes/subscribers-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/routes/subscribers/import-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Route: subscribers/import', function () {
        (0, _emberMocha.setupTest)('route:subscribers/import', {
            // Specify the other units that are required for this test.
            needs: ['service:notifications']
        });

        (0, _mocha.it)('exists', function () {
            var route = this.subject();
            (0, _chai.expect)(route).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/routes/subscribers/import-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/routes/subscribers/import-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/routes/subscribers/new-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Route: subscribers/new', function () {
        (0, _emberMocha.setupTest)('route:subscribers/new', {
            needs: ['service:notifications']
        });

        (0, _mocha.it)('exists', function () {
            var route = this.subject();
            (0, _chai.expect)(route).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/routes/subscribers/new-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/routes/subscribers/new-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/serializers/notification-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'pretender'], function (exports, _chai, _mocha, _emberMocha, _pretender) {

    (0, _mocha.describe)('Unit: Serializer: notification', function () {
        (0, _emberMocha.setupModelTest)('notification', {
            // Specify the other units that are required for this test.
            needs: ['serializer:notification']
        });

        var server = undefined;

        beforeEach(function () {
            server = new _pretender['default']();
        });

        afterEach(function () {
            server.shutdown();
        });

        (0, _mocha.it)('converts location->key when deserializing', function () {
            server.get('/notifications', function () {
                var response = {
                    notifications: [{
                        id: 1,
                        dismissible: false,
                        status: 'alert',
                        type: 'info',
                        location: 'test.foo',
                        message: 'This is a test'
                    }]
                };

                return [200, { 'Content-Type': 'application/json' }, JSON.stringify(response)];
            });

            return this.store().findAll('notification').then(function (notifications) {
                (0, _chai.expect)(notifications.get('length')).to.equal(1);
                (0, _chai.expect)(notifications.get('firstObject.key')).to.equal('test.foo');
            });
        });
    });
});
define('ghost-admin/tests/unit/serializers/notification-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/serializers/notification-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/serializers/post-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit:Serializer: post', function () {
        (0, _emberMocha.setupModelTest)('post', {
            // Specify the other units that are required for this test.
            needs: ['transform:moment-utc', 'transform:json-string', 'model:user', 'model:tag']
        });

        // Replace this with your real tests.
        (0, _mocha.it)('serializes records', function () {
            var record = this.subject();

            var serializedRecord = record.serialize();

            (0, _chai.expect)(serializedRecord).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/serializers/post-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/serializers/post-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/serializers/role-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit:Serializer: role', function () {
        (0, _emberMocha.setupModelTest)('role', {
            // Specify the other units that are required for this test.
            needs: ['transform:moment-utc']
        });

        // Replace this with your real tests.
        (0, _mocha.it)('serializes records', function () {
            var record = this.subject();

            var serializedRecord = record.serialize();

            (0, _chai.expect)(serializedRecord).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/serializers/role-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/serializers/role-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/serializers/setting-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit:Serializer: setting', function () {
        (0, _emberMocha.setupModelTest)('setting', {
            // Specify the other units that are required for this test.
            needs: ['transform:moment-utc', 'transform:facebook-url-user', 'transform:twitter-url-user', 'transform:navigation-settings', 'transform:slack-settings']
        });

        // Replace this with your real tests.
        (0, _mocha.it)('serializes records', function () {
            var record = this.subject();

            var serializedRecord = record.serialize();

            (0, _chai.expect)(serializedRecord).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/serializers/setting-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/serializers/setting-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/serializers/subscriber-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit:Serializer: subscriber', function () {
        (0, _emberMocha.setupModelTest)('subscriber', {
            // Specify the other units that are required for this test.
            needs: ['model:post', 'transform:moment-utc']
        });

        // Replace this with your real tests.
        (0, _mocha.it)('serializes records', function () {
            var record = this.subject();

            var serializedRecord = record.serialize();

            (0, _chai.expect)(serializedRecord).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/serializers/subscriber-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/serializers/subscriber-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/serializers/tag-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit:Serializer: tag', function () {
        (0, _emberMocha.setupModelTest)('tag', {
            // Specify the other units that are required for this test.
            needs: ['transform:moment-utc', 'transform:raw']
        });

        // Replace this with your real tests.
        (0, _mocha.it)('serializes records', function () {
            var record = this.subject();

            var serializedRecord = record.serialize();

            (0, _chai.expect)(serializedRecord).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/serializers/tag-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/serializers/tag-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/serializers/user-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit:Serializer: user', function () {
        (0, _emberMocha.setupModelTest)('user', {
            // Specify the other units that are required for this test.
            needs: ['transform:moment-utc', 'transform:raw', 'transform:facebook-url-user', 'transform:twitter-url-user', 'model:role']
        });

        // Replace this with your real tests.
        (0, _mocha.it)('serializes records', function () {
            var record = this.subject();

            var serializedRecord = record.serialize();

            (0, _chai.expect)(serializedRecord).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/serializers/user-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/serializers/user-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/services/config-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Service: config', function () {
        (0, _emberMocha.setupTest)('service:config', {});
        // Replace this with your real tests.
        (0, _mocha.it)('exists', function () {
            var service = this.subject();
            (0, _chai.expect)(service).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/services/config-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/services/config-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/services/event-bus-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'sinon'], function (exports, _chai, _mocha, _emberMocha, _sinon) {

    (0, _mocha.describe)('Unit: Service: event-bus', function () {
        (0, _emberMocha.setupTest)('service:event-bus', {});
        (0, _mocha.it)('works', function () {
            var service = this.subject();
            var eventHandler = _sinon['default'].spy();

            service.subscribe('test-event', eventHandler);

            service.publish('test-event', 'test');

            service.unsubscribe('test-event', eventHandler);

            service.publish('test-event', 'test two');

            (0, _chai.expect)(eventHandler.calledOnce, 'event handler only triggered once').to.be['true'];

            (0, _chai.expect)(eventHandler.calledWith('test'), 'event handler was passed correct arguments').to.be['true'];
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/services/event-bus-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/services/event-bus-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/services/notifications-test', ['exports', 'ember-runloop', 'ember-metal/get', 'ember-array/utils', 'ember-object', 'sinon', 'chai', 'mocha', 'ember-mocha', 'ember-ajax/errors', 'ghost-admin/services/ajax'], function (exports, _emberRunloop, _emberMetalGet, _emberArrayUtils, _emberObject, _sinon, _chai, _mocha, _emberMocha, _emberAjaxErrors, _ghostAdminServicesAjax) {
    var _slicedToArray = (function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i['return']) _i['return'](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError('Invalid attempt to destructure non-iterable instance'); } }; })();

    (0, _mocha.describe)('Unit: Service: notifications', function () {
        (0, _emberMocha.setupTest)('service:notifications', {});
        beforeEach(function () {
            this.subject().set('content', (0, _emberArrayUtils.A)());
            this.subject().set('delayedNotifications', (0, _emberArrayUtils.A)());
        });

        (0, _mocha.it)('filters alerts/notifications', function () {
            var notifications = this.subject();

            // wrapped in run-loop to enure alerts/notifications CPs are updated
            (0, _emberRunloop['default'])(function () {
                notifications.showAlert('Alert');
                notifications.showNotification('Notification');
            });

            (0, _chai.expect)(notifications.get('alerts.length')).to.equal(1);
            (0, _chai.expect)(notifications.get('alerts.firstObject.message')).to.equal('Alert');

            (0, _chai.expect)(notifications.get('notifications.length')).to.equal(1);
            (0, _chai.expect)(notifications.get('notifications.firstObject.message')).to.equal('Notification');
        });

        (0, _mocha.it)('#handleNotification deals with DS.Notification notifications', function () {
            var notifications = this.subject();
            var notification = _emberObject['default'].create({ message: '<h1>Test</h1>', status: 'alert' });

            notification.toJSON = function () {};

            notifications.handleNotification(notification);

            notification = notifications.get('alerts')[0];

            // alerts received from the server should be marked html safe
            (0, _chai.expect)(notification.get('message')).to.have.property('toHTML');
        });

        (0, _mocha.it)('#handleNotification defaults to notification if no status supplied', function () {
            var notifications = this.subject();

            notifications.handleNotification({ message: 'Test' }, false);

            (0, _chai.expect)(notifications.get('content')).to.deep.include({ message: 'Test', status: 'notification' });
        });

        (0, _mocha.it)('#showAlert adds POJO alerts', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showAlert('Test Alert', { type: 'error' });
            });

            (0, _chai.expect)(notifications.get('alerts')).to.deep.include({ message: 'Test Alert', status: 'alert', type: 'error', key: undefined });
        });

        (0, _mocha.it)('#showAlert adds delayed notifications', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showNotification('Test Alert', { type: 'error', delayed: true });
            });

            (0, _chai.expect)(notifications.get('delayedNotifications')).to.deep.include({ message: 'Test Alert', status: 'notification', type: 'error', key: undefined });
        });

        // in order to cater for complex keys that are suitable for i18n
        // we split on the second period and treat the resulting base as
        // the key for duplicate checking
        (0, _mocha.it)('#showAlert clears duplicates', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showAlert('Kept');
                notifications.showAlert('Duplicate', { key: 'duplicate.key.fail' });
            });

            (0, _chai.expect)(notifications.get('alerts.length')).to.equal(2);

            (0, _emberRunloop['default'])(function () {
                notifications.showAlert('Duplicate with new message', { key: 'duplicate.key.success' });
            });

            (0, _chai.expect)(notifications.get('alerts.length')).to.equal(2);
            (0, _chai.expect)(notifications.get('alerts.lastObject.message')).to.equal('Duplicate with new message');
        });

        (0, _mocha.it)('#showNotification adds POJO notifications', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showNotification('Test Notification', { type: 'success' });
            });

            (0, _chai.expect)(notifications.get('notifications')).to.deep.include({ message: 'Test Notification', status: 'notification', type: 'success', key: undefined });
        });

        (0, _mocha.it)('#showNotification adds delayed notifications', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showNotification('Test Notification', { delayed: true });
            });

            (0, _chai.expect)(notifications.get('delayedNotifications')).to.deep.include({ message: 'Test Notification', status: 'notification', type: undefined, key: undefined });
        });

        (0, _mocha.it)('#showNotification clears existing notifications', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showNotification('First');
                notifications.showNotification('Second');
            });

            (0, _chai.expect)(notifications.get('notifications.length')).to.equal(1);
            (0, _chai.expect)(notifications.get('notifications')).to.deep.equal([{ message: 'Second', status: 'notification', type: undefined, key: undefined }]);
        });

        (0, _mocha.it)('#showNotification keeps existing notifications if doNotCloseNotifications option passed', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showNotification('First');
                notifications.showNotification('Second', { doNotCloseNotifications: true });
            });

            (0, _chai.expect)(notifications.get('notifications.length')).to.equal(2);
        });

        (0, _mocha.it)('#showAPIError handles single json response error', function () {
            var notifications = this.subject();
            var error = new _emberAjaxErrors.AjaxError([{ message: 'Single error' }]);

            (0, _emberRunloop['default'])(function () {
                notifications.showAPIError(error);
            });

            var alert = notifications.get('alerts.firstObject');
            (0, _chai.expect)((0, _emberMetalGet['default'])(alert, 'message')).to.equal('Single error');
            (0, _chai.expect)((0, _emberMetalGet['default'])(alert, 'status')).to.equal('alert');
            (0, _chai.expect)((0, _emberMetalGet['default'])(alert, 'type')).to.equal('error');
            (0, _chai.expect)((0, _emberMetalGet['default'])(alert, 'key')).to.equal('api-error');
        });

        (0, _mocha.it)('#showAPIError handles multiple json response errors', function () {
            var notifications = this.subject();
            var error = new _emberAjaxErrors.AjaxError([{ title: 'First error', message: 'First error message' }, { title: 'Second error', message: 'Second error message' }]);

            (0, _emberRunloop['default'])(function () {
                notifications.showAPIError(error);
            });

            (0, _chai.expect)(notifications.get('alerts.length')).to.equal(2);

            var _notifications$get = notifications.get('alerts');

            var _notifications$get2 = _slicedToArray(_notifications$get, 2);

            var alert1 = _notifications$get2[0];
            var alert2 = _notifications$get2[1];

            (0, _chai.expect)(alert1).to.deep.equal({ message: 'First error message', status: 'alert', type: 'error', key: 'api-error.first-error' });
            (0, _chai.expect)(alert2).to.deep.equal({ message: 'Second error message', status: 'alert', type: 'error', key: 'api-error.second-error' });
        });

        (0, _mocha.it)('#showAPIError displays default error text if response has no error/message', function () {
            var notifications = this.subject();
            var resp = false;

            (0, _emberRunloop['default'])(function () {
                notifications.showAPIError(resp);
            });

            (0, _chai.expect)(notifications.get('content').toArray()).to.deep.equal([{ message: 'There was a problem on the server, please try again.', status: 'alert', type: 'error', key: 'api-error' }]);

            notifications.set('content', (0, _emberArrayUtils.A)());

            (0, _emberRunloop['default'])(function () {
                notifications.showAPIError(resp, { defaultErrorText: 'Overridden default' });
            });
            (0, _chai.expect)(notifications.get('content').toArray()).to.deep.equal([{ message: 'Overridden default', status: 'alert', type: 'error', key: 'api-error' }]);
        });

        (0, _mocha.it)('#showAPIError sets correct key when passed a base key', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showAPIError('Test', { key: 'test.alert' });
            });

            (0, _chai.expect)(notifications.get('alerts.firstObject.key')).to.equal('api-error.test.alert');
        });

        (0, _mocha.it)('#showAPIError sets correct key when not passed a key', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showAPIError('Test');
            });

            (0, _chai.expect)(notifications.get('alerts.firstObject.key')).to.equal('api-error');
        });

        (0, _mocha.it)('#showAPIError parses default ember-ajax errors correctly', function () {
            var notifications = this.subject();
            var error = new _emberAjaxErrors.InvalidError();

            (0, _emberRunloop['default'])(function () {
                notifications.showAPIError(error);
            });

            var notification = notifications.get('alerts.firstObject');
            (0, _chai.expect)((0, _emberMetalGet['default'])(notification, 'message')).to.equal('Request was rejected because it was invalid');
            (0, _chai.expect)((0, _emberMetalGet['default'])(notification, 'status')).to.equal('alert');
            (0, _chai.expect)((0, _emberMetalGet['default'])(notification, 'type')).to.equal('error');
            (0, _chai.expect)((0, _emberMetalGet['default'])(notification, 'key')).to.equal('api-error.ajax-error');
        });

        (0, _mocha.it)('#showAPIError parses custom ember-ajax errors correctly', function () {
            var notifications = this.subject();
            var error = new _ghostAdminServicesAjax.ServerUnreachableError();

            (0, _emberRunloop['default'])(function () {
                notifications.showAPIError(error);
            });

            var notification = notifications.get('alerts.firstObject');
            (0, _chai.expect)((0, _emberMetalGet['default'])(notification, 'message')).to.equal('Server was unreachable');
            (0, _chai.expect)((0, _emberMetalGet['default'])(notification, 'status')).to.equal('alert');
            (0, _chai.expect)((0, _emberMetalGet['default'])(notification, 'type')).to.equal('error');
            (0, _chai.expect)((0, _emberMetalGet['default'])(notification, 'key')).to.equal('api-error.ajax-error');
        });

        (0, _mocha.it)('#displayDelayed moves delayed notifications into content', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showNotification('First', { delayed: true });
                notifications.showNotification('Second', { delayed: true });
                notifications.showNotification('Third', { delayed: false });
                notifications.displayDelayed();
            });

            (0, _chai.expect)(notifications.get('notifications')).to.deep.equal([{ message: 'Third', status: 'notification', type: undefined, key: undefined }, { message: 'First', status: 'notification', type: undefined, key: undefined }, { message: 'Second', status: 'notification', type: undefined, key: undefined }]);
        });

        (0, _mocha.it)('#closeNotification removes POJO notifications', function () {
            var notification = { message: 'Close test', status: 'notification' };
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.handleNotification(notification);
            });

            (0, _chai.expect)(notifications.get('notifications')).to.include(notification);

            (0, _emberRunloop['default'])(function () {
                notifications.closeNotification(notification);
            });

            (0, _chai.expect)(notifications.get('notifications')).to.not.include(notification);
        });

        (0, _mocha.it)('#closeNotification removes and deletes DS.Notification records', function () {
            var notification = _emberObject['default'].create({ message: 'Close test', status: 'alert' });
            var notifications = this.subject();

            notification.toJSON = function () {};
            notification.deleteRecord = function () {};
            _sinon['default'].spy(notification, 'deleteRecord');
            notification.save = function () {
                return {
                    'finally': function _finally(callback) {
                        return callback(notification);
                    }
                };
            };
            _sinon['default'].spy(notification, 'save');

            (0, _emberRunloop['default'])(function () {
                notifications.handleNotification(notification);
            });

            (0, _chai.expect)(notifications.get('alerts')).to.include(notification);

            (0, _emberRunloop['default'])(function () {
                notifications.closeNotification(notification);
            });

            (0, _chai.expect)(notification.deleteRecord.calledOnce).to.be['true'];
            (0, _chai.expect)(notification.save.calledOnce).to.be['true'];

            (0, _chai.expect)(notifications.get('alerts')).to.not.include(notification);
        });

        (0, _mocha.it)('#closeNotifications only removes notifications', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showAlert('First alert');
                notifications.showNotification('First notification');
                notifications.showNotification('Second notification', { doNotCloseNotifications: true });
            });

            (0, _chai.expect)(notifications.get('alerts.length'), 'alerts count').to.equal(1);
            (0, _chai.expect)(notifications.get('notifications.length'), 'notifications count').to.equal(2);

            (0, _emberRunloop['default'])(function () {
                notifications.closeNotifications();
            });

            (0, _chai.expect)(notifications.get('alerts.length'), 'alerts count').to.equal(1);
            (0, _chai.expect)(notifications.get('notifications.length'), 'notifications count').to.equal(0);
        });

        (0, _mocha.it)('#closeNotifications only closes notifications with specified key', function () {
            var notifications = this.subject();

            (0, _emberRunloop['default'])(function () {
                notifications.showAlert('First alert');
                // using handleNotification as showNotification will auto-prune
                // duplicates and keys will be removed if doNotCloseNotifications
                // is true
                notifications.handleNotification({ message: 'First notification', key: 'test.close', status: 'notification' });
                notifications.handleNotification({ message: 'Second notification', key: 'test.keep', status: 'notification' });
                notifications.handleNotification({ message: 'Third notification', key: 'test.close', status: 'notification' });
            });

            (0, _emberRunloop['default'])(function () {
                notifications.closeNotifications('test.close');
            });

            (0, _chai.expect)(notifications.get('notifications.length'), 'notifications count').to.equal(1);
            (0, _chai.expect)(notifications.get('notifications.firstObject.message'), 'notification message').to.equal('Second notification');
            (0, _chai.expect)(notifications.get('alerts.length'), 'alerts count').to.equal(1);
        });

        (0, _mocha.it)('#clearAll removes everything without deletion', function () {
            var notifications = this.subject();
            var notificationModel = _emberObject['default'].create({ message: 'model' });

            notificationModel.toJSON = function () {};
            notificationModel.deleteRecord = function () {};
            _sinon['default'].spy(notificationModel, 'deleteRecord');
            notificationModel.save = function () {
                return {
                    'finally': function _finally(callback) {
                        return callback(notificationModel);
                    }
                };
            };
            _sinon['default'].spy(notificationModel, 'save');

            notifications.handleNotification(notificationModel);
            notifications.handleNotification({ message: 'pojo' });

            notifications.clearAll();

            (0, _chai.expect)(notifications.get('content')).to.be.empty;
            (0, _chai.expect)(notificationModel.deleteRecord.called).to.be['false'];
            (0, _chai.expect)(notificationModel.save.called).to.be['false'];
        });

        (0, _mocha.it)('#closeAlerts only removes alerts', function () {
            var notifications = this.subject();

            notifications.showNotification('First notification');
            notifications.showAlert('First alert');
            notifications.showAlert('Second alert');

            (0, _emberRunloop['default'])(function () {
                notifications.closeAlerts();
            });

            (0, _chai.expect)(notifications.get('alerts.length')).to.equal(0);
            (0, _chai.expect)(notifications.get('notifications.length')).to.equal(1);
        });

        (0, _mocha.it)('#closeAlerts closes only alerts with specified key', function () {
            var notifications = this.subject();

            notifications.showNotification('First notification');
            notifications.showAlert('First alert', { key: 'test.close' });
            notifications.showAlert('Second alert', { key: 'test.keep' });
            notifications.showAlert('Third alert', { key: 'test.close' });

            (0, _emberRunloop['default'])(function () {
                notifications.closeAlerts('test.close');
            });

            (0, _chai.expect)(notifications.get('alerts.length')).to.equal(1);
            (0, _chai.expect)(notifications.get('alerts.firstObject.message')).to.equal('Second alert');
            (0, _chai.expect)(notifications.get('notifications.length')).to.equal(1);
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/services/notifications-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/services/notifications-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/services/upgrade-status-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('UpgradeStatusService', function () {
        (0, _emberMocha.setupTest)('service:upgrade-status', {
            // Specify the other units that are required for this test.
            // needs: ['service:foo']
            needs: []
        });

        // Replace this with your real tests.
        (0, _mocha.it)('exists', function () {
            var service = this.subject();
            (0, _chai.expect)(service).to.be.ok;
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/services/upgrade-status-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/services/upgrade-status-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/transforms/facebook-url-user-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Transform: facebook-url-user', function () {
        (0, _emberMocha.setupTest)('transform:facebook-url-user', {});
        (0, _mocha.it)('deserializes facebook url', function () {
            var transform = this.subject();
            var serialized = 'testuser';
            var result = transform.deserialize(serialized);

            (0, _chai.expect)(result).to.equal('https://www.facebook.com/testuser');
        });

        (0, _mocha.it)('serializes url to facebook username', function () {
            var transform = this.subject();
            var deserialized = 'https://www.facebook.com/testuser';
            var result = transform.serialize(deserialized);

            (0, _chai.expect)(result).to.equal('testuser');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/transforms/facebook-url-user-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/transforms/facebook-url-user-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/transforms/json-string-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Transform: json-string', function () {
        (0, _emberMocha.setupTest)('transform:json-string', {});
        (0, _mocha.it)('exists', function () {
            var transform = this.subject();
            (0, _chai.expect)(transform).to.be.ok;
        });

        (0, _mocha.it)('serialises an Object to a JSON String', function () {
            var transform = this.subject();
            var obj = { one: 'one', two: 'two' };
            (0, _chai.expect)(transform.serialize(obj)).to.equal(JSON.stringify(obj));
        });

        (0, _mocha.it)('deserialises a JSON String to an Object', function () {
            var transform = this.subject();
            var obj = { one: 'one', two: 'two' };
            (0, _chai.expect)(transform.deserialize(JSON.stringify(obj))).to.deep.equal(obj);
        });
    });
});
define('ghost-admin/tests/unit/transforms/json-string-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/transforms/json-string-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/transforms/navigation-settings-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-array/utils', 'ghost-admin/models/navigation-item'], function (exports, _chai, _mocha, _emberMocha, _emberArrayUtils, _ghostAdminModelsNavigationItem) {

    (0, _mocha.describe)('Unit: Transform: navigation-settings', function () {
        (0, _emberMocha.setupTest)('transform:navigation-settings', {});
        (0, _mocha.it)('deserializes navigation json', function () {
            var transform = this.subject();
            var serialized = '[{"label":"One","url":"/one"},{"label":"Two","url":"/two"}]';
            var result = transform.deserialize(serialized);

            (0, _chai.expect)(result.length).to.equal(2);
            (0, _chai.expect)(result[0]).to.be['instanceof'](_ghostAdminModelsNavigationItem['default']);
            (0, _chai.expect)(result[0].get('label')).to.equal('One');
            (0, _chai.expect)(result[0].get('url')).to.equal('/one');
            (0, _chai.expect)(result[1]).to.be['instanceof'](_ghostAdminModelsNavigationItem['default']);
            (0, _chai.expect)(result[1].get('label')).to.equal('Two');
            (0, _chai.expect)(result[1].get('url')).to.equal('/two');
        });

        (0, _mocha.it)('serializes array of NavigationItems', function () {
            var transform = this.subject();
            var deserialized = (0, _emberArrayUtils.A)([_ghostAdminModelsNavigationItem['default'].create({ label: 'One', url: '/one' }), _ghostAdminModelsNavigationItem['default'].create({ label: 'Two', url: '/two' })]);
            var result = transform.serialize(deserialized);

            (0, _chai.expect)(result).to.equal('[{"label":"One","url":"/one"},{"label":"Two","url":"/two"}]');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/transforms/navigation-settings-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/transforms/navigation-settings-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/transforms/slack-settings-test', ['exports', 'chai', 'mocha', 'ember-mocha', 'ember-array/utils', 'ghost-admin/models/slack-integration'], function (exports, _chai, _mocha, _emberMocha, _emberArrayUtils, _ghostAdminModelsSlackIntegration) {

    (0, _mocha.describe)('Unit: Transform: slack-settings', function () {
        (0, _emberMocha.setupTest)('transform:slack-settings', {});
        (0, _mocha.it)('deserializes settings json', function () {
            var transform = this.subject();
            var serialized = '[{"url":"http://myblog.com/blogpost1"}]';
            var result = transform.deserialize(serialized);

            (0, _chai.expect)(result.length).to.equal(1);
            (0, _chai.expect)(result[0]).to.be['instanceof'](_ghostAdminModelsSlackIntegration['default']);
            (0, _chai.expect)(result[0].get('url')).to.equal('http://myblog.com/blogpost1');
        });

        (0, _mocha.it)('serializes array of Slack settings', function () {
            var transform = this.subject();
            var deserialized = (0, _emberArrayUtils.A)([_ghostAdminModelsSlackIntegration['default'].create({ url: 'http://myblog.com/blogpost1' })]);
            var result = transform.serialize(deserialized);

            (0, _chai.expect)(result).to.equal('[{"url":"http://myblog.com/blogpost1"}]');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/transforms/slack-settings-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/transforms/slack-settings-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/transforms/twitter-url-user-test', ['exports', 'chai', 'mocha', 'ember-mocha'], function (exports, _chai, _mocha, _emberMocha) {

    (0, _mocha.describe)('Unit: Transform: twitter-url-user', function () {
        (0, _emberMocha.setupTest)('transform:twitter-url-user', {});
        (0, _mocha.it)('deserializes twitter url', function () {
            var transform = this.subject();
            var serialized = '@testuser';
            var result = transform.deserialize(serialized);

            (0, _chai.expect)(result).to.equal('https://twitter.com/testuser');
        });

        (0, _mocha.it)('serializes url to twitter username', function () {
            var transform = this.subject();
            var deserialized = 'https://twitter.com/testuser';
            var result = transform.serialize(deserialized);

            (0, _chai.expect)(result).to.equal('@testuser');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/transforms/twitter-url-user-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/transforms/twitter-url-user-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/utils/date-formatting-test', ['exports'], function (exports) {
    // import {formatDate, parseDateString} from 'ghost-admin/utils/date-formatting';

    describe('Unit: Util: date-formatting', function () {
        it('parses a string into a moment');
        it('formats a date or moment');
    });
});
define('ghost-admin/tests/unit/utils/date-formatting-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/utils/date-formatting-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/utils/ghost-paths-test', ['exports', 'ghost-admin/utils/ghost-paths'], function (exports, _ghostAdminUtilsGhostPaths) {

    describe('Unit: Util: ghost-paths', function () {
        describe('join', function () {
            var join = (0, _ghostAdminUtilsGhostPaths['default'])().url.join;

            it('should join two or more paths, normalizing slashes', function () {
                var path = undefined;

                path = join('/one/', '/two/');
                expect(path).to.equal('/one/two/');

                path = join('/one', '/two/');
                expect(path).to.equal('/one/two/');

                path = join('/one/', 'two/');
                expect(path).to.equal('/one/two/');

                path = join('/one/', 'two/', '/three/');
                expect(path).to.equal('/one/two/three/');

                path = join('/one/', 'two', 'three/');
                expect(path).to.equal('/one/two/three/');
            });

            it('should not change the slash at the beginning', function () {
                var path = undefined;

                path = join('one/');
                expect(path).to.equal('one/');
                path = join('one/', 'two');
                expect(path).to.equal('one/two/');
                path = join('/one/', 'two');
                expect(path).to.equal('/one/two/');
                path = join('one/', 'two', 'three');
                expect(path).to.equal('one/two/three/');
                path = join('/one/', 'two', 'three');
                expect(path).to.equal('/one/two/three/');
            });

            it('should always return a slash at the end', function () {
                var path = undefined;

                path = join();
                expect(path).to.equal('/');
                path = join('');
                expect(path).to.equal('/');
                path = join('one');
                expect(path).to.equal('one/');
                path = join('one/');
                expect(path).to.equal('one/');
                path = join('one', 'two');
                expect(path).to.equal('one/two/');
                path = join('one', 'two/');
                expect(path).to.equal('one/two/');
            });
        });
    });
});
define('ghost-admin/tests/unit/utils/ghost-paths-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/utils/ghost-paths-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/validators/nav-item-test', ['exports', 'chai', 'mocha', 'ghost-admin/validators/nav-item', 'ghost-admin/models/navigation-item'], function (exports, _chai, _mocha, _ghostAdminValidatorsNavItem, _ghostAdminModelsNavigationItem) {

    var testInvalidUrl = function testInvalidUrl(url) {
        var navItem = _ghostAdminModelsNavigationItem['default'].create({ url: url });

        _ghostAdminValidatorsNavItem['default'].check(navItem, 'url');

        (0, _chai.expect)(_ghostAdminValidatorsNavItem['default'].get('passed'), '"' + url + '" passed').to.be['false'];
        (0, _chai.expect)(navItem.get('errors').errorsFor('url').toArray()).to.deep.equal([{
            attribute: 'url',
            message: 'You must specify a valid URL or relative path'
        }]);
        (0, _chai.expect)(navItem.get('hasValidated')).to.include('url');
    };

    var testValidUrl = function testValidUrl(url) {
        var navItem = _ghostAdminModelsNavigationItem['default'].create({ url: url });

        _ghostAdminValidatorsNavItem['default'].check(navItem, 'url');

        (0, _chai.expect)(_ghostAdminValidatorsNavItem['default'].get('passed'), '"' + url + '" failed').to.be['true'];
        (0, _chai.expect)(navItem.get('hasValidated')).to.include('url');
    };

    (0, _mocha.describe)('Unit: Validator: nav-item', function () {
        (0, _mocha.it)('requires label presence', function () {
            var navItem = _ghostAdminModelsNavigationItem['default'].create();

            _ghostAdminValidatorsNavItem['default'].check(navItem, 'label');

            (0, _chai.expect)(_ghostAdminValidatorsNavItem['default'].get('passed')).to.be['false'];
            (0, _chai.expect)(navItem.get('errors').errorsFor('label').toArray()).to.deep.equal([{
                attribute: 'label',
                message: 'You must specify a label'
            }]);
            (0, _chai.expect)(navItem.get('hasValidated')).to.include('label');
        });

        (0, _mocha.it)('requires url presence', function () {
            var navItem = _ghostAdminModelsNavigationItem['default'].create();

            _ghostAdminValidatorsNavItem['default'].check(navItem, 'url');

            (0, _chai.expect)(_ghostAdminValidatorsNavItem['default'].get('passed')).to.be['false'];
            (0, _chai.expect)(navItem.get('errors').errorsFor('url').toArray()).to.deep.equal([{
                attribute: 'url',
                message: 'You must specify a URL or relative path'
            }]);
            (0, _chai.expect)(navItem.get('hasValidated')).to.include('url');
        });

        (0, _mocha.it)('fails on invalid url values', function () {
            var invalidUrls = ['test@example.com', '/has spaces', 'no-leading-slash', 'http://example.com/with spaces'];

            invalidUrls.forEach(function (url) {
                testInvalidUrl(url);
            });
        });

        (0, _mocha.it)('passes on valid url values', function () {
            var validUrls = ['http://localhost:2368', 'http://localhost:2368/some-path', 'https://localhost:2368/some-path', '//localhost:2368/some-path', 'http://localhost:2368/#test', 'http://localhost:2368/?query=test&another=example', 'http://localhost:2368/?query=test&another=example#test', 'tel:01234-567890', 'mailto:test@example.com', 'http://some:user@example.com:1234', '/relative/path'];

            validUrls.forEach(function (url) {
                testValidUrl(url);
            });
        });

        (0, _mocha.it)('validates url and label by default', function () {
            var navItem = _ghostAdminModelsNavigationItem['default'].create();

            _ghostAdminValidatorsNavItem['default'].check(navItem);

            (0, _chai.expect)(navItem.get('errors').errorsFor('label')).to.not.be.empty;
            (0, _chai.expect)(navItem.get('errors').errorsFor('url')).to.not.be.empty;
            (0, _chai.expect)(_ghostAdminValidatorsNavItem['default'].get('passed')).to.be['false'];
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/validators/nav-item-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/validators/nav-item-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/validators/slack-integration-test', ['exports', 'chai', 'mocha', 'ghost-admin/validators/slack-integration', 'ghost-admin/models/slack-integration'], function (exports, _chai, _mocha, _ghostAdminValidatorsSlackIntegration, _ghostAdminModelsSlackIntegration) {

    var testInvalidUrl = function testInvalidUrl(url) {
        var slackObject = _ghostAdminModelsSlackIntegration['default'].create({ url: url });

        _ghostAdminValidatorsSlackIntegration['default'].check(slackObject, 'url');

        (0, _chai.expect)(_ghostAdminValidatorsSlackIntegration['default'].get('passed'), '"' + url + '" passed').to.be['false'];
        (0, _chai.expect)(slackObject.get('errors').errorsFor('url').toArray()).to.deep.equal([{
            attribute: 'url',
            message: 'The URL must be in a format like https://hooks.slack.com/services/<your personal key>'
        }]);
        (0, _chai.expect)(slackObject.get('hasValidated')).to.include('url');
    };

    var testValidUrl = function testValidUrl(url) {
        var slackObject = _ghostAdminModelsSlackIntegration['default'].create({ url: url });

        _ghostAdminValidatorsSlackIntegration['default'].check(slackObject, 'url');

        (0, _chai.expect)(_ghostAdminValidatorsSlackIntegration['default'].get('passed'), '"' + url + '" failed').to.be['true'];
        (0, _chai.expect)(slackObject.get('hasValidated')).to.include('url');
    };

    (0, _mocha.describe)('Unit: Validator: slack-integration', function () {
        (0, _mocha.it)('fails on invalid url values', function () {
            var invalidUrls = ['test@example.com', '/has spaces', 'no-leading-slash', 'http://example.com/with spaces'];

            invalidUrls.forEach(function (url) {
                testInvalidUrl(url);
            });
        });

        (0, _mocha.it)('passes on valid url values', function () {
            var validUrls = ['https://hooks.slack.com/services/;alskdjf', 'https://hooks.slack.com/services/123445678', 'https://hooks.slack.com/services/some_webhook'];

            validUrls.forEach(function (url) {
                testValidUrl(url);
            });
        });

        (0, _mocha.it)('validates url by default', function () {
            var slackObject = _ghostAdminModelsSlackIntegration['default'].create();

            _ghostAdminValidatorsSlackIntegration['default'].check(slackObject);

            (0, _chai.expect)(slackObject.get('errors').errorsFor('url')).to.be.empty;
            (0, _chai.expect)(_ghostAdminValidatorsSlackIntegration['default'].get('passed')).to.be['true'];
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/validators/slack-integration-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/validators/slack-integration-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/validators/subscriber-test', ['exports', 'chai', 'mocha', 'ember', 'ghost-admin/mixins/validation-engine'], function (exports, _chai, _mocha, _ember, _ghostAdminMixinsValidationEngine) {
    var run = _ember['default'].run;
    var EmberObject = _ember['default'].Object;

    var Subscriber = EmberObject.extend(_ghostAdminMixinsValidationEngine['default'], {
        validationType: 'subscriber',

        email: null
    });

    (0, _mocha.describe)('Unit: Validator: subscriber', function () {
        (0, _mocha.it)('validates email by default', function () {
            var subscriber = Subscriber.create({});
            var properties = subscriber.get('validators.subscriber.properties');

            (0, _chai.expect)(properties, 'properties').to.include('email');
        });

        (0, _mocha.it)('passes with a valid email', function () {
            var subscriber = Subscriber.create({ email: 'test@example.com' });
            var passed = false;

            run(function () {
                subscriber.validate({ property: 'email' }).then(function () {
                    passed = true;
                });
            });

            (0, _chai.expect)(passed, 'passed').to.be['true'];
            (0, _chai.expect)(subscriber.get('hasValidated'), 'hasValidated').to.include('email');
        });

        (0, _mocha.it)('validates email presence', function () {
            var subscriber = Subscriber.create({});
            var passed = false;

            run(function () {
                subscriber.validate({ property: 'email' }).then(function () {
                    passed = true;
                });
            });

            var emailErrors = subscriber.get('errors').errorsFor('email').get(0);
            (0, _chai.expect)(emailErrors.attribute, 'errors.email.attribute').to.equal('email');
            (0, _chai.expect)(emailErrors.message, 'errors.email.message').to.equal('Please enter an email.');

            (0, _chai.expect)(passed, 'passed').to.be['false'];
            (0, _chai.expect)(subscriber.get('hasValidated'), 'hasValidated').to.include('email');
        });

        (0, _mocha.it)('validates email', function () {
            var subscriber = Subscriber.create({ email: 'foo' });
            var passed = false;

            run(function () {
                subscriber.validate({ property: 'email' }).then(function () {
                    passed = true;
                });
            });

            var emailErrors = subscriber.get('errors').errorsFor('email').get(0);
            (0, _chai.expect)(emailErrors.attribute, 'errors.email.attribute').to.equal('email');
            (0, _chai.expect)(emailErrors.message, 'errors.email.message').to.equal('Invalid email.');

            (0, _chai.expect)(passed, 'passed').to.be['false'];
            (0, _chai.expect)(subscriber.get('hasValidated'), 'hasValidated').to.include('email');
        });
    });
});
/* jshint expr:true */
define('ghost-admin/tests/unit/validators/subscriber-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/validators/subscriber-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/unit/validators/tag-settings-test', ['exports', 'chai', 'mocha', 'ember-runloop', 'ember-object', 'ghost-admin/mixins/validation-engine'], function (exports, _chai, _mocha, _emberRunloop, _emberObject, _ghostAdminMixinsValidationEngine) {

    var Tag = _emberObject['default'].extend(_ghostAdminMixinsValidationEngine['default'], {
        validationType: 'tag',

        name: null,
        description: null,
        metaTitle: null,
        metaDescription: null
    });

    // TODO: These tests have way too much duplication, consider creating test
    // helpers for validations

    // TODO: Move testing of validation-engine behaviour into validation-engine-test
    // and replace these tests with specific validator tests

    (0, _mocha.describe)('Unit: Validator: tag-settings', function () {
        (0, _mocha.it)('validates all fields by default', function () {
            var tag = Tag.create({});
            var properties = tag.get('validators.tag.properties');

            // TODO: This is checking implementation details rather than expected
            // behaviour. Replace once we have consistent behaviour (see below)
            (0, _chai.expect)(properties, 'properties').to.include('name');
            (0, _chai.expect)(properties, 'properties').to.include('slug');
            (0, _chai.expect)(properties, 'properties').to.include('description');
            (0, _chai.expect)(properties, 'properties').to.include('metaTitle');
            (0, _chai.expect)(properties, 'properties').to.include('metaDescription');

            // TODO: .validate (and  by extension .save) doesn't currently affect
            // .hasValidated - it would be good to make this consistent.
            // The following tests currently fail:
            //
            // run(() => {
            //     tag.validate();
            // });
            //
            // expect(tag.get('hasValidated'), 'hasValidated').to.include('name');
            // expect(tag.get('hasValidated'), 'hasValidated').to.include('description');
            // expect(tag.get('hasValidated'), 'hasValidated').to.include('metaTitle');
            // expect(tag.get('hasValidated'), 'hasValidated').to.include('metaDescription');
        });

        (0, _mocha.it)('passes with valid name', function () {
            // longest valid name
            var tag = Tag.create({ name: new Array(151).join('x') });
            var passed = false;

            (0, _chai.expect)(tag.get('name').length, 'name length').to.equal(150);

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'name' }).then(function () {
                    passed = true;
                });
            });

            (0, _chai.expect)(passed, 'passed').to.be['true'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('name');
        });

        (0, _mocha.it)('validates name presence', function () {
            var tag = Tag.create();
            var passed = false;
            var nameErrors = undefined;

            // TODO: validator is currently a singleton meaning state leaks
            // between all objects that use it. Each object should either
            // get it's own validator instance or validator objects should not
            // contain state. The following currently fails:
            //
            // let validator = tag.get('validators.tag')
            // expect(validator.get('passed'), 'passed').to.be.false;

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'name' }).then(function () {
                    passed = true;
                });
            });

            nameErrors = tag.get('errors').errorsFor('name').get(0);
            (0, _chai.expect)(nameErrors.attribute, 'errors.name.attribute').to.equal('name');
            (0, _chai.expect)(nameErrors.message, 'errors.name.message').to.equal('You must specify a name for the tag.');

            (0, _chai.expect)(passed, 'passed').to.be['false'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('name');
        });

        (0, _mocha.it)('validates names starting with a comma', function () {
            var tag = Tag.create({ name: ',test' });
            var passed = false;
            var nameErrors = undefined;

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'name' }).then(function () {
                    passed = true;
                });
            });

            nameErrors = tag.get('errors').errorsFor('name').get(0);
            (0, _chai.expect)(nameErrors.attribute, 'errors.name.attribute').to.equal('name');
            (0, _chai.expect)(nameErrors.message, 'errors.name.message').to.equal('Tag names can\'t start with commas.');

            (0, _chai.expect)(passed, 'passed').to.be['false'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('name');
        });

        (0, _mocha.it)('validates name length', function () {
            // shortest invalid name
            var tag = Tag.create({ name: new Array(152).join('x') });
            var passed = false;
            var nameErrors = undefined;

            (0, _chai.expect)(tag.get('name').length, 'name length').to.equal(151);

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'name' }).then(function () {
                    passed = true;
                });
            });

            nameErrors = tag.get('errors').errorsFor('name')[0];
            (0, _chai.expect)(nameErrors.attribute, 'errors.name.attribute').to.equal('name');
            (0, _chai.expect)(nameErrors.message, 'errors.name.message').to.equal('Tag names cannot be longer than 150 characters.');

            (0, _chai.expect)(passed, 'passed').to.be['false'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('name');
        });

        (0, _mocha.it)('passes with valid slug', function () {
            // longest valid slug
            var tag = Tag.create({ slug: new Array(151).join('x') });
            var passed = false;

            (0, _chai.expect)(tag.get('slug').length, 'slug length').to.equal(150);

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'slug' }).then(function () {
                    passed = true;
                });
            });

            (0, _chai.expect)(passed, 'passed').to.be['true'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('slug');
        });

        (0, _mocha.it)('validates slug length', function () {
            // shortest invalid slug
            var tag = Tag.create({ slug: new Array(152).join('x') });
            var passed = false;
            var slugErrors = undefined;

            (0, _chai.expect)(tag.get('slug').length, 'slug length').to.equal(151);

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'slug' }).then(function () {
                    passed = true;
                });
            });

            slugErrors = tag.get('errors').errorsFor('slug')[0];
            (0, _chai.expect)(slugErrors.attribute, 'errors.slug.attribute').to.equal('slug');
            (0, _chai.expect)(slugErrors.message, 'errors.slug.message').to.equal('URL cannot be longer than 150 characters.');

            (0, _chai.expect)(passed, 'passed').to.be['false'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('slug');
        });

        (0, _mocha.it)('passes with a valid description', function () {
            // longest valid description
            var tag = Tag.create({ description: new Array(201).join('x') });
            var passed = false;

            (0, _chai.expect)(tag.get('description').length, 'description length').to.equal(200);

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'description' }).then(function () {
                    passed = true;
                });
            });

            (0, _chai.expect)(passed, 'passed').to.be['true'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('description');
        });

        (0, _mocha.it)('validates description length', function () {
            // shortest invalid description
            var tag = Tag.create({ description: new Array(202).join('x') });
            var passed = false;
            var errors = undefined;

            (0, _chai.expect)(tag.get('description').length, 'description length').to.equal(201);

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'description' }).then(function () {
                    passed = true;
                });
            });

            errors = tag.get('errors').errorsFor('description')[0];
            (0, _chai.expect)(errors.attribute, 'errors.description.attribute').to.equal('description');
            (0, _chai.expect)(errors.message, 'errors.description.message').to.equal('Description cannot be longer than 200 characters.');

            // TODO: tag.errors appears to be a singleton and previous errors are
            // not cleared despite creating a new tag object
            //
            // console.log(JSON.stringify(tag.get('errors')));
            // expect(tag.get('errors.length')).to.equal(1);

            (0, _chai.expect)(passed, 'passed').to.be['false'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('description');
        });

        // TODO: we have both metaTitle and metaTitle property names on the
        // model/validator respectively - this should be standardised
        (0, _mocha.it)('passes with a valid metaTitle', function () {
            // longest valid metaTitle
            var tag = Tag.create({ metaTitle: new Array(151).join('x') });
            var passed = false;

            (0, _chai.expect)(tag.get('metaTitle').length, 'metaTitle length').to.equal(150);

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'metaTitle' }).then(function () {
                    passed = true;
                });
            });

            (0, _chai.expect)(passed, 'passed').to.be['true'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('metaTitle');
        });

        (0, _mocha.it)('validates metaTitle length', function () {
            // shortest invalid metaTitle
            var tag = Tag.create({ metaTitle: new Array(152).join('x') });
            var passed = false;
            var errors = undefined;

            (0, _chai.expect)(tag.get('metaTitle').length, 'metaTitle length').to.equal(151);

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'metaTitle' }).then(function () {
                    passed = true;
                });
            });

            errors = tag.get('errors').errorsFor('metaTitle')[0];
            (0, _chai.expect)(errors.attribute, 'errors.metaTitle.attribute').to.equal('metaTitle');
            (0, _chai.expect)(errors.message, 'errors.metaTitle.message').to.equal('Meta Title cannot be longer than 150 characters.');

            (0, _chai.expect)(passed, 'passed').to.be['false'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('metaTitle');
        });

        // TODO: we have both metaDescription and metaDescription property names on
        // the model/validator respectively - this should be standardised
        (0, _mocha.it)('passes with a valid metaDescription', function () {
            // longest valid description
            var tag = Tag.create({ metaDescription: new Array(201).join('x') });
            var passed = false;

            (0, _chai.expect)(tag.get('metaDescription').length, 'metaDescription length').to.equal(200);

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'metaDescription' }).then(function () {
                    passed = true;
                });
            });

            (0, _chai.expect)(passed, 'passed').to.be['true'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('metaDescription');
        });

        (0, _mocha.it)('validates metaDescription length', function () {
            // shortest invalid metaDescription
            var tag = Tag.create({ metaDescription: new Array(202).join('x') });
            var passed = false;
            var errors = undefined;

            (0, _chai.expect)(tag.get('metaDescription').length, 'metaDescription length').to.equal(201);

            (0, _emberRunloop['default'])(function () {
                tag.validate({ property: 'metaDescription' }).then(function () {
                    passed = true;
                });
            });

            errors = tag.get('errors').errorsFor('metaDescription')[0];
            (0, _chai.expect)(errors.attribute, 'errors.metaDescription.attribute').to.equal('metaDescription');
            (0, _chai.expect)(errors.message, 'errors.metaDescription.message').to.equal('Meta Description cannot be longer than 200 characters.');

            (0, _chai.expect)(passed, 'passed').to.be['false'];
            (0, _chai.expect)(tag.get('hasValidated'), 'hasValidated').to.include('metaDescription');
        });
    });
});
/* jshint expr:true */

// import validator from 'ghost-admin/validators/tag-settings';
define('ghost-admin/tests/unit/validators/tag-settings-test.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - unit/validators/tag-settings-test.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils', ['exports'], function (exports) {
    var editorShim = {
        range: {
            head: {
                section: {
                    renderNode: {
                        _element: {
                            tagName: 'P'
                        }
                    },
                    isBlank: false
                }
            }
        },
        cursorDidChange: function cursorDidChange() {}
    };
    exports.editorShim = editorShim;
});
define('ghost-admin/tests/utils/bound-one-way.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/bound-one-way.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/caja-sanitizers.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/caja-sanitizers.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/ctrl-or-cmd.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/ctrl-or-cmd.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/date-formatting.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/date-formatting.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/document-title.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/document-title.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/ed-image-manager.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/ed-image-manager.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/editor-shortcuts.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/editor-shortcuts.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/ghost-paths.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/ghost-paths.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/isFinite.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/isFinite.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/isNumber.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/isNumber.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/link-component.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/link-component.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/random-password.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/random-password.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/route.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/route.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/text-field.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/text-field.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/titleize.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/titleize.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/validator-extensions.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/validator-extensions.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/window-proxy.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/window-proxy.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/utils/word-count.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - utils/word-count.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/base.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/base.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/invite-user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/invite-user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/nav-item.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/nav-item.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/new-user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/new-user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/post.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/post.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/reset.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/reset.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/setting.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/setting.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/setup.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/setup.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/signin.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/signin.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/signup.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/signup.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/slack-integration.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/slack-integration.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/subscriber.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/subscriber.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/tag-settings.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/tag-settings.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
define('ghost-admin/tests/validators/user.lint-test', ['exports'], function (exports) {
  'use strict';

  describe('ESLint - validators/user.js', function () {
    it('should pass ESLint', function () {
      // precompiled test passed
    });
  });
});
/* jshint ignore:start */

require('ghost-admin/tests/test-helper');
EmberENV.TESTS_FILE_LOADED = true;

/* jshint ignore:end */
//# sourceMappingURL=tests-9a5e2881e996e5d83b248dc568dd0b9b.map
