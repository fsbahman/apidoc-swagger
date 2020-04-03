var _ = require('lodash');
var pathToRegexp = require('path-to-regexp');
var html2markdown = require('html2markdown');
var jsonlint = require('jsonlint');

var swagger = {
	swagger	: "2.0",
	info	: {},
	securityDefinitions: {},
	"x-permissions": {},
	paths	: {},
	definitions: {}
};

/**
 * Simple object check.
 * @param item
 * @returns {boolean}
 */
function isObject(item) {
	return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Deep merge two objects.
 * @param target
 * @param ...sources
 */
function mergeDeep(target, ...sources) {
	if (!sources.length) 
		return target;
	const source = sources.shift();

	if (isObject(target) && isObject(source)) {
		for (const key in source) {
			if (isObject(source[key])) {
				if (!target[key]) 
					Object.assign(target, {[key]: {}});
				mergeDeep(target[key], source[key]);
			} else {
				Object.assign(target, {[key]: source[key]});
			}
		}
	}

	return mergeDeep(target, ...sources);
}

function getMimeFromType( type) {
	switch(type) {
		case "json":
			return "application/json";
		case "csv":
			return "text/csv";
		case "txt":
			return "text/plain";
		case "xml":
			return "text/xml";
		default:
			console.log("Unexpected application type: " + type);
			return "application/unknown";
	}
}

function toSwagger(apidocJson, projectJson, swaggerInit) {
	swagger.info = addInfo(projectJson);
	swagger.paths = extractPaths(apidocJson);
	swagger  = mergeDeep( swagger, swaggerInit);

	// Clean up unused elements
	if( !Object.keys(swagger.securityDefinitions).length ) {
		delete swagger.securityDefinitions
	}
	if( !Object.keys(swagger["x-permissions"]).length ) {
		delete swagger["x-permissions"];
	}

	return swagger;
}

var tagsRegex = /(<(\S[^>]+)>)/ig;
// Removes <p> </p> tags from text
function removeTags(text) {
	//return text ? text.replace(tagsRegex, "") : text;
	return text ? text.replace(/<p>/, "").replace(/<\p>/, "") : text;
}

function removeTagsWithHtml2markdown( value ) {
	if( process.env.PURE_MD ) return value;
	try {
		return removeTags(html2markdown( value ));
	} catch(err) {
		return value;
	}
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
				_.extend(obj, createGetDeleteOutput(verb, swagger.definitions, pathKeys));
			}
		}
	}
	return paths;
}

function extractJsonFromExample( content, type, context ) {
	if( type !== 'json') {
		return content;
	}
	// Remove HTTP/1.1 header if present
	var result = "";
	var formattedContent = content.replace(/(^\s*HTTP.*$\n|^\s*\/\/.*$\n|[^\:]\/\/.*$\n)/gm, '');

	// Multiline string treatment
	formattedContent = formattedContent.replace(/("(\\"|[^"]|"")*")/g, function(value) {
		return value.replace(/\n/g,'\\n');
	});

	// Escape \
	formattedContent = formattedContent.replace(/\\[^"]/gm, '\\\\').replace(/\\"/gm, '\\\\\\"');

	try {
		result = JSON.parse(formattedContent);
	}
	catch( err ) {
		try {
			jsonlint.parse(formattedContent);
		} catch (error) {
			console.error( "Example conversion failure: " + context + " - " + content + "\n Error: " + error);
			console.error( "\x1b[31m%s\x1b[0m", "----------------------------------------------\n");
		}
		
	}
	return result;
}

function extractAllowedValues(allowedValues) {

	var prop = {};

	if (allowedValues) {
		allowedValues = allowedValues.map(function (value) {
			return value
				.replace(/^[\"\']/, '')
				.replace(/[\"\']$/, '');
		});

		if (allowedValues[0] && allowedValues[0].startsWith('/')) {
			prop.pattern = allowedValues[0];
		} else {
			prop.enum = allowedValues;
		}
	}
	return prop;
}

function extractDefaultValues(defaultValue) {

	var prop = {};

	if( defaultValue ) {
		defaultValue = defaultValue.replace(/^[\"\']/, '').replace(/[\"\']$/, '');

		if( defaultValue && defaultValue.startsWith('/')) {
			prop.pattern = defaultValue;
		} else {
			prop.default = defaultValue;
		}
	}
	return prop;
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

	if( verbs.parameter && verbs.parameter.fields["Body Parameters"]) {
		params.push({
				"in": "body",
				"name": "body",
				"required": required,
				"schema": {
					"$ref": "#/definitions/" + verbDefinitionResult.topLevelParametersRef
				}
		});
	}

	pathItemObject[verbs.type] = {
		tags: [getTagFromGoup(verbs.group)],
		summary: removeTags(verbs.title),
		description: removeTagsWithHtml2markdown(verbs.description),
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

	var permissions = createPermission(verbs, swagger["x-permissions"]);
	if( permissions && permissions.length ) {
		pathItemObject[verbs.type]["x-permissions"] = permissions;
	}

	if( verbs.deprecated ) {
		pathItemObject[verbs.type].deprecated = true;
		pathItemObject[verbs.type].description = verbs.deprecated.content;
	}

	pathItemObject[verbs.type].responses = {};

	if (verbDefinitionResult.topLevelSuccessRef) {
		// Manage responses
		pathItemObject[verbs.type].responses = {};
		pathItemObject[verbs.type].responses[verbDefinitionResult.topLevelSuccessCode] =  {
			"description": "successful operation",
			"schema": {
			//  "type": verbDefinitionResult.topLevelSuccessRefType,
			//  "items": {
				"$ref": "#/definitions/" + verbDefinitionResult.topLevelSuccessRef
			//  }
			}
		}
		if( verbs.success && verbs.success.examples && verbs.success.examples.length) {
			pathItemObject[verbs.type].responses[verbDefinitionResult.topLevelSuccessCode]["examples"] = {};
			verbs.success.examples.forEach(function(element, index) {
				pathItemObject[verbs.type].responses[verbDefinitionResult.topLevelSuccessCode]["examples"][getMimeFromType(element.type)] = extractJsonFromExample(element.content, element.type, verbDefinitionResult.topLevelSuccessRef);
			}, this);
		}
	};

	if(verbDefinitionResult.topLevelErrorArray && verbDefinitionResult.topLevelErrorArray.length){
		if( !pathItemObject[verbs.type].responses ){
			pathItemObject[verbs.type].responses = {};
		}
		verbDefinitionResult.topLevelErrorArray.forEach( function(item) {
			pathItemObject[verbs.type].responses[item.code] = {
				description: item.description
			};
		});
		if( verbs.error && verbs.error.examples && verbs.error.examples.length) {
			verbs.error.examples.forEach( function(example) {
				var code = example.title.match(/\d+/)[0];
				if( code && pathItemObject[verbs.type].responses[code]) {
					pathItemObject[verbs.type].responses[code]["examples"] = {};
					pathItemObject[verbs.type].responses[code]["examples"][getMimeFromType(example.type)] = extractJsonFromExample(example.content, example.type, verbDefinitionResult.topLevelSuccessRef);
				}
			});
		}
	}

	return pathItemObject;
}

function createVerbDefinitions(verbs, definitions) {
	var result = {
		topLevelParametersRef : null,
		topLevelSuccessRef : null,
		topLevelSuccessRefType : null,
		topLevelErrorArray : []
	};
	var defaultObjectName = verbs.name;
	
	var fieldArrayResult = {};
	if (verbs && verbs.parameter && verbs.parameter.fields) {
		var parameter = verbs.parameter.fields.Parameter || verbs.parameter.fields["Body Parameters"];
		fieldArrayResult = createFieldArrayDefinitions(parameter, definitions, verbs.name, defaultObjectName);		
		result.topLevelParametersRef = fieldArrayResult.topLevelRef;
	}

	if (verbs && verbs.success && verbs.success.fields) {
		for( var key in verbs.success.fields) {
			if (verbs.success.fields.hasOwnProperty(key)) {
				var successItem = verbs.success.fields[key];
				fieldArrayResult = createFieldArrayDefinitions(successItem, definitions, verbs.name, defaultObjectName + "Success");		
				result.topLevelSuccessRef = fieldArrayResult.topLevelRef;
				result.topLevelSuccessRefType = fieldArrayResult.topLevelRefType;
				result.topLevelSuccessCode = (key === "Success 200") ? "200" : key;
				if( fieldArrayResult.topLevelRefFormat ) {
					result.topLevelSuccessRefFormat = fieldArrayResult.topLevelRefFormat;
				}
			}
		}
	}

	if (verbs && verbs.error && verbs.error.fields) {
		for( var key in verbs.error.fields) {
			if (verbs.error.fields.hasOwnProperty(key)) {
				var errorItem = verbs.error.fields[key];
				if( errorItem && errorItem.length ){
					for( var itemKey in errorItem ) {
						if (errorItem.hasOwnProperty(itemKey)) {
							result.topLevelErrorArray.push( {
								code: errorItem[itemKey].field,
								description: errorItem[itemKey].description
							});
						}
					}
				}
			}
		}
	}

	return result;
}

function convertApiDocSimpleTypeToSwaggerType( type, prop ) {
	var _type = type.toLowerCase();

	if( _type === 'string' ) {
		prop.type = 'string';
	}

	if( _type === 'date' || _type === 'date-time' || _type === 'byte' || _type === 'binary'  || _type === 'password') {
		prop.format = _type;
		prop.type = 'string';
	}

	if( _type === 'integer' ) {
		prop.format = 'int32';
		prop.type = 'integer';
	}
	if( _type === 'long' ) {
		prop.format = 'int64';
		prop.type = 'integer';
	}

	if( _type === 'float' || _type === 'double') {
		prop.format = _type;
		prop.type = 'number';
	}
}

function createFieldArrayDefinitions(fieldArray, definitions, topLevelRef, defaultObjectName) {
	
	if (!fieldArray) {
		return {
			topLevelRef : topLevelRef
		};
	}
	
	fieldArray.sort((a, b) => +(a.field > b.field) || -(a.field < b.field));
	
	var result = {
		topLevelRef : defaultObjectName,
		topLevelRefType : "#/definitions/" + defaultObjectName,
		topLevelRefFormat: null
	};

	definitions[defaultObjectName] = definitions[defaultObjectName] ||
	{ type: "object", properties : {} };

	for (var i = 0; i < fieldArray.length; i++) {	
		var parameter = fieldArray[i];
		var nestedName = createNestedName(parameter.field);
		var objectName = nestedName.objectName;
		if (!objectName) {
			objectName = defaultObjectName;
		}
		var type = parameter.type;

		if (nestedName.propertyName) {
			var type = (parameter.type || "").toLowerCase();
			var proptype = type === 'date' || type === 'binary' ? 'string' : type;

			var prop = {};//{ type: proptype, description: removeTags(parameter.description) };
			if(parameter.type === "Object") {
				prop = { type: "object", properties : {} };
			} else {
				prop.type = proptype;
				prop.description = removeTagsWithHtml2markdown(parameter.description);
			}

			prop = Object.assign( prop, extractAllowedValues(parameter.allowedValues), extractDefaultValues(parameter.defaultValue) );

			convertApiDocSimpleTypeToSwaggerType(type, prop);

			var typeIndex = type.indexOf("[]");
			var localDefinitionName = objectName;
			if(typeIndex !== -1 && typeIndex === (type.length - 2)) {
				prop.type = "array";

				var _type = type.slice(0, type.length-2);
				if(  _type === 'object' ) {
					var localDefinitionName = defaultObjectName + "_" + nestedName.propertyName;
					prop.items = { 
						"$ref": "#/definitions/" + localDefinitionName
					};
					definitions[localDefinitionName] = definitions[localDefinitionName] ||
					{ type: "object", properties : {} };
				} else {
					// ********************************* correction :enum schemas ***********************************
					if(prop.hasOwnProperty('enum')){
					  prop.items = { 
						enum: prop.enum,
						type: _type
					  };
					  delete prop.enum;
					}else{
					  prop.items = { 
						type: _type
					  };
					}
				}
			}

			if( prop.type === 'string') {
				if( parameter.size ) {
					var sizeRegex = /^(\d*)\.\.(\d*)$/g; // ex: "4..67"
					var match = sizeRegex.exec(parameter.size);
					if( match && match[1]) {
						prop.minLength = parseInt( match[1], 10);
					}
					if( match && match[2]) {
						prop.maxLength = parseInt( match[2], 10);
					}
					if( !match && parameter.size.match(/\d+/)) {
						prop.minLength = prop.maxLength = parseInt( parameter.size, 10);
					}
				}
			}	

			if( prop.type === 'integer' || prop.type === 'number') {
				if( parameter.size ) {
					var sizeNumberRegex = /^(-?\d*)-(\d*)$/g; // ex: "4-67"
					var match = sizeNumberRegex.exec(parameter.size);
					if( match && match[1]) {
						prop.minimum = parseInt( match[1], 10);
					}
					if( match && match[2]) {
						prop.maximum = parseInt( match[2], 10);
					}
				}
			}

			if( nestedName.objectName && !definitions[defaultObjectName + "_" + nestedName.objectName]) {
				var parentObject = definitions[result.topLevelRef];
				nestedName.objectNames.forEach( function(value) {
					if( parentObject.properties[value]) {
						if( parentObject.properties[value].items && parentObject.properties[value].items.$ref ) {
							parentObject = definitions[parentObject.properties[value].items.$ref.replace("#/definitions/","")];
						} else {
							parentObject = parentObject.properties[value];
						}
					} else {
						parentObject.properties[value] = { type: "object", properties : {} };
					}
				});
				if( parentObject.items && parentObject.items.$ref ) {
					parentObject = definitions[parentObject.items.$ref.replace("#/definitions/","")];
				}

				parentObject.properties[nestedName.propertyName] = prop;
				if (!parameter.optional) {
					if( !parentObject.required ) {
						parentObject.required = [];
					}
					var arr = parentObject.required;
					if(arr.indexOf(nestedName.propertyName) === -1) {
						arr.push(nestedName.propertyName);
					}
				}
			} else {

				if( definitions[defaultObjectName + "_" + nestedName.objectName] ) {
					objectName = defaultObjectName + "_" + nestedName.objectName;
				}
				definitions[objectName]['properties'][nestedName.propertyName] = prop;
				if (!parameter.optional) {
					if( !definitions[objectName].required ) {
						definitions[objectName].required = [];
					}
					var arr = definitions[objectName].required;
					if(arr.indexOf(nestedName.propertyName) === -1) {
						arr.push(nestedName.propertyName);
					}
				}
			}
		}
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
		objectName: objectName,
		objectNames: propertyNames
	};
}


/**
 * Generate get, delete method output
 * @param verbs
 * @returns {{}}
 */
function createGetDeleteOutput(verbs,definitions, pathKeys) {
	var pathItemObject = {};
	verbs.type = verbs.type === "del" ? "delete" : verbs.type;

	var verbDefinitionResult = createVerbDefinitions(verbs,definitions);
	
	var params = [];
	var pathParams = createPathParameters(verbs, pathKeys);
	pathParams = _.filter(pathParams, function(param) {
		var hasKey = pathKeys.indexOf(param.name) !== -1;
		return !(param.in === "path" && !hasKey);
	});
	
	params = params.concat(pathParams);
	var required = verbs.parameter && verbs.parameter.fields && ((verbs.parameter.fields.Parameter && verbs.parameter.fields.Parameter.length > 0) || (verbs.parameter.fields["Body Parameters"] && verbs.parameter.fields["Body Parameters"].length > 0));

	if( verbs.parameter && verbs.parameter.fields["Body Parameters"]) {
		params.push({
				"in": "body",
				"name": "body",
				"required": required,
				"schema": {
					"$ref": "#/definitions/" + verbDefinitionResult.topLevelParametersRef
				}
		});
	}

	pathItemObject[verbs.type] = {
		tags: [getTagFromGoup(verbs.group)],
		summary: removeTags(verbs.title),
		description: removeTagsWithHtml2markdown(verbs.description),
		operationId: verbs.name,
		consumes: [
			"application/json"
		],
		produces: [
			"application/json"
		],
		parameters: params.concat( 
			//createPathParameters(verbs),
			createHeaderParameters(verbs),
			createCookieParameters(verbs),
			createQueryParameters(verbs),
			//createBodyParameters(verbs),
			createFormParameters(verbs)
		)
	};

	var security = createSecurity(verbs, swagger.securityDefinitions);
	if( security && security.length ) {
		pathItemObject[verbs.type].security = security;
	}

	var permissions = createPermission(verbs, swagger["x-permissions"]);
	if( permissions && permissions.length ) {
		pathItemObject[verbs.type]["x-permissions"] = permissions;
	}
	
	if( verbs.deprecated ) {
		pathItemObject[verbs.type].deprecated = true;
		pathItemObject[verbs.type].description = verbs.deprecated.content;
	}

	if (verbDefinitionResult.topLevelSuccessRef) {
		if( verbDefinitionResult.topLevelSuccessRefType.indexOf("Object") > -1 
		|| verbDefinitionResult.topLevelSuccessRefType[0] === "#") {
			pathItemObject[verbs.type].responses = {};
			pathItemObject[verbs.type].responses[verbDefinitionResult.topLevelSuccessCode] = {
				"description": "successful operation",
				"schema": {
					"$ref": "#/definitions/" + verbDefinitionResult.topLevelSuccessRef
				}
			};
			if( verbs.success && verbs.success.examples && verbs.success.examples.length) {
				pathItemObject[verbs.type].responses[verbDefinitionResult.topLevelSuccessCode]["examples"] = {};
				verbs.success.examples.forEach(function(element, index) {
					pathItemObject[verbs.type].responses[verbDefinitionResult.topLevelSuccessCode]["examples"][getMimeFromType(element.type)] = extractJsonFromExample(element.content, element.type, verbDefinitionResult.topLevelSuccessRef);
				}, this);
			}
		} else {
			pathItemObject[verbs.type].responses = {};
			pathItemObject[verbs.type].responses[verbDefinitionResult.topLevelSuccessCode] =  {
				"description": "successful operation",
				"schema": {
					"type": verbDefinitionResult.topLevelSuccessRefType.toLowerCase()
				}
			}
			if( verbDefinitionResult.topLevelSuccessRefFormat ) {
				pathItemObject[verbs.type].responses[verbDefinitionResult.topLevelSuccessCode].schema.format = verbDefinitionResult.topLevelSuccessRefFormat;
			}
			if( verbs.success && verbs.success.examples && verbs.success.examples.length) {
				pathItemObject[verbs.type].responses[verbDefinitionResult.topLevelSuccessCode]["examples"] = {};
				verbs.success.examples.forEach(function(element, index) {
					pathItemObject[verbs.type].responses[verbDefinitionResult.topLevelSuccessCode]["examples"][getMimeFromType(element.type)] = extractJsonFromExample(element.content, element.type, verbDefinitionResult.topLevelSuccessRef);
				}, this);
			}
		}
	}
	
	if(verbDefinitionResult.topLevelErrorArray && verbDefinitionResult.topLevelErrorArray.length){
		if( !pathItemObject[verbs.type].responses ){
			pathItemObject[verbs.type].responses = {};
		}
		verbDefinitionResult.topLevelErrorArray.forEach( function(item) {
			pathItemObject[verbs.type].responses[item.code] = {
				description: item.description
			};
		});
		if( verbs.error && verbs.error.examples && verbs.error.examples.length) {
			verbs.error.examples.forEach( function(example) {
				if( ! example.title) {
					console.error("You must specify an example content type with {<type>}, ie: '* @apiErrorExample {json} 401 Error Response:'");
				}
				var matches = example.title.match(/\d+/);
				if(matches){
					if( code && pathItemObject[verbs.type].responses[code]) {
						pathItemObject[verbs.type].responses[code]["examples"] = {};
						pathItemObject[verbs.type].responses[code]["examples"][getMimeFromType(example.type)] = extractJsonFromExample(example.content, example.type, verbDefinitionResult.topLevelSuccessRef);
					}
				}
			});
		}
	}

	return pathItemObject;
}

function createPermission( verbs, permissions ) {
	var pathItemObject = [];
	if (verbs.permission ) {
		for (var i = 0; i < verbs.permission.length; i++) {
			var permission = verbs.permission[i];
			if( permission.name === 'none') {
				continue;
			}

			pathItemObject.push( {
				name: permission.name
			});
			if( !permissions[permission.name] ) {
				permissions[permission.name] = {
					name: permission.name,
					title: permission.title,
					description: removeTagsWithHtml2markdown(permission.description)
				} 
			}
		}
	}
	return pathItemObject;
}

/**
 * Iterate through all method parameters and create array of parameter objects which are stored as security authentication
 * @param verbs
 * @returns {Array}
 */
function createSecurity(verbs, security) {

	var pathItemObject = [];
	if (verbs.header && verbs.header.fields) {

		for (var key in verbs.header.fields) {
			if (key.toLowerCase() !== "security") {
				continue;
			}
			if (verbs.header.fields.hasOwnProperty(key)) {
				for (var i = 0; i < verbs.header.fields[key].length; i++) {
					var param = verbs.header.fields[key][i];
					var field = param.field;
					var type = param.type;
					var inParam = '';
					if (param.group) {
						switch (param.group.toLowerCase()) {
							case 'bearerauthorization':
								{
									var bearerKey = param.field.toLowerCase() === "authorization" ? "Bearer" : "Bearer-" + param.field;
									var bearerObject = {};
									bearerObject[bearerKey] = [];
									pathItemObject.push(bearerObject);
									if (!security[bearerKey]) {
										security[bearerKey] = {
											name: param.field,
											in: 'header',
											type: param.type,
											description: removeTagsWithHtml2markdown(param.description)
										}
									}
								}
								break;
							default:
								{
									if (param.group.toLowerCase().startsWith('basic')) {
										var basicKey = param.field.toLowerCase() === "authorization" ? "Basic" : param.field.split('-')
											.map(function (w) {
												return w.charAt(0).toUpperCase() + w.slice(1)
											}).join('');
										var basicObject = {};
										basicObject[basicKey] = [];
										pathItemObject.push(basicObject);
										if (!security[basicKey]) {
											security[basicKey] = {
												type: param.type,
												description: removeTagsWithHtml2markdown(param.description)
											}

											if (param.type !== 'basic') {
												security[basicKey] = Object.assign(security[basicKey], {
													name: param.field,
													in: 'header',
												})
											}
										}
									}
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
							description: removeTagsWithHtml2markdown(param.description)
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
							description: removeTagsWithHtml2markdown(param.description)
						};
						
						item = Object.assign( item, extractAllowedValues(param.allowedValues), extractDefaultValues(param.defaultValue) );

						convertApiDocSimpleTypeToSwaggerType(type, item);

						if( param.type === 'string') {
							if( param.size ) {
								var sizeRegex = /^(\d*)\.\.(\d*)$/g; // ex: "4..67"
								var match = sizeRegex.exec(param.size);
								if( match && match[1]) {
									item.minLength = parseInt( match[1] ,10);
								}
								if( match && match[2]) {
									item.maxLength = parseInt( match[2] ,10);
								}
								if( !match && param.size.match(/\d+/)) {
									item.minLength = item.maxLength = parseInt( param.size, 10);
								}
							}
						}

						if( param.type === 'integer' || param.type === 'number') {
							if( param.size ) {
								var sizeNumberRegex = /^(-?\d*)-(\d*)$/g; // ex: "4-67"
								var match = sizeNumberRegex.exec(param.size);
								if( match && match[1]) {
									item.minimum = parseInt( match[1] ,10);
								}
								if( match && match[2]) {
									item.maximum = parseInt( match[2] ,10);
								}
							}
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
							description: removeTagsWithHtml2markdown(param.description)
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
						var field = Object.assign({
							name: param.field,
							in: inParam,
							required: !param.optional,
							type: param.type.toLowerCase(),
							description: removeTagsWithHtml2markdown(param.description)
						},
						extractAllowedValues(param.allowedValues),
						extractDefaultValues(param.defaultValue));

						headerItemObject.push(field);
					}
				}
			}
		}
	}
	if( verbs.header && verbs.header.fields) {
		for( var key in verbs.header.fields) {
			if (verbs.header.fields.hasOwnProperty(key)) {
				for (var i = 0; i < verbs.header.fields[key].length; i++) {
					var param = verbs.header.fields[key][i];
					var field = param.field;
					var type = param.type;
					var inParam = '';
					if ( param.group && param.group.toLowerCase() === 'header') {
						inParam = 'header';
						var field = Object.assign({
							name: param.field,
							in: inParam,
							required: !param.optional,
							type: param.type.toLowerCase(),
							description: removeTagsWithHtml2markdown(param.description)
						}, extractAllowedValues(param.allowedValues),
						extractDefaultValues(param.defaultValue));

						headerItemObject.push(field);
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
							description: removeTagsWithHtml2markdown(param.description)
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
							description: removeTagsWithHtml2markdown(param.description)
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
		.toPairs()
		.map(function (element) {
			return _.zipObject(["url", "verbs"], element);
		})
		.value();
}

module.exports = {
	toSwagger: toSwagger
};
