module.exports = {
    method: function(name, fn, err) {
	if (['eval', 'arguments'].indexOf(name) !== -1)
	    throw new Error(name+" is a reserved function name");
	
	var def = [
	    "global[name]	= function "+name+"() {",
	    "    try {",
	    "        return fn.apply(eval.data, arguments);",
	    "    } catch(e) {",
	    "        return err(e);",
	    "    }",
	    "}; global[name][name] = fn;",
	].join("\n");
	
	eval(def);
    },
    inspect: function(name) {
	return global[name][name].toString();
    },
    error: function(fn) {
	eval.error = fn;
    },
    eval: function() {
	// eval(code, context, function context)
	// reserved words: eval, arguments
	try {
	    eval.data	= arguments[2] || arguments[1];
	    return (function () {
		return eval(arguments[0]);
	    }).call(arguments[1], arguments[0]);
	}
	catch (e) {
	    if (typeof eval.error === 'function')
		eval.error(e);
	    return null;
	}
    },
};
