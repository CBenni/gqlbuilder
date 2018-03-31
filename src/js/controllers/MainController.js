import _ from 'lodash';
import config from '../config';

export default class {
  constructor($scope, $state, $stateParams, $transitions, GQLService) {
    'ngInject';

    this.$scope = $scope;
    this.$state = $state;
    this.$stateParams = $stateParams;
    this.config = config;

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

  selectTab(id) {
    console.log('$state.current:', this.$state.current);
    console.log('$stateParams:', this.$stateParams);
    this.$state.go(id);
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
}
