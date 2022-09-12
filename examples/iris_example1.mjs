// Demonstrating some of the IRIS Object abstraction capabilities

const {glsDB} = await import('glsdb');

let glsdb = new glsDB('iris');

let options = {
  connection: 'network',
  host: '172.17.0.2',
  tcp_port: 7042,
  username: "_SYSTEM",
  password: "SYS",
  namespace: "SAMPLES"
}

glsdb.open(options);

console.log(glsdb.version);

let Employee = glsdb.irisClass('Sample.Employeexxx');
console.log(Employee);

Employee = glsdb.irisClass('Sample.Employee');

let employee = new Employee(101);
//console.log(employee);
console.log('Properties: ' + JSON.stringify(employee.properties));

let salary = employee.Salary;
console.log('employee.Salary = ' + salary);

let company = employee.Company;

console.log('Properties: ' + JSON.stringify(company.properties));

let name = company.Name;
console.log('Name: ' + name);

console.log(22222);
console.log(employee.Company.Name);



glsdb.close();


