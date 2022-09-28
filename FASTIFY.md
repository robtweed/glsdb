# Using *glsdb* With Fastify

## Background

[Fastify](https://www.npmjs.com/package/fastify) is a modern, high-performance web framework for Node.js.  In recent years it has pretty much become the *go-to* Web Server module to use with Node.js.

*glsdb* can be easily integrated with Fastify to allow you to create, for example, a REST-based back-end where the handlers for the REST API routes you define make use of persistent data held and maintained in any of the Global Storage databases supported by *glsdb*, eg:

- YottaDB
- IRIS
- Cache
- Berkeley DB
- LMDB

The *glsdb* APIs are synchronous by design, which means they cannot be used directly within the main thread of execution of Fastify.  Instead, *glsdb* can make use of the *QOper8* family of modules: these manage and maintain a pool of Workers (either Child Processes or Worker Threads), and dispatch requests from a queue to be handled in a Worker.  

A key feature of the *QOper8* design is that a Worker only handles a single request, in isolation, at a time, meaning that the usual Node.js concurrency issues do not apply in a Worker.  

Meanwhile, by offloading the handling of incoming requests to QOper8 Workers, the main Fastify thread of execution is not blocked by the handling of requests: incoming requests are asynchronously queued and dispatched, and their responses from the assigned Worker awaited asynchronously.

The [*qoper8-fastify*](https://github.com/robtweed/qoper8-fastify) module is a Fastify Plug-in for the *QOper8* modules, and *glsdb* includes a Worker Startup module for *QOper8* that you plug into *qoper8-fastify* so that *glsdb* is enabled whenever a QOper8 Worker is started, and is automatically available to all of your REST API Route handlers.

This Tutorial will take you through the steps needed to integrate *glsdb* and your Global Storage database with Fastify.


## Installing

Simply install *qoper8-fastify*:

        npm install qoper8-fastify

The following will also be installed as dependencies (unless you've already installed them):

- fastify
- fastify-plugin
- qoper8-wt
- qoper8-cp


## Which *QOper8* Module to Use?

There are two different versions of the *QOper8* module:

- [*QOper8-wt*](https://github.com/robtweed/qoper8-wt): Manages and Maintains a Pool of Node.js Worker Threads
- [*QOper8-cp*](https://github.com/robtweed/qoper8-wt): Manages and Maintains a Pool of Node.js Child Processes

So how do you decide which to use.

In general, the Worker Thread version is preferable, as it provides better throughput performance (nearly twice the speed of Child Processes in tests we've done).

However, care needs to be taken when using it with an in-process API connection to YottaDB, IRIS or Cache.  If you're using an API connection for these databases, we recommend the use of Child Processes, since these databases are not thread-safe.  

So in summary:

- network connection to any supported database: Use Worker Threads
- API connection to YottaDB, IRIS or Cache: Use Child Processes
- API connection to Berkeley DB or LMDB: You should be able to use Worker Threads


## Main Fastify Script

Here's an example of a script that starts Fastify and integrates *QOper8* and *glsdb*.  In this example I want to use a pool of 2 Child Processes for handling requests, and Fastify will be listening on port 3000.


        import Fastify from 'fastify';
        import QOper8 from 'qoper8-fastify';
        import config from './configure.mjs';
        import routes from './routes.mjs';

        const fastify = Fastify({
          logger: true
        });

        const options = {
          mode: 'child_process',
          poolSize: 2,
          //logging: true
        }

        fastify.register(QOper8, options);
        fastify.register(config);
        fastify.register(routes);

        await fastify.listen({ port: 3000, host: '0.0.0.0' }, function (err, address) {
          if (err) {
            fastify.log.error(err)
            process.exit(1)
          }
        })


As you can see, we need to create two other module files which will also be Fastify Plug-ins:

- configure.mjs: This is used to configure how *glsdb* will connect to the database within a Worker
- routes.mjs: This defines our REST API routes and how they will be handled


## configure.mjs

This should be a Fastify Plugin, structured as follows:

        import fastifyPlugin from 'fastify-plugin';

        function configure (fastify, opts, done) {
          fastify.qoper8.setOnStartupModule({
            module: 'glsdb/qoper8-fastify',
            arguments: {
              // database connection parameters
            }
          });

          done();
        }

        export default fastifyPlugin(configure);


You can see that it loads the *glsdb/qoper8-fastify* module which looks after the connection to your selected Global Storage database.

The worked example below shows a number of commented-out variations for the *configure* function, showing how to use it for API and network connections to YottaDB and IRIS. :


        export default fastifyPlugin(configure);


        import fastifyPlugin from 'fastify-plugin';

        function configure (fastify, opts, done) {

          // YottaDB API Connection

          fastify.qoper8.setOnStartupModule({
            module: 'glsdb/qoper8-fastify',
            arguments: {
              type: 'yottadb',
              options: {
                connection: 'api',
                path: '/usr/local/lib/yottadb/r134/',
                env: {
                  ydb_dir: '/opt/yottadb',
                  ydb_gbldir: '/opt/yottadb/yottadb.gld',
                  ydb_routines: '/opt/fastify-qoper8/m /usr/local/lib/yottadb/r134/libyottadbutil.so',
                  ydb_ci: '/usr/local/lib/yottadb/r134/zmgsi.ci'
                }
              }
            }
          });

        /*

          // YottaDB Network Connection

          fastify.qoper8.setOnStartupModule({
            module: 'glsdb/qoper8-fastify',
            arguments: {
              type: 'yottadb',
              options: {
                connection: 'network',
                host: 'localhost',
                tcp_port: 7041
              }
            }
          });

        */


        /*

          // IRIS API Connection

          fastify.qoper8.setOnStartupModule({
            module: 'glsdb/qoper8-fastify',
            arguments: {
              type: 'iris',
              options: {
                path: '/usr/irissys/mgr',
                username: "_SYSTEM",
                password: "SYS",
                namespace: "USER"
              }
            }
          });

        */

        /*

          // IRIS Network Connection

          fastify.qoper8.setOnStartupModule({
            module: 'glsdb/qoper8-fastify',
            arguments: {
              type: 'iris',
              options: {
                host: '172.17.0.2',
                tcp_port: 7042,
                username: "_SYSTEM",
                password: "SYS",
                namespace: "USER"
              }
            }
          });

        */

          done();
        }

        export default fastifyPlugin(configure);


After connecting to the database, the *qoper8-fastify* module augments the *this* context within the QOper8 Worker environment with *glsdb*, ie it adds *this.glsdb*.  Your handler modules can then use this to invoke the appropriate *glsdb* APIs.


## routes.mjs

The *routes.mjs* module file follows the standard Fastify convention for defining Routes, but for each one that you want handled in a *QOper8* Worker, you replace the handler logic with a call to *fastify.setHandler()*, eg:



        async function routes (fastify, options, done) {

          fastify.get('/helloworld', async (request, reply) => {
            fastify.setHandler('./handlers/getHelloWorld.mjs', request);
            return true;
          })

          fastify.setNotFoundHandler((request, reply) => {
            reply.code(404).type('application/json').send("{error: 'Not Found'}")
          })

          done();

        }

        export default routes;


So in the example above, any incoming *GET /helloworld* HTTP requests will be handled in a QOPer8 Worker by a module defined in the file with the path *./handlers/getHelloWorld.mjs*

Just add all the routes you want to handle using the same syntax as above.


## Worker Handler Modules

In the example above, we have a single Worker Handler module to define: *getHelloWorld.mjs*

All your Worker Handler Modules must have the same basic structure:

        let handler = function(messageObj, finished) {
          // handle the incoming message object

          // when finished:

          finished({
            // your response object payload
          });
        };
        export {handler};


Your handler logic can access the *glsdb* APIs via *this.glsdb*, for example, here we're returning the record for Person 1 in our database:


        let handler = function(messageObj, finished) {
          let person = new this.glsdb.node('Person.1');
          finished({
            person: person.document
          });
        };
        export {handler};


Note that you can use any and all the APIs available in *glsdb*, depending on your database, within your handlers ie:

- the basic *glsdb* APIs
- the Proxied *glsdb* APIs
- the IRIS/Cache-specific Proxied APIs


The incoming message object (*messageObj) is a repackaged version of the incoming Fastify request object, with the following structure:

        {
          "data": {
            "method": "GET",
            "query": {},
            "params": {},
            "headers": {
              "host": "127.0.0.1:3000",
              "user-agent": "curl/7.74.0",
              "accept": "*/*"
            },
            "ip": "127.0.0.1",
            "hostname": "127.0.0.1:3000",
            "protocol": "http",
            "url": "/helloworld",
        }

Incoming POST requests will also have a *body* property containing its pre-parsed JSON content;


## Starting/Running

Simply invoke your main script file, eg:

        node run.mjs


Try it out:

        curl http://127.0.0.1:3000/helloworld

