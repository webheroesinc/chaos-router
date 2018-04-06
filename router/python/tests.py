
import logging

from chaosrouter			import ChaosRouter


log					= logging.getLogger('tests')
log.setLevel(logging.DEBUG)

ChaosRouter.loader.module( 'chaosrouter_core' )


def test_draft_object():
    router				= ChaosRouter("../../routes.json")
    Draft				= router.route("/chat/league")

    log.info("Testing Draft.key")
    assert Draft.key			== "league"

    log.info("Testing Draft.vkey")
    assert Draft.vkey			== ":room"
    
    log.info("Testing Draft.id()")
    assert Draft.id()			== "/chat/league"
    
    log.info("Testing Draft.path")
    assert Draft.path			== "/chat/league"
    
    log.info("Testing Draft.raw_path")
    assert Draft.raw_path		== "/chat/:room"
    
    log.info("Testing Draft.segments()")
    segments				= Draft.segments()
    assert type(segments) is list
    assert len(segments)		== 2
    assert segments[1]			== "league"
    
    log.info("Testing Draft.raw_segments()")
    segments				= Draft.raw_segments()
    assert type(segments) is list
    assert len(segments)		== 2
    assert segments[1]			== ":room"
    
    log.info("Testing Draft.params")
    assert type(Draft.params) is dict
    assert len(Draft.params)		== 1
    assert Draft.params.get('room')	== "league"
    
    log.info("Testing Draft.raw")
    assert type(Draft.raw) is dict
    assert len(Draft.raw) == 4
    assert type(Draft.raw.get('__trigger__')) is list
    assert type(Draft.raw.get('__response__')) is dict
    assert type(Draft.raw.get('delete')) is dict
    
    log.info("Testing Draft.config")
    assert type(Draft.config) is dict
    assert Draft.raw == Draft.config
    
    log.info("Testing Draft.directives()")
    directives				= Draft.directives()
    assert type(directives) is dict
    assert len(directives.keys())	== 2
    assert type(directives.get('response')) is dict
    assert type(directives.get('trigger')) is list
    
    log.info("Testing Draft.directive('__notexists__')")
    directive				= Draft.directives('__notexists__')
    assert directive is None
    
    log.info("Testing Draft.parent()")
    parent				= Draft.parent()
    assert type(parent) is ChaosRouter.Draft
    assert parent.id()			== "/chat"
    
    log.info("Testing Draft.parents()")
    parents				= Draft.parents()
    assert type(parents) is list
    assert len(parents)			== 2
    assert parents[0] == parent
    
    log.info("Testing Draft.child('create')")
    child				= Draft.child('delete')
    assert type(child) is ChaosRouter.Draft
    assert child.id()			== "/chat/league/delete"
    
    log.info("Testing Draft.children()")
    children				= Draft.children()
    assert type(children) is list
    assert len(children)		== 2
    
