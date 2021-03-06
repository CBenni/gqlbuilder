import _ from 'lodash';
import config from '../config';
import typeInfoPartial from '../../html/TypeInfo.html';
import queryBuilderPartial from '../../html/QueryBuilder.html';

export default class {
  constructor($scope, $state, $stateParams, $transitions, GQLService) {
    'ngInject';

    this.$scope = $scope;
    this.$state = $state;
    this.$stateParams = $stateParams;
    this.config = config;

    $scope.typeInfoPartial = typeInfoPartial;
    $scope.queryBuilderPartial = queryBuilderPartial;
    console.log('Partial urls: ', [typeInfoPartial, queryBuilderPartial]);

    this.GQLService = GQLService;

    this.typesPromise = this.load();

    this.types = [];
    this.selectedType = null;

    if ($state.current.name === 'types.type') {
      this.selectType($state.params.typeName);
    }

    $transitions.onSuccess({ to: 'types.type' }, transition => {
      this.selectType(transition.params('to').typeName);
    });
  }

  load() {
    return this.GQLService.getAllTypes().then(types => {
      this.types = types;
    });
  }

  findType(typeName) {
    return this.typesPromise.then(() => _.find(this.types, { name: typeName }));
  }

  selectType(typeName) {
    this.findType(typeName).then(type => {
      this.selectedType = type;
      this.GQLService.getTypeInfo(type);
    });
  }

  debugLog(x) {
    console.log('Debug log: ', x);
  }
}
