.PHONY:		all test

DOCKER		="chaosrouter_example"

FAKER		= /usr/local/lib/python2.7/dist-packages/faker
DPACK		= docker/webheroes/chaosrouter/chaosrouter/__init__.py
OPACK		= chaosrouter/__init__.py
PWD		= $$(pwd)

all:
	@echo "test:			This runs the chaosrouter test to prove it works :)"

# Build Project Dockers
test:		testing.sqlite $(DPACK)
	@if ! d=$(docker images | grep webheroes/chaosrouter); then			\
	    echo "docker build -t webheroes/chaosrouter docker/webheroes/chaosrouter";	\
	    docker build -t webheroes/chaosrouter docker/webheroes/chaosrouter;		\
	fi;
	docker run --name $(DOCKER) --rm -v $(PWD):/host -w /host webheroes/chaosrouter python test.py

$(FAKER):
	pip install faker
testing.sqlite:		$(FAKER) generate.py
	rm $@	|| true
	python generate.py

$(DPACK):		$(OPACK)
	rm -r ./docker/webheroes/chaosrouter/chaosrouter	|| true
	rsync -va chaosrouter/ ./docker/webheroes/chaosrouter/chaosrouter
	docker build -t webheroes/chaosrouter docker/webheroes/chaosrouter
