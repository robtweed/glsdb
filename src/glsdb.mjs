/*
 ----------------------------------------------------------------------------
 | glsDB: Global Storage Database Abstraction                                |
 |                                                                           |
 | Copyright (c) 2022 M/Gateway Developments Ltd,                            |
 | Redhill, Surrey UK.                                                       |
 | All rights reserved.                                                      |
 |                                                                           |
 | http://www.mgateway.com                                                   |
 | Email: rtweed@mgateway.com                                                |
 |                                                                           |
 |                                                                           |
 | Licensed under the Apache License, Version 2.0 (the "License");           |
 | you may not use this file except in compliance with the License.          |
 | You may obtain a copy of the License at                                   |
 |                                                                           |
 |     http://www.apache.org/licenses/LICENSE-2.0                            |
 |                                                                           |
 | Unless required by applicable law or agreed to in writing, software       |
 | distributed under the License is distributed on an "AS IS" BASIS,         |
 | WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  |
 | See the License for the specific language governing permissions and       |
 |  limitations under the License.                                           |
 ----------------------------------------------------------------------------

15 September 2022

 */

import { createRequire } from 'module'; 
import path from 'path';

class glsDB {

  #getVersion;

  constructor(db, options) {

    const modulesPath = path.resolve(process.cwd(), 'node_modules');
    const localRequire = createRequire(modulesPath);

    options = options || {};
    let maxArrayDigits = options.maxArrayDigits || 6;
    let arrayPadChar = options.arrayPadChar || '0';

    function isArrayKey(key) {
      return (key[0] === '[' && key.slice(-1) === ']');
    }

    function extractArrayValue(key) {
      if (isArrayKey(key)) {
        let value = key.split('[')[1];
        return value.split(']')[0];
      }
      return key;
    }

    function setArrayValue(value) {

      function isNormalInteger(str) {
        if (str.toString() === '0') return true;
        return /^\+?(0|[1-9]\d*)$/.test(str);
      }

      function pad(n, width, z) {
        z = z || arrayPadChar;
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
      }

      let isArrKey = isArrayKey(value);
      value = extractArrayValue(value);
      if (typeof value !== 'undefined' && value !== '' && isNormalInteger(value)) {
        // pack with leading characters to ensure collating sequence
        value = pad(value, maxArrayDigits);
      }
      if (isArrKey) value = '[' + value + ']';
      return value;
    }

    function getArrayValue(string) {
      if (!isArrayKey(string)) return string;
      string = extractArrayValue(string);
      // remove leading zeros
      let value = string.replace(/^0+/, '');
      if (value === '') value = 0;
      return parseInt(value);
    }

    if (!db || db === '') return {ok: false};
    db = db.toLowerCase();

    let db_module = new Map();
    db_module.set('bdb', {
      type: 'BDB',
      module: 'mg-dbx-bdb',
      dbx: 'dbxbdb'
    });

    db_module.set('lmdb', {
      type: 'LMDB',
      module: 'mg-dbx-bdb',
      dbx: 'dbxbdb'
    });

    db_module.set('redis', {
      type: 'Redis',
      module: './mg-dbx-redis.js',
      dbx: 'dbx'
    });

    db_module.set('yottadb', {
      type: 'YottaDB',
      module: 'mg-dbx',
      dbx: 'dbx'
    });

    db_module.set('ydb', {
      type: 'YottaDB',
      module: 'mg-dbx',
      dbx: 'dbx'
    });

    db_module.set('iris', {
      type: 'IRIS',
      module: 'mg-dbx',
      dbx: 'dbx'
    });

    db_module.set('cache', {
      type: 'Cache',
      module: 'mg-dbx',
      dbx: 'dbx'
    });


    if (!db_module.has(db)) return {ok: false};
    let dbm = db_module.get(db);

    // if possible load the pre-built mg-dbx binaries...

    let arch = process.arch;
    let version = process.version.split('.')[0];
    if (dbm.module === 'mg-dbx' && ['arm', 'arm64', 'x64'].includes(arch)) {
      if (['v18'].includes(version)) {
        dbm.module = 'glsdb/mgdbx-' + arch + '-' + version';
      }
    }

    if (dbm.module === 'mg-dbx-bdb' && ['arm', 'arm64', 'x64'].includes(arch)) {
      if (['v18'].includes(version)) {
        dbm.module = 'glsdb/mgdbx-bdb-' + arch + '-' + version;
      }
    }

    const db_mod = localRequire(dbm.module);
    const dbx = db_mod[dbm.dbx];
    const mglobal = db_mod.mglobal;
    let DB = new dbx();

    let glsdb = this;
  
    this.open = function(params) {
      let options = {
        type: dbm.type
      };

      if (dbm.type === 'YottaDB' && params.connection === 'api') {
        let str = '';
        for (const name in params.env) {
          str = str + name + '=' + params.env[name] + '\n';
        }
        str = str + '\n';
        options.env_vars = str;
        options.path = params.path
      }
      else {
        for (const name in params) {
          if (name !== 'connection') {
            options[name] = params[name];
          }
        }
      }

      DB.open(options);
    };

    this.close = function() {
      DB.close();
      console.log('DB.close() completed');
    }

    this.node = class{

      #globalNode;

      constructor(path) {

        function unpadded(arr) {
          let keys = [...arr];
          for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (isArrayKey(key)) {
              keys[i] = '[' + getArrayValue(key) + ']';
            }
          }
          return keys;
        }

        function toPaddedKeys(p) {
          let keyArr;
          if (Array.isArray(p)) {
            keyArr = [...p];
          }
          else {
            keyArr = p.match(/\[([0-9]+)\]|[^\]\[.]+/g);
          }
          for (let i = 0; i < keyArr.length; i++) {
            keyArr[i] = setArrayValue(keyArr[i]);
          }
          return keyArr;
        }

        function toKeys(p) {
          return p.match(/\[([0-9]+)\]|[^\]\[.]+/g);
        }

        function toPath(keyArr) {
          let keys = [...keyArr];
          let path = '';
          let delim = '';
          for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            if (isArrayKey(key)) {
              key = '[' + getArrayValue(key) + ']';
              path = path + key;
            }
            else {
              path = path + delim + key;
              delim = '.';
            }
          }
          return path;
        }

        //console.log('**** path = ' + JSON.stringify(path));
        let keys = path;
        if (!Array.isArray(path)) {
          //console.log('**** path is a string ***');
          keys = toKeys(path);
          this._keys = keys;
          this.keys = toPaddedKeys(path);
        }
        else {
          //console.log('*** path is an array ***');
          this._keys = unpadded(keys);
          this.keys = toPaddedKeys(keys);
        }

        if (dbm.type === 'Redis') {
          this.#globalNode = new DB.mglobal(this.keys);
        }
        else {
          //this.#globalNode = DB.mglobal(...this.keys);
          this.#globalNode = new mglobal(DB, ...this.keys);
        }
        this.path = toPath(keys);
        this.name = keys[0];
        this.key = '';
        if (keys.length > 1) {
          this.key = this.keys[this.keys.length - 1];
        }
      }

      set value(val) {
        this.#globalNode.set(val);
      }
      get value() {
        let value = this.#globalNode.get();
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        return value;
      }

      delete() {
        this.#globalNode.delete();
      }

      get exists() {
        return (this.#globalNode.defined() !== '0');
      }

      get hasChildren() {
        let def = this.#globalNode.defined();
        return (def === '10' || def === '11');
      }

      get isLeafNode() {
        return (this.#globalNode.defined() === '1');
      }

      get hasValue() {
        return (this.#globalNode.defined() === '1');
      }

      increment(amount) {
        amount = amount || 1;
        return this.#globalNode.increment(amount);
      }

      get firstChild() {
        let key = '';
        key = this.#globalNode.next(key);
        if (key !== '') {
          let _keys = [...this.keys];
          _keys.push(key);
          return new glsdb.node(_keys);
        }
      }

      get lastChild() {
        let key = '';
        key = this.#globalNode.previous(key);
        if (key !== '') {
          let _keys = [...this.keys];
          _keys.push(key);
          return new glsdb.node(_keys);
        }
      }

      get parent() {
        if (this.parentNode) return this.parentNode;
        let _keys = [...this.keys];
        let keys = _keys.slice(0, -1);
        if (keys.length > 0) {
          let parent = new glsdb.node(keys);
          this.parentNode = parent;
          return parent;
        }
      }

      get nextSibling() {
        let key = this.key;
        if (key === '') return;
        let parent = this.parent;
        key = parent.#globalNode.next(key);
        if (key !== '') {
          let _keys = [...parent.keys];
          _keys.push(key);
          return new glsdb.node(_keys);
        }
      }

      get previousSibling() {
        let key = this.key;
        if (key === '') return;
        let parent = this.parent;
        key = parent.#globalNode.previous(key);
        if (key !== '') {
          let _keys = [...parent.keys];
          _keys.push(key);
          return new glsdb.node(_keys);
        }
      }

      getChild(key) {
        let _keys = [...this.keys];
        _keys.push(key);
        let newNode = new glsdb.node(_keys);
        if (isArrayKey(key)) {
          let value = getArrayValue(key);
          this['_' + value] = newNode;
          this['$[' + value + ']'] = newNode;
        }
        else {
          this['$' + key] = newNode;
        }
        return newNode;
      }

      $(keys) {
        if (Array.isArray(keys)) {
          let node = this;
          for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            node = node.getChild(key);
          }
          return node;
        }
        else {
          return this.getChild(keys);
        }
      }

      _(key) {
        // Array node
        let _key = '[' + key + ']';
        //console.log('*** _ key: ' + _key + '; ' + setArrayValue(_key));
        return this.getChild(setArrayValue(_key));
      }

      forEachChildNode(options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        let key = '';
        let endKey = '';
        let fn = 'next';
        if (options.direction && (options.direction === 'reverse' || options.direction === 'backwards')) {
          fn = 'previous';
        }
        if (options.startsWith) {
          let seedNode = this.$(options.startsWith).previousSibling;
          if (seedNode) key = seedNode.key;
        }
        if (options.from) {
          let seedNode = this.$(options.from).previousSibling;
          if (seedNode) key = seedNode.key;
        }
        if (options.to) {
          let endNode = this.$(options.to).nextSibling;
          if (endNode) endKey = endNode.key;
        }
        let stop = false;
        while (!stop && (key = this.#globalNode[fn](key)) != "") {
          if (options.startsWith && !key.startsWith(options.startsWith)) {
            stop = true;
            break;
          }
          if (key === endKey) {
            stop = true;
            break;
          }
          if (callback) {
            let _keys = [...this.keys];
            _keys.push(key);
            let childNode = new glsdb.node(_keys);
            let ok = callback(childNode);
            if (ok === false) stop = true;
          }
        }
      }

      get childNodes() {
        let results = [];
        this.forEachChildNode(function(node) {
          results.push(node);
        });
        return results;
      }

      get children() {
        return this.childNodes;
      }

      lock(timeout) {
        timeout = timeout || -1;
        let status = this.#globalNode.lock(timeout);
        return (status === '1');
      }

      unlock() {
        let status = this.#globalNode.unlock();
        return (status === '1');
      }

      import(node) {
        return this.#globalNode.merge(node.#globalNode);
      }

      forEachLeafNode(options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        let mcursor = db_mod.mcursor;
        let direction = options.direction || 'forwards';
        if (direction !== 'forwards' && direction !== 'backwards' && direction !== 'reverse') {
          direction = 'forwards';
        }
        let opts = {
          multilevel: true,
          getdata: false
        };
        let global = {
          global: this.name
        }
        global.key = [];
        for (let i = 1; i < this.keys.length; i++) {
          global.key.push(this.keys[i].toString());
        }
        let query = new mcursor(DB, global, opts);
        let result;
        let results = [];
        let stop = false;
        if (direction === 'forwards') {
          while (!stop && (result = query.next()) !== null) {
            if (callback) {
              let keys = [...result.key];
              keys.unshift(this.name)
              let status = callback(new glsdb.node(keys));
              if (status === false) stop = true;
            }
          }
        }
        else {
          while (!stop && (result = query.previous()) !== null) {
            if (callback) {
              let keys = [...result.key];
              keys.unshift(this.name)
              let status = callback(new glsdb.node(keys));
              if (status === false) stop = true;
            }
          }
        }
        return results;
      }

      get leafNodes() {
        let results = [];
        this.forEachLeafNode(function(node) {
          results.push(node);
        });
        return results;
      }

      get getDocument() {
        if (!this.hasChildren) return this.value;
        let obj = {};
        let baseKeyLength = this.keys.length;
        if (isArrayKey(this.firstChild.key)) obj = [];
        this.forEachLeafNode(function(node) {
          // ignore any data nodes if they also have children)
          if (!node.hasChildren) {
            let keys = [...node.keys];
            keys.splice(0, baseKeyLength);
            let o = obj;
            keys.forEach(function(key, index) {
              if (isArrayKey(key)) {
                key = getArrayValue(key);
              }
              if (index === (keys.length - 1)) {
                o[key] = node.value;
              }
              else {
                let nextKey = keys[index + 1];
                if (isArrayKey(nextKey)) {
                 if (typeof o[key] === 'undefined') o[key] = [];
                }
                else {
                  if (typeof o[key] === 'undefined') o[key] = {};
                }
                o = o[key];
              }
            });
          }
        });
        return obj;
      }

      setDocument(obj, parsed) {
        if (!parsed) {
          obj = JSON.parse(JSON.stringify(obj));
          parsed = true;
        }
        let isArray = Array.isArray(obj);
        if (isArray && obj.length === 0) return;
        for (let key in obj){
          let childNode;
          if (isArray) {
            childNode = this._(key);
          }
          else {
            childNode = this.$(key);
          }
          let childObj = obj[key];
          if (childObj === null || typeof childObj === 'undefined') childObj = '';
          if (typeof childObj === 'object') {
            childNode.setDocument(childObj, parsed);
          }
          else if (typeof childObj === 'function') {
            return;
          }
          else {
            childNode.value = obj[key].toString();
          }
        }
      }
    
    };

    this.#getVersion = function() {
      return DB.version();
    }

    if (dbm.type === 'IRIS' || dbm.type === 'Cache' || dbm.type === 'YottaDB') {

      this.function = function(fn) {
        return function() {
          return DB.function(fn, ...arguments);
        };
      }
    }
    
    this.forEachGlobal = function(options, callback) {
      if (!callback && typeof options === 'function') {
        callback = options;
        options = {};
      }
      let mcursor = db_mod.mcursor;
      let stop = false;
      let result;
      let from = options.from || '';
      let query = new mcursor(DB, {global: from}, {globaldirectory: true});
      while (!stop && (result = query.next()) !== null) { 
        let name = result.split('^')[1];
        if (callback && typeof callback === 'function') {
          let status = callback(name);
          if (status === false) stop = true;
        }
      }
    };

    if (dbm.type === 'IRIS' || dbm.type === 'Cache' || dbm.type === 'YottaDB') {

      this.transaction = {

        start: function() {
          return DB.tstart();
        },

        level() {
          return DB.tlevel();
        },

        commit: function() {
          return DB.tcommit();
        },

        rollback: function() {
          return DB.trollback();
        }
      };
    }

    if (dbm.type === 'IRIS' || dbm.type === 'Cache') {
      let mclass = db_mod.mclass;
      this.classMethod = function(cls, method) {
        let args = [...arguments];
        args.splice(0, 2);
        return DB.classmethod(cls, method, ...args);
        //return new mclass(DB, cls, method, ...args);
      }

      this.irisClassExists = function(clsName) {
        let packageName = DB.classmethod(clsName, "%PackageName");
        //let packageName = new mclass(DB, clsName, "%PackageName");
        if (packageName === '') return false;
        let className = DB.classmethod(clsName, "%ClassName");
        //let className = new mclass(DB, clsName, "%ClassName");
        if (className === '') return false;
        let fqn = packageName + '.' + className;
        return (DB.classmethod('%Dictionary.ClassDefinition', "%ExistsId", fqn) === '1');
        //return (new mclass(DB, '%Dictionary.ClassDefinition', "%ExistsId", fqn) === '1');
      }

      this.irisClass = function(clsName) {

        let packageName = DB.classmethod(clsName, "%PackageName");
        //let packageName = new mclass(DB, clsName, "%PackageName");
        if (packageName === '') return null;
        let className = DB.classmethod(clsName, "%ClassName");
        //let className = new mclass(DB, clsName, "%ClassName");
        if (className === '') return null;
        let fqn = packageName + '.' + className;

        let properties = {};
        let methods = {}

        let classExists = (DB.classmethod('%Dictionary.ClassDefinition', "%ExistsId", fqn) === '1');
        //let classExists = (new mclass(DB, '%Dictionary.ClassDefinition', "%ExistsId", fqn) === '1');

        let ClassDefinition = DB.classmethod('%Dictionary.ClassDefinition', "%OpenId", fqn);
        //let ClassDefinition = new mclass(DB, '%Dictionary.ClassDefinition', "%OpenId", fqn);

        if (ClassDefinition !== '') {
          let Properties = ClassDefinition.getproperty('Properties');
          let count = +Properties.method('Count');
          for (let i = 1; i < (count + 1); i++) {
            let property = Properties.method('GetAt', i);
            let name = property.getproperty('Name');
            properties[name] = true;
          }

          let Methods = ClassDefinition.getproperty('Methods');
          count = +Methods.method('Count');
          for (let i = 1; i < (count + 1); i++) {
            let method = Methods.method('GetAt', i);
            let name = method.getproperty('Name');
            methods[name] = true;
          }
        }
        return class {

          constructor(id) {
            this.name = clsName;
            this.packageName = packageName;
            this.className = className;
            this.fqn = fqn;
            this.properties = properties;
            this.methods = methods;
            this.classExists = classExists;

            if (typeof id === 'object' && id.method) {
              return this.#proxy(id);
            }

            if (id) {
              let obj = DB.classmethod(this.fqn, "%OpenId", id);
              //let obj = new mclass(DB, this.fqn, "%OpenId", id);
              return this.#proxy(obj);
            }
            else {
              let obj = DB.classmethod(this.fqn, "%New");
              //let obj = new mclass(DB, this.fqn, "%New");
              return this.#proxy(obj);
            }

          }

          #proxy(obj) {

            let iris = this;
 
            let handler = {
              get(target, prop, receiver) {
                console.log('** get proxy prop = ' + prop);
                if (prop === 'save') {
                  return function() {
                    return obj.method('%Save', ...arguments);
                  };
                }

                if (iris.methods[prop]) {
                  return function() {
                    return obj.method(prop, ...arguments);
                  };
                }
                if (iris.properties[prop]) {
                  let property = obj.getproperty(prop);
                  if (typeof property === 'object' && property.method) {
                    let fqn = property.method('%PackageName') + '.' + property.method('%ClassName');
                    let cls = glsdb.irisClass(fqn);
                    return new cls(property);
                  }
                  return property;
                }
                if (target[prop]) {
                  return target[prop];
                }
                return '';
              },
              set(target, prop, value) {
                if (iris.properties[prop]) {
                  obj.setproperty(prop, value);
                }
                return true;
              }
            };
            return new Proxy(this, handler);
          }

          set(obj) {
            for (let name in obj) {
              this[name] = obj[name];
            }
            return this.save();
          }
        };
      };
    }
  }

  get version() {
    return this.#getVersion();
  }

  get directory() {
    let results = [];
    this.forEachGlobal(function(name) {
      results.push(name);
    });
    return results;
  }

}

export {glsDB};

