
var chaosrouter		= require('./chaosrouter.js');
var sqlite3		= require('sqlite3').verbose();

var db		= new sqlite3.Database('../testing.sql');

db.all("SELECT name FROM sqlite_master WHERE type='table'", function(err, all) {
    console.log( JSON.stringify(all, null, 4) );
});

router		= chaosrouter('../routes.json', db);
endpoint	= router.route('/get/people');
endpoint.execute().then( function (result) {
    console.log( JSON.stringify(result, null, 4) );
});
console.log("Tests ran.")
