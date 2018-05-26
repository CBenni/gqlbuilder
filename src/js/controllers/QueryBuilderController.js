import _ from 'lodash';

import queryResultDialogTemplate from '../../templates/QueryResultDialogTemplate.html';
import editVariableDialogTemplate from '../../templates/EditVariableDialogTemplate.html';

export function flattenType(gqlType) {
  if (gqlType.possibleTypes) {
    gqlType.possibleTypes = _.map(gqlType.possibleTypes, flattenType);
  }
  if (!gqlType.name && gqlType.ofType) {
    const res = flattenType(gqlType.ofType);
    res.isList = gqlType.kind === 'LIST' || res.isList;
    return res;
  }
  return gqlType;
}
export function flattenNonNull(gqlType) {
  if (gqlType.possibleTypes) {
    gqlType.possibleTypes = _.map(gqlType.possibleTypes, flattenNonNull);
  }
  if (!gqlType.name && gqlType.ofType && gqlType.kind === 'NON_NULL') {
    return flattenNonNull(gqlType.ofType);
  }
  return gqlType;
}

export function marshalAsType(string, type) {
  if (type.kind === 'LIST') {
    let list;
    try {
      list = JSON.parse(string);
    } catch (err) {
      list = _.filter(string.split(/\W/g));
    }
    return _.map(list, listItem => marshalAsType(listItem, type.ofType));
  } else if (type.kind === 'NON_NULL') {
    if (string) return marshalAsType(string, type.ofType);
    throw new Error('Property is non-null.');
  } else if (type.kind === 'ENUM') {
    return string;
  } else if (type.name === 'Int') {
    const int = parseInt(string, 10);
    if (Number.isNaN(int)) {
      throw new Error('Property is not a number.');
    } else {
      return int;
    }
  } else if (type.name === 'Float') {
    const int = parseFloat(string);
    if (Number.isNaN(int)) {
      throw new Error('Property is not a number.');
    } else {
      return int;
    }
  } else if (type.name === 'String' || type.name === 'Cursor' || type.name === 'ID') {
    return string;
  } else {
    try {
      return JSON.parse(string);
    } catch (err) {
      return string;
    }
  }
}

function typeToString(type) {
  if (type.kind === 'LIST') return `[${typeToString(type.ofType)}]`;
  if (type.kind === 'NON_NULL') return `${typeToString(type.ofType)}!`;
  return type.name || typeToString(type.ofType);
}

class QueryItem {
  constructor(Controller, name, type, args, breadcrumbs, initialize, isRoot) {
    this.Controller = Controller;
    this.name = name;
    this.type = flattenType(type);
    this.breadcrumbs = breadcrumbs.slice(0);
    this.breadcrumbs.push(this);
    this.isRoot = isRoot;

    const variableNameBase = _.map(this.breadcrumbs.slice(1), bc => bc.name).join(' ');
    this.args = _.map(args, arg => ({
      info: arg.info || arg,
      value: `$${_.camelCase(`${variableNameBase} ${arg.name || arg.info.name}`)}`
    }));

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
  }


  getGQLName() {
    return (this.isRoot ? `${this.type.name.toLowerCase()} ` : '') + (this.name || 'Unnamed query').replace(/\s/g, '_').replace(/\W/g, '');
  }

  toGQL(indent, variables) {
    const baseIndent = indent ? _.repeat(indent, this.breadcrumbs.length - 1) : '';
    let res = '';
    res = baseIndent + this.getGQLName();
    // inject variables
    if (this.isRoot) res += `(${this.injectVariablesToGQL()})`;
    const args = _.filter(_.map(this.args, arg => (arg.value ? `${arg.info.name}: ${arg.value}` : null)), x => x);
    if (!_.isEmpty(args)) {
      res += `(${args.join(',')}) `;
    }

    if (this.complex && this.fields.length > 0) {
      res += '{';
      if (indent) res += '\n';
      _.each(this.fields, field => {
        if (field.queryItem && field.queryItem.isSelected()) {
          res += `${field.queryItem.toGQL(indent, variables)} `;
          if (indent) res += '\n';
        }
      });
      res += `${baseIndent}}`;
    }
    return res;
  }

  injectVariablesToGQL() {
    if (!this.isRoot) throw new Error('Can only be used on the root queryItem!');
    return _.map(this.collectVariables(), collectedVariable => {
      const variableName = collectedVariable.value;
      const variableType = collectedVariable.info.type;
      return `${variableName}: ${typeToString(variableType)}`;
    }).join(', ');
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

  collectVariables() {
    const vars = [];
    _.each(this.fields, field => {
      if (field.queryItem && field.queryItem.isSelected()) {
        _.each(field.queryItem.args, arg => {
          if (arg.value[0] === '$') {
            arg.info.flattenedType = flattenType(arg.info.type);
            vars.push(arg);
          }
        });
        if (field.queryItem.complex) {
          Array.prototype.push.apply(vars, field.queryItem.collectVariables());
        }
      }
    });
    return vars;
  }

  isSelected() {
    return this.checked || this.indeterminate;
  }

  selectField(field) {
    if (field.queryItem.complex) {
      if (!field.queryItem.initialized) {
        return this.Controller.GQLService.getTypeInfo(field.queryItem.type).then(type => {
          field.queryItem = new QueryItem(this.Controller, field.name, type, field.queryItem.args, this.breadcrumbs, true);
          // field.queryItem.checked = true;
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
      this.Controller.onChange();
    }
  }
}

export default class QueryBuilderController {
  constructor($scope, $timeout, $mdDialog, GQLService) {
    'ngInject';

    this.mainCtrl = $scope.$parent.mainCtrl;
    this.GQLService = GQLService;
    this.$mdDialog = $mdDialog;
    this.$timeout = $timeout;
    this.queries = [];
    this.authToken = localStorage.getItem('gql-authtoken') || '';
    this.storeToken = !!this.authToken;

    $scope.flattenType = flattenType;

    this.selectedQuery = null;
    this.useVariables = true;
    this.mainCtrl.typesPromise.then(() => {
      this.baseType = _.find(this.mainCtrl.types, { name: 'Query' });
      this.baseMutation = _.find(this.mainCtrl.types, { name: 'Mutation' });
      this.GQLService.getTypeInfo(this.baseType);
      this.GQLService.getTypeInfo(this.baseMutation);
      this.loadQueries();
    });

    this.saveQueriesThrottled = _.throttle(() => this.saveQueries(), 500);
  }

  async addQuery() {
    await this.mainCtrl.typesPromise;
    const newQuery = {
      root: new QueryItem(this, 'New Query', this.baseType, [], [], true, true),
      collectedVariables: [],
      variables: {}
    };
    newQuery.currentItem = newQuery.root;
    this.queries.push(newQuery);
    this.selectedQuery = newQuery;
    this.onChange();
  }

  async addMutation() {
    await this.mainCtrl.typesPromise;
    const newMutation = {
      root: new QueryItem(this, 'New Mutation', this.baseMutation, [], [], true, true),
      collectedVariables: [],
      variables: {}
    };
    newMutation.currentItem = newMutation.root;
    this.queries.push(newMutation);
    this.selectedQuery = newMutation;
    this.onChange();
  }

  deleteQuery($event, query) {
    const confirm = this.$mdDialog.confirm()
    .title('Delete query')
    .textContent(`Are you sure you want to delete query ${query.name}.`)
    .targetEvent($event)
    .ok('Yes')
    .cancel('No');
    this.$mdDialog.show(confirm).then(() => {
      _.pull(this.queries, query);
      this.onChange();
    });
  }

  clickField(field) {
    if (field.queryItem.complex) {
      const currentItem = this.selectedQuery.currentItem;
      currentItem.selectField(field).then(() => {
        this.selectedQuery.currentItem = field.queryItem;
      });
    } else {
      this.selectedQuery.currentItem.selectField(field);
    }
  }

  saveQueries() {
    localStorage.setItem('gql-queries', JSON.stringify(_.map(
      this.queries,
      query => ({
        name: query.name,
        obj: query.root ? query.root.toObject() : query.obj,
        variables: query.variables
      })
    )));
  }

  collectVariables(query) {
    if (!query) return [];
    query.collectedVariables = query.root.collectVariables();
    _.each(query.collectedVariables, variable => {
      if (!query.variables[variable.value]) query.variables[variable.value] = '';
    });
    return query.collectedVariables;
  }

  onChange() {
    this.saveQueriesThrottled();
    this.$timeout(() => { this.collectVariables(this.selectedQuery); }, 1);
  }

  queryItemFromObject(obj, baseItem) {
    return Promise.all(_.map(obj.fields, fieldObject => {
      const field = _.find(baseItem.fields, { name: fieldObject.name });
      return baseItem.selectField(field).then(fieldInfo => {
        _.each(fieldObject.args, argObj => {
          const arg = _.find(fieldInfo.queryItem.args, argument => argument.info.name === argObj.name);
          arg.value = argObj.value;
        });
        return this.queryItemFromObject(fieldObject, fieldInfo.queryItem);
      });
    }));
  }

  getMarshalError(variable) {
    try {
      marshalAsType(this.selectedQuery.variables[variable.value], variable.info.type);
      return null;
    } catch (err) {
      return `${err}`;
    }
  }

  testQuery($event, query) {
    const marshaledVariables = {};
    _.each(query.collectedVariables, variableInfo => {
      marshaledVariables[variableInfo.value] = marshalAsType(query.variables[variableInfo.value], variableInfo.info.type);
    });
    const queryResultPromise = this.GQLService.gqlQuery(
      `${query.root.toGQL('  ', {})} `,
      marshaledVariables,
      { Authorization: this.authToken && `OAuth ${this.authToken}` }
    )
    .then(data => JSON.stringify(data, null, 2));
    this.$mdDialog.show({
      controller: 'DialogController',
      template: queryResultDialogTemplate,
      targetEvent: $event,
      clickOutsideToClose: true,
      resolve: {
        queryResult: () => queryResultPromise
      },
      bindToController: true,
      controllerAs: 'dialogCtrl'
    });
  }

  checkQuery(query) {
    const marshaledVariables = {};
    try {
      _.each(query.collectedVariables, variableInfo => {
        marshaledVariables[variableInfo.value] = marshalAsType(query.variables[variableInfo.value], variableInfo.info.type);
      });
    } catch (err) {
      return false;
    }
    return true;
  }

  loadQueries() {
    const info = localStorage.getItem('gql-queries');
    if (info) {
      // we lazy load the queries later
      this.queries = JSON.parse(info);
    }
  }

  getEnumValues(type) {
    if (type.enumValues) return type.enumValues;
    if (type.infoPromise) return null;
    type.infoPromise = this.GQLService.getTypeInfo(type);
    return null;
  }

  async selectQuery(query) {
    if (query.root) {
      // this is a fully qualified query.
      this.selectedQuery = query;
    } else {
      // lazy load the query.
      this.selectedQuery = null;
      query.root = new QueryItem(this, query.obj.name, _.find(this.mainCtrl.types, { name: query.obj.type }), [], [], true, true);
      await this.queryItemFromObject(query.obj, query.root);
      query.currentItem = query.root;
      query.collectedVariables = [];
      if (!query.variables) query.variables = {};
      this.selectedQuery = query;
      this.collectVariables(query);
    }
  }

  saveAuth() {
    if (this.storeToken) {
      localStorage.setItem('gql-authtoken', this.authToken);
    } else {
      localStorage.removeItem('gql-authtoken');
    }
  }

  editVariable($event, variable) {
    console.log('Editing variable: ', variable);
    this.$mdDialog.show({
      controller: 'EditVariableController',
      template: editVariableDialogTemplate,
      targetEvent: $event,
      clickOutsideToClose: true,
      resolve: {
        typeInfo: () => this.GQLService.getTypeInfo(variable.info.flattenedType)
      },
      locals: {
        variable,
        variables: this.selectedQuery.variables,
        queryCtrl: this
      },
      bindToController: true,
      controllerAs: 'editVarCtrl'
    }).then(() => {
      this.onChange();
    });
  }

  async marshalAsComplex(obj, type, breadcrumbs) {
    let typeInfo = type;
    if (type.kind !== 'NON_NULL' && type.kind !== 'SCALAR') {
      typeInfo = await this.GQLService.getTypeInfo(type);
    }
    // console.log('Marshaling', obj, 'to', type);
    if (typeInfo.kind === 'NON_NULL') {
      if (!obj) throw new Error(`${breadcrumbs} shouldnt be null!`);
      return this.marshalAsComplex(obj, typeInfo.ofType, breadcrumbs);
    } else if (typeInfo.kind === 'SCALAR') {
      if (!obj) return undefined;
      if (typeInfo.name === 'Int' || typeInfo.name === 'Float' || typeInfo.name === 'Double') {
        const num = typeInfo.name === 'Int' ? parseInt(obj, 10) : parseFloat(obj);
        if (Number.isNaN(num)) {
          throw new Error(`${breadcrumbs} is not a number.`);
        } else {
          return num;
        }
      } else if (typeInfo.name === 'String' || typeInfo.name === 'Cursor' || typeInfo.name === 'ID') {
        return `${obj}`;
      } else {
        return obj;
      }
    } else if (typeInfo.kind === 'ENUM') {
      if (!obj) return undefined;
      if (!typeInfo.enumValues.includes(obj)) {
        throw new Error(`Invalid enum value for ${breadcrumbs}`);
      }
      return obj;
    } else if (typeInfo.kind === 'LIST') {
      if (!obj) return undefined;
      if (!_.isArrayLikeObject(obj)) {
        try {
          obj = JSON.parse(obj);
        } catch (err) {
          // noop
        }
      }
      if (_.isArrayLikeObject(obj)) {
        const innerType = this.GQLService.getTypeInfo(typeInfo.ofType);
        return Promise.all(_.map(obj, (item, index) => this.marshalAsComplex(item, innerType, `${breadcrumbs}[${index}]`)));
      }
      throw new Error(`${breadcrumbs} is an invalid list`);
    } else if (typeInfo.kind === 'INPUT_OBJECT') {
      if (!obj) return undefined;
      if (!_.isObjectLike(obj)) {
        try {
          obj = JSON.parse(obj);
        } catch (err) {
          // noop
        }
      }
      if (_.isObjectLike(obj)) {
        _.each(obj, (val, key) => {
          if (!_.find(typeInfo.inputFields, { name: key })) throw new Error(`Unknown field ${breadcrumbs} ⟩ ${key}`);
        });
        return Promise.all(_.map(typeInfo.inputFields, async field => {
          obj[field.name] = await this.marshalAsComplex(obj[field.name], field.type, `${breadcrumbs} ⟩ ${field.name}`);
        })).then(() => obj);
      }
      throw new Error(`Invalid input object: ${obj}`);
    } else return obj;
  }
}
