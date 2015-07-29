from chaosrouter	import ChaosRouter
from WHIutils		import logging, Routing
import simplejson	as json
import sqlite3

log				= logging.getLogger('ChaosRouter Test')
log.setLevel(logging.DEBUG)

def row_factory(cursor, row):
    d = {}
    for idx, col in enumerate(cursor.description):
        d[col[0]]= row[idx]
    return d

conn			= sqlite3.connect( "testing.sql" )
conn.row_factory	= row_factory

cursor			= conn.cursor()

router			= ChaosRouter('./routes.json', cursor=cursor)
endpoint		= router.route('/get/people')
result			= endpoint.execute()
print "tested."
print json.dumps(result, indent=4)
