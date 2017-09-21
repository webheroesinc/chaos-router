
var populater		= require('./index.js');
var isolate		= require('./isolate.js');

function assert(e) {
    assert.count	= assert.count ? assert.count++ : 1;
    var conversion	= "'"+populater.before+"'"+"	>>	'"+populater.after+"'";
    if (e!==true)
	console.log("Failed Test "+assert.count+": "+conversion);
    else
	console.log("Passed: "+conversion);
}



isolate.method('echo', function() {
    return this.join(' ');
});
// console.log( isolate.inspect('echo').toString() );
// console.log( isolate.eval('global["echo"] = console.log') );
// console.log( isolate.eval('echo("Console.log", "Hello", "World!", "Goodmoring", "Vietnam!")') );

var data	= isolate.eval('echo()', [
    "Hello", "World!", "Goodmorning", "Vietnam!"
]);
assert( data === "Hello World! Goodmorning Vietnam!");



var Person = {
    age: 20,
    name: {
	first: "Travis",
	last: "Mottershead",
	full: "Travis Mottershead"
    }
}
var ctx		=  populater(Person);

populater.error(function(e) {
    if (e.toString() === "ReferenceError: Travis is not defined")
	console.log("Passed: Caught error 'ReferenceError: Travis is not defined'");
    else
	throw Error("Failed: '= {{name.first}}' didn't throw correct error");
});
var str	= ctx("= {{name.first}}");
assert(str === null);


populater.error(function(e) {
    console.error(e);
});

var str	= ctx("{{name.first}} {{name.last}}");
assert(str === "Travis Mottershead");

var str	= ctx("{{name['first']}} {{name['last']}}");
assert(str === "Travis Mottershead");

var str	= ctx("{{name.first}} {{name.first}}");
assert(str === "Travis Travis");

var str	= ctx("< name.first");
assert(str === "Travis");

var str	= ctx("= {{age}} > 18");
assert(str);

var str	= ctx("{{name.none}}");
assert(str === "");

var str	= ctx("= {{name.none}}");
assert(str === undefined);

var str	= ctx(":= {{name.full}}");
assert(str === "= Travis Mottershead");

var str	= ctx("= '= {{name.full}}'");
assert(str === "= Travis Mottershead");

var str	= ctx(":: {{name.full}}");
assert(str === ": Travis Mottershead");

var str	= ctx("= this.name.full");
assert(str === "Travis Mottershead");

populater.method('poop', function(str) {
    return str+" and "+this.name.full;
});

var str	= ctx("= poop('Geoff Dick')");
assert(str === "Geoff Dick and Travis Mottershead");

try {
    populater.method('eval', function() {
	return true;
    });
} catch (err) {
    if(err.message !== "eval is a reserved function name")
	console.log("Failed: To catch error for reserved method name");
    else
	console.log("Passed: Caught error for create reserved method name");
}

var name = ctx("< name");
assert(typeof name === 'object');

var str	= ctx("= ({name:{full:'Samuel Jackson'}}).name.full");
assert(str === "Samuel Jackson");

var ctx = populater(['first', 'second', 'third']);
var str = ctx("{{0}} {{1}} {{2}}");
assert(str === "first second third");


populater.method('altCTX', function() {
    return this.restruct;
});
var template	= populater.template("= altCTX()");
var str		= template.context(Person, {
    restruct: true,
});
assert(str === true);


function startsWith(s, n) {
    return s.indexOf(n) === 0;
}

try {
    populater('string');
} catch (err) {
    if(startsWith(err.message, "Populater can only take complex objects"))
	console.log("Passed: Caught bad context error");
    else
	console.log("Failed: To catch error for bad context");
}

try {
    populater.template([null]);
} catch (err) {
    if(startsWith(err.message, "Template only takes 1 string"))
	console.log("Passed: Caught non-string");
    else
	console.log("Failed: To catch non-string error");
}
