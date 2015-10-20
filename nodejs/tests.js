
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
	},
	"heythere": function(data, cb) {
	    cb({
		title: "Parent Class Test",
		message: data.message
	    })
	}
    }
});

knex.transaction(function(trx) {
    var endpoint1	= router.route('/get/people');
    var e1		= endpoint1.execute({
	"knex": trx
    })
	.then(function (result) {
	    console.log("Finish test 1");
	    if (Object.keys(result).length === 0) {
		console.log( JSON.stringify(result, null, 4) );
		throw new Error("Unexpected result");
	    }
	});
    e1.catch(printE);

    var endpoint2	= router.route('/get/test_method');
    var e2		= endpoint2.execute({
	"knex": trx,
	"message": "Travis Mottershead + Erika *{}*"
    })
	.then(function (result) {
	    console.log("Finish test 2");
	    if (result.message === undefined) {
		console.log( JSON.stringify(result, null, 4) );
		throw new Error("Unexpected result");
	    }
	});
    e2.catch(printE);
    
    var endpoint3	= router.route('/get/parent_class_test');
    var e3		= endpoint3.execute({
	"knex": trx,
	"message": "this is function has a parent class"
    })
	.then(function (result) {
	    console.log("Finish test 3");
	    if (result.message === undefined) {
		console.log( JSON.stringify(result, null, 4) );
		throw new Error("Unexpected result");
	    }
	});
    e3.catch(printE);
    
    return Promise.all([e1, e2, e3]);
}).then(function() {
    console.log("Destroying knex context");
    knex.destroy();
}).catch(printE);

