
var Promise	= require('promise');
var restruct	= require('restruct-data');
var fs		= require('fs');
var util	= require('util');

var validationlib = {
    "is_digit": function(args, data, cb) {
	for(var i=0; i<args.length; i++) {
	    if( isNaN(args[i]) ) {
		return cb(false);
	    }
	}
	return cb(true);
    },
    "not_empty": function(args, data, cb) {
	var ch	= true
	for(var i=0; i<args.length; i++) {
	    if( args[i].trim() === "" ) {
		return cb(false);
	    }
	}
	return cb(true);
    }
}

var methodlib = {
}

function setdefault(value, d) {
    return value === undefined ? d : value;
}
function repeat(str, num) {
    return new Array( num + 1 ).join( str );
}
function is_dict(d) {
    return d.constructor.name == 'Object';
}
function is_iterable(d) {
    try {
	for( var i in d ) continue;
    } catch(err) {
	return false;
    }
    return true;
}
function is_string(d) {
    return typeof d == 'string';
}
function dictcopy(dict) {
    var copy		= {}
    for( var i in dict ) {
        copy[i]		= dict[i]
    }
    return copy

}
function format(str) {
    for( var i=1; i < arguments.length; i++ ) {
        var arg	= arguments[i];
        if( is_dict(arg) ) {
            for( var k in arg ) {
                var re	= new RegExp( RegExp.escape("{"+k+"}"), 'g' );
                str		= str.replace(re, arg[k]);
            }
        }
        else {
            var re	= new RegExp( RegExp.escape("{"+(i-1)+"}"), 'g' );
            str	= str.replace(re, arg);
        }
    }
    return str;
}
function fill(s, data) {
    if (s.indexOf(':<') === 0)
	return data[s.slice(2).trim() ]

    var v	= format(s, data)
    if (s.indexOf(':') === 0) {
	try {
	    v	= eval(v.slice(1));
	} catch (err) {
	    v	= null;
	}
    }
    return v;
}

function ChaosRouter(data, opts) {
    if (! (this instanceof ChaosRouter))
	return new ChaosRouter(data, opts);
    
    this.configfile	= null;
    this.basepath	= setdefault(opts.basepath, '/');
    this.query		= setdefault(opts.query, null);
    
    
    if (is_dict(data))
	this.config	= data;
    else if (is_string(data))
	this.configfile	= data;
    else
	throw new Error(format("Unrecognized data type: {0}", typeof data))
}
ChaosRouter.prototype.extend_methods	= function(dict) {
    for( var k in dict) {
	var v		= dict[k];
	methodlib[k]	= v;
    }
}
ChaosRouter.prototype.extend_validation	= function(dict) {
    for( var k in dict) {
	var v		= dict[k];
	validationlib[k]= v;
    }
}
ChaosRouter.prototype.route	= function(path, data, parents) {
    data		= setdefault(data, null);
    parents		= setdefault(parents, null);

    if (this.configfile !== null)
	this.config	= JSON.parse( fs.readFileSync(this.configfile) );

    var variables	= {};

    if (data === null || path.indexOf('/') === 0) {
	data		= this.config;
	parents		= [['', data]];
	if (path.indexOf(this.basepath) === 0)
	    path	= path.slice(this.basepath.length);
    }

    // Remove leading and trailing slashes.
    var _p		= path.replace(/^\//, "").replace(/\/*$/, "")
    var segs		= _p.split('/');
    if (!path)
	return Endpoint(this.config, variables, parents, this.query);

    for (var i in segs) {
	var seg		= segs[i];
	if (seg === "..") {
	    data	= parents.pop()[1];
	    continue;
	}

	if (data[seg] === undefined) {
	    var vkeys	= [];
	    var _keys	= Object.keys(data);
	    for( var k in _keys ){
		var v	=  _keys[k];
		if (v.trim().indexOf(':') === 0)
		    vkeys.push(v.trim());
	    }
	    var vkey	= vkeys.length > 0 ? vkeys.pop() : null;
	    data	= vkey === null ? null : data[vkey];

	    if (data === null)
		return false;

	    variables[vkey.slice(1)]	= seg;
	}
	else
	    data	= data[seg];
	parents.push([seg,data]);
    }
    parents.pop();

    if (data['.base'] === undefined)
	var config	= dictcopy(data);
    else {
	var base	= this.route( data['.base'], data, parents );
	var config	= dictcopy(base.config);
	util._extend(config, data);
    }

    return Endpoint(config, variables, parents, this.query);
}

function fill(s, data) {
    var v	= format(s, data)
    if (s.indexOf(':') === 0) {
	try {
	    v	= eval(v.slice(1));
	} catch (err) {
	    v	= null;
	}
    }
    return v;
}

function Endpoint(config, path_vars, parents, query) {
    if (! (this instanceof Endpoint))
	return new Endpoint(config, path_vars, parents, query);

    this.parents	= parents;
    this.config		= config;
    this.args		= {
	"path": path_vars
    }
    this.query		= setdefault(query, function(next) {
	next(new Error("No query builder was provided"));
    });
}
Endpoint.prototype.set_arguments	= function(args) {
    if (!is_iterable(args)) {
	return false;
    }
    var reserved_keys	= ['query', 'value', 'path'];
    for(var i=0; i<reserved_keys.length; i++) {
	var reserved	= reserved_keys[i];
	if (args[reserved])
	    delete args[reserved];
    }
    for ( var name in args )
	this.args[name] = args[name];
}
Endpoint.prototype.validate	= function(validations) {
    if (validations === null || validations === undefined)
    	return Promise.resolve();
    
    var self		= this;
    var promises	= [];
    for (var k in validations) {
	var rule	= validations[k];
	if (! util.isArray(rule) || rule.length === 0)
	    throw new Error(format("Failed to process rule: {0}", rule));
	var command	= rule[0];
	var params	= [];
	var _p		= rule.slice(1);
	for( var i=0; i<_p.length; i++) {
	    var param	= _p[i];
	    try {
		var value	= fill(param, self.args);
	    }
	    catch (e) {
		var value	= null;
	    }
	    params.push(value);
	}
	var cmd		= validationlib[command];
	if (cmd === null)
	    throw new Error(format("No validation method for rule {0}", rule));
	promises.push(new Promise(function(f,r){
	    cmd.call(validationlib, params, self.args, function(check) {
		if (is_dict(check))
		    r(check);
		else if (check !== true) {
		    var message	= format("Failed at rule {0} with values {1}", rule, params);
		    r({
			"error": "Failed Validation",
			"message": is_string(check) ? check : message
		    })
		}
		else
		    f();
	    });
	}));
    }
    return Promise.all(promises);
}
Endpoint.prototype.get_structure	= function() {
    var structure	= this.config['.structure'];
    if (structure === undefined)
	return false;

    structure		= dictcopy(structure);
    var update		= this.config['.structure_update'];
    if (update !== undefined) {
	util._extend( structure, update );
	for( var k in structure) {
	    var v	= structure[k];
	    if (v === false)
		delete structure[k];
	}
    }
    
    return structure;
}
Endpoint.prototype.execute		= function(args) {
    if (args) this.set_arguments(args);
    
    var self		= this;
    
    this.table		= setdefault( this.config['.table'], null);
    this.where		= setdefault( this.config['.where'], null);
    this.joins		= setdefault( this.config['.join'], []);
    this.columns	= setdefault( this.config['.columns'], []);
    
    return new Promise(function(f,r) {
	self.validate(self.config['.validate'])
	    .then(function() {
		try {
		    var response	= self.config['.response']
		    if( response ) {
			if ( typeof response === "string" ) {
			    if(! fs.existsSync(response) ) {
				return f({
				    error: "Invalid File",
				    message: "The response file was not found"
				})
			    }
			    response	= fs.readFileSync( response, 'utf8' );
			    try {
				response= JSON.parse(response)
			    } catch(err) {
				return f({
				    error: "Invalid File",
				    message: "The response file was not valid JSON"
				})
			    }
			}
			return f(response);
		    }
		    else if (method !== self.config['.method']) {
			var method		= self.config['.method'];
			method		= method.split('.');
			var cmd		= null;
			var meth_context	= methodlib;
			for( var i in method ) {
			    var meth	= method[i];
			    if( is_dict( meth_context[meth] ) ) {
				meth_context	= meth_context[meth]
			    } else {
				cmd	= meth_context[ meth ];
			    }
			}
			if (cmd === undefined)
			    throw new Error(format("No method named {0}", method));
			else
			    return cmd.call(methodlib, self.args, function(result) {
				f(result);
			    });
		    }
		    else {
			var structure	= self.get_structure();
			if (structure === false)
			    return f({
				"error": "Dead End",
				"message": "Nothing configured for this endpoint"
			    });

			self.query.call(self, function(err, all) {
			    if(err !== undefined && err !== null)
				return f(err);
			    var result	= structure === null
				? all
				: restruct(all, structure);
			    return f(result);
			});
		    }
		} catch (err) {
		    console.log(err)
		    r(err);
		}
	    }, function(error) {
		if ( error instanceof Error ) {
		    r(error);
		}
		else {
		    f(error);
		}
	    })
	    // .catch(function(err) {
	    // 	console.log(err);
	    // });
    });
}

ChaosRouter.restruct	= restruct;
ChaosRouter.populater	= restruct.populater;
module.exports		= ChaosRouter;
