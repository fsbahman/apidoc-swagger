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
	swagger.definitions = extractDefinitions(apidocJson);
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
			paths[apiPaths[i].verbs[0].url] = createPostPushPutOutput(apiPaths[i].verbs[0]);
		} else {
			paths[apiPaths[i].verbs[0].url] = createGetDeleteOutput(apiPaths[i].verbs[0]);
		}
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
	var apiPaths = groupByUrl(apidocJson);
	var definitions = {};
	for (var i = 0; i < apiPaths.length; i++) {
		if (apiPaths[i].verbs[0].type == 'post' || apiPaths[i].verbs.type == 'patch' || apiPaths[i].verbs.type == 'put') {
			definitions[apiPaths[i].verbs[0].name] = createSchemaDefinition(apiPaths[i].verbs[0]);
		}
	}
	return definitions;
}


/**
 * Extracts parameters from method and creates schema definition
 * @param verbs
 * @returns {{properties: {}, required: Array}}
 */
function createSchemaDefinition(verbs) {
	var pathItemObject = {};
	var required = [];
	//iterate through all params and create param blocks
	if (verbs.parameter) {
		for (var i = 0; i < verbs.parameter.fields.Parameter.length; i++) {
			pathItemObject[verbs.parameter.fields.Parameter[i].field] =
			{
				type: verbs.parameter.fields.Parameter[i].type.toLowerCase(),
				description: verbs.parameter.fields.Parameter[i].description
			};
			//all required fields are pushed to required object
			if (!verbs.parameter.fields.Parameter[i].optional) {
				required.push(verbs.parameter.fields.Parameter[i].field);
			}
		}
	}
	return {properties: pathItemObject, required: required};
}


/**
 * All body parameters are extracted in one field and schema is used as single parameter
 * @param verbs
 * @returns {{}}
 */
function createPostPushPutOutput(verbs) {
	var pathItemObject = {};
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
					"$ref": "#/definitions/"+verbs.name
				}
			}
		]
	}
	return pathItemObject;
}

/**
 * Generate get, delete method output
 * @param verbs
 * @returns {{}}
 */
function createGetDeleteOutput(verbs) {
	var pathItemObject = {};
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