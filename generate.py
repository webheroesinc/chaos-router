import sqlite3
import random, hashlib, datetime
from faker		import Faker

class Generator(object):
    def __init__(self):

        db_name			= 'testing.sql'
        self.db			= sqlite3.connect(db_name)
        self.curs		= self.db.cursor()
        self.build()

    def build(self):
        self.people(80)
        self.db.commit()

        # Close DB connections
        self.curs.close()
        self.db.close()

    def people(self, count ):
        faker			= Faker()
        peoples			= []
        query			= """
        CREATE TABLE IF NOT EXISTS people (
        person_id		INTEGER PRIMARY KEY AUTOINCREMENT,
        first_name		VARCHAR(100),
        last_name		VARCHAR(100),
        phone_number	        VARCHAR(25),
        personality	        VARCHAR(25) )
        """
        self.curs.execute( query )
        for i in range(0,count):
            columns		= [ "first_name",
                                    "last_name",
                                    "phone_number",
                                    "personality", ]
            peoples.append( (
                faker.first_name(),
                faker.last_name(),
                faker.phonenumber(),
                random.choice( ('lame', 'fun', 'obscure', 'nerd', 'cocky') ),
            ) )
        self.multi_insert( 'people', columns, peoples, count )

    def multi_insert(self, table, columns, data, multiple=1000):
        query		= """
        INSERT INTO `{table}` ( `{columns}` )
        VALUES ( {{values}} )
        """.format( table	= table.strip('`'),
                    columns	= "`, `".join(columns), )
        
        print "Inserting {0} into {1}".format(len(data), table)
        count		= 0
        result		= []
        while len(data) > 0:
            args	= tuple()
            values	= []
            for i in range(multiple):
                if len(data):
                    datum	= data.pop()
                    values.append( ", ".join(["?" for i in range(len(columns))]) )
                    args	= args + datum
                    row		= dict(zip(columns, datum))
                    result.append( row )
                else:
                    break

            count      += len(values)
            tmpquery	= query.format( values	= " ), \n ( ".join(values) )
            try:
                self.curs.execute( tmpquery, args )
            except Exception as e:
                print "Args: {0} Value tuples: {1}".format( len(args), len(values))
                print tmpquery.count('?'), tmpquery.count('( ?, ?, ? )'), len(args)
                print tmpquery
                raise
            finally:
                print "Inserted {0} into {1}".format(count, table)

        return result
        
        
Generator()
