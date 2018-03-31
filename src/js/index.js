import angular from 'angular';
import angularMaterial from 'angular-material';
import angularAnimate from 'angular-animate';
import angularAria from 'angular-aria';
import angularCookies from 'angular-cookies';
import angularUIRouter from 'angular-ui-router';

import MainController from './controllers/MainController';
import QueryBuilderController from './controllers/QueryBuilderController';
import GQLService from './services/GQLService';
import GQLTypeDirective from './directives/GQLTypeDirective';
import { typeList, typeState, queryList, queryState } from './states';

import '../css/index.scss';
import '../html/TypeInfo.html';
import '../html/QueryBuilder.html';

const app = angular.module('gqlApp', [angularAria, angularAnimate, angularMaterial, angularUIRouter, angularCookies]);


app.controller('MainController', MainController);
app.controller('QueryBuilderController', QueryBuilderController);
app.service('GQLService', GQLService);
app.directive('gqlType', GQLTypeDirective);

app.run($q => {
  'ngInject';

  window.Promise = $q;
});


app.config(($locationProvider, $stateProvider) => {
  'ngInject';

  $locationProvider.html5Mode(true);
  $stateProvider.state('types', typeList);
  $stateProvider.state('types.type', typeState);
  $stateProvider.state('queries', queryList);
  $stateProvider.state('queries.query', queryState);
});
