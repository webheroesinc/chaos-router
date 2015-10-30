
var restruct	= require('./restruct');
var fill	= restruct.populater;

function json(d,f) {
    return JSON.stringify(d, null, f?4:null);
}

var result	= [{
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

fill.method('weightClass', function(w) {
    return w >= 200 ? '200+' : '0-199'
});

var struct	= {
    "= this.age > 18 ? 'adults' : 'kids'": [
    	["= this.age > 25","{first}"]
    ],
    "= this.first === 'Travis'?'best':undefined": {
	"name": "{first} {last}",
	"hotness": "0% *******-------------------------- 100%"
    },
    "= this.first !== 'Travis'?'losers':undefined": [{
	"name": "{first} {last}",
	"hotness": "0% *-------------------------------- 100%"
    }],
    "genders": {
	".array": true,
	"< gender": {
	    ".array": true,
	    0: "= this.age > 25",
	    1: "{first}"
	}
    },
    "= weightClass(this.weight)": {
	"{id}": {
	    "name": "{first} {last}",
	    "weight": "< weight"
	},
	"location": {
	    ".array": true,
	    0: "< age",
	    1: "< weight"
	}
    },
    "= this.gender==='m'?'male':'female'": [{
	"{id}": {
	    "name": "{first} {last}",
	    "email": true
	}
    }],
    "delete": "< happy.tappy"
}
var data	= restruct(result, struct);
console.log(json(data,true))

restruct.flattenTrigger = '__array__';
var struct	= {
    "genders": {
	"__array__": true,
	"< gender": {
	    "__array__": true,
	    0: "= this.age > 25",
	    1: "{first}"
	}
    }
}
var data	= restruct(result, struct);
console.log(json(data,true))
