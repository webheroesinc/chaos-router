
function printE(err) {
    console.log(err);
}

var Promise		= require('promise');
var chaosrouter		= require('./chaosrouter.js');
var knex		= require('knex')({
    client: 'sqlite',
    connection: {
	filename: '../testing.sqlite'
    }
});
knex.CURRENT_TIMESTAMP	= knex.raw('CURRENT_TIMESTAMP');


var router	= chaosrouter('../routes.json', {
    db: knex
});
router.extend_methods({
    "hello_world": function(data, cb) {
	cb({
	    "title": "Hello World",
	    "message": data.message
	});
    },
    "ParentClass": {
	"heythere": function(data, cb) {
	    cb({
		title: "Parent Class Test",
		message: data.message
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
    var ep		= router.route(endpoint);
    var e		= ep.execute(data)
	.then(function(result) {
	    return cb(result)
	}).then(function(test) {
	    var status	= test === true ? "PASSED": "FAILED"
	    if(test !== true) {
		console.log(test[0], endpoint);
		failures++;
	    }
	    else
		passes++;
	})
    e.catch(printE);
    tests.push(e);
}
knex.transaction(function(trx) {
    router.db	= trx;
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

    return Promise.all(tests);
}).then(function() {
    console.log("\nPasses:\t\t", passes);
    console.log("Failures:\t", failures);
    console.log("\nDestroying knex context");
    knex.destroy();
}).catch(printE);
