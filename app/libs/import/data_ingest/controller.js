//
//
// 
var async = require("async");
var winston = require('winston');
var raw_source_documents = require('../../../models/raw_source_documents');
var processed_row_objects = require('../../../models/processed_row_objects');
var postimport_caching_controller = require('../cache/controller');
var processing = require('../../datasources/processing');
var import_raw_objects_controller = require('./raw_objects_controller');


//
// ---------- Multiple DataSource Operation ----------
//
module.exports.Import_rawObjects = function (dataSourceDescriptions,job, fn) {
    var i = 1;

    async.eachSeries(
        dataSourceDescriptions,
        function (dataSourceDescription, eachCb) {

            
            if (dataSourceDescription._team.isEnterprise) {

                var controller = require(__dirname + '/../../../../user/' + dataSourceDescription._team.subdomain +  '/src/import');
                if (typeof controller.ParseAndImportRaw !== 'undefined') {
                    controller.ParseAndImportRaw(i,dataSourceDescription,job,eachCb);
                } else {
                    import_raw_objects_controller.ParseAndImportRaw(i, dataSourceDescription,job, eachCb);
                }
                
            } else {
                 import_raw_objects_controller.ParseAndImportRaw(i, dataSourceDescription,job, eachCb);
            }
           
            i++;
        },
        function (err) {


            if (err) {
                winston.info("❌  Error encountered during raw objects import:", err);
                fn(err);
            } else {
                winston.info("✅  Raw objects import done.");
                job.log("✅  Raw objects import done.");
                fn();
            }
        }
    );
};




var _Import_dataSourceDescriptions__enteringImageScrapingDirectly = function (dataSourceDescriptions,job, fn) {
    var self = this;
    var i = 1;
    async.eachSeries(
        dataSourceDescriptions,
        function (dataSourceDescription, eachCb) {
            winston.info("💬  " + i + ": Proceeding to image scraping of \"" + dataSourceDescription.title + "\"");
            job.log("💬 Proceeding to image scraping of \"" + dataSourceDescription.title + "\"");

            _proceedToScrapeImagesAndRemainderOfPostProcessing(i, dataSourceDescription, job,eachCb);
            i++;
        },
        function (err) {
            if (err) {
                winston.info("❌  Error encountered during image-scrapping:(" + err.code + ')', err);
                job.log("❌  Error encountered during image-scrapping:(" + err.code + ')', err);
                fn(err);
            } else {
                winston.info("✅  Import completed.");
                job.log("✅  Import completed.");
                fn();
            }
        }
    );
};

module.exports.Import_dataSourceDescriptions__enteringImageScrapingDirectly = _Import_dataSourceDescriptions__enteringImageScrapingDirectly;

module.exports.PostProcessRawObjects = function (dataSourceDescriptions,job, fn) {
    var i = 1;
    var omitImageScraping = true;

    async.eachSeries(
        dataSourceDescriptions,
        function (dataSourceDescription, eachCb) {

            processed_row_objects.initializeBackgroundIndexBuilding(dataSourceDescription);

            _postProcess(i, dataSourceDescription,job,eachCb);
            i++;
        },
        function (err) {
            if (err) {
                winston.info("❌  Error encountered during import post-processing:", err.message);
                fn(err);
            } else {
                winston.info("✅  Import post-processing done.");
                job.log("✅  Import post-processing done.")
                fn();
            }
        }
    );
};

// ---------- Single DataSource Operation ----------
//
var _postProcess = function (indexInList, dataSourceDescription,job, callback) {
    var datasetId = dataSourceDescription._id;
    var dataSource_importRevision = dataSourceDescription.importRevision;
    var dataSource_title = dataSourceDescription.fileName;
    var parentId = dataSourceDescription.schemaId;

  
    winston.info("🔁  " + indexInList + ": Post-processing \"" + dataSource_title + "\"");

    
    job.log("🔁  Post-processing \"" + dataSource_title + "\"");


    //
    //
    // Firstly, generate the whole processed objects dataset
    //


    processed_row_objects.InsertProcessedDatasetFromRawRowObjects
    (
        job,
        datasetId,
        parentId,
        function (err) {
            if (err) {
                winston.error("❌  Error encountered while generating whole processed dataset \"" + dataSource_title + "\".");
                return callback(err);
            }

            if (dataSourceDescription._team.isEnterprise) {

                 var controller = require(__dirname + '/../../../../user/' + dataSourceDescription._team.subdomain +  '/src/import');

                if (typeof controller.afterGeneratingProcessedDataSet_performEachRowOperations !== 'undefined') {

                    return controller.afterGeneratingProcessedDataSet_performEachRowOperations(indexInList,dataSourceDescription,job,callback);
                    
                } 


            } 
             _afterGeneratingProcessedDataSet_performEachRowOperations(indexInList, dataSourceDescription,job, function(err) {

                 if (err) {
                    winston.error("❌  Error encountered while generating whole processed dataset \"" + dataSource_title + "\".");
                    return callback(err);
                }
   


                job.log("🔁  Now generating fields by joining datasets ");

                async.eachSeries(
                    dataSourceDescription.relationshipFields,
                    function (description, cb) {
                        var by = description.by;
                        var formingRelationship = typeof description.relationship !== 'undefined' && description.relationship == true ? true : false;
                        switch (by.operation) {
                            case "Join":
                            {
                                processed_row_objects.GenerateFieldsByJoining_comparingWithMatchFn(
                                    job,
                                    datasetId,
                                    description.field,
                                    description.singular,
                                    by.findingMatchOnField,
                                    by.joinDataset,
                                    by.withLocalField,
                                    by.obtainingValueFromField,
                                    formingRelationship,
                                    cb
                                );
                                break;
                            }

                            default:
                            {
                                winston.error("❌  Unrecognized post-processing field generation operation \"" + byDoingOp + "\" in", description);
                                break;
                            }
                        }
                    },
                    function (err) {
                        if (err) winston.error("❌  Error encountered while processing \"" + dataSource_title + "\".");
                        return callback(err);
                    }
                );

             });
            
        });
};

var _proceedToScrapeImagesAndRemainderOfPostProcessing = function (indexInList, dataSourceDescription,job, callback) {

  
      
    if (dataSourceDescription.fe_image && dataSourceDescription.fe_image.field && !dataSourceDescription.sample) { // dont omit scraping

        winston.info("🔁  start image scraping");
        job.log("🔁  start image scraping");



         processed_row_objects.GenerateImageURLFieldsByScraping(job,dataSourceDescription._team.subdomain,dataSourceDescription._id,
            dataSourceDescription.schemaId,
            dataSourceDescription.fe_image,
            function(err) {

                if (err) { 

                    winston.error("❌  Error encountered while scraping image with \"" + dataSourceDescription.title + "\".");
                    return callback(err);
                } else {
                    return callback();
                }

            })

     } else { //omit scraping
        winston.info(" ⚠️  skipping image scraping");
        job.log("⚠️  skipping image scraping"); 
        callback();
     }
}
//


var _afterGeneratingProcessedDataSet_performEachRowOperations = function (indexInList, dataSourceDescription,job, callback) {

    var dataSource_importRevision = dataSourceDescription.importRevision;
    var dataSource_title = dataSourceDescription.fileName;
    var dataset_parentId = dataSourceDescription.schemaId;
    var dataSource_team_subdomain = dataSourceDescription._team.subdomain;


    var forThisDataSource_mongooseContext;
    if (dataset_parentId) {
        forThisDataSource_mongooseContext = processed_row_objects.Lazy_Shared_ProcessedRowObject_MongooseContext(dataset_parentId);
    } else {
        forThisDataSource_mongooseContext =  processed_row_objects.Lazy_Shared_ProcessedRowObject_MongooseContext(dataSourceDescription._id);
    }

    var forThisDataSource_rowObjects_modelName = forThisDataSource_mongooseContext.Model.modelName;
    var forThisDataSource_RawRowObject_model = forThisDataSource_mongooseContext.Model.model;
    var forThisDataSource_nativeCollection = forThisDataSource_mongooseContext.Model.collection;

    // var mergeFieldsIntoCustomField_BulkOperation = forThisDataSource_nativeCollection.initializeUnorderedBulkOp();


    //

    winston.info("🔁  Performing each-row operation for \"" + dataSource_title + "\"");

    job.log("🔁  Performing each-row operation and creating custom fields for \"" + dataSource_title + "\"");

    var eachCtx;
    var eachCtx = dataSourceDescription.customFieldsToProcess;

    if (typeof dataSourceDescription.fe_nestedObject != 'undefined' && dataSourceDescription.fe_nestedObject.prefix) {
        eachCtx = dataSourceDescription.fe_nestedObject;
        eachCtx.nested = true;
        eachCtx.numberOfInsertedRows = 0;
        eachCtx.numberOfRows = 0;
        eachCtx.pKeyQuery = {};
        eachCtx.id = dataSourceDescription._id;
        if (dataset_parentId) {
            eachCtx.pKeyQuery = {$regex: "^" + dataSourceDescription._id + "-"}
        } else {
            eachCtx.pKeyQuery = dataSourceDescription._id.toString();

        }
       
    }

    startIterations();

    function startIterations() {

        /*eachCtx could be array or object*/

        if (eachCtx == null || typeof eachCtx == 'undefined' || (Array.isArray(eachCtx) && !eachCtx.length) ||
            (!Array.isArray(eachCtx) && !eachCtx.fields.length)) {
            continueToAfterIterating();
        } else {

            eachCtx.nativeCollection = forThisDataSource_nativeCollection;
            afterGeneratingProcessedRowObjects_eachRowFn(eachCtx,function(err) {
                if (err) {
                    winston.error("❌  Error encountered while performing each-row operations \"" + dataSource_title + "\".");
                    job.log("❌  Error encountered while performing each-row operations \"" + dataSource_title + "\".");
                    callback(err); // bail early
                } else {
                    continueToAfterIterating(eachCtx);
                }
            });
        }
    }


    function afterGeneratingProcessedRowObjects_eachRowFn(eachCtx,cb) {

        var bulkOperationQueryFragment;

        if (typeof eachCtx.nested !== 'undefined' && eachCtx.nested == true) {
         
            var matchQuery = {};

            if (eachCtx.criteria !== null && typeof eachCtx.criteria !== 'undefined') {
                matchQuery["rowParams." + eachCtx.criteria.fieldName] = eachCtx.criteria.value;
            }
            if (typeof eachCtx.pKeyQuery == 'string') {
                matchQuery["srcDocPKey"] = eachCtx.pKeyQuery;

            } else {
                matchQuery["pKey"] = eachCtx.pKeyQuery;

            }

            var groupQuery = formGroupQuery(eachCtx);
                
            var continueLoop = true;
            var counter = 1;
            var skipping = 0;
            var limit = 10;

            async.whilst(function() {
                if (counter == 1) {


                    return true;
                } else {
                    return continueLoop;
                }
            },function(next) {
                eachCtx.nativeCollection.aggregate([
                    {$match: matchQuery},
                    {$skip: skipping},
                    {$limit: limit},
                    {$group: groupQuery}
                    
                ],{allowDiskUse:true},function(err,aggregatedResult) {

               
                    if (err) return next(err);
                    

            
                    if (aggregatedResult.length == 0) {
                        continueLoop = false;
                        return next();
                    } 

                   
    
                    async.each(aggregatedResult,function(res,callback) {
                        var updateQuery = {};
                        updateQuery["rowParams." + eachCtx.criteria.fieldName] = {$ne: eachCtx.criteria.value};
                        var matchingCond = res._id;
                        eachCtx.numberOfRows += res.count;

                        delete res._id;
                        delete res.count;

                        updateQuery["rowParams." + eachCtx.nestingKey] = matchingCond;
                        var setQuery = formSetQuery(res,eachCtx.prefix,eachCtx.valueOverrides);

                        eachCtx.nativeCollection.update(updateQuery,{$push: setQuery},function(err,result) {
                            if (err) return callback(err);
                            var r = JSON.parse(result);

                            eachCtx.numberOfInsertedRows += parseInt(r["n"]);
                            eachCtx.numberOfRows += parseInt(r["n"]);
                            callback();
                        })

                    },function(err) {
     
                        skipping = counter * limit;
                        counter++;

                        if (eachCtx.numberOfRows!== 0 && eachCtx.numberOfRows % 100 == 0) {
                            winston.info("✅  processed " + eachCtx.numberOfRows + " of nested fields");
                            job.log("✅  processed " + eachCtx.numberOfRows + " of nested fields");
                        }

                        next(err);
                    })


                })

            },function(err) {
                var removeQuery = {};
                removeQuery["rowParams." + eachCtx.criteria.fieldName] = eachCtx.criteria.value;
                eachCtx.nativeCollection.remove(removeQuery,cb);

            })



        } else {


  
            async.each(eachCtx,function(customField,outterCallback) {



                var continueLoop = true;
                var counter = 1;
                var skipping = 0;
                var limit = 1000;

                async.whilst(function() {

                    if (counter == 1) {
                        return true;
                    } else {
                        return continueLoop;
                    }
                },function(next) {

            
                    var project = formProjectQuery(customField);

                    var useDelimiter = false;

                    if (customField.delimiterOnFields && customField.delimiterOnFields.length == 1 && 
                        customField.fieldsToMergeIntoArray.length == 1) {
                        useDelimiter = true;
                    }


                    eachCtx.nativeCollection.aggregate([
                        {$skip: skipping},
                        {$limit: limit},
                        {$project: project}
                    ],function(err,aggregatedResult) {

  
    
                        if (err) return next(err);


                        if (aggregatedResult.length == 0) {
                            continueLoop = false;
                            return next();
                        } 


                        async.each(aggregatedResult,function(res,asynEachCb) {
                            var docId = res._id;
                            delete res._id;

                            if (useDelimiter) {
                                var sp = customField.delimiterOnFields[0];
                                if (sp == '" "') {
                                    sp = " ";
                                }

                        

                                res[customField.fieldName] = res[customField.fieldName][0].split(sp);
                            }

                            var setQuery = formSetQuery(res);

                            eachCtx.nativeCollection.update({_id:docId},{$set: setQuery},function(err) {
                                asynEachCb(err);
                            });

                        },function(err) {
         
                            skipping = counter * limit;
                            counter++;
                            next(err);
                        })


                    })

                },function(err) {
                    outterCallback(err);

                })

            },function(err) {
                return cb(err);
            })

        }

    }

    function formGroupQuery(ctx) {
        var ret = {};
   

        ret["_id"] = "$rowParams." + ctx.nestingKey;
        for (var i = 0; i < ctx.fields.length; i ++) {
            ret[ctx.fields[i]] = {$push: "$" + "rowParams." + ctx.fields[i]};
        }
        ret["count"] = {$sum:1};

        
       
        return ret;
    }

    function formProjectQuery(customField) {
        //assuming its merging to array
        var mergingFields = customField.fieldsToMergeIntoArray;
        var newFieldName = customField.fieldName;
        var p = {};
        
        p[newFieldName] = [];
        
        
        for (var i = 0; i < mergingFields.length; i++) {
            p[newFieldName].push("$rowParams." + mergingFields[i])
        }
       
        return p;
    }


    


    function formSetQuery(obj,prefix,valueOverrides) {
        var ret = {};
        for (var fieldName in obj) {
            if (!prefix || !valueOverrides) {
                var revisedKey = "rowParams." + fieldName;
                ret[revisedKey] = obj[fieldName];
                continue;

            } 
            var revisedKey = "rowParams." + prefix + fieldName;
            var fieldValue = obj[fieldName];


            if (valueOverrides[fieldName]) {
                var keys = Object.keys(valueOverrides[fieldName]);
                keys.forEach(function (key) {
                    var re = new RegExp(key, 'i');
                    fieldValue = fieldValue.map(function(f) {
                        return f.replace(re, valueOverrides[fieldName][key]);
                    })
                    
                });

            }
            ret[revisedKey] = {};
            ret[revisedKey].$each = fieldValue;
        }
        return ret;
    }


    function afterGeneratingProcessedRowObjects_afterIterating_eachRowFn(eachCtx, cb) {

        winston.info("✅  [" + (new Date()).toString() + "] Saved custom fields.");

        if (typeof eachCtx.nested != 'undefined' && eachCtx.nested == true) {

            var updateId = dataSourceDescription._id;
            if (dataset_parentId) {
                updateId = dataset_parentId
            }


            raw_source_documents.IncreaseNumberOfRawRows(updateId, eachCtx.numberOfInsertedRows - eachCtx.numberOfRows,function(err) {
                if (err) {
                    winston.error('❌ Error when modifying number of rows in raw source documents: %s', err);
                }
                cb(err);
            })

        } else {
            cb(null);
        }

    }


    function continueToAfterIterating(eachCtx) {

        /* check object key length would not be appropriate because eacCtx could be array */

        if (eachCtx != null && typeof eachCtx != 'undefined' ) {

            afterGeneratingProcessedRowObjects_afterIterating_eachRowFn(
                eachCtx,
                function (err) {
                    if (err) {
                        winston.error("❌  Error encountered while performing each-row operations \"" + dataSource_title + "\".");
                    } else {
                        winston.info("✅  " + indexInList + ": Imported processed rows and custom field objects --  \"" + dataSource_title + "\".");
                        job.log("✅  " + indexInList + ": Imported processed rows and custom field objects for \"" + dataSource_title + "\".");
                    }
                    //
                    callback(err);
                }
            );
        } else {
            winston.info("✅  " + indexInList + ": Imported processed rows and custom field objects  --  \"" + dataSource_title + "\".");
            job.log("✅  " + indexInList + ": Imported processed rows and custom field objects  \"" + dataSource_title + "\".");
            callback(); // all done
        }
    }
};