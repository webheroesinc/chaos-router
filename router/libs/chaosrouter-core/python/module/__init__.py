
#
# Chaosrouter: Core -- Core suite of basic useful directives
#
# Copyright (c) 2018, Web Heroes Inc.
#
# Chaosrouter is free software: you can redistribute it and/or modify it under the terms of the GNU
# General Public License as published by the Free Software Foundation, either version 3 of the
# License, or (at your option) any later version.  See the LICENSE file at the top of the source
# tree.
#
# Chaosrouter is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
# even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# General Public License for more details.
#

__author__                      = "Matthew Brisebois"
__email__                       = "matthew@webheroes.ca"
__copyright__                   = "Copyright (c) 2018 Web Heroes Inc."
__license__                     = "Dual License: GPLv3 (or later) and Commercial (see LICENSE)"

__all__				= ["Module"]


import os, sys
import logging

scriptname			= os.path.splitext( os.path.basename( sys.argv[0] ) )[0]
logging.basicConfig(
    filename			= '{0}.log'.format(scriptname),
    level			= logging.ERROR,
    datefmt			= '%Y-%m-%d %H:%M:%S',
    format			= '%(asctime)s.%(msecs).03d [ %(threadName)10.10s ] %(name)-15.15s : %(funcName)-15.15s %(levelname)-8.8s %(message)s',
)

from .chaosrouter_core		import Module
