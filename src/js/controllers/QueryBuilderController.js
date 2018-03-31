import _ from 'lodash';

export default class QueryBuilderController {
  constructor($scope, GQLService) {
    'ngInject';

    this.mainCtrl = $scope.$parent.mainCtrl;
    this.GQLService = GQLService;
    this.queries = [];

    this.selectedQuery = null;
    this.mainCtrl.typesPromise.then(types => {
      this.baseType = _.find(types, { name: 'Query' });
    });
  }

  addQuery() {
    const newQuery = {
      name: 'New query',
      type: this.baseType,
      fields: {}
    };
    this.queries.push(newQuery);
    this.selectedQuery = newQuery;
  }
}
