var mobiworks = window.mobiworks || {};

function replace (node, targetId, template, args, effect) {
    var scope = $(node).scope();
    var targetNode = scope.get(targetId);
    var subScope = new mobiworks.LinkedMap(scope);
    args.unshift(subScope);
    if (effect == 'slide') {
        targetNode.hide('slide', {
            direction: "left"
        }, 100, function () {
            targetNode.disableExtraEvents();
            targetNode.empty();
            targetNode.append(scope.get(template).apply(null, args));
            targetNode.databind(scope);
            targetNode.show('slide', {
                direction: "right"
            }, 100);
        });
    } else if (effect == 'fade') {
        targetNode.fadeOut('fast', function () {
            targetNode.disableExtraEvents();
            targetNode.empty();
            targetNode.append(scope.get(template).apply(null, args));
            targetNode.databind(scope);
            targetNode.fadeIn('fast');
        });
    } else {
        targetNode.empty();
        targetNode.append(scope.get(template).apply(null, args));
        targetNode.databind(scope);
    }
}

jQuery.fn.enableExtraEvents = function () {
    var nodes = [];
    var that = this;
    function addNodesWithAttribute (attr) {
        var eventedNodes = that.find("*[" + attr + "]");
        for ( var i = 0; i < eventedNodes.length; i++) {
            if (eventedNodes.eq(i).parents(".view").length === 0) {
                nodes.push( [ attr, eventedNodes.eq(i) ]);
            }
        }
        if (that.attr(attr)) {
            nodes.push( [ attr, that ]);
        }
    }
    addNodesWithAttribute("onswipe");
    addNodesWithAttribute("onlandscape");
    addNodesWithAttribute("onportrait");
    for ( var i = 0; i < nodes.length; i++) {
        (function () {
            var attr = nodes[i][0];
            var node = nodes[i][1];
            if (node.data(attr + "_evented")) {
                return;
            }

            var execFn = function (event) {
                // console.log(node.html());

                if (arguments.length > 1) {
                    event = arguments[1];
                }
                var fn = function (event) {
                    eval(node.attr(attr));
                };
                // alert(node);
                fn.call(node, event);
            };
            switch (attr) {
            case 'onswipe':
                node.swipe(execFn);
                node.dblclick(execFn); // debugging
                break;
            case 'onportrait':
                node.data(attr + "_sid", mobiworks.orientation.subscribe(
                        'portrait', execFn));
                break;
            case 'onlandscape':
                node.data(attr + "_sid", mobiworks.orientation.subscribe(
                        'landscape', execFn));
                break;
            }
            node.data(attr + "_evented", true);
        }());
    }
};

jQuery.fn.disableExtraEvents = function () {
    var nodes = [];
    var that = this;
    function addNodesWithAttribute (attr) {
        var eventedNodes = that.find("*[" + attr + "]");
        for ( var i = 0; i < eventedNodes.length; i++) {
            if (eventedNodes.eq(i).data(attr + "_evented")) {
                nodes.push( [ attr, eventedNodes.eq(i) ]);
            }
        }
        if (that.attr(attr)) {
            nodes.push( [ attr, that ]);
        }
    }
    addNodesWithAttribute("onlandscape");
    addNodesWithAttribute("onportrait");
    for ( var i = 0; i < nodes.length; i++) {
        var attr = nodes[i][0];
        var node = nodes[i][1];
        switch (attr) {
        case 'onportrait':
            mobiworks.orientation.unsubscribe('portrait', node.data(attr
                    + "_sid"));
            break;
        case 'onlandscape':
            mobiworks.orientation.unsubscribe('landscape', node.data(attr
                    + "_sid"));
            break;
        }
    }
};