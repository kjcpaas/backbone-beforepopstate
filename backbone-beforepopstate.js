/*!
 * backbone-beforepopstate v0.9.0
 * https://github.com/veracross/backbone-beforepopstate
 *
 * Requires jQuery, tested with 1.7 and 1.8
 *
 * Copyright 2012-2013 Will Bond, Breuer & Co LLC <wbond@breuer.com>
 * Released under the MIT license
 *
 * Date: 2013-2-4
 */

// Replaces the original checkUrl with one that runs beforepopstate event
// handlers before the state is popped, allowing for equivalent functionality
// to beforeunload handlers.
Backbone.History.prototype._originalCheckUrl = Backbone.History.prototype.checkUrl;

Backbone.History.prototype.checkUrl = function(e) {
  var confirmText, returnTo, fragment, e;
  var confirmSuffix = "\n\nAre you sure you want to leave this page?";

  // If there are beforepopstate handlers, continue as normal
  var events = $(window).data('events') || $._data($(window)[0], 'events');
  if (!events || !events.beforepopstate || this._pushHistory.length == 0) {
    return this._originalCheckUrl(e);
  }

  // Try each beforepopstate handler, retrieving the text
  // and then checking with the user
  var cancelled = false;
  for (var i = 0; i < events.beforepopstate.length; i++) {
    e= {
      type: "beforepopstate",
      fragment: this._pushHistory[this._pushHistory.length - 1]
    };
    confirmText = events.beforepopstate[i].handler(e);
    if (confirmText && !confirm(confirmText + confirmSuffix)) {
      cancelled = true;
      break;
    }
  }

  if (!cancelled) {
    this._pushHistory.pop();
    return this._originalCheckUrl(e);
  }

  // If the user did cancel, we have to push the previous URL
  // back onto the history to make it seem as if they never
  // moved anywhere.
  this._popCancelled = true
  returnTo = this.fragment;
  this.fragment = this.getFragment();
  this._originalNavigate(returnTo);
};


// Replaces the original navigate with one that runs
// beforepushstate event handlers before the state is
// changed, allowing for equivalent functionality to
// beforeunload handlers.
Backbone.History.prototype._originalNavigate = Backbone.History.prototype.navigate;

Backbone.History.prototype.navigate = function(fragment, options) {
  if (!Backbone.History.started) return false;

  var confirmText, e;
  var confirmSuffix = "\n\nAre you sure you want to leave this page?";

  // If there are beforepushstate handlers, continue as normal
  var events = $(window).data('events') || $._data($(window)[0], 'events');
  var cancelled = false;
  if (events && events.beforepushstate && this._pushHistory.length > 0) {
    // Try each beforepushstate handler, retrieving the text
    // and then checking with the user
    for (var i = 0; i < events.beforepushstate.length; i++) {
      e = {
        type: "beforepushstate",
        fragment: fragment
      };
      confirmText = events.beforepushstate[i].handler(e);
      if (confirmText && !confirm(confirmText + confirmSuffix)) {
        cancelled = true;
        break;
      }
    }
  }

  if (!cancelled) {
    return this._triggerPushState(fragment, options);
  }
};

// Sets up pushstate events to be triggered when navigate is called
Backbone.History.prototype._triggerPushState = function(fragment, options) {
  var oldFragment = window.location.pathname + window.location.search + window.location.hash;
  this._pushHistory.push(oldFragment);
  // Make sure the history doesn't get "wicked" big
  if (this._pushHistory.length > 1000) {
    this._pushHistory.shift();
  }

  var events, cont, i, e;
  result = this._originalNavigate(fragment, options);

  events = $(window).data('events') || $._data($(window)[0], 'events');
  if (events && events.pushstate) {
    e = {
      bubbles: false,
      cancelable: true,
      preventDefault: function() {},
      srcElement: window,
      stopPropagation: function() {},
      target: window,
      type: "pushstate"
    };

    for (i = 0; i < events.pushstate.length; i++) {
      e.fragment = fragment;
      cont = events.pushstate[i].handler(e);
      // If the handler returns false, skip remaining handlers
      if (cont === false) {
        break;
      }
    }
  }

  return result;
};

// Adds an event handler that adds the fragment being popped to onto the event
Backbone.History.prototype._originalStart = Backbone.History.prototype.start;
Backbone.History.prototype.start = function(options) {
  this._pushHistory = [];
  this._popCancelled = false;
  var history = this;

  // Adds a "fragment" property to popstate events so that they are like
  // pushstate, onbeforepushstate and onbeforepopstate. The fragment will be
  // set to false for the initial popstate event that chrome and safari trigger
  // when first loading a page.
  $(window).on('popstate', function(e) {
    var fragment = history._pushHistory[history._pushHistory.length - 1];
    // The state is null for the default popstate event that chrome and safari
    // trigger on page load
    if (fragment === undefined && e.originalEvent.state === null) {
      fragment = false;
    }
    e.fragment = fragment;
  });

  this._originalStart(options);
  
  // This prevents the popstate event handler from calling any handlers after
  // the one that backbone uses to fire navigation
  $(window).on('popstate', function(e) {
    if (history._popCancelled) {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
      history._popCancelled = false;
    }
  });
}