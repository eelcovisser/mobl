var mobl = window.mobl || {};

// var core = window.core || {};

// core.alert = alert;

function ref(e, property) {
    return new mobl.Reference(e, property);
}

function fromScope(that, prop) {
    if(prop) {
        return $(that).scope().get(prop);
    } else {
        return $(that).scope();
    }
}

mobl.stringTomobl__Int = function (s) {
    return parseInt(s, 10);
}

mobl.stringTomobl__String =function (s) {
    return s;
}

mobl.proxyUrl = function(url, user, password) {
    var proxyUrl = '/proxy.php?user=' + user + '&pwd=' + password + '&proxy_url=' + url;
    //console.log(proxyUrl);
    return proxyUrl;
}

function log(s) {
    console.log(s);
}


(function () {
    function Tuple() {
        for(var i = 0; i < arguments.length; i++) {
            this['_' + (i+1)] = arguments[i];
        }
        this.subscribers = {}; // Observable
    }
    
    Tuple.prototype = new persistence.Observable();

    function List() {
        this.values = [];
        for(var i = 0; i < arguments.length; i++) {
            this.values.push(arguments[i]);
        }
        this.subscribers = {}; // Observable
    }
    
    List.prototype = new persistence.Observable();
    
    List.prototype.get = function(idx) {
        return this.values[idx];
    };
    
    List.prototype.list = function(tx, callback) {
        var valueCopy = [];
        for(var i = 0; i < this.values.length; i++) {
            valueCopy[i] = this.values[i];
        }
        callback(valueCopy);
    };
    
    function LinkedMap (parent, values) {
        this.values = values || {};
        this.parent = parent;
    }

    LinkedMap.prototype.get = function (key) {
        if (key in this.values) {
            return this.values[key];
        } else if (this.parent) {
            return this.parent.get(key);
        } else {
            return undefined;
        }
    };

    LinkedMap.prototype.set = function (key, value) {
        var current = this;
        while (!(key in current.values) && current.parent) {
            current = current.parent;
        }
        if (key in current.values) {
            current.values[key] = value;
        } else {
            this.values[key] = value;
        }
    };

    LinkedMap.prototype.setLocal = function (key, value) {
        this.values[key] = value;
    };
    
    LinkedMap.prototype.getRoot = function () {
        return !this.parent ? this : this.parent.getRoot();
    };
        
    /**
     * Represents a reference to a property
     * 
     * @param ref
     *            parent ref to reference
     * @param prop
     *            property to reference, if null/undefined this reference
     *            represents a reference to a decoupled values
     * @constructor
     */
    function Reference(ref, prop) {
        this.ref = ref;
        this.prop = prop;
        this.childRefs = [];
        if(prop) {
            ref.childRefs.push(this);
        }
        this.subscribers = {}; // Observable
    }
    
    Reference.prototype = new persistence.Observable();
    
    Reference.prototype.get = function() {
        if(!this.prop) {
            return this.ref;
        }
        if(this.ref.get) {
            return this.ref.get()[this.prop];
        }
    };
    
    Reference.prototype.set = function(value) {
        // trigger rebinding on all child refs
        if(!this.prop) {
            this.ref = value;
            this.triggerEvent('set', this, value);
        } else  {
            this.ref.get()[this.prop] = value;
        }
        for(var i = 0; i < this.childRefs.length; i++) {
            //this.childRefs[i].ref = this;
            var childRef = this.childRefs[i];
            childRef.rebind();
            childRef.triggerEvent('set', childRef, childRef.get());
        }
    };
    
    Reference.prototype.rebind = function() {
        var that = this;
        if(this.prop) {
            if(this.ref.get().addEventListener) {
                window.newTask2 = this.ref.get();
                //console.log("Attaching event listener to property: " + this.prop)
                this.ref.get().addEventListener('set', function(_, _, prop, value) {
                    if(prop === that.prop) {
                        that.triggerEvent('set', that, value);
                    }
                });
            } else {
                console.log("Could not rebind for: " + this.prop);
                console.log(this.ref.get());
            }
        }
        for(var i = 0; i < this.childRefs.length; i++) {
            this.childRefs[i].rebind(value[this.childRefs[i].prop]);
        }
    };
        
    Reference.prototype.addSetListener = function(callback) {
        var that = this;
        if(this.ref.addEventListener) {
            this.ref.addEventListener('set', function(_, _, prop, value) {
                if(prop === that.prop) {
                    callback(that, value);
                }
            });
        }
    };

    mobl.Tuple = Tuple;
    mobl.List = List;
    mobl.LinkedMap = LinkedMap;
    mobl.Reference = Reference;
}());