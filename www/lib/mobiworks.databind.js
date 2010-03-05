var mobiworks = window.mobiworks || {};

(function () {
    function databindRender (node, expr, scope) {
        var e = null;
        (function () {
            e = eval(expr);
        }).apply(node);
        e.get().list(null, function (array) {
            var template;
            if (node.data("template")) {
                template = node.data("template");
            } else {
                template = node.html();
                node.data("template", node.html());
            }
            var iteratorItem = node.attr("item");
            node.empty();
            for ( var j = 0; j < array.length; j++) {
                (function () {
                    var subSource = new mobiworks.LinkedMap(scope);
                    node.append(template);
                    subSource.set(iteratorItem, array[j]);
                    var n = node.children().last();
                    n.scope(subSource);
                    n.databind();
                }());
            }
        });
        // setTimeout(scrollTo, 0, 0, 1);
    }

    function setScopeExpr (node, expr, val) {
        var e = null;
        (function () {
            e = eval(expr);
        }).apply(node);
        e.set(val);
    }

    function isOrphan (node) {
        return node.parents("html").length === 0;
    }

    jQuery.fn.databind = function (rebinding) {
        // TODO: maybe do a cleanData call on all children to avoid memory
        // leaks?
        var that = this;
        for ( var idx = 0; idx < this.length; idx++) {
            (function () {
                var node = that.eq(idx);
                if (node.attr("databind")) {
                    var scope = node.scope();
                    var expr = node.attr("databind");
                    var current = null;
                    (function () {
                        current = eval(expr);
                    }).apply(node);
                    if (!current) {
                        throw "Not found: " + expr;
                    }
                    var tag = node[0].tagName;
                    if (current.get() && current.get().addEventListener) {
                        // Assume it's a list
                        databindRender(node, expr, scope);
                        // Add listeners
                        current.get().addEventListener( [ "add", "remove", "addAll" ], function () {
                            databindRender(node, expr, scope);
                        });
                    } else {
                        // node.removeAttr("databind");
                        if ($.inArray(tag, [ "INPUT", "SELECT", "TEXTAREA" ]) != -1) {
                            switch (node.attr("type")) {
                            case "text":
                                if (current.e.addEventListener) {
                                    current.e.addEventListener("set", function (_, _, prop, val) {
                                        // TODO add isOrphan check
                                            if (prop === current.prop) {
                                                node.val(val);
                                            }
                                        });
                                }
                                node.keyup(function () { // keyup or
                                            // onchange?
                                            setScopeExpr(node, expr, node.val());
                                        });
                                node.val(current.get());
                                break;
                            case "checkbox":
                                if (current.e.addEventListener) {
                                    current.e.addEventListener("set", function (_, _, prop, val) {
                                        if (prop === current.prop) {
                                            node.attr("checked", val);
                                        }
                                    });
                                }
                                node.attr("checked", current.get());
                                node.change(function () {
                                    setScopeExpr(node, expr, !!node.attr("checked"));
                                });
                                break;
                            case "textarea":
                                if (current.e.addEventListener) {
                                    current.e.addEventListener("set", function (_, _, prop, val) {
                                        if (prop === current.prop) {
                                            node.val(val);
                                        }
                                    });
                                }
                                node.val(current.get());
                                node.change(function () {
                                    setScopeExpr(node, expr, node.val());
                                });
                                break;
                            }
                        } else if (tag == "IMG") {
                            node.attr("src", current.get());
                        } else {
                            if (current.e.addEventListener) {
                                current.e.addEventListener("set", function (_, _, prop, val) {
                                    if (prop === current.prop) {
                                        node.text(val);
                                    }
                                });
                            }
                            node.text(current.get());
                        }
                    }
                } else { //if (!node.hasClass("template") && !node.hasClass("templatecall")) {
                    node.children().databind(rebinding);
                }
                node.enableExtraEvents();
            }());
        }
    };
}());
