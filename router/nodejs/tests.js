
var extend		= require('util')._extend;
var fs			= require('fs');

var Promise		= require('promise');
var chaosrouter		= require('./chaosrouter.js');
var fill		= chaosrouter.populater;
var restruct		= chaosrouter.restruct;
var knex		= require('knex')({
    client: 'sqlite',
    connection: {
	filename: '../../testing.sqlite'
    }
});
knex.CURRENT_TIMESTAMP	= knex.raw('CURRENT_TIMESTAMP');
var bunyan	= require('bunyan');
var log		= bunyan.createLogger({
    name: "ChaosRouter Tests",
    level: 'debug'
});

var router	= chaosrouter('../../routes.json', {
    defaultExec: function (args, resp) {
	var knex	= this.args.db;
	var q		= knex.select();

	var table	= this.directives['table'];
	var where	= this.directives['where'];
	var joins	= this.directives['joins'] || [];
	var columns	= this.directives['columns'] || [];
	var struct	= this.directives['structure'];

	q.from(table);
	
	for (var i in columns) {
    	    if (Array.isArray(columns[i]))
    		columns[i]	= columns[i].join(' as ');
    	    q.column(columns[i]);
	}
	for (var i=0; i<joins.length; i++) {
    	    var join	= joins[i];
    	    var t	= join[0];
    	    var c1	= join[1].join('.');
    	    var c2	= join[2].join('.');
    	    q.leftJoin(knex.raw(t), c1, c2);
	}
	
	if (where)
    	    q.where( knex.raw(fill(where, this.args)) );

	// log.debug("Query: \n"+q.toString());

	q.then(function(result) {
	    var result	= struct === undefined
	    	? result
	    	: restruct(result, struct);
            resp(result);
	}, resp).catch(resp);
    }
});
router.directive('response', function (response, next, resp) {
    if ( typeof response === "string" ) {
	response		= fill(response, this.args);
	if ( typeof response === "string" ) {
	    if(! fs.existsSync(response) ) {
		return resp({
		    error: "Invalid File",
		    message: "The response file was not found"
		});
	    }
	    response		= fs.readFileSync( response, 'utf8' );
	    try {
		response	= JSON.parse(response)
	    } catch(err) {
		return resp({
		    error: "Invalid File",
		    message: "The response file was not valid JSON"
		});
	    }
	}
	else {
	    return resp(response);
	}
    }
    resp(restruct(this.args, response));
});
router.directive('structure_update', function (update, next, resp) {
    if (this.directives['structure'] === undefined)
	return resp({
	    error: "Structure Update Failed",
	    message: "Cannot update undefined; no structure is defined at "+this.route
	});
    extend( this.directive['structure'], update );
    next();
});
router.executables({
    "fail_false": function(args, _, validate) {
	validate(false);
    },
    "Validate": {
	"pass": function(args, _, validate) {
	    validate(true);
	}
    },
    "TestValidationClass": {
	"required_not_empty": function(args, _, validate) {
	    validate({
		error: "Data Required",
		message: "missing required data"
	    })
	}
    },
    "hello_world": function(args, resp) {
	resp({
	    "title": "Hello World",
	    "message": this.args.message
	});
    },
    "ParentClass": {
	"heythere": function(args, resp) {
	    resp({
		title: "Parent Class Test",
		message: this.args.message
	    })
	}
    }
});

function json(d,f) {
    return JSON.stringify(d, null, f===false?null:4);
}

var tests		= [];
var failures		= 0;
var passes		= 0;
function test_endpoint( endpoint, data, cb ) {
    if (!data)
	data		= {};
    extend(data, { "db": test_endpoint.db });
    
    tests.push(new Promise(function(f,r) {
	var ep		= router.route(endpoint);
	var e		= ep.execute(data)
	    .then(function(result) {
		var test	= cb(result);
		var status	= test === true ? "PASSED": "FAILED"
		if(test !== true) {
		    log.warn(status, endpoint);
		    log.error(result);
		    failures++;
		    r(test);
		}
		else {
		    log.info(status, endpoint);
		    passes++;
		    f(test);
		}
	    }, function(err) {
		log.error(err);
	    })
	e.catch(function(err) {
	    log.warn("Caught error");
	    log.error(err);
	});
    }));
}
knex.transaction(function(trx) {
    test_endpoint.db	= trx;
    test_endpoint('/get/people', null, function(result) {
    	if (Object.keys(result).length < 80) {
    	    return ["Unexpected result", result];
    	}
    	return true;
    })
    
    test_endpoint('/get/test_method', {
    	"message": "Travis Mottershead + Erika *{}*"
    }, function (result) {
    	if (result.message === undefined)
    	    return ["Unexpected result", result];
    	return true;
    });

    test_endpoint('/get/parent_class_test', {
    	"message": "this function has a parent class"
    }, function (result) {
    	if (result.message === undefined)
    	    return ["Unexpected result", result];
    	return true;
    });

    test_endpoint('/get/responses/static', null, function (result) {
    	if (result.message !== "this is inline static data") {
    	    return ["Unexpected result", result] ;
    	}
    	return true;
    });

    test_endpoint('/get/responses/file', null, function (result) {
    	if (result.message !== "this is a static file response") {
    	    return ["Unexpected result", result] ;
    	}
    	return true;
    });

    test_endpoint('/get/responses/dynamic', {
    	"name": {
    	    "first": "Ricky",
    	    "last": "Bobby",
    	    "full": "Ricky Bobby"
    	}
    }, function (result) {
    	if (result.first === undefined) {
    	    return ["Unexpected result", result] ;
    	}
    	return true;
    });

    test_endpoint('/get/responses/dynamic', {
    	"name": {
    	    "test": "< exact"
    	}
    }, function (result) {
    	if (result.test !== "< exact") {
    	    return ["Unexpected result", result] ;
    	}
    	return true;
    });

    test_endpoint('/get/responses/dynamic_file', {"file": "../../static_result.json"}, function (result) {
    	if (result.message !== "this is a static file response") {
    	    return ["Unexpected result", result] ;
    	}
    	return true;
    });

    test_endpoint('/get/testBase', null, function (result) {
    	if (result.id === undefined)
    	    return ["Unexpected result", result];
    	return true;
    });

    test_endpoint('/get/test_validate/1', null, function (result) {
    	if (result.id !== 1)
    	    return ["Unexpected result", result];
    	return true;
    });

    test_endpoint('/get/test_validate/fail_false', null, function (result) {
    	if (result.error !== "Failed Validation")
    	    return ["Unexpected result", result];
    	return true;
    });

    test_endpoint('/get/test_validate/class_method', null, function (result) {
    	if (result.error !== "Data Required")
    	    return ["Unexpected result", result];
    	return true;
    });

    test_endpoint('/get/test_validate/string', null, function (result) {
    	if (result.message !== "This is not a pass")
    	    return ["Unexpected result", result];
    	return true;
    });

    test_endpoint('/get/empty_method', null, function (result) {
    	if (result.message !== "Executable is missing the method name")
    	    return ["Unexpected result", result];
    	return true;
    });

    test_endpoint('/get/test_validate/multi_level/level_two', null, function (result) {
    	if (result.message !== "Failed at rule = Failed at level 1")
    	    return ["Unexpected result", result];
    	return true;
    });

    // test_endpoint('/get/trigger/400', null, function (result) {
    // 	if (result.status !== true)
    // 	    return ["Unexpected result", result];
    // 	return true;
    // });

    log.info("Waiting for", tests.length, "to be fulfilled")
    return Promise.all(tests).then(function(all) {
	// trx.commit();
	// return Promise.resolve();
    });
}).then(function() {
    log.info("Passes", passes);
    log.error("Failures", failures);
    log.info("Destroying knex context");
    knex.destroy();
}, function(err) {
    log.error("Reject failure");
    log.error(err);
    knex.destroy();
}).catch( function(err) {
    log.error("Caught failure");
    log.error(err);
    knex.destroy();
});
