var bunyan	= require('bunyan');
var log		= bunyan.createLogger({
    name: "ChaosRouter Tests",
    level: 'debug'
});

var fs			= require('fs');
var knexlib		= require('knex')
var chaosrouter		= require('./chaosrouter.js');

var expect		= require('chai').expect;

var e			= (e) => log.error(e);

var knex		= knexlib({
    client: 'sqlite',
    connection: {
	filename: '../../testing.sqlite'
    }
});
knex.CURRENT_TIMESTAMP	= knex.raw('CURRENT_TIMESTAMP');


chaosrouter.modules( '../../router/libs/chaosrouter-base/nodejs/index.js',
		     '../../router/libs/chaosrouter-sql/nodejs/index.js' );

var router		= chaosrouter('../../routes.json');

router.modules('chaosrouter-base', 'chaosrouter-sql');

var crbase		= router.module('chaosrouter-base');
var crsql		= router.module('chaosrouter-sql');

crbase.methods({
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

var transaction		= null;

router.set_arguments({
    "db": knex,
});

describe("ChaosRouter", function() {
    describe("Routing", function() {

	it("should get the list of people", function(done) {
	    var draft		= router.route("/get/people");
	    draft.execute().then(function(data) {
		// [{
		//     id: 1,
		//     name:
		//     {
		// 	first: "Michelle",
		// 	last: "Holland",
		// 	full: "{first_name}||\'\' {last_name}||\'\'"
		//     },
		//     phone: "(534)767-6638x942",
		//     personality: "cocky"
		// }, ...]
		expect(data).to.be.an("object");
		expect(Object.keys(data).length).to.be.gte(80);

		data		= data[1];
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.id).to.be.a("number");
		expect(data.name).to.be.a("object");
		expect(data.phone).to.be.a("string");
		expect(data.personality).to.be.a("string");
		done();
	    }, e).catch(e);
	});

	it("should execute method and return object with given message", function(done) {
	    var draft		= router.route("/get/test_method");
	    draft.execute({
		"message": "Travis Mottershead + Erika *{}*"
	    }).then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.title).to.be.a("string");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("Travis Mottershead + Erika *{}*");
		done();
	    }, e).catch(e);
	});
	
	it("should execute class method and return object with given message", function(done) {
	    var draft		= router.route("/get/parent_class_test");
	    draft.execute({
    		"message": "this function has a parent class"
	    }).then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.title).to.be.a("string");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("this function has a parent class");
		done();
	    }, e).catch(e);
	});
	
	it("should return static response", function(done) {
	    var draft		= router.route("/get/responses/static");
	    draft.execute().then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("this is inline static data");
		done();
	    }, e).catch(e);
	});
	
	it("should return reponse from a file", function(done) {
	    var draft		= router.route("/get/responses/file");
	    draft.execute().then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("this is a static file response");
		done();
	    }, e).catch(e);
	});
	
	it("should return dynamic response from given value", function(done) {
	    var draft		= router.route("/get/responses/dynamic");
	    draft.execute({
    		"name": {
    		    "first": "Ricky",
    		    "last": "Bobby",
    		    "full": "Ricky Bobby"
    		}
	    }).then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.first).to.be.a("string");
		expect(data.last).to.be.a("string");
		expect(data.full).to.be.a("string");
		expect(data.first).to.equal("Ricky");
		expect(data.last).to.equal("Bobby");
		done();
	    }, e).catch(e);
	});
	
	it("should return dynamic response with populater command intact", function(done) {
	    var draft		= router.route("/get/responses/dynamic");
	    draft.execute({
    		"name": {
    		    "test": "< exact"
    		}
	    }).then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.test).to.be.a("string");
		expect(data.test).to.equal("< exact");
		done();
	    }, e).catch(e);
	});
	
	it("should return file from dynamic filepath", function(done) {
	    var draft		= router.route("/get/responses/dynamic_file");
	    draft.execute({
		"file": "../../static_result.json"
	    }).then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("this is a static file response");
		done();
	    }, e).catch(e);
	});
	
	it("should test base directive", function(done) {
	    var draft		= router.route("/get/testBase");
	    draft.execute().then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.id).to.be.a("number");
		expect(data.name).to.be.a("object");
		expect(data.phone).to.be.a("string");
		expect(data.personality).to.be.a("string");
		done();
	    }, e).catch(e);
	});
	
	it("should pass validation", function(done) {
	    var draft		= router.route("/get/test_validate/1");
	    draft.execute().then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.id).to.be.a("number");
		expect(data.name).to.be.a("object");
		expect(data.phone).to.be.a("string");
		expect(data.personality).to.be.a("string");
		done();
	    }, e).catch(e);
	});
	
	it("should fail validation", function(done) {
	    var draft		= router.route("/get/test_validate/fail_false");
	    draft.execute().then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.error).to.be.a("string");
		expect(data.message).to.be.a("string");
		expect(data.error).to.equal("Failed Validation");
		done();
	    }, e).catch(e);
	});
	
	it("should fail class method validation", function(done) {
	    var draft		= router.route("/get/test_validate/class_method");
	    draft.execute().then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.error).to.be.a("string");
		expect(data.error).to.equal("Data Required");
		done();
	    }, e).catch(e);
	});
	
	it("should fail on string evaluation", function(done) {
	    var draft		= router.route("/get/test_validate/string");
	    draft.execute().then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.error).to.be.a("string");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("This is not a pass");
		done();
	    }, e).catch(e);
	});
	
	it("should error because task list is empty", function(done) {
	    var draft		= router.route("/get/empty_method");
	    draft.execute().then(e, function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("Array is empty");
		done();
	    }).catch(e);
	});
	
	it("should fail validation on parent level", function(done) {
	    var draft		= router.route("/get/test_validate/multi_level/level_two");
	    draft.execute().then(function(data) {
		log.warn("Data:", data);
		expect(data).to.be.an("object");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("Did not pass validation config '= Failed at level 1'");
		done();
	    }, e).catch(e);
	});
	
    });

    describe("Draft object", function() {

	it("check attributes and methods", function(done) {
	    var draft		= router.route("/get/people");
	    
	    expect(draft).to.be.an("object");
	    expect(draft.path).to.be.a("string");
	    expect(draft.router_path).to.be.a("string");
	    expect(draft.segments()).to.be.an("array");
	    expect(draft.router_segments()).to.be.an("array");
	    expect(draft.params).to.be.an("object");
	    expect(draft.raw).to.be.an("object");
	    expect(draft.raw).to.be.an("object");
	    expect(draft.config).to.be.an("object");
	    expect(draft.directives()).to.be.an("object");
	    expect(draft.directive('__nothing__')).to.be.null;
	    expect(draft.parent()).to.be.an("object");
	    expect(draft.parents()).to.be.an("array");
	    expect(draft.child('create')).to.be.an("object");
	    expect(draft.children()).to.be.an("array");
	    done();
	});
	
    });
});

// test_endpoint('/get/trigger/400', null, function (result) {
// 	if (result.status !== true)
// 	    return ["Unexpected result", result];
// 	return true;
// });
