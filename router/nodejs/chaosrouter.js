var bunyan	= require('bunyan');

var log		= bunyan.createLogger({
    name: "ChaosRouter",
    level: module.parent ? 'error' : 'trace'
});

var extend	= require('util')._extend;
var Promise	= require('promise');
var restruct	= require('restruct-data');
var populater	= restruct.populater;
var fs		= require('fs');
var util	= require('util');

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
function Module(name, router) {
    if (! (this instanceof Module))
	return new Module(name, router);
    
    this.module		= __modules__[name];
    this.router		= router;
}
Module.prototype.enable	= function() {
    if (arguments.length === 0) {
	for (var k in this.module)
	    this.router.directive(k, this.module[k]);
    }
    else {
	// enable each directive given
	for (var i in arguments) {
	    var name	= arguments[i];
	    this.router.directive(name, this.module[name]);
	}
    }
};

function ChaosRouter(data, opts) {
    if (! (this instanceof ChaosRouter))
	return new ChaosRouter(data, opts);

    if (!opts)
	opts		= {};
    
    this.configfile	= null;
    this.basepath	= setdefault(opts.basepath, '/');
    this.baseArgs	= {}

    if (is_dict(data))
	this.config	= data;
    else if (typeof data === 'string')
	this.configfile	= data;
    else
	throw new Error("Unrecognized data type: "+typeof data);
}
ChaosRouter.prototype.module	= function(name) {
    return Module(name, this);
};
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
	    if(data[validateKey]) {
		validates.splice.apply(validates, [validates.length, 0].concat(data[validateKey]));
	    }
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
		v	= populater(data)(arg);
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

function run_sequence(list, fn, index) {
    if (index === undefined)
	index		= 0;
    
    if (list[index] === undefined)
	throw Error("End of method chain with no response");
    if (typeof list[index] !== 'function')
	throw Error("run_sequence list item is not a function.  Type '"+(typeof list[index])+"' given");

    fn(list[index], function() {
	run_sequence(list, fn, index+1);
    });
}

Endpoint.prototype.runDirectives	= function() {
    var self			= this;
    var directivesMap		= this.router.__directives__;

    var directives		= Object.keys(directivesMap).map(function(k) {
	var directive		= directivesMap[k];
	directive.config	= self.directives[k];
	return directive;
    });

    return new Promise(function(f,r) {
	try {
	    run_sequence(directives, function(directive, next) {
		if (directive.config === undefined) {
		    next();
		}
		else {
		    directive.call(self, directive.config, next, function(data) {
			if (data instanceof Error)
			    r(data);
			else
			    f(data);
		    });
		}
	    });
	}
	catch (err) {
	    console.error("Caught Promise snuffing error", err);
	}
    });
}

Endpoint.prototype.execute		= function(args) {
    if (args) this.set_arguments(args);

    var self		= this;
    return new Promise(function(f,r) {
	self.runDirectives().then(function(result) {
	    f(result);
	}, f).catch(r);
    });
}

var __modules__		= {};

ChaosRouter.restruct	= restruct;
ChaosRouter.populater	= restruct.populater;
ChaosRouter.module	= function(module) {
    var module			= require(module);
    __modules__[module.name]	= module.directives;
}
ChaosRouter.modules	= function() {
    var modules = [];
    for (var i in arguments) {
	modules.push( ChaosRouter.module(arguments[i]) );
    }
    return modules;
}
module.exports		= ChaosRouter;
