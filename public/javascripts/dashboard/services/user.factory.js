(function () {
    angular.module('arraysApp')
        .factory('User', function ($resource) {
            return $resource('/api/user/:id', {id: '@_id'}, {
                search: {url: '/api/user/search', method: 'GET', isArray: true},
                update: {method: 'PUT'}, 
                getAll: {method:'GET', url: '/api/user/getAll/:teamId',isArray:true},
                checkPw: {method: 'POST', url: '/api/user/:id/checkPw'},
                updateProfile: {method: 'PUT', url: '/api/user/:id/updateProfile'},
                sampleImported: {method: 'PUT', url: 'api/user/sampleImported/:id'}
            });
        })
})();