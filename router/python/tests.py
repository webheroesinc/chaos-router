
from .			import ChaosRouter


def test_hello_world():
    router			= ChaosRouter({
        "helloworld": {
            "__response__": "Hello World!"
        }
    })

    @router.directive()
    def response(self, config):
        if type(config) is str:
            self.resolve( config )

    # router.directive('response', response);
    
    Draft			= router.route("/helloworld")
    data			= Draft.proceed()

    assert data == "Hello World!"
