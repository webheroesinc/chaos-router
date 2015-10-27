<?php

require __DIR__ . '/populater.php';

class __restruct__ {
    var $flattenTrigger	= '.array';
    function __construct($data, $struct) {
        $this->result	= (object)[];
        $this->struct	= json_decode(json_encode($struct));
        $this->extend($data, null, $this->result);
        $this->flatten($this->result, $this, 'result');
    }
    function flatten($result, &$parent, $key) {
        $flatten	= isset($result->{$this->flattenTrigger});
        if ($flatten) {
            unset($result->{$this->flattenTrigger});
            if (is_object($parent)) {
                $parent->{$key}	=& array_values( (array) $result );
                $result		=& $parent->{$key};
            }
            else {
                $parent[$key]	=& array_values( (array) $result );
                $result		=& $parent[$key];
            }
        }
        foreach ($result as $k => $d) {
            if (is_object($d) || is_array($d))
                $this->flatten($d, $result, $k);
        }
    }
    function is_numeric_array($arr) {
        if (!is_array($arr))
            return false;
        return array_keys($arr) === range(0, count($arr) - 1);
    }
    function extend($data, $struct, &$result) {
        if ($this->is_numeric_array($data)) {
            return $this->extend_list($data, $struct);
        }

        $struct		= $struct === null ? $this->struct : $struct;

        foreach ($struct as $key => $v) {
            if ($key === $this->flattenTrigger) {
                $result->{$key}	= $v;
                continue;
            }

            $k		= populater($key, $data);
            if (!(is_int($k) || is_string($k)) || $k === '')
                continue;

            if (!isset($result->{$k})) {
                if ($v === true)
                    $result->{$k}	= isset($data->{$k}) ? $data->{$k} : null;
                else if (is_string($v))
                    $result->{$k}	= populater($v, $data);
                else if ($this->is_numeric_array($v)) {
                    if (is_string($v[0]))
                        $result->{$k}	= [ populater($v[0], $data) ];
                    else if (is_object($v[0]) || is_array($v[0])) {
                        $obj		= (object)[];
                        $result->{$k}	= [ $this->extend($data, $v[0], $obj) ];
                    }
                    else
                        $result->{$k}	= [ $v[0] ];
                }
                else if ($v === false)
                    unset($result->{$k});
                else {
                    $obj		= (object)[];
                    $result->{$k}	= $this->extend($data, $v, $obj);
                }
            }
            else {
                if ($this->is_numeric_array($v)) {
                    if (is_string($v[0]))
                        array_push( $result->{$k}, populater($v[0], $data) );
                    else if (is_object($v[0]) || is_array($v[0])) {
                        $obj		= (object)[];
                        array_push( $result->{$k}, $this->extend($data, $v[0], $obj));
                    }
                    else
                        array_push( $result->{$k}, $v[0] );
                }
                else if (is_object($v) && $v !== null) {
                    $this->extend($data, $v, $result->{$k});
                }
            }
        }
        if ($this->is_numeric_array($struct)) {
            return array_values((array)$result);
        }
        else {
            return $result;
        }
    }
    function extend_list($list, $struct) {
        foreach ($list as $data) {
            $this->extend($data, $struct, $this->result);
        }
        return $this->result;
    }
}
function restruct($data, $struct) {
    if (!(is_object($struct) || is_array($struct)))
        return false;
    $obj	= new __restruct__($data, $struct);
    return $obj->result;
}

?>