
var py		= require('pythonify');

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
        if( py.is_dict(arg) ) {
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


function fill(s, data) {
    if (s.indexOf(':<') === 0)
	return data[s.slice(2).strip()]

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
    if (py.type(data) === 'Array')
	return attach_list(data, columns);

    var result	= [];
    var struct	= py(columns).copy();

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
	else if(py.is_dict(v))
	    struct[k]	= restruct(data, v);
	else if(py.is_string(v))
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

    var struct		= py(columns).copy();
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
    return dictpop(py(data).copy(), s);
}
function path_assign(path, data1, data2) {
    var segments	= path.split('.');
    var _segs		= segments.slice(0,-1);
    for (var i in _segs) {
	var s		= _segs[i];
	data1		= data[s];
    }
    var s		= segments.pop();
    data1[s]		= data2;
    return data1;
}
function attach_groups(data, struct) {
    var gstruct		= py(struct).copy();
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
	if (len(gresult))
	    gresult	= gresult.popitem();
	else
	    gresult	= {};
    }
    else if (gindex === false)
	gresult		= gresult.values();

    return gresult;
}
function group_data(data, gkey) {
    var groups		= {};
    for (var i in data) {
	var d		= data[i];
	var k		= fill(gkey, d);
	if (k === 'undefined' || k === 'null')
	    return;
	if (Object.keys(groups).indexOf(k) === -1)
	    groups[k]	= [];
	groups[k].push(d);
    }
    return groups;
}

module.exports	= restruct;
