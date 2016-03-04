var _ = require('lodash');
var pathToRegexp = require('path-to-regexp');

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

var tagsRegex = /(<([^>]+)>)/ig;
// Removes <p> </p> tags from text
function removeTags(text) {
	return text ? text.replace(tagsRegex, "") : text;
}

function addInfo(projectJson) {
	var info = {};
	info["title"] = projectJson.title || projectJson.name;
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
		var verbs = apiPaths[i].verbs;
		var url = verbs[0].url;
		var pattern = pathToRegexp(url, null);
		var matches = pattern.exec(url);

		// Surrounds URL parameters with curly brackets -> :email with {email}
		var pathKeys = [];
		for (var j = 1; j < matches.length; j++) {
			var key = matches[j].substr(1);
			url = url.replace(matches[j], "{"+ key +"}");
			pathKeys.push(key);
		}

		for(var j = 0; j < verbs.length; j++) {
			var verb = verbs[j];
			var type = verb.type;

			var obj = paths[url] = paths[url] || {};

			//apiDoc allows to name parameter groups (in round braces) and these groups
			// represented in verbs.parameter.fields by their names, in group not
			// defined explicitly it named Parameter
			if (verb.parameter) {
				verb.parameter.fields = {
					Parameter: _.flatten(_.values(verb.parameter.fields))
				};
			}
			if (verb.header) {
				verb.header.fields = {
					Header: _.flatten(_.values(verb.header.fields))
				};
			}

			if (type == 'post' || type == 'patch' || type == 'put') {
				_.extend(obj, createPostPushPutOutput(verb, swagger.definitions, pathKeys));
			} else {
				_.extend(obj, createGetDeleteOutput(verb, swagger.definitions, pathKeys));
			}
		}
	}
	return paths;
}

function createPostPushPutOutput(verbs, definitions, pathKeys) {
	var pathItemObject = {};

	var params = [];
	if (verbs.parameter && verbs.parameter.fields ) {
		if (verbs.parameter.fields.Parameter){
			//path params
			params = params.concat(
				createParameters(
					verbs.parameter.fields.Parameter.filter(function(param){
						return pathKeys.indexOf(param.field) >= 0;
					}),
					'path'
				)
			);
			//body
			var bodyFields = verbs.parameter.fields.Parameter
				.filter(function(param){ return pathKeys.indexOf(param.field) < 0; })
				.map(function(field){ field.field = verbs.name+'Body.'+field.field; return field; });
			if (bodyFields.length > 0)
				bodyFields = [{field:verbs.name+"Body", type:"Object"}].concat(bodyFields);
			params.push(
				{
					"in": "body",
					"name": verbs.name+"Body",
					"description": removeTags(verbs.description),
					"required": true,
					"schema": createSchema(
						bodyFields, definitions, verbs.name+"Body", verbs.name+"Body"
					)
				}
			);
		}
	}
	if (verbs.header && verbs.header.fields && verbs.header.fields.Header){
		//header params
		params = params.concat(
			createParameters(
				verbs.header.fields.Header,
				'header'
			)
		);
	}
	pathItemObject[verbs.type] = {
		tags: [verbs.group],
		summary: removeTags(verbs.description),
		consumes: [
			"application/json"
		],
		produces: [
			"application/json"
		],
		parameters: params
	};

	pathItemObject[verbs.type].responses = _.merge(
		createSuccessResults(verbs, definitions),
		createErrorResults(verbs, definitions)
	);
	return pathItemObject;
}

/**
 * Generate get, delete method output
 * @param verbs
 * @returns {{}}
 */
function createGetDeleteOutput(verbs, definitions, pathKeys) {
	var pathItemObject = {};
	verbs.type = verbs.type === "del" ? "delete" : verbs.type;

	var params = [];
	if (verbs.parameter && verbs.parameter.fields) {
		if (verbs.parameter.fields.Parameter){
			params = params.concat(
				createParameters(
					verbs.parameter.fields.Parameter.filter(function(param){
						return pathKeys.indexOf(param.field) >= 0;
					}),
					'path'
				),
				createParameters(
					verbs.parameter.fields.Parameter.filter(function(param){
						return pathKeys.indexOf(param.field) < 0;
					}),
					'query'
				)
			);
		}
		if (verbs.header && verbs.header.fields && verbs.header.fields.Header){
			params = params.concat(
				createParameters(
					verbs.header.fields.Header,
					'header'
				)
			);
		}
	}

	pathItemObject[verbs.type] = {
		tags: [verbs.group],
		summary: removeTags(verbs.description),
		consumes: [
			"application/json"
		],
		produces: [
			"application/json"
		],
		parameters: params
	};

	pathItemObject[verbs.type].responses = _.merge(
		createSuccessResults(verbs, definitions),
		createErrorResults(verbs, definitions)
	);
	return pathItemObject;
}

function createFieldArrayDefinitions(fieldArray, definitions, topLevelRef, defaultObjectName) {
	var result = {
		topLevelRef : topLevelRef,
		topLevelRefType : null
	}

	if (!fieldArray) {
		return result;
	}

	for (var i = 0; i < fieldArray.length; i++) {
		var parameter = fieldArray[i];

		var nestedName = createNestedName(parameter.field);
		var objectName = nestedName.objectName;
		if (!objectName) {
			objectName = defaultObjectName;
		}
//		if (parameter.type.toLowerCase() == "object[]") parameter.type = "Array";
		var type = parameter.type || "";
		if (i == 0) {
			result.topLevelRefType = type;
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
			var prop = { type: (type.toLowerCase() || "").toLowerCase(), description: removeTags(parameter.description) };
			var typeIndex = type.indexOf("[]");
			if(parameter.type == "Object") {
				prop.$ref = "#/definitions/" + parameter.field;
			}
			if(typeIndex !== -1 && typeIndex === (type.length - 2)) {
				type = type.slice(0, type.length-2).toLowerCase();
				prop.type = "array";
				if (type == "object") {
					prop.items = { "$ref" : "#/definitions/" + parameter.field };
				} else {
					prop.items = { type : type };
				}
			}
			definitions[objectName]['properties'][nestedName.propertyName] = prop;
			if (!parameter.optional) {
				var arr = definitions[objectName]['required'];
				if(arr.indexOf(nestedName.propertyName) === -1) {
					arr.push(nestedName.propertyName);
				}
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

function createSchema(fields, definitions, defName, objName){
	if (!objName) objName = defName;
	var schema = {};
	var fieldType = fields[0] ? (fields[0].type || "") : "";

	//looks like createFieldArrayDefinitions treats types with [] differently
	if (fieldType.toLowerCase().indexOf('object') >= 0 || fieldType.toLowerCase() == 'array' ){
		//if object or array of objects - create object definition
		if (fieldType.toLowerCase() == 'object[]') {
			fields[0].type = 'Array';
		}
		var fieldArrayResult = createFieldArrayDefinitions(fields, definitions, defName, objName);
		if (fieldArrayResult.topLevelRefType.toLowerCase() == 'object') {
			schema["$ref"] = "#/definitions/" + fieldArrayResult.topLevelRef;
		} else {
			schema["type"] = "array";
			schema["items"] = {
				"$ref": "#/definitions/" + fieldArrayResult.topLevelRef
			};
		}
	} else {
		//simple type or array of simple type
		if (fieldType.indexOf('[]') >= 0) {
			schema["type"] = "array";
			schema["items"] = {
				"type": fieldType.replace('[]', '').toLowerCase()
			};
		} else {
			schema["type"] = fieldType.toLowerCase();
		}
	}
	return schema;
}

function createSuccessResults(verbs, definitions){
	return _.mapValues(verbs.success ? verbs.success.fields : [], function(success){
		var result = { "description": "Success" };
		if (success.length > 0  && success[0].field && success[0].field != 'null'
				&& success[0].type &&  success[0].type != 'null') {
			result.schema = createSchema(success, definitions, verbs.name + "Result", verbs.name + "Result");
		}
		return result;
	});
}

function createErrorResults(verbs, definitions){
	return _.mapValues(verbs.errors ? verbs.error.fields : [], function(err){
		return {
			"description": "Error",
			"schema": createSchema(err, definitions, verbs.name+"Error", verbs.name+"Error")
		}
	});
}

function createParameters(fields, place){
	return fields.map(function(param){
		var field = param.field;
		var type = param.type;
		return {
			name: field,
			in: place,
			required: !param.optional,
			type: param.type.toLowerCase(),
			description: removeTags(param.description)
		};
	});
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