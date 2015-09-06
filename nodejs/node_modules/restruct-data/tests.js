
var restruct	= require('./restruct');

var data	= [{
    id: 1,
    first: 'Travis',
    last: 'Mottershead',
    married: false,
    email: 'travis@pitch.so',
    age: 20
},{
    id: 2,
    first: 'Matthew',
    last: 'Brisebois',
    married: true,
    email: 'matthew@pitch.so',
    age: 25
}];
var struct	= {
    '.key': '{id}',
    name: '{first} {last}',
    age: true,
    dateable_age: ': {age}/2+7',
    married: true,
    available: ': true',
    email: false
}

var result	= restruct(data, struct);
console.log( JSON.stringify(result, null, 4) )

var struct	= {
    '.key': ['{married}', 'hunks'],
    married: true,
    available: ': true',
    hunks: {
	name: '{first} {last}',
	age: true,
	dateable_age: ': {age}/2+7',
	email: false
    }
}

var result	= restruct(data, struct);
console.log( JSON.stringify(result, null, 4) )

