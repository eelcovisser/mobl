/**
 * @license
 * Copyright (c) 2010 Zef Hemel <zef@zef.me>
 * 
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */
var persistence = (window && window.persistence) ? window.persistence : {};

(function () {
    var conn = null;
    var entityMeta = {};
    var trackedObjects = {};
    var objectsToRemove = {};
    var globalPropertyListeners = {}; // EntityType__prop -> QueryColleciton obj
    var queryCollectionCache = {}; // uniqueString -> QueryCollection

    //window.globalPropertyListeners = globalPropertyListeners;
    //window.queryCollectionCache = queryCollectionCache;

    persistence.getObjectsToRemove = function() { return objectsToRemove; }
    persistence.getTrackedObjects = function() { return trackedObjects; }

    function subscribeToGlobalPropertyListener(coll, entityName, property) {
      var key = entityName + '__' + property;
      if(key in globalPropertyListeners) {
        var listeners = globalPropertyListeners[key];
        for(var i = 0; i < listeners.length; i++) {
          if(listeners[i] === coll) {
            return;
          }
        }
        globalPropertyListeners[key].push(coll);
      } else {
        globalPropertyListeners[key] = [coll];
      }
    }

    function propertyChanged(entityName, property, obj, oldValue, newValue) {
      var key = entityName + '__' + property;
      if(key in globalPropertyListeners) {
        var listeners = globalPropertyListeners[key];
        for(var i = 0; i < listeners.length; i++) {
          var coll = listeners[i];
          var dummyObj = obj._data;
          dummyObj[property] = oldValue;
          var matchedBefore = coll._filter.match(dummyObj);
          dummyObj[property] = newValue;
          var matchedAfter = coll._filter.match(dummyObj);
          if(matchedBefore != matchedAfter) {
            coll.triggerEvent('change', coll, obj);
          }
        }
      } 
    }

    /**
     * Retrieves metadata about entity, mostly for internal use
     */
    persistence.getMeta = function (entityName) {
      return entityMeta[entityName];
    };

    /**
     * Connect to a database
     * 
     * @param dbname
     *            the name of the database
     * @param description
     *            a human-readable description of the database
     * @param size
     *            the maximum size of the database in bytes
     */
    persistence.connect = function (dbname, description, size, version) {
      persistence._conn = persistence.db.connect(dbname, description, size, version);
      if(!persistence._conn) {
        throw {
          type: "NoSupportedDatabaseFound",
          message: "No supported database found in this browser."
        };
      }
    };

    /**
     * Create a transaction
     * 
     * @param callback,
     *            the callback function to be invoked when the transaction
     *            starts, taking the transaction object as argument
     */
    persistence.transaction = function (callback) {
      if(!persistence._conn) {
        throw "No ongoing database connection, please connect first.";
      } else {
        persistence._conn.transaction(callback);
      }
    };

    /**
     * Define an entity
     * 
     * @param entityName
     *            the name of the entity (also the table name in the database)
     * @param fields
     *            an object with property names as keys and SQLite types as
     *            values, e.g. {name: "TEXT", age: "INT"}
     * @return the entity's constructor
     */
    persistence.define = function (entityName, fields) {
      if (entityMeta[entityName]) { // Already defined, ignore
        return getEntity(entityName);
      }
      var meta = {
        name: entityName,
        fields: fields,
        hasMany: {},
        hasOne: {}
      };
      entityMeta[entityName] = meta;
      return getEntity(entityName);
    };

    var generatedTables = {}; // set

    function columnTypeToSqliteType(type) {
      switch(type) {
      case 'JSON': return 'TEXT';
      default: return type;
      }
    }

    /**
     * Synchronize the data model with the database, creates table that had not
     * been defined before
     * 
     * @param callback
     *            function to be called when synchronization has completed,
     *            takes started transaction as argument
     */
    persistence.schemaSync = function (callback) {
      var queries = [], meta, rowDef, otherMeta, tableName;
      for (var entityName in entityMeta) {
        if (entityMeta.hasOwnProperty(entityName)) {
          meta = entityMeta[entityName];
          rowDef = '';
          for (var prop in meta.fields) {
            if (meta.fields.hasOwnProperty(prop)) {
              rowDef += "`" + prop + "` " + columnTypeToSqliteType(meta.fields[prop]) + ", ";
            }
          }
          for (var rel in meta.hasOne) {
            if (meta.hasOne.hasOwnProperty(rel)) {
              otherMeta = meta.hasOne[rel].type.meta;
              rowDef += rel + " VARCHAR(255), ";
              queries.push( [
                  "CREATE INDEX IF NOT EXISTS `" + meta.name + "_" + rel + "_" + otherMeta.name
                  + "` ON `" + meta.name + "` (`" + rel + "`)", null ]);
            }
          }
          for (var rel in meta.hasMany) {
            if (meta.hasMany.hasOwnProperty(rel) && meta.hasMany[rel].manyToMany) {
              tableName = meta.hasMany[rel].tableName;
              if (!generatedTables[tableName]) {
                var otherMeta = meta.hasMany[rel].type.meta;
                queries.push( [
                    "CREATE INDEX IF NOT EXISTS `" + tableName + "_" + meta.name + "_" + rel + "` ON `"
                    + tableName + "` (`" + meta.name + "_" + rel + "`)", null ]);
                queries.push( [
                    "CREATE INDEX IF NOT EXISTS `" + tableName + "_" + otherMeta.name + "_"
                    + meta.hasMany[rel].inverseProperty + "` ON `" + tableName + "` (`"
                    + otherMeta.name + "_" + meta.hasMany[rel].inverseProperty + "`)", null ]);
                queries.push( [
                    "CREATE TABLE IF NOT EXISTS `" + tableName + "` (`" + meta.name + "_" + rel
                    + "` VARCHAR(32), `" + otherMeta.name + '_'
                    + meta.hasMany[rel].inverseProperty + "` VARCHAR(32))", null ]);
                generatedTables[tableName] = true;
              }
            }
          }
          rowDef = rowDef.substring(0, rowDef.length - 2);
          generatedTables[meta.name] = true;
          queries.push( [
              "CREATE TABLE IF NOT EXISTS `" + meta.name + "` ( id VARCHAR(32) PRIMARY KEY, " + rowDef + ")",
              null ]);
        }
      }
      persistence.transaction(function (tx) {
          executeQueriesSeq(tx, queries, callback, tx);
        });
    };

    /**
     * Adds the object to tracked entities to be persisted
     * 
     * @param obj
     *            the object to be tracked
     */
    persistence.add = function (obj) {
      if (!trackedObjects[obj.id]) {
        trackedObjects[obj.id] = obj;
      }
    };

    /**
     * Marks the object to be removed (on next flush)
     * @param obj object to be removed
     */
    persistence.remove = function(obj) {
      if (!objectsToRemove[obj.id]) {
        objectsToRemove[obj.id] = obj;
      }
    };

    /**
     * Persists all changes to the database
     * 
     * @param tx
     *            transaction to use
     * @param callback
     *            function to be called when done
     */
    persistence.flush = function (tx, callback) {
      if(!tx) {
        persistence.transaction(function(tx) { persistence.flush(tx, callback); });
        return;
      }
      var persistObjArray = [];
      for (var id in trackedObjects) {
        if (trackedObjects.hasOwnProperty(id)) {
          persistObjArray.push(trackedObjects[id]);
        }
      }
      var removeObjArray = [];
      for (var id in objectsToRemove) {
        if (objectsToRemove.hasOwnProperty(id)) {
          removeObjArray.push(objectsToRemove[id]);
          delete trackedObjects[id]; // Stop tracking
        }
      }
      objectsToRemove = {};
      if(callback) {
        function removeOneObject() {
          var obj = removeObjArray.pop();
          remove(obj, tx, function () {
              if (removeObjArray.length > 0) {
                removeOneObject();
              } else if (callback) {
                callback();
              }
            });
        }
        function persistOneObject () {
          var obj = persistObjArray.pop();
          save(obj, tx, function () {
              if (persistObjArray.length > 0) {
                persistOneObject();
              } else if(removeObjArray.length > 0) {
                removeOneObject();
              } else if (callback) {
                callback();
              }
            });
        }
        if (persistObjArray.length > 0) {
          persistOneObject();
        } else if(removeObjArray.length > 0) {
          removeOneObject();
        } else if(callback) {
          callback();
        }
      } else { // More efficiently
        for(var i = 0; i < persistObjArray.length; i++) {
          save(persistObjArray[i], tx);
        }
        for(var i = 0; i < removeObjArray.length; i++) {
          remove(removeObjArray[i], tx);
        }
      }
    }

    /**
     * Clean the persistence context of cached entities and such.
     */
    persistence.clean = function () {
      trackedObjects = {};
    }

    /**
     * Remove all tables in the database (as defined by the model)
     */
    persistence.reset = function (tx) {
      if(!tx) {
        persistence.transaction(function(tx) { persistence.reset(tx); });
        return;
      }
      var tableArray = [];
      for (var p in generatedTables) {
        if (generatedTables.hasOwnProperty(p)) {
          tableArray.push(p);
        }
      }
      function dropOneTable () {
        var tableName = tableArray.pop();
        tx.executeSql("DROP TABLE " + tableName, null, function () {
            if (tableArray.length > 0) {
              dropOneTable();
            }
          });
      }
      dropOneTable();
      persistence.clean();
      generatedTables = {};
    }

    /**
     * Converts a database row into an entity object
     */
    persistence.rowToEntity = function (entityName, row, prefix) {
      prefix = prefix || '';
      if (trackedObjects[row[prefix + "id"]]) { // Cached version
        return trackedObjects[row[prefix + "id"]];
      }
      var rowMeta = entityMeta[entityName];
      var ent = getEntity(entityName);
      if(!row[prefix+'id']) { // null value, no entity found
        return null;
      }
      var o = new ent();
      o.id = row[prefix + 'id'];
      o._new = false;
      for ( var p in row) {
        if (row.hasOwnProperty(p)) {
          if (p.substring(0, prefix.length) === prefix) {
            var prop = p.substring(prefix.length);
            if (prop != 'id') {
              o._data[prop] = persistence.dbValToEntityVal(row[p], rowMeta.fields[prop]);
            }
          }
        }
      }
      return o;
    }

    /**
     * Converts a value from the database to a value suitable for the entity
     * (also does type conversions, if necessary)
     */
    persistence.dbValToEntityVal = function (val, type) {
      switch (type) {
      case 'DATE':
        // SQL is in seconds and JS in miliseconds
        return new Date(parseInt(val, 10) * 1000);
      case 'BOOL':
        return val == 1;
        break;
      case 'JSON':
        if(val) {
          return JSON.parse(val);
        } else {
          return val;
        }
        break;
      default:
        return val;
      }
    }

    /**
     * Converts an entity value to a database value (inverse of
     *   dbValToEntityVal)
     */
    persistence.entityValToDbVal = function (val, type) {
      if (val === undefined || val === null) {
        return null;
      } else if (type === 'JSON' && val) {
        return JSON.stringify(val);
      } else if (val.id) {
        return val.id;
      } else if (type === 'BOOL') {
        return val ? 1 : 0;
      } else if (type == 'DATE') {
        // In order to make SQLite Date/Time functions work we should store
        // values in seconds and not as miliseconds as JS Date.getTime()
        return Math.round(val.getTime() / 1000);
      } else {
        return val;
      }
    }

    /**
     * Internal cache of entity constructor functions
     */
    var entityClassCache = {};

    /**
     * Retrieves or creates an entity constructor function for a given
     * entity name
     * @return the entity constructor function to be invoked with `new fn()`
     */
    function getEntity (entityName) {
      if (entityClassCache[entityName]) {
        return entityClassCache[entityName];
      }
      var meta = entityMeta[entityName];

      /**
       * @constructor
       */
      function Entity (obj) {
        var that = this;
        this.id = createUUID();
        this._new = true;
        this._type = entityName;
        this._dirtyProperties = {};
        this._data = {};
        this._data_obj = {}; // references to objects
        this.subscribers = {}; // observable

        for ( var field in meta.fields) {
          (function () {
              if (meta.fields.hasOwnProperty(field)) {
                var f = field; // Javascript scopes/closures SUCK
                that.__defineSetter__(f, function (val) {
                    var oldValue = that._data[f];
                    that._data[f] = val;
                    that._dirtyProperties[f] = true;
                    that.triggerEvent('set', that, f, val);
                    that.triggerEvent('change', that, f, val);
                    propertyChanged(entityName, f, that, oldValue, val);
                  });
                that.__defineGetter__(f, function () {
                    return that._data[f];
                  });
                that._data[field] = defaultValue(meta.fields[field]);
              }
            }());
        }

        for ( var it in meta.hasOne) {
          if (meta.hasOne.hasOwnProperty(it)) {
            (function () {
                var ref = it;
                that.__defineSetter__(ref, function (val) {
                    var oldValue = that._data[ref];
                    if (val == null) {
                      that._data[ref] = null;
                      that._data_obj[ref] = undefined;
                    } else if (val.id) {
                      that._data[ref] = val.id;
                      that._data_obj[ref] = val;
                      persistence.add(val);
                    } else { // let's assume it's an id
                      that._data[ref] = val;
                    }
                    that._dirtyProperties[ref] = true;
                    that.triggerEvent('set', that, ref, val);
                    that.triggerEvent('change', that, f, val);
                    propertyChanged(entityName, ref, that, oldValue, val);
                  });
                that.__defineGetter__(ref, function () {
                    if (that._data[ref] === null || that._data_obj[ref] !== undefined) {
                      return that._data_obj[ref];
                    } else if(that._data[ref] !== null && trackedObjects[that._data[ref]]) {
                      that._data_obj[ref] = trackedObjects[that._data[ref]];
                      return that._data_obj[ref];
                    } else {
                      throw "Property '" + ref + "' with id: " + that._data[ref]
                      + " not fetched, either prefetch it or fetch it manually.";
                    }
                  });
              }());
          }
        }

        for ( var it in meta.hasMany) {
          if (meta.hasMany.hasOwnProperty(it)) {
            (function () {
                var coll = it;
                if (meta.hasMany[coll].manyToMany) {
                  that.__defineSetter__(coll, function (val) {
                      throw "Not yet supported.";
                    });
                  that.__defineGetter__(coll,
                    function () {
                      if (this._data[coll]) {
                        return that._data[coll];
                      } else {
                        var inverseMeta = meta.hasMany[coll].type.meta;

                        var queryColl = new ManyToManyDbQueryCollection(inverseMeta.name);
                        queryColl.initManyToMany(that, coll);
                        queryColl._additionalJoinSqls.push("LEFT JOIN `"
                          + meta.hasMany[coll].tableName + "` AS mtm ON mtm.`"
                          + inverseMeta.name + '_' + meta.hasMany[coll].inverseProperty
                          + "` = `" + inverseMeta.name + "`.`id` ");
                        queryColl._additionalWhereSqls.push("mtm.`" + meta.name + '_' + coll
                          + "` = '" + that.id + "'");
                        that._data[coll] = queryColl;
                        return uniqueQueryCollection(queryColl);
                      }
                    });
                } else {
                  that.__defineSetter__(coll, function (val) {
                      throw "Not yet supported.";
                    });
                  that.__defineGetter__(coll, function () {
                      if (this._data[coll]) {
                        return that._data[coll];
                      } else {
                        var queryColl = uniqueQueryCollection(new DbQueryCollection(meta.hasMany[coll].type.meta.name).filter(meta.hasMany[coll].inverseProperty, '=', that));
                        that._data[coll] = queryColl;
                        return queryColl;
                      }
                    });
                }
              }());
            }
          }

          for ( var f in obj) {
            if (obj.hasOwnProperty(f)) {
              that[f] = obj[f];
            }
          }
        } // Entity

        Entity.prototype = new Observable();

        Entity.meta = meta;

        Entity.prototype.equals = function(other) {
          return this.id == other.id;
        }

        Entity.prototype.fetch = function(tx, rel, callback) {
          var that = this;
          if(!tx) {
            persistence.transaction(function(tx) {
                that.fetch(tx, rel, callback);
              });
            return;
          }
          if(!this._data[rel]) { // null
            if(callback) {
              callback(null);
            }
          } else if(this._data_obj[rel]) { // already loaded
            if(callback) { 
              callback(this._data_obj[rel]);
            }
          } else {
            meta.hasOne[rel].type.load(tx, this._data[rel], function(obj) {
                that._data_obj[rel] = obj;
                if(callback) {
                  callback(obj);
                }
              });
          }
        }

        /**
         * Currently this is only required when changing JSON properties
         */
        Entity.prototype.markDirty = function(prop) {
          this._dirtyProperties[prop] = true;
        };

        /**
         * Returns a QueryCollection implementation matching all instances
         * of this entity in the database
         */
        Entity.all = function () {
          return uniqueQueryCollection(new AllDbQueryCollection(entityName));
        }

        Entity.load = function(tx, id, callback) {
          if(!tx) {
            persistence.transaction(function(tx) {
              Entity.load(tx, id, callback);
            });
            return;
          }
          if(!id) {
            callback(null);
          }
          tx.executeSql("SELECT * FROM `" + entityName + "` WHERE id = ?", [id], function(results) {
              if(results.length == 0) {
                callback(null);
              }
              callback(persistence.rowToEntity(entityName, results[0]));
            });
        }

        /**
         * Declares a one-to-many or many-to-many relationship to another entity
         * Whether 1:N or N:M is chosed depends on the inverse declaration
         * @param collName the name of the collection (becomes a property of 
         *   Entity instances
         * @param otherEntity the constructor function of the entity to define 
         *   the relation to
         * @param inverseRel the name of the inverse property (to be) defined on otherEntity
         */
        Entity.hasMany = function (collName, otherEntity, invRel) {
          var otherMeta = otherEntity.meta;
          if (otherMeta.hasMany[invRel]) { 
            // other side has declared it as a one-to-many relation too -> it's in
            // fact many-to-many
            var tableName = meta.name + "_" + collName + "_" + otherMeta.name;
            var inverseTableName = otherMeta.name + '_' + invRel + '_' + meta.name;

            if (tableName > inverseTableName) { 
              // Some arbitrary way to deterministically decide which table to generate
              tableName = inverseTableName;
            }
            meta.hasMany[collName] = {
              type: otherEntity,
              inverseProperty: invRel,
              manyToMany: true,
              tableName: tableName
            };
            otherMeta.hasMany[invRel] = {
              type: Entity,
              inverseProperty: collName,
              manyToMany: true,
              tableName: tableName
            };
            delete meta.hasOne[collName];
          } else {
            meta.hasMany[collName] = {
              type: otherEntity,
              inverseProperty: invRel
            };
            otherMeta.hasOne[invRel] = {
              type: Entity,
              inverseProperty: collName
            };
          }
        }

        Entity.hasOne = function (refName, otherEntity) {
          meta.hasOne[refName] = {
            type: otherEntity
          };
        }

        entityClassCache[entityName] = Entity;
        return Entity;
      }


      /**
       * Dumps the entire database into an object (that can be serialized to JSON for instance)
       * @param tx transaction to use, use `null` to start a new one
       * @param entities a list of entity constructor functions to serialize, use `null` for all
       * @param callback (object) the callback function called with the results.
       */
      persistence.dump = function(tx, entities, callback) {
        if(!entities) { // Default: all entity types
          entities = [];
          for(var e in entityClassCache) {
            if(entityClassCache.hasOwnProperty(e)) {
              entities.push(entityClassCache[e]);
            }
          }
        }

        var finishedCount = 0;
        var result = {};
        for(var i = 0; i < entities.length; i++) {
          (function() {
              var Entity = entities[i];
              Entity.all().list(tx, function(all) {
                  result[Entity.meta.name] = all.map(function(e) { 
                      var rec = {};
                      var fields = Entity.meta.fields;
                      for(var f in fields) {
                        if(fields.hasOwnProperty(f)) {
                          rec[f] = e._data[f];
                        }
                      }
                      var refs = Entity.meta.hasOne;
                      for(var r in refs) {
                        if(refs.hasOwnProperty(r)) {
                          rec[r] = e._data[r];
                        }
                      }
                      rec.id = e.id;
                      return rec;
                  });
                  finishedCount++;
                  if(finishedCount === entities.length) {
                    callback(result);
                  }
                });
            }());
        }
      };

      /**
       * Loads a set of entities from a dump object
       * @param tx transaction to use, use `null` to start a new one
       * @param dump the dump object
       * @param callback the callback function called when done.
       */
      persistence.load = function(tx, dump, callback) {
        var finishedCount = 0;
        for(var entityName in dump) {
          if(dump.hasOwnProperty(entityName)) {
            var Entity = getEntity(entityName);
            var instances = dump[entityName];
            for(var i = 0; i < instances.length; i++) {
              var instance = instances[i];
              var ent = new Entity();
              for(var p in instance) {
                if(instance.hasOwnProperty(p)) {
                  ent[p] = instance[p];
                }
              }
              persistence.add(ent);
            }
          }
        }
        persistence.flush(tx, callback);
      };

      /**
       * Dumps the entire database to a JSON string 
       * @param tx transaction to use, use `null` to start a new one
       * @param entities a list of entity constructor functions to serialize, use `null` for all
       * @param callback (jsonDump) the callback function called with the results.
       */
      persistence.dumpToJson = function(tx, entities, callback) {
        persistence.dump(tx, entities, function(obj) {
            callback(JSON.stringify(obj));
          });
      };

      /**
       * Loads data from a JSON string (as dumped by `dumpToJson`)
       * @param tx transaction to use, use `null` to start a new one
       * @param entities a list of entity constructor functions to serialize, use `null` for all
       * @param callback (jsonDump) the callback function called with the results.
       */
      persistence.loadFromJson = function(tx, jsonDump, callback) {
        persistence.load(tx, JSON.parse(json), callback);
      };

      /**
       * Internal function to persist an object to the database
       * this function is invoked by persistence.flush()
       */
      function save (obj, tx, callback) {
        var meta = entityMeta[obj._type];
        var properties = [];
        var values = [];
        var qs = [];
        var propertyPairs = [];
        for ( var p in obj._dirtyProperties) {
          if (obj._dirtyProperties.hasOwnProperty(p)) {
            properties.push("`" + p + "`");
            values.push(persistence.entityValToDbVal(obj[p], meta.fields[p]));
            qs.push('?');
            propertyPairs.push("`" + p + "` = ?");
          }
        }
        var additionalQueries = [];
        for(var p in meta.hasMany) {
          if(meta.hasMany.hasOwnProperty(p)) {
            additionalQueries = additionalQueries.concat(obj[p].persistQueries());
          }
        }
        executeQueriesSeq(tx, additionalQueries, function() {
          if (properties.length === 0) { // Nothing changed
            if(callback) callback();
            return;
          }
          obj._dirtyProperties = {};
          if (obj._new) {
            properties.push('id');
            values.push(obj.id);
            qs.push('?');
            var sql = "INSERT INTO `" + obj._type + "` (" + properties.join(", ") + ") VALUES (" + qs.join(', ') + ")";
            obj._new = false;
            tx.executeSql(sql, values, callback);
          } else {
            var sql = "UPDATE `" + obj._type + "` SET " + propertyPairs.join(',') + " WHERE id = '" + obj.id + "'";
            tx.executeSql(sql, values, callback);
          }
        });
      }

      function remove (obj, tx, callback) {
        var queries = [["DELETE FROM `" + obj._type + "` WHERE id = '" + obj.id + "'", null]];
        var meta = persistence.getMeta(obj._type);
        for (var rel in meta.hasMany) {
          if (meta.hasMany.hasOwnProperty(rel) && meta.hasMany[rel].manyToMany) {
            var tableName = meta.hasMany[rel].tableName;
            //var inverseProperty = meta.hasMany[rel].inverseProperty;
            queries.push(["DELETE FROM `" + tableName + "` WHERE `" + meta.name + '_' + rel + "` = '" + obj.id + "'", null]);
          }
        }
        executeQueriesSeq(tx, queries, callback);
      }

      /**
       * Utility function to execute a series of queries in an asynchronous way
       * @param tx the transaction to execute the queries on
       * @param queries an array of [query, args] tuples
       * @param callback the function to call when all queries have been executed
       */
      function executeQueriesSeq (tx, queries, callback) {
        // queries.reverse();
        var callbackArgs = [];
        for ( var i = 3; i < arguments.length; i++) {
          callbackArgs.push(arguments[i]);
        }
        function executeOne () {
          var queryTuple = queries.pop();
          tx.executeSql(queryTuple[0], queryTuple[1], function () {
              if (queries.length > 0) {
                executeOne();
              } else if (callback) {
                callback.apply(this, callbackArgs);
              }
            }, function(_, err) { console.log(err); });
        }
        if (queries.length > 0) {
          executeOne();
        } else if (callback) {
          callback.apply(this, callbackArgs);
        }
      }

      /**
       * Generates a UUID according to http://www.ietf.org/rfc/rfc4122.txt
       */
      function createUUID () {
        var s = [];
        var hexDigits = "0123456789ABCDEF";
        for ( var i = 0; i < 32; i++) {
          s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
        }
        s[12] = "4";
        s[16] = hexDigits.substr((s[16] & 0x3) | 0x8, 1);

        var uuid = s.join("");
        return uuid;
      }


      function defaultValue(type) {
        switch(type) {
        case "TEXT": return "";
        case "INT": return 0;
        case "BOOL": return false;
        default: return null;
        }
      }

      ////////////////// QUERY COLLECTIONS \\\\\\\\\\\\\\\\\\\\\\\

      /**
       * Simple observable function constructor
       * @constructor
       */
      function Observable() {
        this.subscribers = {};
      }

      Observable.prototype.addEventListener = function (eventType, fn) {
        if (typeof eventType == 'object') { // assume it's an array
          var eventTypes = eventType;
          for ( var i = 0; i < eventTypes.length; i++) {
            var eventType = eventTypes[i];
            if (!this.subscribers[eventType]) {
              this.subscribers[eventType] = [];
            }
            this.subscribers[eventType].push(fn);
          }
        } else {
          if (!this.subscribers[eventType]) {
            this.subscribers[eventType] = [];
          }
          this.subscribers[eventType].push(fn);
        }
      };

      Observable.prototype.removeEventListener = function(eventType, fn) {
        var subscribers = this.subscribers[eventType];
        for ( var i = 0; i < subscribers.length; i++) {
          if(subscribers[i] == fn) {
            this.subscribers[eventType].splice(i, 1);
            return true;
          }
        }
        return false;
      };

      Observable.prototype.triggerEvent = function (eventType) {
        if (!this.subscribers[eventType]) { // No subscribers to this event type
          return;
        }
        for (var sid in this.subscribers[eventType]) {
          if(this.subscribers[eventType].hasOwnProperty(sid)) {
            this.subscribers[eventType][sid].apply(null, arguments);
          }
        }
      };

      /*
       * Each filter has 4 methods:
       * - sql(prefix, values) -- returns a SQL representation of this filter,
       *     possibly pushing additional query arguments to `values` if ?'s are used
       *     in the query
       * - match(o) -- returns whether the filter matches the object o.
       * - makeFit(o) -- attempts to adapt the object o in such a way that it matches
       *     this filter.
       * - makeNotFit(o) -- the oppositive of makeFit, makes the object o NOT match
       *     this filter
       */

      /**
       * Default filter that does not filter on anything
       * currently it generates a 1=1 SQL query, which is kind of ugly
       */
      function NullFilter () {
      }

      NullFilter.prototype.sql = function (prefix, values) {
        return "1=1";
      };

      NullFilter.prototype.match = function (o) {
        return true;
      };

      NullFilter.prototype.makeFit = function(o) {
      };

      NullFilter.prototype.makeNotFit = function(o) {
      };

      /**
       * Filter that makes sure that both its left and right filter match
       * @param left left-hand filter object
       * @param right right-hand filter object
       */
      function AndFilter (left, right) {
        this.left = left;
        this.right = right;
      }

      AndFilter.prototype.sql = function (prefix, values) {
        return "(" + this.left.sql(prefix, values) + " AND "
               + this.right.sql(prefix, values) + ")";
      }

      AndFilter.prototype.match = function (o) {
        return this.left.match(o) && this.right.match(o);
      }

      AndFilter.prototype.makeFit = function(o) {
        this.left.makeFit(o);
        this.right.makeFit(o);
      }

      AndFilter.prototype.makeNotFit = function(o) {
        this.left.makeNotFit(o);
        this.right.makeNotFit(o);
      }

      /**
       * Filter that checks whether a certain property matches some value, based on an
       * operator. Supported operators are '=', '!=', '<', '<=', '>' and '>='.
       * @param property the property name
       * @param operator the operator to compare with
       * @param value the literal value to compare to
       */
      function PropertyFilter (property, operator, value) {
        this.property = property;
        this.operator = operator;
        this.value = value;
      }

      PropertyFilter.prototype.sql = function (prefix, values) {
        if (this.operator === '=' && this.value === null) {
          return "`" + prefix + this.property + "` IS NULL";
        } else if (this.operator === '!=' && this.value === null) {
          return "`" + prefix + this.property + "` IS NOT NULL";
        } else {
          var value = this.value;
          if(value === true || value === false) {
            value = value ? 1 : 0;
          }
          values.push(persistence.entityValToDbVal(value));
          return "`" + prefix + this.property + "` " + this.operator + " ?";
        }
      }

      PropertyFilter.prototype.match = function (o) {
        switch (this.operator) {
        case '=':
          return o[this.property] === this.value;
          break;
        case '!=':
          return o[this.property] !== this.value;
          break;
        case '<':
          return o[this.property] < this.value;
          break;
        case '<=':
          return o[this.property] <= this.value;
          break;
        case '>':
          return o[this.property] > this.value;
          break;
        case '>=':
          return o[this.property] >= this.value;
          break;
        }
      }

      PropertyFilter.prototype.makeFit = function(o) {
        if(this.operator === '=') {
          o[this.property] = this.value;
        } else {
          throw "Sorry, can't perform makeFit for other filters than =";
        }
      }

      PropertyFilter.prototype.makeNotFit = function(o) {
        if(this.operator === '=') {
          o[this.property] = null;
        } else {
          throw "Sorry, can't perform makeNotFit for other filters than =";
        }            
      }

      /**
       * Ensure global uniqueness of query collection object
       */
      function uniqueQueryCollection(coll) {
        var uniqueString = coll.toUniqueString();
        if(!queryCollectionCache[uniqueString]) {
          queryCollectionCache[uniqueString] = coll;
        }
        return queryCollectionCache[uniqueString];
      }

      /**
       * The constructor function of the _abstract_ QueryCollection
       * DO NOT INSTANTIATE THIS
       * @constructor
       */
      function QueryCollection () {
      }

      QueryCollection.prototype = new Observable();

      /**
       * Function called when session is flushed, returns list of SQL queries to execute 
       * (as [query, arg] tuples)
       */
      QueryCollection.prototype.persistQueries = function() { return []; };

      /**
       * Invoked by sub-classes to initialize the query collection
       */
      QueryCollection.prototype.init = function (entityName, constructor) {
        this._filter = new NullFilter();
        this._orderColumns = []; // tuples of [column, ascending]
        this._prefetchFields = [];
        this._additionalJoinSqls = [];
        this._additionalWhereSqls = [];
        this._entityName = entityName;
        this._constructor = constructor;
        this._limit = -1;
        this._skip = 0;
        // For observable
        this.subscribers = {};
      }

      QueryCollection.prototype.toUniqueString = function() {
        var s = this._constructor.name + ": " + this._entityName;
        s += '|Filter:';
        var values = [];
        s += this._filter.sql('', values);
        s += '|Values:';
        for(var i = 0; i < values.length; i++) {
          s += values + "|^|";
        }
        s += '|Order:';
        for(var i = 0; i < this._orderColumns.length; i++) {
          var col = this._orderColumns[i];
          s += col[0] + ", " + col[1];
        }
        s += '|Prefetch:';
        for(var i = 0; i < this._prefetchFields.length; i++) {
          s += this._prefetchFields[i];
        }
        s += '|JoinSQLs:';
        for(var i = 0; i < this._additionalJoinSqls.length; i++) {
          s += this._additionalJoinSqls[i];
        }
        s += '|WhereSQLs:';
        for(var i = 0; i < this._additionalWhereSqls.length; i++) {
          s += this._additionalWhereSqls[i];
        }
        s += '|Limit:';
        s += this._limit;
        s += '|Skip:';
        s += this._skip;
        return s;
      };

      /**
       * Creates a clone of this query collection
       * @return a clone of the collection
       */
      QueryCollection.prototype.clone = function (cloneSubscribers) {
        var c = new (this._constructor)(this._entityName);
        c._filter = this._filter;
        c._prefetchFields = this._prefetchFields.slice(0); // clone
        c._orderColumns = this._orderColumns.slice(0);
        c._additionalJoinSqls = this._additionalJoinSqls.slice(0);
        c._additionalWhereSqls = this._additionalWhereSqls.slice(0);
        c._limit = this._limit;
        c._skip = this._skip;
        if(cloneSubscribers) {
          var subscribers = {};
          for(var eventType in this.subscribers) {
            if(this.subscribers.hasOwnProperty(eventType)) {
              subscribers[eventType] = subs.slice(0);
            }
          }
          c.subscribers = subscribers; //this.subscribers;
        } else {
          c.subscribers = this.subscribers;
        }
        return c;
      };

      /**
       * Returns a new query collection with a property filter condition added
       * @param property the property to filter on
       * @param operator the operator to use
       * @param value the literal value that the property should match
       * @return the query collection with the filter added
       */
      QueryCollection.prototype.filter = function (property, operator, value) {
        var c = this.clone(true);
        c._filter = new AndFilter(this._filter, new PropertyFilter(property,
            operator, value));
        // Add global listener (TODO: memory leak waiting to happen!)
        c = uniqueQueryCollection(c);
        subscribeToGlobalPropertyListener(c, this._entityName, property);
        return uniqueQueryCollection(c);
      };

      QueryCollection.prototype.subscribeToAllFilters = function() {
      };

      /**
       * Returns a new query collection with an ordering imposed on the collection
       * @param property the property to sort on
       * @param ascending should the order be ascending (= true) or descending (= false)
       * @return the query collection with imposed ordering
       */
      QueryCollection.prototype.order = function (property, ascending) {
        ascending = ascending === undefined ? true : ascending;
        var c = this.clone();
        c._orderColumns.push( [ property, ascending ]);
        return uniqueQueryCollection(c);
      };

      /**
       * Returns a new query collection will limit its size to n items
       * @param n the number of items to limit it to
       * @return the limited query collection
       */
      QueryCollection.prototype.limit = function(n) {
        var c = this.clone();
        c._limit = n;
        return uniqueQueryCollection(c);
      };

      /**
       * Returns a new query collection which will skip the first n results
       * @param n the number of results to skip
       * @return the query collection that will skip n items
       */
      QueryCollection.prototype.skip = function(n) {
        var c = this.clone();
        c._skip = n;
        return uniqueQueryCollection(c);
      };

      /*
       * Returns a new query collection which will prefetch a certain object relationship.
       * Only works with 1:1 and N:1 relations.
       * @param rel the relation name of the relation to prefetch
       * @return the query collection prefetching `rel`
       */
      QueryCollection.prototype.prefetch = function (rel) {
        var c = this.clone();
        c._prefetchFields.push(rel);
        return uniqueQueryCollection(c);
      };

      /**
       * Adds an object to a collection
       * @param obj the object to add
       */
      QueryCollection.prototype.add = function(obj) {
        if(!obj.id || !obj._type) {
          throw "Cannot add object of non-entity type onto collection.";
        }
        persistence.add(obj);
        this._filter.makeFit(obj);
        this.triggerEvent('add', this, obj);
        this.triggerEvent('change', this, obj);
      }

      /**
       * Removes an object from a collection
       * @param obj the object to remove from the collection
       */
      QueryCollection.prototype.remove = function(obj) {
        if(!obj.id || !obj._type) {
          throw "Cannot remove object of non-entity type from collection.";
        }
        this._filter.makeNotFit(obj);
        this.triggerEvent('remove', this, obj);
        this.triggerEvent('change', this, obj);
      }


      /**
       * A database implementation of the QueryCollection
       * @param entityName the name of the entity to create the collection for
       * @constructor
       */
      function DbQueryCollection (entityName) {
        this.init(entityName, DbQueryCollection);
      }

      DbQueryCollection.prototype = new QueryCollection();

      /**
       * Execute a function for each item in the list
       * @param tx the transaction to use (or null to open a new one)
       * @param eachFn (elem) the function to be executed for each item
       */
      DbQueryCollection.prototype.each = function (tx, eachFn) {
        if(tx && !tx.executeSql) { // provided oneFn as first argument
          eachFn = tx;
          tx = null;
        }

        this.list(tx, function(results) {
            for(var i = 0; i < results.length; i++) {
              eachFn(results[i]);
            }
          });
      }

      DbQueryCollection.prototype.one = function (tx, oneFn) {
        if(tx && !tx.executeSql) { // provided oneFn as first argument
          oneFn = tx;
          tx = null;
        }

        this.limit(1).list(tx, function(results) {
            if(results.length === 0) {
              oneFn(null);
            } else {
              oneFn(results[0]);
            }
        });
      }

      /**
       * Asynchronous call to actually fetch the items in the collection
       * @param tx transaction to use
       * @param callback function to be called taking an array with 
       *   result objects as argument
       */
      DbQueryCollection.prototype.list = function (tx, callback) {
        var that = this;
        if(!tx) { // no transaction supplied
          persistence.transaction(function(tx) {
              that.list(tx, callback);
            });
          return;
        }
        var entityName = this._entityName;
        var meta = persistence.getMeta(entityName);

        function selectAll (meta, tableAlias, prefix) {
          var selectFields = [ "`" + tableAlias + "`.id AS " + prefix + "id" ];
          for ( var p in meta.fields) {
            if (meta.fields.hasOwnProperty(p)) {
              selectFields.push("`" + tableAlias + "`.`" + p + "` AS `"
                + prefix + p + "`");
            }
          }
          for ( var p in meta.hasOne) {
            if (meta.hasOne.hasOwnProperty(p)) {
              selectFields.push("`" + tableAlias + "`.`" + p + "` AS `"
                + prefix + p + "`");
            }
          }
          return selectFields;
        }
        var args = [];
        var mainPrefix = entityName + "_";

        var selectFields = selectAll(meta, meta.name, mainPrefix);

        var joinSql = this._additionalJoinSqls.join(' ');

        for ( var i = 0; i < this._prefetchFields.length; i++) {
          var prefetchField = this._prefetchFields[i];
          var thisMeta = meta.hasOne[prefetchField].type.meta;
          var tableAlias = thisMeta.name + '_' + prefetchField + "_tbl";
          selectFields = selectFields.concat(selectAll(thisMeta, tableAlias,
              prefetchField + "_"));
          joinSql += "LEFT JOIN `" + thisMeta.name + "` AS `" + tableAlias
          + "` ON `" + tableAlias + "`.`id` = `" + mainPrefix
          + prefetchField + "` ";

        }

        var whereSql = "WHERE "
        + [ this._filter.sql(mainPrefix, args) ].concat(
          this._additionalWhereSqls).join(' AND ');

        var sql = "SELECT " + selectFields.join(", ") + " FROM `" + entityName
        + "` " + joinSql + " " + whereSql;
        if (this._orderColumns.length > 0) {
          sql += " ORDER BY "
          + this._orderColumns.map(
            function (c) {
              return "`" + mainPrefix + c[0] + "` "
              + (c[1] ? "ASC" : "DESC");
            }).join(", ");
        }
        if(this._limit >= 0) {
          sql += " LIMIT " + this._limit;
        }
        if(this._skip > 0) {
          sql += " OFFSET " + this._skip;
        }
        persistence.flush(tx, function () {
            tx.executeSql(sql, args, function (rows) {
                var results = [];
                for ( var i = 0; i < rows.length; i++) {
                  var r = rows[i];
                  var e = persistence.rowToEntity(entityName, r, mainPrefix);
                  for ( var j = 0; j < that._prefetchFields.length; j++) {
                    var prefetchField = that._prefetchFields[j];
                    var thisMeta = meta.hasOne[prefetchField].type.meta;
                    e[prefetchField] = persistence.rowToEntity(
                      thisMeta.name, r, prefetchField + '_');
                  }
                  results.push(e);
                  persistence.add(e);
                }
                callback(results);
                that.triggerEvent('list', that, results);
              });
          });
      };

      /**
       * An implementation of QueryCollection, that is used
       * to represent all instances of an entity type
       * @constructor
       */
      function AllDbQueryCollection (entityName) {
        this.init(entityName, AllDbQueryCollection);
      }

      AllDbQueryCollection.prototype = new DbQueryCollection();

      AllDbQueryCollection.prototype.add = function(obj) {
        persistence.add(obj);
        this.triggerEvent('add', this, obj);
        this.triggerEvent('change', this, obj);
      };

      AllDbQueryCollection.prototype.remove = function(obj) {
        persistence.remove(obj);
        this.triggerEvent('remove', this, obj);
        this.triggerEvent('change', this, obj);
      };

      /**
       * A ManyToMany implementation of QueryCollection 
       * @constructor
       */
      function ManyToManyDbQueryCollection (entityName) {
        this.init(entityName, ManyToManyDbQueryCollection);
        this._localAdded = [];
        this._localRemoved = [];
      }

      ManyToManyDbQueryCollection.prototype = new DbQueryCollection();

      ManyToManyDbQueryCollection.prototype.initManyToMany = function(obj, coll) {
        this._obj = obj;
        this._coll = coll;
      }

      ManyToManyDbQueryCollection.prototype.add = function(obj) {
        if(!this._localAdded.contains(obj)) {
          persistence.add(obj);
          this._localAdded.push(obj);
        }
      }

      ManyToManyDbQueryCollection.prototype.clone = function() {
        var c = DbQueryCollection.prototype.clone.call(this);
        c._localAdded = this._localAdded;
        c._localRemoved = this._localRemoved;
        c._obj = this._obj;
        c._coll = this._coll;
        return c;
      }

      ManyToManyDbQueryCollection.prototype.remove = function(obj) {
        if(this._localAdded.contains(obj)) { // added locally, can just remove it from there
          this._localAdded.remove(obj);
        } else if(!this._localRemoved.contains(obj)) {
          this._localRemoved.push(obj);
        }
      }

      ManyToManyDbQueryCollection.prototype.persistQueries = function() {
        var queries = [];
        var meta = persistence.getMeta(this._obj._type);
        var inverseMeta = meta.hasMany[this._coll].type.meta;
        // Added
        for(var i = 0; i < this._localAdded.length; i++) {
          queries.push(["INSERT INTO " + meta.hasMany[this._coll].tableName + 
                " (`" + meta.name + "_" + this._coll + "`, `" + 
                inverseMeta.name + '_' + meta.hasMany[this._coll].inverseProperty +
                "`) VALUES (?, ?)", [this._obj.id, this._localAdded[i].id]]);
        }
        this._localAdded = [];
        // Removed
        for(var i = 0; i < this._localRemoved.length; i++) {
          queries.push(["DELETE FROM  " + meta.hasMany[this._coll].tableName + 
                " WHERE `" + meta.name + "_" + this._coll + "` = ? AND `" + 
                inverseMeta.name + '_' + meta.hasMany[this._coll].inverseProperty +
                "` = ?", [this._obj.id, this._localRemoved[i].id]]);
        }
        this._localRemoved = [];
        return queries;
      }

      ////////// Local implementation of QueryCollection \\\\\\\\\\\\\\\\

      function LocalQueryCollection(initialArray) {
        this.init(null, LocalQueryCollection);
        this._items = initialArray || [];
      }

      LocalQueryCollection.prototype = new QueryCollection();

      LocalQueryCollection.prototype.clone = function() {
        var c = DbQueryCollection.prototype.clone.call(this);
        c._items = this._items;
        return c;
      };

      LocalQueryCollection.prototype.add = function(obj) {
        this._items.push(obj);
        this.triggerEvent('add', this, obj);
        this.triggerEvent('change', this, obj);
      };

      LocalQueryCollection.prototype.remove = function(obj) {
        var items = this._items;
        for(var i = 0; i < items.length; i++) {
          if(items[i] === obj) {
            this._items.splice(i, 1);
            this.triggerEvent('remove', this, obj);
            this.triggerEvent('change', this, obj);
          }
        }
      };

      LocalQueryCollection.prototype.list = function(callback) {
        if(!callback || callback.executeSql) { // first argument is transaction
          callback = arguments[1]; // set to second argument
        }
        var array = this._items.slice(0);
        var that = this;
        var results = [];
        for(var i = 0; i < array.length; i++) {
          if(this._filter.match(array[i])) {
            results.push(array[i]);
          }
        }
        results.sort(function(a, b) {
            for(var i = 0; i < that._orderColumns.length; i++) {
              var col = that._orderColumns[i][0];
              var asc = that._orderColumns[i][1];
              if(a[col] < b[col]) {
                return asc ? -1 : 1;
              } else if(a[col] > b[col]) {
                return asc ? 1 : -1;
              } 
            }
            return 0;
          });
        if(this._skip) {
          results.splice(0, this._skip);
        }
        if(this._limit > -1) {
          results = results.slice(0, this._limit);
        }
        if(callback) {
          callback(results);
        } else {
          return results;
        }
      };

      persistence.QueryCollection = QueryCollection;
      persistence.LocalQueryCollection = LocalQueryCollection;
      persistence.Observable           = Observable;

      ////////// Low-level database interface, abstracting from HTML5 and Gears databases \\\\
      persistence.db = persistence.db || {};

      persistence.db.implementation = "unsupported";
      persistence.db.conn = null;
      persistence.db.log = true;

      // window object does not exist on Qt Declarative UI (http://doc.trolltech.org/4.7-snapshot/declarativeui.html)
      if (window && window.openDatabase) {
        persistence.db.implementation = "html5";
      } else if (window && window.google && google.gears) {
        persistence.db.implementation = "gears";
      } else if (openDatabaseSync) {
          // TODO: find a browser that implements openDatabaseSync and check out if
          //       it is attached to the window or some other object
          persistence.db.implementation = "html5-sync";
      }

      persistence.db.html5 = {};

      persistence.db.html5.connect = function (dbname, description, size, version) {
          var that = {};
          var conn = openDatabase(dbname, version, description, size);

          that.transaction = function (fn) {
              return conn.transaction(function (sqlt) {
                  return fn(persistence.db.html5.transaction(sqlt));
              });
          };
          return that;
      };

      persistence.db.html5.transaction = function (t) {
          var that = {};
          that.executeSql = function (query, args, successFn, errorFn) {
              if(persistence.db.log) {
                  console.log(query);
              }
              t.executeSql(query, args, function (_, result) {
                  if (successFn) {
                      var results = [];
                      for ( var i = 0; i < result.rows.length; i++) {
                          results.push(result.rows.item(i));
                      }
                      successFn(results);
                  }
              }, errorFn);
          };
          return that;
      };
	  
      persistence.db.html5Sync = {};
	  
      persistence.db.html5Sync.connect = function (dbname, description, size, version) {
          var that = {};
          var conn = openDatabaseSync(dbname, version, description, size);

          that.transaction = function (fn) {
              return conn.transaction(function (sqlt) {
                  return fn(persistence.db.html5Sync.transaction(sqlt));
              });
          };
          return that;
      };
	  
      persistence.db.html5Sync.transaction = function (t) {
          var that = {};
          that.executeSql = function (query, args, successFn, errorFn) {
              if (args == null) args = [];

              if(persistence.db.log) {
                  console.log(query + ' -> ' + args);
              }

              var result = t.executeSql(query, args);
              if (result) {
                  if (successFn) {
                      var results = [];
                      for ( var i = 0; i < result.rows.length; i++) {
                          results.push(result.rows.item(i));
                      }
                      successFn(results);
                  }
              }
          };
          return that;
      };

      persistence.db.gears = {};

      persistence.db.gears.connect = function (dbname) {
          var that = {};
          var conn = google.gears.factory.create('beta.database');
          conn.open(dbname);

          that.transaction = function (fn) {
              fn(persistence.db.gears.transaction(conn));
          };
          return that;
      };

      persistence.db.gears.transaction = function (conn) {
          var that = {};
          that.executeSql = function (query, args, successFn, errorFn) {
              if(persistence.db.log) {
                  console.log(query);
              }
              var rs = conn.execute(query, args);
              if (successFn) {
                  var results = [];
                  while (rs.isValidRow()) {
                      var result = {};
                      for ( var i = 0; i < rs.fieldCount(); i++) {
                          result[rs.fieldName(i)] = rs.field(i);
                      }
                      results.push(result);
                      rs.next();
                  }
                  successFn(results);
              }
          };
          return that;
      };

      persistence.db.connect = function (dbname, description, size, version) {
          version = version || '1.0';
          if (persistence.db.implementation == "html5") {
              return persistence.db.html5.connect(dbname, description, size, version);
          } else if (persistence.db.implementation == "html5-sync") {
              return persistence.db.html5Sync.connect(dbname, description, size, version);
          } else if (persistence.db.implementation == "gears") {
              return persistence.db.gears.connect(dbname);
          }
      };
}());

// Equals methods
// Note: really necessary?

Number.prototype.equals = function(other) {
  return this == other; 
}

Boolean.prototype.equals = function(other) {
  return this == other; 
}

String.prototype.equals = function(other) {
  return this == other; 
}

Array.prototype.equals = function(other) {
  if(this.length !== other.length) {
    return false;
  }
  for(var i = 0; i < this.length; i++) {
    if(!this[i].equals(other[i])) {
      return false;
    }
  }
  return true;
}

Array.prototype.contains = function(el) {
  var l = this.length;
  for(var i = 0; i < l; i++) {
    if(this[i].equals(el)) {
      return true;
    }
  }
  return false;
}

Array.prototype.remove = function(el) {
  var l = this.length;
  for(var i = 0; i < l; i++) {
    if(this[i].equals(el)) {
      this.splice(i, 1);
    }
  }
}

// JSON2 library, source: http://www.JSON.org/js.html
// Most modern browsers already support this natively, but mobile
// browsers often don't, hence this implementation
// Relevant APIs:
//    JSON.stringify(value, replacer, space)
//    JSON.parse(text, reviver)

if (!this.JSON) {
  this.JSON = {};
  (function () {
      function f(n) {
        return n < 10 ? '0' + n : n;
      }
      if (typeof Date.prototype.toJSON !== 'function') {

        Date.prototype.toJSON = function (key) {

          return isFinite(this.valueOf()) ?
          this.getUTCFullYear()   + '-' +
            f(this.getUTCMonth() + 1) + '-' +
            f(this.getUTCDate())      + 'T' +
            f(this.getUTCHours())     + ':' +
            f(this.getUTCMinutes())   + ':' +
            f(this.getUTCSeconds())   + 'Z' : null;
        };

        String.prototype.toJSON =
          Number.prototype.toJSON =
          Boolean.prototype.toJSON = function (key) {
            return this.valueOf();
          };
      }

      var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
      gap, indent,
      meta = { 
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
      },
      rep;

      function quote(string) {
        escapable.lastIndex = 0;
        return escapable.test(string) ?
        '"' + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === 'string' ? c :
            '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
          }) + '"' :
        '"' + string + '"';
      }


      function str(key, holder) {
        var i, k, v, length, mind = gap, partial, value = holder[key];

        if (value && typeof value === 'object' &&
          typeof value.toJSON === 'function') {
          value = value.toJSON(key);
        }

        if (typeof rep === 'function') {
          value = rep.call(holder, key, value);
        }

        switch (typeof value) {
        case 'string':
          return quote(value);
        case 'number':
          return isFinite(value) ? String(value) : 'null';
        case 'boolean':
        case 'null':
          return String(value);
        case 'object':
          if (!value) {
            return 'null';
          }

          gap += indent;
          partial = [];

          if (Object.prototype.toString.apply(value) === '[object Array]') {
            length = value.length;
            for (i = 0; i < length; i += 1) {
              partial[i] = str(i, value) || 'null';
            }

            v = partial.length === 0 ? '[]' :
            gap ? '[\n' + gap +
              partial.join(',\n' + gap) + '\n' +
              mind + ']' :
            '[' + partial.join(',') + ']';
            gap = mind;
            return v;
          }

          if (rep && typeof rep === 'object') {
            length = rep.length;
            for (i = 0; i < length; i += 1) {
              k = rep[i];
              if (typeof k === 'string') {
                v = str(k, value);
                if (v) {
                  partial.push(quote(k) + (gap ? ': ' : ':') + v);
                }
              }
            }
          } else {
            for (k in value) {
              if (Object.hasOwnProperty.call(value, k)) {
                v = str(k, value);
                if (v) {
                  partial.push(quote(k) + (gap ? ': ' : ':') + v);
                }
              }
            }
          }

          v = partial.length === 0 ? '{}' :
          gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' +
            mind + '}' : '{' + partial.join(',') + '}';
          gap = mind;
          return v;
        }
      }

      if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {
          var i;
          gap = '';
          indent = '';
          if (typeof space === 'number') {
            for (i = 0; i < space; i += 1) {
              indent += ' ';
            }
          } else if (typeof space === 'string') {
            indent = space;
          }

          rep = replacer;
          if (replacer && typeof replacer !== 'function' &&
            (typeof replacer !== 'object' ||
              typeof replacer.length !== 'number')) {
            throw new Error('JSON.stringify');
          }

          return str('', {'': value});
        };
      }

      if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {
          var j;
          function walk(holder, key) {
            var k, v, value = holder[key];
            if (value && typeof value === 'object') {
              for (k in value) {
                if (Object.hasOwnProperty.call(value, k)) {
                  v = walk(value, k);
                  if (v !== undefined) {
                    value[k] = v;
                  } else {
                    delete value[k];
                  }
                }
              }
            }
            return reviver.call(holder, key, value);
          }

          cx.lastIndex = 0;
          if (cx.test(text)) {
            text = text.replace(cx, function (a) {
                return '\\u' +
                  ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
              });
          }

          if (/^[\],:{}\s]*$/.
          test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').
            replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
            replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {
            j = eval('(' + text + ')');
            return typeof reviver === 'function' ?
            walk({'': j}, '') : j;
          }
          throw new SyntaxError('JSON.parse');
        };
      }
    }());
}
