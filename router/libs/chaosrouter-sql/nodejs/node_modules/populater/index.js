var isolate		= require('./isolate.js');

function startsWith(s, n) {
    return s.indexOf(n) === 0;
}


function Template(str) {
    if (!(this instanceof Template))
	return new Template(str);
    
    if (typeof str !== 'string') {
	throw new Error(
	    Populater({ type:typeof str, ctx:JSON.stringify(str, null, 4) })(
		"Template only takes 1 string, not type '{{type}}' {{ctx}}"
	    )
	);
    }

    this.str		= str;
    Populater.before	= str;
}    
Template.prototype.fill	= function(s) {
    var v;
    var str		= s.slice();
    
    var regex		= /{{([^}]+)}}/gi;
    var match		= regex.exec(s);
    while (match !== null) {
	if (match[1].indexOf('.') !== -1 || match[1].indexOf('[') !== -1)
	    v		= isolate.eval("this."+match[1].trim(), this.ctx, this.fn_ctx);
	else
	    // Accommodate indexing with numbers
	    v		= isolate.eval("this['"+match[1].trim()+"']", this.ctx, this.fn_ctx);
	if (v === undefined)
	    v		= '';
	str		= str.replace(match[0], v);
	var match	= regex.exec(s);
    }
    
    return str;
};
Template.prototype.eval	= function(str) {
    return isolate.eval(str, this.ctx, this.fn_ctx);
};
Template.prototype.context	= function(ctx, fn_ctx) {
    this.ctx		= ctx;
    this.fn_ctx		= fn_ctx;
    
    var v;
    if (startsWith(this.str, '<'))
	v		= this.eval("this."+this.str.slice(1));
    else {
	v		= this.fill(this.str);
	if (startsWith(this.str, ':'))
	    v		= v.slice(1);
	else if (startsWith(this.str, '='))
	    v		= this.eval(v.slice(1));
    }

    Populater.after	= v; // temporary: need by tests for logging
    return v;
    
};


function Populater(data, ctx) {
    
    if (typeof data !== 'object') {
	throw new Error(
	    Populater({ type: typeof data })(
		"Populater can only take complex objects, not type '{{type}}'.  See Populater.template() for other uses."
	    )
	);
    }

    return function(str) {
	return Template(str).context(data, ctx);
    }
}


Populater.template		= function(str) {
    return Template(str);
}
Populater.error		= function(fn) {
    return isolate.error(fn);
}
Populater.method	= function(name, fn, err) {
    return isolate.method(name, fn, err);
}

module.exports		= Populater;
