function StatefulObject () {
	this.listeners = [];
	this.setState(this.getDefaultState());
}

var Proto = StatefulObject.prototype;

Proto.onStateChange = function (listener) {
	this.listeners.push(listener);
	return this;
};

Proto.triggerStateChange = function (partialNewState, key) {
	this.listeners.forEach(function (listener) {
		listener(this.state, partialNewState, key, this);
	}.bind(this));
	return this;
};

/**
 * @param {Object} partialNewState
 * @param {?String} key
 */
Proto.setState = function (partialNewState, key) {
	var name = key || this.name;
	var oldState = this.state || {};
	this.state = this.computedState(Object.assign({}, this.state, partialNewState));
	if (JSON.stringify(oldState[key]) !== JSON.stringify(partialNewState)) {
		this.triggerStateChange(partialNewState, name);
	}
	return this;
};

Proto.computedState = function (state) {
	return state;
};

Proto.getDefaultState = function () {
	return {};
};

module.exports = StatefulObject;
