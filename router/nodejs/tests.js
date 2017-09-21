
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

chaosrouter.modules( '../../router/libs/chaosrouter-base/nodejs/index.js',
		     '../../router/libs/chaosrouter-sql/nodejs/index.js' );
var router		= chaosrouter('../../routes.json');

router.module('chaosrouter-base').enable();
router.module('chaosrouter-sql').enable();

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

    router.set_arguments({
	"db": test_endpoint.db,
    });
    
    tests.push(new Promise(function(f,r) {
	var ep		= router.route(endpoint);
	var e		= ep.execute(data)
	    .then(function(result) {
		var test	= cb(result);
		var status	= test === true ? "PASSED": "FAILED"
		if(test !== true) {
		    log.warn(status, endpoint);
		    log.error("Result from endpoint", endpoint, "with data", Object.keys(data), "-", result);
		    failures++;
		    r(test);
		}
		else {
		    log.info(status, endpoint);
		    passes++;
		    f(test);
		}
	    }, function(err) {
		var test	= cb(err);
		var status	= test === true ? "PASSED": "FAILED"
		if(test !== true) {
		    log.warn(status, endpoint);
		    log.error("Endpoint raised error:", err);
		    failures++;
		    r(test);
		}
		else {
		    log.info(status, endpoint);
		    passes++;
		    f(test);
		}
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
    	if (result.message !== "Array is empty")
    	    return ["Unexpected result", result];
    	return true;
    });

    test_endpoint('/get/test_validate/multi_level/level_two', null, function (result) {
    	if (result.message !== "Did not pass validation config '= Failed at level 1'")
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
    if (failures)
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
