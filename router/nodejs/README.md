<div id="table-of-contents">
<h2>Table of Contents</h2>
<div id="text-table-of-contents">
<ul>
<li><a href="#sec-1">1. ChaosRouter Documentation</a>
<ul>
<li><a href="#sec-1-1">1.1. Install</a></li>
<li><a href="#sec-1-2">1.2. Initializing</a></li>
<li><a href="#sec-1-3">1.3. Loading Modules</a></li>
<li><a href="#sec-1-4">1.4. Enable Directives</a></li>
<li><a href="#sec-1-5">1.5. Calling Module Methods</a></li>
<li><a href="#sec-1-6">1.6. Usage</a>
<ul>
<li><a href="#sec-1-6-1">1.6.1. Draft Node</a></li>
</ul>
</li>
<li><a href="#sec-1-7">1.7. Creating a Directive</a></li>
<li><a href="#sec-1-8">1.8. Creating a Module</a></li>
</ul>
</li>
</ul>
</div>
</div>

# ChaosRouter Documentation<a id="sec-1" name="sec-1"></a>

![img](//img.shields.io/travis/webheroesinc/chaos-router/master.svg)
![img](//img.shields.io/npm/v/chaosrouter.svg)
![img](//img.shields.io/github/tag/webheroesinc/chaos-router.svg)
![img](//img.shields.io/maintenance/yes/2017.svg)

## Install<a id="sec-1-1" name="sec-1-1"></a>

    npm install chaosrouter --save

## Initializing<a id="sec-1-2" name="sec-1-2"></a>

By initializing with a file path instead of an object, ChaosRouter can reload the config file
file whenever there is a change.  Using an object would require restarting the server everytime
it changed.

    var chaosrouter      = require('chaosrouter');
    
    var router           = chaosrouter({
        "api": {
            "helloworld": {
                "__response__": "Hello World!"
            }
        }
    });
    
    // Load JSON from a file
    var router           = chaosrouter('./routes.json');

## Loading Modules<a id="sec-1-3" name="sec-1-3"></a>

    var chaosrouter      = require('chaosrouter');
    
    // Load several modules
    chaosrouter.modules('module1', 'module2', ...);
    
    // Load one at a time
    chaosrouter.module('module1');
    chaosrouter.module('module2');
    chaosrouter.module(...);

## Enable Directives<a id="sec-1-4" name="sec-1-4"></a>

Directives are not enabled automatically, for good reason.  Let's say you have 2 modules you like
but they both have a directive with the same name.  If they loaded automatically, one would
overwrite the other.  In order to prevent this overwrite, you would have to know every directive
that every module is loading.  You would have to manually disable the one in the module you don't
want, and enable the one in the module you do want.  To be safe all the time, directives have to
be enabled on a per module basis.

    // Enable all directives
    router.module('module1', router.ENABLE_ALL);
    
    // Enable all directives
    router.modules('module1');
    router.modules({
        'module1': true,
    });
    router.module('module1', router.ENABLE_ALL);
    router.module('module1', true);
    
    
    // Enable specific directives
    router.modules({
        'module1': ['directive1', 'directive2', ...],
    });
    router.module('module1', {
        enable: ['directive1', 'directive2', ...],
    });
    router.module('module1', router.ENABLE_SELECTION, ['directive1', 'directive2', ...]);
    
    
    // Enable all excluding specific directives
    router.modules({
        'module1 ^': ['directive1', 'directive2', ...],
    });
    router.module('module1', {
        exclude: ['directive1', 'directive2', ...],
    });
    router.module('module1', router.ENABLE_EXCLUSION, ['directive1', 'directive2', ...]);
    
    
    // Disable specific directives
    router.modules({
        'module1 !': ['directive1', 'directive2', ...],
    });
    router.module('module1', {
        disable: ['directive1', 'directive2', ...],
    });
    router.module('module1', router.DISABLE_SELECTION, ['directive1', 'directive2', ...]);

## Calling Module Methods<a id="sec-1-5" name="sec-1-5"></a>

    var module1          = router.module('module1');
    
    module1.run_some_method_on_the_module();

## Usage<a id="sec-1-6" name="sec-1-6"></a>

Here is a simple example of using ChaosRouter to return simple, static text for an endpoint.  We
will break down what is happening:

1.  Loading 'chaosrouter'
2.  Initializing chaosrouter with the map of endpoints
3.  Defining the `__response__` directive
4.  Route a path and get the endpoint Draft object
5.  Run the Draft and log the returned result

Instead of defining your own directives, you can load the 'chaosrouter-base' module and use our
standard directive implementations.  See Loading Modules (See section ) section and the ChaosRouter Libs (See section )
Documentation.

    var chaosrouter      = require('chaosrouter');
    
    var router = chaosrouter({
        "api": {
            "helloworld": {
                "__response__": "Hello World!"
            }
        }
    });
    
    router.directive('response', function(text, _, resolve) {
        resolve(text);
    });
    
    // Get the Draft Node for route path /api/helloworld
    var draft            = router.route('/api/helloworld');
    
    # draft.run().then(...
    # draft.execute().then(...
    # draft.make().then(...
    # draft.create().then(...
    # draft.go().then(...
    # draft.complete().then(...
    # draft.finish().then(...
    # draft.then(...
    
    draft.proceed().then(function(data) {
        console.log(data); // == "Hello World!"
    });

### Draft Node<a id="sec-1-6-1" name="sec-1-6-1"></a>

This Object represents a specific point in the routes configuration.  A Draft Node contains all
the directive instructions for that configuration point.

    var chaosrouter     = require('chaosrouter');
    
    var router = chaosrouter({
        "user": {
            "__pre__": true,
            "__response__": { "1": "Robin Williams" },
            ":id": {
                "__response__": {
                    "id": "< path.id",
                    "name": "Robin Williams",
                    "wikipedia": "https://en.wikipedia.org/wiki/Robin_Williams"
                }
            }
        }
    });
    
    var draft           = router.route('/user');
    
    draft.ready(function() {
        draft.id();                     // /users
        draft.path;                     // /users
        draft.raw_path;                 // /users
        draft.segments()                // [ 'users' ]
        draft.raw_segments()            // [ 'users' ]
        draft.params;                   // {}
        draft.raw                       // { "__pre__": true, "__response__": { ... }, ":id": { ... } }
        draft.router;                   // Router Object
    
        draft.directives();             // { "pre": true, "response": { "1": "Robin Williams" } }
        draft.directive('response');    // { "1": "Robin Williams" }
        draft.directive('post');        // null
        draft.parent();                 // router.route('/')
        draft.parents();                // [ router.route('/') ]
        draft.children();               // [ ':id' ]
        draft.child('1');               // router.route('/user/1')
    });
    
    
    var draft           = router.route('/user/1');
    
    draft.ready(function() {
        draft.id();                     // /users/1
        draft.path;                     // /users/1
        draft.raw_path;                 // /users/:id
        draft.segments()                // [ 'users', '1' ]
        draft.raw_segments()            // [ 'users', ':id' ]
        draft.params;                   // { "id": "1" }
        draft.raw                       // { "__response__": { "id": "< path.id", "name": "Robin Williams", ... } }
        draft.router;                   // Router Object
    
        draft.directives();             // { "response": { "id": "< path.id", "name": "Robin Williams", ... } }
        draft.parent();                 // router.route('/user')
        draft.parents();                // [ router.route('/user'), router.route('/') ]
        draft.children();               // []
        draft.child('anything');        // null
    });
    
    // Relative routing
    var draft           = draft.route('../2');

## Creating a Directive<a id="sec-1-7" name="sec-1-7"></a>

Directives are power behind ChaosRouter!  There is virtually no limit to what you can make a
directive do.  Within a directive, there is access to all router resources and configurations.
With that access you can program directives to do just about anything, even dynamically configure
other directives.

    var chaosrouter      = require('chaosrouter');
    var router           = chaosrouter(<config>);
    
    router.directive(<key / name>, function(config) {
        // 'this' is the Draft node
        // 'config' is the value from this directive in the current Draft
        // ... do things based on config
    
        // this.next()                   to move onto the next directive
        // return this.resolve(...)      to end here with result [...]
        // return this.reject(...)       to end here with error [...]
    });

## Creating a Module<a id="sec-1-8" name="sec-1-8"></a>

A module is simply an object with the name of the module, and a dictionary of directive names and
functions.  The module name is the unique name that will be used to reference the module after it
is loaded.  When ChaosRouter loads a module, it will call the export function passing itself as
the first argument.  It is important to have access to the ChoasRouter module to have full
control.  For instance, a module could load several other modules, or use the 'restuct-data' and
'populater' modules that are loaded in the ChaosRouter module.

    module.exports = function(chaosrouter) {
        return {
            "__name__": <module ID>,
            "__init__": function() {
                ...
            },
            "__enable__": function(method) {
                ...
            },
            "__disable__": function(method) {
                ...
            },
            "__directives__": {
                <directive name>: function(<config>) {
                    ...
                },
                <directive name>: {
                    "__before__": function(<config>) {
                        ...
                    },
                    "__runtime__": function(<config>) {
                        ...
                    },
                    "__after__": function(<config>) {
                        ...
                    },
                },
                ...
            },
            <key1>: <value1>,
            <key2>: function() {
                return <value2>;
            },
            ...
        };
    };

You can access anything inside the module using

    var module           = router.module(<module ID>);
    module.<key1>;       // <value1>
    module.<key2>();     // <value2>