import GQLTypeTemplate from '../../templates/GQLTypeTemplate.html';

export default function () {
  return {
    restrict: 'A',
    scope: {
      gqlType: '='
    },
    template: GQLTypeTemplate
  };
}
