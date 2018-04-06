
import logging
import json

from urllib.parse			import ( quote		as urllib_quote,
                                                 unquote	as urllib_unquote )

log					= logging.getLogger('ChaosRouter')
# log.setLevel(logging.DEBUG)


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
                log.warn("Multiple variable keys were found '{}'.  Using first key '{}'".format(key, vkey))
    return vkey

def get_non_directives(data):
    directives				= {}
    for k,v in data.items():
        if not k.find(ChaosRouter.DIR_PREFIX) == 0:
            directives[k]		= v
    return directives


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


class Loader( object ):

    def module(self, module):
        log.debug("Loading module from path: {}".format(module))
        module				= __import__(module).Module(ChaosRouter)

        if module is not None:
            ChaosRouter.register.module(module)

    def modules(self, *args):
        modules				= []
        for name in modules:
            modules.append( self.module( name ) )
        return modules

    
class Register( object ):

    def module(self, module=None):
        modlib				= ChaosRouter.__modules__
        def wrap(m):
            name			= m.__name__
            log.debug("Registering module {}".format(name))
            modlib[name]		= m
            
            if not hasattr(m, '__directives__') or type(m.__directives__) is not dict:
                m.__directives__	= {}

            return m

        if module is not None:
            wrap(module)
            return
            
        return wrap

    def directive(self, name):
        if ChaosRouter.__modules__.get(name)is None:
            raise Exception("There is no module with the name '{}'".format(name))
        
        dirlib				= ChaosRouter.__modules__[name].__directives__
        def wrap(f):
            dname			= f.__name__
            log.debug("Registering directive {} in module {}".format(dname, name))
            dirlib[dname]		= f
            
            return f
        return wrap
    



class Draft( object ):

    def __init__(self, parent, key=None):
        self.key			= key
        self.vkey			= None
        self.input			= {}
        self.__resolve__		= None
        self.__reject__			= None

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

    def id(self):
        return self.path

    def segments(self):
        return self.path.strip('/').split('/')

    def raw_segments(self):
        return self.raw_path.strip('/').split('/')

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

    def children(self):
        nondirectives			= get_non_directives(self.config)
        log.debug("Getting children for {} found these nondirectives {}".format(self.path, nondirectives))
        return list( map(lambda k: self.child(k), nondirectives) )

    def directives(self, name=None):
        if name:
            return self.directive(name)
        directives			= {}
        directives.update( self.__directives__ )
        return directives

    def directive(self, name, config=None):
        if config:
            self.__directives__[name]	= config
        config				= self.__directives__.get(name)
        return None if config is None else json.loads(json.dumps(config))

    def resolve(self, data):
        self.__resolve__		= data
        
    def reject(self, data):
        self.__reject__			= data

    def set_input(self, data):
        if type(data) is not dict:
            return False
        self.input.update(data)

    def process_directives(self, directives):
        try:
            for k, directive in directives.items():
                config			= self.directive(k)

                log.error("CONFIG FOR {}: {}".format(k, config))
                if config is None:
                    log.debug("For path {} skipping directive {}".format(self.path, k))
                    continue

                if not callable(directive):
                    raise Exception("directive is not callable.  fount type {}".format(type(directive)))
                
                log.error("Directive {}".format(directive))
                log.debug("For path {} run directive {} with config {}".format(self.path, k, config))
                directive(self, config)
                
                if self.__reject__ is not None:
                    break
        except Exception as e:
            log.exception("Error in process_directives(): {}".format(e))
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
        log.debug("Processing runtime directives: {}".format( directives.keys() ))
        response			= self.process_directives( directives )
        
        directives			= self.router.__directives__['after']
        log.debug("Processing after directives: {}".format( directives.keys() ))
        self.process_directives( directives )

        return response

    
class ChaosRouter( object ):

    DIR_PREFIX				= "__"
    DIR_SUFFIX				= "__"
    ENABLE_ALL				= 0
    ENABLE_SELECTION			= 1
    ENABLE_EXCLUSION			= 2
    DISABLE_SELECTION			= 3
    loader				= Loader()
    register				= Register()
    __modules__				= {}
    Draft				= Draft

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

    def modules(self, *args):
        for config in args:
            if type(config) is str:
                log.debug("Load modules string {}".format(config))
                self.module(config, ChaosRouter.ENABLE_ALL)
            elif type(config) is dict:
                log.debug("Load modules object {}".format(config))
                for name,directives in config.items():
                    split		= name.split(' ')
                    if len(split) == 2:
                        name		= split[0]
                        cmd		= split[1]
                        if cmd == "^":
                            self.module(name, { "exclude": directives })
                        elif cmd == "!":
                            self.module(name, { "disable": directives })
                        else:
                            log.error("Unknown command '{}' in module loading".format(cmd))
                    elif directives is True:
                        self.module(name, ChaosRouter.ENABLE_ALL)
                    elif type(directives) is list:
                        self.module(name, { "enable": directives })
                    else:
                        log.error("Unexpected type for directive list '{}'".format(type(directives)))
            else:
                log.error("Failed to load module because of unexpected argument type {}".format(type(config)))

    def module(self, name, config, modules=None):
        if type(config) is int:
            log.debug("Converting config number {} to config object".format(config))
            
            if config == ChaosRouter.ENABLE_ALL:
                return self.module(name, {"enable": True})
            elif config == ChaosRouter.ENABLE_SECLECTION:
                return self.module(name, {"enable": modules})
            elif config == ChaosRouter.ENABLE_EXCLUSION:
                return self.module(name, {"exclude": modules})
            elif config == ChaosRouter.DISABLE_SELECTION:
                return self.module(name, {"disable": modules})
            else:
                log.error("Unknown config number in Module load '{}'.  Supported values are ENABLE_ALL, ENABLE_SELECTION, ENABLE_EXCLUSION, DISABLE_SELECTION".format(config))
                return
        module				= ChaosRouter.__modules__.get(name)

        if module is None:
            raise Exception("Module '{}' has not bee loaded".format(name))

        directives			= module.__directives__

        if config is True:
            config			= {"enable": True}

        if type(config) is dict:
            log.debug("Load module '{}' with config {}".format(name, config))
            enable			= config.get('enable')
            exclude			= config.get('exclude')
            disable			= config.get('disable')
            if enable is True:
                for name,v in directives.items():
                    self.directive(name, v)
            elif type(enable) is list:
                for name in enable:
                    self.directive(name, directives.get(name))
                    # Doesn't check if the directive name actually existed
            elif type(exclude) is list:
                for name in exclude:
                    self.directive(name, directives.get(name))
                    # Doesn't check if the directive name actually existed
            elif type(exclude) is list:
                for name in disable:
                    self.directive(name, directives.get(name))
                    # Doesn't check if the directive name actually existed
            else:
                log.error("Configuration does not contain any valid commands (eg. enable, exclude, disable): {}".format(config))

        elif config is None:
            log.error("Unexpected configuration type in module load '{}'".format( type(config) ))
            
        return module

    def directive(self, name=None, fns=None):
        dirs				= self.__directives__
        
        if name is None and fns is None:
            def wrap(f):
                name			= f.__name__
                log.debug("Registering runtime method {}: {}".format(name, repr(f)))
                dirs['runtime'][name]	= f
                
                return f
            return wrap

        isclass				= any(k in ['before', 'runtime', 'after'] for k in dir(fns))
        log.debug("Directive is class: {}".format(isclass))
        if isclass:
            if hasattr(fns, 'before'):
                dirs['before'][name]	= fns.before
            if hasattr(fns, 'runtime'):
                dirs['runtime'][name]	= fns.runtime
            if hasattr(fns, 'after'):
                dirs['after'][name]	= fns.after
        else:
            log.debug("Registering runtime method {}: {}".format(name, repr(fns)))
            dirs['runtime'][name]	= fns
                
    def route(self, path):
        return self.root().route(path)

    def root(self):
        if self.configfile:
            self.config			= load_config_file( self.configfile )
            self.__root__.config	= self.config
        return self.__root__
