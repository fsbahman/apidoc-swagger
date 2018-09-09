# apidoc-swagger

Build status: [![CircleCI](https://circleci.com/gh/fsbahman/apidoc-swagger.svg?style=svg)](https://circleci.com/gh/fsbahman/apidoc-swagger)

apidoc and swagger are two nice projects which are focusing on documentation of APIs. 
This project is a middle tier which tries to bring them together in a sense that:
> It uses apidoc to convert inline documentation comments into json schema and later convert it to swagger json schema.

Uses the [apidoc-core](https://github.com/apidoc/apidoc-core) library.

## How It Works

By putting in line comments in the source code like this in javascript, you will get `swagger.json` file which can be served to [swagger-ui](https://github.com/swagger-api/swagger-ui) to generate html overview of documentation.

`/api/foo.js`:
```js
/**
 * @api {get} /user/id Request User information
 * @apiName GetUser
 * @apiGroup User
 *
 * @apiParam {Number} id Users unique ID.
 *
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */
```


## Installation

`npm install apidoc-swagger -g`


Current version unlocks most of the basic capabilities of both projects and improvement is in progress.

## Example

`apidoc-swagger -i example/ -o doc/`



Have a look at [apidoc](https://github.com/apidoc/apidoc) for full functionality overview and capabilities of apidoc.

To read more about how swagger works refer to [swagger-ui](https://github.com/swagger-api/swagger-ui) and [swagger-spec](https://github.com/swagger-api/swagger-spec) for details of `swagger.json`.


## Gulp Module

[gulp-apidoc-swagger](https://github.com/fsbahman/gulp-apidoc-swagger) `npm install gulp-apidoc-swagger`.
