
var Promise	= require('promise');
var restruct	= require('restruct-data');
var fill	= restruct.populater;
var fs		= require('fs');
var util	= require('util');
var server	= require('./server');
var bunyan	= require('bunyan');

var log		= bunyan.createLogger({
    name: "ChaosRouter",
    level: 'trace'
});

var validationlib = {
}
var methodlib = {
}

function setdefault(value, d) {
    return value === undefined ? d : value;
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

function defaultKnexQueryBuilder(db, next) {
    var knex		= db;
    var q		= knex.select();

    q.from(this.table);
    
    for (var i in this.columns) {
    	if (Array.isArray(this.columns[i]))
    	    this.columns[i]	= this.columns[i].join(' as ');
    	q.column(this.columns[i]);
    }
    for (var i=0; i<this.joins.length; i++) {
    	var join	= this.joins[i];
    	var t		= join[0];
    	var c1		= join[1].join('.');
    	var c2		= join[2].join('.');
    	q.leftJoin(t, c1, c2);
    }
    
    if (this.where)
    	q.where( knex.raw(fill(this.where, this.args)) );

    // log.debug("Query: \n"+q.toString());

    q.then(function(result) {
        next(null, result);
    }, function(err) {
        next(err, null);
    }).catch(function(err) {
        next(err, null);
    });
}


function ChaosRouter(data, opts) {
    if (! (this instanceof ChaosRouter))
	return new ChaosRouter(data, opts);
    
    this.configfile	= null;
    this.basepath	= setdefault(opts.basepath, '/');
    this.db		= opts.db;
    this.query		= setdefault(opts.query, defaultKnexQueryBuilder);

    if (this.db === undefined && opts.query === undefined)
	throw new Error("db and query options cannot both be empty.  One or both are required");

    if (opts.query === undefined)
	if (this.db.name !== 'knex')
	    throw new Error("The default queryBuilder requires a knex db connection object");

    if (is_dict(data))
	this.config	= data;
    else if (is_string(data))
	this.configfile	= data;
    else
	throw new Error("Unrecognized data type: "+typeof data);
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

    var last_seg;
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

		variables[vkey.slice(1)]	= seg;
	    }
	    else {
		data	= data[seg];
	    }
	}
	last_seg	= seg;
    }

    if (data['.base'] === undefined)
	var config	= dictcopy(data);
    else {
	var base	= this.route( data['.base'], data, parents );
	var config	= dictcopy(base.config);
	util._extend(config, data);
    }

    return Endpoint(config, variables, parents, this.query, this.db);
}

function Endpoint(config, path_vars, parents, query, db) {
    if (! (this instanceof Endpoint))
	return new Endpoint(config, path_vars, parents, query, db);

    this.parents	= parents;
    this.config		= config;
    this.db		= db;
    this.args		= {
	"path": path_vars,
	"db": db
    }
    this.query		= setdefault(query, function(next) {
	next(new Error("No query builder was provided"));
    });
}
Endpoint.prototype.set_arguments	= function(args) {
    if (!is_iterable(args)) {
	return false;
    }
    var reserved_keys	= ['path', 'db'];
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
	    throw new Error("Failed to process rule: "+rule);
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
	var cmd		= eval("validationlib."+command);
	if (cmd === null || cmd === undefined)
	    throw new Error("No validation method for rule "+rule);
	promises.push(new Promise(function(f,r){
	    cmd.call(validationlib, params, self.args, function(check) {
		if (is_dict(check))
		    r(check);
		else if (check !== true) {
		    var message	= "Failed at rule "+rule+" with values "+params;
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
			    throw new Error("No method named "+method);
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

			self.query.call(self, self.db, function(err, all) {
			    if(err !== undefined && err !== null)
				return r(err);
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
	    }).catch(function(err) {
		f(err);
	    });
    });
}

ChaosRouter.restruct	= restruct;
ChaosRouter.populater	= restruct.populater;
ChaosRouter.server	= server;
ChaosRouter.coauthSDK	= require('coauth-sdk');
module.exports		= ChaosRouter;
