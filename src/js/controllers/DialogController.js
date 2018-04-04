export default class DialogController {
  constructor($scope, $mdDialog) {
    'ngInject';

    this.$scope = $scope;
    this.$mdDialog = $mdDialog;
  }

  hide() {
    this.$mdDialog.hide();
  }

  cancel() {
    this.$mdDialog.cancel();
  }

  answer(answer) {
    this.$mdDialog.hide(answer);
  }
}
