import GQLQueryTemplate from '../../templates/GQLQueryTemplate.html';

export default function () {
  return {
    restrict: 'A',
    scope: {
      gqlQueryItem: '='
    },
    template: GQLQueryTemplate
  };
}
