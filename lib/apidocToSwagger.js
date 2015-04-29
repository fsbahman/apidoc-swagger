var _ = require('lodash');

var swagger = {
	swagger	: "2.0",
	info	: {},
	paths	: {},
	definitions: {}
};

function toSwagger(apidocJson, projectJson) {
	swagger.info = addInfo(projectJson);
	swagger.paths = extractPaths(apidocJson);
	return swagger;
}


function addInfo(projectJson) {
	var info = {};
	info["title"] = projectJson.title;
	info["version"] = projectJson.version;
	info["description"] = projectJson.description;
	return info;
}

/**
 * Extracts paths provided in json format
 * post, patch, put request parameters are extracted in body
 * get and delete are extracted to path parameters
 * @param apidocJson
 * @returns {{}}
 */
function extractPaths(apidocJson){
	var apiPaths = groupByUrl(apidocJson);
	var paths = {};
	for (var i = 0; i < apiPaths.length; i++) {
		if (apiPaths[i].verbs[0].type == 'post' || apiPaths[i].verbs.type == 'patch' || apiPaths[i].verbs.type == 'put') {
			paths[apiPaths[i].verbs[0].url] = createPostPushPutOutput(apiPaths[i].verbs[0], swagger.definitions);
		} else {
			paths[apiPaths[i].verbs[0].url] = createGetDeleteOutput(apiPaths[i].verbs[0], swagger.definitions);
		}
	}
	return paths;
}

function createPostPushPutOutput(verbs, definitions) {
	var pathItemObject = {};
	var verbDefinitionResult = createVerbDefinitions(verbs,definitions);
	pathItemObject[verbs.type] = {
		tags: [verbs.group],
		summary: verbs.description,
		consumes: [
			"application/json"
		],
		produces: [
			"application/json"
		],
		parameters: [
			{
				"in": "body",
				"name": "body",
				"description": verbs.description,
				"required": true,
				"schema": {
					"$ref": "#/definitions/" + verbDefinitionResult.topLevelParametersRef
				}
			}
		]
	}

	if (verbDefinitionResult.topLevelSuccessRef) {
		pathItemObject[verbs.type].responses = {
          "200": {
            "description": "successful operation",
            "schema": {
              "type": verbDefinitionResult.topLevelSuccessRefType,
              "items": {
                "$ref": "#/definitions/" + verbDefinitionResult.topLevelSuccessRef
              }
            }
          }
      	};
	};
	
	return pathItemObject;
}

function createVerbDefinitions(verbs, definitions) {
	var result = {
		topLevelParametersRef : null,
		topLevelSuccessRef : null,
		topLevelSuccessRefType : null
	};
	var defaultObjectName = verbs.name;

	var fieldArrayResult = {};
	if (verbs && verbs.parameter && verbs.parameter.fields) {
		fieldArrayResult = createFieldArrayDefinitions(verbs.parameter.fields.Parameter, definitions, verbs.name, defaultObjectName);		
		result.topLevelParametersRef = fieldArrayResult.topLevelRef;
	};

	if (verbs && verbs.success && verbs.success.fields) {
		fieldArrayResult = createFieldArrayDefinitions(verbs.success.fields["Success 200"], definitions, verbs.name, defaultObjectName);		
		result.topLevelSuccessRef = fieldArrayResult.topLevelRef;
		result.topLevelSuccessRefType = fieldArrayResult.topLevelRefType;
	};

	return result;
}

function createFieldArrayDefinitions(fieldArray, definitions, topLevelRef, defaultObjectName) {
	var result = {
		topLevelRef : topLevelRef,
		topLevelRefType : null
	};

	if (!fieldArray) {
		return result;
	};


	for (var i = 0; i < fieldArray.length; i++) {
		var parameter = fieldArray[i];

		var nestedName = createNestedName(parameter.field);
		var objectName = nestedName.objectName;
		if (!objectName) {
			objectName = defaultObjectName;
		};
		if (i == 0) {
			result.topLevelRefType = parameter.type;
			if(parameter.type == "Object") {
				objectName = nestedName.propertyName;
				nestedName.propertyName = null;
			} else if (parameter.type == "Array") {
				objectName = nestedName.propertyName;
				nestedName.propertyName = null;				
				result.topLevelRefType = "array";
			}
			result.topLevelRef = objectName;
		};

		definitions[objectName] = definitions[objectName] ||
			{ properties : {}, required : [] };

		if (nestedName.propertyName) {
			var prop = { type: parameter.type, description: parameter.description };
			if(parameter.type == "Object") {
				prop.$ref = "#/definitions/" + parameter.field;
			}
			definitions[objectName]['properties'][nestedName.propertyName] = prop;
			if (!parameter.optional) {
				definitions[objectName]['required'].push(nestedName.propertyName);
			};

		};
	}

	return result;
}

function createNestedName(field) {
	var propertyName = field;
	var objectName;
	var propertyNames = field.split(".");
	if(propertyNames && propertyNames.length > 1) {
		propertyName = propertyNames[propertyNames.length-1];
		propertyNames.pop();
		objectName = propertyNames.join(".");
	}

	return {
		propertyName: propertyName,
		objectName: objectName
	}
}


/**
 * Generate get, delete method output
 * @param verbs
 * @returns {{}}
 */
function createGetDeleteOutput(verbs,definitions) {
	var pathItemObject = {};
	var verbDefinitionResult = createVerbDefinitions(verbs,definitions);
	pathItemObject[verbs.type] = {
		tags: [verbs.group],
		summary: verbs.description,
		consumes: [
			"application/json"
		],
		produces: [
			"application/json"
		],
		parameters: createPathParameters(verbs)
	}
	if (verbDefinitionResult.topLevelSuccessRef) {
		pathItemObject[verbs.type].responses = {
          "200": {
            "description": "successful operation",
            "schema": {
              "type": verbDefinitionResult.topLevelSuccessRefType,
              "items": {
                "$ref": "#/definitions/" + verbDefinitionResult.topLevelSuccessRef
              }
            }
          }
      	};
	};
	return pathItemObject;
}

/**
 * Iterate through all method parameters and create array of parameter objects which are stored as path parameters
 * @param verbs
 * @returns {Array}
 */
function createPathParameters(verbs) {
	var pathItemObject = [];
	if (verbs.parameter) {
		for (var i = 0; i < verbs.parameter.fields.Parameter.length; i++) {
			pathItemObject.push({
				name: verbs.parameter.fields.Parameter[i].field,
				in: "path",
				required: !verbs.parameter.fields.Parameter[i].optional,
				type: verbs.parameter.fields.Parameter[i].type.toLowerCase(),
				description: verbs.parameter.fields.Parameter[i].description
			});
		}
	}
	return pathItemObject;
}

function groupByUrl(apidocJson) {
	return _.chain(apidocJson)
		.groupBy("url")
		.pairs()
		.map(function (element) {
			return _.object(_.zip(["url", "verbs"], element));
		})
		.value();
}

module.exports = {
	toSwagger: toSwagger
};