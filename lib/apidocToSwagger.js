var _ = require('lodash');

var swagger = {
  swagger: "2.0",
  info: {},
  paths: {},
  definitions: {}
};

function toSwagger(apidocJson, projectJson) {
  swagger.info = addInfo(projectJson);
  swagger.paths = extractPaths(apidocJson);
  swagger.definitions = extractDefinitions(apidocJson);
  return swagger;
}

/**
 * add project info loaded from package.json
 * @param projectJson
 * @returns {{}}
 */
function addInfo(projectJson) {
  var info = {};
  info["title"] = projectJson.title;
  info["version"] = projectJson.version;
  info["description"] = projectJson.description;
  return info;
}

/**
 * Extracts paths provided in json format
 * @param apidocJson
 * @returns {{}}
 */
function extractPaths(apidocJson) {
  var paths = {};
  var apiPaths = groupByUrl(apidocJson);
  for (var key in apiPaths) {
    paths[key] = extractMethods(apiPaths[key]);
  }
  return paths;
}


/**
 * In order to work with schemas in swagger we need to extract schema definitions for post patch and put requests
 * Creating definitions object
 * @param apidocJson
 * @returns {{}}
 */
function extractDefinitions(apidocJson) {
  var definitions = {};
  for (var i = 0; i < apidocJson.length; i++) {
    if (apidocJson[i].parameter) {
      definitions[apidocJson[i].name] = createSchemaDefinition(apidocJson[i].parameter.fields);
    }
    if (apidocJson[i].success) {
      definitions[apidocJson[i].name + "Success"] = createSchemaDefinition(apidocJson[i].success.fields);
    }

  }
  return definitions;
}

/**
 * Extracts parameters from method and creates schema definitions block
 * @param method
 * @returns {{properties: {}, required: Array}}
 */
function createSchemaDefinition(fields) {
  var pathItemObject = {};
  var required = [];
  //create input schema definitions
  for (var type in fields) {
    if (type != "path" && type != "query") {
      for (var i = 0; i < fields[type].length; i++) {
        pathItemObject[fields[type][i].field] =
        {
          type: fields[type][i].type.toLowerCase(),
          description: fields[type][i].description
        }
        //all required fields are pushed to required object
        if (!fields[type][i].optional) {
          required.push(fields[type][i].field);
        }
      }
    }
  }
  return {properties: pathItemObject, required: required};
}


/**
 * Generate method output
 * @param verbs
 * @returns {{}}
 */
function extractMethods(methods) {
  var pathItemObject = {};
  for (var i = 0; i < methods.length; i++) {
    pathItemObject[methods[i].type] = {
      tags: [methods[i].group],
      summary: methods[i].description,
      consumes: [
        "application/json"
      ],
      produces: [
        "application/json"
      ],
      parameters: extractParameters(methods[i]),
      responses: extractMethodResponses(methods[i])
    }
  }
  return pathItemObject;
}

/**
 * Iterate through all methods parameters and create array of parameter objects
 * @param verbs
 * @returns {Array}
 */
function extractParameters(method) {
  var pathItemObject = [];
  if (method.parameter) {
    for (var type in method.parameter.fields) {
      //body params are packed together and schema is defined in definitions with method name
      if (type == "body") {
        pathItemObject.push({
          name: type,
          in: type,
          required: true,
          type: type.toLowerCase(),
          description: method.description,
          "schema": {
            "$ref": "#/definitions/" + method.name
          }
        });
      } else {
        //path params are created separately
        for (var i = 0; i < method.parameter.fields[type].length; i++) {
          pathItemObject.push({
            name: method.parameter.fields[type][i].field,
            in: type === 'file' ? 'formData' : method.parameter.fields[type][i].group.toLowerCase(),
            required: !method.parameter.fields[type][i].optional,
            type: method.parameter.fields[type][i].type.toLowerCase(),
            description: method.parameter.fields[type][i].description
          });
        }
      }
    }
  }
  return pathItemObject;
}

/**
 * extract method response codes
 * @param method
 */
function extractMethodResponses(method) {
  var res = {};
  //extract success
  if (method.success && method.success.fields) {
    var key = Object.keys(method.success.fields)[0];
    res[key] = {
      "description": "successful operation",
      "schema": {"$ref": "#/definitions/" + method.name + "Success"}
    };
  }

  //extract errors
  if (method.error && method.error.fields) {
    key = Object.keys(method.error.fields)[0];
    for (err in method.error.fields[key]) {
      res[method.error.fields[key][err].field] = {"description": method.error.fields[key][err].description};
    }
  }
  return res;
}

/**
 * In order to generate swagger for all methods they must be grouped by URL, and type(get, put, delete) is subobject
 * See swagger specs for details.
 * @param apidocJson
 * @returns {*}
 */
function groupByUrl(apidocJson) {
  return _.groupBy(apidocJson, function (b) {
    return b.url;
  });
}

module.exports = {
  toSwagger: toSwagger
};