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


*glsdb* can also be used with the [*mg-dbx-bdb*]() interface, which creates a Global Storage Database emulation for:

- [Berkeley DB](https://www.oracle.com/uk/database/technologies/related/berkeleydb.html)
- [LMDB](http://www.lmdb.tech/doc/)

*glsdb* can also be used with the Redis Database, using the Global Storage emulation included with this repository.

Usage details to follow...



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
