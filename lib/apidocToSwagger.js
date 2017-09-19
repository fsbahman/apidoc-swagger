var _ = require('lodash');
var pathToRegexp = require('path-to-regexp');
var html2markdown = require('html2markdown');

var swagger = {
	swagger	: "2.0",
	info	: {},
	securityDefinitions: {},
	paths	: {},
	definitions: {}
};

function toSwagger(apidocJson, projectJson, swaggerInit) {
	swagger.info = addInfo(projectJson);
	swagger.paths = extractPaths(apidocJson);
	Object.assign(swagger, swaggerInit);

	return swagger;
}

var tagsRegex = /(<(\S[^>]+)>)/ig;
// Removes <p> </p> tags from text
function removeTags(text) {
	//return text ? text.replace(tagsRegex, "") : text;
	return text ? text.replace(/<p>/, "").replace(/<\p>/, "") : text;
}

function addInfo(projectJson) {
	var info = {};
	info["title"] = projectJson.title || projectJson.name;
	info["version"] = projectJson.version;
	if( projectJson.header ) {
		info["description"] = html2markdown("<h1>" + projectJson.description + "</h1><p><h2>" + projectJson.header.title + "</h2></p>" + projectJson.header.content);	
	} else {
		info["description"] = projectJson.description;
	}
	return info;
}

var tags = {};
function getTagFromGoup(group) {
	if(tags.hasOwnProperty(group)) {
		return tags[group];
	}

	var tag = group.replace(/_/g, " ").replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	tags[group] = tag;
	return tag;
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
	pathParams = _.filter(pathParams, function(param) {
		var hasKey = pathKeys.indexOf(param.name) !== -1;
		return !(param.in === "path" && !hasKey);
	});
	
	params = params.concat(pathParams);
	var required = verbs.parameter && verbs.parameter.fields && ((verbs.parameter.fields.Parameter && verbs.parameter.fields.Parameter.length > 0) || (verbs.parameter.fields["Body Parameters"] && verbs.parameter.fields["Body Parameters"].length > 0));

	params.push({
			"in": "body",
			"name": "body",
			"description": removeTags(html2markdown(verbs.description)),
			"required": required,
			"schema": {
				"$ref": "#/definitions/" + verbDefinitionResult.topLevelParametersRef
			}
		});
		
	pathItemObject[verbs.type] = {
		tags: [getTagFromGoup(verbs.group)],
		summary: removeTags(verbs.title),
		description: removeTags(html2markdown(verbs.description)),
		operationId: verbs.name,
		consumes: [
			"application/json"
		],
		produces: [
			"application/json"
		],
		parameters: params
	};

	var security = createSecurity(verbs, swagger.securityDefinitions);
	if( security && security.length ) {
		pathItemObject[verbs.type].security = security;
	}

	var permission = createPermission(verbs);
	if( permission && permission.length ) {
		pathItemObject[verbs.type]["x-permission"] = permission;
	}

	if( verbs.deprecated ) {
		pathItemObject[verbs.type].deprecated = true;
		pathItemObject[verbs.type].description = verbs.deprecated.content;
	}

	pathItemObject[verbs.type].responses = {};

	if (verbDefinitionResult.topLevelSuccessRef) {
		pathItemObject[verbs.type].responses["200"] = {
            "description": "successful operation",
            "schema": {
            //  "type": verbDefinitionResult.topLevelSuccessRefType,
            //  "items": {
                "$ref": "#/definitions/" + verbDefinitionResult.topLevelSuccessRef
            //  }
            }
      	};
	};

	if( verbDefinitionResult.topLevelErrorArray.length ) {
		verbDefinitionResult.topLevelErrorArray.forEach( function(topLevelError){
			pathItemObject[verbs.type].responses[value.field] = { description: value.description };
		});
	}
	
	return pathItemObject;
}

function createVerbDefinitions(verbs, definitions) {
	var result = {
		topLevelParametersRef : null,
		topLevelSuccessRef : null,
		topLevelSuccessRefType : null,
		topLevelErrorArray: []
	};
	var defaultObjectName = verbs.name;

	var fieldArrayResult = {};
	if (verbs && verbs.parameter && verbs.parameter.fields) {
		var parameter = verbs.parameter.fields.Parameter || verbs.parameter.fields["Body Parameters"];
		fieldArrayResult = createFieldArrayDefinitions(parameter, definitions, verbs.name, defaultObjectName);		
		result.topLevelParametersRef = fieldArrayResult.topLevelRef;
	};

	if (verbs && verbs.success && verbs.success.fields) {
		fieldArrayResult = createFieldArrayDefinitions(verbs.success.fields["Success 200"], definitions, verbs.name, defaultObjectName);		
		result.topLevelSuccessRef = fieldArrayResult.topLevelRef;
		result.topLevelSuccessRefType = fieldArrayResult.topLevelRefType;
	};

	/*
	if( verbs &&  verbs.error && verbs.error.fields ) {
		for( var field in verbs.error.fields) {
			fieldArrayResult = createFieldArrayDefinitions(verbs.error.fields[field], definitions, verbs.name, defaultObjectName);	
			console.log("DDDDDDDDDDD" + JSON.stringify( fieldArrayResult))	
			result.topLevelErrorArray.push( {
				topLevelErrorRef : fieldArrayResult.topLevelRef,
				topLevelErrorRefType : fieldArrayResult.topLevelRefType
			});
		}
	}*/

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

	for (var i = 0; i < fieldArray.length; i++) {	
		var parameter = fieldArray[i];

		var nestedName = createNestedName(parameter.field);
		var objectName = nestedName.objectName;
		if (!objectName) {
			objectName = defaultObjectName;
		}
		var type = parameter.type;
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
			{ type: "object", properties : {}, required : [] };

		if (nestedName.propertyName) {
			var type = (parameter.type || "").toLowerCase();
			var proptype = type === 'date' || type === 'binary' ? 'string' : type;

			var prop = {};//{ type: proptype, description: removeTags(parameter.description) };
			if(parameter.type === "Object") {
				prop.$ref = "#/definitions/" + parameter.field;
			} else {
				prop.type = proptype;
				prop.description = removeTags(html2markdown(parameter.description));
			}

			if( parameter.allowedValues ) {
				prop.enum = parameter.allowedValues.map( function(value) {
					return value.replace(/^[\"\']/, '').replace(/[\"\']$/, '');
				});
			}

			if( parameter.defaultValue ) {
				prop.default = parameter.defaultValue.replace(/^[\"\']/, '').replace(/[\"\']$/, '');
			}
			
			if( type === 'date' || type === 'date-time' || type === 'byte' || type === 'binary'  || type === 'password') {
				prop.format = type;
				prop.type = 'string';
			}

			if( type === 'integer' ) {
				prop.format = 'int32';
				prop.type = 'integer';
			}
			if( type === 'long' ) {
				prop.format = 'int64';
				prop.type = 'integer';
			}

			if( type === 'float' || type === 'double') {
				prop.format = type;
				prop.type = 'number';
			}

			var typeIndex = type.indexOf("[]");
			if(typeIndex !== -1 && typeIndex === (type.length - 2)) {
				prop.type = "array";

				var _type = type.slice(0, type.length-2);
				if(  _type === 'object' ) {
					prop.items = { 
						"$ref": "#/definitions/" + nestedName.propertyName
					};
				} else {
					prop.items = { 
						type: _type
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
function createGetDeleteOutput(verbs,definitions) {
	var pathItemObject = {};
	verbs.type = verbs.type === "del" ? "delete" : verbs.type;

	var verbDefinitionResult = createVerbDefinitions(verbs,definitions);
	pathItemObject[verbs.type] = {
		tags: [getTagFromGoup(verbs.group)],
		summary: removeTags(verbs.title),
		description: removeTags(html2markdown(verbs.description)),
		operationId: verbs.name,
		consumes: [
			"application/json"
		],
		produces: [
			"application/json"
		],
		parameters: [].concat( 
			createPathParameters(verbs),
			createHeaderParameters(verbs),
			createCookieParameters(verbs),
			createQueryParameters(verbs),
			createBodyParameters(verbs),
			createFormParameters(verbs)
		)
	};

	var security = createSecurity(verbs, swagger.securityDefinitions);
	if( security && security.length ) {
		pathItemObject[verbs.type].security = security;
	}

	var permission = createPermission(verbs);
	if( permission && permission.length ) {
		pathItemObject[verbs.type]["x-permission"] = permission;
	}
	
	if( verbs.deprecated ) {
		pathItemObject[verbs.type].deprecated = true;
		pathItemObject[verbs.type].description = verbs.deprecated.content;
	}

	if (verbDefinitionResult.topLevelSuccessRef) {
		pathItemObject[verbs.type].responses = {
          "200": {
            "description": "successful operation",
            "schema": {
            //  "type": verbDefinitionResult.topLevelSuccessRefType,
            //  "items": {
                "$ref": "#/definitions/" + verbDefinitionResult.topLevelSuccessRef
            //  }
            }
          }
      	};
	};
	return pathItemObject;
}

function createPermission( verbs ) {
	var pathItemObject = [];
	if (verbs.permission ) {
		for (var i = 0; i < verbs.permission.length; i++) {
			var permission = verbs.permission[i];

			pathItemObject.push( {
				name: permission.name,
				title: permission.title,
				description: removeTags(html2markdown(permission.description))
			});
		}
	}
	return pathItemObject;
}

/**
 * Iterate through all method parameters and create array of parameter objects which are stored as bearer authentication
 * @param verbs
 * @returns {Array}
 */
function createSecurity(verbs, security) {

	var pathItemObject = [];
	if (verbs.header && verbs.header.fields) {
		
		for( var key in verbs.header.fields) {
			if (verbs.header.fields.hasOwnProperty(key)) {
				for (var i = 0; i < verbs.header.fields[key].length; i++) {
					var param = verbs.header.fields[key][i];
					var field = param.field;
					var type = param.type;
					var inParam = '';
					if ( param.group && param.group.toLowerCase() === 'bearerauthorization') {
						var bearerKey = param.field === "Authorization" ? "Bearer" : "Bearer-" + param.field;
						var bearerObject = {};
						bearerObject[bearerKey] = [];
						pathItemObject.push(bearerObject);
						if( !security[bearerKey] ) {
							security[bearerKey] = {
								name: param.field,
								in: 'header',
								type: param.type,
								description: removeTags(html2markdown(param.description))
							}
						}
					}
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
	if (verbs.parameter && verbs.parameter.fields) {
		
		for( var key in verbs.parameter.fields) {
			if (verbs.parameter.fields.hasOwnProperty(key)) {
				for (var i = 0; i < verbs.parameter.fields[key].length; i++) {
					var param = verbs.parameter.fields[key][i];
					var field = param.field;
					var type = param.type;
					var inParam = '';
					
					if ( param.group && param.group.toLowerCase() === 'urlparameters') {
						inParam = type === "file" ? "formData" : "path";
						pathItemObject.push({
							name: param.field,
							in: inParam,
							required: !param.optional,
							type: param.type.toLowerCase(),
							description: removeTags(html2markdown(param.description))
						});
					}
				}
			}
		}
	}
	return pathItemObject;
}

/**
 * Iterate through all method parameters and create array of parameter objects which are stored as query parameters
 * @param verbs
 * @returns {Array}
 */
function createQueryParameters(verbs, queryKeys) {
	queryKeys = queryKeys || [];

	var queryItemObject = [];
	if (verbs.parameter && verbs.parameter.fields) {
		
		for( var key in verbs.parameter.fields) {
			if (verbs.parameter.fields.hasOwnProperty(key)) {
				for (var i = 0; i < verbs.parameter.fields[key].length; i++) {
					var param = verbs.parameter.fields[key][i];
					var field = param.field;
					var type = param.type;
					var inParam = '';
					if ( param.group && param.group.toLowerCase() === 'urlqueryparameters') {
						inParam = 'query';

						var item = {
							name: param.field,
							in: inParam,
							required: !param.optional,
							type: param.type.toLowerCase(),
							description: removeTags(html2markdown(param.description))
						};

						if( param.allowedValues ) {
							item.enum = param.allowedValues.map( function(value) {
								return value.replace(/^[\"\']/, '').replace(/[\"\']$/, '');
							});
						}
			
						if( param.defaultValue ) {
							item.default = param.defaultValue.replace(/^[\"\']/, '').replace(/[\"\']$/, '');
						}

						queryItemObject.push( item );
					}
				}
			}
		}
	}
	return queryItemObject;
}

/**
 * Iterate through all method parameters and create array of parameter objects which are stored as body parameters
 * @param verbs
 * @returns {Array}
 */
function createBodyParameters(verbs, bodyKeys) {
	bodyKeys = bodyKeys || [];

	var bodyItemObject = [];
	if (verbs.parameter && verbs.parameter.fields) {
		
		for( var key in verbs.parameter.fields) {
			if (verbs.parameter.fields.hasOwnProperty(key)) {
				for (var i = 0; i < verbs.parameter.fields[key].length; i++) {
					var param = verbs.parameter.fields[key][i];
					var field = param.field;
					var type = param.type;
					var inParam = '';
					if ( param.group && param.group.toLowerCase() === 'bodyparameters') {
						inParam = 'body';
						bodyItemObject.push({
							name: param.field,
							in: inParam,
							required: !param.optional,
							type: param.type.toLowerCase(),
							description: removeTags(html2markdown(param.description))
						});
					}
				}
			}
		}
	}
	return bodyItemObject;
}

/**
 * Iterate through all method parameters and create array of parameter objects which are stored as header parameters
 * @param verbs
 * @returns {Array}
 */
function createHeaderParameters(verbs, headerKeys) {
	headerKeys = headerKeys || [];

	var headerItemObject = [];
	if (verbs.parameter && verbs.parameter.fields) {
		
		for( var key in verbs.parameter.fields) {
			if (verbs.parameter.fields.hasOwnProperty(key)) {
				for (var i = 0; i < verbs.parameter.fields[key].length; i++) {
					var param = verbs.parameter.fields[key][i];
					var field = param.field;
					var type = param.type;
					var inParam = '';
					if ( param.group && param.group.toLowerCase() === 'headerparameters') {
						inParam = 'header';
						headerItemObject.push({
							name: param.field,
							in: inParam,
							required: !param.optional,
							type: param.type.toLowerCase(),
							description: removeTags(html2markdown(param.description))
						});
					}
				}
			}
		}
	}
	return headerItemObject;
}

/**
 * Iterate through all method parameters and create array of parameter objects which are stored as form parameters
 * @param verbs
 * @returns {Array}
 */
function createFormParameters(verbs, formKeys) {
	formKeys = formKeys || [];

	var formItemObject = [];
	if (verbs.parameter && verbs.parameter.fields) {
		
		for( var key in verbs.parameter.fields) {
			if (verbs.parameter.fields.hasOwnProperty(key)) {
				for (var i = 0; i < verbs.parameter.fields[key].length; i++) {
					var param = verbs.parameter.fields[key][i];
					var field = param.field;
					var type = param.type;
					var inParam = '';
					if ( param.group && param.group.toLowerCase() === 'formparameters') {
						inParam = 'form';
						formItemObject.push({
							name: param.field,
							in: inParam,
							required: !param.optional,
							type: param.type.toLowerCase(),
							description: removeTags(html2markdown(param.description))
						});
					}
				}
			}
		}
	}
	return formItemObject;
}

/**
 * Iterate through all method parameters and create array of parameter objects which are stored as cookie parameters
 * @param verbs
 * @returns {Array}
 */
function createCookieParameters(verbs, cookieKeys) {
	cookieKeys = cookieKeys || [];

	var cookieItemObject = [];
	if (verbs.parameter && verbs.parameter.fields) {
		
		for( var key in verbs.parameter.fields) {
			if (verbs.parameter.fields.hasOwnProperty(key)) {
				for (var i = 0; i < verbs.parameter.fields[key].length; i++) {
					var param = verbs.parameter.fields[key][i];
					var field = param.field;
					var type = param.type;
					var inParam = '';
					if ( param.group && param.group.toLowerCase() === 'cookieparameters') {
						inParam = 'cookie';
						cookieItemObject.push({
							name: param.field,
							in: inParam,
							required: !param.optional,
							type: param.type.toLowerCase(),
							description: removeTags(html2markdown(param.description))
						});
					}
				}
			}
		}
	}
	return cookieItemObject;
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