import _ from 'lodash';
import config from '../config';

export default class {
  constructor($scope, GQLService) {
    'ngInject';

    this.$scope = $scope;
    this.config = config;
    this.GQLService = GQLService;

    this.load();
  }

  load() {
    this.GQLService.getAllTypes().then(types => {
      this.types = types;
    });
  }
}
