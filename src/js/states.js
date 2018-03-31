import typeInfoTemplate from '../templates/TypeInfoTemplate.html';


export const typeState = {
  name: 'type',
  url: '/type/{typeName}',
  template: typeInfoTemplate,
  controller: 'TypeInfoController',
  controllerAs: 'typeCtrl',
  resolve: {
    typeInfo(GQLService, $transition$) {
      'ngInject';

      const response = GQLService.getTypeInfo($transition$.params().typeName);
      response.then(res => {
        console.log('typeInfo resolve: ', res);
      });
      return response;
    }
  }
};

export const indexState = {

};
