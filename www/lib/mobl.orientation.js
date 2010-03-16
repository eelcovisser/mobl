var mobl = window.mobl || {};
/*
mobl.orientation = observable.Observable();

window.onresize = function () {
    // works on both Android and iPhone
    if (window.innerHeight > window.innerWidth) {
        if(!window.orientation || window.orientation != 'portrait') {
            window.orientation = 'portrait';
            mobl.orientation.triggerEvent('portrait');
        }
    } else {
        if(!window.orientation || window.orientation != 'landscape') {
            window.orientation = 'landscape';
            mobl.orientation.triggerEvent('landscape');
        }
    }
    //setTimeout(scrollTo, 0, 0, 1);
}
*/