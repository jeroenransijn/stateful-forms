'use strict';
/**
 * Stateful forms
 * ---
 * Author: Jeroen Ransijn
 * License: MIT
 */
require('./polyfills/object-create');
var StatefulForm = require('./lib/stateful-form');
var StatefulDirectives = require('./lib/directives/stateful-directives');

global.createStatefulForms = function createStatefulForms () {
	var forms = document.querySelectorAll('form[stateful]');

	// IE9+ NodeList iteration
	return Array.prototype.map.call(forms, function (form) {
		var directives = new StatefulDirectives(form);
		return new StatefulForm(form).onStateChange(function (state, partialState, key) {
			console.log('form:stateChange', key, state);
			if (key) {
				directives.patch(key, state);
			} else {
				directives.update(state);
			}
		}).triggerStateChange();
	});
}
