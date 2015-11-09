
var fs			= require('fs');
var crypto		= require('crypto');
var bunyan		= require('bunyan');
var knexlib		= require('knex');
var ChaosServer		= require('./chaosserver');
var methods		= require('./methods');

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

function reply_error(res) {
    return function (err) {
	log.error(err);
	res.reply({
	    error: err.name,
	    message: err.message
	});
    }    
}

var server		= ChaosServer({
    "routes": "../../routes.json",
    "hashUploadedFiles": true,
    "hashEncoding": "sha1",
    auth: function(req, res, next) {
	req.auth	= {
	    user_level: 0
	}
	next();
    },
    preUpload: function(req, res, next) {
	var allowed	= req.auth.user_level === 0;
	if (!allowed)
	    next(new Error("Permission denied to upload"));
	else
	    next();
    },
    postUpload: function(req, res, next) {
	if (!req.files || !req.files.length)
	    return next();
	next();
    }
});
var router		= server.getRouter();
router.executables(methods);

server.use(server.upload.array('media'), function (req, res, next) {
    if (!req.files || !req.files.length)
	return next();
    
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
	endpoint.execute({
	    db: knex,
	    method: 'HTTP',
	    request: req,
	    response: res,
	    data: req.data,
	    files: req.files
	}).then(function (result) {
	    res.reply(result);
	}, reply_error(res))
	    .catch(reply_error(res));
    }
});
server.listen(8000);
