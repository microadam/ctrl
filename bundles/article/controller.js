var async = require('async')
  , join = require('path').join
  , createAdminFormMiddleware = require('./lib/admin-form-middleware')

module.exports = function createRoutes (serviceLocator, viewPath) {

  var viewRender = serviceLocator.viewRender(viewPath)
    , sectionModel = serviceLocator.sectionModel
    , articleModel = serviceLocator.articleModel
    , formMiddleware = createAdminFormMiddleware(serviceLocator)

  serviceLocator.compact.addNamespace('article-admin', join(__dirname, 'public'))
    .addJs('/js/admin-form.js')

  // The admin bundle provides a crud based generic route controller that can
  // take a model and a view-schema.
  serviceLocator.admin.routes(
    serviceLocator,
    require('./admin-view-config')(serviceLocator),
    serviceLocator.articleModel,
      // What ACL role is needed to preform the crud actions
      { requiredAccess: 'Article'
      , views:
        { form: join(__dirname, 'views', 'admin-form.jade')
        }
      , middleware:
        { create: formMiddleware
        , update: formMiddleware
        }
      , scripts:
        { form: ['article-admin']}
      // Render function for the templates
      , renderFn: serviceLocator.admin.viewRender()
      }
  );

  function getPageContent(req, res, next) {
    var section = req.params.section
      , sectionQuery = {
        slug: section
      }
      , article = req.params.article
      , articleQuery = {
        section: section,
        slug: article
      }

    if (!article) {
      delete articleQuery.slug
    }

    if (!section) {
      delete articleQuery.section;
      delete sectionQuery.slug;
    }

    async.parallel({
      section: function (callback) {
        sectionModel.find(sectionQuery, function (error, dataSet) {
          if (!dataSet || dataSet.length === 0) {
            return callback(true, [])
          }
          callback(null, dataSet[0])
        })
      },
      article: function (callback) {
        articleModel.findLive(articleQuery, { limit: 100, sort: { created: -1 } },
          function (error, dataSet) {

          if (!dataSet || dataSet.length === 0) {
            return callback(true, [])
          }
          callback(null, dataSet)
        })

      }
    }, function (error, results) {
      if ((results.section.length === 0) || (results.article.length === 0)) {
        return next()
      }
      res.article = results.article
      res.section = results.section

      next()
    })
  }

  serviceLocator.router.get(
    '/:section/:article',
    getPageContent,
    // serviceLocator.widgetManager.load([
    //   'article::recent', 'article::categories', 'article::postsByAuthor'
    // ]),
    serviceLocator.compact.js([['global'], ['article']]),
    function (req, res, next) {
      if (!res.article) {
        return next()
      }
      viewRender(req, res, 'article', {
        page: {
          title: res.article[0].title + ' by ' + res.article[0].author,
          section: res.section.slug
        },
        title: 'article',
        section: res.section,
        article: res.article[0]
      })
    })
}