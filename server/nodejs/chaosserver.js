
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
var Promise		= require('promise');
var ChaosRouter		= require('chaosrouter');
var restruct		= ChaosRouter.restruct;
var fill		= ChaosRouter.populater;

var log			= bunyan.createLogger({
    name: "ChaosServer",
    level: 'trace'
});
function json(d,f) {
    return JSON.stringify(d, null, f===false?null:4);
}

function strip(str, chr) {
    return str.replace(new RegExp(['^[',chr,']+|[',chr,']+$'].join(''), 'g'), '');
}

function segments(path) {
    return strip(path, '/').split('/');
}

var subscriptions	= {};
function addSubscriber(ws, path) {
    var segs		= segments(path);
    var data		= subscriptions;
    for (var i in segs) {
	var seg		= segs[i];
	if (data[seg] === undefined)
	    data	= data[seg] = {};
	else
	    data	= data[seg];
    }
    if (data['__subs__'] === undefined)
	data['__subs__']	= {};
    data['__subs__'][ws.id]	= ws;

    return subscriptions;
}

function removeSubscriber(ws, path) {
    var segs		= segments(path);
    var data		= subscriptions;
    for (var i in segs) {
	var seg		= segs[i];
	if (data[seg] === undefined)
	    data	= data[seg] = {};
	else
	    data	= data[seg];
    }
    if (data['__subs__'] !== undefined)
	delete data['__subs__'][ws.id];
    
    return subscriptions;
}

function getSubscribers(path, data) {
    var segs		= Array.isArray(path) ? path : segments(path);
    var subscribers	= {};
    if (segs.length === 0)
	return subscribers;
    
    var remainingPath	= segs.slice();
    var data		= data === undefined ? subscriptions : data;
    for (var i in segs) {
	var dynamicSeg;
	var seg			= segs[i];
	var remainingPath	= remainingPath.slice(1);

	for (var ep in data) {
	    if (ep.indexOf(':') === 0) {
		subs	= getSubscribers(remainingPath, data[ep]);
		extend(subscribers, subs);
		extend(subscribers, data[ep]['__subs__'] || {});
	    }
	}

	if (seg === '**') { // seg.indexOf(':') !== 0 || 
	    for (var ep in data) {
		subs	= getSubscribers(remainingPath, data[ep]);
		extend(subscribers, subs);
		extend(subscribers, data[ep]['__subs__'] || {});
		
	    }
	}

	if (data[seg] === undefined)
	    break;
	else
	    data	= data[seg];

	extend(subscribers, data['__subs__'] || {});
    }
    return subscribers;
}


function serverInit(opts) {
    if ( opts.routes === undefined )
	throw Error("Missing required router settings 'routes'");
    
    var router		= ChaosRouter(opts.routes, {
	defaultExec: function (args, resp) {
	    var knex	= this.args.db;
	    var q	= knex.select();

	    var table	= this.directives['table'];
	    var where	= this.directives['where'];
	    var joins	= this.directives['joins'] || [];
	    var columns	= this.directives['columns'] || [];
	    var struct	= this.directives['structure'];

	    q.from(table);
	    
	    for (var i in columns) {
    		if (Array.isArray(columns[i]))
    		    columns[i]	= columns[i].join(' as ');
    		q.column(columns[i]);
	    }
	    for (var i=0; i<joins.length; i++) {
    		var join	= joins[i];
		if (typeof join === 'string')
    		    q.leftJoin(knex.raw(join));
		else {
    		    var t	= join[0];
    		    var c1	= join[1].join('.');
    		    var c2	= join[2].join('.');
    		    q.leftJoin(knex.raw(t), c1, c2);
		}
	    }
	    
	    if (where)
    		q.where( knex.raw(fill(where, this.args)) );

	    log.debug("Query: \n"+q.toString());

	    q.then(function(result) {
		var result	= struct === undefined
	    	    ? result
	    	    : restruct(result, struct);
		resp(result);
	    }, function(err) {
		resp({
		    "error": err.name,
		    "message": err.message
		});
	    }).catch(function(err) {
		resp({
		    "error": err.name,
		    "message": err.message
		});
	    });
	}
    });

    router.directive('response', function (response, next, resp) {
	if ( typeof response === "string" ) {
	    response		= fill(response, this.args);
	    if ( typeof response === "string" ) {
		if(! fs.existsSync(response) ) {
		    return resp({
			error: "Invalid File",
			message: "The response file was not found"
		    });
		}
		response		= fs.readFileSync( response, 'utf8' );
		try {
		    response	= JSON.parse(response)
		} catch(err) {
		    return resp({
			error: "Invalid File",
			message: "The response file was not valid JSON"
		    });
		}
	    }
	    else {
		return resp(response);
	    }
	}
	resp(restruct(this.args, response));
    });

    function replaceFileRefs( struct, parents, resp ) {
	var is_flat		= false;
	if(typeof struct === "string") {
	    struct		= [struct];
	    is_flat		= true;
	}
	parents			= parents || [];
	for( var k in struct ) {
	    var v		= struct[k];
	    if ( typeof v === 'object' && v !== null || Array.isArray(v) )
		replaceFileRefs( v );

	    if ( typeof v === 'string' && v.indexOf('file:') === 0 ) {
		var path	= v.substr(5);
		if ( parents.indexOf(path) !== -1 )
		    return resp({
			"error": "Circular File Call",
			"message": "The file '"+path+"' is trying to load itself."
		    });
		    
		if(! fs.existsSync(path) ) {
		    return resp({
			"error": "Invalid File",
			"message": "JSON file was not found: "+ path
		    });
		}
		var file	= fs.readFileSync( path, 'utf8' );
		try {
		    var loaded	= JSON.parse(file)
		    parents.push(path);
		    struct[k]	= replaceFileRefs( loaded, parents, resp );
		} catch(err) {
		    return resp({
			"error": "Invalid File",
			"message": "File was not valid JSON: "+ path
		    });
		}
	    }
	}
	return is_flat ? struct[0] : struct;
    }
    
    router.directive('structure', function (structure, next, resp) {
	this.directives.structure	= replaceFileRefs( structure, null, resp );
	next();
    });

    router.directive('structure_update', function (update, next, resp) {
	if (this.directives['structure'] === undefined)
	    return resp({
		error: "Structure Update Failed",
		message: "Cannot update undefined; no structure is defined at "+this.route
	    });
	update		= replaceFileRefs(update, null, resp);
	extend( this.directives['structure'], update );
	next();
    });

    var _route_		= router.route;
    router.route	= function() {
	var self		= this;
	var endpoint		= _route_.apply(this, arguments);
	var _execute_		= endpoint.execute;
	endpoint.execute	= function(data) {
	    var self		= this;
	    return _execute_.call(this, data).then(function(result) {
		if (!result.error) {
		    self.args.$result	= result;
		    self.recursiveFill(self.directives.trigger, self.args);
		    for(var i in self.directives.trigger) {
			var path	= self.directives.trigger[i];
			var subs	= getSubscribers(path);
			for (var id in subs) {
			    var ws	= subs[id];
			    if (ws.readyState === 1)
			    	ws.send(json(result));
			    else
			    	log.error("WS Connection is closed", ws.id);
			}
		    }
		}
		return Promise.resolve(result);
	    }, Promise.reject);
	}
	return endpoint;
    }

    var hashFiles	= !!opts.hashUploadedFiles || false;
    var hashEncoding	= opts.hashEncoding || 'sha1';

    if (crypto.getHashes().indexOf(hashEncoding) === -1)
	throw Error(hashEncoding+" is not a supported crypto hash algorithm");
    
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
	
    var storage		= multer.diskStorage({
	destination: function(req, file, cb) {
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
		preUpload(req, res, function(err) {
		    if (err === undefined)
			multerUpload.single(fieldname)(req, res, function() {
			    postUpload(req, res, next);
			});
		    else
			res.reply({
			    "error": err.error || err.name,
			    "message": err.message
			});
		});
	    }
	},
	array: function(fieldname, maxCount) {
	    return function(req, res, next) {
		preUpload(req, res, function(err) {
		    if (err === undefined)
			multerUpload.array(fieldname, maxCount)(req, res, function() {
			    postUpload(req, res, next);
			});
		    else
			res.reply({
			    "error": err.error || err.name,
			    "message": err.message
			});
		});
	    }
	},
	fields: function(fields) {
	    return function(req, res, next) {
		preUpload(req, res, function(err) {
		    if (err === undefined)
			multerUpload.fields(fields)(req, res, function() {
			    postUpload(req, res, next);
			});
		    else
			res.reply({
			    "error": err.error || err.name,
			    "message": err.message
			});
		});
	    }
	}
    }

    function subscribe(ws, path) {
	var ep			= router.route(path);
	
	var segs		= [];
	var segs1		= segments(path);
	var segs2		= segments(ep.jsonpath);
	for (var i in segs1) {
	    var seg1	= segs1[i].trim();
	    var seg2	= segs2[i].trim();
	    var seg		= seg1;
	    if (seg2 === undefined)
		break;

	    if(seg1 === '*')
		seg		= seg2;
	    segs.push(seg);
	}
	// return segs.join('/');
	return addSubscriber(ws, segs.join('/'));
    }
    function ws_reply(ws, data) {
        ws.send( JSON.stringify(data) );
    }
    var i	= 0;
    server.ws('/', function (ws, req) {
	ws.id		= i++;
        var session_key		= req.cookies.session;
        ws.on('message', function(msg) {
    	    var data		= JSON.parse(msg);
	    if (ws.subscriptions === undefined)
		ws.subscriptions	= {};
	    ws.subscriptions[data.subscribe]	= true;
	    subscribe(ws, data.subscribe);
    	});
        ws.on('close', function() {
	    for (var path in ws.subscriptions) {
		var ep		= router.route(path);
		removeSubscriber(ws, ep.jsonpath);
	    }
    	});
    });
    

    server.getRouter	= function() {
	return router;
    }
    server.upload	= upload;
    return server;
}

module.exports		= serverInit
