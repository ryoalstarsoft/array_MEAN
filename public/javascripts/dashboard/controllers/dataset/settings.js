angular.module('arraysApp')
    .controller('DatasetSettingsCtrl', ['$scope', '$state', 'dataset', 'DatasetService', '$mdToast', 'FileUploader', 'AssetService', '$filter', '$window', 'viewUrlService',
        function($scope, $state, dataset, DatasetService, $mdToast, FileUploader, AssetService, $filter, $window, viewUrlService) {

            // primary actions
            var _submitForm = function() {
                $scope.submitForm();
            };
            var _viewViz = function() {
                var url;
                if ($scope.team.isEnterprise) {
                    url = viewUrlService.getViewUrl($scope.subdomain, dataset,null, false);
                } else {
                    url = viewUrlService.getViewUrl($scope.subdomain, dataset, dataset.fe_views.default_view, false);
                }

                $window.open(url, '_blank');
            };


            $scope.$watch('vm.settingsForm.$valid', function(validity) {
                if (validity !== undefined) {
                    $scope.formValidity = validity;
                    $scope.primaryAction.disabled = !validity;
                }
            });

            $scope.$watch('vm.settingsForm.$dirty', function(dirty) {
                $scope.setRemindUserUnsavedChanges(dirty);

                if (dirty) {
                    $scope.primaryAction.text = 'Save';
                    $scope.primaryAction.do = _submitForm;

                    $scope.secondaryAction.text = 'Revert';
                    $scope.secondaryAction.disabled = false;
                    $scope.secondaryAction.do = function() {
                        $state.reload(); // lazy revert solution
                    };
                } else { // false or undefined
                    $scope.primaryAction.text = 'View';
                    $scope.primaryAction.do = _viewViz;

                    $scope.secondaryAction.text = '';
                }
            }, true);

            $scope.$parent.$parent.discardChangesThisView = angular.noop;

            /**
             * Commenting out for now as we are no longer auto-updating these settings
             * and give the user the option to revert changes.
             */
            $scope.$watch('dataset.brandColor', function (newValue, oldValue) {
                if(newValue !== oldValue) {
                    $scope.vm.settingsForm.$setDirty();
                }
                // if(dataset.imported) {
                //     DatasetService.update($scope.$parent.$parent.dataset._id, {brandColor: dataset.brandColor});
                // }
            }, true);

            $scope.tutorial.message = 'Here you can edit how your visualization looks on your team page.';

            // still needed now that this step comes later?
            if (!dataset.fe_listed) {dataset.fe_listed = false;}
            if (!dataset.brandColor) {dataset.brandColor = '#FEB600';} // default to Arrays orange

            if (!dataset.importRevision) {dataset.importRevision = 1;}

            if ($filter('isSuperAdmin')(dataset.author) ) {
                $scope.showOnArraysCo = (dataset.state == 'approved');
            }

            $scope.$parent.$parent.dataset = dataset;
            /**
             * If you've made is to the Display tab, everything should be set and the firstImport is completed.
             */
            if (dataset.firstImport) {
                dataset.firstImport = 0;
                DatasetService.update($scope.$parent.$parent.dataset._id, { firstImport: 0 });
            }

            $scope.$parent.$parent.currentNavItem = 'settings';

            /**
             * Commenting out for now as we are no longer auto-updating these settings
             * and give the user the option to revert changes.
             */
            // $scope.updatePublishSettings = function() {
            //     if(!dataset.fe_visible) {
            //         dataset.isPublic = false;
            //         dataset.fe_listed = false;
            //     } else {
            //         if(dataset.imported) {
            //             DatasetService.update($scope.$parent.$parent.dataset._id,
            //                 {isPublic: dataset.isPublic, fe_visible: dataset.fe_visible, fe_listed: dataset.fe_listed}
            //             );
            //         }
            //     }
            // };

            $scope.listOnArraysRequest = function() {
                DatasetService.approvalRequest($scope.$parent.$parent.dataset._id, {state: 'pending'})
                    .then(function(response) {
                        if (response.status == 200 && response.data) {
                            $scope.$parent.$parent.dataset = response.data;
                            $mdToast.show(
                                $mdToast.simple()
                                    .textContent('Request submitted!')
                                    .position('top right')
                                    .hideDelay(3000)
                                );
                        }
                    });
            };

            $scope.updateListingOnArrays = function(approved) {

                if (dataset.imported) {

                    var appr = (approved == true ) ?  'approved' : 'disapproved';
                    DatasetService.approvalRequest($scope.$parent.$parent.dataset._id, {state: appr})
                        .then(function(response) {

                            if (response.status == 200 && response.data) {

                                if (!$filter('isSuperAdmin')(dataset.author)) {
                                    $scope.$parent.$parent.dataset = response.data;
                                    $mdToast.show(
                                        $mdToast.simple()
                                            .textContent('Listing status updated!')
                                            .position('top right')
                                            .hideDelay(3000)
                                        );
                                }

                            }
                        });

                } else {
                    if (approved == true) {
                        dataset.state = 'approved';
                    }
                }
            };


            $scope.submitForm = function() {

                $scope.submitting = true;

                if (!dataset.author) {
                    dataset.author = $scope.user._id;
                    dataset._team = $scope.team._id;
                    dataset.fe_displayTitleOverrides = {};
                }

                dataset.updatedBy = $scope.user._id;

                var finalizedDataset = angular.copy(dataset);
                delete finalizedDataset.columns;

                DatasetService.save(finalizedDataset).then(function (response) {

                    if (response.status == 200) {

                        dataset.uid = $filter('datasourceUIDFromTitle')(dataset.title);

                        $mdToast.show(
                            $mdToast.simple()
                                .textContent('Visualization updated!')
                                .position('top right')
                                .hideDelay(3000)
                            );
                    }

                    $scope.submitting = false;
                    $scope.vm.settingsForm.$setPristine();

                    // NOTE attempting to open _blank here will fire pop up blocker,
                    // which is one the reasons the primary action button becomes "View"

                }, function (error) {
                    $mdToast.show(
                            $mdToast.simple()
                                .textContent(error)
                                .position('top right')
                                .hideDelay(3000)
                        );

                    $scope.submitting = false;
                });
            };

            // banner upload
            $scope.imageUploader = new FileUploader({
                method: 'PUT',
                disableMultipart: true,
                filters: [
                    {
                        name: 'imageFilter',
                        fn: function (item) {
                            var type = '|' + item.type.slice(item.type.lastIndexOf('/') + 1) + '|';
                            return '|jpg|png|jpeg|bmp|'.indexOf(type) !== -1;
                        }
                    }
                ],

            });

            $scope.imageUploader.onCompleteItem = function (fileItem, response, status) {
                if (status == 200) {
                    var reload = false;
                    if (dataset.banner) {
                        reload = true;
                    }

                    dataset.banner = fileItem.file.name;
                    DatasetService.save(dataset).then(function () {
                        if (reload) {
                            dataset.banner = dataset.banner + '?' + new Date().getTime();
                        }
                        $mdToast.show(
                            $mdToast.simple()
                                .textContent('Image uploaded!')
                                .position('top right')
                                .hideDelay(3000)
                        );
                    });
                }
            };


            $scope.makeUrl = function(bannerFileName) {
                if (bannerFileName.indexOf('http') >= 0) {
                    return bannerFileName;
                } else {
                    var url = 'https://' + $scope.env.s3Bucket + '.s3.amazonaws.com/' + $scope.team.subdomain +
                    '/datasets/' + $scope.dataset._id + '/assets/banner/' + bannerFileName;
                    return url;
                }
            };

            $scope.imageUploader.onBeforeUploadItem = function (item) {
                item.headers['Content-Type'] = item.file.type;
            };

            $scope.imageUploader.onAfterAddingFile = function (fileItem) {

                if ($scope.imageUploader.queue.length > 0) {
                    $scope.imageUploader.queue[0] = fileItem;
                }
                AssetService.getPutUrlForDatasetAssets($scope.dataset._id, fileItem.file.type, fileItem.file.name)
                    .then(function (urlInfo) {
                        fileItem.url = urlInfo.putUrl;
                        fileItem.publicUrl = urlInfo.publicUrl;
                        $scope.imageUploader.uploadAll();

                    });
            };

            $scope.deleteBanner = function() {
                AssetService.deleteBanner($scope.dataset._id).then(function (data) {
                    $scope.dataset.banner = data.dataset.banner;
                    $mdToast.show(
                        $mdToast.simple()
                            .textContent('Banner deleted.')
                            .position('top right')
                            .hideDelay(3000)
                    );
                    if ($scope.imageUploader.queue.length > 0) {
                        $scope.imageUploader.queue = [];
                    }
                });
            };

        }
    ]);