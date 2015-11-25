

/**
 * @apiDefine authFail Auth rejected
 *  Auth Rejected
 * @apiError (403) {Object} authFailed Authentication rejected
 * @apiError (403) {String} authFailed.message message
 *
 * @apiErrorExample {json} Error-Response:
 *     HTTP/1.1 403 Forbidden
 *     {
 *       "message": "Collection Not Found"
 *       "error": {
 *          "description": "description",
 *          "status": "403"
 *     }
 */

/**
 * @apiDefine notFound No any Site supervisor found
 *    No any Site supervisor found
 * @apiError (404) {Object} notFound No any Site supervisor found
 * @apiError (404) {string} notFound.message message
 * @apiError (404) {Object} notFound.error
 * @apiError (404) {String} notFound.error.description
 * @apiError (404) {String} notFound.error.status
 * @apiErrorExample {json} Error-Response:
 *    HTTP/1.1 404 Not found
 *    {
 *      "message":"Collection Not Found","error":
 *      {
 *        "description": "The resource you requested could not be found. Please verify that the correct resource path was provided, or refer to https://m2x.att.com/developer/documentation for complete API documentation.",
 *        "status":404
 *      }
 *    }
 */

/**
 * @api {get} /api/:test/login Get request headers for authentication credentials
 * @apiName logIn
 * @apiGroup Common
 * @apiParam {String} test  Test param
 * @apiParam (query) {String} m2xId  User identifier
 * @apiParam (query) {String} m2xKey User secret key/password
 * @apiExample {curl} usage Example:
 *    curl -i http://localhost/api/login?m2xId=XXX&m2xKey=...
 *
 * @apiUse authFail
 *
 * @apiSuccess (200) {Object[]} logIn  User identifier
 * @apiSuccess (200) {String} logIn.m2xId  User identifier
 * @apiSuccess (200) {String} logIn.m2xKey User secret key/password
 * @apiSuccess (201) {Array} logIn  User identifier
 * @apiSuccess (201) {String} logIn.m2xId  User identifier
 * @apiSuccess (201) {String} logIn.m2xKey User secret key/password
 * @apiSuccess (202) {Object} logIn  User identifier
 * @apiSuccess (202) {String} logIn.m2xId  User identifier
 * @apiSuccess (202) {String} logIn.m2xKey User secret key/password
 * @apiSuccess (203) {String[]} logInAlt User secret key/password
 * @apiSuccess (204) {Object[]} ssFiles List of site supervisors with files
 * @apiSuccess (204) {String} ssFiles.id Site Supervisor Id
 * @apiSuccess (204) {String} ssFiles.name Site Supervisor Name
 * @apiSuccess (204) {Object[]} ssFiles.files Site Supervisor file list
 * @apiSuccess (204) {String} ssFiles.files.id record Id
 * @apiSuccess (204) {String} ssFiles.files.name File name
 *
 * @apiSuccessExample {json} Success Response:
 *    HTTP/1.1 200 Ok
 *    {
   *      "m2xId":"XXX",
   *      "m2xKey":"ZZZ"
   *    }
 */

/**
 * @api {post} /api/supervisors/:ssId/files Add file for download by Site Supervisor
 * @apiName supervisor file post
 * @apiGroup Files
 * @apiHeader (header) {String} X-M2X-ID  User identifier
 * @apiHeader (header) {String} X-M2X-KEY User secret key/password
 * @apiParam (path) {String} ssId  Site Supervisor Id
 * @apiParam (body) {String} url   file url
 * @apiParam (body) {String} size  file size
 * @apiParam (body) {String} name  file name
 * @apiParam (body) {String} type  file type
 *
 * @apiExample {curl} usage Example:
 *    curl -i -H "X-M2X-ID:XXX" -H "X-M2X-KEY:ZZZ" http://localhost/api/supervisors/9201d84f67555c1d80448ca27977ba91/files -X PATCH -H "Content-Type: application/json" --data-raw '{"url":"https://emersonclimate.s3.amazonaws.com/7d13de94207b5a733118d8c14ca8a1f6/562f12a56cc9442716a42511/02_02.pdf","size":1651244,"name":"02_02.pdf","type":"application/pdf"}'
 *
 * @apiUse authFail
 * @apiUse notFound
 *
 * @apiSuccess (202) {null} null
 */

/**
 * @api {patch} /api/supervisors/:ssId Site Supervisor Update
 * @apiName supervisor patch
 * @apiGroup Supervisor
 * @apiHeader (header) {String} X-M2X-ID  User identifier
 * @apiHeader (header) {String} X-M2X-KEY User secret key/password
 * @apiParam (path) {String} ssId  Site Supervisor Id
 * @apiParam (body) {Object} SSA Supervisor Agent params
 * @apiParam (body) {String} SSA.ss_username Agent login
 * @apiParam (body) {String} SSA.ss_password Agent password
 * @apiParam (body) {Integer} SSA.heartbeat_interval Agent ???
 * @apiParam (body) {Integer} SSA.reporting_interval Agent global values reporting interval in minutes
 * @apiParam (body) {Integer} SSA.conf_update_interval Agent configuration reporting interval
 *
 * @apiExample {curl} usage Example:
 *    curl -i -H "X-M2X-ID:XXX" -H "X-M2X-KEY:ZZZ" http://localhost/api/supervisors/9201d84f67555c1d80448ca27977ba91 -X PATCH -H "Content-Type: application/json" --data-raw '{"SSA":{"heartbeat_interval":20,"reporting_interval":49,"conf_update_interval":183,"ss_username":"emerson_ss_2","ss_password":"2014-00253"}}'
 *
 * @apiUse authFail
 * @apiUse notFound
 *
 * @apiSuccess (202) {null} null
 */