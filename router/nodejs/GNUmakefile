SHELL=bash

tests:
	mocha tests.js | bunyan -o short; exit "$${PIPESTATUS[0]}"
