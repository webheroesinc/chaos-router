var bunyan		= require('bunyan');

var log			= bunyan.createLogger({
    name: "ChaosRouter SQL",
    level: 'debug' // module.parent ? 'error' : 'trace'
});

var populater		= require('populater');
var restruct		= require('restruct-data');

module.exports = {
    "__name__": "chaosrouter-sql",
    "__directives__": {
	"sql": function (config) {
	    var self		= this;
	    
	    var knex		= this.args.db;
	    var q		= knex.select();

	    var table		= this.directive('table');
	    var where		= this.directive('where');
	    var joins		= this.directive('joins') || [];
	    var columns		= this.directive('columns') || [];
	    var struct		= this.directive('structure');

	    q.from(table);
	    
	    for (var i in columns) {
    		if (Array.isArray(columns[i]))
    		    columns[i]	= columns[i].join(' as ');
    		q.column(columns[i]);
	    }
	    for (var i=0; i<joins.length; i++) {
    		var join	= joins[i];
    		var t		= join[0];
    		var c1		= join[1].join('.');
    		var c2		= join[2].join('.');
    		q.leftJoin(knex.raw(t), c1, c2);
	    }
	    
	    if (where) {
    		q.where( knex.raw(populater(this.args)(where)) );
	    }

	    log.trace("Query: \n"+q.toString());

	    q.then(function(result) {
		var result	= struct === undefined
	    	    ? result
	    	    : restruct(result, struct);

		self.resolve(result);
	    }, self.reject).catch(self.reject);
	},
    },
};
