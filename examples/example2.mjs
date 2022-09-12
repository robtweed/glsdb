const {glsDB} = await import('glsdb');

let glsdb = new glsDB('iris');

let options = {
  connection: 'network',
  host: '172.17.0.2',
  tcp_port: 7042,
  username: "_SYSTEM",
  password: "SW193dy",
  namespace: "USER"
}


/*
let pgsdb = new glsDB('ydb');
let options = {
  connection: 'api',
  path: '/usr/local/lib/yottadb/r134/',
  env: {
    ydb_dir: '/opt/yottadb',
    ydb_gbldir: '/opt/yottadb/yottadb.gld',
    ydb_routines: '/opt/fastify-qoper8/m /usr/local/lib/yottadb/r134/libyottadbutil.so',
    ydb_ci: '/usr/local/lib/yottadb/r134/zmgsi.ci'
  }
}
*/


/*

let options = {
  connection: 'network',
  host: 'localhost',
  tcp_port: 7041
}

*/

glsdb.open(options);

console.log(glsdb.version);


/*
let node = new glsdb.node('Person[1].hello.there[2]');

node.value = "Rob Tweed";

let name = node.value;
console.log(name);
console.log(node);
console.log(node.exists);


//let res = node.delete();
//console.log(res);
//console.log(node.exists);

console.log(node.increment());
console.log(node.increment(2));

let node2 = new glsdb.node('Person.x');
node2.$('a').value = 'hello a';
node2.$(['c', 'd', 'e']).value = 'Can you see this?';
node2.$('e').value = 'hello e';
node2.$('g').value = 'hello g';
node2.$(['h', '[0]']).value = 'hello g';

console.log(node2);

console.log(222222);
console.log(node2.$h._0);
console.log(222222);


console.log('Nodes around Person.x:');
console.log('-----');
console.log('first child: ');
let n = node2.firstChild;
console.log(n);
console.log('exists: ' + n.exists);
console.log('hasChildren: ' + n.hasChildren);
console.log('isLeafNode: ' + n.isLeafNode);
console.log('value: ' + n.value);
console.log('-----');
console.log('nextSibling: ');
let s = n.nextSibling;
console.log(s);
console.log('exists: ' + s.exists);
console.log('hasChildren: ' + s.hasChildren);
console.log('isLeafNode: ' + s.isLeafNode);
console.log('value: ' + s.value);
console.log('previous node now: ' );
console.log(n);
console.log('-----');
console.log('last child: ');
n = node2.lastChild;
console.log(n);
console.log('hasChildren: ' + n.hasChildren);
console.log('isLeafNode: ' + n.isLeafNode);
console.log('value: ' + n.value);
console.log('-----');
let nc = n._(0);
console.log('_0 child...');
console.log(nc);
console.log('parent now: ' );
console.log(n);
console.log('-----');
console.log('previousSibling: ');
n = n.previousSibling;
console.log(n);
console.log('exists: ' + n.exists);
console.log('hasChildren: ' + n.hasChildren);
console.log('isLeafNode: ' + n.isLeafNode);
console.log('value: ' + n.value);


console.log('*************');

let count = 0;
node2.forEachChildNode(function(childNode) {
  count++;
  console.log(childNode.key + ': ' + childNode.value);
  //if (count === 2) return false;
});


let children = node2.children;
console.log('%%%%%%%');
console.log(children);


let status = node2.lock(10);
console.log('lock: ' + status);

node2.unlock();

console.log('&&&&&&&&&&&&&');
console.log(node2.keys);
console.log(node2.name);

let leaves = node2.leafNodes;
leaves.forEach(function(node) {
  console.log(node.keys + ': ' + node.value);
});


/*

let childNode = node2.firstChild;
console.log(childNode);
console.log(childNode.value);
console.log(childNode.name);

console.log('-----');
let sibling = childNode.nextSibling;
console.log(sibling);
console.log(sibling.value);
console.log('-----');

console.log('-----');
sibling = sibling.nextSibling;
console.log(sibling);
console.log(sibling.value);
console.log('-----');

console.log('+++++');
sibling = sibling.previousSibling;
console.log(sibling);
console.log(sibling.value);
console.log('++++');

console.log('+++++');
sibling = sibling.previousSibling;
console.log(sibling);
console.log(sibling.value);
console.log('++++');

console.log('!!!!!');
let parent = sibling.parent;
console.log(parent);
console.log(parent.value);
console.log(sibling);
console.log('!!!!!');

console.log('-----');
parent = parent.parent;
console.log(parent);
console.log(parent.value);
console.log('-----');



childNode = node2.lastChild;
console.log(childNode);
console.log(childNode.value);
console.log(childNode.name);

childNode = node2.$('c');
console.log(childNode);
console.log(childNode.value);
console.log(childNode.name);

console.log(node2);
console.log(node2.$c.value);

childNode = node2.$(['c','d','e']);
console.log(childNode);
console.log(childNode.value);
console.log(childNode.name);

console.log(node2);


let dir = glsdb.directory;
console.log(dir);

glsdb.forEachGlobal({from: 'P'}, function(name) {
  if (!name.startsWith('P')) return false;
  console.log(name);
});

let rob = new glsdb.node('rob.hello');
rob.$('a').value = 123;
let ok = rob.$('b').import(node2);
console.log('ok = ' + JSON.stringify(ok));

*/

//let fn = glsdb.fn('add^robtest');
//let result = fn(31,52);
let result = glsdb.function('add^robtest')(3,19);

console.log('result = ' + result);

//ok = glsdb.exec('add^robtest', 3, 5);
//console.log('ok = ' + JSON.stringify(ok));


glsdb.close();
