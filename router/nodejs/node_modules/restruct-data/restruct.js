
var extend	= require('util')._extend;
var fill	= require('populater');

function restruct(data, struct) {
    if (!(this instanceof restruct))
	return new restruct(data, struct);
    this.result		= {};
    // Turn structure into predictable objects (no RegExp, undefined
    // or function).  Limits the complex objects to Array's and Dicts
    this.struct		= JSON.parse(JSON.stringify(struct));
    this.extend(data, this.struct, this.result);
    this.flatten(this.result, this, 'result');
    return this.result;
}
restruct.flattenTrigger	= '.array';
restruct.rescopeTrigger	= '.rescope';
restruct.indexKey	= '$index';
restruct.parentKey	= '$parent';
restruct.prototype.flatten = function (result, parent, key) {
    // Go through entire result and flatten dicts that contain
    // this.flattenTrigger command.  If not true just remove command.
    var flatten		= result[restruct.flattenTrigger];
    delete result[restruct.flattenTrigger];
    if (flatten === true)
	parent[key] = result = Object.keys(result).map(function (k) {
	    return result[k];
	});
    for (var k in result) {
	if (typeof result[k] === 'object' && result[k] !== null)
	    this.flatten(result[k], result, k);
    }
}    
restruct.prototype.extend = function (data, struct, result) {
    if (Array.isArray(data))
    	return this.extend_list(data, struct, result);
    
    for (var key in struct) {
	if (key === restruct.flattenTrigger) {
	    result[key]	= struct[key];
	    continue;
	}

	var v		= struct[key];
	if (key === restruct.rescopeTrigger) {
	    if (Array.isArray(v)) {
		var d	= fill(v[0], data);
		for (var i in d) {
		    var blob	= d[i];
		    d[i]	= extend({}, data);
		    d[i][v[1]]	= blob;
		}
	    } else if (typeof v === 'string') {
		var d	= fill(v, data);
	    } else {
		throw Error("Unsupported use of .rescope");
	    }
	    delete struct[key];
	    return this.extend(d, struct, {});
	}
	
	var k		= fill(key, data);
	if (k === undefined || k === null)
	    continue;

	if (result[k] === undefined) {
	    if (v === true)
		result[k]	= data[k];
	    else if(typeof v === 'string')
		result[k]	= fill(v, data);
	    else if(Array.isArray(v)) {
		if (typeof v[0] === 'string')
		    result[k]	= [ fill(v[0], data) ];
		else if (typeof v[0] === 'object' && v[0] !== null)
		    result[k]	= [ this.extend(data, v[0], {}) ];
		else
		    result[k]	= [ v[0] ];
	    }
	    else if(v === false)
		delete result[k];
	    else
		// Recursively extend sub dictionaries
		result[k]	= this.extend(data, v, {});
	} else {
	    // Key already exists in result.  If the struct is an
	    // Array at this point we append this data to it.  If it
	    // is a dictionary then we recursively call extend and
	    // narrow down the struct/result scopes.
	    
	    if (Array.isArray(struct[key])) {
		if (typeof v[0] === 'string')
		    result[k].push( fill( struct[key][0], data ) );
		else if (typeof v[0] === 'object' && v[0] !== null)
		    result[k].push( this.extend(data, v[0], {}) );
		else
		    result[k].push( v[0] );
	    }
	    else if (typeof struct[key] === 'object' && struct[key] !== null)
		this.extend(data, struct[key], result[k]);
	}

	if (result[k] === undefined)
	    delete result[k];
    }
    
    if (Array.isArray(struct)) {
	return Object.keys(result).map(function (k) {
	    return result[k];
	});
    }
    else
	return result;
}
restruct.prototype.extend_list = function (rows, struct, result) {
    if (rows.length === 0) {
	this.extend({}, struct, result);
    }
    else {
	for (var i in rows) {
	    rows[i][restruct.indexKey]	= parseInt(i);
	    rows[i][restruct.parentKey]	= rows;
	    this.extend(rows[i], struct, result);
	}
    }
    return result;
}

restruct.populater	= fill;
module.exports		= restruct;
