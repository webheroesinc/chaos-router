
import os, sys
import logging

from .			import ChaosRouter


log					= logging.getLogger('tests')
log.setLevel(logging.DEBUG)


def test_hello_world():
    
    currentdir			= os.path.dirname( os.path.abspath(__file__) )
    sys.path.insert(0, os.path.join(os.path.dirname( currentdir ), "libs", "chaosrouter-core", "python"))
    sys.path.insert(0, os.path.join(os.path.dirname( currentdir ), "libs", "chaosrouter-sql", "python"))

    ChaosRouter.loader.module( 'chaosrouter_core' )
    
    router			= ChaosRouter("../../routes.json")
    crcore			= router.module('chaosrouter_core', True)
    
    Draft			= router.route("/get/responses/static")
    data			= Draft.proceed()

    assert data.get('message') == "this is inline static data"

        
    @crcore.method()
    def hello_world(self, message):
        self.resolve({
            "title": "Hello World",
            "message": message
        })

    Draft			= router.route("/get/test_method")
    data			= Draft.proceed()
    
    assert data.get('message') == "< input.message"
