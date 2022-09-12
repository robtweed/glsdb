import {glsDB} from 'glsdb';

let onStartupModule = function(props) {
  props = props || {};
  let glsdb = new glsDB(props.type);
  // open the database connection
  glsdb.open(props.options);
  this.glsdb = glsdb;
  this.on('stop', function() {
    // close connection to database
    glsdb.close();
    console.log('Connection to ' + props.type + ' closed!');
  });
};

export {onStartupModule};
