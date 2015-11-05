
var extend		= require('util')._extend;
var fs			= require('fs');
var path		= require('path');
var crypto		= require('crypto');

var bunyan		= require('bunyan');
var Qs			= require('qs');
var mkdirp		= require('mkdirp');
var uuid		= require('node-uuid');
var body_parser		= require('body-parser');
var cookie_parser	= require('cookie-parser');
var multer		= require('multer');
var express		= require('express');
var expressWs		= require('express-ws');

var log			= bunyan.createLogger({
    name: "ChaosServer",
    level: 'trace'
});

// function ws_reply(ws, data) {
//     ws.send( JSON.stringify(data) );
// }
// server.ws('/', function (ws, req) {
//     var session_key		= req.cookies.session;
//     ws.on('message', function(msg) {
// 	var data		= JSON.parse(msg);
// 	var endpoint		= router.route(data.path);
// 	authlib.session( session_key, function(auth) {
// 	    endpoint.set_arguments({
// 		knex: knex,
// 		method: 'WebSocket',
// 		params: data.params,
// 		post: null,
// 		files: null,
// 		coauth: coauth,
// 		auth: auth,
// 		response: null
// 	    });
	    
// 	    endpoint.execute()
// 		.then(function (result) {
// 		    ws_reply(ws, result);
// 		}, function (error) {
// 	    	    log.error(error);
// 		    ws_reply(ws, {
// 	    		error: error.name,
// 	    		message: error.message
// 	    	    });
// 		});
// 	});
//     });
// });

function serverInit(opts) {
    var hashFiles	= !!opts.hashUploadedFiles || false;
    var hashEncoding	= opts.hashEncoding || 'sha1';

    if (crypto.getHashes().indexOf(hashEncoding) === -1)
	throw new Error(hashEncoding+" is not a supported crypto hash algorithm");
    
    var preUpload	= opts.preUpload || function(r,r,n) { n() };
    var _postUpload_	= opts.postUpload || function(r,r,n) { n() };
    var postUpload	= function(req, res, next) {
	if (!hashFiles || !req.files || !req.files.length)
	    return _postUpload_(req, res, next);
	
	var count	= 0;
	for(var i=0; i<req.files.length; i++) {
	    var file	= req.files[i];
	    var fd	= fs.createReadStream(file.path);
	    var hash	= crypto.createHash(hashEncoding);
	    hash.setEncoding('hex');

	    function tmp(hash, file) {
		fd.on('end', function() {
		    count++;
		    hash.end();
		    file.hash		= hash.read();
		    if (count >= req.files.length)
			_postUpload_(req, res, next);
		});
		fd.pipe(hash);
	    }
	    tmp(hash, file);
	}
    }

    if (typeof preUpload !== 'function' || typeof postUpload !== 'function')
	throw new Error("preUpload and postUpload must be functions(req, res, next) [dont forget to call next()]");
    
    var server		= expressWs(express()).app;
    
    server.set('query parser', function(querystr) {
	// Stop the retarded query parser from ignoring number indexes
	// that equal 20 or below.
	return Qs.parse(querystr, { parseArrays: false });
    });

    server.use( function(req, res, next) {
	next();
    });
    server.use( express.static(opts['static'] || 'public') );
    server.use( cookie_parser() );
    server.use( body_parser.json() );
    server.use( body_parser.urlencoded({
	extended: true
    }));
    if (typeof opts.auth === 'function')
	server.use( opts.auth );
    
    server.use( function(req, res, next) {
	preUpload(req, res, function(err) {
	    if (err)
		req.uploadAuth	= err;
	    else
		req.uploadAuth	= true;
	    next();
	});
    });
	
    var storage		= multer.diskStorage({
	destination: function(req, file, cb) {
	    if (req.uploadAuth !== true)
		cb(req.uploadAuth);
	    else
		cb(null, '/tmp');
	},
	filename: function(req, file, cb) {
	    file.ext	= file.originalname.split('.').pop();
	    var guid	= uuid.v4();
	    var name	= [guid, file.ext].join('.');
	    cb(null, name);
	}
    })
    var multerUpload	= multer({ storage: storage });
    
    var upload		= {
	single: function(fieldname) {
	    return function(req, res, next) {
		multerUpload.single(fieldname)(req, res, function() {
		    postUpload(req, res, next);
		});
	    }
	},
	array: function(fieldname, maxCount) {
	    return function(req, res, next) {
		multerUpload.array(fieldname, maxCount)(req, res, function() {
		    postUpload(req, res, next);
		});
	    }
	},
	fields: function(fields) {
	    return function(req, res, next) {
		multerUpload.fields(fields)(req, res, function() {
		    postUpload(req, res, next);
		});
	    }
	}
    }
    server.use( function(req, res, next) {
	req.data	= extend(req.query, req.body);
	res.reply	= function(data) {
	    if (typeof data === 'string')
		res.send(data);
	    else {
		res.set('Content-Type', 'application/json');
		if (req.get('x-requested-with') === undefined)
	    	    res.send( JSON.stringify(data, null, 4) );
		else
	    	    res.send( JSON.stringify(data) );
	    }
	}
	next();
    });
    
    server.upload	= upload;
    return server;
}

module.exports		= serverInit
