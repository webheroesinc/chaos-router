
var chaosrouter		= require('./chaosrouter.js');
var sqlite3		= require('sqlite3').verbose();
var knex = require('knex')({
    client: 'sqlite',
    connection: {
	filename: '../testing.sqlite'
    }
});
knex.CURRENT_TIMESTAMP	= knex.raw('CURRENT_TIMESTAMP');

// db.all("SELECT name FROM sqlite_master WHERE type='table'", function(err, all) {
//     console.log( JSON.stringify(all, null, 4) );
// });

var router = chaosrouter('../routes.json', function(next) {
    var q		= knex.select();

    for (var i in this.columns) {
    	if (Array.isArray(c))
    	    this.columns[i]	= this.columns[i].join(' as ');
	q.column(this.columns[i]);
    }
    q.from(this.table);
    for (var i=0; i<this.joins.length; i++) {
	var join	= this.joins[i];
	var t		= join[0];
	var c1		= join[1].join('.');
	var c2		= join[2].join('.');
	q.leftJoin(t, c1, c2);
    }
    if (this.where)
	q.where( knex.raw(fill(this.where, this.args)) );

    q.then(function(result) {
	next(null, result);
    });
});
endpoint	= router.route('/get/people');
endpoint.execute()
    .then( function (result) {
	console.log( JSON.stringify(result, null, 4) );
    });
console.log("Tests ran.")

