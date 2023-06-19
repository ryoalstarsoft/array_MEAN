//
//
// NOTE: Run this from arrays-server-js via bin/_*_MVP_DB_seed
//
var dotenv_path = __dirname + "/../../../../config/env/.env." + (process.env.NODE_ENV ? process.env.NODE_ENV : "development");
require('dotenv').config({
    path: dotenv_path
});
//
var datasources = require('./cmd_parser').GetDatasources();
var dataSourceDescriptions = require('../../../models/descriptions')
//
//
var cache_keywords_controller = require('../cache/keywords_controller');

dataSourceDescriptions.GetDescriptionsToSetup(datasources, function (descriptions) {
    var fn = function(err) {
        if (err) {
            process.exit(1); // error code
        } else {
            process.exit(0); // all good
        }
    };

    cache_keywords_controller.CacheKeywords_dataSourceDescriptions(descriptions, fn);

});

