var _               = require('lodash');
const transformer   = require('../../lib/index');
const path          = require('path');

const options= {
    dest: path.join(__dirname, './output'),
    src: path.join(__dirname, './input'),
    template: path.join(__dirname, '../template/'),
}

const expectedObject = {"swagger":"2.0","info":{"title":"apidoc-swagger","version":"0.2.3","description":"Convert api doc json to swagger json"},"paths":{"/users/{id}/favorites":{"post":{"tags":["User"],"consumes":["application/json"],"produces":["application/json"],"parameters":[{"name":"id","in":"path","required":true,"type":"string","description":""},{"in":"body","name":"body","required":true,"schema":{"$ref":"#/definitions/AddItemToUserFavorites"}}],"responses":{"200":{"description":"successful operation","schema":{"type":"object","$ref":"#/definitions/AddItemToUserFavoritesResponse"}}}}},"/users/{id}":{"get":{"tags":["User"],"consumes":["application/json"],"produces":["application/json"],"parameters":[{"name":"x-request-id","in":"header","required":false,"type":"string","description":"Request id for tracking"},{"name":"id","in":"path","required":true,"type":"number","description":"Users unique ID."}],"responses":{"200":{"description":"successful operation","schema":{"type":"object","$ref":"#/definitions/GetUserResponse"}}}}},"/users/{id}/favorites?type={type}&status={status}":{"get":{"tags":["User"],"consumes":["application/json"],"produces":["application/json"],"parameters":[{"name":"status","in":"query","required":false,"type":"number","description":"Favorite item status"},{"name":"id","in":"path","required":true,"type":"string","description":""},{"name":"type","in":"query","required":false,"type":"string","description":""}],"responses":{"200":{"description":"successful operation","schema":{"type":"object","$ref":"#/definitions/GetUserFavoritesResponse"}}}}}},"definitions":{"AddItemToUserFavorites":{"properties":{"item_id":{"type":"number","description":"Favorite item id"}},"required":["item_id"]},"AddItemToUserFavoritesResponse":{"properties":{"id":{"type":"number","description":"Favorite item id"},"name":{"type":"string","description":"Favorite item name"}},"required":["id","name"]},"GetUserResponse":{"properties":{"firstname":{"type":"string","description":"Firstname of the User."},"lastname":{"type":"string","description":"Lastname of the User."}},"required":["firstname","lastname"]},"GetUserFavorites":{"properties":{"status":{"type":"number","description":"Favorite item status"}},"required":[]},"GetUserFavoritesResponse":{"properties":{"list":{"type":"array","description":"Favorites list","items":{"type":"object","$ref":"#/definitions/GetUserFavoritesResponse.list"}}},"required":["list"]},"GetUserFavoritesResponse.list":{"properties":{"id":{"type":"number","description":"Favorite item id"},"name":{"type":"string","description":"Favorite item name"}},"required":["id","name"]}}};

test('simple file should be transformed correctly', () => {
    console.log(transformer);
    var transformedObj = transformer.createApidocSwagger(options);
    expect(JSON.parse(transformedObj.swaggerData)).toEqual(expectedObject);
});