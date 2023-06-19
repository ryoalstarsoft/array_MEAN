var winston = require('winston');
var expressWinston = require('express-winston');
var url = require('url');
var path = require('path');

var express = require('express');

var isDev = !process.env.NODE_ENV || process.env.NODE_ENV == 'development';
var __DEBUG_enableEnsureWWWForDev = false; // for debug
var shouldEnsureWWW = isDev == false || __DEBUG_enableEnsureWWWForDev;

var fs = require('fs');
var async = require('async');


var rootDomain = process.env.USE_SSL === 'true' ? 'https://app.' : 'http://app.';
    rootDomain += process.env.HOST ? process.env.HOST : 'localhost:9080';

var View = require('../models/views');



//
var _mountRoutes_monitoring = function (app) {
    app.get('/_ah/health', function (req, res) {
        res.set('Content-Type', 'text/plain');
        res.status(200).send('ok');
    });
};
//
var _mountRoutes_ensureWWW = function (app) {
    app.use(function (req, res, next) {
        if (shouldEnsureWWW == false) {
            next();

            return;
        }
        var host = req.header("host");
        var protocol = req.header('x-forwarded-proto') == 'https' ? 'https' : 'http';
        if (host.match(/^www\..*/i)) {
            next();
            } else {
            return res.redirect(301, protocol + "://www." + host + req.originalUrl);

        }
    });
};

//

function isNotRootDomain (subdomains) {

    if (subdomains.length == 1 && subdomains[0] !== 'www' && subdomains[0] !== 'app') { // pattern: subdomain.arrays.co
        return true;
    }  else {
        return false;
    }
}



var _defaultViewRoutes = new Promise(function(resolve,reject) {
    View.getAllBuiltInViews(function(err,data) {
        if (err) { reject(err); }
        else {
            var string = "";
            data.map(function(view) {
                string += "|" + view.name;
            })
            resolve(string);
        }
    })
});




var urlRegexForDataset;
var _mountRoutes_subdomainRedirect = function(app) {
    Promise.all([_defaultViewRoutes])
    .then(function(values) {
        urlRegexForDataset = new RegExp("^(\\/[a-z_\\d-]+)\/(getData$|[0-9a-f]{24}" + values[0] + ")",'gm');
        //console.log(urlRegexForDataset)

    })
}

var _mountRoutes_errorHandling = function (app) {
    //
    // Add the error logger after all middleware and routes so that
    // it can log errors from the whole application. Any custom error
    // handlers should go after this.
    app.use(expressWinston.errorLogger({
        transports: [
            new winston.transports.Console({
                json: true,
                colorize: isDev
            })
        ]
    }));

    //
    app.use(function (req, res) { // 404 handler
        // TODO: render a view template?
        res.status(404).send('Not Found');
    });
    //
    app.use(function (err, req, res, next) { // Basic error handler
        // TODO: render a view template?
        res.status(500).send(err.response || 'Internal Server Error');
    });
};
//






var _mountRoutes_endPoints = function (app) {
    var apiVersion = 'v1';
    app.all("*", function(req,res,next) {





        if (process.env.NODE_ENV !== 'enterprise') {

            urlRegexForDataset.lastIndex = 0;

            var isRouteForDataset = urlRegexForDataset.test(req.url);

            if (isNotRootDomain(req.subdomains)) {


                if (isRouteForDataset) {



                    return next();
                } else {

                    if (req.url == '/' || req.url == "/" + apiVersion + '/share' || req.url == '/auth/logout') {
                        return next();
                    } else if (req.url.indexOf("s") == 1) {
                        return next();
                    } else {

                        return res.redirect(rootDomain + req.url);
                    }
                }


            } else { //www.arrays.co or app.arrays.co


                if (isRouteForDataset || req.subdomains.length == 0) {

                    //console.log(isRouteForDataset);

                    return res.redirect(rootDomain +'/');
                } else {


                    return next();
                }
            }

        } else next();


    });

    app.use('/', require('./homepage'));
    app.use('/s', require('./shared_pages'));
    app.use('/' + apiVersion, require('./jsonAPI_share'));
    app.use('/auth', require('./auth'));
    app.use('/login', function(req, res) {
        res.redirect('/auth/login');
    });
    app.use('/signup',require('./signup'));
    app.use('/reset', function(req, res) {
        res.render('auth/password',{
            env: process.env
        });
    });

    app.use('/dashboard', require('./dashboard'));
    app.use('/api', require('./api'));
    app.use('/webhooks', require('./webhooks'));
    app.use('/account',require('./account'));
    app.use('/', require('./views'));


};

module.exports.MountRoutes = function(app) {

    app.get('/env', function(req, res) {
        var host = process.env.HOST || 'localhost:9080' ;
        var obj = {
            node_env: process.env.NODE_ENV,
            host: host,
            s3Bucket: process.env.AWS_S3_BUCKET,
            intercomAppId: process.env.INTERCOM_APP_ID ? process.env.INTERCOM_APP_ID : '',
            subdomain: process.env.SUBDOMAIN,
            userEngageAPIKey: process.env.USERENGAGE_API_KEY ? process.env.USERENGAGE_API_KEY : ''
        };
        return res.json(obj);
    });


    _mountRoutes_monitoring(app);
    //_mountRoutes_ensureWWW(app);
    _mountRoutes_subdomainRedirect(app);
    _mountRoutes_endPoints(app);
    _mountRoutes_errorHandling(app);
};