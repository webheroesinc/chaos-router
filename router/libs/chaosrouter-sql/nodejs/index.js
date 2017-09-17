var bunyan		= require('bunyan');

var log			= bunyan.createLogger({
    name: "ChaosRouter SQL",
    level: module.parent ? 'error' : 'trace'
});

var fill		= require('populater');
var restruct		= require('restruct-data');

module.exports = {
    "name": "chaosrouter-sql",
    "directives": {
	"sql": function(config, next, resolve) {
	    var knex		= this.args.db;
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
	    
	    if (where) {
    		q.where( knex.raw(fill(where, this.args)) );
	    }

	    // log.trace("Query: \n"+q.toString());

	    q.then(function(result) {
		var result	= struct === undefined
	    	    ? result
	    	    : restruct(result, struct);

		resolve(result);
	    }, resolve).catch(resolve);
	},
    },
};
