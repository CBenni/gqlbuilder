import angular from 'angular';
import angularMaterial from 'angular-material';
import angularAnimate from 'angular-animate';
import angularAria from 'angular-aria';
import angularUIRouter from 'angular-ui-router';
import angularCookies from 'angular-cookies';

import MainController from './controllers/MainController';
import TypeInfoController from './controllers/TypeInfoController';
import GQLService from './services/GQLService';
import GQLTypeDirective from './directives/GQLTypeDirective';
import { typeState } from './states';

import '../css/index.scss';

const app = angular.module('gqlApp', [angularAria, angularAnimate, angularMaterial, angularUIRouter, angularCookies]);


app.controller('MainController', MainController);
app.controller('TypeInfoController', TypeInfoController);
app.service('GQLService', GQLService);
app.directive('gqlType', GQLTypeDirective);

app.run($q => {
  'ngInject';

  window.Promise = $q;
});


app.config(($locationProvider, $mdThemingProvider, $stateProvider) => {
  'ngInject';

  $locationProvider.html5Mode(true);
  $mdThemingProvider.generateThemesOnDemand(true);
  $stateProvider.state('typeInfo', typeState);
});
