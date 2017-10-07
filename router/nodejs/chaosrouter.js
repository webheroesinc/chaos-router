var bunyan		= require('bunyan');
var log			= bunyan.createLogger({name: "ChaosRouter",level: 'fatal'});

var Promise		= require('promise');
var restruct		= require('restruct-data');
var populater		= restruct.populater;
var fs			= require('fs');
var util		= require('util');

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
function loadConfigFile(filepath) {
    log.trace("Loading config from file", filepath);
    var config	= JSON.parse( fs.readFileSync(filepath) );
    config 	= replaceFileRefs( config, null, function(err) {
	throw Error(err.error+': '+err.message);
    });
    return config;
}
function getDirectives(data) {
    var directives	= {};
    for (var k in data) {
	var noprefix	= k.slice(Router.directivePrefix.length);
	if ( k.indexOf(Router.directivePrefix) === 0
	     && noprefix.indexOf(Router.directiveSuffix) === (noprefix.length - Router.directiveSuffix.length)) {
	    var name		= k.slice(Router.directivePrefix.length, -Router.directiveSuffix.length);
	    directives[name]	= data[k];
	}
    }
    return directives;
}
function getNonDirectives(data) {
    var directives	= {};
    for (var k in data) {
	if ( k.indexOf(Router.directivePrefix) !== 0 ) {
	    directives[k]	= data[k];
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
function run_sequence(list, fn, index) {
    if (index === undefined)
	index		= 0;
    
    if (list[index] === undefined) {
	var directives	= list.map(function(fn) {return fn.name;});
	throw Error("End of directive list with no response (undefined index: "+index+", list length: "+list.length+", directives: "+directives.join(', ')+")");
		   }
    // if (typeof list[index] !== 'function')
    // 	throw Error("run_sequence list item is not a function.  Type '"+(typeof list[index])+"' given");

    fn(list[index], function() {
	run_sequence(list, fn, index+1);
    });
}
function find_child_config(data, key, fn) {
    var config			= data[key] || null;
    var params			= {};
    var vname			= null
    
    if (data[key] === undefined) {
	var vkey		= getVariableKey(data);
	if (vkey) {
	    vname		= vkey.slice(1);
	    config		= data[vkey];
	    params[vname]	= key;
	}
    }

    fn(config, vkey, vname, key);
}


function Router(data, opts) {
    if (! (this instanceof Router))
	return new Router(data, opts);

    if (!opts)
	opts		= {};

    this.config		= {};
    this.configfile	= null;
    this.basepath	= setdefault(opts.basepath, '/');
    this.baseInput	= {}
    this.__root__	= Draft(this);
    
    if (is_dict(data))
	this.config	= data;
    else if (typeof data === 'string')
	this.configfile	= data;
    else
	throw new Error("Unrecognized data type: "+typeof data);
}
Router.directivePrefix		= '__';
Router.directiveSuffix		= '__';
Router.ENABLE_ALL		= 0;
Router.ENABLE_SELECTION		= 1;
Router.ENABLE_EXCULSION		= 2;
Router.DISABLE_SELECTION	= 3;

Router.prototype.__directives__	= { "before": {}, "runtime": {}, "after": {} };

Router.prototype.root	= function() {
    if (this.configfile) {
	this.config		= loadConfigFile( this.configfile );
	this.__root__.config	= this.config;
    }
    log.debug("Create root node with config, len:", Object.keys(this.config).length);
    return this.__root__;
};
Router.prototype.modules	= function() {
    var self		= this;
    
    for (var i in arguments) {
	var arg		= arguments[i];
	if (typeof arg === 'string') {
	    log.trace("Load modules string", arg);
	    self.module(arg, Router.ENABLE_ALL);
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
		    self.module(name, Router.ENABLE_ALL);
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
Router.prototype.module	= function(name, config) {
    if (typeof config === 'number') {
	log.trace("Converting config number", config, "to config object");
	var list		= arguments[2];
	switch(config) {
	case Router.ENABLE_ALL:
	    return this.module(name, {"enable": true});
	    break;
	case Router.ENABLE_SELECTION:
	    return this.module(name, {"enable": list});
	    break;
	case Router.ENABLE_EXCLUSION:
	    return this.module(name, {"exclude": list});
	    break;
	case Router.DISABLE_SELECTION:
	    return this.module(name, {"disable": list});
	    break;
	default:
	    return log.error("Unknown config number in Module load '"+config+"'.  Supported values are ENABLE_ALL, ENABLE_SELECTION, ENABLE_EXCLUSION, DISABLE_SELECTION");
	    break;
	}
    }
    
    var self			= this;
    var module			= __modules__[name];

    if (module === undefined)
	throw Error("Module '"+name+"' has not been loaded");
    
    var directives		= module.__directives__;
    
    if (config === true)
	config			= {enable: true};
    
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
		self.directive(name, directives[name]);
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
Router.prototype.directive	= function (name, fns) {
    if (name === undefined || fns === undefined)
	throw Error("Must give a name and a callback when registering directives");

    if (typeof fns === 'function')
	this.__directives__.runtime[name]	= fns;
    else {
	if (fns.__before__)
	    this.__directives__.before[name]	= fns.__before__;
	if (fns.__runtime__)
	    this.__directives__.runtime[name]	= fns.__runtime__;
	if (fns.__after__)
	    this.__directives__.after[name]	= fns.__after__;
    }
}
Router.prototype.set_input		= function(input) {
    if (!is_dict(input))
	return false;
    
    for ( var name in input )
	this.baseInput[name] = input[name];
}
Router.prototype.route	= function(path) {
    log.info("Routing new route", path);
    return this.root().route(path);
}



function Draft(parent, key) {
    if (! (this instanceof Draft))
	return new Draft(parent, key);

    log.trace("Parent constructor", parent.constructor.name);

    var self			= this;
    self.key			= key;
    self.vkey			= null;
    self.input			= {};

    if (parent instanceof Router) {
	self.config		= parent.config;
	self.params		= {};
	self.router		= parent;
	self.__parent__		= null;
	self.__parents__	= [];
    }
    else {
	log.trace("Parent identity:", "'"+parent.key+"'", parent.parents().map((p) => p.key));
	
	if (!(parent instanceof Router || parent instanceof Draft)) {
	    var msg = "Parent is not an instance of Router or Draft classes ("+ (typeof parent) +") "+ parent;
	    log.error(msg);
	    throw Error(msg);
	}
	if (!parent.config) {
	    var msg = "Parent is missing 'config' ("+ (typeof parent.config) +") ";
	    log.error(msg);
	    throw Error(msg);
	}
	
	find_child_config(parent.config, key, function(config, vkey, vname, value) {
	    if (config === null) {
		var msg	= "Dead end; Path leads to nowhere, failed at key";
		log.error(msg, key, [parent].concat(parent.parents()));
		throw Error(msg);
	    }
	    
	    self.config		= config;
	    var params		= {};
	    if(vname)
		params[vname]	= value;
	    self.params		= Object.assign({}, parent.params, params);
	    self.vkey		= vkey;
	});

	self.router		= parent.router;
	self.input		= Object.assign({}, self.router.baseInput, { "path": self.params });
	self.__parent__		= parent;
	self.__parents__	= parent.parents().concat([parent]);
    }

    if (!self.config)
	log.warn("No config has been specified");
    
    self.path			= parent.path === undefined ? '' : parent.path+"/"+key;
    self.raw_path		= parent.path === undefined ? '' : parent.raw_path+"/"+(self.vkey || key);
    self.raw			= self.config;
    self.__directives__		= getDirectives(self.config);
    
    log.debug("New Draft object with: ("+(typeof parent)+")", self.path, self.__directives__);

    var directives		= self.router.__directives__.before;
    self.awaitInit		= self.process_directives(directives);
}
Draft.prototype.ready		= function(f,r) {
    var self			= this;
    return self.awaitInit.then(function() {
	f.call(self);
    },r);
}
Draft.prototype.id		= function() {
    return this.path;
}
Draft.prototype.segments	= function() {
    return this.path.replace(/^\//, "").replace(/\/*$/, "").split('/');
}
Draft.prototype.raw_segments	= function() {
    return this.raw_path.replace(/^\//, "").replace(/\/*$/, "").split('/');
}
Draft.prototype.route	= function(path) {
    // If path starts with '/', use router root.
    // Otherwise use this node
    log.debug("Routing path", path);
    var node		= path[0] === '/' ? this.router.root() : this;

    if (! (node instanceof Draft))
	log.error("Node is not an instance of Draft", node);

    var segments	= path.split('/');
    log.debug("Segments", segments);
    for (var i in segments) {
	var seg		= segments[i];
	if (seg === '')
	    continue;

	// '..' segment means use parent node, if parent returns 'null' that means we are already at
	// the root.  Instead of throwing and Error, just stay at the root.
	node		= seg === '..'
	    ? node.parent() || node
	    : node.child(seg);
	
	if (node === null)
	    throw Error("Path lead to a dead end", path);
    }
    return node;
}
Draft.prototype.parent		= function() {
    return this.__parent__;
}
Draft.prototype.parents		= function() {
    return this.__parents__.slice().reverse();
}
Draft.prototype.child		= function(key) {
    return Draft(this, key);
}
Draft.prototype.children	= function(key) {
    var self			= this;
    var nondirectives		= getNonDirectives(this.config);
    log.trace("Getting children for", self.path, "found these nondirectives", nondirectives);
    return Object.keys(nondirectives).map(function(key) {
	return self.child(key);
    });
}
Draft.prototype.directives	= function(name) {
    if (name)
	return this.directive(name);
    return Object.assign({}, this.__directives__);
}
Draft.prototype.directive	= function (name, config) {
    if (config) {
	this.__directives__[name]	= config;
    }
    return this.__directives__[name] || null;
}
Draft.prototype.set_input	= function(input) {
    if (!is_dict(input)) {
	return false;
    }
    for ( var name in input )
	this.input[name] = input[name];
}
Draft.prototype.process_directives	= function(directivesDict) {
    var self			= this;

    var directives		= Object.keys(directivesDict).map(function(k) {
	directivesDict[k].key	= k;
	return directivesDict[k];
    });
    
    return new Promise(function(f,r) {
	try {
	    if (directives.length === 0)
		log.warn("Directives array is empty, source directives object:", directivesDict);
	    
	    directives.push('end');
	    
	    run_sequence(directives, function(directive, next) {
		if (directive === 'end')
		    return f('End of directive chain');

		var config	= self.directive(directive.key);
		if (config === null) {
		    log.trace("For path", self.path, "skipping directive", directive.key);
		    next();
		}
		else {
		    log.trace("For path", self.path, "run directive '"+directive.key+"' with config", config);
		    self.next	= next;
		    directive.call(self, config);
		}
	    });
	}
	catch (err) {
	    log.error("Caught Promise snuffing error", err);
	    r({
		"error": err.name,
		"message": err.message,
	    });
	}
    });
};
Draft.prototype.proceed		= function(input) {
    var self			= this;
    log.debug("Execute Draft", self.path, "with input", input);
    
    if (input) this.set_input(input);

    return new Promise(function(f,r) {
	self.resolve		= f;
	self.reject		= r;

	// log.error("Router directives", self.router.__directives__);
	// throw Error("Router Directives");
	
	log.info("Awaiting 'before' directives");
	self.awaitInit.then(function() {
	    
	    var directives		= self.router.__directives__.runtime;
	    log.info("Awaiting directives", directives);
	    self.process_directives(directives).then(function(result) {
		
		log.warn("Result from runtime directives", result);
		self.data		= result;
		
		var directives	= self.router.__directives__.after;
		log.info("Awaiting 'after' directives", directives);
		self.process_directives(directives).then(function() {
		    
		    f(self.data);
		    
		},r).catch(r);
	    },r).catch(r);
	},r).catch(r);
    });
}


var __modules__		= {};

function ChaosRouter(data, opts) {
    return Router(data, opts);
}
ChaosRouter.restruct	= restruct;
ChaosRouter.populater	= restruct.populater;
ChaosRouter.module	= function(module) {
    var module		= require(module)(ChaosRouter);
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
ChaosRouter.log_level	= function(level) {
    if (level)  {
	if ( typeof level === 'string' ) {
	    if ( typeof bunyan[level.toUpperCase()] === 'number' )
		level	= bunyan[level.toUpperCase()]
	}
	log.level( level );
    }

    return log.level();
}
module.exports		= ChaosRouter;
