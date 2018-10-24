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
		verbs.type = verbs.type.toLowerCase();
		var url = verbs[0].url;
		var pattern = pathToRegexp(url, null);
		var matches = pattern.exec(url);

		// Surrounds URL parameters with curly brackets -> :email with {email}
		var queryStartIndex = url.indexOf('?');
		if (queryStartIndex === -1) {
			queryStartIndex = url.length;
		}
		var pathKeys = [];
		var queryKeys = [];
		for (var j = 1; j < matches.length; j++) {
			var key = matches[j].substr(1);
			var matchIndex = url.indexOf(matches[j]);
			url = url.replace(matches[j], "{"+ key +"}");
			if (matchIndex < queryStartIndex) {
				pathKeys.push(key);
			} else {
				queryKeys.push(key);
			}
		}

		for(var j = 0; j < verbs.length; j++) {
			var verb = verbs[j];
			var type = verb.type;

			var obj = paths[url] = paths[url] || {};

			if (type == 'post' || type == 'patch' || type == 'put') {
				_.extend(obj, createPostPushPutOutput(verb, swagger.definitions, pathKeys, queryKeys));
			} else {
				_.extend(obj, createGetDeleteOutput(verb, swagger.definitions, pathKeys, queryKeys));
			}
		}
	}
	return paths;
}

function createPostPushPutOutput(verbs, definitions, pathKeys, queryKeys) {
	var pathItemObject = {};
	var verbDefinitionResult = createVerbDefinitions(verbs, definitions, pathKeys, queryKeys);

	var params = createParameters(verbs, pathKeys, queryKeys, true);
	
	// if there is a required body param, the whole body is required
	var bodyRequired = !!_.find(params, function(param) {
		return param.in === "body" && param.required;
	})

	// filter out body params
	params = _.filter(params, function(param) {
		return param.in !== "body";
	});

	params.push({
			"in": "body",
			"name": "body",
			"description": removeTags(verbs.description),
			"required": bodyRequired,
			"schema": {
				"$ref": "#/definitions/" + verbDefinitionResult.topLevelParametersRef
			}
		});
	
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
	}

	if (verbDefinitionResult.topLevelSuccessRef) {
		pathItemObject[verbs.type].responses = {
          "200": {
            "description": "successful operation",
            "schema": {
              "type": verbDefinitionResult.topLevelSuccessRefType,
              "$ref": "#/definitions/" + verbDefinitionResult.topLevelSuccessRef,
            }
          }
      	};
	};
	
	return pathItemObject;
}

function createVerbDefinitions(verbs, definitions, pathKeys, queryKeys) {
	var result = {
		topLevelParametersRef : null,
		topLevelSuccessRef : null,
		topLevelSuccessRefType : null
	};
	var defaultObjectName = verbs.name;

	var fieldArrayResult = {};
	if (verbs && verbs.parameter && verbs.parameter.fields) {
		// definition for json input:
		// default Parameter group or body group, filter out those inside path or query
		var fieldArray = _.chain([])
			.concat(verbs.parameter.fields.Parameter || [])
			.concat(verbs.parameter.fields.body || [])
			.filter(function(field) {
				return !_.includes(pathKeys, field.field) && !_.includes(queryKeys);
			}).value();
		fieldArrayResult = createFieldArrayDefinitions(fieldArray, definitions, verbs.name, defaultObjectName);		
		result.topLevelParametersRef = fieldArrayResult.topLevelRef;
	};

	if (verbs && verbs.success && verbs.success.fields) {
		fieldArrayResult = createFieldArrayDefinitions(verbs.success.fields["Success 200"], definitions, verbs.name, defaultObjectName + 'Response');		
		result.topLevelSuccessRef = fieldArrayResult.topLevelRef;
		result.topLevelSuccessRefType = fieldArrayResult.topLevelRefType;
	};

	return result;
}

function createFieldArrayDefinitions(fieldArray, definitions, topLevelRef, defaultObjectName) {
	var result = {
		topLevelRef : topLevelRef,
		topLevelRefType : null
	}

	if (!fieldArray) {
		return result;
	}

	if (fieldArray.length > 0) {
		// return object
		result.topLevelRefType = "object";
		result.topLevelRef = defaultObjectName;
	}	

	for (var i = 0; i < fieldArray.length; i++) {
		var parameter = fieldArray[i];

		var nestedName = createNestedName(parameter.field);
		var objectName = nestedName.objectName;
		if (!objectName) {
			objectName = defaultObjectName;
		} else {
			objectName = defaultObjectName + "." + objectName;
		}

		definitions[objectName] = definitions[objectName] || {
			properties : {},
			required : [],
		};

		if (nestedName.propertyName) {
			var refObjectName
			var type = parameter.type;
			var prop = { type: type.toLowerCase(), description: removeTags(parameter.description) };
			if(prop.type === "object") {
				refObjectName = defaultObjectName + "." + parameter.field;
				prop.$ref = "#/definitions/" + refObjectName;
				definitions[refObjectName] = definitions[refObjectName] || {
					properties : {},
					required : [],
				};

			}

			var typeIndex = type.indexOf("[]");
			if(typeIndex !== -1 && typeIndex === (type.length - 2)) {
				prop.type = "array";
				prop.items = {
					type: type.slice(0, type.length-2).toLowerCase(),
				};
				if(prop.items.type === "object") {
					refObjectName = defaultObjectName + "." + parameter.field;
					prop.items.$ref = "#/definitions/" + refObjectName;
					definitions[refObjectName] = definitions[refObjectName] || {
						properties : {},
						required : [],
					};
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


/**
 * Generate get, delete method output
 * @param verbs
 * @returns {{}}
 */
function createGetDeleteOutput(verbs, definitions, pathKeys, queryKeys) {
	var pathItemObject = {};
	verbs.type = verbs.type === "del" ? "delete" : verbs.type;

	var verbDefinitionResult = createVerbDefinitions(verbs, definitions, pathKeys, queryKeys);
	pathItemObject[verbs.type] = {
		tags: [verbs.group],
		summary: removeTags(verbs.description),
		consumes: [
			"application/json"
		],
		produces: [
			"application/json"
		],
		parameters: createParameters(verbs, pathKeys, queryKeys, false)
	}
	if (verbDefinitionResult.topLevelSuccessRef) {
		pathItemObject[verbs.type].responses = {
          "200": {
            "description": "successful operation",
            "schema": {
              "type": verbDefinitionResult.topLevelSuccessRefType,
              "$ref": "#/definitions/" + verbDefinitionResult.topLevelSuccessRef,
            }
          }
      	};
	};
	return pathItemObject;
}

/**
 * Iterate through all method parameters and create array of parameter objects which are stored as path parameters
 * @param verbs
 * @param pathKeys
 * @param queryKeys
 * @param containsBody
 * @returns {Array}
 */
function createParameters(verbs, pathKeys, queryKeys, containsBody) {
	pathKeys = pathKeys || [];
	queryKeys = queryKeys || [];

	var params = [];
	// header
	if (verbs.header && verbs.header.fields.Header) {
		for (var i = 0; i < verbs.header.fields.Header.length; i++) {
			var param = verbs.header.fields.Header[i];
			var field = param.field;
			params.push({
				name: field,
				in: "header",
				required: !param.optional,
				type: param.type.toLowerCase(),
				description: removeTags(param.description)
			});
		}
	}

	if (verbs.parameter && verbs.parameter.fields) {
		_.forOwn(verbs.parameter.fields, function(value) {
			_.forEach(value, function(param) {
				var field = param.field;
				var inType = param.group;
				if (inType === "Parameter") {
					// try to infer inType
					if (_.includes(pathKeys, field)) {
						inType = "path";
					} else if (_.includes(queryKeys, field)) {
						inType = "query"
					} else if (containsBody) {
						inType = "body";
					} else {
						inType = "query";
					}
				}

				params.push({
					name: field,
					in: inType,
					required: !param.optional,
					type: param.type.toLowerCase(),
					description: removeTags(param.description)
				});
			});
		});
	}

	// add path keys
	_.forEach(pathKeys, function(key) {
		// already covered
		if (_.find(params, function(param) { return param.name === key; })) {
			return;
		}

		params.push({
			name: key,
			in: "path",
			required: true,
			type: "string",
			description: ""
		});
	});

	// add path keys
	_.forEach(queryKeys, function(key) {
		// already covered
		if (_.find(params, function(param) { return param.name === key; })) {
			return;
		}

		params.push({
			name: key,
			in: "query",
			required: false,
			type: "string",
			description: ""
		});
	});

	return params;
}

function groupByUrl(apidocJson) {
	return _.chain(apidocJson)
		.groupBy("url")
		.toPairs()
		.map(function (element) {
			return _.fromPairs(_.zip(["url", "verbs"], element));
		})
		.value();
}

module.exports = {
	toSwagger: toSwagger
};