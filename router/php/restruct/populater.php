<?php
// Populater

class __callThis__ {
    function __construct($data) {
        foreach ($data as $k => $v) {
            $this->{$k}	= $v;
        }
    }
    function __eval__($__str__) {
        $__value__		= "";
        eval("\$__value__	= ".$__str__.";");
        return $__value__;
    }
}

function __startsWith__($s, $n) {
    return $n === "" || strrpos($s, $n, -strlen($s)) !== FALSE;
}
function __eval__($__str__, $data) {
    $__value__		= "";
    eval("\$__value__	= ".$__str__.";");
    return $__value__;
}
function __convert__($str) {
    $str_matches	= [];
    $str		= trim($str);
    $regex		= "/('.*?(\'*.*)'|\".*?(\\\"*.*)\")/";
    // find all strings (stuff in quotes)
    preg_match_all($regex, $str, $str_matches);
    // replace all strings with %s
    $str		= str_replace('.', '->', preg_replace($regex, '%s', $str));
    // replace all square brackets with php way
    $str		= str_replace('[%s]', '->{%s}', $str);
    array_unshift($str_matches[1], $str);
    // put strings back
    return "\$data->".call_user_func_array('sprintf', $str_matches[1]);
}

function __format__($__str__, $data) {
    $__matches__	= [];
    preg_match_all("/{([^}]+)}/i", $__str__, $__matches__);
    
    for ($i=0; $i < count($__matches__[0]); $i++) {
        $__str__	= str_replace($__matches__[0][$i], __eval__( __convert__($__matches__[1][$i]), $data ), $__str__);
    }
    return $__str__;
}

function populater($str, $data) {
    $data		= json_decode(json_encode($data));
    if (__startsWith__($str, '<')) {
        return __eval__( __convert__(substr($str, 1)), $data );
    }
    else if (__startsWith__($str, ':')) {
        return __format__(substr($str, 1), $data);
    }
    else {
        $str		= __format__($str, $data);
        if (__startsWith__($str, '=')) {
            $str	= (new __callThis__($data))->__eval__(substr($str, 1), $data);
        }
        return $str;
    }
}

?>
