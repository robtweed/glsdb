module.exports = class {

  constructor(options) {

    const tcp = options.tcp;
    this.integer_padding = options.integer_padding || 10;
    this.key_separator = options.key_separator || String.fromCharCode(1);

    function sendRedisCommand(command, args) {
      args = args || [];
      const crlf = '\r\n';
      const noOfCommands = args.length + 1;
      let request = '*' + noOfCommands + crlf + '$' + command.length + crlf + command + crlf;
      args.forEach(function(arg) {
        request = request + '$' + arg.toString().length + crlf + arg + crlf;
      }); 
      let payload = {
        data: request
      }
      //console.log('sending request: ' + JSON.stringify(payload));
      tcp.write(payload);
    };

    function readRedisResponse(timeout) {

      function readRecord(data) {
        if (timeout) {
          var result = tcp.read({timeout: timeout});
        }
        else {
          var result = tcp.read();
        }
        //console.log('raw result: ' + JSON.stringify(result));
        if (result.ok === 0 && result.ErrorMessage) {
          tcp.disconnect();
          tcp.connect();
          //console.log('reconnected');
          return {error: result.ErrorMessage};
        }
        data = data + result.data;
        //console.log('data = ' + data + '; ' + data.substring(0, 1));
        let firstChar = data.substring(0, 1);
        let pieces;
        if (data === '+OK' + crlf) return data;
        if (firstChar === '+' || firstChar === ':') {
          return data;
        }
        if (data === '$-1' + crlf) return null;
        if (firstChar === '$') {
          return data;
        }
        if (data.substring(0, 5) === '-ERR ') {
          return data;
        }

        if (data) {
          pieces = data.split(crlf);
          let noOfItems = parseInt(pieces[0].substring(1));
          //console.log('noOfItems = ' + noOfItems + '; no of pieces: ' + pieces.length);
          if (((noOfItems * 2) + 2)  !== pieces.length) {
            return readRecord(data);
          }
          else {
            //console.log('data: ' + JSON.stringify(pieces, null, 2));
            let len;
            let item;
            let itemNo;
            let totalLengthCount = 0;
            let totalItemLength = 0;
            //console.log('noOfItems = ' + noOfItems);
            for (let i = 0; i < noOfItems; i++) {
              //console.log('i = ' + i);
              itemNo = (i * 2) + 1;
              //console.log('itemNo ' + itemNo);
              len = pieces[itemNo];
              //console.log('len: ' + len);
              len = parseInt(len.toString().substring(1));
              item = pieces[itemNo + 1];
              totalLengthCount = totalLengthCount + len;
              totalItemLength = totalItemLength + item.toString().length;
              //console.log('totalLengthCount = ' + totalLengthCount);
              //console.log('totalItemLength = ' + totalItemLength);
            }
            if (totalLengthCount > totalItemLength) data = readRecord(data);
            return data;
          }
        }
        else {
          return {
            data: '',
            no: 0
          };
        }
      }

      const crlf = '\r\n';
      let data = readRecord('');
      //console.log('all data read successfully: ' + data);
      if (typeof data === 'undefined' || data === null) return [null];
      if (data.error) return data;
      if (data.substring(0, 5) === '-ERR ') {
        data = data.split(crlf)[0];
        return {error: data};
      }

      let pieces = data.split(crlf);
      let firstChar = pieces[0].substring(0, 1);
      let value;
      if (data === '+OK' + crlf) return [true, 'OK'];
      if (firstChar === '$') {
        //console.log('*** $ response - ' + data);
        pieces = data.split(crlf);
        pieces.shift(); // remove length indicator
        return pieces;
      }
      if (firstChar === '+') {
        value = pieces[0].substring(1);
        return [value];
      }
      if (firstChar === ':') {
        value = pieces[0].substring(1);
        return [parseInt(value)];
      }
      let noOfItems = parseInt(pieces[0].substring(1));
      let results = [];
      for (let i = 0; i < noOfItems; i++) {
        //console.log('pushing ' + pieces[(i * 2) + 2]);
        results.push(pieces[i * 2 + 2]);
      }
      
      return results;
    };

    this.executeRedisCommand = function(command, args, timeout) {
      sendRedisCommand(command, args);
      return readRedisResponse(timeout);
    }

  }

  addHProperty(key, name, value) {
    let args = [key, name, value];
    return this.executeRedisCommand('HMSET', args);
  }

  addHProperties(key, propertiesArray) {
    let args = [key];
    propertiesArray.forEach(function(nvp) {
      args.push(nvp.name);
      args.push(nvp.value);
    }); 
    return this.executeRedisCommand('HMSET', args);
  }

  addZMember(key, member) {
    let args = [key, 0, member];
    let results = this.executeRedisCommand('ZADD', args);
    return results[0];
  }

  getHProperties(key) {
    //console.log('key = ' + key);
    let args = [key];
    // returns an object containing all properties and their values
    let results = this.executeRedisCommand('HGETALL', args);
    //console.log('**** getHProperties results = ' + JSON.stringify(results, null, 2));
    let no = results.length / 2;
    let data = {};
    for (let i = 0; i < no; i++) {
      let index = i *2;
      data[results[index]] = results[index + 1];
    }
    return data;
  }

  getHProperty(key, propertyName) {
    let args = [key, propertyName];
    let results = this.executeRedisCommand('HGET', args);
    return results[0];
  }

  getMatchingKeys(pattern) {
    // returns an array of matching keys
    let args = [pattern];
    return this.executeRedisCommand('KEYS', args);
  }

  deleteKeys(keyArray) {
    //console.log('deleteKeys - keyArray = ' + JSON.stringify(keyArray));
    let results = this.executeRedisCommand('DEL', keyArray);
    return results[0];
  }

  deleteKey(key) {
    return this.deleteKeys([key]);
  }

  deleteZMembersByPrefix(key, prefixValue) {
    return this.deleteMatchingZMembers(key, prefixValue, prefixValue);
  }

  deleteMatchingZMembers(key, fromValue, toValue) {
    //console.log('redisDeleteMatchingZMembers - ZREMRANGEBYLEX');
    let args = [key, '[' + fromValue, '(' + toValue + '~~'];
    let results = this.executeRedisCommand('ZREMRANGEBYLEX', args);
    return results[0];
  }

  deleteZMember(key, member) {
    let args = [key, member];
    let results = this.executeRedisCommand('ZREM', args);
    return results[0];
  }

  countZMembers(key) {
    let args = [key];
    let results = this.executeRedisCommand('ZCARD', args);
    return results[0];
  }

  getZMemberIndex(key, member) {
    let args = [key, member];
    let results = this.executeRedisCommand('ZRANK', args);
    return results[0];
  }

  getZMemberByIndex(key, index) {
    let args = [key, index, index];
    let results = this.executeRedisCommand('ZRANGE', args);
    return results[0];
  }

  flattenArray(arr) {
    arr = arr || [];
    let key = '';
    let delim = '';
    let _this = this;
    arr.forEach(function(name) {
      key = key + delim + name;
      delim = _this.key_separator;
    });
    return key;
  }

  nodeDefined(keys) {
    let key = 'node:' + keys[0];
    let subscripts = [...keys];
    subscripts.shift();
    if (subscripts.length > 0) {
      key = key + this.key_separator + this.flattenArray(subscripts);
      let result = this.getHProperty(key, 'data');
      if (typeof result !== 'undefined' && result !== null) {
        return result;
      }
    }
    return '0';
  }

  getNodeValue(keys) {
    let key = 'node:' + keys[0];
    let subscripts = [...keys];
    subscripts.shift();
    if (subscripts.length > 0) {
      key = key + this.key_separator + this.flattenArray(subscripts);
      let result = this.getHProperties(key);
      console.log('** redisGetHProperties result = ' + JSON.stringify(result));
      if (result.data && result.value && result.value !== 'NaN') {
        return result.value;
      }
    }
    return '';
  }

  globalExists(global) {
    let key = 'leaves:' + global;
    // does global exist?
    return this.keyExists(key);
  }

  deleteNode(keys) {
    let global = keys[0];
    if (this.globalExists(global)) {
      let key = 'node:' + keys[0];
      let subscripts = [...keys];
      subscripts.shift();
      if (subscripts.length === 0) {
        // top level delete of entire global
        let keys = ['node:' + global, 'leaves:' + global, 'children:' + global];
        let result = this.getMatchingKeys('*' + global + this.key_separator + '*');
        this.deleteKeys(keys.concat(result));
      }
      else {
        let nodeRoot = 'node:' + global;
        let childrenRoot = 'children:' + global;
        let leafKey = 'leaves:' + global;
        // delete everything from the specified subscripts and below
        let flatSubs = this.flattenArray(subscripts);
        let nodeKey = nodeRoot + this.key_separator + flatSubs;
        let childrenKey = childrenRoot + this.key_separator + flatSubs;
        let keys = [nodeKey, childrenKey];

        // match all lower-level nodes and children
        let wildCard = '*' + global + this.key_separator + flatSubs + this.key_separator + '*';
        let result = this.getMatchingKeys(wildCard);
        // now delete all these keys
        result = this.deleteKeys(keys.concat(result))
        // now remove leaf item records
        //  match all the lower-level leaf nodes that start with the specified flattened subscripts
        this.deleteZMembersByPrefix(leafKey, flatSubs + this.key_separator);

        // and now remove the leaf node specified in the delete
        this.deleteZMember(leafKey, flatSubs);  // change to deleteZMember

        // now recursively remove each subscript level from next level up's children

        // if there aren't any subscripts left in the parent, this should be deleted
        //  and recurse this logic up all parent levels

        let stop = false;
        do {
          let child = subscripts.slice(-1)[0]; // get the last subscript
          child = this.padIfInteger(child);
          subscripts = subscripts.slice(0, -1); // remove the last subscript
          //console.log('subscripts = ' + JSON.stringify(subscripts));

          if (subscripts.length > 0) {
            //console.log('subscripts length: ' + subscripts.length);
            flatSubs = this.flattenArray(subscripts);
            let childrenKey = childrenRoot + this.key_separator + flatSubs;
            //console.log('remove childrenKey = ' + childrenKey + '; child = ' + child);
            this.deleteZMember(childrenKey, child);

            // we're still in a subscripted level

            if (this.countZMembers(childrenKey) === 0) {
              //console.log('no more children left for ' + childrenKey);
              // no children left, so delete the node and recurse up a level
              let nodeKey = nodeRoot + this.key_separator + flatSubs;
              //console.log('delete ' + nodeKey);
              this.deleteKey(nodeKey);
            }
            else {
              //console.log(childrenKey + ' still has children');
              // parent still has other children, so stop the recursion up the parents
              stop = true;
            }
          }
          else {
            //console.log('check the global node itself');
            // we need to check the subscripts against the global node itself
            //console.log('global level - remove ' + child + ' from ' + childrenRoot);
            this.deleteZMember(childrenRoot, child);
            //console.log('check top level childrenRoot = ' + childrenRoot);
            if (this.countZMembers(childrenRoot) === 0) {
              // no children left, so delete the node
              //console.log('global node has no children so delete ' + nodeRoot);
              this.deleteKey(nodeRoot);
            }
            // at the top now, so stop
            stop = true;
          }
          //console.log('stop = ' + stop);
        } while (!stop);
      }
    }

  }

  keyExists(key) {
    let args = [key];
    let result = this.executeRedisCommand('EXISTS', args);
    return (result[0].toString() === '1');
  }

  padIfInteger(value) {

    function isNormalInteger(str) {
      if (str.toString() === '0') return true;
      return /^\+?(0|[1-9]\d*)$/.test(str);
    }

    function pad(n, width, z) {
      z = z || '0';
      n = n + '';
      return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    }

    let isZero = false;
    if (value === 0 || value === '0') {
      //console.log('**** zero coming into padIfInteger');
      isZero = true;
    }
    if (typeof value !== 'undefined' && value !== '' && isNormalInteger(value)) {
      //console.log('isZero?: ' + isZero);
      // pack with leading zeros to ensure collating sequence
      value = this.key_separator + pad(value, this.integer_padding);
      //console.log('padded integer subscript ' + value);
    }
    return value;
  }

  stripLeadingZeros(string) {
    //console.log('subscript value padded: ' + string);
    // remove leading zeros
    let value = string.substring(1);
    value = value.replace(/^0+/, '');
    if (value === '') value = 0;
    //console.log('unpadded subscript value: ' + value);
    return parseInt(value);
  }

  getNextKey(keys, seed) {
    let global = keys[0];
    // does global exist?
    if (!this.globalExists(global)) {
      return '';
    }
    let subscripts = [...keys];
    subscripts.shift();
    let parentSubs = subscripts;
    seed = this.padIfInteger(seed);
    let key = 'children:' + global;
    if (parentSubs.length > 0) {
      key = key + this.key_separator + this.flattenArray(parentSubs);
    }
    let index;
    let tempMember;
    if (seed === '') {
      index = -1;
    }
    else {
      index = this.getZMemberIndex(key, seed);
      //console.log('seed: ' + seed + '; index = ' + index);
      // if the seed subscript value doesn't exist, add it temporarily
      //  and use it as the seed

      if (index === null) {
        tempMember = seed;
        let result = this.addZMember(key, tempMember);
        //console.log('added tempMember: ' + tempMember + '; result ' + JSON.stringify(result));
        index = this.getZMemberIndex(key, tempMember);
        //console.log('index of temporarily added member: ' + JSON.stringify(index));
      }
    }
    index++;
    let result = this.getZMemberByIndex(key, index);
    let next = result || '';

    if (next !== '' && next.toString().charAt(0) === this.key_separator) {
      next = this.stripLeadingZeros(next);
    }
    if (tempMember) this.deleteZMember(key, tempMember);
    return next;
  }

  getPreviousKey(keys, seed) {
    let global = keys[0];
    // does global exist?
    if (!this.globalExists(global)) {
      return '';
    }
    let subscripts = [...keys];
    subscripts.shift();
    let parentSubs = subscripts;
    seed = this.padIfInteger(seed);
    let key = 'children:' + global;
    if (parentSubs.length > 0) {
      key = key + this.key_separator + this.flattenArray(parentSubs);
    }
    let index;
    let tempMember;
    if (seed === '') {
      index = this.countZMembers(key);
    }
    else {
      index = this.getZMemberIndex(key, seed);
      //console.log('seed: ' + seed + '; index = ' + index);
      // if the seed subscript value doesn't exist, add it temporarily
      //  and use it as the seed

      if (index === null) {
        tempMember = seed;
        let result = this.addZMember(key, tempMember);
        //console.log('added tempMember: ' + tempMember + '; result ' + JSON.stringify(result));
        index = this.getZMemberIndex(key, tempMember);
        //console.log('index of temporarily added member: ' + JSON.stringify(index));
      }
    }
    index--;
    if (index === -1) {
      if (tempMember) this.deleteZMember(key, tempMember);
      return '';
    }
    let result = this.getZMemberByIndex(key, index);
    let next = result || '';

    if (next !== '' && next.toString().charAt(0) === this.key_separator) {
      next = this.stripLeadingZeros(next);
    }
    if (tempMember) this.deleteZMember(key, tempMember);
    return next;
  }

  createNode(keys, value) {

    console.log('createNode: ' + keys);
    let global = keys[0];
    let subscripts = [...keys];
    subscripts.shift();
    //console.log('subscripts: ' + subscripts);
    let noOfSubscripts = subscripts.length;
    let nodeRoot = 'node:' + global;
    let leavesKey = 'leaves:' + global;
    let childrenRoot = 'children:' + global;
    if (noOfSubscripts === 0) {
      // top-level global node is the leaf node
      let properties = [
        {name: 'data', value: 1},
        {name: 'value', value: value}
      ];
      this.addHProperties(nodeRoot, properties);
      return;
    }
    else {
      // subscripted node is the leaf node

      //create the leaf node

      let flatSubs = this.flattenArray(subscripts);
      let nodeKey = nodeRoot + this.key_separator + flatSubs;
      let properties = [
        {name: 'data', value: 1},
        {name: 'value', value: value}
      ];
      this.addHProperties(nodeKey, properties); 
      this.addZMember(leavesKey, flatSubs);

      // now go up each parent creating the
      //  intermediate nodes if the don't exist
      //  and add the child subscript to the parent's
      //  children list
      //console.log('subscripts start as ' + JSON.stringify(subscripts));
      var stop = false;
      do {
        var child = subscripts.slice(-1)[0]; // get the last subscript
        child = this.padIfInteger.call(this, child);

        subscripts = subscripts.slice(0, -1); // remove the last subscript
        //console.log('subscripts = ' + JSON.stringify(subscripts));
        //console.log('stop = ' + stop);
        if (subscripts.length > 0) {
          flatSubs = this.flattenArray(subscripts);
          nodeKey = nodeRoot + this.key_separator + flatSubs;
          let childrenKey = childrenRoot + this.key_separator + flatSubs;
          //console.log('adding ' + child + ' to ' + childrenKey);
          this.addZMember(childrenKey, child);  // add child to parent's subscript list
          //console.log('check if node ' + nodeKey + ' exists..');
          if (!this.keyExists(nodeKey)) {
            this.addHProperty(nodeKey, 'data', 10); // create intermediate node 
          }
          else {
            //console.log('node ' + nodeKey + ' already exists');
            stop = true; // parent nodes already exist so don't go any further
          }
        }
        else {
          // add child to subscripts of the global itself

          this.addZMember(childrenRoot, child);

          // see if we have to set the global node too
          //console.log('check if global node ' + nodeRoot + ' exists..');
          if (!this.keyExists(nodeRoot)) {
            //console.log('no - global node needs creating');
            this.addHProperty(nodeRoot, 'data', 10); // create top-level global node 
          }
          stop = true;
        }
      } while (!stop);
    }
    //console.log('set complete\r\n');
  }


};