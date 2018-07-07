var bunyan		= require('bunyan');
var log			= bunyan.createLogger({name: 'tests', level: "trace"});

var expect		= require('chai').expect;
var isolate		= require('./isolate.js');

var e			= (e) => log.error(e);
var n			= () => null;

var util		= require('util');

String.prototype.format	= function() {
    const args		= Array.prototype.slice.call(arguments);
    // Convert 'this' String object to a primitive String.  util.format only works with a primitive
    // string.
    args.unshift( String(this) );
    return util.format.apply(null, args);
}

isolate.error(e);

describe('/isolate', function() {

    
    it("should run function and return value", function() {
	const data	= isolate.extract("= echo()", {
	    echo: function() {
		return "Your mom!";
	    }
	});

	expect(data).to.equal("Your mom!");
    });
    
    it("should run function with params and return mock status", function() {
	const data	= isolate.extract("= Actors.add( params )", {
	    Actors: {
		add: function(params) {
		    return {
			status: "success",
			actor: {
			    name: "%s, %s".format( params.name.last, params.name.first ),
			},
		    };
		}
	    },
	    params: {
		name: {
		    first: "Tom",
		    last: "Hardy",
		},
		age: 40,
	    },
	});

	expect(data.status).to.equal("success");
	expect(data.actor.name).to.equal("Hardy, Tom");
    });

    it("should run function with params and handle async response", function() {
	function resolve(data) {
	    expect(data.status).to.equal("success");
	    expect(data.actor.name).to.equal("Hardy, Tom");
	}
	
	const data	= isolate.extract("= Actors.add( params )", {
	    Actors: {
		add: function() {
		    (function(params) {
			this.resolve({
			    status: "success",
			    actor: {
				name: "%s, %s".format( params.name.last, params.name.first ),
			    },
			});
		    }).apply({
			resolve: resolve
		    } , arguments);
		}
	    },
	    params: {
		name: {
		    first: "Tom",
		    last: "Hardy",
		},
		age: 40,
	    },
	});
    });

    it("should run functions wrapped in scope", function() {
	function resolve(data) {
	    expect(data.status).to.equal("success");
	    expect(data.actor.name).to.equal("Hardy, Tom");
	}
	
	var ctx = {
	    pass: function() {
	    },
	    resolve: resolve,
	};

	var methods = {
	    Actors: {
		add: function(params) {
		    this.resolve({
			status: "success",
			actor: {
			    name: "%s, %s".format( params.name.last, params.name.first ),
			},
		    });
		}
	    },
	    params: {
		name: {
		    first: "Tom",
		    last: "Hardy",
		},
		age: 40,
	    },
	};
	
	const data	= isolate.extract("= Actors.add( params )", methods, ctx);
    });

});
