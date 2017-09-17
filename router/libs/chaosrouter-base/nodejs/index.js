var bunyan		= require('bunyan');

var log			= bunyan.createLogger({
    name: "ChaosRouter Base",
    level: module.parent ? 'error' : 'trace'
});

var fill		= require('populater');
var restruct		= require('restruct-data');
var extend		= require('util')._extend;
var fs			= require('fs');

module.exports = {
    "name": "chaosrouter-base",
    "directives": {
	"response": function(config, next, resolve) {
	    if ( typeof config === "string" ) {
		response		= fill(config, this.args);
		if ( typeof response === "string" ) {
		    if(! fs.existsSync(response) ) {
			return resolve({
			    error: "Invalid File",
			    message: "The response file was not found"
			});
		    }
		    response		= fs.readFileSync( response, 'utf8' );
		    try {
			response	= JSON.parse(response)
		    } catch(err) {
			return resolve({
			    error: "Invalid File",
			    message: "The response file was not valid JSON"
			});
		    }
		    return resolve(response);
		}
		else {
		    return resolve(response);
		}
	    }
	    resolve(restruct(this.args, config));
	},
	"structure_update": function(config, next, resolve) {
	    if (this.directives['structure'] === undefined)
		return resolve({
		    error: "Structure Update Failed",
		    message: "Cannot update undefined; no structure is defined at "+this.route
		});
	    
	    extend( this.directive['structure'], config );
	    next();
	},
    },
};
