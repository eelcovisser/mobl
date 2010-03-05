/**
 * 
 * Find more about the scrolling function at
 * http://cubiq.org/scrolling-div-for-mobile-webkit-turns-3/16
 *
 * Copyright (c) 2009 Matteo Spinelli, http://cubiq.org/
 * Released under MIT license
 * http://cubiq.org/dropbox/mit-license.txt
 * 
 * Version 3.0alpha5 - Last updated: 2009.12.15
 * 
 */

function iScroll (el, scrollbars) {
	this.element = typeof el == 'object' ? el : document.getElementById(el);
	this.wrapper = this.element.parentNode;

	// Init transform
	this.element.webkitTransitionProperty = '-webkit-transform';
	this.element.style.webkitTransitionTimingFunction = 'cubic-bezier(0, 0, 0.2, 1)';
	this.element.style.webkitTransform = 'translate3d(0, 0, 0)';

	// Get options
	switch (scrollbars) {
		case 'x':
			this.scrollbars.x = {};
			break;
		case 'y':
			this.scrollbars.y = {};
			break;
		case 'xy':
			this.scrollbars = {x:{}, y:{}};
			break;
		case 'none': case 'off': case 'disabled':
			this.scrollbars = false;
			break;
		default:
			if (this.element.offsetWidth > this.wrapper.clientWidth) {
				this.scrollbars.x = {};
			}
			if (this.element.offsetHeight > this.wrapper.clientHeight) {
				this.scrollbars.y = {};
			}
	}

	if ( this.scrollbars.x ) {
		this.scrollbars.x.wrapper = document.createElement('div');
		this.scrollbars.x.wrapper.setAttribute('style',
			'position:absolute; z-index:100; pointer-events:none; height:5px; left:4px; right:8px; bottom:2px; overflow:hidden;'
		);
		this.wrapper.appendChild(this.scrollbars.x.wrapper);
		
		this.scrollbars.x.jollyCorner = document.createElement('div');
		this.scrollbars.x.jollyCorner.setAttribute('style',
			'position:absolute; z-index:110; display:none; left:4px; bottom:2px; width:3px; height:5px; background:#000; opacity:0.5;'
		);
		this.wrapper.appendChild(this.scrollbars.x.jollyCorner);		
		
		this.scrollbars.x.element = document.createElement('div');
		this.scrollbars.x.element.setAttribute('style',
			'position:absolute; z-index:105; pointer-events:none; height:5px; background-color:#000; opacity:0; ' +
			'-webkit-border-radius:2px; -webkit-transition-property: -webkit-transform, opacity; -webkit-transition-duration: 0, 200ms; -webkit-transition-timing-function:cubic-bezier(0.0, 0.0, 0.2, 1),ease-out; -webkit-transform:translate3d(0,0,0);'
		);
		this.scrollbars.x.wrapper.appendChild(this.scrollbars.x.element);
	}

	if ( this.scrollbars.y ) {
		this.scrollbars.y.wrapper = document.createElement('div');
		this.scrollbars.y.wrapper.setAttribute('style',
			'position:absolute; z-index:100; pointer-events:none; width:5px; right:2px; top:4px; bottom:8px; overflow:hidden;'
		);
		this.wrapper.appendChild(this.scrollbars.y.wrapper);
		
		this.scrollbars.y.jollyCorner = document.createElement('div');
		this.scrollbars.y.jollyCorner.setAttribute('style',
			'position:absolute; z-index:110; display:none; right:2px; top:4px; width:5px; height:3px; background:#000; opacity:0.5;'
		);
		this.wrapper.appendChild(this.scrollbars.y.jollyCorner);

		this.scrollbars.y.element = document.createElement('div');
		this.scrollbars.y.element.setAttribute('style',
			'position:absolute; z-index:105; pointer-events:none; width:5px; background-color:#000; opacity:0; ' +
			'-webkit-border-radius:2px; -webkit-transition-property: -webkit-transform, opacity; -webkit-transition-duration: 0, 200ms; -webkit-transition-timing-function:cubic-bezier(0.0, 0.0, 0.2, 1),ease-out; -webkit-transform:translate3d(0,0,0);'
		);
		this.scrollbars.y.wrapper.appendChild(this.scrollbars.y.element);
	}

	this.refresh();
	
	this.element.addEventListener('touchstart', this, true);
}

iScroll.prototype = {
	_xPos: 0,
	_yPos: 0,
	scrollX: false,
	scrollY: false,
	maxScrollX: 0,
	maxScrollY: 0,
	scrollbars: {},
	touchCounter: 0,

	handleEvent: function (e) {
		switch (e.type) {
			case 'touchstart': this.onTouchStart(e); break;
			case 'touchmove': this.onTouchMove(e); break;
			case 'touchend': this.onTouchEnd(e); break;
			case 'webkitTransitionEnd': this.onTransitionEnd(e); break;
		}
	},

	refresh: function () {
		this.element.style.webkitTransitionDuration = '0';

		if (this.element.offsetWidth > this.wrapper.clientWidth) {
			this.maxScrollX = this.wrapper.clientWidth - this.element.offsetWidth - this.element.offsetLeft;
			this.scrollX = true;
		} else {
			this.maxScrollX = 0;
			this.scrollX = false;
		}

		if (this.element.offsetHeight > this.wrapper.clientHeight) {
			this.maxScrollY = this.wrapper.clientHeight - this.element.offsetHeight - this.element.offsetTop;
			this.scrollY = true;
		} else {
			this.maxScrollY = 0;
			this.scrollY = false;
		}
		
		if (this.scrollX && this.scrollbars.x) {
			this.scrollbars.x.size = Math.round(this.scrollbars.x.wrapper.clientWidth * (this.scrollbars.x.wrapper.clientWidth / (-this.maxScrollX + this.scrollbars.x.wrapper.clientWidth)));
			this.scrollbars.x.element.style.width = this.scrollbars.x.size + 'px';
		}

		if (this.scrollY && this.scrollbars.y) {
			this.scrollbars.y.size = Math.round(this.scrollbars.y.wrapper.clientHeight * (this.scrollbars.y.wrapper.clientHeight / (-this.maxScrollY + this.scrollbars.y.wrapper.clientHeight)));
			this.scrollbars.y.element.style.height = this.scrollbars.y.size + 'px';
		}
	},

	get x() {
		return this._xPos;
	},

	get y() {
		return this._yPos;
	},

	setPosition: function (x, y) { 
		this._xPos = x!==null ? x : this._xPos;
		this._yPos = y!==null ? y : this._yPos;
		this.element.style.webkitTransform = 'translate3d(' + this._xPos + 'px, ' + this._yPos + 'px, 0)';

		// Move the scrollbars
		var sbPos;
		if (this.scrollX && this.scrollbars.x) {
	    	sbPos = -this._xPos * (this.scrollbars.x.wrapper.clientWidth / (this.scrollbars.x.wrapper.clientWidth - this.maxScrollX));
	    	if (sbPos+this.scrollbars.x.size > this.scrollbars.x.wrapper.clientWidth) {
	   	 		if( this.scrollbars.x.jollyCorner.style.display=='none' ) {
			   	 	this.scrollbars.x.jollyCorner.style.left = 'auto';
			   	 	this.scrollbars.x.jollyCorner.style.right = '8px';
			   	 	this.scrollbars.x.jollyCorner.style.webkitBorderTopRightRadius = '2px';
			   	 	this.scrollbars.x.jollyCorner.style.webkitBorderBottomRightRadius = '2px';
			   	 	this.scrollbars.x.jollyCorner.style.display = 'block';
			   	 	
			   	 	this.scrollbars.x.element.style.webkitBorderTopRightRadius = '0';
			   	 	this.scrollbars.x.element.style.webkitBorderBottomRightRadius = '0';
			   	 	this.scrollbars.x.wrapper.style.right = '11px';
			   	 } else if (sbPos+this.scrollbars.x.size < this.scrollbars.x.wrapper.clientWidth) {
		   	 		if( this.scrollbars.x.jollyCorner.style.display=='block' ) {
		   	 			this.scrollbars.x.jollyCorner.style.display = 'none';
				   	 	this.scrollbars.x.wrapper.style.right = '8px';
				   	 	this.scrollbars.x.element.style.webkitBorderRadius = '2px';
		   	 		}
				}

//				sbPos = sbPos;
/*			   	 if (sbPos > this.scrollbars.x.wrapper.clientWidth-3 ) {
			   	 	sbPos = this.scrollbars.x.size-3;
			   	 }*/
	   	 	} else if (sbPos < 0) {
	   	 		if( this.scrollbars.x.jollyCorner.style.display=='none' ) {
			   	 	this.scrollbars.x.jollyCorner.style.left = '4px';
			   	 	this.scrollbars.x.jollyCorner.style.right = 'auto';
			   	 	this.scrollbars.x.jollyCorner.style.webkitBorderTopLeftRadius = '2px';
			   	 	this.scrollbars.x.jollyCorner.style.webkitBorderBottomLeftRadius = '2px';
			   	 	this.scrollbars.x.jollyCorner.style.display = 'block';
			   	 	
			   	 	this.scrollbars.x.element.style.webkitBorderTopLeftRadius = '0';
			   	 	this.scrollbars.x.element.style.webkitBorderBottomLeftRadius = '0';
			   	 	this.scrollbars.x.wrapper.style.left = '7px';
			   	 }
			   	 
//			   	 sbPos = sbPos * 5;
/*			   	 if (sbPos < -this.scrollbars.x.size+3 ) {
			   	 	sbPos = -this.scrollbars.x.size+3;
			   	 }*/
			} else if (sbPos > 0 ) {
	   	 		if( this.scrollbars.x.jollyCorner.style.display=='block' ) {
	   	 			this.scrollbars.x.jollyCorner.style.display = 'none';
			   	 	this.scrollbars.x.wrapper.style.left = '4px';
			   	 	this.scrollbars.x.element.style.webkitBorderRadius = '2px';
	   	 		}
			}

			this.scrollbars.x.element.style.webkitTransform = 'translate3d(' + sbPos + 'px, 0, 0)';	
		}

		if (this.scrollY && this.scrollbars.y) {
	    	sbPos = -this._yPos * (this.scrollbars.y.wrapper.clientHeight / (this.scrollbars.y.wrapper.clientHeight - this.maxScrollY));
			if (sbPos+this.scrollbars.y.size > this.scrollbars.y.wrapper.clientHeight) {
	   	 		if( this.scrollbars.y.jollyCorner.style.display=='none' ) {
			   	 	this.scrollbars.y.jollyCorner.style.top = 'auto';
			   	 	this.scrollbars.y.jollyCorner.style.bottom = '8px';
			   	 	this.scrollbars.y.jollyCorner.style.webkitBorderBottomLeftRadius = '2px';
			   	 	this.scrollbars.y.jollyCorner.style.webkitBorderBottomRightRadius = '2px';
			   	 	this.scrollbars.y.jollyCorner.style.display = 'block';
			   	 	
			   	 	this.scrollbars.y.element.style.webkitBorderBottomLeftRadius = '0';
			   	 	this.scrollbars.y.element.style.webkitBorderBottomRightRadius = '0';
			   	 	this.scrollbars.y.wrapper.style.bottom = '11px';
			   	 } else if (sbPos+this.scrollbars.y.size < this.scrollbars.y.wrapper.clientHeight) {
		   	 		if( this.scrollbars.y.jollyCorner.style.display=='block' ) {
		   	 			this.scrollbars.y.jollyCorner.style.display = 'none';
				   	 	this.scrollbars.y.wrapper.style.bottom = '8px';
				   	 	this.scrollbars.y.element.style.webkitBorderRadius = '2px';
		   	 		}
				}

//				sbPos = this.wrapper.clientHeight - this.scrollbars.y.size;
			} else if (sbPos < 0) {
	   	 		if( this.scrollbars.y.jollyCorner.style.display=='none' ) {
			   	 	this.scrollbars.y.jollyCorner.style.top = '4px';
			   	 	this.scrollbars.y.jollyCorner.style.bottom = 'auto';
			   	 	this.scrollbars.y.jollyCorner.style.webkitBorderTopLeftRadius = '2px';
			   	 	this.scrollbars.y.jollyCorner.style.webkitBorderTopRightRadius = '2px';
			   	 	this.scrollbars.y.jollyCorner.style.display = 'block';
			   	 	
			   	 	this.scrollbars.y.element.style.webkitBorderTopLeftRadius = '0';
			   	 	this.scrollbars.y.element.style.webkitBorderTopRightRadius = '0';
			   	 	this.scrollbars.y.wrapper.style.top = '7px';
			   	 }

//				sbPos = 0
			} else if (sbPos > 0 ) {
	   	 		if( this.scrollbars.y.jollyCorner.style.display=='block' ) {
	   	 			this.scrollbars.y.jollyCorner.style.display = 'none';
			   	 	this.scrollbars.y.wrapper.style.top = '4px';
			   	 	this.scrollbars.y.element.style.webkitBorderRadius = '2px';
	   	 		}
			}

			this.scrollbars.y.element.style.webkitTransform = 'translate3d(0, ' + sbPos + 'px, 0)';	
		}
	},
		
	onTouchStart: function(e) {
		e.preventDefault();

	    if (e.targetTouches.length != 1) {
	        return false;
        }

        // Remove any residual transition
		this.element.style.webkitTransitionDuration = '0';
		
		// Remove any residual transition from scrollbars
		if (this.scrollbars.x) {
			this.scrollbars.x.element.style.webkitTransitionDuration = '0, 0';
		}
		if (this.scrollbars.y) {
			this.scrollbars.y.element.style.webkitTransitionDuration = '0, 0';
		}

		var theTransform = window.getComputedStyle(this.element).webkitTransform;
		theTransform = new WebKitCSSMatrix(theTransform);

		theTransform = new WebKitCSSMatrix(theTransform);
		if (theTransform.m41 != this.x || theTransform.m42 != this.y) {
			this.setPosition(theTransform.m41, theTransform.m42);
		}

		this.startX = e.targetTouches[0].clientX;
		this.startY = e.targetTouches[0].clientY;
		this.scrollStartX = this.x;
		this.scrollStartY = this.y;

		this.scrollStartTime = e.timeStamp;
		this.moved = false;

		this.element.addEventListener('touchmove', this, true);
		document.addEventListener('touchend', this, true);

		return false;
	},
	
	onTouchMove: function(e) {
		e.preventDefault();
		
		if( e.targetTouches.length != 1 ) {
			return false;
		}

		var leftDelta = e.targetTouches[0].clientX - this.startX;
		var topDelta = e.targetTouches[0].clientY - this.startY;
		if (this.x>0 || this.x<this.maxScrollX) { 
			leftDelta/=5;	// Slow down if outside of the boundaries
		}
		if (this.y>0 || this.y<this.maxScrollY) { 
			topDelta/=5;	// Slow down if outside of the boundaries
		}
		if(!this.scrollbars.x) { // No left/right scrolling if there's no x scrollbar
		    leftDelta = 0;
		}
        if(!this.scrollbars.y) { // No left/right scrolling if there's no x scrollbar
            topDelta = 0;
        }

		this.setPosition(this.x+Math.round(leftDelta), this.y+Math.round(topDelta));
		this.startX = e.targetTouches[0].clientX;
		this.startY = e.targetTouches[0].clientY;
		this.moved = true;

		// Prevent slingshot effect
		if( e.timeStamp-this.scrollStartTime>100 ) {
			this.scrollStartX = this.x;
			this.scrollStartY = this.y;
			this.scrollStartTime = e.timeStamp;
		}

		// Show scrollbars
		if (this.scrollX && this.scrollbars.x) {
			this.scrollbars.x.element.style.webkitTransitionDuration = '0, 0';
			this.scrollbars.x.element.style.opacity = '0.5';
		}
		if (this.scrollY && this.scrollbars.y) {
			this.scrollbars.y.element.style.webkitTransitionDuration = '0, 0';
			this.scrollbars.y.element.style.opacity = '0.5';
		}

/*
		if (e.targetTouches[0].clientY-this.wrapper.offsetTop<0 || e.targetTouches[0].clientY-this.wrapper.offsetTop>this.wrapper.clientHeight ||
			e.targetTouches[0].clientX-this.wrapper.offsetLeft<0 || e.targetTouches[0].clientX-this.wrapper.offsetLeft>this.wrapper.clientWidth) {
			var theEvent = document.createEvent("TouchEvent");
			theEvent.initEvent('touchend', true, false);
			this.element.dispatchEvent(theEvent);		
			return false;
		}
*/
		return false;
	},
	
	onTouchEnd: function(e) {
		e.preventDefault();
		
		this.element.removeEventListener('touchmove', this, true);
		document.removeEventListener('touchend', this, true);

		// If we didn't move, throw the click
		if (!this.moved) {
			var theEvent = document.createEvent("MouseEvents");
			theEvent.initEvent('click', true, false);
			e.changedTouches[0].target.dispatchEvent(theEvent);		
			return false;
		}

		var deceleration = 0.0075;
		var scrollDistanceX = this.x - this.scrollStartX;
		var scrollDistanceY = this.y - this.scrollStartY;
		var scrollDuration = e.timeStamp - this.scrollStartTime;
		var speedX = scrollDistanceX / scrollDuration;
		var speedY = scrollDistanceY / scrollDuration;

		if (this.x > 0) {
			var newScrollDistanceX = -this.x;
			var newDurationX = 200;
//			this.moved = true;
		} else if (this.x < this.maxScrollX) {
			var newScrollDistanceX = -this.x+this.maxScrollX;
			var newDurationX = 200;
//			this.moved = true;
		} else {
			var newScrollDistanceX = -((speedX*speedX) / (2*deceleration));

			if (speedX<0 && newScrollDistanceX < this.maxScrollX-this.wrapper.clientWidth/5-this.x) {
				newScrollDistanceX = this.maxScrollX-this.wrapper.clientWidth/5-this.x;
			} else if (speedX>0 && -newScrollDistanceX > this.wrapper.clientWidth/5 - this.x) {
				newScrollDistanceX = this.wrapper.clientWidth/5 - this.x;
			}
			var newDurationX = newScrollDistanceX ? newScrollDistanceX / (speedX/2) * 2 : 0;
		}
		
		if (this.y > 0) {
			var newScrollDistanceY = -this.y;
			var newDurationY = 200;
//			this.moved = true;
		} else if (this.y < this.maxScrollY) {
			var newScrollDistanceY = -this.y+this.maxScrollY;
			var newDurationY = 200;		
//			this.moved = true;
		} else {
			var newScrollDistanceY = -((speedY*speedY) / (2*deceleration));

			if (speedY<0 && newScrollDistanceY < this.maxScrollY-this.wrapper.clientHeight/5-this.y) {
				newScrollDistanceY = this.maxScrollY-this.wrapper.clientHeight/5-this.y;
			} else if (speedY>0 && -newScrollDistanceY > this.wrapper.clientHeight/5 - this.y) {
				newScrollDistanceY = this.wrapper.clientHeight/5 - this.y;
			}
			var newDurationY = newScrollDistanceY ? newScrollDistanceY / (speedY/2) * 2 : 0;
		}
				
		if ( newDurationX<0 ) {
			newDurationX = -newDurationX;
			newScrollDistanceX = -newScrollDistanceX;
		}
		if ( newDurationY<0 ) {
			newDurationY = -newDurationY;
			newScrollDistanceY = -newScrollDistanceY;
		}
		
		var newPositionX = this.x + Math.round(newScrollDistanceX);
		var newPositionY = this.y + Math.round(newScrollDistanceY);

		var newDuration = newDurationX>newDurationY ? newDurationX : newDurationY;

		if (this.x == newPositionX && this.y == newPositionY) {
			// Hide scrollbars
			if (this.scrollX && this.scrollbars.x) {
				this.scrollbars.x.element.style.webkitTransitionDuration = '0, 200ms';
				this.scrollbars.x.element.style.opacity = '0';
			}
			if (this.scrollY && this.scrollbars.y) {
				this.scrollbars.y.element.style.webkitTransitionDuration = '0, 200ms';
				this.scrollbars.y.element.style.opacity = '0';
			}
		} else {
			this.scrollTo(newPositionX, newPositionY, Math.round(newDuration) + 'ms');
			this.element.addEventListener('webkitTransitionEnd', this, false);
		}

		return false;
	},
	
	onTransitionEnd: function () {
		this.element.removeEventListener('webkitTransitionEnd', this, false);
		
		// If we are outside of the boundaries, let's go back to the sheepfold
		var resetX = resetY = null;
		if (this.x>0 || this.x<this.maxScrollX) {
			resetX = this.x > 0 ? 0 : this.maxScrollX;
		}

		if (this.y>0 || this.y<this.maxScrollY) {
			resetY = this.y > 0 ? 0 : this.maxScrollY;
		}

		this.scrollTo(resetX, resetY, '400ms');

		// Hide scrollbars
		if (this.scrollX && this.scrollbars.x) {
			this.scrollbars.x.element.style.webkitTransitionDuration = '0, 200ms';
			this.scrollbars.x.element.style.opacity = '0';
	   	 	this.scrollbars.x.wrapper.style.left = '4px';
	   	 	this.scrollbars.x.wrapper.style.right = '8px';
			this.scrollbars.x.jollyCorner.style.display = 'none';
			this.scrollbars.x.jollyCorner.style.webkitBorderRadius = '0';
	   	 	this.scrollbars.x.element.style.webkitBorderRadius = '2px';

		}

		if (this.scrollY && this.scrollbars.y) {
			this.scrollbars.y.element.style.webkitTransitionDuration = '0, 200ms';
			this.scrollbars.y.element.style.opacity = '0';
	   	 	this.scrollbars.y.wrapper.style.top = '4px';
	   	 	this.scrollbars.y.wrapper.style.bottom = '8px';
			this.scrollbars.y.jollyCorner.style.display = 'none';
			this.scrollbars.y.jollyCorner.style.webkitBorderRadius = '0';
	   	 	this.scrollbars.y.element.style.webkitBorderRadius = '2px';
		}
	},
	
	scrollTo: function (destX, destY, runtime) {
		this.element.style.webkitTransitionDuration = runtime ? runtime : '400ms';

		// Scrollbars
		if (this.scrollX && this.scrollbars.x) {
			this.scrollbars.x.element.style.webkitTransitionDuration = this.element.style.webkitTransitionDuration + ', 0';
		}
		if (this.scrollY && this.scrollbars.y) {
			this.scrollbars.y.element.style.webkitTransitionDuration = this.element.style.webkitTransitionDuration + ', 0';
		}
		
		this.setPosition(destX, destY);

		// If we are outside of the boundaries at the end of the transition go back to the sheepfold
		if (this.x>0 || this.x<this.maxScrollX || this.y>0 || this.y<this.maxScrollY) {
			this.element.addEventListener('webkitTransitionEnd', this, false);
		}
	}
};
