'use strict';
/**
 * Stateful forms
 * ---
 * Author: Jeroen Ransijn
 * License: MIT
 */
require('./polyfills/object-create');
var StatefulForm = require('./lib/stateful-form');
var DirectivesManager = require('./lib/directives/directives-manager');

global.createStatefulForms = function createStatefulForms () {
  var forms = document.querySelectorAll('form[stateful]');

  // IE9+ NodeList iteration
  return Array.prototype.map.call(forms, function (form) {
    var manager = new DirectivesManager(form);
    return new StatefulForm(form).onStateChange(function (state, partialState, key) {
      // console.log('form:stateChange', key, state);
      if (key) {
        manager.patch(key, state);
      } else {
        manager.update(state);
      }
    }).triggerStateChange();
  });
}
