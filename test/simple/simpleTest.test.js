var _               = require('lodash');
const transformer   = require('../../lib/index');
const path          = require('path');

const options= {
    dest: path.join(__dirname, './output'),
    src: path.join(__dirname, './input'),
    template: path.join(__dirname, '../template/'),

    debug: false,
    silent: false,
    verbose: false,
    simulate: false,
    parse: false, // only parse and return the data, no file creation
    colorize: true,
    markdown: true
}

const expectedObject = {"swagger":"2.0","info":{"title":"apidoc-swagger","version":"0.2.3","description":"Convert api doc json to swagger json"},"paths":{"/user/id":{"get":{"tags":["User"],"consumes":["application/json"],"produces":["application/json"],"parameters":[{"name":"id","in":"path","required":true,"type":"number","description":"Users unique ID."}],"responses":{"200":{"description":"successful operation","schema":{"type":"String","items":{"$ref":"#/definitions/GetUser"}}}}}}},"definitions":{"GetUser":{"properties":{"id":{"type":"number","description":"Users unique ID."},"firstname":{"type":"string","description":"Firstname of the User."},"lastname":{"type":"string","description":"Lastname of the User."}},"required":["id","firstname","lastname"]}}};

test('simple file should be transformed correctly', () => {
    var transformedObj = transformer.createApidocSwagger(options);
    expect(JSON.parse(transformedObj.swaggerData)).toEqual(expectedObject);
});