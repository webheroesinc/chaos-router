
var restruct	= require('restruct-data');
var fs		= require('fs');

var validationlib = {
    "is_digit": function(value, kwargs) {
	return value.isdigit();
    },
    "is_number": function(value, kwargs) {
	return value.is_number();
    },
    "not_empty": function(value, kwargs) {
	return value.strip() !== "";
    }
}

var methodlib = {
}

function setdefault(value, d) {
    return value === undefined ? d : value;
}
function ChaosRouter(data, db, basepath) {
    if (! (this instanceof ChaosRouter))
	return new ChaosRouter(data, db, basepath);
    
    this.configfile	= null;
    this.basepath	= setdefault(basepath, '/');
    this.db		= setdefault(db, null);

    if (is_dict(data))
	this.config	= data;
    else if (is_string(data))
	this.configfile	= data;
    else
	throw new Error("Unrecognized data type: {0}".format(type(data)))
}
ChaosRouter.prototype.set_db	= function(db) {
    this.db		= db;
}
ChaosRouter.prototype.extend_methods	= function(dict) {
    dict.iteritems(function(k,v) {
	methodlib.prototype[k] = v;
    });
}
ChaosRouter.prototype.extend_validation	= function(dict) {
    dict.iteritems(function(k,v) {
	validationlib.prototype[k] = v;
    });
}
ChaosRouter.prototype.route	= function(path, data, parents) {
    data		= setdefault(data, null);
    parents		= setdefault(parents, null);

    if (this.configfile !== null)
	this.config	= JSON.parse( fs.readFileSync(this.configfile) );

    var variables	= {};

    if (data === null || path.startswith('/')) {
	data		= this.config;
	parents		= [['', data]];
	if (path.startswith(this.basepath))
	    path	= path.slice(len(this.basepath));
    }
    var segs		= path.strip('/').split('/');

    if (!path)
	return Endpoint(this.config, variables, parents, this.db);

    segs.iterate(function(seg) {
	if (seg === "..") {
	    data	= parents.pop()[1];
	    return;
	}

	if (data.Get(seg) === null) {
	    var vkeys	= [];
	    data.keys().iterate(function(v) {
		if (v.strip().startswith(':'))
		    vkeys.append(v.strip());
	    });
	    var vkey	= len(vkeys) > 0 ? vkeys.pop() : null;
	    data	= vkey === null ? null : data.Get(vkey);

	    if (data === null)
		return false;

	    variables[vkey.slice(1)]	= seg;
	}
	else
	    data	= data.Get(seg);
	parents.append([seg,data]);
    });
    parents.pop();

    if (data.Get('.base') === null)
	var config	= data.copy();
    else {
	var base	= this.route( data.Get('.base'), data, parents );
	var config	= base.config.copy();
	config.update(data);
    }

    return Endpoint(config, variables, parents, this.db);
}

function fill(s, data) {
    var v	= s.format(data)
    if (s.startswith(':')) {
	try {
	    v	= eval(v.slice(1));
	} catch (err) {
	    v	= null;
	}
    }
    return v;
}

function Endpoint(config, path_vars, parents, db) {
    if (! (this instanceof Endpoint))
	return new Endpoint(config, path_vars, parents, db);

    this.parents	= parents;
    this.config		= config;
    this.args		= {
	"path": path_vars
    }
    this.db		= setdefault(db, null);
}
Endpoint.prototype.set_arguments	= function(args) {
    ['db', 'value', 'path'].iterate(function(reserved) {
	if (reserved.in(args))
	    delete args[reserved];
    });
    this.args.update(args);
}
Endpoint.prototype.validate	= function(validations) {
    var $this		= this;
    validations.iterate(function(rule) {
	if (! is_list(rule) || len(rule) === 0)
	    throw new Error("Failed to process rule: {0}".format(rule));
	var command	= rule[0];
	var params	= [];
	rule.slice(1).iterate(function(param) {
	    try {
		var value	= fill(param, $this.args);
	    }
	    catch (e) {
		var value	= null;
	    }
	    params.append(value);
	});
	var cmd		= validationlib.Get(command);
	if (cmd === null)
	    throw new Error("No validation method for rule {0}".format(rule));
	var check	= cmd(params, $this.args, $this.db);

	if (is_dict(check))
	    return check;
	if (check !== true) {
	    var message	= "Failed at rule {0} with values {1}".format(rule, params);
	    return {
		"error": "Failed Validation",
		"message": is_string(check) ? check : message
	    }
	}
    });
    return true;
}
Endpoint.prototype.execute		= function(callback) {
    var validations	= this.config.Get('.validate');
    if (validations !== null) {
	var score	= this.validate(validations);
	if (score !== true)
	    callback( score );
    }

    var method		= this.config.Get('.method');
    if (method !== null) {
	var cmd		= methodlib.Get(method);
	if (cmd === null)
	    throw new Error("No method named {0}".format(method));
	else
	    callback( cmd(this.args, this.db) );
    }

    var structure	= this.get_structure();
    if (structure === false)
	callback({
	    "error": "Dead End",
	    "message": "Nothing configured for this endpoint"
	});

    var query		= this.query();
    this.db.all(query, function(err, all) {
	var result	= structure === null
	    ? all
	    : restruct(all, structure);
	callback(result);
    });
}
Endpoint.prototype.get_structure	= function() {
    var structure	= this.config.Get('.structure');
    if (structure === null)
	return false;

    structure		= structure.copy();
    var update		= this.config.Get('.structure_update');
    if (update !== null) {
	structure.update( update );
	structure.iteritems(function(k,v) {
	    if (v === false)
		delete structure[k];
	});
    }
    
    return structure;
}
Endpoint.prototype.query		= function() {
    this.table		= this.config.Get('.table');
    this.where		= this.config.Get('.where');
    this.joins		= this.config.Get('.join');

    if (this.joins === null)
	var joins	= '';
    else {
	var joins	= [];
	this.joins.iterate(function(join) {
	    var t	= join[0];
	    var s	= "`{0}`.`{1}`";
            var c1	= s.format.apply(s, join[1] )
            var c2	= s.format.apply(s, join[2] )
	    joins.append("{0} ON {1} = {2}".format(t,c1,c2))
	});
	joins		= " LEFT JOIN " + " LEFT JOIN ".join(joins);
    }

    if (this.where === null)
	var where	= '';
    else
	var where	= " WHERE {0} ".format(this.where);
    var query		= " SELECT * FROM {table}{join}{where} ".format({
	'table': this.table,
	'join': joins,
	'where': where
    });

    query		= query.format(this.args);
    return query;
}

module.exports		= ChaosRouter;
