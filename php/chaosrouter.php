<?php

require __DIR__ . '/restruct/restruct.php';

class __ChaosRouter__ {
    function __construct($data, $opts = null) {
        $opts			= is_null($opts) ? (object)[] : (object)$opts;
        $this->configfile	= null;
        $this->basepath		= $this->get($opts, 'basepath', '/');
        $this->db		= $this->get($opts, 'db');
        $this->query		= $this->get($opts, 'query');

        if ($this->query === null)
            throw new Exception("query option cannot be empty");

        if (is_string($data))
            $this->configfile	= $data;
        else if (is_object($data) || is_array($data))
            $this->config	= json_decode(json_encode($data));
        else
            throw new Exception("Unrecognized data type: " . gettype($data));
    }
    function startsWith($s, $n) {
        return $n === "" || strrpos($s, $n, -strlen($s)) !== FALSE;
    }
    function get($data, $key, $default = null) {
        if (is_array($data))
            return isset($data[$key]) ? $data[$key] : $default;
        else if (is_object($data))
            return isset($data->{$key}) ? $data->{$key} : $default;
        else
            return null;
    }
    function route($path, $data = null, $parents = null) {
        if (is_string($this->configfile))
            $this->config	= json_decode( file_get_contents($this->configfile) );

        $variables		= [];
        if ($data === null || $this->startsWith($path, '/')) {
            $data		= $this->config;
            $parents		= [['', $data]];
            if ($this->startsWith($path, $this->basepath))
                $path		= substr($path, count($this->basepath));
        }

        $_p			= preg_replace('/(^\/|\/$)/', '', $path);
        $segs			= explode('/', $_p);
        if (!$path)
            return new __Endpoint__($this->config, $variables, $parents, $this->query);

        foreach ($segs as $i => $seg) {
            if ($seg === '..') {
                $data		= array_pop($parents)[1];
                continue;
            }

            if (!isset($data->{$seg})) {
                $vkeys		= [];
                $_keys		= array_keys((array)$data);
                foreach ($_keys as $k => $v)
                    if ($this->startsWith(trim($v), ':'))
                        array_push($vkeys, trim($v));
                $vkey		= count($vkeys) > 0 ? array_pop($vkeys) : null;
                $data		= $vkey === null ? null : $data->{$vkey};

                if (is_null($data))
                    return false;

                $variables[substr($vkey, 1)] = $seg;
            }
            else
                $data		= $data->{$seg};
            array_push($parents, [$seg, $data]);
        }
        array_pop($parents);

        if (!isset($data->{'.base'}))
            $config		= $data;
        else {
            $base		= $this->route( $data->{'.base'}, $data, $parents );
            $config		= (object) array_merge( (array) $base->config, (array) $data );
        }
        
        return new __Endpoint__($config, $variables, $parents, $this->query, $this->db);
    }
}
class __Endpoint__ extends __ChaosRouter__ {
    private $methods	= [];
    function __construct($config, $path_vars, $parents, $query, $db = null) {
        $this->parents		= $parents;
        $this->config		= $config;
        $this->db		= $db;
        $this->args		= (object)[
            "path"	=> $path_vars,
            "db"	=> $db
        ];
        
        $this->methods['query']	= Closure::bind($query, $this, get_class());
    }
    function __call($method, $args) {
        
        if (is_callable($this->methods[$method]))
            return call_user_func_array($this->methods[$method], $args);
    }
    function get_structure() {
        if (!isset($this->config->{'.structure'}))
            return false;
        
        $structure		= $this->config->{'.structure'};
        $update			= $this->get($this->config, '.structure_update', null);
        
        if (!is_null($update)) {
            $structure		= (object) array_merge( (array) $structure,
                                                        (array) $update );
        }
        return $structure;
    }
    function set_arguments($args) {
        if (!(is_array($args) || is_object($args)))
            return false;

        $args			= (object) $args;
        $reserved_keys		= ['path', 'db'];
        foreach ($reserved_keys as $reserved)
            if (isset($args->{$reserved}))
                unset($args->{$reserved});
        foreach ($args as $name => $value)
            $this->args->{$name} = $value;
    }
    function validate($validations) {
        if (empty($validations))
            return true;

        foreach ($validations as $params) {
            $_method		= array_shift($params);
            $method		= explode('.', $_method);
            
            foreach ($params as $k => $param) {
                $params[$k]	= populater($param, $this->args);
            }
            
            if (count($method) === 1)
                $valid		= call_user_func($method[0], $params);
            else if (count($method) === 2)
                $valid		= call_user_func($method, $params);
            else
                return (object) [
                    "error"	=> "Invalid Method",
                    "message"	=> "class method does not exist"
                ];
            
            if (is_null($valid))
                return (object) [
                    "error"	=> "Invalid Method",
                    "message"	=> "class method does not exist"
                ];

            if ($valid !== true) {
                return $valid === false ? (object) [
                    "error"	=> "Validation Error",
                    "message"	=> sprintf("Failed validation at rule %s with params [%s]", $_method, implode(', ', $params))
                ] : (
                    is_string($valid) ? (object) [
                        "error"		=> "Validation Error",
                        "message"	=> $valid
                    ] : (object) $valid
                );
            }
        }
        return true;
    }
    function execute($args = null) {
        if (!is_null($args))
            $this->set_arguments($args);

        $this->table		= $this->get($this->config, '.table', null);
        $this->where		= $this->get($this->config, '.where', null);
        $this->joins		= $this->get($this->config, '.join', []);
        $this->columns		= $this->get($this->config, '.columns', []);
        $this->validations	= $this->get($this->config, '.validate', []);

        $validations		= $this->validate($this->validations);
        if( $validations !== true )
            return $validations;

        if (isset($this->config->{'.response'})) {
            $response		= $this->config->{'.response'};
            if (is_string($response)) {
                if (file_exists($response)) {
                    $response	= json_decode(file_get_contents($response));
                    if ($response === false)
                        $response	=  (object) [
                            "error"	=> "Invalid File",
                            "message"	=> "The response file was not valid JSON"
                        ];
                }
                else
                    $response	=  (object) [
                        "error"	=> "Invalid File",
                        "message"	=> "The response file was not found"
                    ];
            }
            return $response;
        }
        else if (isset($this->config->{'.method'})) {
            $method		= explode('.', $this->config->{'.method'});
            if (count($method) === 1)
                return call_user_func($method[0]);
            else if (count($method) === 2)
                return call_user_func($method);
            else
                return (object) [
                    "error"	=> "Invalid Method",
                    "message"	=> "class method does not exist"
                ];
        }
        else {
            $struct		= $this->get_structure();
            $data		= $this->query($this->db);
            return restruct($data, $struct);
        }
    }
}
function chaosrouter($data, $opts = null) {
    return new __ChaosRouter__($data, $opts);
}

// $People	= json_decode( file_get_contents('../people.json') );
// $struct	= json_decode( file_get_contents('./struct.json') );

// function weightClass($w) {
//     return $w >= 200 ? '200+' : '0-199';
// }

// $data	= restruct($People, $struct);
// echo json_encode($data, JSON_PRETTY_PRINT) . "\n";

?>