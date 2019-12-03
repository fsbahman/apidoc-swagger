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

## Options

The following options can be used to customize the behavior of apidoc-swagger:

| Long Name | Abbreviation | Default | Description |
| --------- | ------------ | ------- | ----------- |
| **--input** | **-i** | **REQUIRED** | Input / source dirname. |
| --file-filters | -f | `.*\\.(clj|coffee|cs|dart|erl|go|java|scala|js|php?|py|rb|ts|pm)$` | RegEx-Filter to select files that should be parsed. |
| --exclude-filters | -e | | RegEx-Filter to select files / dirs that should not be parsed. |
| --output | -o | ./doc/ | Output dirname. |
| --verbose | -v | false | Vebose debug output. |
| --help | -h | | Shows help information |
| --debug | | false | Show debug message |
| --color | | true | Turn off log color |
| --host | | | target host to use instead of url in package.json/apidoc.json |
| --default-response | | false | uses default success responses instead of api doc generated responses |
| --base-path | | / | basepath for the api |
| --schemes | | http | comma separated list of url schemes |
| --parse | | false | Parse only the files and return the data, no file creation. |
| --parse-filters | | | Optional user defined filters. Format name=filename. |
| --parse-languages | | | Optional user defined languages. Format name=filename. |
| --parse-parsers | | | Optional user defined parsers. Format name=filename |
| --parse-workers | | | Optional user defined workers. Format name=filename |
| --silent | | false | Turn all output off |
| --simulate | | false | Execute but don't create output file |
| --markdown | | false | Turn on markdown parser |
| --marked-config | | | Enable custom markdown parser configs. It will overwite all other marked settings. |
| --marked-gfm | | false | Enable GitHub flavored markdown. |
| --marked-tables | | false | Enable GFM tables. This option requires the gfm option to be true. |
| --marked-breaks | | false | Enable GFM line breaks. This option requires the gfm option to be true. |
| --marked-pedantic | | false | Conform to obscure parts of markdown.pl as much as possible. |
| --marked-sanitize | | false | Sanitize the output. Ignore any HTML that has been input. | 
| --marked-smartLists | | false | Use smarter list behavior than the original markdown. |
| --marked-smartypants | | false | Use 'smart' typograhic punctuation for things like quotes and dashes. |

Have a look at [apidoc](https://github.com/apidoc/apidoc) for full functionality overview and capabilities of apidoc.

To read more about how swagger works refer to [swagger-ui](https://github.com/swagger-api/swagger-ui) and [swagger-spec](https://github.com/swagger-api/swagger-spec) for details of `swagger.json`.


## Gulp Module

[gulp-apidoc-swagger](https://github.com/fsbahman/gulp-apidoc-swagger) `npm install gulp-apidoc-swagger`.
