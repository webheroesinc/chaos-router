
import os, sys

from .			import ChaosRouter


def test_hello_world():
    
    currentdir			= os.path.dirname( os.path.abspath(__file__) )
    sys.path.insert(0, os.path.join(os.path.dirname( currentdir ), "libs", "chaosrouter-core", "python"))
    sys.path.insert(0, os.path.join(os.path.dirname( currentdir ), "libs", "chaosrouter-sql", "python"))

    ChaosRouter.loader.module( 'chaosrouter_core' )
    
    router			= ChaosRouter("../../routes.json")
    crcore			= router.modules('chaosrouter_core', True)
    
    Draft			= router.route("/get/responses/static")
    data			= Draft.proceed()

    assert data.get('message') == "this is inline static data"
