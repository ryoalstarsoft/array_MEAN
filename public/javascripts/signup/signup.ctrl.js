(function() {
	var signupModule = angular.module('signupModule');



	signupModule.controller('mainCtrl',['$scope','User','$state', function($scope,User,$state){
		$scope.user = {};




		$scope.createUser = function() {
			if (!$scope.user.provider) {
				$scope.user.provider = 'local';
			}

			if ($scope.user._id && !$scope.user._team) {
				$state.go('signup.info',{id: $scope.user._id});

			} else {
				var user = new User($scope.user);
				user.$save(function(user) {
					$state.go('signup.info',{id:user._id});
				});

			}
		}


	}])

	signupModule.controller('signupCtrl',['$scope','$stateParams','User','$state','$location','env',function($scope,$stateParams,User,$state,
		$location,env) {

		$scope.env = env;

		var userId = $stateParams.id;
		$scope.invitedUser = false;
		// $scope.showPasswordToolTip = false;
		$scope.user = User.get({id:userId},function() {

			if (!$scope.user._team || $scope.user._team.length == 0){
				$scope.user._team = {};

				if ($scope.env.node_env == 'enterprise' && $scope.env.subdomain) {
					$scope.user._team = {
						subdomain: $scope.env.subdomain
					}
					$scope.hideTeam = true;

				}

			} else {
				if ($scope.infoForm.subdomain) $scope.infoForm.subdomain.$setValidity('subdomainAvailable',false);
				$scope.invitedUser = true;
				$scope.user._team = $scope.user._team[0];
			}
		});

		$scope.registerUser = function() {
			User.update({id:$scope.user._id},$scope.user)
			.$promise
			.then(function(data) {
				if ($scope.invitedUser) {
					$state.go('signup.success',{isInvite: true,id:null});
				} else {
					if ($scope.user.activated) {
						$state.go('signup.success',{isInvite: true,id:null});
					} else {
						$state.go('signup.success',{isInvite: false,id:data._id});
					}
				}
			},function(err) {

			})

		}

	}])

	signupModule.controller('successCtrl',['$scope','$stateParams','$window',function($scope,$stateParams,$window) {
		$scope.isInvite = $stateParams.isInvite;
		if (!$scope.isInvite) {
			var userId = $stateParams.id;
			$scope.resendActivationLink = '/api/user/' + userId + '/resend?emailType=activation';
		}
		$scope.login = function() {
			$window.location.href = 'auth/login';
		}

	}])

	signupModule.controller('errorCtrl',['$scope','$stateParams','$window',function($scope,$stateParams,$window) {

		$scope.error = $stateParams.name;
		$scope.message = $stateParams.msg;
		$scope.login = function() {
			$window.location.href = 'auth/login';


		}

	}])


	signupModule.controller('passwordCtrl',['$scope','User','$stateParams','$window','$state',function($scope,User,$stateParams,
		$window,$state) {


		$scope.userId = $stateParams.userId;
		$scope.msg = $stateParams.msg;
		$scope.err = $stateParams.err;


		$scope.sendResetEmail = function() {
			User.resetPassword({id:$scope.user._id})
			.$promise
			.then(function(response) {
				if (response.data == 'ok') {
					$state.go('reset.success',{successMsg: 'Password reset email sent! Please check your email and follow the instructions to reset your account password.'});
				}
			},function(response) {
				$scope.err = response.data.err;
			})
		}

		$scope.updatePassword = function(pw) {
			var param = {
				password: pw
			}
			User.updateProfile({id: $scope.userId},param)
			.$promise
			.then(function(response) {
				if (response._id) {
					$scope.success = true;
				}

			},function(response) {

			})

		}

		$scope.login = function() {
			$window.location.href = 'auth/login';


		}


	}])



})();