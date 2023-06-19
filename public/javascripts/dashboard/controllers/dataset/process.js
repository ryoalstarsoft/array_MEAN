angular.module('arraysApp')
    .controller('DatasetProcessCtrl', ['$scope', '$state', '$mdToast', 'dataset', 'additionalDatasources', 'DatasetService', '$location', '$q', 'Job', '$timeout', 'User', 'Team',
        function($scope, $state, $mdToast, dataset, additionalDatasources, DatasetService, $location, $q, Job, $timeout, User, Team) {

            //-- helper functions ---//

            function errorHandler(response) {
                var error = response.data.error;
                $scope.importLogger.push('❌ Import failed due to ' + error);

                $scope.inProgress = false;
            }

            function getJobAndLog (datasetId) {

                if ($scope.jobs.length == 0) {
                    return;
                }


                if (!$scope.jobs[$scope.jobs.length - 1].state || $scope.jobs[$scope.jobs.length - 1].state == 'active' ||
                    $scope.jobs[$scope.jobs.length - 1].state == 'inactive') {

                    Job.get({id: $scope.currentJobId}).$promise.then(function(job) {

                        job.log = $scope.jobs[$scope.jobs.length - 1].log;

                        $scope.jobs[$scope.jobs.length - 1] = job;

                        Job.getLog({id: $scope.currentJobId}).$promise
                            .then(function(logs) {
                                $scope.jobs[$scope.jobs.length - 1].log = logs[logs.length - 1];

                                $timeout(function() {
                                    getJobAndLog(datasetId);
                                }, 2000);
                            });
                    });

                } else if ($scope.jobs[$scope.jobs.length - 1].state == 'complete'){

                    getJobStatus(datasetId);

                } else if ($scope.jobs[$scope.jobs.length - 1].state == 'failed') {
                    $scope.inProgress = false;
                }

            }


            function preImport(id) {
                DatasetService.preImport(id)
                    .then(function (response) {

                        if (response.status == 200 && !response.data.error) {

                            $timeout(function() {
                                getJobStatus(id);
                            }, 1000);

                        } else {
                            errorHandler(response);
                        }
                    }, errorHandler);
            }


            // function refreshForm() {
            //     $scope.dirty = 0;
            //     $scope.imported = true;
            // }


            function getJobStatus(datasetId) {


                DatasetService.getJobStatus(datasetId)
                    .then(function(job) {


                        if (job.id == 0) {

                            lastStep();

                        } else {

                            if (typeof $scope.currentJobId == 'undefined' || $scope.currentJobId !== job.id) {
                                $scope.currentJobId = job.id;
                                $scope.jobs.push({});
                            }

                            getJobAndLog(datasetId);
                        }
                    });


            }

            function lastStep() {

                if (datasourceIndex == -1) {

                    $scope.$parent.$parent.dataset = dataset;

                    dataset.dirty = 0;
                    dataset.imported = true;

                } else {

                    $scope.additionalDatasources[datasourceIndex] = dataset;
                }

                datasourceIndex ++;

                if (datasourceIndex < $scope.additionalDatasources.length) {

                    $scope.currentWorkingDataset = $scope.additionalDatasources[datasourceIndex];

                    if ($scope.dirty == 3) {

                        postImport($scope.additionalDatasources[datasourceIndex]._id);

                    } else {

                        getJobStatus($scope.additionalDatasources[datasourceIndex]._id);

                    }

                } else {
                    allDone();
                }

            }


            function importProcess(id) {

                DatasetService.importProcessed(id)
                    .then(function (response) {
                        if (response.status == 200 && !response.data.error) {

                            $timeout(function() {
                                getJobStatus(id);
                            }, 1000);

                        } else {
                            errorHandler(response);
                        }
                    }, errorHandler);
            }

            function scrapeImages(id) {

                DatasetService.scrapeImages(id)
                    .then(function (response) {
                        if (response.status == 200 && !response.data.error) {

                            $timeout(function() {
                                getJobStatus(id);
                            }, 1000);


                        } else {

                            errorHandler(response);

                        }
                    }, errorHandler);

            }


            function postImport(id) {


                if ($scope.additionalDatasources.length == 0 || datasourceIndex !== -1) {

                    DatasetService.postImport(id)

                        .then(function (response) {
                            if (response.status == 200 && !response.data.error) {

                                $timeout(function() {
                                    getJobStatus(id);
                                }, 1000);

                            } else {
                                errorHandler(response);
                            }

                        }, errorHandler);

                } else {
                    lastStep();

                }
            }

            function allDone() {

                $scope.inProgress = false;

                // refreshForm();
                $scope.dirty = 0;
                $scope.imported = true;

                $scope.togglePublish();

                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Data imported!')
                        .position('top right')
                        .hideDelay(3000)
                );

                // only progress if first import, otherwise return to Content tab
                var nextState;

                if ( $scope.$parent.$parent.dataset.firstImport ) {
                // if ( $scope.$parent.$parent.dataset.firstImport == 2 ) {
                    // $scope.$parent.$parent.dataset.firstImport = 3;
                    nextState = 'dashboard.dataset.views';
                } else {
                    nextState = 'dashboard.dataset.data';
                }

                $state.transitionTo(nextState, {id: dataset._id}, {
                    reload: true,
                    inherit: false,
                    notify: true
                });

            }

            function importDatasource(datasource) {
                if(datasource.sample == true) {
                    $scope.user.sampleImported = true;
                    User.sampleImported( {id:$scope.user._id}, {sampleImported: true} );
                    window.Intercom('update', {
                        email: $scope.user.email,
                        "Sample Viz Created": $scope.user.sampleImported, // Boolean
                    });
                }

                //Send notification to Intercom when dataset is imported
                window.Intercom('trackEvent', 'Visualization Imported', {
                   viz_title: datasource.title,
                   sample: datasource.sample || false
                });

                //Send notification to Intercom when dataset is imported
                userengage('event.vizImported', {
                    viz_title: dataset.title,
                    sample: datasource.sample || false
                });

                var id = datasource._id;


                if ($scope.additionalDatasources.length == 0) {


                    if (datasource.dirty == 1) {
                        preImport(id);
                    } else if (datasource.dirty == 2) {
                        importProcess(id);
                    } else if (datasource.dirty == 3) {
                        postImport(id);
                    } else if (datasource.dirty == 4) {
                        scrapeImages(id);
                    }

                } else {


                    if ($scope.dirty == 1) {
                        preImport(id);
                    } else if ($scope.dirty == 2) {
                        importProcess(id);
                    } else if ($scope.dirty == 3) {
                        postImport(id);
                    } else if ($scope.dirty == 4) {
                        scrapeImages(id);
                    }

                }

            }
            // -- end helper functions --- //

            //this block has to come first, do not move

            if (dataset.jobId !== 0) {
                $scope.inProgress = true;

                getJobStatus(dataset._id);

            } else {
                $scope.inProgress = false;
            }
            //----

            $scope.primaryAction.text = ''; // will hide button
            $scope.primaryAction.do = angular.noop(); // overwrite with noop, just in case

            $scope.$watch('dirty', function(dirty) {
                if(dirty && !$scope.inProgress && dataset.fileName) {
                    $scope.importData();
                }
            });

            $scope.showAdvanced = false;
            $scope.toggleShowAdvanced = function() {
                $scope.showAdvanced = !$scope.showAdvanced; // #flip_it
            };
            $scope.$parent.$parent.dataset = dataset;
            $scope.additionalDatasources = additionalDatasources;
            $scope.currentWorkingDataset;
            $scope.$parent.$parent.currentNavItem = '';
            $scope.importLogger = [];
            $scope.datasetsToProcess = [];
            $scope.currentWorkingDataset = $scope.$parent.$parent.dataset;


            $scope.datasetsToProcess[$scope.$parent.$parent.dataset._id] = {uid: $scope.$parent.$parent.dataset.fileName};


            $scope.jobs = [];
            $scope.currentJobId = undefined;

            DatasetService.getReimportDatasets(dataset._id)
                .then(function(datasets) {

                    $scope.additionalDatasources = $scope.additionalDatasources.concat(datasets);

                    $scope.additionalDatasources.map(function(ds) {


                        $scope.datasetsToProcess[ds._id] = {uid: ds.fileName};
                    });
                });


            $scope.dirty = (dataset.connection && !dataset.fileName) ? 0 : $scope.$parent.$parent.dataset.dirty;


            $scope.imported =  (dataset.connection && !dataset.fileName) ? true : $scope.$parent.$parent.dataset.imported;


            $scope.additionalDatasources.forEach(function(datasource) {


                if ($scope.dirty == 0 && datasource.dirty > 0) {
                    $scope.dirty = datasource.dirty;
                }

                if ( (datasource.dirty !== 0 && datasource.dirty < $scope.dirty) ||
                       ($scope.dirty == 0 && datasource.dirty > $scope.dirty) ) {
                    $scope.dirty = datasource.dirty;
                }
                $scope.imported = $scope.imported && datasource.imported;

                if (dataset.jobId == 0 && datasource.jobId !== 0) {

                    $scope.inProgress = true;
                    $scope.currentWorkingDataset = datasource;
                    getJobStatus(datasource._id);
                    return false;
                }

            });


            $scope.killCurrentJob = function() {


                if ($scope.currentJobId !== null) {
                    DatasetService.killJob($scope.currentWorkingDataset._id)
                        .then(function(res) {
                            if (res.status == 200 && res.data == 'ok') {
                                $scope.inProgress = false;
                                $scope.jobs = [];
                                $scope.currentJobId = null;
                            }

                        });
                }


            };


            var datasourceIndex = -1;

            $scope.togglePublish = function() {
                DatasetService.update($scope.$parent.$parent.dataset._id, {isPublic: $scope.$parent.$parent.dataset.isPublic});
            };

            $scope.toggleImageScraping = function() {
                DatasetService.update($scope.$parent.$parent.dataset._id, {skipImageScraping:
                    $scope.$parent.$parent.dataset.skipImageScraping});
            };


            $scope.importData = function() {
                // datasourceIndex = -1;
                if ($scope.$parent.$parent.dataset.fileName) {
                    $scope.inProgress = true;
                    $scope.jobs = [];
                    importDatasource($scope.$parent.$parent.dataset);

                }

            };
        }
    ]);