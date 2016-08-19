// IE8+
function removeClass (el, className) {
  if (el.classList) {
    el.classList.remove(className);
  } else {
    el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
  }
}

// IE8+
function addClass (el, className) {
  if (el.classList) {
    el.classList.add(className);
  } else {
    el.className += ' ' + className;
  }
}

function toggleClass (el, className, isApplied) {
  if (isApplied) {
    addClass(el, className);
  } else {
    removeClass(el, className);
  }
}

function toggleAttribute (el, attrName, isApplied) {
  if (isApplied) {
    el.setAttribute(attrName, attrName);
  } else {
    el.removeAttribute(attrName);
  }
}

function reflectState (el, state) {
  Object.keys(state).forEach(function (key) {
    if (typeof state[key] === 'boolean') {
      toggleClass(el, 'is-' + key, !!state[key]);
    } else if (key === 'value') {
      toggleClass(el, 'has-value', !!state[key]);
    }
  });
}

module.exports = {
  toggleClass: toggleClass,
  reflectState: reflectState,
  removeClass: removeClass,
  addClass: addClass,
  toggleAttribute: toggleAttribute
};
