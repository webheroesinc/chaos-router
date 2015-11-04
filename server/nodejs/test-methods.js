var methods = {
    "hello_world": function(data, cb) {
	cb({
	    "title": "Hello World",
	    "message": data.message
	});
    },
    "uploadTest": function(data, cb) {
	cb({
	    "title": "Upload Test",
	    "data": Object.keys(data),
	    "files": data.files
	});
    },
    "ParentClass": {
	"heythere": function(data, cb) {
	    cb({
		title: "Parent Class Test",
		message: data.message
	    })
	}
    }
}
module.exports		= methods;
