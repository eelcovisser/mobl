var mobiworks = window.mobiworks || {};
mobiworks.screenStack = [];
mobiworks.rootScope = new mobiworks.LinkedMap();

function updateScrollers () {
    var scrollwrappers = $("#scrollwrapper:visible");
    if (scrollwrappers.length > 0) {
        var height = window.innerHeight;
        height -= $("#header:visible").height();
        height -= $("#tabbar:visible").height();
        scrollwrappers.height(height + 5);
    }
    var scrollers = $("#scrollwrapper div#content:visible");
    for ( var i = 0; i < scrollers.length; i++) {
        scrollers.eq(i).data("scroller").refresh();
    }
}

mobiworks.provides = function (moduleName) {
    var parts = moduleName.split('.');
    var current = window;
    for ( var i = 0; i < parts.length; i++) {
        if (!current[parts[i]]) {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    current.isLoaded = true;
}

mobiworks.modulesToBeLoaded = 0;
mobiworks.onModulesLoaded = null;

mobiworks.requires = function(moduleName, callback) {
    mobiworks.modulesToBeLoaded++;
    if(callback) {
        mobiworks.onModulesLoaded = callback;
    }
    if (!mobiworks.isLoaded(moduleName)) {
        $.getScript(moduleName + ".js", function () {
            $.get(moduleName + ".html", function (data) {
                var htmlDom = $(data);
                htmlDom.scope(mobiworks.rootScope);
                mobiworks.modulesToBeLoaded--;
                if(mobiworks.modulesToBeLoaded === 0 && mobiworks.onModulesLoaded) {
                    mobiworks.onModulesLoaded();
                }
                if(mobiworks.modulesToBeLoaded === 0 && callback) {
                    callback();
                }
            });
        });
    }
};

mobiworks.isLoaded = function (moduleName) {
    var parts = moduleName.split('.');
    var current = window;
    for ( var i = 0; i < parts.length; i++) {
        if (!current[parts[i]]) {
            return false;
        }
        current = current[parts[i]];
    }
    return current.isLoaded;
}

$(window).resize(updateScrollers);

// document.addEventListener('touchmove', function(e){ e.preventDefault(); },
// false);

mobiworks.call = function (screenName, args, callback) {
    var screenFrame = {
        "name": screenName,
        "args": args,
        "callback": callback,
        "div": screenName.replace('.', '__')
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
    var parts = screenName.split('.');
    var moduleName = parts.slice(0, parts.length - 1).join('.');
    var screenTemplate = parts[parts.length - 1];
    if (!mobiworks.isLoaded(moduleName)) {
        mobiworks.requires(moduleName, function () {
            var subScope = new mobiworks.LinkedMap(mobiworks.rootScope);
            var screenTemplate = subScope.get(screenFrame.div);
            var node = screenTemplate.apply(null, [subScope].concat(args)).contents();
            var div = $("<div id='" + screenFrame.div + "'></div>");
            div.append(node);
            $("body").append(div);                
            div.databind();
            $(function () {
                var scrollers = $("div#" + screenFrame.div + " div#scrollwrapper div#content"), i = 0;
                if (scrollers.length > 0) {
                    for (i = 0; i < scrollers.length; i++) {
                        scrollers.eq(i).data("scroller", new iScroll(scrollers.get(i), 'y'));
                    }
                    updateScrollers();
                }
            });
        });
    } else {
        var subScope = new mobiworks.LinkedMap(mobiworks.rootScope);
        var screenTemplate = subScope.get(screenFrame.div);
        var node = screenTemplate.apply(null, [subScope].concat(args));
        $("body").append(node);
        
        $(function () {
            var scrollers = $("div#" + screenFrame.div + " div#scrollwrapper div#content"), i = 0;
            if (scrollers.length > 0) {
                for (i = 0; i < scrollers.length; i++) {
                    scrollers.eq(i).data("scroller", new iScroll(scrollers.get(i), 'y'));
                }
                updateScrollers();
            }
        });
    }
}