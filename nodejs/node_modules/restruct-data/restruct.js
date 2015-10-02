
var extend	= require('util')._extend;

function copy(obj) {
    return extend({}, obj);
}
function is_global(obj) {
    if (obj === undefined || obj === null)
	return false;
    global.asdfghjkl = true;
    var answer	= obj.asdfghjkl === true;
    delete global.asdfghjkl;
    return answer;
}
function is_dict(obj) {
    if (obj === undefined || obj === null)
	return false;
    if( obj.callee !== undefined )
        return false;
    if( obj.constructor.name == 'Object'
        || is_global(obj) )
        return true;
    return false;
}
function is_string(str) {
    if (str === undefined || str === null)
	return false;
    String.prototype.tinkerbell	= true;
    var answer	= str.tinkerbell === true;
    delete String.prototype.tinkerbell;
    return answer;
}
function type(obj) {
    if( obj === undefined )
        throw new Error("TypeError: type() takes exactly one argument ("+arguments.length+" given)");
    return obj.constructor.name;
}
function values(obj) {
    var values 	= []
    , keys	= Object.keys(obj);
    for( var i=0; i<keys.length; i++ )
        values.push( obj[keys[i]] );
    return values;
}

function dictpop(dict, key, d) {
    var v;
    if (dict[key] === undefined)
        v	= d;
    else {
        v	= dict[key];
	delete dict[key];
    }
    return v;
}
RegExp.escape = function(str) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}
function format(str) {
    for( var i=1; i < arguments.length; i++ ) {
        var arg	= arguments[i];
	// MySQL results return as RowDataPackets, not Objects...
        if( is_dict(arg) || arg.constructor.name === "RowDataPacket" ) {
            for( var k in arg ) {
                var re	= new RegExp( RegExp.escape("{"+k+"}"), 'g' );
                str		= str.replace(re, arg[k]);
            }
        }
        else {
            var re	= new RegExp( RegExp.escape("{"+i+"}"), 'g' );
            str	= str.replace(re, arg);
        }
    }
    return str;
}
function lstrip(str, chars) {
    var chars	= chars ? chars : " ";
    var re		= new RegExp( "^["+chars+"]*" );
    return str.replace(re, "");
}
function rstrip(str, chars) {
    var chars	= chars ? chars : " ";
    var re		= new RegExp( "["+chars+"]*$" );
    return str.replace(re, "");
}
function strip(str, chars) {
    return lstrip(rstrip(str, chars), chars);
}


function fill(s, data) {
    if (s.indexOf(':<') === 0)
	return data[ strip(s.slice(2)) ]

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

function restruct(data, columns) {
    if (type(data) === 'Array')
	return attach_list(data, columns);

    var result	= [];
    var struct	= copy(columns);

    dictpop( struct, '.key', null );
    dictpop( struct, '.index', null );
    dictpop( struct, '.single', null );

    if (Object.keys(struct).indexOf(".include") !== -1) {
	var include	= struct.pop('.include');
	include.update(struct);
	struct		= include;
    }

    for (var k in struct) {
	var v		= struct[k];
	k		= fill(k, data);
	if (v === true)
	    struct[k]	= data[k];
	else if(is_dict(v))
	    struct[k]	= restruct(data, v);
	else if(is_string(v))
	    struct[k]	= fill(v, data);
	else if(v === false)
	    delete struct[k];
	else
	    struct[k]	= null;
    }
    return struct;
}
function attach_list(rows, columns) {
    if (columns['.key'] !== undefined)
	return attach_groups(rows, columns);

    var struct		= copy(columns);
    if (Object.keys(struct).indexOf(".include") !== -1) {
	var include	= struct.pop('.include');
	include.update(struct);
	struct		= include;
    }
    var result		= [];
    for (var i in rows) {
	var row		= rows[i];
	result.push( restruct(row, struct) );
    }
    return result;
}
function extract_struct(path, data) {
    var segments	= path.split('.');
    var _segs		= segments.slice(0,-1);
    for (var i in _segs) {
	var s		= _segs[i];
	data		= data[s];
    }
    var s		= segments.pop();
    return dictpop(copy(data), s);
}
function path_assign(path, data1, data2) {
    var segments	= path.split('.');
    var _segs		= segments.slice(0,-1);
    for (var i in _segs) {
	var s		= _segs[i];
	data1		= data1[s];
    }
    var s		= segments.pop();
    data1[s]		= data2;
    return data1;
}
function attach_groups(data, struct) {
    var gstruct		= copy(struct);
    var sub_structs	= {};
    var duplicates	= [];
    var gkey		= dictpop( gstruct, '.key', null);
    var gindex		= dictpop( gstruct, '.index', null);
    var gsingle		= dictpop( gstruct, '.single', null);

    if (Array.isArray(gkey)) {
	duplicates	= gkey.slice();
	gkey		= duplicates.shift();
    }

    for (var i in duplicates) {
	var k		= duplicates[i];
	sub_structs[k]	= extract_struct(k, gstruct);
    }

    var groups		= group_data(data, gkey);
    var gresult		= {};
    for (var key in groups) {
	var rows	= groups[key];
	gresult[key]	= restruct(rows[0], gstruct);
	for (var i in duplicates) {
	    var k		= duplicates[i];
	    path_assign(k, gresult[key], restruct(rows, sub_structs[k]));
	}
    }

    if (gsingle === true) {
	if (Object.keys(gresult).length)
	    gresult	= dictpop( gresult, Object.keys(gresult).pop() );
	else
	    gresult	= {};
    }
    else if (gindex === false)
	gresult		= values(gresult);

    return gresult;
}
function group_data(data, gkey) {
    var groups		= {};
    for (var i in data) {
	var d		= data[i];
	var k		= fill(gkey, d);
	if (k === 'undefined' || k === 'null' || k === undefined || k === null)
	    continue;
	if (Object.keys(groups).indexOf(k) === -1)
	    groups[k]	= [];
	groups[k].push(d);
    }
    return groups;
}

module.exports	= restruct;
