import _ from 'lodash';

function flattenType(gqlType) {
  if (gqlType.possibleTypes) {
    gqlType.possibleTypes = _.map(gqlType.possibleTypes, flattenType);
  }
  if (!gqlType.name && gqlType.ofType) return flattenType(gqlType.ofType);
  return gqlType;
}

function indentBy(str, indent) {
  if (indent) return `${indent + str}\n`;
  return str;
}


class QueryItem {
  constructor(Controller, name, type, args, breadcrumbs, initialize) {
    this.Controller = Controller;
    this.name = name;
    this.type = flattenType(type);
    this.breadcrumbs = breadcrumbs.slice(0);
    this.breadcrumbs.push(this);

    const variableNameBase = _.map(this.breadcrumbs.slice(1), bc => bc.name).join(' ');
    this.args = _.map(args, arg => ({
      info: arg.info || arg,
      value: `$${_.camelCase(`${variableNameBase} ${arg.name || arg.info.name}`)}`
    }));
    console.log(`Constructing ${this.name} with args:`, args);

    this.checked = false;
    this.indeterminate = false;
    this.selectedItemCount = 0;
    this.complex = !(this.type.kind === 'ENUM' || this.type.kind === 'SCALAR');

    this.initialized = false;
    if (initialize) {
      this.initializing = this.initialize();
    }
  }

  async initialize() {
    if (this.type.possibleTypes) {
      const types = await Promise.all(_.map(this.type.possibleTypes, possibleType => this.GQLService.getTypeInfo(possibleType)));
      const fields = _.flatten(_.map(types, _type => flattenType(_type).fields));
      _.each(fields, field => { field.type = flattenType(field.type); });
      this.type.fields = _.uniqBy(fields, duplicateType => `${duplicateType.name}:${duplicateType.type.name}`);
    }
    this.fields = _.map(this.type.fields, field => ({
      name: field.name,
      queryItem: new QueryItem(this.Controller.GQLService, field.name, flattenType(field.type), field.args, this.breadcrumbs, false)
    }));
    this.initialized = true;
    console.log(`Fields for ${this.name}:`, this.fields);
    console.log(`Args for ${this.name}:`, this.args);
  }


  toGQL(indent) {
    const baseIndent = indent ? _.repeat(indent, this.breadcrumbs.length - 1) : '';
    let res = baseIndent + this.name;
    const args = _.filter(_.map(this.args, arg => (arg.value ? `${arg.info.name}: ${arg.value}` : null)), x => x);
    if (!_.isEmpty(args)) {
      res += `(${args.join(',')})`;
    }

    if (this.complex && this.fields.length > 0) {
      res += '{';
      if (indent) res += '\n';
      _.each(this.fields, field => {
        if (field.queryItem && field.queryItem.isSelected()) {
          res += `${field.queryItem.toGQL(indent)} `;
          if (indent) res += '\n';
        }
      });
      res += `${baseIndent}}`;
    }
    return res;
  }

  toObject() {
    const res = {
      name: this.name,
      type: this.type.name,
      args: _.map(this.args, arg => ({ name: arg.info.name, value: arg.value }))
    };
    if (this.complex && this.fields.length > 0) {
      res.fields = [];
      _.each(this.fields, field => {
        if (field.queryItem && field.queryItem.isSelected()) {
          res.fields.push(field.queryItem.toObject());
        }
      });
    }
    return res;
  }

  isSelected() {
    return this.checked || this.indeterminate;
  }

  selectField(field) {
    if (field.queryItem.complex) {
      if (!field.queryItem.initialized) {
        return this.Controller.GQLService.getTypeInfo(field.queryItem.type).then(type => {
          field.queryItem = new QueryItem(this.Controller, field.name, type, field.queryItem.args, this.breadcrumbs, true);
          field.queryItem.checked = true;
          field.queryItem.updateSelectionStatus();
          return field;
        });
      }
    } else {
      field.queryItem.checked = !field.queryItem.checked;
    }
    field.queryItem.updateSelectionStatus();
    return Promise.resolve(field);
  }

  updateSelectionStatus() {
    if (this.initializing) {
      this.initializing.then(() => {
        if (this.fields.length > 0) {
          let count = 0;
          _.each(this.fields, field => {
            if (field.queryItem && field.queryItem.isSelected()) count++;
          });
          this.selectedFieldCount = count;
          this.checked = this.selectedFieldCount >= this.fields.length;
          this.indeterminate = this.selectedFieldCount > 0 && this.selectedFieldCount < this.fields.length;
        }
      });
    }
    // bubble the event
    if (this.breadcrumbs.length > 1) {
      const parent = this.breadcrumbs[this.breadcrumbs.length - 2];
      parent.updateSelectionStatus();
    } else {
      this.Controller.saveQueriesThrottled();
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
      this.loadQueries();
    });

    this.saveQueriesThrottled = _.throttle(() => this.saveQueries(), 500);
  }

  async addQuery() {
    await this.mainCtrl.typesPromise;
    const newQuery = {
      name: 'New query',
      root: new QueryItem(this, 'Query', this.baseType, [], [], true)
    };
    newQuery.currentItem = newQuery.root;
    this.queries.push(newQuery);
    this.selectedQuery = newQuery;
    this.saveQueriesThrottled();
  }

  openField(field) {
    const currentItem = this.selectedQuery.currentItem;
    currentItem.selectField(field).then(() => {
      this.selectedQuery.currentItem = field.queryItem;
      this.saveQueriesThrottled();
    });
  }

  saveQueries() {
    localStorage.setItem('gql-queries', JSON.stringify(_.map(
      this.queries,
      query => ({
        name: query.name,
        obj: query.root ? query.root.toObject() : query.obj
      })
    )));
  }

  queryItemFromObject(obj, baseItem) {
    _.each(obj.fields, fieldObject => {
      const field = _.find(baseItem.fields, { name: fieldObject.name });
      baseItem.selectField(field).then(fieldInfo => {
        _.each(fieldObject.args, argObj => {
          const arg = _.find(fieldInfo.queryItem.args, argument => argument.info.name === argObj.name);
          arg.value = argObj.value;
        });
        this.queryItemFromObject(fieldObject, fieldInfo.queryItem);
      });
    });
    /*
    const name = obj.name;
    this.complex = !(this.type.kind === 'ENUM' || this.type.kind === 'SCALAR');
    this.checked = true;
    this.indeterminate = false;
    this.breadcrumbs = breadcrumbs.slice(1);
    // await this.GQLService.getTypeInfo(type);
    const queryItem = new QueryItem(this.GQLService, obj.name, type, breadcrumbs);
    return */
  }

  loadQueries() {
    const info = localStorage.getItem('gql-queries');
    if (info) {
      // we lazy load the queries later
      this.queries = JSON.parse(info);
    }
  }

  async selectQuery(query) {
    if (query.root) {
      // this is a fully qualified query.
      this.selectedQuery = query;
    } else {
      // lazy load the query.
      query.root = new QueryItem(this, 'Query', this.baseType, [], [], true);
      await this.queryItemFromObject(query.obj, query.root);
      query.currentItem = query.root;
      this.selectedQuery = query;
    }
  }
}
