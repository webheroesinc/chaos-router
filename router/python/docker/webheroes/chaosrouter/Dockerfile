
FROM            webheroes/handler
MAINTAINER      Matthew Brisebois "matthew@webheroes.ca"

RUN             apt-get update #2015-03-23
RUN             apt-get -y install python-pip libmysqlclient-dev
RUN             pip install restruct

COPY            ./chaosrouter  /tmp/chaosrouter
RUN             cd /tmp/chaosrouter; python setup.py install