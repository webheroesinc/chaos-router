
import logging
from urllib.parse				import ( quote		as urllib_quote,
                                                         unquote	as urllib_unquote )

log					= logging.getLogger('ChaosRouter')
log.setLevel(logging.DEBUG)


def encode_URI(text):
    return urllib_quote(text, safe='~@#$&()*!+=:;,.?/\'')

def encode_URI_component(text):
    return urllib_quote(text, safe='~()*!.\'')

def decode_URI(text):
    return urllib_unquote(text)

def decode_URI_component(text):
    return decode_URI(text)


def load_config_file( filepath ):
    with open(filepath) as f:
        config				= json.loads( f.read() )
        # TODO: implement replace_file_refs()
    return config

def get_variable_key( config ):
    vkey				= None
    for key in config.keys():
        if key.strip().find(':') == 0:
            if vkey is None:
                vkey			= key
            else:
                pass # TODO: warn about multiple variable keys
    return vkey

def find_child_config( data, key ):
    key					= decode_URI_component(key)
    log.debug("Finding {} in routes config {}".format(key, data.keys()))
    config				= data.get(key)
    params				= {}
    vname				= None
    vkey				= None

    if config is None:
        vkey				= get_variable_key( data )
        if vkey:
            vname			= vkey[1:]
            config			= data[vkey]
            params[vname]		= key

    return (config, vkey, vname, key)

def get_directives( data ):
    directives				= {}
    for k in data.keys():
        noprefix			= k[len(ChaosRouter.DIR_PREFIX):]
        if ( k.find( ChaosRouter.DIR_PREFIX ) == 0
             and noprefix.find( ChaosRouter.DIR_SUFFIX ) == (len(noprefix) - len(ChaosRouter.DIR_SUFFIX))):
            name			= k[ len(ChaosRouter.DIR_PREFIX) : -len(ChaosRouter.DIR_SUFFIX) ]
            directives[name]		= data[k]
    return directives


class ChaosRouter( object ):

    DIR_PREFIX				= "__"
    DIR_SUFFIX				= "__"
    ENABLE_ALL				= 0
    ENABLE_SELECTION			= 1
    ENABLE_EXCLUSION			= 2
    DISABLE_SELECTION			= 3

    def __init__(self, routes, opts=None):

        if opts is None:
            opts			= {}

        self.config			= {}
        self.configfile			= None
        self.basepath			= opts.get('basepath', '/')
        self.baseInput			= {}
        
        if type(routes) is dict:
            log.debug("Setting config to given dict: {}".format(routes))
            self.config			= routes
        elif type(routes) is str:
            log.debug("Setting configfile to given str: {}".format(routes))
            self.configfile		= routes
        else:
            raise Exception("unrecognized data type: {}".format( type(routes) ))
        
        self.__directives__		= { "before": {}, "runtime": {}, "after": {} }
        self.__root__			= Draft(self)

    def directive(self, name=None, fns=None):
        dirs				= self.__directives__
        
        if name is None and fns is None:
            def wrap(f):
                name			= f.__name__
                log.debug("Registering runtime method {}: {}".format(name, repr(f)))
                dirs['runtime'][name]	= f
                def wrapper(*args):
                    return f(*args)
                return wrapper
            return wrap

        if callable(fns):
            log.debug("Registering runtime method {}: {}".format(name, repr(fns)))
            dirs['runtime'][name]	= fns
        else:
            if fns.__before__:
                dirs['before'][name]	= fns.__before__
            if fns.__runtime__:
                dirs['runtime'][name]	= fns.__runtime__
            if fns.__after__:
                dirs['after'][name]	= fns.__after__
    

    def route(self, path):
        return self.root().route(path)

    def root(self):
        if self.configfile:
            self.config			= load_config_file( self.configfile )
            self.__root__.config	= self.config
        return self.__root__


class Draft( object ):

    def __init__(self, parent, key=None):
        self.key			= key
        self.vkey			= None
        self.input			= {}
        self.__resolve__		= None
        self.__reject__			= None

        log.debug("Parent config: {}".format(parent.config))
        
        if isinstance(parent, ChaosRouter):
            self.config			= parent.config
            self.params			= {}
            self.router			= parent
            self.__parent__		= None
            self.__parents__		= []
        else:
            log.debug("Parent identity: '{}' {}".format( parent.key, list(map(lambda p: p.key, parent.parents())) ))
            
            if not (isinstance(parent, ChaosRouter) or isinstance(parent, Draft)):
                raise Exception("Parent is not an instance of Router or Draft classes ({}) {}".format( type(parent), parent ))
            if type(parent.config) is not dict:
                raise Exception("Parent is missing 'config' ({})".format( type(parent.config) ))

            config,vkey,vname,value	= find_child_config( parent.config, key )

            if config is None:
                raise Exception("Dead end; Path leads to nowhere, failed at key")

            self.config			= config
            params			= {}
            if vname:
                params[vname]		= value
            self.params			= {}
            self.params.update(parent.params)
            self.params.update(params)
            self.vkey			= vkey

            self.router			= parent.router
            self.input.update(self.router.baseInput)
            self.input.update({ "path": self.params })
            self.__parent__		= parent
            self.__parents__		= parent.parents() + [parent]

        if type(self.config) is not dict:
            pass # TODO: warn that no config has been specified

        self.path			= "" if (not hasattr(parent, 'path') or parent.path is None) else "{}/{}".format(parent.path, key)
        self.raw_path			= "" if (not hasattr(parent, 'path') or parent.path is None) else "{}/{}".format(parent.path, (self.vkey or key))
        self.raw			= self.config
        self.__directives__		= get_directives( self.config )

        # TODO: process all before directives
        # self.router.__directives__['before']

    def route(self, path):
        log.debug("Routing path {}".format(path))
        node				= self.router.root() if path[0] == "/" else self

        if not isinstance(node, Draft):
            log.error("Node is not an instance of Draft: type {}".format( type(node) ))

        segments			= path.split('/')
        log.debug("Segments: {}".format(segments))
        for seg in segments:
            if seg == '':
                continue

            node			= (node.parent() or node) if seg == ".." else node.child( seg )

            if node is None:
                raise Exception("Path leads to a dead end: {}".format(path))
        return node

    def parent(self):
        return self.__parent__

    def parents(self):
        parents				= self.__parents__[:]
        parents.reverse()
        return parents
    
    def child(self, key):
        return Draft(self, key)

    def directives(self, name):
        if name:
            return self.directive(name)
        directives			= {}
        directives.update( self.__directives__ )
        return directives

    def directive(self, name, config=None):
        if config:
            self.__directives__[name]	= config
        return self.__directives__.get(name)

    def resolve(self, data):
        self.__resolve__		= data
        
    def reject(self, data):
        self.__reject__			= data

    def process_directives(self, directives):
        try:
            for k, directive in directives.items():
                config			= self.directive(k)
                if config is None:
                    log.debug("For path {} skipping directive {}".format(self.path, k))
                    continue
                
                log.debug("For path {} run directive {} with config {}".format(self.path, k, config))
                directive(self, config)
                
                if self.__reject__ is not None:
                    break
        except Exception as e:
            log.error("Error in process_directives(): {}".format(e))
            self.reject(e)

        if self.__reject__ is not None:
            raise Exception("Reject has occured: {}".format(self.__reject__))
        
        return self.__resolve__
    
    def proceed(self, input=None):
        log.debug("Execute Draft {} with input: {}".format(self.path, input))

        if input:
            self.set_input(input)

        for k,v in self.router.__directives__.items():
            log.debug("{}: {}".format(k, len(v)))
            for n,d in v.items():
                log.debug("  {}: {}".format(n, repr(d)))
            
        directives			= self.router.__directives__['runtime']
        # log.debug("Processing runtime directives: {}", directives.keys())
        response			= self.process_directives( directives )
        
        directives			= self.router.__directives__['after']
        # log.debug("Processing after directives: {}", directives.keys())
        self.process_directives( directives )

        return response
