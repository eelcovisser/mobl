var mobl = window.mobl || {};
mobl.screenStack = [];
mobl.rootScope = new mobl.LinkedMap();

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

mobl.provides = function (moduleName) {
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

$(window).resize(updateScrollers);

$(function() {
    // Set flushing at interval
    setInterval(function() { persistence.flush(); }, 2500);
});

// document.addEventListener('touchmove', function(e){ e.preventDefault(); },
// false);

mobl.load = function(url) {
    $("head").append("<script type=\"text/javascript\" src=\"" + url + "\">");
    console.log("loaded " + url);
}

mobl.call = function (screenName, args, callback) {
    var screenFrame = {
        "name": screenName,
        "args": args,
        "callback": callback,
        "div": screenName.replace('.', '__')
    };
    mobl.screenStack.push(screenFrame);
    var callbackFn = function () {
        // when callback function is called (i.e. return)
        mobl.screenStack.pop();
        if (mobl.screenStack.length > 0) {
            var previousScreen = mobl.screenStack[mobl.screenStack.length - 1];
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
    var subScope = new mobl.LinkedMap(mobl.rootScope);
    var screenTemplate = subScope.get(screenFrame.div);
    screenTemplate.apply(null, [ subScope ].concat(args).concat( [ function (node) {
        node.attr('id', screenFrame.div);
        node.attr('style', "position: absolute; left: 0; top: 0; width: 100%;");
        var body = $("body");
        
        if (mobl.screenStack.length > 1) {
            var previousScreen = mobl.screenStack[mobl.screenStack.length - 2];
            $("body > #" + previousScreen.div).hide('slide', {
                direction: "left"
            }, 150);
            node.hide().prependTo(body).show('slide', {
                direction: "right"
            }, 150);
        } else {
            node.prependTo(body);
        }

        $(function () {
            var scrollers = $("div#" + screenFrame.div + " div#scrollwrapper div#content"), i = 0;
            if (scrollers.length > 0) {
                for (i = 0; i < scrollers.length; i++) {
                    scrollers.eq(i).data("scroller", new iScroll(scrollers.get(i), 'y'));
                }
                updateScrollers();
            }
        });
    }, callbackFn ]));
}