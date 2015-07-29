
from ReStruct		import restruct
from WHIutils		import logging

import simplejson	as json

log				= logging.getLogger('ChaosRouter')
log.setLevel(logging.DEBUG)

class ValidationLib(object):
    def is_digit(self, value, **kwargs):
        return value.isdigit()

    def is_number(self, value, **kwargs):
        try:
            float(value)
            return True
        except:
            return False

    def not_empty(self, value, **kwargs):
        return not not value

validationlib		= ValidationLib()

class MethodLib(object):
    pass
methodlib		= MethodLib()

class ChaosRouter(object):

    def __init__(self, data, basepath="/", cursor=None):
        self.configfile		= None
        self.cursor		= cursor
        self.basepath		= basepath
        if type(data) is dict:
            self.config		= data
        elif type(data) in (str,unicode):
            self.configfile	= data
        else:
            raise Exception("Unrecognized data type: {0}".format(type(data)))

    def set_cursor(self, cursor):
        self.cursor		= cursor

    def extend_methods(self, obj):
        if type(obj) is type:
            obj			= obj()
        methods			= [x for x in dir(obj) if not x.startswith('__')]
        for method in methods:
            setattr(methodlib, method, getattr(obj, method))

    def extend_validation(self, obj):
        if type(obj) is type:
            obj			= obj()
        methods			= [x for x in dir(obj) if not x.startswith('__')]
        for method in methods:
            setattr(validationlib, method, getattr(obj, method))

    def route(self, path, data=None, parents=None):
        if self.configfile is not None:
            with open(self.configfile) as f:
                self.config		= json.loads(f.read())
            
        log.info("Routing: %s", path)
        variables		= {}
        
        if data is None or path.startswith('/'):
            data		= self.config
            parents		= [('', data)]
            if path.startswith(self.basepath):
                path		= path[len(self.basepath):]
            
        segs			= path.strip('/').split('/')

        if not path:
            return Endpoint(self.config, variables, parents, self.cursor)

        log.debug("Path segments: %s", segs)
        for seg in segs:
            if seg == "..":
                data		= parents.pop()[1]
                continue
            
            if data.get(seg) is None:
                vkeys		= [v.strip() for v in data.keys() if v.strip().startswith(':')]
                vkey		= vkeys.pop() if len(vkeys) > 0 else None
                data		= None if vkey is None else data.get(vkey)
                
                if data is None:
                    log.warn("Endpoint %s does not exist.  Found None at %s" % (path, '/'.join(zip(*parents)[0])))
                    return False
                
                variables[vkey[1:]]	= seg
            else:
                data		= data.get(seg)
            parents.append((seg,data))
        parents.pop()
            
        # log.debug("Endpoint config: %s", json.dumps(data, indent=4))
        if data.get('.base') is None:
            config		= data.copy()
        else:
            base		= self.route( data.get('.base'), data, parents )
            config		= base.config.copy()
            config.update(data)
            
        return Endpoint(config, variables, parents, self.cursor)


def fill(s, data):
    v		= s.format(**data)
    if s.startswith(':'):
        try:
            v	= eval(v[1:])
        except Exception as e:
            v	= None
    return v

class Endpoint(dict):
        
    def __init__(self, config, path_vars, parents, cursor=None):
        self.parents		= parents
        self.config		= config
        self.args		= {
            "path": path_vars,
        }
        self.cursor		= cursor

    def set_arguments(self, **kwargs):
        for reserved in ('cursor','value','path'):
            if reserved in kwargs:
                del kwargs[reserved]
        self.args.update(kwargs)
        
    def validate(self, validations):
        for rule in validations:
            if type(rule) is not list or len(rule) == 0:
                raise Exception("Failed to process rule: {0}".format(rule))
            command	= rule[0]
            params	= []
            for param in rule[1:]:
                try:
                    value	= fill(param, self.args)
                except Exception as e:
                    value	= None
                params.append(value)
            cmd			= getattr(validationlib, command, None)
            if cmd is None:
                raise Exception("No validation method for rule {0}".format(rule))
            check		= cmd(*params, cursor=self.cursor, **self.args)

            if type(check) is dict:
                return check
            if check is not True:
                message		= "Failed at rule {0} with values {1}".format(rule, params)
                return {
                    "error": "Failed Validation",
                    "message": check if type(check) is str else message,
                }
        return True
        
    def execute(self):
        validations		= self.config.get('.validate')
        if validations is not None:
            score		= self.validate(validations)
            if score is not True:
                return score

        method			= self.config.get('.method')
        if method is not None:
            cmd		= getattr(methodlib, method, None)
            if cmd is None:
                raise Exception("No method named {0}".format(method))
            else:
                return cmd(cursor=self.cursor, **self.args)

        structure		= self.get_structure()
        if structure is False:
            return {
                "error": "Dead End",
                "message": "Nothing configured for this endpoint",
            }
            
        query			= self.query()
        self.cursor.execute(query)

        if structure is None:
            result		= self.cursor.fetchall()
        else:
            result		= restruct(self.cursor.fetchall(), structure)
        return result

    def get_structure(self):
        structure		= self.config.get('.structure')
        if structure is None:
            return False
        
        structure		= structure.copy()
        update			= self.config.get('.structure_update')
        if update is not None:
            structure.update( update )
            for k,v in structure.items():
                if v is False:
                    del structure[k]
                    
        # log.debug("Structure: %s", json.dumps(structure, indent=4))
        return structure

    def query(self):
        self.table		= self.config.get('.table')
        self.where		= self.config.get('.where')
        self.joins		= self.config.get('.join')
        
        log.debug("Table: %s", self.table)
        log.debug("Where: %s", self.where)
        log.debug("Joins: %s", self.joins)

        if self.joins is None:
            joins		= ''
        else:
            joins		= []
            for join in self.joins:
                t		= join[0]
                c1		= "`{0}`.`{1}`".format( *join[1] )
                c2		= "`{0}`.`{1}`".format( *join[2] )
                joins.append("""%-25s ON %-50s = %s""" % (t,c1,c2))
            joins		= """
   LEFT JOIN """+"""
   LEFT JOIN """.join(joins)
            
        if self.where is None:
            where		= ''
        else:
            where		= """
  WHERE {0}""".format(self.where)
        query			= """
 SELECT *
   FROM {table}{join}{where}
        """.format(table=self.table, join=joins, where=where)
        
        query			= query.format(**self.args)
        log.debug("Query: %s", query)
        return query
