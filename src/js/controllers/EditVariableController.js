import _ from 'lodash';
import angular from 'angular';

import DialogController from './DialogController';
import { flattenNonNull, flattenType, marshalAsType } from './QueryBuilderController';

function replaceScalars(obj) {
  if (typeof (obj) !== 'object') return obj;
  _.each(obj, (val, key) => {
    if (val.$scalar) {
      obj[key] = marshalAsType(val.$scalar, { kind: 'SCALAR', name: val.$type });
    } else {
      replaceScalars(val);
    }
  });
  return obj;
}

function wrapScalars(list, type) {
  return _.each(list, (val, key) => {
    list[key] = { $scalar: val, $type: type };
  });
}

export default class EditVariableController extends DialogController {
  constructor($scope, $mdDialog, typeInfo, variable, variables, queryCtrl) {
    'ngInject';

    super($scope, $mdDialog);

    this.$scope = $scope;

    this.typeInfo = typeInfo;
    this.variable = variable;
    this.variables = variables;
    this.queryCtrl = queryCtrl;

    try {
      this.values = JSON.parse(this.variables[this.variable.value]);
      console.log('Parsed variable value:', this.values);
    } catch (err) {
      if (this.variables[this.variable.value]) console.error(err);
      this.values = {};
    }

    this.breadcrumbs = [];
    this.currentType = null;
    this.currentValues = null;

    this.selectItem(this.variable.value, this.typeInfo);
  }

  selectItem(name, typeInfo) {
    this.breadcrumbs.push({ name, typeInfo });
    this.currentType = typeInfo;
    if (this.breadcrumbs.length > 1) {
      const breadcrumbs = _.map(this.breadcrumbs.slice(1), breadcrumb => breadcrumb.name);
      this.currentValues = _.get(this.values, breadcrumbs);
      if (!this.currentValues) {
        let values = {};
        if (this.currentType.kind === 'LIST') values = [];
        _.set(this.values, breadcrumbs, values);
        this.currentValues = values;
      }
    } else this.currentValues = this.values;
    console.log('Current values: ', this.currentValues);

    if (this.currentType.kind === 'LIST') {
      const listType = flattenType(this.currentType);
      this.listType = listType;
      if (this.listType.kind === 'SCALAR') {
        this.currentValues = wrapScalars(this.currentValues, this.listType.name);
      }
      this.queryCtrl.GQLService.getTypeInfo(listType).then(() => {
        _.each(listType.inputFields, field => {
          field.flattenedType = flattenNonNull(field.type);
        });
        console.log('List type info:', this.listType);
      });
    } else {
      this.queryCtrl.GQLService.getTypeInfo(this.currentType).then(() => {
        _.each(typeInfo.inputFields, field => {
          field.flattenedType = flattenNonNull(field.type);
        });
        console.log('Type info:', this.typeInfo);
      });
    }
    this.onChange();
  }

  addListItem() {
    if (this.listType.name === 'String') this.currentValues.push({ $scalar: '', $type: this.listType.name });
    if (this.listType.name === 'Float' || this.listType.name === 'Integer') this.currentValues.push({ $scalar: 0, $type: this.listType.name });
    if (this.listType.name === 'Boolean') this.currentValues.push({ $scalar: false, $type: this.listType.name });
    if (this.listType.kind === 'INPUT_OBJECT') this.currentValues.push({});
    this.onChange();
  }

  deleteListItem(index) {
    this.currentValues.splice(index, 1);
    this.onChange();
  }

  selectBreadcrumb(breadcrumb, index) {
    this.breadcrumbs.splice(index);
    this.selectItem(breadcrumb.name, breadcrumb.typeInfo);
  }

  async onChange() {
    const replacedScalars = replaceScalars(angular.copy(this.values));
    let marshaled = null;
    // check the item by trying to marshal it.
    try {
      marshaled = await this.queryCtrl.marshalAsComplex(replacedScalars, this.typeInfo, this.variable.value);
      this.error = null;
    } catch (err) {
      marshaled = await this.queryCtrl.marshalAsComplex(replacedScalars, this.typeInfo, this.variable.value, true);
      this.error = err.toString();
    }
    if (marshaled) {
      this.variables[this.variable.value] = angular.toJson(marshaled);
      this.queryCtrl.onChange();
    }
  }
}
