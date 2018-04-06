
import logging
from chaosrouter			import ChaosRouter

log					= logging.getLogger('tests')
log.setLevel(logging.DEBUG)


ChaosRouter.loader.module( 'chaosrouter_core' )

def test_hello_world():
    router				= ChaosRouter("../../../../routes.json")
    crcore				= router.module('chaosrouter_core', True)
    
    Draft				= router.route("/get/responses/static")
    data				= Draft.proceed()

    assert data.get('message') == "this is inline static data"

        
    @crcore.method()
    def hello_world(self, message):
        self.resolve({
            "title": "Hello World",
            "message": message
        })

    Draft				= router.route("/get/test_method")
    data				= Draft.proceed()
    
    assert data.get('message') == "< input.message"

def test_method_with_path():
    router				= ChaosRouter({
        "hello_world": {
            "__tasks__": [
                ["Static.responses.hello_world", "Surrender"]
            ]
        }
    })
    crcore				= router.module('chaosrouter_core', True)
    
    @crcore.method('Static.responses')
    def hello_world(self, message):
        self.resolve({
            "title": "Hello World",
            "message": message
        })

    Draft				= router.route("/hello_world")
    data				= Draft.proceed()
    
    assert data.get('message') == "Surrender"

def test_class():
    router				= ChaosRouter({
        "hello_world": {
            "__tasks__": [
                ["Responses.hello_world", "Surrender"]
            ]
        }
    })
    crcore				= router.module('chaosrouter_core', True)
    
    @crcore.method()
    class Responses( object ):
        def hello_world(self, message):
            self.resolve({
                "title": "Hello World",
                "message": message
            })

    Draft				= router.route("/hello_world")
    data				= Draft.proceed()
    
    assert data.get('message') == "Surrender"
