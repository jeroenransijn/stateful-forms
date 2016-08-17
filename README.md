# Stateful forms
> Small library to deal with forms. Inspired by AngularJS. 0 dependencies.

**This project is in active development. Not stable to use yet.**

```html
<form stateful novalidate action="/endpoint" method="post">

	<input type="text" name="name" required>
	<p sf-show="form.submitted and name.invalid">
		Please enter a correct name
	</p>

	<button type="submit" name="button">Submit</button>

</form>

<script src="/stateful-forms.js"></script>
<script type="text/javascript">
	window.addEventListener('DOMContentLoaded', function () {
		// This will make all your forms stateful when the DOM is loaded
		window.createStatefulForms();
	});
</script>
```

## When to use stateful forms?

* Contact forms
* Landing page signup forms
* Order forms
* No need for big dependency such as AngularJS

## Features

* 0 dependencies
* Works on IE9+
* Forms will be send with AJAX
* Form serialization
* Uses HTML5 validation attributes
* No JavaScript configuration required
* Similar syntax to AngularJS
* Use a expression to toggle an element
* Use expressions to toggle classes or attributes

## Quick Start

1. Install `stateful-forms`
2. Add the script to your page
3. Call `window.createStatefulForms()` when the DOM is loaded
4. Add the `stateful` attribute to your forms
5. Celebrate!

## Installation

Not yet written...

## Directives: attributes you can put on elements

* `stateful`, put on a `form` to create a stateful form
* `sf-show="<CompoundBooleanExpression>"`, toggles the element if the expression is true
* `sf-text="<ValueExpression>"`, sets the text of the element
* `sf-class="<ObjectExpression>"`, set classnames based on expressions
* `sf-attribute="<ObjectExpression>"`, set attributes based on expressions

## Expressions

Similar to AngularJS you put expressions inside of your directives.
Note that `==`, `or` and `and` are used top map AngularJS `==`, `&&`.
Expressions are not as powerful in stateful forms as in AngularJS.

There are 3 different kind of expressions with some basic examples:

* `<CompoundBooleanExpression>`: `name.invalid`, `form.submitted and name.invalid`
* `<ValueExpression>`: `email.value`
* `<ObjectExpression>`: `has-error: description.invalid`

Read below to learn more about them.

### `CompoundBooleanExpression`

Compound boolean expressions can either be `true` or `false`.
They are used directly in `sf-show`, which toggles an element.

```html
<p sf-show="<CompoundBooleanExpression>"></p>
<p sf-show="name.invalid">Show when name is invalid</p>
<p sf-show="inquiry.value is question">Show when inquiry is question</p>
<p sf-show="form.submitted and name.invalid"></p>
```

**working example:**

```html
<!-- working example -->
<form novalidate action="/endpoint" method="post">

	<input type="text" name="name" required>

	<!-- Note the value of the sf-show attribute -->
	<p sf-show="form.submitted and name.invalid">
		Please enter a correct name
	</p>

	<button type="submit" name="button">Submit</button>
</form>

<script src="/stateful-forms.js"></script>
<script type="text/javascript">
	window.addEventListener('DOMContentLoaded', window.createStatefulForms);
</script>
```

`CompoundBooleanExpression` in semi Backus–Naur Form:

```
<CompoundBooleanExpression> = <BooleanExpression>
	| <BooleanValueExpression>
	| <BooleanExpression> and <CompoundBooleanExpression>
	| <BooleanValueExpression> and <CompoundBooleanExpression>
	| <CompoundBooleanExpression> or <CompoundBooleanExpression>

<BooleanValueExpression> = <name>.value is <value>

<BooleanExpression> = <name>.<property>

<name> = form | <form-element-name>

<form-element-name> = string
<property> = string
<value> = string
```

It is important to note that you can only use `is`
if you are accessing the `value` on a form element.

```html
<!-- This will throw an error -->
<p sf-show="name.valid is false"></p>
```

### `ValueExpression`

Value expressions are used inside of `sf-text` directly.
They are used in combination with `is` to form a `BooleanExpression`.

```html
<p sf-text="<ValueExpression>"></p>
<p sf-text="email.value">This text will be replaced with email.value</p>
```

`ValueExpression` in semi Backus–Naur Form:

```
<ValueExpression> = <form-element-name>.value

<form-element-name> = string
```

Note that there is no value on the `form` object.

### `ObjectExpression`

Object expressions are used inside of `sf-class` and `sf-attributes` directly.

**

```html
<p sf-class="<ObjectExpresssion>"></p>
<p sf-class="has-error: email.invalid">
	Gets has-error class when email is invalid
</p>
<p sf-class="has-error: email.invalid, is-valid: email.valid">
	Gets has-error or is-valid class based on
</p>
<p sf-class="has-error: form.submitted and email.invalid"></p>
```

`sf-attributes` is often used on `input` fields to make them `disabled`
or `required` based on a other field.

```html
<input sf-attributes="<ObjectExpresssion>">
<input sf-attributes="disabled: firstName.invalid" name="lastName"/>
```

`ObjectExpression` in semi Backus–Naur Form:

```
<ObjectExpression> = <key>: <BooleanExpression>
	| <key>: <BooleanExpression>, <ObjectExpression>

<key> = string
```

## The `form` object

`form` is always available and refers to the form itself.
It has the same properties as a form element with a couple extra properties.

```
form.submitting = the ajax call is in progress
form.submitted = has the submit button been clicked

form.pristine = have the form elements inside been interacted with
form.dirty = !pristine
form.valid = are all form elements valid
form.invalid = !valid
form.touched = did any form element blur
form.untouched = !touched
```

## The `response` object

TODO

## Supported form elements

* `input[type="text"]`
* `input[type="phone"]`
* `input[type="email"]`
* `select`
* `textarea`
* `input[type="checkbox"]`

## Limitations

* No `type="file"` support
* No async validator support


## Examples

Note that the script is omitted in the examples.

### Toggle an element

```html
<form stateful novalidate action="/endpoint" method="post">

	<input type="text" name="name" value="" required>
	<p sf-show="name.invalid">
		Please enter a correct name
	</p>

</form>
```

### Combine expressions with `and`

```html
<form stateful novalidate action="/endpoint" method="post">

	<input type="email" name="email" value="" required>
	<p sf-show="form.submitted and name.invalid">
		Please enter a correct name
	</p>

	<button type="submit" name="button">Submit</button>

</form>
```
