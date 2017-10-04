var bunyan		= require('bunyan');
var log			= bunyan.createLogger({name: "ChaosRouter Tests",level: 'fatal'});

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

log.level(chaosrouter.log_level('error'));

chaosrouter.modules( '../../router/libs/chaosrouter-core/nodejs/index.js',
		     '../../router/libs/chaosrouter-sql/nodejs/index.js' );

var router		= chaosrouter('../../routes.json');

var crcore		= router.module('chaosrouter-core', true);
var crsql		= router.module('chaosrouter-sql', true);

crcore.methods({
    "fail_false": function() {
	this.fail(false);
    },
    "Rules": {
	"pass": function() {
	    this.pass();
	}
    },
    "TestValidationClass": {
	"required_not_empty": function() {
	    this.fail({
		error: "Data Required",
		message: "missing required data"
	    })
	}
    },
    "hello_world": function(message) {
	this.resolve({
	    "title": "Hello World",
	    "message": message
	});
    },
    "ParentClass": {
	"heythere": function(data) {
	    this.resolve({
		title: "Parent Class Test",
		message: data.message
	    })
	}
    }
});

function json(d,f) {
    return JSON.stringify(d, null, f===false?null:4);
}

var transaction		= null;

router.set_input({
    "db": knex,
});

describe("ChaosRouter", function() {
    describe("Routing", function() {

	it("should get the list of people", function(done) {
	    var draft		= router.route("/get/people");
	    draft.proceed().then(function(data) {
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
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.id).to.be.a("number");
		expect(data.name).to.be.a("object");
		expect(data.phone).to.be.a("string");
		expect(data.personality).to.be.a("string");
		done();
	    }, e).catch(e);
	});

	it("should run method and return object with given message", function(done) {
	    var draft		= router.route("/get/test_method");
	    draft.proceed({
		"message": "Travis Mottershead + Erika *{}*"
	    }).then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.title).to.be.a("string");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("Travis Mottershead + Erika *{}*");
		done();
	    }, e).catch(e);
	});
	
	it("should run class method and return object with given message", function(done) {
	    var draft		= router.route("/get/parent_class_test");
	    draft.proceed({
    		"message": "this function has a parent class"
	    }).then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.title).to.be.a("string");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("this function has a parent class");
		done();
	    }, e).catch(e);
	});
	
	it("should return static response", function(done) {
	    var draft		= router.route("/get/responses/static");
	    draft.proceed().then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("this is inline static data");
		done();
	    }, e).catch(e);
	});
	
	it("should return reponse from a file", function(done) {
	    var draft		= router.route("/get/responses/file");
	    draft.proceed().then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("this is a static file response");
		done();
	    }, e).catch(e);
	});
	
	it("should return dynamic response from given value", function(done) {
	    var draft		= router.route("/get/responses/dynamic");
	    draft.proceed({
    		"name": {
    		    "first": "Ricky",
    		    "last": "Bobby",
    		    "full": "Ricky Bobby"
    		}
	    }).then(function(data) {
		log.debug("Data:", data);
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
	    draft.proceed({
    		"name": {
    		    "test": "< exact"
    		}
	    }).then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.test).to.be.a("string");
		expect(data.test).to.equal("< exact");
		done();
	    }, e).catch(e);
	});
	
	it("should return file from dynamic filepath", function(done) {
	    var draft		= router.route("/get/responses/dynamic_file");
	    draft.proceed({
		"file": "../../static_result.json"
	    }).then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("this is a static file response");
		done();
	    }, e).catch(e);
	});
	
	it("should test base directive", function(done) {
	    var draft		= router.route("/get/testBase");
	    draft.proceed().then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.id).to.be.a("number");
		expect(data.name).to.be.a("object");
		expect(data.phone).to.be.a("string");
		expect(data.personality).to.be.a("string");
		done();
	    }, e).catch(e);
	});
	
	it("should pass validation", function(done) {
	    var draft		= router.route("/get/test_rules/1");
	    draft.proceed().then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.id).to.be.a("number");
		expect(data.name).to.be.a("object");
		expect(data.phone).to.be.a("string");
		expect(data.personality).to.be.a("string");
		done();
	    }, e).catch(e);
	});
	
	it("should fail validation", function(done) {
	    var draft		= router.route("/get/test_rules/fail_false");
	    draft.proceed().then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.error).to.be.a("string");
		expect(data.message).to.be.a("string");
		expect(data.error).to.equal("Failed Validation Rule");
		done();
	    }, e).catch(e);
	});
	
	it("should fail class method validation", function(done) {
	    var draft		= router.route("/get/test_rules/class_method");
	    draft.proceed().then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.error).to.be.a("string");
		expect(data.error).to.equal("Data Required");
		done();
	    }, e).catch(e);
	});
	
	it("should fail on string evaluation", function(done) {
	    var draft		= router.route("/get/test_rules/string");
	    draft.proceed().then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.error).to.be.a("string");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("This is not a pass");
		done();
	    }, e).catch(e);
	});
	
	it("should error because task list is empty", function(done) {
	    var draft		= router.route("/get/empty_method");
	    draft.proceed().then(e, function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("Array is empty");
		done();
	    }).catch(e);
	});
	
	it("should fail validation on parent level", function(done) {
	    var draft		= router.route("/get/test_rules/multi_level/level_two");
	    draft.proceed().then(function(data) {
		log.debug("Data:", data);
		expect(data).to.be.an("object");
		expect(data.message).to.be.a("string");
		expect(data.message).to.equal("Did not pass rule config '= Failed at level 1'");
		done();
	    }, e).catch(e);
	});
	
    });

    describe("Draft object", function() {

	it("check attributes and methods", function(done) {
	    var draft		= router.route("/get/people/1");
	    
	    expect(draft).to.be.an("object");

	    draft.ready(function() {
		// There is some kind of glitch that makes draft undefined here.  Possibly a problem
		// in Mocha, but we can bypass it with this
		var draft	= this;
		
		log.info("Testing Draft.key");
		expect(draft.key).to.be.a("string");
		expect(draft.key).to.equal("1");

		log.info("Testing Draft.vkey");
		expect(draft.vkey).to.be.a("string");
		expect(draft.vkey).to.equal(":id");

		log.info("Testing Draft.id()");
		expect(draft.id()).to.be.a("string");
		expect(draft.id()).to.equal("/get/people/1");

		log.info("Testing Draft.path");
		expect(draft.path).to.be.a("string");
		expect(draft.path).to.equal("/get/people/1");
		
		log.info("Testing Draft.raw_path");
		expect(draft.raw_path).to.be.a("string");
		expect(draft.raw_path).to.equal("/get/people/:id");
		
		log.info("Testing Draft.segments()");
		expect(draft.segments()).to.be.an("array");
		expect(draft.segments()).to.have.length(3);
		expect(draft.segments()[2]).to.equal("1");
		
		log.info("Testing Draft.raw_segments()");
		expect(draft.raw_segments()).to.be.an("array");
		expect(draft.raw_segments()).to.have.length(3);
		expect(draft.raw_segments()[2]).to.equal(":id");
		
		log.info("Testing Draft.params");
		expect(draft.params).to.be.an("object");
		expect(draft.params.id).to.equal("1");
		expect(Object.keys(draft.params)).to.have.length(1);
		
		log.info("Testing Draft.raw");
		expect(draft.raw).to.be.an("object");
		expect(Object.keys(draft.raw)).to.have.length(2);
		expect(draft.raw.__base__).to.equal("..");
		expect(draft.raw.__structure__).to.be.an("object");
		
		log.info("Testing Draft.config");
		expect(draft.config).to.be.an("object");
		expect(draft.config).to.equal(draft.raw);
		
		log.info("Testing Draft.directives()");
		expect(draft.directives()).to.be.an("object");
		expect(Object.keys(draft.directives())).to.have.length(4);
		expect(draft.directives().base).to.equal("..");
		expect(draft.directives().structure).to.be.an("object");
		
		log.info("Testing Draft.directive('__notexists__')");
		expect(draft.directive("__notexists__")).to.be.null;
		
		log.info("Testing Draft.parent()");
		expect(draft.parent()).to.be.an("object");
		expect(draft.parent().id()).to.be.a("string");
		expect(draft.parent().id()).to.equal("/get/people");
		
		log.info("Testing Draft.parents()");
		expect(draft.parents()).to.be.an("array");
		expect(draft.parents()).to.have.length(3);
		expect(draft.parents()[0]).to.equal(draft.parent());

		var draft		= draft.route("../../people");
		
		log.info("Testing Draft.child('create')");
		expect(draft.child("create")).to.be.an("object");
		expect(draft.child("create").id()).to.be.a("string");
		expect(draft.child("create").id()).to.equal("/get/people/create");
		
		log.info("Testing Draft.children");
		expect(draft.children()).to.be.an("array");
		expect(draft.children()).to.have.length(2);
		
		done();
	    },e).catch(e);
	});
	
    });
});

// test_endpoint("/get/trigger/400", null, function (result) {
// 	if (result.status !== true)
// 	    return ["Unexpected result", result];
// 	return true;
// });
