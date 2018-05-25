import _ from 'lodash';
import DialogController from './DialogController';
import { flattenType } from './QueryBuilderController';

export default class EditVariableController extends DialogController {
  constructor($scope, $mdDialog) {
    'ngInject';

    super($scope, $mdDialog);

    this.$scope = $scope;

    try {
      this.values = JSON.parse(this.variables[this.variable.value]);
      console.log('Parsed variable value:', this.values);
    } catch (err) {
      console.error(err);
      this.values = {};
    }

    _.each(this.typeInfo.inputFields, field => {
      field.flattenedType = flattenType(field.type);
    });

    console.log('Type info:', this.typeInfo);
  }

  onChange() {
    this.variables[this.variable.value] = JSON.stringify(this.values);
    this.queryCtrl.onChange();
  }
}
