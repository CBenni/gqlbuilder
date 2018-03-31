import _ from 'lodash';
import config from '../config';

export default class GQLService {
  constructor($http) {
    'ngInject';

    this.$http = $http;

    this.typeCache = null;
    this.getAllTypes();
  }

  gqlQuery(query) {
    return this.$http.post(config.baseUrl, { variables: {}, extensions: {}, query }, { headers: config.headers }).then(response => response.data);
  }

  getAllTypes() {
    if (this.typeCache) return this.typeCache;
    this.typeCache = this.gqlQuery('{__schema {types {name kind description}}}').then(body => {
      console.log('Received GQL types response: ', body);
      return body.data.__schema.types;
    });
    return this.typeCache;
  }

  getTypeInfo(type) {
    if (!type) return null;
    if (type.kind === 'ENUM') {
      return this.gqlQuery(`{__type(name: "${type.name}") { name enumValues{ name description } description }}`).then(body => {
        console.log(`Received GQL type response for ${type.name}: `, body);
        _.merge(type, body.data.__type);
        return type;
      });
    }
    if (type.kind === 'INPUT_OBJECT') {
      return this.gqlQuery(`
      fragment typeDefinition on __Type {
        name
        kind
        ofType {
          name
          kind
          ofType {
            name
            kind
            ofType {
              name
              kind
              ofType {
                name
                kind
              }
            }
          }
        }
      }
      {
        __type(name: "${type.name}")
        {
          ...typeDefinition
          inputFields{
            name
            description
            defaultValue
            type {
              ...typeDefinition
            }
          }
          description
        }
      }`).then(body => {
        console.log(`Received GQL type response for ${type.name}: `, body);
        _.merge(type, body.data.__type);
        return type;
      });
    }
    return this.gqlQuery(`
    fragment typeDefinition on __Type {
      name
      kind
      ofType {
        name
        kind
        ofType {
          name
          kind
          ofType {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
    {
      __type(name: "${type.name}")
      {
        ...typeDefinition
        fields {
          name
          description
          args {
            name
            description
            type {
              ...typeDefinition
            }
          }
          type {
            ...typeDefinition
          }
        }
        description
      }
    }`).then(body => {
      console.log(`Received GQL type response for ${type.name}: `, body);
      _.merge(type, body.data.__type);
      return type;
    });
  }
}
