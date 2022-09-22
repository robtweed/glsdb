# Tutorial: Using the Basic *glsdb* APIs


## Install *glsdb*

        npm install glsdb


## Import and Open a Database Connection


In this tutorial I'll assume you're using YottaDB and that you've enabled the *mgsi* Superserver on port 7041:

        const {glsDB} = await import('glsdb');
        const glsdb = new glsDB('yottadb');
        glsdb.open({
          host: '172.17.0.2',
          tcp_port: 7041
        };

However, you can use and open any of the supported Global Storage databases or emulations: the *glsdb* tutorial examples below will behave identically on all of them.

We're now ready to begin!


Remember to finish any scripts with:

        glsdb.close();


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

Wwe can instantiate instances of the *node* Class for both these top-level persistent objects (neither of which currently exist in the database):


        let personId = new glsdb.node('PersonIdentifier');
        let person = new glsdb.node('Person');


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

So we first use the *increment()* API to obtain a unique Id:

        let id = personId.increment();


As this is the first time we've done this, *id* will have a value of 1 (which is also now stored in the PersonIdentifier Global in the database).

We can now do this:

        person.$(id).document = record;

What this does is:

- *person.$(id)* returns a new *node* object representing the path *Person.1*

- the *document* setter then merges the *record* object into corresponding descendent *node*s

That's it! We've stored our first database record in the Global Storage database.


#### Retrieving our Persistent Record

To retrieve our Person record object at a later date, we'd simply do the following.  For now, we need to assume that we know the Person *Id* to retrieve, in this case *1*:


        let person = new glsdb.node('Person.1');
        let record = person.document;


Alternatively we could do this:

        let person = new glsdb.node('Person');
        let record = person.$(1).document;

We don't have to recover the record as an in-memory object, however.  We can, if we wish/prefer, access the record's contents *in-situ* within the database.

For example:

        let person = new glsdb.node('Person.1');
        let name = person.$('firstName').value + ' ' + record.$('lastName').value

Note the use of the *$()* method which returns a *node* instance for the Child node of the *person node* with the specified key.


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

*glsdb* allows us to instantiate any of the Nodes shown in the hierarchy above as an instance of the *node* Class, eg:

        // the top-most Node of the hierarchy
        let Person = new glsdb('Person');

or:

        // the top node of our first person record
        let person = new glsdb('Person.1');   

or:

        // the first person record's firstName node
        let firstName = new glsdb('Person.1.firstName'); 

or:

        // the first person record's postCode node
        let firstName = new glsdb('Person.1.address.postCode'); 



Alternatively, having accessed one *node*, we can navigate to its surrounding ones.

For example, starting with this *node*:

        // the top node of our first person record
        let person = new glsdb('Person.1');

We can get its first Child Node:

        let firstChild = person.firstChild;

What has been returned is a *node* instance, so we can then use its various properties to examine and explore it:

        console.log('path: ' + firstChild.path);               // Person.1.address
        console.log('key: ' + firstChild.key);                 // address
        console.log('exists: ' + firstChild.exists);           // true
        console.log('hasValue: ' + firstChild.hasValue);       // false (because it's an intermediate node)
        console.log('value: ' + firstChild.value);             // {empty string} because it has no value
        console.log('hasChildren: ' + firstChild.hasChildren); // true
        console.log('isLeafNode: ' + firstChild.isLeafNode);   // false
        console.log('isArray: ' + firstChild.isArray);         // false


We can now get this node's *Next Sibling* node, which should represent the key *favouriteColours* which is an Array *node*:


        let sibling = firstChild.nextSibling;
        console.log('path: ' + sibling.path);               // Person.1.favouriteColours
        console.log('key: ' + sibling.key);                 // favouriteColours
        console.log('exists: ' + sibling.exists);           // true
        console.log('hasValue: ' + sibling.hasValue);       // false (because it's an intermediate node)
        console.log('value: ' + sibling.value);             // {empty string} because it has no value
        console.log('hasChildren: ' + sibling.hasChildren); // true
        console.log('isLeafNode: ' + sibling.isLeafNode);   // false
        console.log('isArray: ' + firstChild.isArray);      // true


Let's now get the favourite colours for this record.  We can do this in several ways.  Let's do the long way first.

We can get all the Child Nodes for the *favouriteColours node* above using the *children* property:

        let colourNodes = sibling.children;

This will be a JavaScript array containing all the Child *node*s in collating sequence.

We could then iterate through them an access their values, eg:

        colourNodes.forEach(function(node) {
          console.log(node.value);
        });

        // blue
        // green

Alternatively, and much more simply, we could use the *node's document getter* to return the original array of favourite colours:

        let colours = sibling.document;

        // ['blue', 'green']


We can also get a *node*'s parent *node*, for example using the *colourNodes* array from the example above:

        let parent = colourNodes[0].parent;
        console.log(parent.key);             // favouriteColours


## Setting/Updating Data Values

We've seen how the *document setter* property can be used to merge the contents of a JavaScript object into a corresponding set of descendent *nodes* of a target *node8.

However, it's also possible to set the value of individual *node*s using the *value setter* property.

For example, let's change the firstName value:

        let firstName = new glsdb('Person.1.firstName');
        firstName.value = 'Simon';


## Deleting Nodes

Applying a *node*'s *delete()* method will delete it and any descendent *nodes* (if it's an Intermediate Node).

For example:


        let city = new glsdb('Person.1.city');
        city.delete();


As the *city* Node was a Leaf Node, this will just delete this specific *city* Node from the database.


However, if we apply the *delete()* to an Intermediate Node such as *telephone*:

        let tel = new glsdb('Person.1.telephone');
        tel.delete();

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


        let person = new glsdb('Person.1');
        person.delete();


And you can even delete/clear down an entire database if you wish, by deleting its top *node*, eg:

        let Person = new glsdb('Person');
        Person.delete();


## Iterating Through Nodes *in-situ*

*glsdb* provides two methods that you can use to iterate through a *node*'s Child and/or Descendent Nodes, allowing you to invoke a function at each iteration step.

This provides a powerful mechanism for processing, querying and/or manipulating data in a Global Storage database.  You should note that the native Global Storage databases in particular are optimised for this type of iteration, making it an exceptionally fast operation.

### *forEachChildNode()*

As its name implies, this method allows you to iterate through all or a subset of a *node*'s Child Nodes.

To iterate through all Child Nodes, simply provide a callback function which returns an instance of each Child *node* at each iteration step.  For example, let's suppose we had several hundred Person records in our database, each identified by its unique *id* key.  We could iterate through the entire database:

        let Person = new glsdb('Person');
        Person.forEachChildNode(function(person) {
          let record = person.document;
          // do something with the record;

          // or access in-situ, eg:

          let lastName = person.$('lastName').value;
          console.log(lastName);

        });


We can modify the iteration by providing one or more options.  For example, we could start the iteration at id 100:

        let options = {from: 100};
        Person.forEachChildNode(options, function(person) {
          // process the person node
        });

and we could terminate it at id 200:

        let options = {from: 100, to: 200};
        Person.forEachChildNode(options, function(person) {
          // process the person node
        });


If the Child keys are alphabetic, you can limit the search to ones that start with a particular substring.  For example:

        let address = new glsdb('Person.1.address');
        let options = {startsWith: 'c'};
        address.forEachChildNode(options, function(person) {
          // limited to just the "city", "country" and "county" keys
        });

Occasionally you might want the processing to be done in reverse collating sequence (ie from the *lastChild* to the *firstChild*).  To do so, set the *direction* option to *reverse*:

        let options = {direction: 'reverse'};


Note that you could achieve the same effect by using the *children* property of a *node* and iterating through the child *node*s contained in the array that it returns.  However, a *node* in a real-world Global Storage database might have a huge number of child nodes: take this example:

        let Person = new glsdb('Person');
        let persons = Person.children;

If our database contained many tens of thousands of person records, this would be incredibly inefficient, particularly if we are going to selectively process only particular person records in the collection.  It would also run the risk of exhausting available local memory, trying to create the *persons* Array of Child *node*s.

In such a situation, it's far more preferable to use the *forEachChildNode()* method, which iterates in-situ within the database, and which you can control to selectively include or filter the records you actually want.

On the other hand, this would be much more reasonable:

        let Person = new glsdb('Person');
        let person = Person.$(id);
        let props = person.children;

because an individual person record in our particular database only has a small number of first-level properties.


### *forEachLeafNode()*

This is an interesting alternative iterator that limits the *nodes* it returns at each iteration step to just those that are Leaf Nodes below the target *node*.

For example, if we applied it to a specific Person record in our database, eg:

        let person = new glsdb('Person.1');
        person.forEachLeafNode(function(leafNode) {
          // process the leaf node at each iteration step
        });


... then the Leaf Nodes that would be returned are indicated below:

                                              |-- city        <===
                                              |
                                              |-- country     <===
                                              |
                                              |-- county      <===
                        |-- address ----------| 
                        |                     |-- houseNumber <===
                        |                     |
                        |                     |-- postCode    <===
                  (id)  |                     |
                        |                     |-- streetName  <===
          Person -- 1 --|
                        |
                        |                     |-- [0]         <===
                        |-- favouriteColours -|
                        |                     |-- [1]         <===
                        |
                        |-- firstName                         <===
                        |
                        |-- lastName                          <===
                        |                     |-- landLine    <===
                        |-- telephone --------|
                        |                     |-- mobile      <===
                        |
                        |-- title                             <===

in other words:

- Person.1.address.city
- Person.1.address.country
- Person.1.address.county
- Person.1.address.houseNumber
- Person.1.address.postCode
- Person.1.address.streetName
- Person.1.favouriteColours[0]
- Person.1.favouriteColours[1]
- Person.1.firstName
- Person.1.lastName
- Person.1.telephone.landLine
- Person.1.telephone.mobile
- Person.1.title


Note that we could have used nested *forEachChildNode()* methods to achieve the same result, but it would be a lot more convoluted and would require us to know the maximum depth of the descendents.  It would also require a significantly larger number of iteration cycles to access all the leaf nodes, eg:

        let person = new glsdb('Person.1');
        person.forChildNode(function(childNode) {
          if (childNode.hasChildren) {
            childNode.forChildNode(function(grandchildNode) {
              if (grandchildNode.hasChildren) {
                grandchildNode.forChildNode(function(greatgrandchildNode) {
                  // ...etc
                });
              }
              else {
                // leaf node at level 2
              }

            });
          }
          else {
            // leaf node at level 1
          }
        });

   
In real-world scenarios, you'll find that the *forEachChild()* method is the one you'll use most frequently, but don't forget the *forEachLeafNode()* method: in the right circumstances it can be very powerful and much more efficient.


## Handling Arrays as Nodes

The mapping between JavaScript object keys and Global Storage nodes in *glsdb* assumes, by default, that the keys refer to objects.

However, *glsdb* has been designed to also handle and map JavaScript arrays to/from Global Storage.  In the example we've used thus far, you've seen examples of both.

Consider the Person record identifier that we've used: it's a simple integer value, but in our example we're using it as an object key, ie: Person is an Object with the identifier (1, 2, 3 etc) being keys of that object.  It isn't an Array with the identifier representing the index for each Array member.

However, it's a different matter for the *favouriteColours* key within a Person record.  It **is** an Array, ie:

        Person.1.favouriteColours = ['blue', 'green']

Global Storage databases don't have any built-in mechanism for naturally distinguishing between an Object with numeric keys and an Array with its numeric indices.  So, behind the scenes, *glsdb* provides its own mechanism and subscripting syntax for distinguishing between Objects and Arrays in a non-ambiguous way.

If you examine the actual way our example Person record was stored in the Global Storage database, you'd see this:

        Person[1,"address","city"]="Redhill"
        Person[1,"address","country"]="UK"
        Person[1,"address","county"]="Surrey"
        Person[1,"address","houseNumber"]=5
        Person[1,"address","postCode"]="RH1 2AB"
        Person[1,"address","streetName"]="High Street"
        Person[1,"favouriteColours","[000000]"]="blue"
        Person[1,"favouriteColours","[000001]"]="green"
        Person[1,"firstName"]="Rob"
        Person[1,"lastName"]="Tweed"
        Person[1,"telephone","landline"]="01737 123456"
        Person[1,"telephone","mobile"]="07654 987654"
        Person[1,"title"]="Dr"

You can see that the Person identifier (the first key or subscript) is a simple integer value 1, indicating that Person is an Object that just happens to have numeric keys.

However, the *favouriteColours* is an Array, and its keys are represented within square brackets and packed out with leading zeros.  In other words the array member:

        favouriteColours[0]

is actually represented in the physical Global Storage as:

        favouriteColours[000000]

The reasons for this are:

- to clearly and unambiguously distinguish array indices from object keys by wrapping the key in square brackets
- to enforce the correct collating sequence for array elements with the Global Storage by packing the value out to the same length using preceding zeros.

By packing out the array index value with leading zeros, any use of properties such as *children* or the *forEachChildNode()* method will return the array elements in the correct sequence.

You'll see that *glsdb* packs out array index values to 6 digits.  This is a default setting that you can modify.  If you know that within your *glsdb* database that no arrays will ever have more than, say, 100 members, you could reduce the packing to just 3 digits, which would add a very small amount of performance improvement to array member handling.

Conversely, if you needed an array capable of holding massive numbers of elements within the database, then you could increase the packing length.

You can do this when first instantiating *glsdb* by adding an options object, eg:

        let options = {maxArrayDigits: 3};
        const glsdb = new glsDB('yottadb', options);

Note that if you use this *options* setting, you **MUST** consistently use it **every** time you access the database, to prevent mismatches in the packing used for existing and new array records stored in the database.

Also note that this packing with leading zeros applies to **every** array within the database.  if any need to contain 1000 or more entries, it will result in corrupted data in the database!

The default of 6 packed digits should be a suitable compromise between processing efficiency and likely maximum array size: it will only be problematic if you have arrays that require more than 1 million members.  Remember that, as in the way we handle individual person ids in our example, you can always use a numerically-keyed object instead: these have no limits on the number of entries you can store.


### Identifying Array Nodes and Members

You can determine whether or not a *node* represents an Array by applying its *isArray* property:

        let person = new glsdb.node('Person.1');
        let firstName = person.$('firstName');
        console.log(firstName.isArray);            // false
        let colours = person.$('favouriteColours');
        console.log(colours.isArray);              // true        

You can also determine whether or not a *node* represents the member of an Array by applying its *isArrayMember* property:

        let colour0 = new glsdb.node('Person.1.favouriteColours[0]');
        console.log(colour0.isArrayMember);        // true


### Accessing Array Members

#### Basic Access to Array Members

You've already seen that you can use the *$(key)* method to access any object key, eg:

        let person = new glsdb.node('Person.1');
        let firstName = person.$('firstName');

To access members of an Array *node*, you can use the corresponding *_(index)* method, eg:

        let person = new glsdb.node('Person.1');
        let favouriteColour = person.$('favouriteColour');
        let firstColour = favouriteColour._(0);

and to get its value:

        console.log(firstColour.value);   // blue


You may find it interesting to examine such an Array element *node*:

        firstColour.keys    //  [ 'Person', 1, 'favouriteColour', '[000000]' ]
        firstColour.key     //  [000000]
        firstColour.path    //  Person.1.favouriteColour[0]


So you can see how the *key*  and *keys* properties reflect the physical storage, but *path* reflects its logical representation.

So you could also use the following to access the first colour element *node* directly:

        let colour0 = new glsdb.node('Person.1.favouriteColour[0]');

#### Array *node* Methods

The Array access mechanisms described above are clearly fairly verbose, so to make life easier and simpler, *glsdb* provides a number of useful convenience functions specifically for Array *node*s that emulate their JavaScript equivalents.

Using the *favouriteColour* *node* as an example, since this is an Array Node:

        let colours = new glsdb.node('Person.1.favouriteColours');

We can find out how many members there are in the Array *node* using the *length* property:

        console.log(colours.length);    // 2


(Note: the *length* property can be used for any *node*, whether or not it's an Array, to tell you the number of ChildNodes it currently has).


We can get the value for a specific index within the persistent array using the *at()* method, eg:

        console.log(colours.at(1));    // green

You can remove the first and/or last values from the persistent Array and return them using *shift()* and *pop()*:

        let firstColour = colours.shift();

        let lastColour = colours.pop();

You can determine whether or not the Array contains a particular value using *includes()*, or find the index of a member matching a value using *indexOf()*.

In all cases, the arguments of these methods mirror those of their equivalents for standard in-memory JavaScript Arrays.


#### Setting Array Members

You've already seen that if you use the *document setter*, any JavaScript arrays will be automatically saved in the correct way.

You can also set array members directly in-situ within the database, eg let's add a third favourite colour to our example database person record:

        let person = new glsdb.node('Person.1');
        let favouriteColour = person.$('favouriteColour');
        favouriteColour._(2).value = 'red';

Of course we could also do this instead:

        let favouriteColour = new glsdb.node('Person.1.favouriteColour');
        favouriteColour.delete();
        favouriteColour.document = ['blue', 'green', 'red'];

This would replace the existing *favouriteColour* Array values with a new set.

Once again, these are fairly verbose and cumbersome, so you can use the methods specific to Array *node*s to simplify things.  If we get the *favouriteColours* Array *node*:

        let colours = new glsdb.node('Person.1.favouriteColours');

Then we can append new values using the *push()* method:

        colours.push('orange');

or add a new value to the start of the Array *node*:

        colours.unshift('yellow');

We can insert one or more new members into the Array using *splice()*, eg:

        colours.splice(1, 2, 'orange');

or concatenate new arrays into the existing persistent one using *concat()*, eg:

        let newArr = ['black', 'white'];
        colours.concat(newArr);


## Locking Records

Global Storage databases are designed for multi-user access, but that means you need to be able to protect against two or more people trying to modify the same data simultaneously.

A simple mechanism provided by Global Storage databases is the means to Lock a specified Global Node (which may or may not physically exist at the time of the Lock).  Global Storage databases allow only one user at a time to Lock a specified Global Node: any one else attempting to Lock that Global Node will be suspended until either:

- the Lock is released by the other user
- the attempt to Lock the Global Node exceeds a timeout

Provided you are using a module library such as *QOper8-cp*, then this blocking behaviour will not matter, since each user's logic will be running in its own private Child Process or Worker Thread container without any concurrency to worry about.  The main Node.js thread will be running asynchronously and will be unaffected by any Locks taking place in Workers.

To lock a *node*, simply invoke its *lock()* method, eg:

        let success = person.lock(5);  // 5 second timeout
        if (!success) {
          // failed to set the lock on the person node
        }
        else {
          // proceed to update the person record
        }

To release a lock:

        person.unlock();


