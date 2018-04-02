import _ from 'lodash';

function flattenType(gqlType) {
  if (!gqlType.name && gqlType.ofType) return flattenType(gqlType.ofType);
  return gqlType;
}

class QueryItem {
  constructor(GQLService, name, type, breadcrumbs, initialize) {
    this.GQLService = GQLService;
    this.name = name;
    this.type = flattenType(type);
    this.breadcrumbs = breadcrumbs.slice(0);
    this.breadcrumbs.push(this);

    this.checked = false;
    this.indeterminate = false;
    this.selectedItemCount = 0;
    this.complex = !(this.type.kind === 'ENUM' || this.type.kind === 'SCALAR');

    if (initialize) {
      this.args = _.map(this.type.args, arg => ({
        name: arg,
        value: ''
      }));
      this.fields = _.map(this.type.fields, field => ({
        name: field.name,
        type: flattenType(field.type),
        queryItem: new QueryItem(this.GQLService, field.name, flattenType(field.type), this.breadcrumbs, false)
      }));
    }
    this.initialized = initialize;
    console.log(`Fields for ${name}:`, this.fields);
  }

  toGQL() {
    let res = this.name;
    const args = _.map(this.args, arg => `${arg.name}: ${arg.value}`);
    if (!_.isEmpty(args)) res += `(${args.join(',')})`;

    if (this.fields.length > 0) {
      res += '{ ';
      _.each(this.fields, field => {
        if (field.queryItem && field.queryItem.isSelected()) {
          res += `${field.queryItem.toGQL()} `;
        }
      });
      res += '}';
    }
    return res;
  }

  isSelected() {
    return this.checked || this.indeterminate;
  }

  selectField(field) {
    if (!field.queryItem.initialized) {
      return this.GQLService.getTypeInfo(field.type).then(type => {
        field.queryItem = new QueryItem(this.GQLService, field.name, type, this.breadcrumbs, true);
        field.queryItem.checked = true;
        field.queryItem.updateSelectionStatus();
        return field;
      });
    }
    field.queryItem.updateSelectionStatus();
    return Promise.resolve(field);
  }

  updateSelectionStatus() {
    if (this.fields.length > 0) {
      let count = 0;
      _.each(this.fields, field => {
        if (field.queryItem && field.queryItem.isSelected()) count++;
      });
      this.selectedFieldCount = count;
      this.checked = this.selectedFieldCount >= this.fields.length;
      this.indeterminate = this.selectedFieldCount > 0 && this.selectedFieldCount < this.fields.length;
    }
    // bubble the event
    if (this.breadcrumbs.length > 1) {
      const parent = this.breadcrumbs[this.breadcrumbs.length - 2];
      parent.updateSelectionStatus();
    }
  }
}

export default class QueryBuilderController {
  constructor($scope, GQLService) {
    'ngInject';

    this.mainCtrl = $scope.$parent.mainCtrl;
    this.GQLService = GQLService;
    this.queries = [];

    this.selectedQuery = null;
    this.mainCtrl.typesPromise.then(() => {
      this.baseType = _.find(this.mainCtrl.types, { name: 'Query' });
      this.GQLService.getTypeInfo(this.baseType);
    });
  }

  addQuery() {
    const newQuery = {
      name: 'New query',
      root: new QueryItem(this.GQLService, 'Query', this.baseType, [], true)
    };
    newQuery.currentItem = newQuery.root;
    this.queries.push(newQuery);
    this.selectedQuery = newQuery;
  }

  openField(field) {
    const currentItem = this.selectedQuery.currentItem;
    currentItem.selectField(field).then(() => {
      this.selectedQuery.currentItem = field.queryItem;
    });
  }
}
