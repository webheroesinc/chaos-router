
var extend	= require('util')._extend;
var Promise	= require('promise');
var restruct	= require('restruct-data');
var fill	= restruct.populater;
var fs		= require('fs');
var util	= require('util');
var bunyan	= require('bunyan');

var log		= bunyan.createLogger({
    name: "ChaosRouter",
    level: module.parent ? 'error' : 'trace'
});
function json(d,f) {
    return JSON.stringify(d, null, f===false?null:4);
}

function setdefault(value, d) {
    return value === undefined ? d : value;
}
function is_dict(d) {
    try {
	return d.constructor.name == 'Object';
    } catch (e) {
	return false;
    }
}
function is_iterable(d) {
    try {
	for( var i in d ) continue;
    } catch(err) {
	return false;
    }
    return true;
}

var basepath	= '.';
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
	    replaceFileRefs( v, undefined, resp );

	if ( typeof v === 'string' && v.indexOf('file:') === 0 ) {
	    var path	= basepath +'/'+ v.substr(5);
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
	    } catch(err) {
		return resp({
		    "error": "Invalid File",
		    "message": "File was not valid JSON: "+ path
		});
	    }
	    try {
		struct[k]	= replaceFileRefs( loaded, parents, resp );
	    } catch(err) {
		log.error(err);
		return resp(err);
	    }
	}
    }
    return is_flat ? struct[0] : struct;
}

function ChaosRouter(data, opts) {
    if (! (this instanceof ChaosRouter))
	return new ChaosRouter(data, opts);
    
    this.configfile	= null;
    this.basepath	= setdefault(opts.basepath, '/');
    this.defaultExec	= opts.defaultExec;
    this.baseArgs	= {}

    if (opts.defaultExec === undefined)
	throw new Error("defaultExec is required");

    if (is_dict(data))
	this.config	= data;
    else if (typeof data === 'string')
	this.configfile	= data;
    else
	throw new Error("Unrecognized data type: "+typeof data);
}
ChaosRouter.directivePrefix		= '__';
ChaosRouter.directiveSuffix		= '__';
ChaosRouter.prototype.__directives__	= {};
ChaosRouter.prototype.directive		= function (name, fn) {
    if (name === undefined || fn === undefined)
	throw Error("Must give a name and a callback when registering directives");

    this.__directives__[name]		= fn;
}
ChaosRouter.prototype.__methods__	= {};
ChaosRouter.prototype.executables	= function (dict) {
    for(var k in dict)
	this.__methods__[k]	= dict[k];
}
ChaosRouter.prototype.route	= function(path, data, parents) {
    var originalPath	= path;
    data		= setdefault(data, null);
    parents		= setdefault(parents, null);

    if (this.configfile !== null) {
	var config	= JSON.parse( fs.readFileSync(this.configfile) );
	this.config	= replaceFileRefs( config, null, function(err) {
	    throw Error(err.error+': '+err.message);
	});
    }

    var variables	= {};
    if (data === null || path.indexOf('/') === 0) {
	data		= this.config;
	parents		= [['', data]];
	if (path.indexOf(this.basepath) === 0)
	    path	= path.slice(this.basepath.length);
    }

    function getDirectives(data) {
	var directives	= {};
	for (var k in data) {
	    var noprefix	= k.slice(ChaosRouter.directivePrefix.length);
	    if ( k.indexOf(ChaosRouter.directivePrefix) === 0
		 && noprefix.indexOf(ChaosRouter.directiveSuffix) === (noprefix.length - ChaosRouter.directiveSuffix.length)) {
		var name		= k.slice(ChaosRouter.directivePrefix.length, -ChaosRouter.directiveSuffix.length);
		directives[name]	= data[k];
		delete data[k];
	    }
	}
	return directives;
    }

    // Remove leading and trailing slashes.
    var _p		= path.replace(/^\//, "").replace(/\/*$/, "")
    var segs		= _p.split('/');
    if (!path || path === '') {
	var directives	= getDirectives(this.config);
    	return Endpoint(originalPath, this.config, directives, variables, this);
    }

    var jsonkeys	= [];
    var last_seg;

    var validateKey	= ChaosRouter.directivePrefix+'validate'+ChaosRouter.directiveSuffix;
    var validates	= data[validateKey] || [];
    for (var i in segs) {
	var seg		= segs[i];

	if (seg === "..") {
	    // We want to exit the current data and get the parent
	    // space.  Get it from the parents list.
	    var parent	= parents.pop();
	    seg		= parent[0];
	    data	= parent[1];
	}
	else {
	    // We are diving deeper into data.  Add the current data
	    // under the last_seg key in the parent list.
	    if (last_seg !== undefined)
		parents.push([last_seg, data]);

	    // Then we figure out what the new current data is meant to be.	    
	    if (data[seg] === undefined) {
		var vkeys	= [];
		var _keys	= Object.keys(data);
		for( var k in _keys ){
		    var v	=  _keys[k];
		    if (v.trim().indexOf(':') === 0)
			vkeys.push(v.trim());
		}
		var vkey	= vkeys.length > 0 ? vkeys.pop() : null;
		data		= vkey === null ? null : data[vkey];
		
		if (data === null)
		    return false;

		variables[vkey.slice(1)]	= unescape(seg);
		jsonkeys.push(vkey);
	    }
	    else {
		data	= data[seg];
		jsonkeys.push(seg);
	    }
	    
	    // Add this level's validates to validations list
	    if(data[validateKey])
		validates.splice.apply(validates, [validates.length-1, 0].concat(data[validateKey]));
	}
	
	last_seg	= seg;
    }
    
    var directives		= getDirectives(data);
    directives['validate']	= validates;
    
    if (directives['base'] === undefined)
	var config	= extend({}, data);
    else {
	var base	= this.route( directives['base'], data, parents );
	delete base.directives['validate'];
	delete directives['base'];

	var merged	= {};
	extend(merged, base.directives);
	extend(merged, directives);
	directives	= merged;
    }

    this.jsonpath	= jsonkeys.join('/');
    return Endpoint(originalPath, config, directives, variables, this);
}
ChaosRouter.prototype.set_arguments	= function(args) {
    if (!is_iterable(args))
	return false;
    
    for ( var name in args )
	this.baseArgs[name] = args[name];
}

function Endpoint(path, config, directives, path_vars, router) {
    if (! (this instanceof Endpoint))
	return new Endpoint(path, config, directives, path_vars, router);

    this.jsonpath	= router.jsonpath;
    this.path		= path;
    this.path_vars	= path_vars;
    this.router		= router;
    this.config		= config;
    this.__methods__	= router.__methods__;
    this.args		= extend(extend({}, router.baseArgs), {
	"path": path_vars
    });
    this.directives	= directives;
    
    if (this.directives['execute'] === undefined)
	this.directives['execute']	= [];
    
    this.directives['execute'].push([router.defaultExec]);
}
Endpoint.prototype.directive		= function (name, fn) {
    if (fn === undefined)
	return this.directives[name];
}
Endpoint.prototype.set_arguments	= function(args) {
    if (!is_iterable(args)) {
	return false;
    }
    delete args.path;
    for ( var name in args )
	this.args[name] = args[name];
}
Endpoint.prototype.recursiveFill= function(args, data) {
    for (var i in args) {
	var v		= null;
	var arg		= args[i];
	if (typeof arg === 'string') {
	    try {
		v	= fill(arg, data);
	    } catch (e) {}
	}
	else if (typeof arg === 'object' && arg !== null) {
	    v		= this.recursiveFill(arg, data);
	}
	else {
	    v		= arg;
	}
	args[i]		= v;
    }
    return args;
}
Endpoint.prototype.explode		= function(args, fn, context) {
    var ctx		= context || this;
    return fn.apply(ctx, args);
}
Endpoint.prototype.method		= function() {
    var args		= Array.prototype.slice.call(arguments);
    var cmd		= eval("this.__methods__."+args.shift());
    var self		= this;
    return new Promise(function(f,r) {
	cmd.call(self, args, f,  function (check) {
	    check === true ? f() : r(check);
	});
    });
}
Endpoint.prototype.route		= function(path) {
    var endpoint	= this.router.route(path);
    var self		= this;
    return new Promise(function(f,r) {
	if (!endpoint)
	    r({ error: "Dead End",
		message: "Respond endpoint '"+path+"' does not exist." });
	
	endpoint.execute(extend({}, self.args))
	    .then(function(d) {
		d.error ? r(d) : f(d);
	    },r);
    });
}
Endpoint.prototype.respondWith		= function(path, cb) {
    var endpoint	= this.router.route(path);
    if (!endpoint)
	cb({ error: "Dead End",
	     message: "Respond endpoint '"+path+"' does not exist." });
    endpoint.execute(extend({}, this.args))
	.then(function(d) {
	    cb(d);
	})
}
function validationErrorResponse(check, command) {
    if (check !== undefined && check.error && check.message)
	return check;
    else {
	var message	= "Failed at rule "+command;
	return {
	    "error": "Failed Validation",
	    "message": typeof check === 'string' ? check : message
	};
    }
}
Endpoint.prototype.runMethod		= function(executes, i, resp) {
    // Assuming we have a list of executes, we want to run them one at a time and only run the next
    // one if the previous is fulfilled.
    var self		= this;
    var exec		= executes[i];

    if (exec === undefined)
	return resp(validationErrorResponse("End of method chain with no response"));
    
    var next		= function () {
	self.runMethod(executes, i+1, resp);
    };
    var args		= [];
    if (typeof exec === 'string') {
	// If [exec] is a string, just do a *fill* on [exec]
	var check	= fill(exec, this);
	if (check !== true) {
	    resp(validationErrorResponse(check, exec));
	}
	// If it is the last exececutable, respond;
	// else continue through the list.
	if(executes.length === i+1)
	    resp();
	else
	    next();
	return;
    }
    else if (Array.isArray(exec)) {
	// If [exec] is an array, use the first item as the function
	// name, and following items as arguments.
	if (exec.length === 0)
	    return resp({
		"error": "Routing Syntax Error",
		"message": "Executable is missing the method name"
	    });
	    
	args		= exec;
	exec		= exec.shift();
    }
    else {
	// If [exec] is not a string or an array, respond with an error.
	return resp({
	    "error": "Routing Syntax Error",
	    "message": "Execute syntax must be an array with at least one value, NOT: "+ typeof exec
	});
    }
    
    if (typeof exec === 'function') 
	// If the original [exec] was an array, and the n
	cmd		= exec;
    else {
	try {
	    cmd		= eval("self.__methods__."+exec);
	} catch (err) {
	    return resp({
		"error": err.name,
		"message": err.message
	    });
	}
	if (typeof cmd !== 'function')
	    throw Error("'"+exec+"' is not a function.  Found type '"+(typeof cmd)+"'");
    }

    args		= this.recursiveFill(args, this.args);

    try {
	cmd.call(this, args, resp,  function (check) {
	    if (check === true) {
		next();
	    }
	    else
		resp(validationErrorResponse(check, exec));
	});
    } catch (err) {
	log.error(err);
	resp({
	    error: err.name,
	    message: err.message
	});
    }
}
Endpoint.prototype.runAll		= function(executables, cb) {
    if (executables === undefined)
	return cb();
    
    var self		= this;
    if (typeof executables === 'string') {
	self.runMethod([executables], 0, cb);
    }
    else if (Array.isArray(executables)) {
	self.runMethod(executables, 0, cb);
    }
    else {
	cb({
	    "error": "Routing Syntax Error",
	    "message": "Execute is missing the method name"
	});
    }
}
Endpoint.prototype.runDirectives	= function(i, next, resp) {
    if (i === undefined)
	i		= 0;

    var directives		= Object.keys(this.router.__directives__);
    var key			= directives[i];

    if (key === undefined) {
	if (next === undefined)
	    return Promise.resolve();
	return next();
    }
    
    var directive		= this.router.__directives__[key];
    var self			= this;
    function cont(f,r) {
	try {
    	    if (self.directives[key] === undefined) {
		self.runDirectives(i+1, f,r)
	    }
	    else {
    		directive.call(self, self.directives[key], function() {
		    self.runDirectives(i+1, f,r)
		}, r);
    	    }
	} catch (err) {
	    log.error(err);
	    r({
		error: err.name,
		message: err.message
	    });
	}
    }
    
    if (next === undefined) {
	return new Promise(function (f,r) {
	    cont(f,r)
	});
    }
    else
	cont(next, resp);
}
Endpoint.prototype.execute		= function(args) {
    if (args) this.set_arguments(args);

    var self		= this;
    return new Promise(function(f,r) {
	self.runDirectives().then(function() {	
	    var validations	= self.directives['validate'];
	    self.runAll(validations, function(error) {
		if (error && error.message !== "End of method chain with no response")
		    return f(error);
		self.runAll(self.directives['execute'], f);
	    });
	}, f).catch(r);
    });
}

ChaosRouter.restruct	= restruct;
ChaosRouter.populater	= restruct.populater;
module.exports		= ChaosRouter;
