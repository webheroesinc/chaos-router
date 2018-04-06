
upload-test:
	cd module; sudo python3 setup.py sdist upload -r pypi-test
publish:
	cd module; sudo python3 setup.py sdist upload -r pypi

check:
	cd module; sudo python3 setup.py check -r -s

tests:		install
	python3 -m pytest tests.py

install:
	sudo pip3 uninstall chaosrouter_core -y || true
	cd module; sudo python3 setup.py install
