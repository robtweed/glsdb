# glsdb: Global Storage Database Abstraction for Node.js
 
Rob Tweed <rtweed@mgateway.com>  
12 September 2022, M/Gateway Developments Ltd [http://www.mgateway.com](http://www.mgateway.com)  

Twitter: @rtweed

Google Group for discussions, support, advice etc: [http://groups.google.co.uk/group/enterprise-web-developer-community](http://groups.google.co.uk/group/enterprise-web-developer-community)


## Background

*glsdb* is a Node.js/JavaScript abstraction of [Global Storage Databases](https://github.com/robtweed/global_storage).
With *glsdb*, a Global Storage Database is abstracted as JavaScript Objects that represent database nodes and provide properties and methods for accessing and navigating between database nodes.

*glsdb* relies on the [*mg-dbx*](https://github.com/chrisemunt/mg-dbx) interfaces which provide access to the following Global Storage databases:

- the Open Source [YottaDB](https://yottadb.com) database
- the InterSystems [IRIS Data Platform](https://www.intersystems.com/data-platform/)

When using IRIS, *glsdb* further abstracts IRIS's Persistent Objects via a JavaScript proxy object, giving the appearance that you have direct, seamless access to IRIS objects (ie within the IRIS database) from corresponding JavaScript Objects.


*glsdb* can also be used with the [*mg-dbx-bdb*](https://github.com/chrisemunt/mg-dbx) interface,
 which creates a Global Storage Database emulation for:

- [Berkeley DB](https://www.oracle.com/uk/database/technologies/related/berkeleydb.html)
- [LMDB](http://www.lmdb.tech/doc/)


## Installing *glsdb*

        npm install glsdb

*glsdb* is compatible with Node.js version 14 and later.

For convenience, *glsdb* includes pre-built binaries for *mg-dbx* and *mg-dbx-bdb* for the following platforms:

- 64-bit Intel Linux and Node.js versions 14, 16 and 18
- 32-bit ARM Linux and Node.js versions 14, 16 and 18
- 64-bit ARM Linux and Node.js versions 14, 16 and 18
- 64-bit Windows and Node.js versions 14, 16 and 18

For any other Operating System/Platform or Node.js version, you must manually install *mg-dbx* or *mg-dbx*.  See the 


## Using *glsdb* with Node.js

As you will discover in this documentation, the *glsdb* abstraction of Global Storage databases relies on synchronous access to the actual physical Global Storage database.  Whilst Global Storage databases, particularly the native implementations, are extremely fast, the synchronous nature of the *glsdb* APIs will block the Node.js main thread of execution, which is clearly undesirable if the Node.js process is being used concurrently by multiple users.

It is therefore recommended that *glsdb* is used in conjunction with a module such as 
[QOper8-wt*](https://github.com/robtweed/qoper8-wt) or 
[QOper8-cp](https://github.com/robtweed/qoper8-cp), where individual messages are handled in isolation within a Worker Thread or Child Process, resulting in no concurrency issues.

[This tutorial](./FASTIFY.md) explains how you can use *glsdb* and the *QOper8* modules in conjunction with the Fastify Web Server for Node.js, allowing you to use a Global Storage database as part of a high-performance, high-scalability REST-based back-end service.


## Starting and Configuring *glsdb*

- First, import the *glsdb* module:

        const {glsDB} = await import('glsdb');

  or:

        import {glsDB} from 'glsdb';

- Next, create an instance of the *glsDB* class, specifying the database type you want to use:


        const glsdb = new glsDB(database_type);

  where *database_type* can be:

- *iris*: the InterSystems IRIS Data Platform
- *yottadb* or *ydb*: YottaDB
- *cache* the Cache database from InterSystems (now a legacy product)
- *bdb*: Berkeley DB
- *lmdb*: the LMDB database

*glsdb* will automatically import the appropriate interface module for your selected database type.


- Finally you must open a connection to your database of choice:

        glsDB.open(options);

The contents of the *options* object will depend on the database type you have selected to use and the type of connection you want to make to the database.

If you use YottaDB, IRIS or Cache, you can connect to the database in one of two ways:

- the more conventional way, via a network connection;

- the high-performance way, via an API (or *in-process*) connection, where both Node.js and the database run in the same physical process.

If you choose a network connection, then the database and Node.js process can reside on either the same or different physical hardware, but the machine running the Node.js process must be able to make a TCP connection to the machine on which the database resides.  Performance will be limited by the bandwidth of the network connection.

If you choose an API connection, both Node.js and the database must reside on the same physical hardware.  This closely-coupled API connection will result in significantly higher performance, but that must be balanced against any potential security concerns.

Note that the type of connection you choose will make no difference to the syntax of the *glsdb* APIs.


If you use Berkeley DB or LMDB, then, because these are embedded databases, the only available option is an API/in-process connection.


### Database Opening Options

Each database has its own specific conventions and requirements for connection.  These are detailed below.

However, once opened, they will then behave identically in *glsdb*.

#### IRIS and Cache:

- Network Connection:

  Network connctions made by the *mg-dbx* interface module to both IRIS and Cache require the use of
the [*mgsi*](https://github.com/chrisemunt/mg-dbx#Threads) superserver software.

  You must specify:

  - *host*: the domain name or IP address of the database server

  - *tcp_port*: the port on which the database server is listening for connections

  - *username*: a valid username for which networked access is allowed

  - *password*: the associated password

  - *namespace*: the namespace to use for the connection

  For example:

        glsdb.open({
          host: '172.17.0.2',
          tcp_port: 7041,
          username: "_SYSTEM",
          password: "xxxxxxx",
          namespace: "USER"
        });


- API Connection:

  In order to use an API connection to IRIS or Cache, you must ensure that the IRIS or Cache *Callin Interface* has been enabled.  Use the IRIS/Cache System Management Console to check/enable this interface.

  You must specify:

  - *path*: the path to the IRIS or Cache *mgr* account

  - *username*: a valid username for which networked access is allowed

  - *password*: the associated password

  - *namespace*: the namespace to use for the connection

  For example:

        glsdb.open({
          path: '/usr/irissys/mgr',
          username: "_SYSTEM",
          password: "xxxxxxx",
          namespace: "USER"
        });


#### YottaDB:

- Network Connection:

  Network connctions made by the *mg-dbx* interface module to YottaDB requires the use of
the [*mgsi*](https://github.com/chrisemunt/mg-dbx#installing-the-m-support-routines-also-known-as-the-db-superserver) SuperServer software.

  You must specify:

  - *connection*: the type of connection - *network* in this case

  - *host*: the domain name or IP address of the database server

  - *tcp_port*: the port on which the database server is listening for connections


  For example:

        glsdb.open({
          host: '172.17.0.2',
          tcp_port: 7041
        });


- API Connection:

  In order to make an API connection to YottaDB, you must first install the 
[*mgsi* routine files and command interface file](https://github.com/chrisemunt/mg-dbx#installation-for-yottadb)
on your YottaDB database system.

  To open a connection, you must specify the path to the YottaDB database executable and the environment variables required by YottaDB (which, in turn, define the locations of the database and routine files you want to access):

  - *path*: the path to the YottaDB executable

  - *env*: an object with the following properties:

    - *ydb_dir*: the YottaDB directory path

    - *ydb_gbldir*: the YottaDB Global Directory path

    - *ydb_routines*: the location(s) of YottaDB routine files

    - *ydb_ci*: the path/location of the *zmgsi.ci* command interface file
 

  For example, for a YottaDB v1.34 system:

        glsdb.open({
          path: '/usr/local/lib/yottadb/r134/',
          env: {
            ydb_dir: '/opt/yottadb',
            ydb_gbldir: '/opt/yottadb/yottadb.gld',
            ydb_routines: '/opt/fastify-qoper8/m /usr/local/lib/yottadb/r134/libyottadbutil.so',
            ydb_ci: '/usr/local/lib/yottadb/r134/zmgsi.ci'
          }
        });


#### Berkeley DB:

  You must specify:

  - *db_library*: the path to the Berkeley DB shared object or dll

  - *db_file*: the path to the database file you want to use (it is created if it does not already exist)

  - *env_dir*: the path to your Berkeley DB installation

  - *key_type*: must be set to *m* for *glsdb*.

  For example:

        glsdb.open({
          db_library: "/usr/local/BerkeleyDB.18.1/lib/libdb.so",
          db_file: "/opt/bdb/my_bdb_database.db",
          env_dir: "/opt/bdb",
          key_type: "m"
        });


#### LMDB:

  You must specify:

  - *db_library*: the path to the LMDB shared object or dll

  - *env_dir*: the path to your LMDB installation

  - *key_type*: must be set to *m* for *glsdb*.

  For example:

        glsdb.open({
          db_library: "liblmdb.so",
          env_dir: "/opt/lmdb",
          key_type: "m"
        });



## Closing the Database Connection

On completion of your processing logic, it is recommended that you cleanly close the connection to the database using the *close()* API, eg:

        glsdb.close();

If you are using the *QOper8-wt* or *QOper8-cp* modules, the *close()* API should be invoked before a Worker Thread or Child Process is terminated, eg:

        qoper8.on('stop', function() {
          glsdb.close();
        });


## The *glsdb* APIs

Having successfully opened a connection to a supported database, you now have access to the *glsdb* APIs.

Broadly-speaking, there are three sets of APIs:

- a generic set that are supported across all compatible databases, and which abstract the so-called *nodes* within a Global Storage database;

- a higher-level abstraction derived from the generic APIs, using a Proxy Object, which provides a very close approximation to having what appear to be persistent JavaScript Objects;

- a set of APIs that are available for IRIS and Cache only, which abstract native IRIS and Cache Persistent Objects as JavaScript Objects.


### The Generic Global Storage APIs

#### Getting Started

It is recommended that you first 
[familiarise yourself with the Global Storage Database technology](https://github.com/robtweed/global_storage), 
in particular with 
[this document on how Global Storage works](https://github.com/robtweed/global_storage/blob/master/Global_Storage.md).

There is conceptually a one-to-one correspondence between a 
[set of Global Storage Nodes and a JSON object](https://github.com/robtweed/global_storage/blob/master/Global_Storage.md#global-storage-is-actually-just-like-json).

Essentially *glsdb* abstracts a Global Storage database as a persistent JavaScript Object/JSON.

#### Top-Level APIs

- *version*: returns the version details for the *mg-dbx* or *mg-dbx-bdb* interface module

- *directory*: returns an array of all the Global names in the opened database.

- *forEachGlobal(callback)*: iterates through the Global names within the opened database.  At each iteration step it fires a callback function:

  - *callback(global_name)*: a function that will be invoked at each iteration step.  It takes a single argument which is the name of the Global found at the current iteration step.


#### The *node* Class

The usual starting point when using *glsdb* is to first specify a path to a key/value node within such a persistent object.  You do this using the *glsdb.node* Class, and create an instance of a *glsdb node* by specifying its path (using JavaScript *dot* syntax).

For example:

        let node = new glsdb.node('Person.x.y');


In this example, *node* represents a persistent object that you envisage as:

        const Person = {
          x: {
            y: <==== node is whatever is at this key
          }
        }
      

Or, for those familiar with the hierarchical representation traditionally used for Global Storage databases, it represents the following Global Node:

        Person["x", "y"]


You can also specify a top-level Global Node if you wish, eg:

        let topNode = new glsdb.node('Person');


A *glsdb node* provides you with a set of properties and methods with which you can discover, manipulate, access and modify the physical Global Storage node, in addition to methods that allow you to navigate from the specified Global Storage Node to the other Global Storage Nodes that surround it within the hierarchical database structure, ie:

- its parent node (if any);
- its sibling nodes (if any);
- its child nodes (if any).

Importantly, the *node* Object does not actually have to physically exist within the database at the time you instantiate it: ie it can be a notional Global Storage node that you subsequently populate or use as the starting point for navigation or exploration.

Let's now go through the properties and methods for the *glsdb node*.


#### *node* Properties

- Properties relating to the *node* itself:

  - *path*: (Read Only) returns an array representing the full name and key path hierarchy for the *node*

  - *name*: (Read Only) returns the Global Storage name, ie the first member of the *path* array

  - *keys*: (Read Only) returns an array representing the key path hierachy for the *node*, ie the second to last members of the *path* array

  - *key*: (Read Only) returns the key for the specific *node*, ie the last one in the *keys* array

  - *exists*: (Read Only) returns *true* if the *node* physically exists within the database; *false* if not

  - *hasValue*: (Read Only) returns *true* if the *node* physically exists within the database and has a value stored against it; *false* if not

  - *hasChildren*: (Read Only) returns *true* if the *node* has Child *node*s below it within the hierarchical structure; *false* if not

  - *isLeafNode*: (Read Only) returns *true* if the *node* has a value and is therefore a leaf node within the hierarchical structure; *false* if not

  - *isArray*: (Read Only) returns *true* if the *node* represents an Array; *false* if not

  - *isArrayMember*: (Read Only) returns *true* if the *node* represents a member of an Array; *false* if not

  - *proxy*: returns a Proxy object that provides an even higher-level abstraction for the *node*.  For more details, see this [Tutorial](./PROXY_API_TUTORIAL.md)


- Properties relating to other *nodes* that may surround it:

  - *parent*: (Read Only) returns an instance of a *node* object that represents the current *node*'s parent within the hiearchy of nodes.  If the current node is the top-level node, it returns an undefined value;

  - *firstChild*: (Read Only) if the *node* has Child *node*s, this returns an instance of a *node* object that represents the current *node*'s first Child *node* in collating sequence

  - *lastChild*: (Read Only) if the *node* has Child *node*s, this returns an instance of a *node* object that represents the current *node*'s last Child *node* in collating sequence

  - *nextSibling*: (Read Only) if the *node* has sibling *node*s, this returns an instance of a *node* object that represents the current *node*'s next sibling *node* in collating sequence

  - *previousSibling*: (Read Only) if the *node* has sibling *node*s, this returns an instance of a *node* object that represents the current *node*'s previous sibling *node* in collating sequence

  - *childNodes*: (Read Only) if the *node* has Child *node*s, this returns an array of instances of *node* objects, representing the complete set of the current *node*'s Child *node*s, ordered in collating sequence

  - *children*: (Read Only) Identical to *childNodes* above

  - *leafNodes*: (Read Only) if the *node* has Child *node*s, this returns an array of instances of *node* objects, representing the complete set of the current *node*'s Child *node*s that are leaf nodes (ie that have a value and have no children)

  - *length*: (Read Only) returns the number of Child Nodes belonging to the current *node*.

- Properties that access the value(s) of *nodes*

  - *value*: (Read/write) gets or sets the value (if any) of the *node*.  Returns an empty string if the *node* does not have a value.

  - *document*: (Read) returns a JavaScript object/JSON sructure representing the *node*'s descendent *node*s

  - *document*: (Write) merges a JavaScript object into the current *node* to create a corresponding set of descendent *node*s.  Note that this is non-destructive: any existing descendent *node*s will be left intact (though may be overwritten if the incoming object also contains them)


#### *node* Methods

- *delete()*: deletes the *node* and any/all of its descendent *node*s.  (No arguments)

- *increment(amount)*: increments the value of the *node* by the specified integer amount (1 if not specified).  Note that if the node currently does not exist, or if it does exist but has no value or a non-integer value, it is set to the value specified by the *amount* argument.

- *$(key_value)*: returns an instance of the *node*'s Child *node* with the specified *key_value*. (Note that the specified Child *node* may or may not currently exist in the database)

- *_(array_index)*: This method is used to access Array *node* members.  Array *node*s use a special key structure/syntax behind the scenes, but the *_()* method allows you to access its members as if they were JavaScript Array members (see later).  Returns an instance of the specified member of the Array *node*.

- *forEachChildNode(options, callback)*: iterates through all or specified Child *nodes* of the current *node*.  Arguments are:

  - *options*: an optional object that controls or limits the iteration via the following properties:

    - *direction*: Controls the direction of iteration in terms of the collating sequence of the Child Nodes.  The iteration is *forwards* by default (ie in ascending collating sequence), unless the value for *direction* is set to either *backwards* or *reverse*

    - *from*: Sets the starting *key* value for the iteration.  Only Child *nodes* with a *key* following this value in collating sequence will be included in the iteration.  By default the iteration will be from the *node*'s *firstChild*.

    - *to*: Sets the termination *key* value for the iteration.  Only Child *nodes* with a *key* preceeding this value in collating sequence will be included in the iteration.  By default, iteration will terminate with the *node*'s *lastChild*.

    - *startsWith*: iteration will be limited to only those Child *node*s with a key value that starts with the specified string.  By default, all key values will be included in the iteration.

  - *callback(childNode)*: a function that will fire at each iteration step.  The function takes a single argument which is an instance of the Child *node* for the current iteration step.

  Note that if no options are required, you can invoke the method using *forEachChildNode(callback)*


- *forEachLeafNode(options, callback)*: iterates through all or specified descendent Leaf *nodes* of the current *node*.  Arguments are:

  - *options*: an optional object that controls or limits the iteration via the following properties:

    - *direction*: Controls the direction of iteration in terms of the collating sequence of the Leaf Nodes.  The iteration is *forwards* by default (ie in ascending collating sequence), unless the value for *direction* is set to either *backwards* or *reverse*

  - *callback(leafNode)*: a function that will fire at each iteration step.  The function takes a single argument which is an instance of the Leaf *node* for the current iteration step.

  Note that if no options are required, you can invoke the method using *forEachLeafNode(callback)*


- *lock(timeout)*: Sets a Lock on the current *node*, which, if successful, means that any other user/process trying to Lock that same *node* will be blocked and its processing will be suspended until the Lock is released.  A timeout (in seconds) can be optionally specified, in which case the *lock()* method will return *true* if it was successful in setting the Lock, or *false* if it was unable to set the Lock within the specified time.

- *unlock()*: Unlocks the current *node*.  If there are any other users/processes previously blocked by this Lock, then one will now be granted the Lock (any others will continue to be blocked).


#### *node* Methods Specific to Array Nodes

For *node*s that represent persistent Arrays, *glsdb* provides a number of convenience methods that emulate the behaviour of and share the same arguments as their JavaScript equivalents:

- *at(index)*: returns the value of the Array element with the specified index.  Negative numbers return elements from the end of the persistent Array

- *concat(arr, [arr2...])*: Persistently concatenates the specified array(s) to the existing persistent one, and returns a copy of the concatenated arrays.

- *includes(value)*: Returns *true* if at least one of the members of the persistent array is equal to the the specified value.

- *indexOf(value [, fromIndex])*: Returns the index value of the first members of the persistent array that is equal to the the specified value, otherwise returns -1.

- *pop()*: Removes the last member of the persistent Array and returns its value.

- *push(value)*: Appends the specified value as a new last member of the persistent Array

- *shift()*: Removes the first member of the persistent Array and returns its value.

- *slice()*: Extracts a section of the persistent Array and returns it as an array.  The persistent Array is left intact.

- *splice()*: Adds or changes the contents of the persistent Array.

- *unshift(value)*: Prepends the specified value as the new first member of the persistent Array and adjusts the indices of the existing members appropriately.


#### Using the Generic Global Storage APIs

Jump over to the [Tutorial on using the generic Global Storage APIs](./BASIC_APIS_TUTORIAL.md) to learn in detail how to use the basic *glsdb* APIs.



### The Global Storage Proxy API

You can use a *node*'s *proxy* property to obtain a Proxy Object that provides an even higher-level abstraction of a *node*, to the extent that you effectively have an Object that is actually directly accessing and modifying the physical representation of that Object in your Global Storage database.  For example:

        let person = new glsdb('Person.1').proxy;

When using the Proxy, references you make it its properties are trapped and mapped via the Proxy's handler methods to the corresponding Global Storage records in the database.  In effect, it's as if you have a JavaScript object whose properties map directly to the persistent equivalent within your Global Storage database, and as such, you use and manipulate it almost as if it was a standard JavaScript Object.

When using the Proxy:

- its properties are directly mapped to corresponding child *node*s
- any properties that are defined as Arrays can make use of any JavaScript Array methods, but they are accessing the persistent database version of the Array
- you can delete a child *node* in the database using *delete proxy_obj.property* syntax
- you can iterate through the Proxy's child *nodes* using, for example, a *for...in* loop, but you're actually accessing an array created from the *node*'s Child Nodes.

At any point, you can also obtain the original *node* object represented by the Proxy by using its *_node* property:

         let node = proxy._node;

You also have access to the underlying *node*'s basic *glsdb* properties and methods, simply by adding an underscore (_) to the property or method name, eg:

        console.log(person._exists);  // true

        let Person = person._parent.proxy;

        let record = person._document;   // returns an in-memory object representing the saved person record

        person._forEachChildNode(function() { // iterate through the child nodes }

Jump over to the [Tutorial on using the Proxied Global Storage API](./PROXY_API_TUTORIAL.md) to learn more.


### The IRIS/Cache-Specific API

*glsdb* adds a Proxy-based layer of abstraction on top of the IRIS/Cache Object APIs provided by the *mg-dbx* interface.

Note that these APIs are only available if you use *glsdb* with the IRIS or Cache databases.

Having made a connection to the database (either an in-process API connection or a networked connection) as normal, you can then create a Proxy Object that corresponds to an instance of an IRIS/Cache Class:

- first connect to the IRIS/Cache Class you want to use, for example:

        let Person = glsdb.irisClass('Person');


- then either:

  - create an instance of an existing member of the Class using an IRIS/Cache OID , eg:

        let person = Person(10);

  - or create an instance of a new (empty) member:

        let person = Person();


You now have a Proxy Object whose methods and properties directly access/use those of the corresponding IRIS/Cache persistent one.

So, for example, if it was an existing *person* instance, we could do things like:

        console.log(person.Name);
        console.log(person.DateOfBirth);


You can also chain references where appropriate, eg:

        console.log(employee.Company.Name);

In all cases, the property values are being directly returned from the corresponding persistent IRIS/Cache objects.  It's as if the JavaScript Object you're using is actually a persistent, on-disk one!


To update an Object, you can use its *_save()* method (which invokes the %Save() method of the corresponding IRIS/Cache persistent object).

You can inspect the properties and methods of the object:

        console.log(person._properties);
        console.log(person._methods);

*glsdb* will automatically recognise those properties and methods when you chain them together, and apply them appropriately .


*glsdb* also provides a handy *_set* method that allows you to populate and save a new instance of a Class in one single command, eg:

        person._set({
          Name: 'Rob',
          City: 'Redhill',
          Country: 'UK'
        });



----

## Demonstration Docker Containers

This *glsdb* repository includes a set of Dockerfiles for creating a quick and easy Containers in which you can try everything out using three different supported databases:

- YottaDB
- Berkeley DB
- LMDB

They each include the exact same demonstration script, with the only exception being the database connection options.


### YottaDB Container

It includes a copy of Node.js and a pre-installed, pre-configured copy of the YottaDB database.

### Building the Container

You'll need to have Docker installed on your computer before carrying out the steps below.

Clone the repository in a folder on your computer:

        git clone https://github.com/robtweed/glsdb

Then navigate to the folder containing the Dockerfile and supporting files:

        cd glsdb/examples/docker-demo-ydb

You'll see a handy reminder file named *start.txt* that contains the commands for building and running the container.


To build the container:

        docker build -t glsdb .


### Start the COntainer

Once the build has completed, you can start it at any time thereafter using:

        docker run --name glsdb --rm -it glsdb


### Running the *glsdb* Demo


You'll find yourself in the */opt/glsdb* folder of the Container which will contain a Node.js script file named *demo.mjs*.

This demo script exercises a number of *glsdb* APIs, in particular the Proxied ones.  Take a look at its contents.


Then run it:

      node demo.mjs


### Take a Look at the Global Storage Database

After the demo has run, you can take a look at the database that it's created in the Container's YottaDB database.

First, open the YottaDB shell:

      ./ydb

      YDB> 

Then type:

      YDB> zwr ^Person

You should see a listing of the database contents for the *Person* Global.

Each time you run the script it will add another identical person record using the next generated Id value.


To close the YottaDB Shell:

      YDB> h


### Exit and Shut Down the COntainer

Type:

      exit


### Berkeley DB Container

It includes a copy of Node.js and a pre-installed copy of the Berkeley DB database.

### Building the Container

You'll need to have Docker installed on your computer before carrying out the steps below.

Clone the repository in a folder on your computer:

        git clone https://github.com/robtweed/glsdb

Then navigate to the folder containing the Dockerfile and supporting files:

        cd glsdb/examples/docker-demo-bdb

You'll see a handy reminder file named *start.txt* that contains the commands for building and running the container.


To build the container:

        docker build -t glsdb-bdb .


### Start the COntainer

Once the build has completed, you can start it at any time thereafter using:

        docker run --name glsdb --rm -it glsdb-bdb


### Running the *glsdb* Demo


You'll find yourself in the */opt/glsdb* folder of the Container which will contain a Node.js script file named *demo.mjs*.

This demo script exercises a number of *glsdb* APIs, in particular the Proxied ones.  Take a look at its contents.


Then run it:

      node demo.mjs

### Exit and Shut Down the COntainer

Type:

      exit


### LMDB Container

It includes a copy of Node.js and a pre-installed copy of the LMDB database.

### Building the Container

You'll need to have Docker installed on your computer before carrying out the steps below.

Clone the repository in a folder on your computer:

        git clone https://github.com/robtweed/glsdb

Then navigate to the folder containing the Dockerfile and supporting files:

        cd glsdb/examples/docker-demo-lmdb

You'll see a handy reminder file named *start.txt* that contains the commands for building and running the container.


To build the container:

        docker build -t glsdb-lmdb .


### Start the COntainer

Once the build has completed, you can start it at any time thereafter using:

        docker run --name glsdb --rm -it glsdb-lmdb


### Running the *glsdb* Demo


You'll find yourself in the */opt/glsdb* folder of the Container which will contain a Node.js script file named *demo.mjs*.

This demo script exercises a number of *glsdb* APIs, in particular the Proxied ones.  Take a look at its contents.


Then run it:

      node demo.mjs

### Exit and Shut Down the COntainer

Type:

      exit


## License

 Copyright (c) 2022 M/Gateway Developments Ltd,                           
 Redhill, Surrey UK.                                                      
 All rights reserved.                                                     
                                                                           
  http://www.mgateway.com                                                  
  Email: rtweed@mgateway.com                                               
                                                                           
                                                                           
  Licensed under the Apache License, Version 2.0 (the "License");          
  you may not use this file except in compliance with the License.         
  You may obtain a copy of the License at                                  
                                                                           
      http://www.apache.org/licenses/LICENSE-2.0                           
                                                                           
  Unless required by applicable law or agreed to in writing, software      
  distributed under the License is distributed on an "AS IS" BASIS,        
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. 
  See the License for the specific language governing permissions and      
   limitations under the License.      
