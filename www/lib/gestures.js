/**
 * You can identify a swipe gesture as follows: 1. Begin gesture if you receive
 * a touchstart event containing one target touch. 2. Abort gesture if, at any
 * time, you receive an event with >1 touches. 3. Continue gesture if you
 * receive a touchmove event mostly in the x-direction. 4. Abort gesture if you
 * receive a touchmove event mostly the y-direction. 5. End gesture if you
 * receive a touchend event.
 * 
 * @author Dave Dunkin
 * @copyright public domain
 */
function addSwipeListener (el, listener) {
    var startX;
    var dx;
    var direction;

    function cancelTouch () {
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('touchend', onTouchEnd);
        startX = null;
        startY = null;
        direction = null;
    }

    function onTouchMove (e) {
        if (e.touches.length > 1) {
            cancelTouch();
        } else {
            dx = e.touches[0].pageX - startX;
            var dy = e.touches[0].pageY - startY;
            if (direction == null) {
                direction = dx;
                e.preventDefault();
            } else if ((direction < 0 && dx > 0) || (direction > 0 && dx < 0)
                    || Math.abs(dy) > 15) {
                cancelTouch();
            }
        }
    }

    function onTouchEnd (e) {
        cancelTouch();
        if (Math.abs(dx) > 50) {
            listener( {
                target: el,
                direction: dx > 0 ? 'right' : 'left'
            });
        }
    }

    function onTouchStart (e) {
        if (e.touches.length == 1) {
            startX = e.touches[0].pageX;
            startY = e.touches[0].pageY;
            el.addEventListener('touchmove', onTouchMove, false);
            el.addEventListener('touchend', onTouchEnd, false);
        }
    }

    el.addEventListener('touchstart', onTouchStart, false);
}

jQuery.fn.swipe = function(callback) {
    this.each(function(idx, node) {
        addSwipeListener(node, callback);
    });
}
