
run-test-server:
	nodemon test-server.js | bunyan -l trace
test-file-upload:
	curl -i -F name=test -F media=@localfile.txt http://localhost:8000/api/upload
