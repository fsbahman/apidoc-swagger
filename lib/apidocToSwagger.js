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
// Removes <p> </p> tags from text and restores quotes
function removeTags(text) {
	var textWithTagsRemoved = text ? (text.replace(tagsRegex, "")).trim() : "";
	return textWithTagsRemoved.replace(/&quot;/g, "\"")
							  .replace(/&gt;/g, ">")
							  .replace(/&lt;/g, "<")
							  .replace(/&amp;/g, "&")
							  .replace(/&apos;/g, "'");
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
		// In the event the url is having query params
		var url = verbs[0].url.split("?")[0];
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

			if (type == 'post' || type == 'patch' || type == 'put') {
				_.extend(obj, createPostPushPutOutput(verb, swagger.definitions, pathKeys));
			} else {
				_.extend(obj, createGetDeleteOutput(verb, swagger.definitions));
			}
		}
	}
	return paths;
}

function createPostPushPutOutput(verbs, definitions, pathKeys) {
	var pathItemObject = {};
	var verbDefinitionResult = createVerbDefinitions(verbs,definitions);

	var params = [];
	var pathParams = createPathParameters(verbs, pathKeys);

	/* Added objects and array support for params */

	for (var i = 0; i < pathParams.length; i++) {
		var pathParam = pathParams[i];
		var paramType = pathParam.type;
		if(pathParam.type !== "string" && pathParam.type !== "number" && pathParam.type !== "boolean") {
			pathParams.splice(i, 1);
			var typeIn = paramType.indexOf("[]");

			if (typeIn !== -1 && typeIn === (pathParam.type.length - 2)) {
				paramType = paramType.slice(0, paramType.length - 2);
				if(paramType == "object") {
					paramType = pathParam.name;
				}
				pathParams.push({
					"in": "body",
					"name": pathParam.name,
					"description": removeTags(pathParam.description),
					"required": required,
					"schema": {
						"type": "array",
						"items": {
							"$ref": "#/definitions/" + paramType
						}
					}
				});
			}
			else {
				if(pathParam.type == "object") {
					paramType = pathParam.name;
				}
				pathParams.push({
					"in": "body",
					"name": pathParam.name,
					"description": removeTags(pathParam.description),
					"required": required,
					"schema": {
						"$ref": "#/definitions/" + paramType
					}
				});
			}

		}

	}

	params = params.concat(pathParams);
	var required = verbs.parameter && verbs.parameter.fields && verbs.parameter.fields.Parameter.length > 0;

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

	/* Added object and array support for responses */

	pathItemObject[verbs.type].responses = {};
	if (verbDefinitionResult.topLevelSuccessRef) {
		pathItemObject[verbs.type].responses["200"] = {};
		pathItemObject[verbs.type].responses["200"].description = verbDefinitionResult.topLevelSuccessRefDesc;
		if(verbDefinitionResult.topLevelSuccessRef !== verbs.name) {
			pathItemObject[verbs.type].responses["200"].schema ={};
			if(verbDefinitionResult.topLevelSuccessRefType == "array") {
				pathItemObject[verbs.type].responses["200"].schema.type = verbDefinitionResult.topLevelSuccessRefType;
				pathItemObject[verbs.type].responses["200"].schema.items = {};
				pathItemObject[verbs.type].responses["200"].schema.items.$ref = "#/definitions/" + verbDefinitionResult.topLevelSuccessRef
			}
			else {
				pathItemObject[verbs.type].responses["200"].schema.$ref = "#/definitions/" + verbDefinitionResult.topLevelSuccessRef
			}
		}
	}

	 /* Added error response support handling multiple error codes*/

	if (verbDefinitionResult.topLevelError) {
		for(var k=0; k< verbDefinitionResult.topLevelError.length; k++)
		{
			var topLevelObject = verbDefinitionResult.topLevelError[k];
			pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp] = {};
			pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].description = topLevelObject.topLevelErrorRefDesc;
			if (topLevelObject.topLevelErrorRef !== verbs.name) {
				pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].schema = {};
				pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].schema.type = topLevelObject.topLevelErrorRefType;
				if (topLevelObject.topLevelErrorRefType == "array") {
					pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].schema.items = {};
					pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].schema.items.$ref = "#/definitions/" + topLevelObject.topLevelErrorRef
				}
				else {
					pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].schema.$ref = "#/definitions/" + topLevelObject.topLevelErrorRef
				}
			}
		}

	}

	return pathItemObject;
}

function createVerbDefinitions(verbs, definitions) {
	var result = {
		topLevelParametersRef : null,
		topLevelSuccessRef : null,
		topLevelSuccessRefType : null,
		topLevelSuccessRefDesc : null,
		topLevelError : new Array()
	};
	var defaultObjectName = verbs.name;

	var fieldArrayResult = {};
	if (verbs && verbs.parameter && verbs.parameter.fields) {
		fieldArrayResult = createFieldArrayDefinitions(verbs.parameter.fields.Parameter, definitions, verbs.name, defaultObjectName);
		result.topLevelParametersRef = fieldArrayResult.topLevelRef;
	};

	if (verbs && verbs.success && verbs.success.fields) {
		var successField = verbs.success.fields["Success 200"];
		if (!successField)
			successField = verbs.success.fields["200"]

		fieldArrayResult = createFieldArrayDefinitions(successField, definitions, verbs.name, defaultObjectName);
		result.topLevelSuccessRef = fieldArrayResult.topLevelRef;
		result.topLevelSuccessRefType = fieldArrayResult.topLevelRefType;
		result.topLevelSuccessRefDesc = fieldArrayResult.topLevelRefDesc;
	};
	/* Added support for error handling */
	if (verbs && verbs.error && verbs.error.fields) {
		for(var property in verbs.error.fields) {
			if ((verbs.error.fields).hasOwnProperty(property)) {
				var errorInfo = new Object();
				fieldArrayResult = createFieldArrayDefinitions(verbs.error.fields[property], definitions, verbs.name, defaultObjectName);
				errorInfo.topLevelErrorGrp = property;
				errorInfo.topLevelErrorRef = fieldArrayResult.topLevelRef;
				errorInfo.topLevelErrorRefType = fieldArrayResult.topLevelRefType;
				errorInfo.topLevelErrorRefDesc = fieldArrayResult.topLevelRefDesc;
				result.topLevelError.push(errorInfo);
			}
		}

	};

	return result;
}

function createFieldArrayDefinitions(fieldArray, definitions, topLevelRef, defaultObjectName) {
	var result = {
		topLevelRef : topLevelRef,
		topLevelRefType : null,
		topLevelRefDesc : null
	}

	if (!fieldArray) {
		return result;
	}
	/* Added data type support for response object - Object, Array, Object[], Number, String, Boolean */
	for (var i = 0; i < fieldArray.length; i++) {
		var parameter = fieldArray[i];

		var nestedName = createNestedName(parameter.field);
		var objectName = nestedName.objectName;
		if (!objectName) {
			objectName = defaultObjectName;
		}
		var type = removeTags(parameter.type);
		if (i == 0) {
			//Add the description
			result.topLevelRefDesc = removeTags(parameter.description);

			result.topLevelRefType = type;
			if(removeTags(parameter.type) == "Object") {
				objectName = nestedName.propertyName;
				nestedName.propertyName = null;
				result.topLevelRefType = "object";
			} else if (removeTags(parameter.type) == "Array") {
				objectName = nestedName.propertyName;
				nestedName.propertyName = null;
				result.topLevelRefType = "array";
			}

			else if (removeTags(parameter.type) == "Object[]") {
				objectName = nestedName.propertyName;
				nestedName.propertyName = null;
				result.topLevelRefType = "array";
			}

			else if(type &&  type.indexOf("Number") < 0 && type.indexOf("String") < 0 && type.indexOf("Boolean") < 0 ) {
				objectName = type;
				nestedName.propertyName = null;

				var typeInd = type.indexOf("[]");

				if (typeInd !== -1 && typeInd === (type.length - 2)) {
					result.topLevelRefType = "array";
					objectName = type.slice(0, type.length - 2);
				}
			}
			result.topLevelRef = objectName;
		}

		//Only generate a definition for an object that would be referenced
		if (objectName !== defaultObjectName) {

			definitions[objectName] = definitions[objectName] ||
				{ properties : {}, required : [] };

			if (nestedName.propertyName) {
				var prop = { type: (removeTags(parameter.type) || "").toLowerCase(), description: removeTags(parameter.description) };
				//Add allowed values
				if(parameter.allowedValues) {
					prop.enum = [];
					for(k = 0; k<(parameter.allowedValues).length; k++) {
						prop.enum.push((parameter.allowedValues[k]).replace(/\"/ig, ""));
					}
				}

				if(removeTags(parameter.type) == "Object") {
					prop.$ref = "#/definitions/" + parameter.field;
				}

				else if(removeTags(parameter.type) == "Array") {
					prop.$ref = "#/definitions/" + parameter.field;
				}

				else if(removeTags(parameter.type) == "Object[]") {
					prop.type = "array";
					prop.items = {
						$ref : "#/definitions/" + parameter.field
					};
				}
				else if(type && type.indexOf("[]") < 0 && type.indexOf("Number") < 0 && type.indexOf("String") < 0 && type.indexOf("Boolean") < 0 ) {
					prop.$ref = "#/definitions/" + type; //for a particular object
				}

				if(type) {
					var typeIndex = type.indexOf("[]");

					if (typeIndex !== -1 && typeIndex === (type.length - 2)) {
						prop.type = "array";
						if(type.indexOf("Number") < 0 && type.indexOf("String") < 0 && type.indexOf("Boolean") < 0){
							prop.items = {
								$ref : "#/definitions/" + type.slice(0, type.length - 2)   //for a particular object[]
							};
						}
						else {
							prop.items = {
								type: (type.slice(0, type.length - 2)).toLowerCase()  //for all other arrays
							};
							result.topLevelRefType = "array";
						}

					}
				}

				if(prop.type == 'undefined'|| prop.type == null || prop.type.length <= 0){
					prop.type = "string";
				}

				if(prop.type.indexOf("number") < 0 && prop.type.indexOf("string") < 0 && prop.type.indexOf("boolean") < 0 && prop.type.indexOf("array") < 0){
					prop.type = "object";
				}


				definitions[objectName]['properties'][nestedName.propertyName] = prop;
				if (!parameter.optional) {
					var arr = definitions[objectName]['required'];
					if(arr.indexOf(nestedName.propertyName) === -1) {
						arr.push(nestedName.propertyName);
					}
				};
			}

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
	verbs.type = verbs.type === "del" ? "delete" : verbs.type;

	var verbDefinitionResult = createVerbDefinitions(verbs,definitions);
	pathItemObject[verbs.type] = {
		tags: [verbs.group],
		summary: removeTags(verbs.description),
		consumes: [
			"application/json"
		],
		produces: [
			"application/json"
		],
		parameters: createPathParameters(verbs)
	}
	pathItemObject[verbs.type].responses = {};
	if (verbDefinitionResult.topLevelSuccessRef) {
		pathItemObject[verbs.type].responses["200"] = {};
		pathItemObject[verbs.type].responses["200"].description = verbDefinitionResult.topLevelSuccessRefDesc;
		if(verbDefinitionResult.topLevelSuccessRef !== verbs.name) {
			pathItemObject[verbs.type].responses["200"].schema ={};
			if(verbDefinitionResult.topLevelSuccessRefType == "array") {
				pathItemObject[verbs.type].responses["200"].schema.type = verbDefinitionResult.topLevelSuccessRefType;
				pathItemObject[verbs.type].responses["200"].schema.items = {};
				pathItemObject[verbs.type].responses["200"].schema.items.$ref = "#/definitions/" + verbDefinitionResult.topLevelSuccessRef
			}
			else {
				pathItemObject[verbs.type].responses["200"].schema.$ref = "#/definitions/" + verbDefinitionResult.topLevelSuccessRef
			}
		}
	}

	if (verbDefinitionResult.topLevelError) {
		for(var k=0; k< verbDefinitionResult.topLevelError.length; k++)
		{
			var topLevelObject = verbDefinitionResult.topLevelError[k];
			pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp] = {};
			pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].description = topLevelObject.topLevelErrorRefDesc;
			if (topLevelObject.topLevelErrorRef !== verbs.name) {
				pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].schema = {};
				pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].schema.type = topLevelObject.topLevelErrorRefType;
				if (topLevelObject.topLevelErrorRefType == "array") {
					pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].schema.items = {};
					pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].schema.items.$ref = "#/definitions/" + topLevelObject.topLevelErrorRef
				}
				else {
					pathItemObject[verbs.type].responses[topLevelObject.topLevelErrorGrp].schema.$ref = "#/definitions/" + topLevelObject.topLevelErrorRef
				}
			}
		}

	}
	return pathItemObject;
}

/**
 * Iterate through all method parameters and create array of parameter objects which are stored as path parameters
 * @param verbs
 * @returns {Array}
 */
function createPathParameters(verbs, pathKeys) {
	pathKeys = pathKeys || [];

	var pathItemObject = [];
	if (verbs.parameter) {

		var queryStringParams = getQueryStringParams(verbs);

		for (var i = 0; i < verbs.parameter.fields.Parameter.length; i++) {
			var param = verbs.parameter.fields.Parameter[i];
			var field = param.field;
			var type = removeTags(param.type);
			if(param.allowedValues) {
				pathItemObject.push({
					name: field,
					//in: type === "file" ? "formData" : "path",
					in: "query",
					required: !param.optional,
					type: caseCorrectType(removeTags(param.type)),
					description: removeTags(param.description),
					enum: param.allowedValues
				});
			}
			else {
				var inValue = "path";
				if (type === "file")
					inValue = "formData";
				else if (queryStringParams.indexOf(field) !== -1)
					inValue = "query";

				pathItemObject.push({
					name: field,
					in: inValue,
					required: !param.optional,
					type: caseCorrectType(removeTags(param.type)),
					description: removeTags(param.description)
				});
			}
		}
	}
	return pathItemObject;
}

/**
 * A helper method which will scan the URL and determine which variables enclosed in {} are a part of the query string and not the path
 * @param The verb
 * @return {Array} An array of parameters which are a part of the query string and not the path
 */
function getQueryStringParams(verb) {
	var getParamRegExp = /\{(.*?)\}/g

	var indexOfQueryString = verb.url.indexOf("?");
	var queryStringParams = [];

	if (indexOfQueryString != -1) {
		var currentParam;
		while ((currentParam =getParamRegExp.exec(verb.url)) !== null) {
			if (getParamRegExp.lastIndex > indexOfQueryString) {
				queryStringParams.push(currentParam[1]);
			}
		}
	}

	return queryStringParams;
}

/**
 * A helper method to case correct types. This will lower case swagger types and leave others alone
 * @param The type to correct
 * @return If it is a swagger type, it will return the lower case, otherwise, it will leave it alone
 */
function caseCorrectType(typeToCorrect) {
	var swaggerTypes = ["integer", "number", "string", "boolean"]
	var lowerCaseType = typeToCorrect.toLowerCase();
	if (swaggerTypes.indexOf(lowerCaseType) != -1) {
		return lowerCaseType;
	}
	return typeToCorrect;
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
