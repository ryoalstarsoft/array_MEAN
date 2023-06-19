var winston = require('winston');
var queryString = require('querystring');
var express = require('express');
var router = express.Router();
var ensureAuthorized = require('../libs/middleware/ensure-authorized').ensureAuthorized;

var View = require('../models/views');

View.getAllBuiltInViews(function(err,defaultViews) {
    if (err) {
         winston.error("❌  Error getting default views to bind for routes: ", err);
         return;
    } else {
        defaultViews.forEach(function(view) {
            router.get('/:source_key/' + view.name, ensureAuthorized, function(req,res,next) {

                var source_key = req.params.source_key;
                if (source_key == null || typeof source_key == 'undefined' || source_key == "") {
                    return res.status(403).send("Bad Request - source_key missing");
                }

                var query = queryString.parse(req.url.replace(/^.*\?/,''));
                query.source_key = source_key;
                var camelCaseViewType = view.name.replace('-','_');

                require('../controllers/client/data_preparation/' + camelCaseViewType).BindData(req,query,function(err,bindData) {
                    if (err) {
                        winston.error("❌  Error getting bind data for built in view %s , err: %s" , view.name,err);
                        return res.status(500).send(err.response || 'Internal Server Error');
                    }
                    bindData.embedded = req.query.embed;
                    res.render('array/' + view.name,bindData);
                })
            })


            router.get('/:source_key/' + view.name + '/preview',ensureAuthorized,function(req,res,next) {
                var source_key = req.params.source_key;
                if (source_key == null || typeof source_key == 'undefined' || source_key == "") {
                    return res.status(403).send("Bad Request - source_key missing");
                }

                var query = queryString.parse(req.url.replace(/^.*\?/,''));
                query.source_key = source_key;
                var camelCaseViewType = view.name.replace('-','_');


                require('../controllers/client/data_preparation/' + camelCaseViewType).BindData(req,query,function(err,bindData) {
                    if (err) {
                        winston.error("❌  Error getting bind data for built in view %s , err: %s" , view.name,err);
                        return res.status(500).send(err.response || 'Internal Server Error');
                    }
                    bindData.embedded = req.query.embed;
                    res.render('array/' + view.name,bindData);
                })
            })
        })
    }
})



var object_details_controller = require('../controllers/client/data_preparation/object_details');


//object detail page
router.get(/(\/[a-z_\d-]+)\/([0-9a-f]{24})/, ensureAuthorized, function (req, res, next) {



    var source_key = req.params[0];
    source_key = process.env.NODE_ENV !== 'enterprise' ? req.subdomains[0] + '-' + source_key.substring(1) : source_key.substring(1);

    if (source_key == null || typeof source_key === 'undefined' || source_key == "") {
        return res.status(403).send("Bad Request - source_key missing");
    }
    var object_id = req.params[1];
    if (object_id == null || typeof object_id === 'undefined' || object_id == "") {
        return res.status(403).send("Bad Request - object_id missing");
    }

    var askForPreview = false;
    if (req.query.preview && req.query.preview == 'true') askForPreview = true;


    object_details_controller.BindData(req, source_key, object_id, askForPreview,function (err, bindData) {

        if (err) {
            winston.error("❌  Error getting bind data for Array source_key " + source_key + " object " + object_id + " details: ", err);
            return res.status(500).send(err.response || 'Internal Server Error');
        }
        if (bindData == null) { // 404
            return res.status(404).send(err.response || 'Not Found')
        }
        bindData.embedded = req.query.embed;
        bindData.referer = req.headers.referer;
        res.render('object/show', bindData);
    });
});

module.exports = router;