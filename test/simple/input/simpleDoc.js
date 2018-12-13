/**
 * @api {get} /users/:id Request User information
 * @apiName GetUser
 * @apiGroup User
 *
 * @apiHeader {String} [x-request-id] Request id for tracking
 * @apiParam {Number} id Users unique ID.
 *
 * @apiSuccess {String} firstname Firstname of the User.
 * @apiSuccess {String} lastname  Lastname of the User.
 */

 // infer api parameters from path
/**
 * @api {get} /users/:id/favorites?type=:type&status=:status Request User favorites
 * @apiName GetUserFavorites
 * @apiGroup User
 *
 * @apiParam {Number} [status] Favorite item status
 *
 * @apiSuccess {Object[]} list Favorites list
 * @apiSuccess {Number} list.id Favorite item id
 * @apiSuccess {String} list.name Favorite item name
 */

 // post
/**
 * @api {post} /users/:id/favorites Add item to User favorites
 * @apiName AddItemToUserFavorites
 * @apiGroup User
 *
 * @apiParam {Number} item_id Favorite item id
 *
 * @apiSuccess {Number} id Favorite item id
 * @apiSuccess {String} name Favorite item name
 */


