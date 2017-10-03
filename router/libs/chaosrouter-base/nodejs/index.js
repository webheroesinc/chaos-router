var bunyan		= require('bunyan');

var log			= bunyan.createLogger({
    name: "ChaosRouter Base",
    level: 'trace' // module.parent ? 'error' : 'trace'
});

var fs			= require('fs');

function run_sequence(list, fn, index) {
    if (index === undefined)
	index		= 0;

    if (list[index] === undefined)
	throw Error("Chaosrouter Base: End of method chain with no response");
    if (typeof list[index] !== 'function')
	throw Error("run_sequence list item is not a function.  Type '"+(typeof list[index])+"' given");

    var next		= function() {
	run_sequence(list, undefined, index+1);
    };
    
    if (typeof fn === 'function')
	fn(list[index], next);
    else
	list[index](next);
}
function checkspace(args, error) {
    return function(value,f,r) {
	if (value === true)
	    f();
	else {
	    if (typeof value === 'string') {
		error.message	= value;
		r(error);
	    }
	    else if(typeof value === 'object' && value !== null) {
		if (value.error && value.message)
		    r(value);
		else {
		    error.debug	= value;
		    r(error);
		}
	    }
	    else
		r(error);
	}
	
    }
};

var __methods__		= {};

module.exports = function(chaosrouter) {
    var restruct	= chaosrouter.restruct;
    var populater	= chaosrouter.populater;

    function fillArguments(args, data) {
	for (var i in args) {
	    var arg		= args[i];
	    var type		= typeof arg;
	    if (type === 'string')
		args[i]		= populater(data)(arg);
	    else if(type === 'object' && arg !== null)
		args[i]		= restruct(data, arg);
	}
	return args;
    }
    
    return {
	"__name__": "chaosrouter-base",
	"__init__": function(router) {
	},
	"__enable__": function(method) {
	},
	"__directives__": {
	    "base": {
		"__before__": function (config) {
		    var self		= this;

		    var node		= self;
		    var basepath	= config;
		    var fullpath	= basepath;
		    while (basepath) {
			var node	= node.route(basepath);
			var directives	= node.directives();

			delete directives.rules;

			basepath	= directives.base;
			delete directives.base;

			log.debug("Copy directives", Object.keys(directives));
			for (var name in directives) {
			    if (self.directive(name))
				log.trace("NOT Copying directive", name, ", directive already exists in", self.path);
			    else {
				var conf	= directives[name];
				log.trace("Copying directive", name, "with config", conf, "from path", fullpath);
				self.directive(name, conf);
			    }
			}

			if (basepath)
			    fullpath	= fullpath+"/"+basepath;
		    }
		    self.next();
		},
	    },
	    "rules": function (config) {
		var self		= this;

		var rules		= [];
		var parents		= this.parents();

		parents.reverse().push(this);
		parents.forEach(function(parent) {
		    var conf		= parent.directive('rules');
		    if ( Array.isArray(conf) )
			for( var i in conf )
			    rules.push( conf[i] );
		});

		var validations		= rules.map(function(args) {
		    
		    var error = {
			"error": "Failed Validation Rule",
			"message": "Did not pass rule config '"+args+"'",
		    };
		    var check		= checkspace(args, error);
		    
		    return function(next) {
			if (typeof args === 'string') {
			    var result	= populater(self)(args);
			    return check(result, next, self.resolve);
			}
			else if(Array.isArray(args)) {
			    if (args.length === 0) {
				error.message	= "Array is empty";
				return self.reject(error)
			    }
			    
			    self.pass	= function(result) {
				next();
			    };
			    self.fail	= function(result) {
				check(result, next, self.resolve);
			    };
			    var method	= args.shift();
			    var cmd	= populater(__methods__)("< "+method);
			    var data	= fillArguments(args, self);

			    if (typeof cmd === 'function')
				cmd.apply(self, data);
			    else
				throw Error("Method '"+method+"' @ "+self.raw_path+" in __rules__ directive is not a function");
			}
			else {
			    log.error("Args object", args);
			    throw Error("Bad Rule Config: don't know what to do with type '"+(typeof config)+"'");
			}
		    };
		});

		validations.push(function() {
		    delete self.pass;
		    delete self.fail;
		    self.next();
		});
		run_sequence(validations);
	    },
	    "tasks": function (config) {
		var self		= this;

		var tasks		= config.map(function(args) {
		    
		    var error = {
			"error": "Failed Task",
			"message": "An error occurred on task '"+args+"'",
		    };
		    
		    return function(next) {
			if (typeof args === 'string') {
			    return self.resolve(populater(self)(args));
			}
			else if(Array.isArray(args)) {
			    if (args.length === 0) {
				error.message	= "Array is empty";
				return self.reject(error)
			    }

			    var method	= args.shift();
			    var cmd	= populater(__methods__)("< "+method);
			    var data	= fillArguments(args, self);

			    if (typeof cmd === 'function')
				cmd.apply(self, data);
			    else
				throw Error("Method '"+method+"' @ "+self.raw_path+" in __rules__ directive is not a function");
			}
			else {
			    log.error("Args object", args);
			    throw Error("Bad Task Config: don't know what to do with type '"+(typeof config)+"'");
			}
		    };
		});
		
		run_sequence(tasks);
	    },
	    "response": function (config) {
		var self		= this;
		
		if ( typeof config === "string" ) {
		    response		= populater(self)(config);
		    if ( typeof response === "string" ) {
			if(! fs.existsSync(response) ) {
			    return self.reject({
				error: "Invalid File",
				message: "The response file was not found"
			    });
			}
			response		= fs.readFileSync( response, 'utf8' );
			try {
			    response	= JSON.parse(response)
			} catch(err) {
			    return self.reject({
				error: "Invalid File",
				message: "The response file was not valid JSON"
			    });
			}
			return self.resolve(response);
		    }
		    else {
			return self.resolve(response);
		    }
		}
		self.resolve(restruct(self, config));
	    },
	    "structure_update": function (config) {
		var self		= this;
		
		if (this.directive('structure') === undefined)
		    return self.reject({
			error: "Structure Update Failed",
			message: "Cannot update undefined; no structure is defined at "+this.route
		    });
		
		Object.assign( this.directive('structure'), config );
		self.next();
	    },
	},
	methods: function(dict) {
	    for(var k in dict)
		__methods__[k]	= dict[k];
	},
    };
};
