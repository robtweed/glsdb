/*
 ----------------------------------------------------------------------------
 | glsDB: Global Storage Database Abstraction                                |
 |                                                                           |
 | Copyright (c) 2023-4 MGateway Ltd,                                        |
 | Redhill, Surrey UK.                                                       |
 | All rights reserved.                                                      |
 |                                                                           |
 | https://www.mgateway.com                                                  |
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

30 March 2024

 */

import {server, mglobal, mclass, mcursor} from 'mg-dbx-napi';
import util from 'node:util';

let instance;
let cached_mglobal = new Map();
let db;
let use;
let dbType;

class glsDB {

  #getVersion;
  #node;

  constructor(options) {

    if (instance) {
      throw new Error("You can only create one instance!");
    }
    instance = this;

    options = options || {};
    let maxArrayDigits = options.maxArrayDigits || 6;
    let arrayPadChar = options.arrayPadChar || '0';
    let listeners = new Map();

    if (options.db) {
      // being instantiated via mg_web_router which has already opened an mg-dbx-napi connection
      db = options.db;
      use = options.use;
      dbType = options.type;
    }

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

    function isNumeric(string){
      return !isNaN(string);
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

    let glsdb = this;
  
    this.open = function(params) {

      // for use when running glsdb standalone

      if (!params) return;
      db = new server();
      db.open(params);
      dbType = params.type;

      this.dbx = {
        db: db,
        mglobal: mglobal,
        mcursor: mcursor,
        mclass: mclass
      };

      use = function() {
        let args = [...arguments];
        let key = args.toString();
        if (!cached_mglobal.has(key)) {
          cached_mglobal.set(key, {
            container: new mglobal(db, ...args),
            at: Date.now()
          });
        }
        return cached_mglobal.get(key).container;
      }
    };

    this.close = function() {
      if (db) db.close();
    }

    // this.dbx allows direct use of mg-dbx-napi APIs

    this.dbx = {
      db: db,
      mglobal: mglobal,
      mcursor: mcursor,
      mclass: mclass
    }

    this.on = function(type, callback) {
      if (!listeners.has(type)) {
        listeners.set(type, callback);
      }
    };

    this.off = function(type) {
      if (listeners.has(type)) {
        listeners.delete(type);
      }
    };

    this.emit = function(type, data) {
      if (listeners.has(type)) {
        let handler =  listeners.get(type);
        handler.call(instance, data);
      }
    }

    function __setDocument(node, obj, parsed) {

      if (!parsed) {
        obj = JSON.parse(JSON.stringify(obj));
        parsed = true;
      }
      //let isArray = Array.isArray(obj);
      //let isArray = obj instanceof Array;
      let isArray = obj.constructor === Array;
      if (isArray && obj.length === 0) {
        node.$('[]').rawSet('');
        return;
      }
      for (let key in obj){
        let childNode;
        if (isArray) {
          childNode = node._(key);
        }
        else {
          //childNode = node.getChild(key);
          childNode = getChildNode(node, key);
        }
        let childObj = obj[key];
        if (childObj === null) childObj = 'null';
        if (typeof childObj === 'undefined') childObj = '';
        if (typeof childObj === 'object') {
          __setDocument(childNode, childObj, true);
        }
        else if (typeof childObj === 'function') {
          return;
        }
        else {
          childNode.rawSet(childObj);
        }
      }
    }

    function getChildNode(node, key) {
      let _keys = [...node._keys];
      _keys.push(key);
      return new glsdb.node(_keys);
    }

    function getLastArrayElement(node) {
      let lastElement = node.lastChild;
      if (lastElement && lastElement.key === '[]') {
        let previousSibling = lastElement.previousSibling;
        if (previousSibling) {
          lastElement.delete();
          lastElement = previousSibling;
        }
        else {
          return;
        }
      }
      return lastElement;
    }

    this.document = function(node, version) {
      if (util.types.isProxy(node)) {
        node = node._node;
      }
      if (!node.hasChildren) return node.getValue();
      let obj = {};
      if (isArrayKey(node.firstChild.key)) obj = [];
      version = version || 'next';

      if (version === 'next') {

        function getChildren(node, obj) {
          node.forEachChildNode(function(child) {
            let key = child.key;
            if (isArrayKey(key)) {
                key = getArrayValue(key);
              }
            if (child.isLeafNode) {
              obj[key] = child.getValue();
            }
            else {
              obj[key] = {};
              if (isArrayKey(child.firstChild.key)) obj[key] = [];
              getChildren(child, obj[key]);
            }
          });
        }

        getChildren(node, obj);
        return obj;
      }
      else {
        let baseKeyLength = node.keys.length;
        node.forEachLeafNode({getdata: true}, function(keys, value) {
          keys.splice(0, baseKeyLength);
          let o = obj;
          keys.forEach(function(key, index) {
            if (key === '[]' && value === '') {
              return;
            }
            if (isArrayKey(key)) {
              key = getArrayValue(key);
            }
            if (index === (keys.length - 1)) {
              o[key] = value
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
        });
        return obj;
      }
    };

    this.node = class {

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
          //if (Array.isArray(p)) {
          if (p.constructor === Array) {
            keyArr = [...p];
          }
          else {
            keyArr = p.match(/\[([0-9]+)\]|[^\]\[.]+/g);
            for (const [index, key] of keyArr.entries()) {
              if (key.includes('#056')) {
                let pcs = key.split('#056');
                keyArr[index] = pcs.join('.');
              }
            }
          }
          for (let i = 0; i < keyArr.length; i++) {
            keyArr[i] = setArrayValue(keyArr[i]);
          }
          return keyArr;
        }

        function toKeys(p) {
          let keys = p.match(/\[([0-9]+)\]|[^\]\[.]+/g);
          for (const [index, key] of keys.entries()) {
            if (key.includes('#056')) {
              let pcs = key.split('#056');
              keys[index] = pcs.join('.');
            }
          }
          return keys;
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
              key = key.toString();
              if (key.includes('.')) {
                let pcs = key.split('.');
                key = pcs.join('#056');
              }
              path = path + delim + key;
              delim = '.';
            }
          }
          return path;
        }

        let keys = path;
        //if (!Array.isArray(path)) {
        if (path.constructor !== Array) {
          //console.log('**** path is a string ***');
          keys = toKeys(path);
          this._keys = keys;
          this.keys = toPaddedKeys(path);
        }
        else {
          //console.log('*** path is an array ***');
          this._keys = unpadded(keys);
          //console.log(this._keys);
          this.keys = toPaddedKeys(keys);
          //console.log(this.keys);
        }

        this.name = this.keys[0];

        // create subscripts array by removing the name from keys
        this.subscripts = this.keys.slice();
        this.subscripts.shift();
        
        this.#globalNode = use(this.name);
        this.path = toPath(keys);
        this.key = '';
        if (keys.length > 1) {
          this.key = this.keys[this.keys.length - 1];
        }
      }

      get proxy() {

        let node = this;
        let arrayMethods = Object.getOwnPropertyNames(Array.prototype);

        let nodeKeys = Reflect.ownKeys(Reflect.getPrototypeOf(node));

        let handler = {

          ownKeys(target) {
            //console.log(Reflect.ownKeys(target));
            //console.log(Reflect.getOwnPropertyDescriptor(target, 'length'));
            //console.log('** ownKeys: ' + JSON.stringify(target));
            let keys = node.properties;
            if (node.isArray) return Reflect.ownKeys(keys);
            return keys;
          },

          getOwnPropertyDescriptor(target, prop) { // called for every property
            //console.log('getOwnPropDesc: ' + prop);
            if (node.isArray && prop === 'length') return {
              value: 0,
              writable: true,
              enumerable: false,
              configurable: false
            };
            let obj = {
              enumerable: true,
              configurable: true,
              value: node.$(prop).getValue()
            };
            if (!node.isArray && !node.$(prop).exists) {
              return Reflect.getOwnPropertyDescriptor({});
            }
            return obj;
          },

          has(target) {
            //console.log('** has: ' + target);
          },

          deleteProperty(target, prop) {
            node.$(prop).delete();
            return true;
          },

          get(target, prop, receiver) {
            //console.log('** get proxy prop = ');
            //console.log(prop);
            if (typeof prop === 'symbol') {
              //console.log('is a symbol!');
              let symbolType = prop.toString();
              if (symbolType === 'Symbol(Symbol.toPrimitive)') {
                let value = node.getValue();
                if (value === '' || typeof value === 'object') value = 0;
                return value[Symbol.toPrimitive];
              }
              if (symbolType === 'Symbol(Symbol.iterator)') {
                let arr = node.properties;
                return arr[Symbol.iterator].bind(arr);
              }
            }

            if (prop === '_node') {
              return node;
            }

            if (prop === '_get') {
              return node.value;
            }

            if (prop === 'valueOf') {
              return function() {
                return node.value;
              }
            }

            // if _{prop} is a property or function of the proxied node, return/use it
            if (prop[0] === '_') {
              let nprop = prop.slice(1);
              if (nprop !== 'constructor' && nprop !== 'proxy' && nodeKeys.includes(nprop)) {
                if (typeof node[nprop] === 'function') {
                  //console.log('** function ' + nprop);
                  return function(...args) {
                    return node[nprop](...args);
                  }
                }
                else {
                  //('** property ' + nprop);
                  return node[nprop];
                }
              }
            }

            //if (prop === '_value' || prop === '_document') {
            //  return node.document;
            //}

            // Array-specific methods
            if (node.isArray) {
              if (prop === 'constructor' || prop === 'prototype') {
                return;
              }
              if (prop === 'length') {
                return node.length;
              }
              if (arrayMethods.includes(prop)) {
                //console.log('prop = ' + prop);

                if (node[prop]) {
                  //console.log('running ' + prop);
                  return function(...args) {
                    return node[prop](...args);
                  }
                }

                let arr = node.document;
                //console.log('arr before: ' + JSON.stringify(arr));
                return function(...args) {
                  //console.log('args = ' + args);
                  let result = arr[prop].apply(arr, args);
                  node.delete();
                  node.document = arr;
                  return result;
                };
              }
            }

            // assume the prop is a persistent key
            // if it's an array node, return the value of the specified Array index
            //  otherwise return the proxied child node

            //console.log('isArray: ' + node.isArray);
            if (node.isArray) return node._(prop).getValue();
            return node.$(prop).proxy;

          },

          set(target, prop, value) {

            if (typeof value === 'undefined' || typeof val === 'null') return true;

            //console.log('** set proxy prop = ' + prop + '; value = ' + JSON.stringify(value));
            node.$(prop).document = value;
            return true;
          }
        };

        let target = {};
        if (node.isArray) target = [];

        return new Proxy(target, handler);

      }

      rawSet(value) {
        if (value === null) value = 'null';
        if (typeof value === 'undefined') value = '';
        let val = value.toString();
        if (+value < 1 && +value > 0) {
          val = val.toString().slice(1).toString();
          //val = val.slice(1);
        }
        if (+val < 0 && +val > -1) {
          val = val.toString().replace('-0.', '-.');
          val = val.toString();
        }
        this.#globalNode.set(...this.subscripts, val);
        glsdb.emit('set', {
          node: this,
          subscripts: this.subscripts.slice(),
          value: val
        });
      }

      set value(val) {
        if (val === null) val = 'null';
        if (typeof val === 'undefined') val = '';
        if (typeof val === 'object') {
          this.document = val;
        }
        else {
          let val1 = val.toString();
          if (+val < 1 && +val > 0) {
            val1 = val.toString().slice(1).toString();
            //console.log(val1);
          }
          if (+val < 0 && +val > -1) {
            val1 = val.toString().replace('-0.', '-.');
            val1 = val1.toString();
            //console.log(val1);
          }
          let args = this.subscripts.slice();
          args.push(val1);
          this.#globalNode.set(...args);
          glsdb.emit('set', {
            node: this,
            subscripts: this.subscripts.slice(),
            value: val1
          });
        }
      }

      get value() {
        let defined = this.defined;
        //if (!this.exists) return '';
        //if (!this.isLeafNode) return this.document;
        if (defined === '0') return '';
        if (defined !== '1') return this.document;

        let value = this.#globalNode.get(...this.subscripts);
        glsdb.emit('get', {
          node: this,
          subscripts: this.subscripts.slice()
        });
        if (value === 'null') value = null;
        else if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value !=='' && isNumeric(value) && value.length < 15) value = +value;
        return value;
      }

      getValue() {
        // get but without any existence checks for optimising
        // where these checks have already been done

        let value = this.#globalNode.get(...this.subscripts);
        glsdb.emit('get', {
          node: this,
          subscripts: this.subscripts.slice()
        });
        if (value === 'null') value = null;
        else if (value === 'true') value = true;
        else if (value === 'false') value = false;
        else if (value !== '' && isNumeric(value) && value.length < 15) value = +value;
        return value;
      }

      delete() {
        this.#globalNode.delete(...this.subscripts);
        glsdb.emit('delete', {
          node: this,
          subscripts: this.subscripts.slice()
        });
      }

      get defined() {
        glsdb.emit('defined', {
          method: 'defined',
          node: this,
          subscripts: this.subscripts.slice()
        });
        return this.#globalNode.defined(...this.subscripts);
      }

      get exists() {
        glsdb.emit('defined', {
          method: 'exists',
          node: this,
          subscripts: this.subscripts.slice()
        });
        return (this.#globalNode.defined(...this.subscripts) !== '0');
      }

      get hasChildren() {
        glsdb.emit('defined', {
          method: 'hasChildren',
          node: this,
          subscripts: this.subscripts.slice()
        });
        let def = this.#globalNode.defined(...this.subscripts);
        return (def === '10' || def === '11');
      }

      get isLeafNode() {
        glsdb.emit('defined', {
          method: 'isLeafNode',
          node: this,
          subscripts: this.subscripts.slice()
        });
        return (this.#globalNode.defined(...this.subscripts) === '1');
      }

      get hasValue() {
        glsdb.emit('defined', {
          method: 'hasValue',
          node: this,
          subscripts: this.subscripts.slice()
        });
        return (this.#globalNode.defined(...this.subscripts) === '1');
      }

      get isArray() {
        let fc = this.firstChild;
        if (!fc) return false;
        return isArrayKey(fc.key);
      }

      get isArrayMember() {
        return isArrayKey(this.key);
      }

      increment(amount) {
        amount = amount || 1;
        let args = this.subscripts.slice();
        args.push(amount);
        glsdb.emit('increment', {
          node: this,
          subscripts: this.subscripts.slice(),
          by: amount
        });
        return this.#globalNode.increment(...args);
      }

      get firstChild() {
        let key = '';
        let args = this.subscripts.slice();
        args.push(key);
        glsdb.emit('next', {
          node: this,
          subscripts: args
        });
        key = this.#globalNode.next(...args);
        if (key !== '') {
          let keys = [...this._keys];
          keys.push(key);
          return new glsdb.node(keys);
        }
      }

      get lastChild() {
        let key = '';
        let args = this.subscripts.slice();
        args.push(key);
        glsdb.emit('previous', {
          node: this,
          subscripts: args
        });
        key = this.#globalNode.previous(...args);
        if (key !== '') {
          let _keys = [...this._keys];
          _keys.push(key);
          return new glsdb.node(_keys);
        }
      }

      get parent() {
        if (this.parentNode) return this.parentNode;
        let _keys = [...this._keys];
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
        let args = this.subscripts.slice();
        glsdb.emit('next', {
          node: parent,
          subscripts: args
        });
        key = parent.#globalNode.next(...args);
        if (key !== '') {
          let _keys = [...parent._keys];
          _keys.push(key);
          return new glsdb.node(_keys);
        }
      }

      get previousSibling() {
        let key = this.key;
        if (key === '') return;
        let parent = this.parent;
        let args = this.subscripts.slice();
        glsdb.emit('previous', {
          node: parent,
          subscripts: args
        });
        key = parent.#globalNode.previous(...args);
        if (key !== '') {
          let _keys = [...parent._keys];
          _keys.push(key);
          return new glsdb.node(_keys);
        }
      }

      getChild(key) {
        let _keys = [...this._keys];
        let key1 = key.toString();
        if (+key < 1 && +key > 0) {
          key1 = key.toString().slice(1).toString();
        }
        if (+key < 0 && +key > -1) {
          key1 = key.toString().replace('-0.', '-.');
          key1 = key1.toString();
        }
        _keys.push(key1);
        return new glsdb.node(_keys);
      }

      getChildAfter(seed) {
        let childNode = false;
        this.forEachChildNode({from: seed}, function(node) {
          if (node.key === seed.toString()) {
            childNode = node.nextSibling;
          }
          else {
            childNode = node;
          }
          return false;
        });
        return childNode;
      }

      childAfter(seed) {
        return this.getChildAfter(seed);
      }

      getChildBefore(seed) {
        let childNode = false;
        this.forEachChildNode({direction: 'reverse', from: seed}, function(node) {
          if (node.key === seed.toString()) {
            childNode = node.previousSibling;
          }
          else {
            childNode = node;
          }
          return false;
        });
        return childNode;
      }

      childBefore(seed) {
        return this.getChildBefore(seed);
      }


      $(keys) {
        //if (Array.isArray(keys)) {
        if (keys.constructor === Array) {
          let node = this;
          for (let i = 0; i < keys.length; i++) {
            let key = keys[i];
            node = node.getChild(key.toString());
          }
          return node;
        }
        else {
          return this.getChild(keys.toString());
        }
      }

      _(key) {
        // Array node
        let _key = '[' + key + ']';
        //console.log('*** _ key: ' + _key + '; ' + setArrayValue(_key));
        return this.getChild(setArrayValue(_key));
      }

      // Array-specific methods

      push(value) {
        if (this.isArray) {
          let lastChild = this.lastChild;
          if (lastChild && lastChild.key === '[]') {
            lastChild.delete();
            lastChild = this.lastChild;
          }
          if (!lastChild) {
            //this._(0).value = value;
            this._(0).rawSet(value);
            return;
          }
          let lastIndex = lastChild.key;
          let index = getArrayValue(lastIndex) + 1;
          //this._(index).value = value;
          this._(index).rawSet(value);
        }
      }

      at(index) {
        if (this.isArray) {
          let lastChild = getLastArrayElement(this);

          if (index < 0) {
            if (!lastChild) {
              return;
            }
            let lastIndex = getArrayValue(lastChild.key);
            index = lastIndex + index + 1;
          }
          let el = this._(index);
          if (el.exists) return el.getValue();
          return;
        }
      }

      concat() {
        if (this.isArray) {
          let args = [...arguments];
          let arr = this.document;
          let newArr = arr.concat(...args);
          this.delete();
          this.document = newArr;
          return newArr;
        }
      }

      includes(value) {
        if (this.isArray) {
          getLastArrayElement(this);  // tidy up if necessary
          let found = false;
          this.forEachChildNode(function(memberNode) {
            if (memberNode.getValue() === value) {
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

      indexOf(value) {
        if (this.isArray) {
          getLastArrayElement(this);  // tidy up if necessary
          let args = [...arguments];
          let arr = this.document;
          let index = arr.indexOf(...args);
          return index;
        }
        else {
          return -1;
        }
      }

      pop() {
        if (this.isArray) {
          let lastElement = this.lastChild;
          if (lastElement.key === '[]') {
            let previousSibling = lastElement.previousSibling;
            if (previousSibling) {
              lastElement.delete();
              lastElement = previousSibling;
            }
            else {
              return;
            }
          }
          let value = lastElement.getValue();
          lastElement.delete();
          return value;
        }
      }

      shift() {
        if (this.isArray) {
          let arr = this.document;
          let value = arr.shift();
          this.delete();
          this.document = arr;
          return value;
        }
      }

      slice() {
        if (this.isArray) {
          getLastArrayElement(this);  // tidy up if necessary
          let args = [...arguments];
          let arr = this.document;
          let delArr = arr.slice(...args);
          return delArr;
        }
      }

      splice() {
        if (this.isArray) {
          let args = [...arguments];
          let arr = this.document;
          let delArr = arr.splice(...args);
          this.delete();
          this.document = arr;
          return delArr;
        }
      }

      unshift() {
        if (this.isArray) {
          let args = [...arguments];
          let arr = this.document;
          let length = arr.unshift(...args);
          this.delete();
          this.document = arr;
          return length;
        }
      }

      // end of Array methods

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
          let childNode = getChildNode(this, options.startsWith);
          let seedNode = childNode.previousSibling;
          if (seedNode) key = seedNode.key;
        }
        if (options.from) {
          let childNode = getChildNode(this, options.from.toString());
          let seedNode;
          if (fn === 'next') {
            seedNode = childNode.previousSibling;
          }
          else {
            seedNode = childNode.nextSibling;
          }
          if (seedNode) key = seedNode.key;
        }
        if (options.to) {
          let childNode = getChildNode(this, options.to.toString());
          let endNode;
          if (fn === 'next') {
            endNode = childNode.nextSibling;
          }
          else {
            endNode = childNode.previousSibling;
          }
          if (endNode) endKey = endNode.key;
        }
        let stop = false;
        let subscripts = this.subscripts.slice();
        subscripts.push(key);
        while (!stop && (key = this.#globalNode[fn](...subscripts)) != "") {
          glsdb.emit(fn, {
            node: this,
            subscripts: subscripts
          });
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
          subscripts.pop();
          subscripts.push(key);
        }
      }

      get length() {
        let count = 0;
        this.forEachChildNode(function() {
          count++;
        });
        return count;
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

      get properties() {
        if (this.isArray) {
          return this.document;
        }
        let props = [];
        this.forEachChildNode(function(childNode) {
          props.push(getArrayValue(childNode.key).toString());
        });
        return props;
      }

      lock(timeout) {
        //console.log('lock set for ' + this.name + ': ' + this.subscripts);
        timeout = timeout || -1;
        let args = this.subscripts.slice();
        args.push(timeout);
        glsdb.emit('lock', {
          node: this,
          subscripts: args
        });
        let status = this.#globalNode.lock(...args);
        return (status === '1');
      }

      unlock() {
        //console.log('lock unset for ' + this.name + ': ' + this.subscripts);
        glsdb.emit('unlock', {
          node: this,
          subscripts: this.subscripts.slice()
        });
        let status = this.#globalNode.unlock(...this.subscripts);
        return (status === '1');
      }

      import(node) {
        let args = this.subscripts.slice();
        args.push(node.#globalNode);
        return this.#globalNode.merge(...args);
      }

      forEachLeafNode(options, callback) {
        if (!callback && typeof options === 'function') {
          callback = options;
          options = {};
        }
        let getdata = options.getdata || false;
        let direction = options.direction || 'forwards';
        if (direction !== 'forwards' && direction !== 'backwards' && direction !== 'reverse') {
          direction = 'forwards';
        }
        let opts = {
          multilevel: true,
          getdata: getdata
        };
        let global = {
          global: this.name
        }
        global.key = [];
        for (let i = 1; i < this.keys.length; i++) {
          global.key.push(this.keys[i].toString());
        }
        let query = new mcursor(db, global, opts);
        let result;
        let results = [];
        let stop = false;
        let startString = this.keys.toString();
        if (direction === 'forwards') {
          while (!stop && (result = query.next()) !== null) {
            let keys = [...result.key];
            keys.unshift(this.name);
            glsdb.emit('cursor_next', {
              node: this,
              subscripts: keys
            });
            if (!keys.toString().startsWith(startString)) {
              stop = true;
            }
            else {
              if (callback) {
                if (getdata) {
                  let status = callback(keys, result.data);
                  if (status === false) stop = true;
                }
                else {
                  let status = callback(new glsdb.node(keys));
                  if (status === false) stop = true;
                }
              }
            }
          }
        }
        else {
          while (!stop && (result = query.previous()) !== null) {
            let keys = [...result.key];
            keys.unshift(this.name);
            glsdb.emit('cursor_previous', {
              node: this,
              subscripts: keys
            });
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

      get leafNodes() {
        let results = [];
        this.forEachLeafNode(function(node) {
          results.push(node);
        });
        return results;
      }

      get document() {
        return glsdb.document(this);
      }

      get document_q() {
        return glsdb.document(this, 'mcursor');
      }

      set document(obj) {
        //this.delete();
        if (typeof obj !== 'object') {
          this.rawSet(obj);
        }
        else {
          __setDocument(this, obj);
        }
      }    
    };

    this.#getVersion = function() {
      return db.version();
    }

    if (dbType === 'IRIS' || dbType === 'Cache' || dbType === 'YottaDB') {

      this.function = function(fn) {
        return function() {
          return db.function(fn, ...arguments);
        };
      }
    }
    
    this.forEachGlobal = function(options, callback) {
      if (!callback && typeof options === 'function') {
        callback = options;
        options = {};
      }
      //let mcursor = db_mod.mcursor;
      let stop = false;
      let result;
      let from = options.from || '';
      let query = new mcursor(db, {global: from}, {globaldirectory: true});
      while (!stop && (result = query.next()) !== null) { 
        let name = result.split('^')[1];
        if (callback && typeof callback === 'function') {
          let status = callback(name);
          if (status === false) stop = true;
        }
      }
    };

    if (dbType === 'IRIS' || dbType === 'Cache' || dbType === 'YottaDB') {

      this.transaction = {

        start: function() {
          return db.tstart();
        },

        level() {
          return db.tlevel();
        },

        commit: function() {
          return db.tcommit();
        },

        rollback: function() {
          return db.trollback();
        }
      };
    }

    if (dbType === 'IRIS' || dbType === 'Cache') {
      //let mclass = db_mod.mclass;
      this.classMethod = function(cls, method) {
        let args = [...arguments];
        args.splice(0, 2);
        const icls = new mclass(db, cls);
        return icls.classmethod(method, ...args);
      }

      this.irisClassExists = function(clsName) {
        let packageName = glsdb.classMethod(clsName, "%PackageName");
        if (packageName === '') {
          packageName = clsName.split('.')[0];
        }
        let className = glsdb.classMethod(clsName, "%ClassName");
        //console.log('className: ' + className);
        if (className === '') return false;
        let fqn = packageName + '.' + className;
        return (glsdb.classMethod('%Dictionary.ClassDefinition', "%ExistsId", fqn) === '1');
      }

      this.irisProxy = function(mclass, parentClass) {

        let handler = {

          get(target, prop, receiver) {
            //console.log('** get proxy prop = ' + prop);

            if (prop === '_mclass') return mclass;
            if (prop === '_this') return parentClass;
            if (prop === '_properties') return parentClass._properties;
            if (prop === '_methods') return parentClass._methods;
            if (prop === '_set') {
              return function(...args) {
                return parentClass.set(...args);
              }
            }

            if (prop === '_save') {
              return function(...args) {
                args.forEach(function(arg, index) {
                  if (typeof arg === 'object' && arg._mclass) args[index] = arg._mclass;
                });
                return mclass.method('%Save', ...args);
              };
            }

            if (parentClass._methods[prop]) {
              //console.log('**** method ' + prop);
              return function(...args) {
                args.forEach(function(arg, index) {
                  if (typeof arg === 'object' && arg._mclass) args[index] = arg._mclass;
                });
                return mclass.method(prop, ...args);
              };
            }
  
            if (parentClass._properties[prop]) {
              let property = mclass.getproperty(prop);
              //console.log('*** property = ');
              //console.log(property);

              if (typeof property === 'object' && property.method) {
                let fqn = property.method('%ClassName', 1);
                //console.log(fqn);
                let cls = glsdb.irisClass(fqn);
                let instance = cls(property);
                //console.log(222222);
                //console.log(instance);
                return instance;
              }
              return property;
            }

            if (target[prop]) {
              return target[prop];
            }
            return '';
          },

          set(target, prop, value) {
            //console.log('set prop = ' + prop);
            if (parentClass._properties[prop]) {
              mclass.setproperty(prop, value);
            }
            return true;
          }
        };
        return new Proxy({}, handler);
      };

      this.irisClass = function(clsName) {
        //console.log('irisClass: ' + clsName);
        let fqn = glsdb.classMethod(clsName, "%ClassName", 1);
        //console.log('fqn: ' + fqn);

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
            properties[name] = property.getproperty('Type');
          }

          let Methods = ClassDefinition.getproperty('Methods');
          count = +Methods.method('Count');
          for (let i = 1; i < (count + 1); i++) {
            let method = Methods.method('GetAt', i);
            let name = method.getproperty('Name');
            methods[name] = true;
          }
        }

        let irisCls = class {

          constructor(id) {
            this._name = clsName;
            this._fqn = fqn;
            this._properties = properties;
            this._methods = methods;
            this._classExists = classExists;

            if (typeof id === 'object' && id.method) {
              this._proxy = glsdb.irisProxy(id, this);
              return
            }

            if (id) {
              //console.log(2222222);
              //console.log('id = ' + id);
              let obj = glsdb.classMethod(this._fqn, "%OpenId", id);
              if (obj === '') {
                this._exists = false;
                return;
              }
              this._exists = true;
              this._mclass = obj;
              this._proxy = glsdb.irisProxy(obj, this);
              return;
            }
            else {
              let obj = glsdb.classMethod(this._fqn, "%New");
              this._exists = true;
              this._mclass = obj;
              this._proxy = glsdb.irisProxy(obj, this);
              return;
            }

          }

          set(obj) {
            let mclass = this._mclass;
            for (let name in obj) {
              mclass.setproperty(name, obj[name]);
            }
            return mclass.method('%Save');
          }
        };

        return function(id) {
          let cls = new irisCls(id);
          return cls._proxy;
        }

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

