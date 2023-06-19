var winston = require('winston');
var Batch = require('batch');
var _ = require('lodash');
//
var importedDataPreparation = require('../../../libs/datasources/imported_data_preparation');
var datatypes = require('../../../libs/datasources/datatypes');
var raw_source_documents = require('../../../models/raw_source_documents');
var processed_row_objects = require('../../../models/processed_row_objects');
var config = require('../config');
var func = require('../func');
var User = require('../../../models/users');

module.exports.BindData = function (req, urlQuery, callback) {
    var self = this;
    // urlQuery keys:
    // source_key
    // groupBy
    // searchQ
    // searchCol
    // embed
    // Other filters
    var source_pKey = urlQuery.source_key;
    var collectionPKey = process.env.NODE_ENV !== 'enterprise'? req.subdomains[0] + '-' + source_pKey : source_pKey;


    var askForPreview = false;
    if (urlQuery.preview && urlQuery.preview == 'true') askForPreview = true;

    importedDataPreparation.DataSourceDescriptionWithPKey(askForPreview,collectionPKey)
        .then(function (dataSourceDescription) {

            if (dataSourceDescription == null || typeof dataSourceDescription === 'undefined') {
                callback(new Error("No data source with that source pkey " + source_pKey), null);

                return;
            }
            if (typeof dataSourceDescription.fe_views !== 'undefined' && dataSourceDescription.fe_views.views != null && typeof dataSourceDescription.fe_views.views.wordCloud === 'undefined') {
                callback(new Error('View doesn\'t exist for dataset. UID? urlQuery: ' + JSON.stringify(urlQuery, null, '\t')), null);

                return;
            }


            var processedRowObjects_mongooseContext = processed_row_objects.Lazy_Shared_ProcessedRowObject_MongooseContext(dataSourceDescription._id);
            var processedRowObjects_mongooseModel = processedRowObjects_mongooseContext.Model;
            //
            var groupBy = urlQuery.groupBy; // the human readable col name - real col name derived below
            var defaultGroupByColumnName_humanReadable = dataSourceDescription.fe_displayTitleOverrides[dataSourceDescription.fe_views.views.wordCloud.defaultGroupByColumnName] ||
            dataSourceDescription.fe_views.views.wordCloud.defaultGroupByColumnName


            var keywords = dataSourceDescription.fe_views.views.wordCloud.keywords;
            //
            var routePath_base = "/" + source_pKey + "/word-cloud";
            var sourceDocURL = dataSourceDescription.urls ? dataSourceDescription.urls.length > 0 ? dataSourceDescription.urls[0] : null : null;
            if (urlQuery.embed == 'true') routePath_base += '?embed=true';
            if (urlQuery.askForPreview == 'true') routePath_base += '?preview=true'
            //
            var truesByFilterValueByFilterColumnName_forWhichNotToOutputColumnNameInPill = func.new_truesByFilterValueByFilterColumnName_forWhichNotToOutputColumnNameInPill(dataSourceDescription);
            //
            var filterObj = func.filterObjFromQueryParams(urlQuery);
            var isFilterActive = Object.keys(filterObj).length != 0;
            //
            var searchCol = urlQuery.searchCol;
            var searchQ = urlQuery.searchQ;
            var isSearchActive = typeof searchCol !== 'undefined' && searchCol != null && searchCol != "" // Not only a column
                && typeof searchQ !== 'undefined' && searchQ != null && searchQ != "";  // but a search query

            //
            var sourceDoc, sampleDoc, uniqueFieldValuesByFieldName, nonpagedCount = 0, groupedResults = [];

            var batch = new Batch();
            batch.concurrency(1);

            // Obtain source document
            batch.push(function (done) {
                raw_source_documents.Model.findOne({primaryKey: dataSourceDescription._id}, function (err, _sourceDoc) {
                    if (err) return done(err);

                    sourceDoc = _sourceDoc;
                    done();
                });
            });

            // Obtain sample document
            batch.push(function (done) {
                processedRowObjects_mongooseModel.findOne({}, function (err, _sampleDoc) {
                    if (err) return done(err);

                    sampleDoc = _sampleDoc;
                    done();
                });
            });

            // Obtain Top Unique Field Values For Filtering
            batch.push(function (done) {
                func.topUniqueFieldValuesForFiltering(dataSourceDescription, function (err, _uniqueFieldValuesByFieldName) {
                    if (err) return done(err);

                    uniqueFieldValuesByFieldName = _uniqueFieldValuesByFieldName;
                    done();
                });
            });

            // Obtain grouped results
            batch.push(function (done) {

                var groupBy_realColumnName = groupBy ? importedDataPreparation.RealColumnNameFromHumanReadableColumnName(groupBy,dataSourceDescription) :
                (dataSourceDescription.fe_views.views.wordCloud.defaultGroupByColumnName == "Object Title") ? importedDataPreparation.RealColumnNameFromHumanReadableColumnName(dataSourceDescription.fe_views.views.wordCloud.defaultGroupByColumnName,dataSourceDescription) :
                dataSourceDescription.fe_views.views.wordCloud.defaultGroupByColumnName;




                //
                var aggregationOperators = [];
                if (isSearchActive) {
                    var _orErrDesc = func.activeSearch_matchOp_orErrDescription(dataSourceDescription, searchCol, searchQ);
                    if (_orErrDesc.err) return done(_orErrDesc.err);

                    aggregationOperators = aggregationOperators.concat(_orErrDesc.matchOps);
                }
                if (isFilterActive) { // rules out undefined filterCol
                    var _orErrDesc = func.activeFilter_matchOp_orErrDescription_fromMultiFilter(dataSourceDescription, filterObj);
                    if (_orErrDesc.err) return done(_orErrDesc.err);

                    aggregationOperators = aggregationOperators.concat(_orErrDesc.matchOps);
                }

                //
                var doneFn = function (err, _groupedResults) {
                    if (err) return done(err);

                    var result = _groupedResults[0];
                    groupedResults = keywords.map(function (keyword) {
                        var obj = {_id: keyword, value: 0};
                        if (result && result[keyword]) obj.value = result[keyword];
                        obj.valueToString = datatypes.displayNumberWithComma(obj.value);
                        return obj;
                    });

                    groupedResults.sort(function (a, b) {
                        return b.value - a.value;
                    });

                    done();
                };

                var groupBy_realColumnName_path = "rowParams." + groupBy_realColumnName;
                var groupOps_keywords = {_id: null};
                keywords.forEach(function (keyword) {
                    groupOps_keywords[keyword] = {
                        $sum: {
                            $cond: [
                                "$wordExistence." + groupBy_realColumnName + "." + keyword, 1, 0
                            ]
                        }
                    }
                });
                aggregationOperators = aggregationOperators.concat([
                    {$group: groupOps_keywords}
                ]);

                processedRowObjects_mongooseModel.aggregate(aggregationOperators).allowDiskUse(true)/* or we will hit mem limit on some pages*/.exec(doneFn);
            });

            var user = null;
            batch.push(function(done) {
                if (req.user) {
                    User.findById(req.user)
                        .populate('defaultLoginTeam')
                        .exec(function(err, doc) {
                            if (err) return done(err);
                            user = doc;
                            done();
                        });
                } else {
                    done();
                }
            });

            batch.end(function (err) {
                if (err) return callback(err);

                //
                var minGroupedResultsValue = Math.min.apply(Math, groupedResults.map(function (o) {
                    return o.value;
                }));
                var maxGroupedResultsValue = Math.max.apply(Math, groupedResults.map(function (o) {
                    return o.value;
                }));
                //

                var data =
                {
                    env: process.env,

                    user: user,
                    arrayTitle: dataSourceDescription.title,
                    array_source_key: source_pKey,
                    team: dataSourceDescription._team ? dataSourceDescription._team : null,
                    brandColor: dataSourceDescription.brandColor,
                    brandWhiteText: func.useLightBrandText(dataSourceDescription.brandColor),
                    brandContentColor: func.calcContentColor(dataSourceDescription.brandColor),
                    sourceDoc: sourceDoc,
                    sourceDocURL: sourceDocURL,
                    description: dataSourceDescription.description ? dataSourceDescription.description : "",
                    view_visibility: dataSourceDescription.fe_views.views ? dataSourceDescription.fe_views.views : {},
                    view_description: dataSourceDescription.fe_views.views.wordCloud.description ? dataSourceDescription.fe_views.views.wordCloud.description : "",
                    //
                    groupedResults: groupedResults,
                    minGroupedResultsValue: minGroupedResultsValue,
                    maxGroupedResultsValue: maxGroupedResultsValue,
                    groupBy: groupBy,
                    //
                    displayTitleOverrides:  _.cloneDeep(dataSourceDescription.fe_displayTitleOverrides),
                    filterObj: filterObj,
                    isFilterActive: isFilterActive,
                    uniqueFieldValuesByFieldName: uniqueFieldValuesByFieldName,
                    truesByFilterValueByFilterColumnName_forWhichNotToOutputColumnNameInPill: truesByFilterValueByFilterColumnName_forWhichNotToOutputColumnNameInPill,
                    //
                    searchQ: searchQ,
                    searchCol: searchCol,
                    isSearchActive: isSearchActive,
                    //
                    defaultGroupByColumnName_humanReadable: defaultGroupByColumnName_humanReadable,
                    colNames_orderedForGroupByDropdown: importedDataPreparation.HumanReadableFEVisibleColumnNamesWithSampleRowObject_orderedForDropdown(sampleDoc, dataSourceDescription, 'wordCloud', 'GroupBy'),
                    colNames_orderedForSortByDropdown: importedDataPreparation.HumanReadableFEVisibleColumnNamesWithSampleRowObject_orderedForSortByDropdown(sampleDoc, dataSourceDescription),
                    //
                    routePath_base: routePath_base,
                    // multiselectable filter fields
                    multiselectableFilterFields: dataSourceDescription.fe_filters.fieldsMultiSelectable,
                    isPreview: askForPreview,
                    defaultView: config.formatDefaultView(dataSourceDescription.fe_views.default_view),
                };
                callback(err, data);
            });
        })

};