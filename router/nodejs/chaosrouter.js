var bunyan	= require('bunyan');

var log		= bunyan.createLogger({
    name: "ChaosRouter",
    level: 'trace' // module.parent ? 'error' : 'trace'
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

function getVariableKey(config) {
    var vkey		= null;
    Object.keys(config).forEach(function(key) {
	if (key.trim().indexOf(':') === 0) {
	    if (vkey === null)
		vkey	= key;
	    else
		log.warn("Multiple variable keys found in config", config);
	}
    });
    return vkey;
}
function loadConfigFile(filepath) {
    var config	= JSON.parse( fs.readFileSync(filepath) );
    config 	= replaceFileRefs( config, null, function(err) {
	throw Error(err.error+': '+err.message);
    });
    return config;
}



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
ChaosRouter.prototype.root	= function() {
    if (this.configfile)
	this.config		= loadConfigFile( this.configfile );
    return Endpoint("/", {}, this.config, [], this);
};
ChaosRouter.prototype.modules	= function() {
    var self		= this;
    
    for (var i in arguments) {
	var arg		= arguments[i];
	if (typeof arg === 'string') {
	    log.trace("Load modules string", arg);
	    self.module(arg, ChaosRouter.ENABLE_ALL);
	}
	else if (typeof arg === 'object') {
	    var config		= arg;
	    
	    log.trace("Load modules object", config);
	    for (var name in config) {
		var directives	= config[name];
		var cmd		= name.split(' ')[1];
		
		if (cmd) {
		    name	= name.split(' ')[0];
		    switch (cmd) {
		    case '^':
			self.module(name, {
			    "exclude": directives
			});
			break;
		    case '!':
			self.module(name, {
			    "disable": directives
			});
			break;
		    default:
			log.error("Unknown command '"+cmd+"' in module loading");
			break;
		    }
		}
		else if (directives === true) {
		    self.module(name, ChaosRouter.ENABLE_ALL);
		}
		else if ( Array.isArray(directives) ) {
		    self.module(name, {
			"enable": directives
		    });
		}
		else {
		    log.error("Unexpected type for directive list '"+(typeof directives)+"'");
		}
	    }
	}
	else {
	    log.error("Failed to load module because of unexpected argument type", typeof arg);
	}
    }
}
ChaosRouter.ENABLE_ALL		= 0;
ChaosRouter.ENABLE_SELECTION	= 1;
ChaosRouter.ENABLE_EXCULSION	= 2;
ChaosRouter.DISABLE_SELECTION	= 3;
ChaosRouter.prototype.module	= function(name, config) {
    if (typeof config === 'number') {
	log.trace("Converting config number", config, "to config object");
	var list		= arguments[2];
	switch(config) {
	case ChaosRouter.ENABLE_ALL:
	    return this.module(name, {"enable": true});
	    break;
	case ChaosRouter.ENABLE_SELECTION:
	    return this.module(name, {"enable": list});
	    break;
	case ChaosRouter.ENABLE_EXCLUSION:
	    return this.module(name, {"exclude": list});
	    break;
	case ChaosRouter.DISABLE_SELECTION:
	    return this.module(name, {"disable": list});
	    break;
	default:
	    return log.error("Unknown config number in Module load '"+config+"'.  Supported values are ENABLE_ALL, ENABLE_SELECTION, ENABLE_EXCLUSION, DISABLE_SELECTION");
	    break;
	}
    }
    
    var self		= this;
    var module		= __modules__[name];
    var directives	= module.__directives__;
    
    if (typeof config === 'object') {
	log.debug("Load module", name, "with config", config);
	if (config.enable === true) {
	    // Enable all
	    for (var name in directives) {
		self.directive(name, directives[name]);
	    }
	}
	else if ( Array.isArray(config.enable) ) {
	    config.enable.forEach(function(name) {
		self.directive(name, directives[name]);
	    });
	}
	else if ( Array.isArray(config.exclude) ) {
	    for (var name in directives) {
		if (config.exclude.indexOf(name) === -1)
		    self.directive(name, directives[name]);
	    }
	}
	else if ( Array.isArray(config.disable) ) {
	    config.disable.forEach(function(name) {
		self.directive(name, directives[name], false);
	    });
	}
	else {
	    log.error("Configuration does not contain any valid commands (eg. enable, exclude, disable)", config);
	}
    }
    else if ([undefined,null].indexOf(config) === -1) {
	log.error("Unexpected configuration type in module load '"+(typeof config)+"'");
    }

    return module;
};
ChaosRouter.directivePrefix		= '__';
ChaosRouter.directiveSuffix		= '__';
ChaosRouter.prototype.__directives__	= {};
ChaosRouter.prototype.directive		= function (name, fn) {
    if (name === undefined || fn === undefined)
	throw Error("Must give a name and a callback when registering directives");

    this.__directives__[name]		= fn;
}
ChaosRouter.prototype.route	= function(path) {
    return this.root().route(path);
}
ChaosRouter.prototype.set_arguments	= function(args) {
    if (!is_iterable(args))
	return false;
    
    for ( var name in args )
	this.baseArgs[name] = args[name];
}


function run_sequence(list, fn, index) {
    if (index === undefined)
	index		= 0;
    
    if (list[index] === undefined) {
	var directives	= list.map(function(fn) {return fn.name;});
	throw Error("End of method chain with no response (undefined index: "+index+", list length: "+list.length+", directives: "+directives.join(', ')+")");
		   }
    if (typeof list[index] !== 'function')
	throw Error("run_sequence list item is not a function.  Type '"+(typeof list[index])+"' given");

    fn(list[index], function() {
	run_sequence(list, fn, index+1);
    });
}


function Endpoint(path, params, config, parents, router) {
    if (! (this instanceof Endpoint))
	return new Endpoint(path, params, config, parents, router);

    this.path		= path;
    this.params		= params;
    this.raw		= config;
    this.router		= router;
    this.args		= extend(extend({}, router.baseArgs), {
	"path": params
    });

    var directives		= getDirectives(config);

    if (directives['base'] === undefined)
	var config	= extend({}, config);
    else {
	var base	= this.route( directives['base'], config, parents );
	log.trace("Basing off of", directives['base'], Object.keys(base.directives()) );
	delete directives['base'];

	var merged	= {};
	extend(merged, base.__directives__);
	extend(merged, directives);
	directives	= merged;
    }
    
    this.__parents__	= parents;
    this.__directives__	= directives;
}
Endpoint.prototype.route	= function(path, data, parents) {
    var originalPath	= path;
    data		= setdefault(data, null);
    parents		= setdefault(parents, null);

    // If a 'this.configfile' has been specified. Load config from 'this.configfile' path and
    // replace all references.  This happens everytime 'this.route' is called, which isn't ideal.
    // There should be a setting to load it everytime for development, but the default should be
    // once at initialization.
    if (this.router.configfile !== null)
	this.config	= loadConfigFile( this.router.configfile );

    // Initialize the path variable collection
    var variables	= {};
    
    // If a relative path was not provided, then assume we are starting at the 'root' of the route
    // configuration.  If a relative path was provided, but no data or parents were given, there
    // should be an error.
    if (data === null || path.indexOf('/') === 0) {
	data		= this.config;
	parents		= [['', data]];
	if (path.indexOf(this.router.basepath) === 0)
	    path	= path.slice(this.router.basepath.length);
    }

    // Remove leading and trailing slashes, then create the path segments list.
    var _p		= path.replace(/^\//, "").replace(/\/*$/, "");
    var segs		= _p.split('/');

    // Path leads to the 'root' of route configuration, so return now.
    if (!path || path === '') {
	var directives	= getDirectives(this.config);
    	return Endpoint(originalPath, variables, this.config, parents, this.router);
    }

    var jsonkeys	= [];	// Used for tracking the raw path from the configuration.
    var last_seg;		// Used for pushing onto parents list

    for (var i in segs) {
	var seg		= segs[i];

	if (seg === "..") {
	    // Reset state to parent node
	    var parent	= parents.pop();
	    seg		= parent[0];
	    data	= parent[1];
	}
	else {
	    // Since we are not going into the parent node, put the last segment and data onto the
	    // parents list.
	    if (last_seg !== undefined)
		parents.push([last_seg, data]);

	    // If the current 'segment' is not in the parent configuration, search for the wildcard
	    // key.
	    if (data[seg] === undefined) {
		var key			= getVariableKey(data);
		
		if (key === null)
		    return false;
		
		data			= data[key];
		var vname		= key.slice(1);	// Remove ':' from key to get variable name

		variables[vname]	= decodeURIComponent(seg);
		jsonkeys.push(key);
	    }
	    // Replace parent configuration with the matching segment's configuration.
	    else {
		data	= data[seg];

		jsonkeys.push(seg);
	    }
	}
	
	last_seg	= seg;
    }

    // router_path	= jsonkeys.join('/');
    return Endpoint(originalPath, variables, data, parents, this.router);
}
Endpoint.prototype.parents		= function() {
    var self		= this;

    var path		= null;
    return this.__parents__.map(function(pair) {
	path		= path === null ? pair[0] : [path, pair[0]].join('/');
	
	var draft	= self.router.route(path || '/');
	log.trace("Parent draft using path", path, !!draft, typeof draft, draft instanceof Endpoint);
	return draft;
    }).reverse();
}
Endpoint.prototype.directives		= function(name) {
    if (name)
	return this.directive(name);
    return this.__directives__;
}
Endpoint.prototype.directive		= function (name) {
    return this.__directives__[name] || null;
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
// Endpoint.prototype.route		= function(path) {
//     var endpoint	= this.router.route(path);
//     var self		= this;
//     return new Promise(function(f,r) {
// 	if (!endpoint)
// 	    r({ error: "Dead End",
// 		message: "Respond endpoint '"+path+"' does not exist." });
	
// 	endpoint.execute(extend({}, self.args))
// 	    .then(function(d) {
// 		d.error ? r(d) : f(d);
// 	    },r);
//     });
// }
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
Endpoint.prototype.runDirectives	= function() {
    var self			= this;
    var directivesMap		= this.router.__directives__;

    var directives		= Object.keys(directivesMap).map(function(k) {
	var directive		= directivesMap[k];
	directive.key		= k;
	directive.config	= self.directive(k);
	return directive;
    });

    return new Promise(function(f,r) {
	try {
	    run_sequence(directives, function(directive, next) {
		if (directive.config === null) {
		    log.trace("For path", self.path, "skipping directive", directive.key);
		    next();
		}
		else {
		    log.trace("For path", self.path, "run directive '"+directive.key+"' with config", directive.config);
		    self.next		= next;
		    directive.call(self, directive.config);
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
	self.resolve	= f;
	self.reject	= r;
	self.runDirectives().then(function(result) {
	    f(result);
	}, f).catch(r);
    });
}

var __modules__		= {};

ChaosRouter.restruct	= restruct;
ChaosRouter.populater	= restruct.populater;
ChaosRouter.module	= function(module) {
    var module		= require(module);
    var name		= module.__name__;
    __modules__[name]	= module;
}
ChaosRouter.modules	= function() {
    var modules = [];
    for (var i in arguments) {
	modules.push( ChaosRouter.module(arguments[i]) );
    }
    return modules;
}
module.exports		= ChaosRouter;
