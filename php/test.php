<?php

require __DIR__ . '/idiorm/idiorm.php';
require __DIR__ . '/chaosrouter.php';

ORM::configure('sqlite:../testing.sqlite');
// ORM::configure('return_result_sets', true);

$chaosrouter	= chaosrouter('../routes.json', [
    "db"	=> true,
    "query"	=> function($db) {
        $q		= ORM::for_table($this->table);
        
        foreach($this->columns as $c)
            $q->select($c[0], $c[1]);

        if (!is_null($this->where))
            $q->where_raw( populater($this->where, $this->args) );
        
        foreach($this->joins as $j) {
            array_splice($j[1], 1, 0, ['=']);
            $q->join($j[0], $j[1]);
        }

        return $q->find_array();
    }
]);

$endpoint		= $chaosrouter->route('/get/people');
$data			= $endpoint->execute();
// echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
assert(count((array) $data) === 80);

function hello_world() {
    return (object)[ "name" => "Matthew Brisebois" ];
}

class ParentClass {
    function heythere() {
        return (object)[ "name" => "Travis Mottershead" ];
    }
}

$endpoint		= $chaosrouter->route('/get/test_method');
$data			= $endpoint->execute();
// echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
assert(isset($data->name) && $data->name === "Matthew Brisebois");

$endpoint		= $chaosrouter->route('/get/parent_class_test');
$data			= $endpoint->execute();
// echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
assert(isset($data->name) && $data->name === "Travis Mottershead");

$endpoint		= $chaosrouter->route('/get/responses/static');
$data			= $endpoint->execute();
// echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
assert(isset($data->message) && $data->message === "this is inline static data");

$endpoint		= $chaosrouter->route('/get/responses/file');
$data			= $endpoint->execute();
// echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
assert(isset($data->message) && $data->message === "this is a static file response");

class TestValidationClass {
    function required_not_empty($params) {
        foreach ($params as $i => $param) {
            if (empty($param))
                return sprintf("Parameter #%s cannot be empty", $i);
        }
        return true;
    }
}

function required_not_empty($params) {
    foreach ($params as $param) {
        if (empty($param))
            return "";
    }
    return true;
}
function fail_false($params) {
    return false;
}
function fail_message($params) {
    return "Failed with message";
}
function fail_error($params) {
    return [
        "error"		=> "Fail Error",
        "message"	=> "Failed as an error"
    ];
}

$endpoint		= $chaosrouter->route('/get/test_validate/8');
$data			= $endpoint->execute();
// echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
assert(isset($data->id) && $data->id === 8);

$endpoint		= $chaosrouter->route('/get/test_validate/fail_false');
$data			= $endpoint->execute();
// echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
assert(isset($data->message) && $data->message === "Failed validation at rule fail_false with params [hello, world]");

$endpoint		= $chaosrouter->route('/get/test_validate/fail_message');
$data			= $endpoint->execute();
// echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
assert(isset($data->message) && $data->message === "Failed with message");

$endpoint		= $chaosrouter->route('/get/test_validate/fail_error');
$data			= $endpoint->execute();
// echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
assert(isset($data->message) && $data->message === "Failed as an error");

$endpoint		= $chaosrouter->route('/get/test_validate/class_method');
$data			= $endpoint->execute();
// echo json_encode($data, JSON_PRETTY_PRINT) . "\n";
assert(isset($data->message) && $data->message === "Parameter #0 cannot be empty");

?>