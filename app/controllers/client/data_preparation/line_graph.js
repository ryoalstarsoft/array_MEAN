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
var dataSourceDescriptions = require('../../../models/descriptions')

/**
 * @param {Object} urlQuery - URL params
 * @param {Function} callback
 */
module.exports.BindData = function (req, urlQuery, callback) {
    var self = this;
    // urlQuery keys:
    // source_key
    // groupBy
    // searchQ
    // searchCol
    // embed
    // filters
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

            if (typeof dataSourceDescription.fe_views !== 'undefined' && dataSourceDescription.fe_views.views != null && typeof dataSourceDescription.fe_views.views.lineGraph === 'undefined') {
                callback(new Error('View doesn\'t exist for dataset. UID? urlQuery: ' + JSON.stringify(urlQuery, null, '\t')), null);
                return;
            }

            var processedRowObjects_mongooseContext = processed_row_objects.Lazy_Shared_ProcessedRowObject_MongooseContext(dataSourceDescription._id);
            var processedRowObjects_mongooseModel = processedRowObjects_mongooseContext.Model;
            //
            var groupBy = urlQuery.groupBy; // the human readable col name - real col name derived below

            var defaultGroupByColumnName_humanReadable = dataSourceDescription.fe_displayTitleOverrides[dataSourceDescription.fe_views.views.lineGraph.defaultGroupByColumnName] ||
            dataSourceDescription.fe_views.views.lineGraph.defaultGroupByColumnName

            var groupBy_realColumnName = importedDataPreparation.RealColumnNameFromHumanReadableColumnName(groupBy ? groupBy : defaultGroupByColumnName_humanReadable ,
                    dataSourceDescription);



            var raw_rowObjects_coercionSchema = dataSourceDescription.raw_rowObjects_coercionScheme;

            var groupBy_isDate = config.isDate(dataSourceDescription, groupBy_realColumnName);
            var groupBy_outputInFormat = '';

            var findOutputFormatObj = func.findItemInArrayOfObject(dataSourceDescription.fe_views.views.lineGraph.outputInFormat,groupBy_realColumnName);


            if (findOutputFormatObj != null) {
                groupBy_outputInFormat = findOutputFormatObj.value;
            } else if (raw_rowObjects_coercionSchema && raw_rowObjects_coercionSchema[groupBy_realColumnName] &&
                raw_rowObjects_coercionSchema[groupBy_realColumnName].outputFormat) {
                groupBy_outputInFormat = raw_rowObjects_coercionSchema[groupBy_realColumnName].outputFormat;
            }

            //
            var stackBy = dataSourceDescription.fe_views.views.lineGraph.defaultStackByColumnName;
            //
            var routePath_base = "/" + source_pKey + "/line-graph";
            var sourceDocURL = dataSourceDescription.urls ? dataSourceDescription.urls.length > 0 ? dataSourceDescription.urls[0] : null : null;
            if (urlQuery.embed == 'true') routePath_base += '?embed=true';
            if (urlQuery.preview == 'true') routePath_base += '?preview=true';
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
            // DataSource Relationship
            var mapping_source_pKey = undefined;
            var datasourceMapping = dataSourceDescription.fe_views.views.lineGraph.datasourceMappings;
            var mapping_default_filterObj = {};
            var mapping_default_view = "gallery";
            var mapping_groupByObj = {};
            if(datasourceMapping != undefined){
                datsourceId = datasourceMapping.pKey;
                //find the datasource
                dataSourceDescriptions.findById(datsourceId, function(err, mappingDataSourceDescription) {
                    if(err) {
                        console.log(err);
                    } else {
                        mapping_source_pKey = mappingDataSourceDescription.uid + '-r' + mappingDataSourceDescription.importRevision;
                        if(typeof(mappingDataSourceDescription.fe_filters.default) !== 'undefined') {
                            mapping_default_filterObj = mappingDataSourceDescription.fe_filters.default;
                        }

                        mapping_default_view = mappingDataSourceDescription.fe_views.default_view;

                        var mapping_groupBy = groupBy_realColumnName;
                        var mappingField = datasourceMapping.mappings;
                        if(mappingField && mappingField.length > 0) {
                            for(var i = 0; i < mappingField.length; i++) {
                                if(mappingField[i].key == groupBy_realColumnName) {
                                    mapping_groupBy = mappingField[i].value;
                                    break;
                                }
                            }
                        }
                        if (urlQuery.embed == 'true') mapping_groupByObj.embed = 'true';
                        mapping_groupByObj[mapping_groupBy] = '';

                    }
                })

            }


            // Aggregate By
            var aggregateBy = urlQuery.aggregateBy;
            var defaultAggregateByColumnName_humanReadable = dataSourceDescription.fe_displayTitleOverrides[dataSourceDescription.fe_views.views.lineGraph.defaultAggregateByColumnName] ||
            dataSourceDescription.fe_views.views.lineGraph.defaultAggregateByColumnName;


             // dataSourceDescription.fe_views.views.lineGraph.defaultAggregateByColumnName_humanReadable;
            var numberOfRecords_notAvailable = dataSourceDescription.fe_views.views.lineGraph.aggregateByColumnName_numberOfRecords_notAvailable;
            if (!defaultAggregateByColumnName_humanReadable && !numberOfRecords_notAvailable)
                defaultAggregateByColumnName_humanReadable = config.aggregateByDefaultColumnName;


            var aggregateBy_realColumnName = aggregateBy? importedDataPreparation.RealColumnNameFromHumanReadableColumnName(aggregateBy,dataSourceDescription) :
            (typeof dataSourceDescription.fe_views.views.lineGraph.defaultAggregateByColumnName  == 'undefined') ?importedDataPreparation.RealColumnNameFromHumanReadableColumnName(defaultAggregateByColumnName_humanReadable,dataSourceDescription) :
            dataSourceDescription.fe_views.views.lineGraph.defaultAggregateByColumnName;


            //
            var sourceDoc, sampleDoc, uniqueFieldValuesByFieldName, stackedResultsByGroup = {};

            ///
            // graphData is exported and used by template for lineChart generation
            var graphData = {};

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

            // Obtain Grouped ResultSet
            batch.push(function (done) {
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



                if (typeof aggregateBy_realColumnName !== 'undefined' && aggregateBy_realColumnName !== null && aggregateBy_realColumnName !== "" && aggregateBy_realColumnName != config.aggregateByDefaultColumnName) {

                    if (typeof stackBy !== 'undefined' && stackBy !== null && stackBy !== "") {
                        var stackBy_realColumnName = stackBy;



                        aggregationOperators = aggregationOperators.concat(
                            [
                                {$unwind: "$" + "rowParams." + groupBy_realColumnName},
                                {$unwind: "$" + "rowParams." + stackBy_realColumnName},
                                {
                                    $group: {
                                        _id: {
                                            groupBy: "$" + "rowParams." + groupBy_realColumnName,
                                            stackBy: "$" + "rowParams." + stackBy_realColumnName
                                        },
                                        value: {$sum: "$" + "rowParams." + aggregateBy_realColumnName}
                                    }
                                },
                                {
                                    $project: {
                                        _id: 0,
                                        label: "$_id.groupBy",
                                        stack: "$_id.stackBy",
                                        value: 1
                                    }
                                },
                                {
                                    $sort: {label: -1} // priotize by group
                                }
                            ]);




                    } else {

                        // Count by summing numeric field in group if option in datasource description is set
                        aggregationOperators = aggregationOperators.concat(
                            [
                                {$unwind: "$" + "rowParams." + groupBy_realColumnName},
                                {
                                    $group: {
                                        _id: "$" + "rowParams." + groupBy_realColumnName,
                                        value: {$sum: "$" + "rowParams." + aggregateBy_realColumnName}
                                    }
                                },
                                {
                                    $project: {
                                        _id: 0,
                                        label: "$_id",
                                        value: 1
                                    }
                                },
                                {
                                    $sort: {label: -1} // priotize by group
                                }
                            ]);

                    }
                } else {
                    // Count by number of records

                    if (typeof stackBy !== 'undefined' && stackBy !== null && stackBy !== "") {
                        var stackBy_realColumnName = stackBy

                        aggregationOperators = aggregationOperators.concat(
                            [
                                {$unwind: "$" + "rowParams." + groupBy_realColumnName},
                                {$unwind: "$" + "rowParams." + stackBy_realColumnName},
                                {
                                    $group: {
                                        _id: {
                                            groupBy: "$" + "rowParams." + groupBy_realColumnName,
                                            stackBy: "$" + "rowParams." + stackBy_realColumnName
                                        },
                                        value: {$addToSet: "$_id"}
                                    }
                                },
                                {
                                    $project: {
                                        _id: 0,
                                        label: "$_id.groupBy",
                                        stack: "$_id.stackBy",
                                        value: {$size: "$value"}
                                    }
                                },
                                {
                                    $sort: {label: -1} // priotize by group
                                }
                            ]);

                    } else {

                        aggregationOperators = aggregationOperators.concat(
                            [
                                {$unwind: "$" + "rowParams." + groupBy_realColumnName}, // requires MongoDB 3.2, otherwise throws an error if non-array
                                { // unique/grouping and summing stage
                                    $group: {
                                        _id: "$" + "rowParams." + groupBy_realColumnName,
                                        value: {$addToSet: "$_id"}
                                    }
                                },
                                { // reformat
                                    $project: {
                                        _id: 0,
                                        label: "$_id",
                                        value: {$size: "$value"}
                                    }
                                },
                                {
                                    $sort: {label: -1} // priotize by group
                                }
                            ]);
                    }
                }

                var doneFn = function (err, _multigroupedResults) {
                    if (err) return done(err);

                    if (_multigroupedResults == undefined || _multigroupedResults == null) _multigroupedResults = [];

                    var _multigroupedResults_object = {};
                    _.forEach(_multigroupedResults, function (el) {
                        var stack = el.stack && el.stack != '' ? el.stack : 'default';
                        if (_multigroupedResults_object[stack] === undefined) {
                            _multigroupedResults_object[stack] = [];
                        }
                        _multigroupedResults_object[stack].push(el);
                    });

                    _.forOwn(_multigroupedResults_object, function (_groupedResults, stack) {

                        var displayableStack = func.ValueToExcludeByOriginalKey(
                            stack, dataSourceDescription, stackBy_realColumnName, 'lineGraph');
                        if (!displayableStack) return;

                        var finalizedButNotCoalesced_groupedResults = [];
                        _groupedResults.forEach(function (el, i, arr) {
                            var displayableLabel;

                            if (groupBy_isDate) {
                                displayableLabel = func.formatCoercedField(groupBy_realColumnName, el.label, dataSourceDescription);

                            } else {
                                displayableLabel = func.ValueToExcludeByOriginalKey(
                                    el.label, dataSourceDescription, groupBy_realColumnName, 'lineGraph');
                                if (!displayableLabel) return;
                            }

                            finalizedButNotCoalesced_groupedResults.push({
                                value: el.value,
                                label: displayableLabel
                            });
                        });
                        var summedValuesByLowercasedLabels = {};
                        var titleWithMostMatchesAndMatchAggregateByLowercasedTitle = {};
                        _.each(finalizedButNotCoalesced_groupedResults, function (el, i) {
                            var label = el.label;
                            var value = el.value;
                            var label_toLowerCased = label.toString().toLowerCase();
                            //
                            var existing_valueSum = summedValuesByLowercasedLabels[label_toLowerCased] || 0;
                            var new_valueSum = existing_valueSum + value;
                            summedValuesByLowercasedLabels[label_toLowerCased] = new_valueSum;
                            //
                            var existing_titleWithMostMatchesAndMatchCount = titleWithMostMatchesAndMatchAggregateByLowercasedTitle[label_toLowerCased] || {
                                    label: '',
                                    value: -1
                                };
                            if (existing_titleWithMostMatchesAndMatchCount.value < value) {
                                var new_titleWithMostMatchesAndMatchCount = {label: label, value: value};
                                titleWithMostMatchesAndMatchAggregateByLowercasedTitle[label_toLowerCased] = new_titleWithMostMatchesAndMatchCount;
                            }
                        });
                        var lowercasedLabels = Object.keys(summedValuesByLowercasedLabels);
                        var groupedResults = [];
                        _.forEach(lowercasedLabels, function (key) {
                            var summedValue = summedValuesByLowercasedLabels[key];
                            var reconstitutedDisplayableTitle = key;
                            var titleWithMostMatchesAndMatchCount = titleWithMostMatchesAndMatchAggregateByLowercasedTitle[key];
                            if (typeof titleWithMostMatchesAndMatchCount === 'undefined') {
                                winston.error("❌  This should never be undefined.");
                                callback(new Error('Unexpectedly undefined title with most matches'), null);

                                return;
                            } else {
                                reconstitutedDisplayableTitle = titleWithMostMatchesAndMatchCount.label;
                            }
                            groupedResults.push({
                                value: summedValue,
                                date: reconstitutedDisplayableTitle
                            });
                        });

                        if (stackBy)
                            stackedResultsByGroup[displayableStack] = groupedResults;
                        else
                            stackedResultsByGroup = groupedResults;

                        /* Make linegraph category colors consistent for different "Aggregate By" settings
                         The following code alphabetizes the categories which are properties of stackedResultsByGroup */
                        if (!Array.isArray(stackedResultsByGroup)) {
                            var alphabetizedStackedResultsByGroup = {};
                            Object.keys(stackedResultsByGroup).sort().forEach(function (key) {
                                alphabetizedStackedResultsByGroup[key] = stackedResultsByGroup[key];
                            });
                            stackedResultsByGroup = alphabetizedStackedResultsByGroup;
                        }

                    });

                    var lineColors = func.convertArrayObjectToObject(dataSourceDescription.fe_views.views.lineGraph.stackedLineColors);


                    if (Array.isArray(stackedResultsByGroup)) {

                        graphData = {
                            labels: [dataSourceDescription.title],
                            data: stackedResultsByGroup.map(function (row) {
                                row.value = Number(row.value);
                                if (groupBy_isDate) {
                                    var offsetTime = new Date(row.date);
                                    offsetTime = new Date(offsetTime.getTime() + offsetTime.getTimezoneOffset() * 60 * 1000);
                                    row.date = offsetTime;
                                }
                                return row;
                            })
                        };

                    } else {

                        graphData = {labels: [], data: []};

                        _.forOwn(stackedResultsByGroup, function (results, category) {
                            graphData.labels.push(category);

                            graphData.data.push(results.map(function (row) {
                                row.value = Number(row.value);
                                if (groupBy_isDate) {
                                    var offsetTime = new Date(row.date);
                                    offsetTime = new Date(offsetTime.getTime() + offsetTime.getTimezoneOffset() * 60 * 1000);
                                    row.date = offsetTime;
                                }
                                return row;
                            }));

                            if (lineColors && lineColors[category]) {
                                if (!graphData.colors) graphData.colors = [];
                                graphData.colors.push(lineColors[category]);
                            }
                        });

                    }

                    done();
                };


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
                    view_description: dataSourceDescription.fe_views.views.lineGraph.description ? dataSourceDescription.fe_views.views.lineGraph.description : "",
                    //
                    groupBy: groupBy,
                    groupBy_isDate: groupBy_isDate,
                    // lineColors: dataSourceDescription.fe_lineGraph_stackedLineColors ? dataSourceDescription.fe_lineGraph_stackedLineColors : {},
                    groupBy_outputInFormat: groupBy_outputInFormat,
                    displayTitleOverrides:  _.cloneDeep(dataSourceDescription.fe_displayTitleOverrides),
                    //
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
                    colNames_orderedForGroupByDropdown: importedDataPreparation.HumanReadableFEVisibleColumnNamesWithSampleRowObject_orderedForDropdown(sampleDoc, dataSourceDescription, 'lineGraph', 'GroupBy'),
                    colNames_orderedForSortByDropdown: importedDataPreparation.HumanReadableFEVisibleColumnNamesWithSampleRowObject_orderedForSortByDropdown(sampleDoc, dataSourceDescription),
                    //
                    routePath_base: routePath_base,
                    // datasource relationship
                    mapping_source_pKey: mapping_source_pKey,
                    mapping_default_filterObj: mapping_default_filterObj,
                    mapping_default_view: mapping_default_view,
                    mapping_groupByObj: mapping_groupByObj,
                    // multiselectable filter fields
                    multiselectableFilterFields: dataSourceDescription.fe_filters.fieldsMultiSelectable,
                    // Aggregate By
                    colNames_orderedForAggregateByDropdown: importedDataPreparation.HumanReadableFEVisibleColumnNamesWithSampleRowObject_orderedForDropdown(sampleDoc, dataSourceDescription, 'lineGraph', 'AggregateBy', 'ToInteger'),
                    defaultAggregateByColumnName_humanReadable: defaultAggregateByColumnName_humanReadable,
                    aggregateBy: aggregateBy,
                    // graphData contains all the data rows; used by the template to create the linechart
                    graphData: graphData,
                    defaultView: config.formatDefaultView(dataSourceDescription.fe_views.default_view),
                    isPreview: askForPreview
                };

                callback(err, data);
            });
        })
        .catch(function (err) {
            //error handling

            winston.error("❌  cannot bind Data to the view, error: ", err);
        });
}