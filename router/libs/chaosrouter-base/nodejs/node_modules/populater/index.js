
function __safeEval__(data, fn) {
    var value;
    try {
	value	= fn.call(data);
    }
    catch (e) {}
    return value;
}
function __startsWith__(s, n) {
    return s.indexOf(n) === 0;
}
function __format__(s, data) {
    var __value__;
    var __str__		= s.slice();
    var __re__		= /{{([^}]+)}}/gi;
    var __match__	= __re__.exec(s);
    while (__match__ !== null) {
	__value__	= __safeEval__(data, function() {
	    var v = eval("this."+__match__[1].trim());
	    return v === undefined
		? '' : v;
	});
	__str__		= __str__.replace(__match__[0], __value__);
	var __match__	= __re__.exec(s);
    }
    return __str__;
}

function __fill__(__str__, data) {
    if (typeof __str__ !== 'string')
	throw new Error(
	    __fill__(
		"Populater can only handle string formatting not type '{{type}}' {{data}}",
		{ type:typeof __str__, data:JSON.stringify(__str__, null, 4) }
	    )
	);
    __fill__.last	= __str__;
    __fill__.data	= data;
    var v;
    if (__startsWith__(__str__, '<'))
	v	= __safeEval__(data, function() {
	    return eval("this."+__str__.slice(1));
	});
    else if (__startsWith__(__str__, ':'))
	v	= __format__(__str__.slice(1), data);
    else {
	v	= __format__(__str__, data);
	if (__startsWith__(__str__, '=')) {
	    v	= __safeEval__(data, function() {
		return eval(v.slice(1));
	    });
	}
    }
    __fill__.value	= v;
    return v;
}
__fill__.format		= __format__;
__fill__.reserved	= [
    "__fill__", "__format__", "__safeEval__", "__startsWith__",
    "__str__", "__re__", "__match__", "data", "this", "eval"
];
__fill__.method		= function(name, fn) {
    if (__fill__.reserved.indexOf(name) !== -1)
	throw new Error(name+" is a reserved function name");
    try {
	eval(
	    [
		"root[name]	= function "+name+"() {",
		"    return fn.apply(__fill__.data, arguments);",
		"}"
	    ].join("\n")
	);
    } catch (err) {
	console.log(err);
	return err;
    }
}
module.exports	= __fill__;
