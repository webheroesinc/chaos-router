
    
def Module( ChaosRouter ):

    @ChaosRouter.register.module()
    class chaosrouter_core( object ):
        __name__             = "chaosrouter_core"
    
        def __init__(self):
            pass
    
        def __enable__(self, method):
            pass
    
        def __disable__(self, method):
            pass

    @ChaosRouter.register.directive('chaosrouter_core')
    def response(self, config):
        if type(config) is str:
            self.resolve( config )
        else:
            self.resolve( config )
            
    # class response( object ):
        
    #     def runtime(self, config):
    #         if type(config) is str:
    #             self.resolve( config )
    #         else:
    #             self.resolve( config )

