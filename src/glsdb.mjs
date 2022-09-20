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

16 September 2022

 */

import { createRequire } from 'module'; 
import path from 'path';

class glsDB {

  #getVersion;
  #node;

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
      //console.log('isArrKey: ' + isArrKey);
      if (isArrKey) {
        value = extractArrayValue(value);
        if (typeof value !== 'undefined' && value !== '' && isNormalInteger(value)) {
          // pack with leading characters to ensure collating sequence
          value = pad(value, maxArrayDigits);
        }
        value = '[' + value + ']';
      }
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
    if (arch === 'x64' && process.platform === 'win32') arch = 'win';
    let version = process.version.split('.')[0];
    if (dbm.module === 'mg-dbx' && ['win', 'arm', 'arm64', 'x64'].includes(arch)) {
      if (['v14', 'v16', 'v18'].includes(version)) {
        dbm.module = 'glsdb/mgdbx-' + arch + '-' + version;
      }
    }

    if (dbm.module === 'mg-dbx-bdb' && ['win', 'arm', 'arm64', 'x64'].includes(arch)) {
      if (['v14', 'v16', 'v18'].includes(version)) {
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
      //console.log('DB.close() completed');
    }

    function __setDocument(node, obj, parsed) {

          if (!parsed) {
            obj = JSON.parse(JSON.stringify(obj));
            parsed = true;
          }
          let isArray = Array.isArray(obj);
          if (isArray && obj.length === 0) return;
          for (let key in obj){
            let childNode;
            if (isArray) {
              childNode = node._(key);
            }
            else {
              //childNode = this.$(key);
              childNode = getChildNode(node, key);
            }
            let childObj = obj[key];
            if (childObj === null || typeof childObj === 'undefined') childObj = '';
            if (typeof childObj === 'object') {
              __setDocument(childNode, childObj, parsed);
              //childNode._setDocument(childObj, parsed);
            }
            else if (typeof childObj === 'function') {
              return;
            }
            else {
              //childNode._value = obj[key].toString();
              let globalNode = new mglobal(DB, ...childNode._keys);
              globalNode.set(obj[key].toString());
            }
          }
    }

    function getChildNode(node, key) {
      let _keys = [...node.__keys];
      _keys.push(key);
      return new glsdb.node(_keys);
    }

    this.node = class {

      #globalNode;

      constructor(path) {

        //console.log('#node constructor with path = ');
        //console.log(path);

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
          this.__keys = keys;
          this._keys = toPaddedKeys(path);
        }
        else {
          //console.log('*** path is an array ***');
          this.__keys = unpadded(keys);
          //console.log(this.__keys);
          this._keys = toPaddedKeys(keys);
          //console.log(this._keys);
        }

        if (dbm.type === 'Redis') {
          this.#globalNode = new DB.mglobal(this._keys);
        }
        else {
          //this.#globalNode = DB.mglobal(...this._keys);
          this.#globalNode = new mglobal(DB, ...this._keys);
        }
        this._path = toPath(keys);
        this._name = keys[0];
        this._key = '';
        if (keys.length > 1) {
          this._key = this._keys[this._keys.length - 1];
        }

      }

      _proxy() {

        let node = this;

        let handler = {
          get(target, prop, receiver) {
            console.log('** get proxy prop = ' + prop);

            if (['_delete', '_increment', '_forEachChildNode', '_forEachLeafNode', '_lock', '_unlock', '$', '_', '_getChild'].includes(prop)) {
              //console.log('return function from proxy');
              return function() {
                let args = [...arguments];
                if (args.length === 0) {
                  return target[prop]();
                }
                //console.log('args: ');
                //console.log(args);
                return target[prop](...args);
              }
            }

            if (target[prop]) {
              //console.log('prop recognised as property of node');
              return target[prop];
            }
            else {
              //console.log('return value of specified prop');
              let _keys = [...target.__keys];
              _keys.push(prop);
              return new glsdb.node(_keys);
            }
          },

          set(target, prop, value) {

            if (typeof value === 'undefined' || typeof val === 'null') return true;

            console.log('** set proxy prop = ' + prop + '; value = ' + value);
            console.log('target:');
            console.log(target);

            if (prop === '_document') {
              __setDocument(target, value);
              //target._setDocument(value);
              return true;
            }

            if (prop === '_value') {
              console.log('keys:');
              console.log(target._keys);
              let globalNode = new mglobal(DB, ...target._keys);
              globalNode.set(value);
              return true;
            }

            if (typeof value === 'object') {
              console.log('value is an object');
              let _keys = [...target.__keys];
              _keys.push(prop);
              let node = new glsdb.node(_keys);
              console.log('node:');
              console.log(node);
              __setDocument(node, value);
              //node._setDocument(value);
              return true;
            }

            let childNode = getChildNode(target, prop);
            let keys = childNode._keys;
            console.log('keys:');
            console.log(keys);
            let globalNode = new mglobal(DB, ...keys);
            globalNode.set(value);
            return true;
          }
        };
        return new Proxy(this, handler);

      }

      set _value(val) {
        if (typeof val !== 'undefined' && typeof val !== 'null') {
          if (typeof val === 'object') val = JSON.stringify(val);
          this.#globalNode.set(val);
        }
      }
      get _value() {
        let value = this.#globalNode.get();
        if (value === 'true') value = true;
        if (value === 'false') value = false;
        return value;
      }

      _delete() {
        this.#globalNode.delete();
      }

      get _exists() {
        return (this.#globalNode.defined() !== '0');
      }

      get _hasChildren() {
        let def = this.#globalNode.defined();
        return (def === '10' || def === '11');
      }

      get _isLeafNode() {
        return (this.#globalNode.defined() === '1');
      }

      get _hasValue() {
        return (this.#globalNode.defined() === '1');
      }

      get _isArray() {
        let fc = this._firstChild;
        if (!fc) return false;
        return isArrayKey(fc._key);
      }

      get _isArrayMember() {
        return isArrayKey(this._key);
      }

      _increment(amount) {
        amount = amount || 1;
        return this.#globalNode.increment(amount);
      }

      get _firstChild() {
        let key = '';
        key = this.#globalNode.next(key);
        if (key !== '') {
          let _keys = [...this.__keys];
          _keys.push(key);
          return new glsdb.node(_keys);
        }
      }

      get _lastChild() {
        let key = '';
        key = this.#globalNode.previous(key);
        if (key !== '') {
          let _keys = [...this.__keys];
          _keys.push(key);
          return new glsdb.node(_keys);
        }
      }

      get _parent() {
        if (this.parentNode) return this.parentNode;
        let _keys = [...this.__keys];
        let keys = _keys.slice(0, -1);
        if (keys.length > 0) {
          let parent = new glsdb.node(keys);
          this.parentNode = parent;
          return parent;
        }
      }

      get _nextSibling() {
        let key = this._key;
        if (key === '') return;
        let parent = this._parent;
        key = parent.#globalNode.next(key);
        if (key !== '') {
          let _keys = [...parent.__keys];
          _keys.push(key);
          return new glsdb.node(_keys);
        }
      }

      get _previousSibling() {
        let key = this._key;
        if (key === '') return;
        let parent = this._parent;
        key = parent.#globalNode.previous(key);
        if (key !== '') {
          let _keys = [...parent.__keys];
          _keys.push(key);
          return new glsdb.node(_keys);
        }
      }

      _getChild(key) {
        let _keys = [...this.__keys];
        _keys.push(key);
        let newNode = new glsdb.node(_keys);
        if (isArrayKey(key)) {
          let value = getArrayValue(key);
          this['_' + value] = newNode;
          //this['$[' + value + ']'] = newNode;
        }
        else {
          //this['$' + key] = newNode;
        }
        return newNode;
      }

      $(keys) {
        if (Array.isArray(keys)) {
          let node = this;
          for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            node = node._getChild(key);
          }
          return node;
        }
        else {
          return this._getChild(keys);
        }
      }

      _(key) {
        // Array node
        let _key = '[' + key + ']';
        //console.log('*** _ key: ' + _key + '; ' + setArrayValue(_key));
        return this._getChild(setArrayValue(_key));
      }

      // Array-specific methods

      _push(value) {
        if (this._isArray) {
          let lastIndex = this._lastChild._key;
          let index = getArrayValue(lastIndex) + 1;
          this._(index)._value = value;
        }
      }

      _at(index) {
        if (this._isArray) {
          if (index < 0) {
            let lastIndex = getArrayValue(this._lastChild._key);
            index = lastIndex + index + 1;
          }
          return this._(index)._value;
        }
      }

      _concat() {
        if (this._isArray) {
          let args = [...arguments];
          let arr = this._document;
          let newArr = arr.concat(...args);
          this._delete();
          this._document = newArr;
          return newArr;
        }
      }

      _includes(value) {
        if (this._isArray) {
          let found = false;
          this._forEachChildNode(function(memberNode) {
            if (memberNode._value === value) {
              found = true;
              return false;
            }
          });
          return found;
        }
        else {
          return false;
        }
      }

      _indexOf(value) {
        if (this._isArray) {
          let args = [...arguments];
          let arr = this._document;
          let index = arr.indexOf(...args);
          return index;
        }
        else {
          return -1;
        }
      }

      _pop() {
        if (this._isArray) {
          let lastElement = this._lastChild;
          let value = lastElement._value;
          lastElement._delete();
          return value;
        }
      }

      _shift() {
        if (this._isArray) {
          let arr = this._document;
          let value = arr.shift();
          this._delete();
          this._document = arr;
          return value;
        }
      }

      _slice() {
        if (this._isArray) {
          let args = [...arguments];
          let arr = this._document;
          let delArr = arr.slice(...args);
          return delArr;
        }
      }

      _splice() {
        if (this._isArray) {
          let args = [...arguments];
          let arr = this._document;
          let delArr = arr.splice(...args);
          this._delete();
          this._document = arr;
          return delArr;
        }
      }

      _unshift() {
        if (this._isArray) {
          let args = [...arguments];
          let arr = this._document;
          let length = arr.unshift(...args);
          this._delete();
          this._document = arr;
          return length;
        }
      }

      // end of Array methods

      _forEachChildNode(options, callback) {
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
          let childNode = getChildNode(this, options.startsWith);
          let seedNode = childNode._previousSibling;
          if (seedNode) key = seedNode._key;
        }
        if (options.from) {
          let childNode = getChildNode(this, options.from);
          let seedNode = childNode._previousSibling;
          if (seedNode) key = seedNode._key;
        }
        if (options.to) {
          let childNode = getChildNode(this, options.to);
          let endNode = childNode._nextSibling;
          if (endNode) endKey = endNode._key;
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
            let childNode = getChildNode(this, key);
            let ok = callback(childNode);
            if (ok === false) stop = true;
          }
        }
      }

      get _length() {
        let count = 0;
        this._forEachChildNode(function() {
          count++;
        });
        return count;
      }

      get _childNodes() {
        let results = [];
        this._forEachChildNode(function(node) {
          results.push(node);
        });
        return results;
      }

      get _children() {
        return this._childNodes;
      }

      _lock(timeout) {
        timeout = timeout || -1;
        let status = this.#globalNode.lock(timeout);
        return (status === '1');
      }

      _unlock() {
        let status = this.#globalNode.unlock();
        return (status === '1');
      }

      _import(node) {
        return this.#globalNode.merge(node.#globalNode);
      }

      _forEachLeafNode(options, callback) {
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
          global: this._name
        }
        global.key = [];
        for (let i = 1; i < this._keys.length; i++) {
          global.key.push(this._keys[i].toString());
        }
        let query = new mcursor(DB, global, opts);
        let result;
        let results = [];
        let stop = false;
        let startString = this._keys.toString();
        if (direction === 'forwards') {
          while (!stop && (result = query.next()) !== null) {
            let keys = [...result.key];
            keys.unshift(this._name);
            if (!keys.toString().startsWith(startString)) {
              stop = true;
            }
            else {
              if (callback) {
                let status = callback(new glsdb.node(keys));
                if (status === false) stop = true;
              }
            }
          }
        }
        else {
          while (!stop && (result = query.previous()) !== null) {
            let keys = [...result.key];
            keys.unshift(this._name);
            if (!keys.toString().startsWith(startString)) {
              stop = true;
            }
            else {
              if (callback) {
                let status = callback(new glsdb.node(keys));
                if (status === false) stop = true;
              }
            }
          }
        }
        return results;
      }

      get _leafNodes() {
        let results = [];
        this._forEachLeafNode(function(node) {
          results.push(node);
        });
        return results;
      }

      get _document() {
        if (!this._hasChildren) return this._value;
        let obj = {};
        let baseKeyLength = this._keys.length;
        if (isArrayKey(this._firstChild._key)) obj = [];
        this._forEachLeafNode(function(node) {
          // ignore any data nodes if they also have children)
          if (!node._hasChildren) {
            let keys = [...node._keys];
            keys.splice(0, baseKeyLength);
            let o = obj;
            keys.forEach(function(key, index) {
              if (isArrayKey(key)) {
                key = getArrayValue(key);
              }
              if (index === (keys.length - 1)) {
                o[key] = node._value;
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

      set _document(obj) {
        __setDocument(this, obj);
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
        const icls = new mclass(DB, cls);
        return icls.classmethod(method, ...args);
      }

      this.irisClassExists = function(clsName) {
        let packageName = glsdb.classMethod(clsName, "%PackageName");
        if (packageName === '') return false;
        let className = glsdb.classMethod(clsName, "%ClassName");
        if (className === '') return false;
        let fqn = packageName + '.' + className;
        return (glsdb.classMethod('%Dictionary.ClassDefinition', "%ExistsId", fqn) === '1');
      }

      this.irisClass = function(clsName) {
        let packageName = glsdb.classMethod(clsName, "%PackageName");
        //console.log('packageName = ' + packageName);
        if (packageName === '') return null;
        let className = glsdb.classMethod(clsName, "%ClassName");
        console.log('className = ' + className);
        if (className === '') return null;
        let fqn = packageName + '.' + className;

        let properties = {};
        let methods = {}

        let classExists = (glsdb.classMethod('%Dictionary.ClassDefinition', "%ExistsId", fqn) === '1')
        let ClassDefinition = glsdb.classMethod('%Dictionary.ClassDefinition', "%OpenId", fqn);

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
            this._name = clsName;
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
              let obj = glsdb.classMethod(this.fqn, "%OpenId", id);
              return this.#proxy(obj);
            }
            else {
              let obj = glsdb.classMethod(this.fqn, "%New");
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

