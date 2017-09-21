var bunyan		= require('bunyan');

var log			= bunyan.createLogger({
    name: "ChaosRouter Base",
    level: module.parent ? 'error' : 'trace'
});

var populater		= require('populater');
var restruct		= require('restruct-data');
var extend		= require('util')._extend;
var fs			= require('fs');

function run_sequence(list, fn, index) {
    if (index === undefined)
	index		= 0;

    if (list[index] === undefined)
	throw Error("End of method chain with no response");
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

module.exports = {
    "name": "chaosrouter-base",
    "directives": {
	"validate": function(config, next, resolve) {
	    var self		= this;

	    var validations	= config.map(function(args) {
		
		var error = {
		    "error": "Failed Validation",
		    "message": "Did not pass validation config '"+args+"'",
		};
		var check	= checkspace(args, error);
		
		return function(n) {
		    if (typeof args === 'string') {
			var result	= populater(self.args)(args);
			return check(result, n, resolve);
		    }
		    else if(Array.isArray(args)) {
			if (args.length === 0) {
			    error.message	= "Array is empty";
			    return resolve(error)
			}
			
			var done	= function() {
			    throw Error("Validation methods should not call the resolve() method");
			};
			var validate	= function(result) {
			    check(result, n, resolve);
			};
			var method	= args.shift();
			var cmd		= eval("self.__methods__."+method);
			
			cmd.call(self, args, done, validate);
		    }
		    else {
			log.error("Args object", args);
			throw Error("Bad Validation Config: don't know what to do with type '"+(typeof config)+"'");
		    }
		};
	    });

	    validations.push(function() {
		next();
	    });
	    run_sequence(validations);
	},
	"tasks": function(config, next, resolve) {
	    var self		= this;

	    var tasks	= config.map(function(args) {
		
		var error = {
		    "error": "Failed Task",
		    "message": "An error occurred on task '"+args+"'",
		};
		var check	= checkspace(args, error);
		
		return function(n) {
		    if (typeof args === 'string') {
			var result	= populater(self.args)(args);
			return check(result, n, resolve);
		    }
		    else if(Array.isArray(args)) {
			if (args.length === 0) {
			    error.message	= "Array is empty";
			    return resolve(error)
			}
			
			var validate	= function(result) {
			    check(result, n, resolve);
			};
			var method	= args.shift();
			var cmd		= eval("self.__methods__."+method);
			
			cmd.call(self, args, resolve, validate);
		    }
		    else {
			log.error("Args object", args);
			throw Error("Bad Task Config: don't know what to do with type '"+(typeof config)+"'");
		    }
		};
	    });
	    
	    run_sequence(tasks);
	},
	"response": function(config, next, resolve) {
	    if ( typeof config === "string" ) {
		response		= populater(this.args)(config);
		if ( typeof response === "string" ) {
		    if(! fs.existsSync(response) ) {
			return resolve({
			    error: "Invalid File",
			    message: "The response file was not found"
			});
		    }
		    response		= fs.readFileSync( response, 'utf8' );
		    try {
			response	= JSON.parse(response)
		    } catch(err) {
			return resolve({
			    error: "Invalid File",
			    message: "The response file was not valid JSON"
			});
		    }
		    return resolve(response);
		}
		else {
		    return resolve(response);
		}
	    }
	    resolve(restruct(this.args, config));
	},
	"structure_update": function(config, next, resolve) {
	    if (this.directives['structure'] === undefined)
		return resolve({
		    error: "Structure Update Failed",
		    message: "Cannot update undefined; no structure is defined at "+this.route
		});
	    
	    extend( this.directive['structure'], config );
	    next();
	},
    },
};
