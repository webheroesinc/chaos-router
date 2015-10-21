
function printE(err) {
    console.log(err);
}

var Promise		= require('promise');
var chaosrouter		= require('./chaosrouter.js');
var sqlite3		= require('sqlite3').verbose();
var knex = require('knex')({
    client: 'sqlite',
    connection: {
	filename: '../testing.sqlite'
    }
});
knex.CURRENT_TIMESTAMP	= knex.raw('CURRENT_TIMESTAMP');


var router	= chaosrouter('../routes.json', {
    "query": function(next) {
	var knex	= this.args.knex;
	var q		= knex.select();

	for (var i in this.columns) {
    	    if (Array.isArray(c))
    		this.columns[i]	= this.columns[i].join(' as ');
	    q.column(this.columns[i]);
	}
	q.from(this.table);
	for (var i=0; i<this.joins.length; i++) {
	    var join	= this.joins[i];
	    var t	= join[0];
	    var c1	= join[1].join('.');
	    var c2	= join[2].join('.');
	    q.leftJoin(t, c1, c2);
	}
	if (this.where)
	    q.where( knex.raw(fill(this.where, this.args)) );

	q.then(function(result) {
	    next(null, result);
	    // return Promise.resolve(true);
	});
    }
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
	    console.log(status, endpoint );
	    if(test !== true) {
		console.log( JSON.stringify(test, null, 4) );
		failures++;
	    }
	    else passes++;
	})
    e.catch(printE);
    tests.push(e);
}
knex.transaction(function(trx) {
    test_endpoint('/get/people', {
	"knex": trx
    }, function(result) {
	if (Object.keys(result).length === 0) {
	    return ["Unexpected result", result];
	}
	return true;
    })
    
    test_endpoint('/get/test_method', {
	"knex": trx,
	"message": "Travis Mottershead + Erika *{}*"
    }, function (result) {
	if (result.message === undefined)
	    return ["Unexpected result", result];
	return true;
    });

    test_endpoint('/get/parent_class_test', {
	"knex": trx,
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
	console.log(result.message)
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
