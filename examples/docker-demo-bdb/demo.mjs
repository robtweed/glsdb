const {glsDB} = await import('glsdb');

let glsdb = new glsDB('bdb');

// Berkely DB Connection parameters:

let options = {
  db_library: "/usr/local/BerkeleyDB.18.1/lib/libdb.so",
  db_file: "/opt/bdb/my_bdb_database.db",
  env_dir: "/opt/bdb",
  key_type: "m"
};

glsdb.open(options);

let PersonId = new glsdb.node('PersonId').proxy;
let Person = new glsdb.node('Person').proxy;

PersonId.id++;
let id = PersonId.id.valueOf();

let record = {
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

Person[id] = record;

console.log('--------');

let person = new glsdb.node('Person.1').proxy;
let data = person.valueOf();
console.log(data);

console.log('---------');

let name = person.firstName.valueOf() + ' ' + person.lastName.valueOf();
console.log(name);

console.log('----------');
console.log('in for object');

for (let name in person) {
  console.log(name + ': ' + person[name].valueOf());
}

console.log('----------');
console.log('of for object');

for (let name of person) {
  console.log('name: ' + name);
}

console.log('----------');
console.log('in for array');

for (let name in person.favouriteColours) {
  console.log('name: ' + name);
}

console.log('----------');
console.log('of for array');

for (let name of person.favouriteColours) {
  console.log('name: ' + name);
}

console.log('----  entries  ------');

for (const [key, value] of Object.entries(person.favouriteColours)) {
  console.log(`${key}: ${value}`);
}

console.log('----  keys  ------');

for (const name of Object.keys(person)) {
  console.log('name = ' + name);
}

console.log('----  values  ------');

let arr = Object.values(person);
console.log(arr);
console.log(arr[2].valueOf());

console.log('--- using array node ----');
arr = Object.values(person.favouriteColours)

console.log(arr);
console.log(arr[0].valueOf());


console.log('----  hasOwn  ------');

let status = Object.hasOwn(person, 'firstNamex');
console.log('firstNamex = ' + status);
status = Object.hasOwn(person, 'firstName');
console.log('firstName = ' + status);

//Examples of delete:

// delete person.address.city;
// delete person.telephone;
// delete Person[id];



// entire database
//Person._delete();

glsdb.close();
