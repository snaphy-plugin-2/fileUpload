'use strict';
/*jslint browser: true*/
/*global $, jQuery, $snaphy, angular*/
angular.module($snaphy.getModuleName())
  //Routes are defined using ui.routes 
  .config(['$locationProvider', '$stateProvider', '$urlRouterProvider',
    function ($locationProvider, $stateProvider, $urlRouterProvider) {
      $locationProvider.html5Mode(false);
      //$urlRouterProvider.otherwise('/');

      $stateProvider
        //Provide routes in this way..
        .state('fileUpload', {
          url: '/fileUpload',
          templateUrl: '/fileUpload/views/fileUpload.html',
          controller: 'fileUploadControl'
        });

    }]); //config
