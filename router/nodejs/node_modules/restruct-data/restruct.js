
var extend	= require('util')._extend;
var populater	= require('populater');

function Structure(struct) {
    return function(data) {
	return Restruct(data, struct);
    };
}

function Collection(data) {
    if (!(this instanceof Collection))
	return new Collection(data);

    this.data		= data;
}
Collection.prototype.format	= function (struct) {
    return Restruct(this.data, struct);
}


function Frame(data, parent, index) {
    if (!(this instanceof Frame))
	return new Frame(data, parent, index);

    this.parent		= parent || null;
    this.index		= index || null;
    this.data		= data;
}
Frame.prototype.source		= function(key) {
    if (!this.parent)
	return null;
    else
	return key ? this.parent.data[key] : this.parent.data;
};
Frame.prototype.keys		= function() {
    return Object.keys(this);
};
Frame.prototype.values		= function() {
    var $this	= this;
    return this.keys().map(function(k) {
	return $this.data[k];
    });
};
Frame.prototype.child		= function(k) {
    return Frame(this.data[k], this, k);
};
Frame.prototype.children	= function() {
    var $this	= this;
    return this.keys().map(function(k) {
	return $this.child(k);
    });
};
Frame.prototype.root		= function() {
    var frame	= this;
    while (frame.parent) {
	frame = frame.parent;
    };
    return frame;
};


function Restruct(data, struct) {
    if (!(this instanceof Restruct))
	return new Restruct(data, struct);

    // Turn structure into predictable objects (no RegExp, undefined or function).  Limits the
    // complex objects to Array's and Dicts
    this.data		= data;
    this.struct		= JSON.parse(JSON.stringify(struct));
    this.root		= Frame(data);
    
    var result		= {};
    this.extend(this.root, this.struct, result);
    result		= this.flatten(result);
    return result;
}
Restruct.flattenTrigger	= '__array';
Restruct.rescopeTrigger	= '__rescope';
Restruct.keyKey		= '$key';
Restruct.indexKey	= '$index';
Restruct.parentKey	= '$parent';
Restruct.lastDynamicKey;

Restruct.prototype.flatten	= function (result, flattened) {
    // Go through entire result and flatten dicts that contain this.flattenTrigger command.  If not
    // true just remove command.
    var flatten		= result[Restruct.flattenTrigger];
    delete result[Restruct.flattenTrigger];

    if (flattened === undefined)
	flattened	= [];

    flattened.push(result);
    for (var k in result) {
	var child	= result[k];
	if (typeof child === 'object' && child !== null && flattened.indexOf(child) === -1)
	    result[k]	= this.flatten(result[k], flattened);
    }
    
    if (flatten === true) {
	result = Object.keys(result).map(function (k) {
	    return result[k];
	});
    }
    
    return result;
}    
Restruct.prototype.extend = function (frame, struct, result) {
    var data		= frame.data;
    
    if (Array.isArray(data))
    	return this.extend_list(frame, struct, result);

    // data and Frame(data)
    var fill		= populater(data, frame);
    
    for (var key in struct) {
	if (key === Restruct.flattenTrigger) {
	    result[key]	= struct[key];
	    continue;
	}

	var v		= struct[key];
	// if (key === Restruct.rescopeTrigger) {
	//     if (Array.isArray(v)) {
	// 	var d	= fill(v[0]);
	// 	for (var i in d) {
	// 	    var blob	= d[i];
	// 	    d[i]	= extend({}, data);
	// 	    d[i][v[1]]	= blob;
	// 	}
	//     } else if (typeof v === 'string') {
	// 	var d	= fill(v);
	//     } else {
	// 	throw Error("Unsupported use of .rescope");
	//     }
	//     delete struct[key];
	//     return this.extend(d, struct, {});
	// }
	
	var spot	= result;
	var k		= fill(key);
	if (k === undefined || k === null)
	    continue;
	else if (Array.isArray(k)) {
	    for (var i=0; i < k.length-1; i++) {
		var tk	= k[i];
		if (result[tk] === undefined)
		    result[tk]	= {};
		result		= result[tk];
	    }
	    var k	= k[i];
	    Restruct.lastDynamicKey	= k;
	}
	
	data[Restruct.keyKey]		= Restruct.lastDynamicKey;

	if (result[k] === undefined) {
	    if (v === true)
		result[k]	= data[k];
	    else if(typeof v === 'string')
		result[k]	= fill(v);
	    else if(Array.isArray(v)) {
		if (typeof v[0] === 'string')
		    result[k]	= [ fill(v[0]) ];
		else if (typeof v[0] === 'object' && v[0] !== null) {
		    result[k]	= [ this.extend(frame, v[0], {}) ];
		}
		else
		    result[k]	= [ v[0] ];
	    }
	    else if(v === false)
		delete result[k];
	    else
		// Recursively extend sub dictionaries
		result[k]	= this.extend(frame, v, {});
	} else {
	    // Key already exists in result.  If the struct is an
	    // Array at this point we append this data to it.  If it
	    // is a dictionary then we recursively call extend and
	    // narrow down the struct/result scopes.
	    
	    if (Array.isArray(struct[key])) {
		if (typeof v[0] === 'string')
		    result[k].push( fill( struct[key][0] ) );
		else if (typeof v[0] === 'object' && v[0] !== null)
		    result[k].push( this.extend(frame, v[0], {}) );
		else
		    result[k].push( v[0] );
	    }
	    else if (typeof struct[key] === 'object' && struct[key] !== null)
		this.extend(frame, struct[key], result[k]);
	}

	if (result[k] === undefined)
	    delete result[k];

	// If result was relocated by a dynamic key, spot will put it
	// back in the original location.
	result		= spot;
    }
    
    if (Array.isArray(struct)) {
	return Object.keys(result).map(function (k) {
	    return result[k];
	});
    }
    else
	return result;
}
Restruct.prototype.extend_list = function (frame, struct, result) {
    var rows		= frame.data;
    if (rows.length === 0) {
	// this.extend({}, struct, result);
    }
    else {
	for (var i in rows) {
	    rows[i][Restruct.indexKey]	= parseInt(i);
	    rows[i][Restruct.parentKey]	= rows;
	    
	    this.extend(frame.child(i), struct, result);
	}
    }
    return result;
}

Restruct.method		= function(name, fn, err) {
    return populater.method(name, fn, err);
};
Restruct.populater	= populater;
Restruct.structure	= Structure;
Restruct.collection	= Collection;
module.exports		= Restruct;
