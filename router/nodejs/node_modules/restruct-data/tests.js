var bunyan	= require('bunyan');
var log		= bunyan.createLogger({name: 'api tests', level: "trace"});

var expect	= require('chai').expect;
var restruct	= require('./restruct');

var e		= (e) => log.error(e);
var n		= () => null;

function json(d,f) {
    return JSON.stringify(d, null, f?4:null);
}
	    
restruct.method('weightClass', function(w) {
    return w >= 200 ? '200+' : '0-199'
});

var database	= [{
    id: 1,
    first: 'Travis',
    last: 'Mottershead',
    email: 'travis@pitch.so',
    gender: 'm',
    age: 20,
    weight: 150
},{
    id: 2,
    first: 'Matthew',
    last: 'Brisebois',
    email: 'matthew@pitch.so',
    gender: 'm',
    age: 25,
    weight: 210
},{
    id: 3,
    first: 'Geoff',
    last: 'Dick',
    email: 'geoff@pitch.so',
    gender: 'm',
    age: 28,
    weight: 130
},{
    id: 4,
    first: 'Valerie',
    last: 'Brisebois',
    email: 'valerie@brisebois.me',
    gender: 'f',
    age: 24,
    weight: 120
}];


describe('/restruct', function() {

    var collection		= restruct.collection(database);
    
    it("should create 'adults' key with all 4 people in it", function() {
	var data	= collection.format({
	    "= this.age > 18 ? 'adults' : 'kids'": [
    		["= this.age > 25","{{first}}"]
	    ],
	});
	expect(data).to.be.an('Object');
	expect(data).to.have.key('adults');

	data		= data['adults'];
	expect(data).to.be.an('Array');
	expect(data).to.be.length(4);
	expect(data[0]).to.be.an('Array');
	expect(data[0]).to.be.length(2);
	expect(data[0][0]).to.be.false;
	expect(data[0][1]).to.equal('Travis');
    });
    
    it("should create 'best_friend' key with Travis info", function() {
	var data	= collection.format({
	    "= this.first === 'Travis' ? 'best_friend' : undefined": {
		"name": "{{first}} {{last}}",
		"hotness": "0% *******-------------------------- 100%"
	    }
	});
	expect(data).to.be.an('Object');
	expect(data).to.have.key('best_friend');

	data		= data['best_friend'];
	expect(data).to.be.an('Object');
	expect(Object.keys(data)).to.be.length(2);
	expect(data).to.have.all.keys('name', 'hotness');
	expect(data['name']).to.be.a('String');
	expect(data['name']).to.equal("Travis Mottershead");
	expect(data['hotness']).to.be.a('String');
	expect(data['hotness']).to.equal("0% *******-------------------------- 100%");
    });
    
    it("should create 'other_friends' key with everyone except Travis", function() {
	var data	= collection.format({
	    "= this.first !== 'Travis' ? 'other_friends' : undefined": [{
		"name": "{{first}} {{last}}",
		"hotness": "0% *-------------------------------- 100%"
	    }],
	});
	expect(data).to.be.an('Object');
	expect(data).to.have.key('other_friends');

	data		= data['other_friends'];
	expect(data).to.be.an('Array');
	expect(data).to.be.length(3);

	var names = ["Matthew Brisebois", "Geoff Dick", "Valerie Brisebois"];
	data.forEach(function(person, index) {
	    expect(person).to.have.all.keys('name', 'hotness');
	    expect(person['hotness']).to.be.a('String');
	    expect(person['hotness']).to.equal("0% *-------------------------------- 100%");

	    expect(data[index]['name']).to.be.a('String');
	    expect(data[index]['name']).to.equal(names[index]);
	});
    });
    
    it("should create weight classes with everyone in the correct class", function() {
	var data	= collection.format({
	    "= weightClass(this.weight)": {
		"{{id}}": {
		    "name": "{{first}} {{last}}",
		    "weight": "< weight"
		}
	    }
	});
	expect(data).to.have.all.keys('0-199', '200+');

	weight1		= data['0-199'];
	weight2		= data['200+'];
	
	data		= weight1;
	expect(data).to.be.an('Object');
	expect(Object.keys(data)).to.be.length(3);
	expect(data).to.have.all.keys('1', '3', '4');
	for (var id in data) {
	    expect(data[id].weight).to.be.lt(200);
	}
	
	data		= weight2;
	expect(data).to.be.an('Object');
	expect(Object.keys(data)).to.be.length(1);
	expect(data).to.have.all.keys('2');
	for (var id in data) {
	    expect(data[id].weight).to.be.gte(200);
	}
    });
    
    it("should create emails list using object flattening", function() {
	var data	= collection.format({
	    "emails": {
		"__array": true,
		"< id": "< email",
	    },
	});
	expect(data).to.have.key('emails');

	data		= data['emails'];
	expect(data).to.be.an('Array');
	expect(data).to.be.length(4);
    });
    
    it("should return frame information", function() {
	restruct.method('frame_info', function() {
	    return {
		"index": this.index,		// 0
		"data": this.data,		// { "id": 1, "name": "Chuck Norris" }

		"check": this.source(this.index),
		// 'this.data' is the same as 'this.source(this.index)'

		"parent": this.parent,		// parent Frame( [ { "id": 1, ...}, { "id": 2, ...} ] )
		"source": this.source(),	// "this.parent.data" but returns null if no parent
		
		"keys": this.keys(),		// [ 'id', 'name' ]
		"values": this.values(),	// [ 1, 'Chuck Norris' ]
		"id": this.child('id'),		// Frame(1)
		"name": this.child('name'),	// Frame('Chuck Norris')
		"children": this.children(),	// [ Frame(1), Frame('Chuck Norris') ]

		// this.restruct	// restruct instance
		// this.restruct.root	// root Frame(...), which would be 'this.parent' in this case
	    };
	}, function(err) {
	    console.error(err);
	});
	
	var data	= collection.format({
	    "< id": "= frame_info()"
	});

	var Travis	= data[1];
	expect(Travis).to.be.an('Object');
	expect(Travis).to.have.all.keys('index', 'data', 'check', 'parent', 'source',
					'keys', 'values', 'id', 'name', 'children');
	expect(Travis['index']).to.be.a('String');
	expect(Travis['data']).to.be.an('Object');
	expect(Travis['check']).to.equal(Travis.data);
	expect(Travis['parent']).to.be.an('Object');
	expect(Travis['source']).to.be.an('Array');
	expect(Travis['keys']).to.be.an('Array');
	expect(Travis['values']).to.be.an('Array');
	expect(Travis['id']).to.be.an('Object');
	expect(Travis['name']).to.be.an('Object');
	expect(Travis['children']).to.be.an('Array');
    });
	    
});
	    
// restruct.flattenTrigger = '__array__';
// var struct	= {
//     "genders": {
// 	"__array__": true,
// 	"< gender": {
// 	    "__array__": true,
// 	    0: "= this.age > 25",
// 	    1: "{first}"
// 	}
//     }
// }
// var data	= restruct(database, struct);
// console.log(json(data,true))

// var database	= {
//     "class": "Math",
//     "people": [{
// 	id: 1,
// 	first: 'Travis',
// 	last: 'Mottershead',
// 	email: 'travis@pitch.so',
// 	gender: 'm',
// 	age: 20,
// 	weight: 150
//     },{
// 	id: 2,
// 	first: 'Matthew',
// 	last: 'Brisebois',
// 	email: 'matthew@pitch.so',
// 	gender: 'm',
// 	age: 25,
// 	weight: 210
//     },{
// 	id: 3,
// 	first: 'Aaron',
// 	last: 'Dick',
// 	email: 'aaron@pitch.so',
// 	gender: 'm',
// 	age: 28,
// 	weight: 130
//     },{
// 	id: 4,
// 	first: 'Valerie',
// 	last: 'Brisebois',
// 	email: 'valerie@brisebois.me',
// 	gender: 'f',
// 	age: 24,
// 	weight: 120
//     }]
// }

// var struct = {
//     "< class": {
// 	".rescope": ["< people", "person"],
// 	"< person.id": {
// 	    "id": "< person.id",
// 	    "name": "{person.first} {person.last}",
// 	    "email": "< person.email",
// 	    "< people[this.$index+1] ? 'next' : undefined": {
// 		"id": "< people[this.$index+1].id",
// 		"name": "= this.people[this.$index+1].first+' '+this.people[this.$index+1].last",
// 		"email": "< people[this.$index+1].email"
// 	    }
// 	}
//     }
// }
// var data	= restruct(database, struct);
// console.log(json(data,true))

// var struct = {
//     "< class": {
// 	".rescope": "< people",
// 	"< id": {
// 	    "name": "{first} {last}",
// 	    "email": true
// 	}
//     }
// }
// var data	= restruct(database, struct);
// console.log(json(data,true))

// var database = [{
//     order: "1",
//     title: "Introduction",
//     text: "Welcome to the intro!",
// }, {
//     order: "1.1",
//     title: "sub section",
//     text: "...text",
// }, {
//     order: "1.1.1",
//     title: "sub sub section",
//     text: "......text",
// }, {
//     order: "2",
//     title: "section",
//     text: "text",
// }, {
//     order: "2.1",
//     title: "sub section",
//     text: "...text",
// }];

// var data	= restruct(database, {
//     "children": {
// 	"= this.order.split('.')": {
// 	    "title": true,
// 	    "text": true
// 	},
// 	"titles": [ "< title" ]
//     }
// });
// console.log(json(data,true))
