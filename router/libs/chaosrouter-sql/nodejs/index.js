var bunyan		= require('bunyan');
var log			= bunyan.createLogger({name: "ChaosRouter SQL",level: 'fatal'});

module.exports = function(chaosrouter) {
    var restruct	= chaosrouter.restruct;
    var populater	= chaosrouter.populater;

    log.level(chaosrouter.log_level());

    return {
	"__name__": "chaosrouter-sql",
	"__directives__": {
	    "sql": function (config) {
		var self		= this;
		
		var knex		= self.input.db;
		var q		= knex.select();

		var table		= self.directive('table');
		var where		= self.directive('where');
		var joins		= self.directive('joins') || [];
		var columns		= self.directive('columns') || [];
		var struct		= self.directive('structure');

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
    		    q.where( knex.raw(populater(self)(where)) );
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
};
