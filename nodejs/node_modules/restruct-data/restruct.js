
var py		= require('pythonify');
py.bind();

function fill(s, data) {
    if (s.startswith(':<'))
	return data.Get( s.slice(2).strip() )

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

function restruct(data, columns) {
    if (type(data).in(['Array']))
	return attach_list(data, columns);

    var result	= [];
    var struct	= columns.copy();

    struct.pop('.key', null);
    struct.pop('.index', null);
    struct.pop('.single', null);

    if (".include".in(struct)) {
	var include	= struct.pop('.include');
	include.update(struct);
	struct		= include;
    }

    struct.iteritems(function(k,v) {
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
    });
    return struct;
}
function attach_list(rows, columns) {
    if (columns.Get('.key') !== null)
	return attach_groups(rows, columns);

    var struct		= columns.copy();
    if ('.include'.in(struct)) {
	var include	= struct.pop('.include');
	include.update(struct);
	struct		= include;
    }
    var result		= [];
    rows.iterate(function(row) {
	result.append( restruct(row, struct) );
    });
    return result;
}
function extract_struct(path, data) {
    var segments	= path.split('.');
    segments.slice(0,-1).iterate(function(s) {
	data		= data[s];
    });
    var s		= segments.pop();
    return data.copy().pop(s);
}
function path_assign(path, data1, data2) {
    var segments	= path.split('.');
    segments.slice(0,-1).iterate(function(s) {
	data1		= data[s];
    });
    var s		= segments.pop();
    data1[s]		= data2;
    return data1;
}
function attach_groups(data, struct) {
    var gstruct		= struct.copy();
    var sub_structs	= {};
    var duplicates	= [];
    var gkey		= gstruct.pop('.key', null);
    var gindex		= gstruct.pop('.index', null);
    var gsingle		= gstruct.pop('.single', null);

    if (is_list(gkey)) {
	duplicates	= gkey.slice();
	gkey		= duplicates.pop(0);
    }

    duplicates.iterate(function(k) {
	sub_structs[k]	= extract_struct(k, gstruct);
    });

    var groups		= group_data(data, gkey);
    var gresult		= {};
    groups.iteritems(function(key, rows) {
	gresult[key]	= restruct(rows[0], gstruct);
	duplicates.iterate(function(k) {
	    path_assign(k, gresult[key], restruct(rows, sub_structs[k]));
	});
    });

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
    data.iterate(function(d) {
	var k		= fill(gkey, d);
	if (k.in(['undefined','null']))
	    return;
	if (k.notIn(groups))
	    groups[k]	= [];
	groups[k].append(d);
    });
    return groups;
}

module.exports	= restruct;
