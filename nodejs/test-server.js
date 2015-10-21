
var bunyan		= require('bunyan');
var knexlib		= require('knex');
var ChaosRouter		= require('./chaosrouter');
var ChaosServer		= ChaosRouter.server;

var log			= bunyan.createLogger({
    name: "MainServer",
    level: 'trace'
});

// var CoAuth		= ChaosRouter.coauthSDK;
// var coauth		= CoAuth('coauth', 'da57099e-e378-4db1-8fd2-579cf2b49827', {
//     api_url: 'http://localhost:2884'
// });
// var authlib		= session_lib(coauth, knex);
// var session_lib	= require('./resolve_session.js');

var knex		= knexlib({
    client: 'sqlite',
    connection: {
	filename: '../testing.sqlite'
    }
});
knex.CURRENT_TIMESTAMP	= knex.raw('CURRENT_TIMESTAMP');

var router		= ChaosRouter('../routes.json', {
    db: knex,
    basepath: 'api'
});
var server		= ChaosServer({
    static: "public",
    auth: function(req, res, next) {
	// var session_key		= req.cookies.session;
        // if (session_key)
        //     res.cookie(session	= session_key;
	// authlib.session( session_key, function(auth) {
	//     endpoint.set_arguments({
	// 	knex: knex,
	// 	method: 'HTTP',
	// 	data: extend(req.query, req.body),
	// 	files: req.files,
	// 	// coauth: coauth,
	// 	// auth: auth,
	// 	response: res
	//     });
	// var session_key		= req.cookies.session;
	// authlib.session( session_key, function(auth) {
	//     console.log(auth)
	//     if(! auth.is_logged_in)
	// 	return cb( new Error("User is not logged in") );
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
	
	var count	= 0;
	for(var i=0; i<req.files.length; i++) {
	    var file	= req.files[i];
	    var fd	= fs.createReadStream(file.path);
	    var hash	= crypto.createHash('sha1');
	    hash.setEncoding('hex');

	    function tmp(hash, file) {
		fd.on('end', function() {
		    count++;
		    hash.end();

		    var hashed	= hash.read();
		    var ext		= file.filename.split(/[. ]+/).pop();
		    var new_name	= hashed+'.'+ext;
		    var new_path	= file.destination+"/"+new_name;
		    fs.renameSync(file.path, new_path);
		    file.filename	= new_name;
		    file.path	= new_path;
		    if (count >= req.files.length)
			next();
		});
		fd.pipe(hash);
	    }
	    tmp(hash, file);
	}
	// next('uploads/'+[now.getFullYear(), now.getMonth(), now.getDate()].join('/') + filename);
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
server.use('/', function (req, res) {
    log.info("Doing nothing for request", req.path);
    res.reply({
        "error": "No Website",
        "message": "Go to /api/<version>",
    });
});

server.listen(8000);
