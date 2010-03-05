var mobiworks = window.mobiworks || {};
mobiworks.screenStack = [];
mobiworks.screenCache = {};

function updateScrollers () {
    var scrollwrappers = $("#scrollwrapper:visible");
    if (scrollwrappers.length > 0) {
        var height = window.innerHeight;
        height -= $("#header:visible").height();
        height -= $("#tabbar:visible").height();
        scrollwrappers.height(height+5);
    }
    var scrollers = $("#scrollwrapper div#content:visible");
    for(var i = 0; i < scrollers.length; i++) {
        scrollers.eq(i).data("scroller").refresh();
    }
}

$(window).resize(updateScrollers);


// document.addEventListener('touchmove', function(e){ e.preventDefault(); },
// false);

mobiworks.call = function (screenName, args, callback) {
    var screenFrame = {
        "name": screenName,
        "args": args,
        "callback": callback,
        "div": screenName.replace('.', '_')
    };
    mobiworks.screenStack.push(screenFrame);
    var callbackFn = function () {
        // when callback function is called (i.e. return)
        mobiworks.screenStack.pop();
        if (mobiworks.screenStack.length > 0) {
            var previousScreen = mobiworks.screenStack[mobiworks.screenStack.length - 1];
            $("body > #" + screenFrame.div).hide('slide', {
                direction: "right"
            }, 150, function () {
                var n = $("body > #" + screenFrame.div);
                n.remove();
                n.disableExtraEvents();
            });
            $("body > #" + previousScreen.div).show('slide', {
                direction: "left"
            }, 150);
        }
        if (callback) {
            callback.apply(null, arguments);
        }
    };
    if (!mobiworks.screenCache[screenName]) {
        var screenPath = screenName.replace('.', '/');
        $.getScript(screenPath + ".js", function () {
            mobiworks.screenCache[screenName] = eval(screenName);
            obj = mobiworks.screenCache[screenName]; // window[window.applicationNamespace].screen[screenName];
                $.get(screenPath + ".html", function (data) {
                    var newScreenCode = $("<div id=\"" + screenFrame.div
                            + "\" class=\"screen\" style=\"position: absolute; left: 0; top: 0; width: 100%;\">" + data
                            + "</div>");
                    obj.show = function () {
                        var code = newScreenCode.clone();
                        var body = $("body");
                        if (mobiworks.screenStack.length > 1) {
                            var previousScreen = mobiworks.screenStack[mobiworks.screenStack.length - 2];
                            $("body > #" + previousScreen.div).hide('slide', {
                                direction: "left"
                            }, 150);
                        }
                        if (mobiworks.screenStack.length > 1) {
                            code.hide().prependTo(body).show('slide', {
                                direction: "right"
                            }, 150);
                        } else {
                            code.prependTo(body);
                        }
                        // setTimeout(scrollTo, 0, 0, 1);
                    };
                    obj.show();
                    $(function () {
                        var scope = obj.init(args, callbackFn);
                        var div = $("div#" + screenFrame.div);
                        div.scope(scope);
                        div.databind();
                        var scrollers = $("div#" + screenFrame.div + " div#scrollwrapper div#content"), i = 0;
                        if (scrollers.length > 0) {
                            for (i = 0; i < scrollers.length; i++) {
                                scrollers.eq(i).data("scroller", new iScroll(scrollers.get(i), 'y'));
                            }
                            updateScrollers();
                        }
                    });
                });
            });
    } else {
        obj = mobiworks.screenCache[screenName];
        obj.show();
        $(function () {
            var scope = obj.init(args, callbackFn);
            var div = $("div#" + screenFrame.div);
            div.scope(scope);
            div.databind();
        });
    }
}