
var fs			= require('fs');
var crypto		= require('crypto');
var bunyan		= require('bunyan');
var knexlib		= require('knex');
var ChaosRouter		= require('../../router/nodejs/chaosrouter.js');
var ChaosServer		= require('./chaosserver');

var log			= bunyan.createLogger({
    name: "MainServer",
    level: 'trace'
});

var knex		= knexlib({
    client: 'sqlite',
    connection: {
	filename: '../../testing.sqlite'
    }
});
knex.CURRENT_TIMESTAMP	= knex.raw('CURRENT_TIMESTAMP');

var router		= ChaosRouter('../../routes.json', {
    db: knex,
    basepath: 'api'
});

var methods		= require('./test-methods');
router.extend_methods(methods);

var server		= ChaosServer({
    static: "public",
    auth: function(req, res, next) {
	req.auth	= {
	    user_level: 0
	}
	next();
    },
    hashUploadedFiles: true,
    hashEncoding: 'sha1',
    preUpload: function(req, res, next) {
	var allowed	= req.auth.user_level === 0;
	console.log("preUpload Running");
	if (!allowed)
	    next(new Error("Permission denied to upload"));
	else
	    next();
    },
    postUpload: function(req, res, next) {
	console.log("postUpload Running");
	if (!req.files || !req.files.length)
	    return next();
	next();
    }
});

server.use(server.upload.array('media'), function (req, res, next) {
    if (!req.files || !req.files.length)
	return next();
    
    log.info("Uploaded stuff");
    res.reply(req.files);
});
server.use('/api', function (req, res) {
    var endpoint	= router.route(req.path);
    log.info(req.path);
    if (endpoint === false) {
	res.reply({
            "error": "Wrong Path",
            "message": "This is not a valid API endpoint",
	});
    }
    else {
	log.info("Execute endpoint", req.path);
	endpoint.execute({
	    method: 'HTTP',
	    request: req,
	    response: res,
	    data: req.data,
	    files: req.files,
	    // coauth: coauth,
	    // auth: auth,
	}).then(function (result) {
	    res.reply(result);
	}, function (err) {
	    log.error(err);
	    res.reply({
	    	error: err.name,
	    	message: err.message
	    });
	}).catch(function(err) {
	    log.error(err);
	    res.reply({
	    	error: err.name,
	    	message: err.message
	    });
	});
    }
});
server.listen(8000);
