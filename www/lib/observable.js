var observable = {};

(function () {
    function Observable () {
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

    Observable.prototype.removeEventListener = function (eventType, fn) {
        var subscribers = this.subscribers[eventType];
        for ( var i = 0; i < subscribers.length; i++) {
            if (subscribers[i] == fn) {
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
        for ( var sid in this.subscribers[eventType]) {
            if (this.subscribers[eventType].hasOwnProperty(sid)) {
                this.subscribers[eventType][sid].apply(null, arguments);
            }
        }
    };
    
    function ObservableObject(o, observedProperties) {
        var delegatedProperties = [];
        var that = this;
        this.subscribers = {};

        if (!observedProperties) {
            observedProperties = [];
            for ( var p in o) {
                if (o.hasOwnProperty(p) && typeof o[p] !== 'function') {
                    observedProperties.push(p);
                } else if (typeof o[p] === 'function') {
                    delegatedProperties.push(p);
                }
            }
        }
        for ( var i = 0; i < observedProperties.length; i++) {
            (function () { // Enforce a scope in order not to put 'p' in
                // getter/setter
                // closure
                var p = observedProperties[i];
                that.__defineSetter__(p, function (val) {
                    o[p] = val;
                    that.triggerEvent("set", o, p, val);
                });
                that.__defineGetter__(p, function () {
                    that.triggerEvent("get", o, p);
                    return o[p];
                });
            })();
        }
        for ( var i = 0; i < delegatedProperties.length; i++) {
            (function () { // Enforce a scope in order not to put 'p' in
                var p = delegatedProperties[i];
                that.__defineGetter__(p, function () {
                    return o[p];
                });
            })();
        }
    }

    ObservableObject.prototype = new Observable();

    
    observable.Observable = Observable;
    observable.ObservableObject = ObservableObject;
}());

/*observable.list = function (items, makeItemsObservable) {
    var that = observable.observable();
    items = items || [];
    if (makeItemsObservable) {
        for ( var i = 0; i < items.length; i++) {
            if (!items[i].subscribe) {
                items[i] = observable.object(items[i]);
            }
        }
    }

    that.add = function (elt) {
        if (makeItemsObservable && !elt.subscribe) {
            elt = observable.object(elt);
        }
        items.push(elt);
        that.fire("add", elt);
    };

    that.addAll = function (arr) {
        for ( var i = 0; i < arr.length; i++) {
            var elt = arr[i];
            if (makeItemsObservable && !elt.subscribe) {
                elt = observable.object(elt);
            }
            items.push(elt);
        }
        that.fire("addAll", arr);
    };

    that.removeAtIndex = function (idx, fireevt) {
        var part1 = items.slice(0, idx);
        var part2 = items.slice(idx + 1);
        items = part1.concat(part2);
        if (fireevt) {
            that.fire("removeAtIndex", idx);
        }
    };

    that.remove = function (elt) {
        var idx = $.inArray(elt, items);
        if (idx > -1) {
            that.removeAtIndex(idx, false);
            that.fire("remove", elt);
        }
    };

    that.get = function (idx) {
        that.fire("get", idx);
        return items[idx];
    };

    that.set = function (idx, value) {
        that.fire("set", idx, value);
        items[idx] = value;
    };

    that.clear = function () {
        items = [];
        that.fire("clear");
    };

    that.array = function () {
        return items;
    };

    that.each = function (fn) {
        for ( var i = 0; i < items.length; i++) {
            fn(items[i]);
        }
    };

    that.length = function () {
        return items.length;
    }

    return that;
};
*/

