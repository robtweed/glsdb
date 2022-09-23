# qewd-server

# Dockerised version of QEWD using Redis

# M/Gateway Developments Ltd
# 10 March 2021

FROM ubuntu:20.04

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get -y upgrade
RUN apt-get install -y \
  build-essential \
  libssl-dev \
  dos2unix \
  wget \
  gzip \
  curl \
  locate \
  nano \
  subversion \
  git \
  python

RUN groupadd --gid 1000 node \
  && useradd --uid 1000 --gid node --shell /bin/bash --create-home node

RUN echo "install Node.js"

ENV NODE_VERSION 14.16.1

RUN ARCH= && dpkgArch="$(dpkg --print-architecture)" \
  && case "${dpkgArch##*-}" in \
    amd64) ARCH='x64';; \
    ppc64el) ARCH='ppc64le';; \
    s390x) ARCH='s390x';; \
    arm64) ARCH='arm64';; \
    armhf) ARCH='armv7l';; \
    i386) ARCH='x86';; \
    *) echo "unsupported architecture"; exit 1 ;; \
  esac \
  # gpg keys listed at https://github.com/nodejs/node#release-keys
  && set -ex \
  && for key in \
    4ED778F539E3634C779C87C6D7062848A1AB005C \
    94AE36675C464D64BAFA68DD7434390BDBE9B9C5 \
    1C050899334244A8AF75E53792EF661D867B9DFA \
    71DCFD284A79C3B38668286BC97EC7A07EDE3FC1 \
    8FCCA13FEF1D0C2E91008E09770F7A9A5AE15600 \
    C4F0DFFF4E8C1A8236409D08E73BC641CC11F4C8 \
    C82FA3AE1CBEDC6BE46B9360C43CEC45C17AB93C \
    DD8F2338BAE7501E3DD5AC78C273792F7D83545D \
    A48C2BEE680E841632CD4E44F07496B3EB3C1762 \
    108F52B48DB57BB0CC439B2997B01419BD92F80A \
    B9E2F5981AA6E0CD28160D9FF13993A75599653C \
  ; do \
    gpg --batch --keyserver hkp://p80.pool.sks-keyservers.net:80 --recv-keys "$key" || \
    gpg --batch --keyserver hkp://ipv4.pool.sks-keyservers.net --recv-keys "$key" || \
    gpg --batch --keyserver hkp://pgp.mit.edu:80 --recv-keys "$key" ; \
  done \
  && curl -fsSLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-$ARCH.tar.xz" \
  && curl -fsSLO --compressed "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc" \
  && gpg --batch --decrypt --output SHASUMS256.txt SHASUMS256.txt.asc \
  && grep " node-v$NODE_VERSION-linux-$ARCH.tar.xz\$" SHASUMS256.txt | sha256sum -c - \
  && tar -xJf "node-v$NODE_VERSION-linux-$ARCH.tar.xz" -C /usr/local --strip-components=1 --no-same-owner \
  && rm "node-v$NODE_VERSION-linux-$ARCH.tar.xz" SHASUMS256.txt.asc SHASUMS256.txt \
  && ln -s /usr/local/bin/node /usr/local/bin/nodejs \
  # smoke tests
  && node --version \
  && npm --version

# Install BDB

COPY bdb-18.1.40.tar.gz /opt

RUN cd /opt \
  && tar xvzf bdb-18.1.40.tar.gz \
  && mv db-18.1.40 bdb \
  && rm bdb-18.1.40.tar.gz \
  && mkdir /opt/bdb/docs/bdb-sql \
  && mkdir /opt/bdb/docs/gsg_db_server \
  && cd /opt/bdb/build_unix \
  && ../dist/configure \
  && make \
  && make install

RUN mkdir /opt/qewd \
  && cd /opt/qewd

# Install app dependencies
COPY . /opt/qewd
RUN rm /opt/qewd/bdb-18.1.40.tar.gz

WORKDIR /opt/qewd

RUN cd /opt/qewd
RUN echo "npm install now"
RUN npm install
RUN npm install module-exists piscina qewd-jsdb-piscina

RUN mkdir /opt/qewd/www
RUN mkdir /opt/qewd/www/qewd-monitor

RUN git clone https://github.com/robtweed/qewd-client
RUN cp /opt/qewd/qewd-client/qewd-client.js /opt/qewd/www
RUN rm -r /opt/qewd/qewd-client

RUN git clone https://github.com/robtweed/mg-webComponents
RUN cp /opt/qewd/mg-webComponents/mg-webComponents.js /opt/qewd/www
#RUN rm -r /opt/qewd/mg-webComponents

RUN mkdir /opt/qewd/www/components
RUN mkdir /opt/qewd/www/components/adminui
RUN git clone https://github.com/robtweed/wc-admin-ui /opt/qewd/www/components/adminui

RUN mkdir /opt/qewd/www/components/leaflet
RUN git clone https://github.com/robtweed/wc-leaflet /opt/qewd/www/components/leaflet

RUN mkdir /opt/qewd/www/components/d3
RUN git clone https://github.com/robtweed/wc-d3 /opt/qewd/www/components/d3

RUN mkdir /opt/qewd/www/qewd-monitor-adminui
RUN git clone https://github.com/robtweed/qewd-monitor-adminui /opt/qewd/www/qewd-monitor-adminui

RUN cp /opt/qewd/node_modules/qewd-monitor/www/bundle.js /opt/qewd/www/qewd-monitor
RUN cp /opt/qewd/node_modules/qewd-monitor/www/*.html /opt/qewd/www/qewd-monitor
RUN cp /opt/qewd/node_modules/qewd-monitor/www/*.css /opt/qewd/www/qewd-monitor

RUN cp /opt/qewd/node_modules/ewd-client/lib/proto/ewd-client.js /opt/qewd/www

RUN cd /opt/qewd

EXPOSE 8080

# ENTRYPOINT ["/bin/bash", "-l"]

CMD [ "npm", "start" ]
 