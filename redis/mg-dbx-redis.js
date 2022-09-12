const netx = require('tcp-netx');
const redis_interface = require('./redis-interface.js');

module.exports = {

  dbx: class  {
    constructor() {

      let dbx = this;
      let tcp;

      this.open = function(options) {
        let host = options.host || 'localhost';
        let port = options.port || 6379;
        let integer_padding = options.integer_padding || 10;
        let key_separator = options.key_separator || String.fromCharCode(1);
        tcp = new netx.server(host, port);
        tcp.connect();
        let opts = {
          tcp: tcp,
          integer_padding: integer_padding,
          key_separator: key_separator
        }
        dbx.redis = new redis_interface(opts);
      };

      this.close = function() {
        if (tcp) {
          tcp.disconnect();
        }
      }

      this.mglobal = class {
        constructor(keys) {
          this.keys = keys;
          this.name = keys[0];
          //console.log('**** this.keys: ' + JSON.stringify(this.keys));
        }

        set(value) {
          if (typeof value === 'undefined') value = '';
          // clean out not ASCII characters
          value = value.toString().replace(/[^\x00-\xFF]/g, "");
          dbx.redis.createNode(this.keys, value);
        }

        get() {
          return dbx.redis.getNodeValue(this.keys);
        }
        defined() {
          return dbx.redis.nodeDefined(this.keys);
        }
        delete() {
          return dbx.redis.deleteNode(this.keys);
        }
        increment(amount) {
          amount = amount || 1;
          let value = this.get();
          if (value === '') value = 0;
          value = parseInt(value) + amount;
          this.set(value);
          return value;
        }
        next(key) {
          return dbx.redis.getNextKey(this.keys, key);
        }
        previous(key) {
          return dbx.redis.getPreviousKey(this.keys, key);
        }

      }

    }

    version() {
      return 'mg-dbx-redis Version 0.1';
    }


  }

};

