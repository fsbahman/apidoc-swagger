var _ = require('lodash');

var swagger = {
	swagger	: "2.0",
	info	: {},
	paths	: {}
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

function extractPaths(apidocJson){
	var apiPaths = groupByUrl(apidocJson);
	var paths = {};
	for (var i = 0; i < apiPaths.length; i++) {
		paths[apiPaths[i].url] = extractVerbs(apiPaths[i].verbs);
	}	
	return paths;
}

function extractVerbs(verbs){
	var pathItemObject = {};
	for (var i = 0; i < verbs.length; i++) {
		//TODO: if there are multiple version of documentation for same api/verb pick latest!
		pathItemObject[verbs[i].type] = createOperationObject(verbs[i]);
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

function createOperationObject(verb) {
	var operationObject = {
		description	: verb.title,
		summary		: verb.description,
		tags		: [verb.group],
		parameters	: verb.parameter ? createParameters(verb.parameter): {}
	};
	return operationObject;
}

function createParameters(apiParameters) {
	var parameterArray = [];
	var parameters = [];
	for (field in apiParameters.fields) {
		if (Array.isArray(apiParameters.fields[field])) {
			parameterArray = apiParameters.fields[field];
		}
	}
	for (var i = 0; i < parameterArray.length; i++) {
		var parameter = {
			name		: parameterArray[i].field,
			in			: "query",
			description	: parameterArray[i].description, 
			required	: !parameterArray[i].optional, 
			type		: parameterArray[i].type, 
		};
		parameters.push(parameter);
	}
	return parameters;
}

module.exports = {
	toSwagger: toSwagger
};