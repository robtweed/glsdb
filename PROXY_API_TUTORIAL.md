# Tutorial: Using the Proxy *glsdb* API


This Tutorial will explain how you can use *glsdb*'s Proxy-based abstraction of its Basic *node* API.

It is recommended that you also take the [Tutorial that explains the Basic APIs.](./BASIC_APIS_TUTORIAL.md), since this will help understand what's going on behind the scenes when using the Proxy API.


## Our Database Design

Let's suppose we want to create and maintain a Global Storage database of details about people - perhaps a membership database.

Let's further suppose that each Person record will be an object with the following fields:

- firstName
- lastName
- title
- address:
  - houseNumber
  - streetName
  - city
  - county
  - postCode
  - country
- telephone:
  - mobile
  - landline
- favouriteColours

For example, an individual Person record/object might look like this:

        {
          firstName: 'Rob',
          lastName: 'Tweed',
          title: 'Dr',
          address: {
            houseNumber: 5,
            streetName: 'High Street',
            city: 'Redhill',
            county: 'Surrey',
            postCode: 'RH1 2AB',
            country: 'UK'
          },
          telephone: {
            mobile: '07654 987654',
            landline: '01737 123456'
          },
          favouriteColours: ['blue', 'green']
        }


Let's also suppose that each Person in our database will be identified by a simple unique integer.

Note that a key feature of Global Storage databases is that they are Schema-Free, so, in fact, the structure of a Person record can be varied freely, and/or its structure maintained by your own application logic, and not any built-in schema validation mechanism.

So now let's look at how we might create and maintain this Person database using *glsdb*.


## Data and Identification Global Names

We need to maintain two things:

- the unique identiers for each Person in the database
- the collection of Person records

We're going to do that in this example using two separate Global Names.  Let's use:

- PersonIdentifier
- Person

If we were using the basic *glsdb* API, we would instantiate instances of the *node* Class for both these top-level persistent objects (neither of which currently exist in the database):


        let personId = new glsdb.node('PersonIdentifier');
        let person = new glsdb.node('Person');


However, in this tutorial, for both of these *node*s, we're going to use the Proxy abstraction that *glsdb* provides.  We do that by using their respective *proxy* property:

        let personId = new glsdb.node('PersonIdentifier').proxy;
        let person = new glsdb.node('Person').proxy;


## Adding A Person Record

We're going to add the previous example as the first Person record, ie:

        const record = {
          firstName: 'Rob',
          lastName: 'Tweed',
          title: 'Dr',
          address: {
            houseNumber: 5,
            streetName: 'High Street',
            city: 'Redhill',
            county: 'Surrey',
            postCode: 'RH1 2AB',
            country: 'UK'
          },
          telephone: {
            mobile: '07654 987654',
            landline: '01737 123456'
          },
          favouriteColours: ['blue', 'green']
        };


With the Proxy API, we can maintain an incremented, unique Id as follows:

        personId.id++;

What this does is to create, in the Global Storage database:

        PersonIdentifier['id'] = 1


Note that, due to the way Proxies work, **the proxied action is always with respect to a property of the Proxied object**.  In other words, if we did this:

        personId++;

We would actually overwrite the *personId* Proxy Object, and we'd instead now have a local JavaScript variable named *personId* with a value of 1.


OK so let's continue...


We can now get the value of this new identifier.  You might think you could do this:

      let id = personId.id;

But if you do, you'll find that what is returned as the value of *id* is in fact a Proxy object representing the *personId.id* Global Storage Node.  This is where our Proxy Object doesn't exactly behave the way in-memory ones do.  The reason it works this way will become clear later when you see how you can chain the Proxy references.

So what we need to do is this instead:

        let id = personId.id._value;

In other words we apply the underlying *node* Object's *value* property, which we can invoke by prefixing it with an underscore character.

Better still, and more closely mirroring standard JavaScript behaviour, you could actually also use the *valueOf()* method which is automatically trapped by the Proxy to invoke the *node*'s *value* property:

        let id = personId.id.valueOf();


So now that we have a new, unique id for our *person* record, we can now save it just as if we were creating an ordinary JavaScript object with a variable key value:

        person[id] = record;

That's it! We've stored our first database record in the Global Storage database, yet we simply appear to have been using JavaScript objects in a near-standard way!


#### Retrieving our Persistent Record

To retrieve our Person record object at a later date, we'd simply do the following.  For now, we need to assume that we know the Person *Id* to retrieve, in this case *1*:


        let person = new glsdb.node('Person.1').proxy;
        let record = person.valueOf();

Alternatively we could do this:

        let person = new glsdb.node('Person').proxy;
        let record = person[1].valueOf();

We don't have to recover the record as an in-memory object, however.  We can, if we wish/prefer, access the record's contents *in-situ* within the database.

For example:

        let person = new glsdb.node('Person.1').proxy;
        let name = person.firstName.valueOf() + ' ' + person.lastName.valueOf();

        // Rob Tweed


## The Physical Database Storage

Let's now delve further into the details of the simple database we've created (albeit for now just containing a single Person record).

Before exploring what we can now do with our *glsdb* database, it's worth considering how the data has been physically stored in the Global Storage database.  It's effectively a hierarchical tree of Global Storage nodes that can be envisaged as below:




                                              |-- city
                                              |
                                              |-- country
                                              |
                                              |-- county
                        |-- address ----------| 
                        |                     |-- houseNumber
                        |                     |
                        |                     |-- postCode
                  (id)  |                     |
                        |                     |-- streetName
          Person -- 1 --|
                        |
                        |                     |-- [0]
                        |-- favouriteColours -|
                        |                     |-- [1]
                        |
                        |-- firstName
                        |
                        |-- lastName
                        |                     |-- landLine
                        |-- telephone --------|
                        |                     |-- mobile
                        |
                        |-- title
                        
                        

This representation will help to understand how and why the various *node* properties and methods behave.


## Child Nodes, Sibling Nodes, Leaf Nodes and Intermediate Nodes

Currently we only have a single Person record stored, with an *id* of *1*.  From the representation above, you can see that Under that *id* node are six *Child Nodes*, representing the keys:

- address
- favouriteColours
- firstName
- lastName
- telephone
- title

This set of Child Nodes are also considered to be *Sibling Nodes*.

Note that Global Storage databases naturally store and sort Sibling Nodes in alphanumeric key sequence as shown.

Some of those nodes are leaf nodes with associated data values, eg:

- firstName
- lastName
- title

The others are known as *Intermediate* Nodes, ie Nodes that have their own Child Nodes

## Accessing Nodes

*glsdb* allows us to instantiate any of the Nodes shown in the hierarchy above as a Proxy for an instance of the *node* Class, eg:

        // the top-most Node of the hierarchy
        let Person = new glsdb('Person').proxy;

or:

        // the top node of our first person record
        let person = new glsdb('Person.1').proxy;   

or:

        // the first person record's firstName node
        let firstName = new glsdb('Person.1.firstName').proxy; 

or:

        // the first person record's postCode node
        let postCode = new glsdb('Person.1.address.postCode').proxy; 


## Using Iterators

Having accessed one *node*, we can access its child nodes using any of the standard JavaScript iterators, eg:

        for (let name in person) {
          console.log(name + ': ' + person[name].valueOf());
        }

        /*
          address: [object Object]
          favouriteColours: blue,green
          firstName: Rob
          lastName: Tweed
          telephone: [object Object]
          title: Dr
        */

If the *node* represented by the Proxy is an Object *node*, then a *for..of* loop will behave identically.


However, if the *node* represented by the Proxy is an Array *node*, then you'll see the expected difference between a *for..in* and a *for..of* loop when applied to Arrays:

A *for..in* loop iterates through the Array indices:

        for (let name in person.favouriteColours) {
          console.log('name: ' + name);
        }

        // name: 0
        // name: 1


Whereas a *for..of* loop iterates through the Array values:

        for (let name of person.favouriteColours) {
          console.log('name: ' + name);
        }

        // name: blue
        // name: green


The various Object iteration methods can be used instead, eg:

- Object.entries():

        for (const [key, value] of Object.entries(person.favouriteColours)) {
          console.log(`${key}: ${value}`);
        }

        // 0: blue
        // 1: green

- Object.keys():


        for (const name of Object.keys(person)) {
          console.log('name = ' + name);
        }

        // name = address
        // name = favouriteColours
        // name = firstName
        // name = lastName
        // name = telephone
        // name = title


- Object.values():

  - for Object *node*s:

    This iterator returns an array containing the Proxies representing each Child *node*, so it can be used like this:

        let arr = Object.values(person);
        console.log(arr[2].valueOf());   // Rob

  - for Array *node*s:

    This iterator returns an array containing the values of the persistent array:

        let arr = Object.values(person.favouriteColours); // ['blue', 'green']



**IMPORTANT NOTE**: When using JavaScript iterators on *glsdb* Proxies, *glsdb* has to create an array of the current *node*'s Child Node keys.  For the examples used above, this is quite reasonable because the number of Child Nodes is small.

However, it would be unwise to use the iterators at this level:

        let Person = new glsdb('Person').proxy;

        for (const id in Person) {
          // process each person record
        }

This is because there could be tens of thousands of records in our Person database, and the Person proxy handler would have to try to create an array for every record in the database.

In such situations, it's better to use the underlying Object's *forEachChildNode()* method, which will allow you to iterate directly against the database records, eg:

        Person._forEachChildNode(function(childNode) {
          // process the childNode using its Proxy:

          let child = childNode.proxy;
          // ...etc
        });


## Checking if a Property Exists

You can use the standard Object.hasOwn() method to determine whether a specified property exists for a *node*, eg:

        console.log(Object.hasOwn(Person[1], 'firstName');   // true

        console.log(Object.hasOwn(Person[1], 'foo');         // false



## Deleting Nodes

You can use the JavaScript *delete* command to delete a *node* from the database.

Note that the *delete* command must be applied to a property of a Proxy, not to the Proxy itself.

For example:


        let person = new glsdb('Person.1').proxy;
        delete person.address.city;        

As the *city* Node was a Leaf Node, this will just delete this specific *city* Node from the database.


However, if we apply the *delete()* to an Intermediate Node such as *telephone*:

        delete person.telephone;


... then you'll find that both telephone numbers (*mobile* and *landline*) have been deleted along with the intermediate node we specifically deleted.  If we use the hierachical representation of our database it becomes clearer why this has happened:


                        |-- lastName
                        |
                        |     \   /
                        |      \ /            |-- landLine
          Person -- 1 --|-- telephone --------|
                        |      / \            |-- mobile
                        |     /   \
                        |
                        |-- title




The *telephone* *node* and the entire sub-tree of descendent *node*s below it are deleted as a result of deleting the *telephone* *node*:


                        |-- lastName
                        |
          Person -- 1 --|
                        |
                        |-- title



So this means we can remove an entire person record stored by deleting at the *id* node, eg:


        let person = new glsdb('Person);
        delete person[1];


However, you cannot delete/clear down an entire database via a Proxy, ie the following won't work:

        let Person = new glsdb('Person');
        delete Person;

because you're attempting to apply the *delete* operator to the Proxy Object itself.  You'll therefore get an error:

        SyntaxError: Delete of an unqualified identifier in strict mode.

You can, of course, use the underlying *node*'s *delete()* method:

        Person._delete();

