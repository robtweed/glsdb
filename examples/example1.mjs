const {glsDB} = await import('glsdb');

let isdb = new glsDB('iris');

// IRIS network connection (Docker IRIS version on port 7042)

let options = {
  connection: 'network',
  host: '172.17.0.2',
  tcp_port: 7042,
  username: "_SYSTEM",
  password: "SYS",
  namespace: "SAMPLES"
}

/*
let isdb = new glsDB('ydb');

// YottaDB local API connection

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

//YottaDB Network connection on port 7041

let options = {
  connection: 'network',
  host: 'localhost',
  tcp_port: 7041
}

*/

isdb.open(options);

let node2 = new isdb.node('Person.x');

let o = node2.getDocument;

console.log('o: ' + JSON.stringify(o, null, 2));


let obj = {
  foo: {
    bar: [1,2,3],
    bar2: {
      a: 123,
      b: ["x","y","z"],
      c: true
    },
    bar3: [
      {e: 123},
      {r: "hhh"}
    ]
  },
  arr: ["x","y", 123]
};



/*
let obj = {
  foo: [
    {a: 123},
    {b: 234}
  ]
};
*/

/*

let obj = {
  foo: 'bar',
  foo2: 'bar2',
  x: 123
}
*/

//let obj = ["x","y","z"];

node2.$('test').setDocument(obj);


let o2 = node2.$test.getDocument;
console.log(JSON.stringify(o2, null, 2));

console.log(JSON.stringify(node2.$('test').$('arr').getDocument))



isdb.close();
