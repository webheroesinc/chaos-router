
import logging
import inspect

log					= logging.getLogger('CR_Core')
log.setLevel(logging.DEBUG)

    
def Module( ChaosRouter ):

    @ChaosRouter.register.module()
    class chaosrouter_core( object ):
        __name__			= "chaosrouter_core"
        __methods__			= {}
        
        def __init__(self):
            pass
    
        def __enable__(self, method):
            pass
    
        def __disable__(self, method):
            pass

        @staticmethod
        def method(path=None):
            log.info("Registering method with path {} in crcore".format(path))
            def wrap(m):
                nonlocal path
                name			= m.__name__
                if path is None:
                    path		= name
                else:
                    path		= ".".join([path, name])

                def register_method(path, m):
                    methodlib		= chaosrouter_core.__methods__
                    methodlib[path]	= m

                if inspect.isclass(m):
                    for name in [f for f in dir(m) if callable(getattr(m, f)) and not f.startswith("__")]:
                        path		= ".".join([path, name])
                        register_method(path, getattr(m, name))
                else:
                    log.info("Registering method {} in crcore".format(name))
                    register_method(path, m)
                return m
            return wrap

        
    @ChaosRouter.register.directive('chaosrouter_core')
    def response(self, config):
        if type(config) is str:
            self.resolve( config )
        else:
            self.resolve( config )

            
    def run_command(self, args, ctx, name, error):
        if len(args) == 0:
            error['message']		= "Array is empty"
            return self.reject(error)

        log.info("core class methods: {}".format(chaosrouter_core.__methods__))
        method				= args.pop(0)
        cmd				= chaosrouter_core.__methods__[method] # TODO: implement populater
        data				= args # TODO: implement populater

        if callable(cmd):
            log.debug("Run command '{}' with context {} for Draft {}".format(method, ctx, self.id()))
            cmd(ctx, *data)
        else:
            raise Exception("Method '{}' @ {} in {} directive is not a function".format(method, self.raw_path, name))

    class CTX( object ):
        def __init__(self, draft):
            self.draft			= draft
            self.resolve		= draft.resolve
            self.reject			= draft.reject

        def next(self):
            pass

        def success(self):
            pass

        def fail(self, result):
            check(result, next, self.resolve)

        def defer(self):
            raise Exception("Since python is a synchronous language, this method is not neccessary")

        def method(self, *args):
            draft			= ChaosRouter.Draft(self.draft.router)
            ctx				= CTX(draft)
            run_command(self.draft, args, ctx, "__rules__", error)

        def route(self, path):
            return self.draft.router.route(path).proceed(self.draft.input)


    @ChaosRouter.register.directive('chaosrouter_core')
    class tasks( object ):
        """

	"__tasks__": [
	    ["hello_world", "< input.message"]
	]

        """
        
        def runtime(self, config):
            
            for task in config:
                error			= {
                    "error": "Failed Task",
                    "message": "An error occurred on task '{}'".format(task)
                }
                ctx			= CTX(self)

                if type(task) is str:
                    self.resolve( task ) # TODO: implement populater
                elif type(task) is list:
                    run_command(self, task, ctx, "__tasks__", error)
                else:
                    raise Exception("Bad Task Config: don't know what to do with type '{}'".format(type(config)))

