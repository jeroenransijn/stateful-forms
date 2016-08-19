# Stateful Forms
> Small library to deal with forms. Inspired by AngularJS + React. 0 dependencies.

```html
<form stateful novalidate action="/endpoint" method="post" enctype="application/json">

  <fieldset sf-show="!($request.success && $response.json.success)">

    <div sf-class="has-error: $form.submitted && name.invalid">
      <label for="name">Name</label>
      <input type="text" name="name" id="name" required>
      <p sf-show="$form.submitted && name.invalid" style="display: none;">
        Please fill in a name
      </p>
    </div>

    <p sf-text="$response.json.errorMessage">
      <!-- Support for server side responses -->
    </p>

    <p sf-show="$request.failed || $request.error" style="display: none;">
      Oops, something went wrong on with the request. Try again later.
    </p>

    <button type="submit" name="button">Submit</button>

  </fieldset>

  <fieldset sf-show="$request.success && $response.json.success" style="display: none;">

    <h2>Form successfully submitted</h2>

    <p sf-text="$response.json.message"></p>

  </fieldset>

</form>

<script src="/stateful-forms.js"></script>
<script type="text/javascript">
  window.addEventListener('DOMContentLoaded', function () {
    // This will make all your forms stateful when the DOM is loaded
    window.createStatefulForms();
  });
</script>
```

## Features

* 0 dependencies
* Tiny footprint ~6kb minified, ±10 times smaller than AngularJS
* Good documentation
* Works on IE9+
* Excellent performance
* Forms will be serialized and send with AJAX
* Uses HTML5 validation attributes
* No JavaScript configuration required
* Powerful expressions based on AngularJS expressions

## When to use Stateful Forms?

* Contact forms
* Landing page signup forms
* Order forms
* Questionnaires
* When you deal with forms in general

## Quick Start

1. Install `stateful-forms`
2. Add the script to your page
3. Call `window.createStatefulForms()` when the DOM is loaded
4. Add the `stateful` attribute to your forms
5. Scroll down for examples

## Installation

## JSDelivr CDN

```html
<script src="https://cdn.jsdelivr.net/stateful-forms/0.3.1/stateful-forms.min.js"></script>
```

### Manual Install

Download `/dist/stateful-forms.min.js`.

```html
<!-- In your project -->
<script src="/js/stateful-forms.min.js"></script>
```

### Install with `npm`

```
npm install stateful-forms --save
```

```html
<!-- In your project with npm -->
<script src="/node_modules/stateful-forms/dist/stateful-forms.min.js"></script>
```


## How does it work?

Stateful Forms creates a state object based on your form and form elements.
That state object could look something like this before you touched the form:

```javascript
{
  form: {
    submitted: false,
    valid: false,
    invalid: true,
    pristine: true,
    dirty: false,
    touched: false,
    untouched: true
  },
  email: {
    valid: false,
    invalid: true,
    pristine: true,
    dirty: false,
    touched: false,
    untouched: true
  },
  name: {
    // ... same as email
  },
  password: {
    // ... same as email
  }
}
```

It then exposes that state object to elements inside of your form we call `directives`.
`sf-show` in this example is such a directive:

```html
<p sf-show="$form.submitted && name.invalid">Please fill in a name.</p>
```

Inside of your `directive` you put `expressions`.
In the previous example that was: `form.submitted && name.invalid`.

Whenever you change something in the form a state update is triggered.
It checks if there are any directives listening to this state.
If there are, it updates those directives with that state.

### What happens on a form submit

When a form is submitted the form sets `form.submitted` to true.

If the form is valid, it is it serializes the form and makes
an AJAX request to the endpoint in your `action` attribute.

In the mean while it sets `request.pending` to true.
So you can go all wild on your loading indicators.

When the request is successful, `request.success` is set to true.
Also a `response` object is added to the state.

This `response` object contains whatever you send back from the server on two properties.

* `response.text` contains the raw response text.
* `response.json` contains the response text parsed by `JSON.parse`.

See documentation and examples below.

## Directives: attributes you can put on elements

* `stateful`, put on a `form` to create a stateful form. *Supports multiple forms*.
* `sf-show="<Expression>"`, toggles the element if the expression is Truthy.
* `sf-text="<Expression>"`, sets the text of the element.
* `sf-class="<ObjectExpression>"`, sets classnames based on expressions.
* `sf-attribute="<ObjectExpression>"`, sets attributes based on expressions.

## `sf-show` directive

`sf-show="<Expression>"`, toggles the element if the expression is Truthy.

```html
<p sf-show="<Expression>"></p>
<p sf-show="name.invalid">Show when name is invalid</p>
<p sf-show="inquiry.value == 'question'">Show when inquiry is question</p>
<p sf-show="inquiry.value != 'question'">Show when inquiry is not question</p>
<p sf-show="$form.submitted && name.invalid"></p>
<p sf-show="request.failure || response.json.invalid"></p>
```

Note that the [Truthy](https://developer.mozilla.org/en-US/docs/Glossary/Truthy) value of the `Expression` is used.

## `sf-text` directive

`sf-text="<Expression>"`, sets the text of the element.

```html
<p sf-text="<Expression>">Will show the value of the expression here</p>
<p sf-text="email.value">This text will be replaced with email.value</p>
<p sf-text="email.valid ? 'Happy' : 'Unhappy'"></p>
```

## `sf-class` directive

`sf-class="<ObjectExpression>"`, sets classnames based on expressions.

```html
<p sf-class="<ObjectExpresssion>"></p>
<p sf-class="has-error: email.invalid">
  Gets has-error class when email is invalid
</p>
<p sf-class="has-error: email.invalid; is-valid: email.valid">
  Gets has-error or is-valid class based on
</p>
<p sf-class="has-error: form.submitted && email.invalid"></p>
```

## `sf-attributes` directive

`sf-attribute="<ObjectExpression>"`, sets attributes based on expressions.

```html
<button sf-attributes="disabled: terms_and_conditions.invalid" type="submit">
  Create account
</button>
```

## Expressions

Expressions in Stateful Forms are a slimmed down version of AngularJS expressions.
The actual code is a remix of [angular/expressionist.js](https://github.com/angular/expressionist.js),
slimmed down and converted to es5. *Don’t worry if you don’t know what that means.*

Additionally Stateful Forms uses something called `ObjectExpression`.

### Valid expressions

Not all of these are directly applicable in real world usage,
but it is nice to know there is power when you need it.

```
!false || true
(true && false) || true
!(11 == 10)
!true
2<3
2>3
2<=2
2>=2
2==3
2!=3
true&&true
true||false
7==3+4?10:20
true&&false?10:20
'str ' + 4
a.b
a.b.c.d
taxRate / 100 * subTotal
```

Please see `test/parser.js` for more examples.

### `ObjectExpression`

An `ObjectExpression` is an object holding expressions:

```
key1: <Expression>; key2: <Expression>
```

They are used in `sf-class` and `sf-attributes`.

```html
<p sf-class="has-error: name.invalid; is-valid: name.valid"></p>
<input sf-attributes="disabled: firstQuestion.invalid" type="text">
```

It uses the `;` character to split expressions.
And the first `:` character to split the key from the expression.

The example would return:

```javascript
{
  has-error: 'name.invalid',
  is-valid: 'name.valid'
}
```

Which is in turn parsed by the `sf-class` or `sf-attributes` directive
to become usable.

### In AngularJS but not in Stateful Forms

These would’t make a lot of sense in Stateful Forms either.

* Variable assignment `someVar = 'hello'` **not supported**
* Function calls `someFunc()` **not supported**
* Array access `a[0]` **not supported**
* Object literals `{ a: 'prop' }` **not supported**
* Object key access `obj['someKey']` **not supported**
* ... more obscure expressions omitted

## Form elements

The following list shows all the supported form elements.
*You can ignore the right hand side of the arrow.*

* `input[type="text"]` => `StatefulTextInput`
* `input[type="hidden"]` => `StatefulTextInput`
* `input[type="phone|tel"]` => `StatefulTextInput`, *doesn’t validate*
* `input[type="email"]` => `StatefulTextInput`, *validates email*
* `textarea` => `StatefulTextInput`
* `input[type="checkbox"]` => `StatefulCheckbox`
* `input[type="radio"]` => `StatefulRadio` grouped by `StatefulRadioGroup`
* `select` => `StatefulSelect`

* No `type="file"` support
* No `type="date"` support`

### Why doesn’t `input[type="phone"]` validate?

Since there are so many different types of phone numbers.
It’s impossible to have a one size fits all.

The best way to include phone validation is through a regular expression
on the `pattern` attribute.

The following StackOverflow post might give you more insight:
[A comprehensive regex for phone number validation](http://stackoverflow.com/questions/123559/a-comprehensive-regex-for-phone-number-validation)

### Why no `type="date"` or datepicker support?

The date type is horribly supported among browser with inconsistent UI
and API’s. If you want to use a custom datepicker you are better of
reflecting the value to a hidden input field.

### Proxy a form element into an other type

**Advanced usage, you better now what you are doing.**
You can potentially use the `sf-element` attribute to set what type
a form element should use. This might be useful for unsupported
form elements. Usage: `sf-element="text"` for example.

### Form elements states

Form element states are the same as in AngularJS.

```
form.pristine = has the form element been interacted with
form.dirty = !pristine
form.valid = is the form element valid
form.invalid = !valid
form.touched = did the form element blur (or interacted with for some elements)
form.untouched = !touched
```

### Form element state is reflected as classnames

Form elements reflect their state as classnames (just like AngularJS).
The state is prefixed with `is-{state}`.

```
<input type="text" class="is-valid is-untouched is-pristine">
```

## Validation

Stateful Form implements pretty much everything you can in HTML5.

* `required`
* `min`
* `max`
* `maxlength`
* `minlength`
* `pattern`

Note that `required` is needed for a form element to not be `valid` by default.

For now there is no `async` validator support out of the box.
This is often needed for checking if usernames are taken.

## The form itself

Stateful Forms only fully work when you:

* Add the `stateful` attribute to a `form` element.
* Add the `novalidate` attribute to a `form` element

**Only inside of that form do directives work.**

### The `$form` object in the state object

`$form` is always available and refers to the form itself.
It has the same properties as a form element with a couple extra properties.

```
$form.submitted = has the submit button been clicked

$form.pristine = have any of the form elements inside been interacted with
$form.dirty = !pristine
$form.valid = are all form elements valid
$form.invalid = !valid
$form.touched = did any form element blur
$form.untouched = !touched
```

## The `$request` object in the state object

The `$request` object is always available

```javascript
//  state object
{
  $request: {
    pending: false,
    success: true,
    failed: false,
    status: request.status
  }
  // ... state omitted
}
```

## The `$response` object in the state object

The `$response` object is only available when the form is submitted.

```javascript
//  state object
{
  $response: {
    json: JSON.parse(request.responseText),
    text: request.responseText
  }
  // ... state omitted
}
```

You can use the `response` object to show messages from the server.
If you decide to implement something like that.

```html
<p sf-text="response.json.message"></p>
```

## Examples

Check out the `examples` directory for more elaborate use cases.
If you clone this repo you can run them by running `npm run dev`.

**working example:**

```html
<!-- working example -->
<form novalidate action="/endpoint" method="post">

  <input type="text" name="name" required>

  <!-- Note the value of the sf-show attribute -->
  <p sf-show="$form.submitted && name.invalid">
    Please enter a correct name
  </p>

  <button type="submit" name="button">Submit</button>
</form>

<script src="/stateful-forms.js"></script>
<script type="text/javascript">
  window.addEventListener('DOMContentLoaded', window.createStatefulForms);
</script>
```

### Show validation message when form submitted and field is valid

* Useful for validation messages

```html
<form stateful novalidate action="/endpoint" method="post">

  <input type="email" name="email" value="" required>
  <p sf-show="$form.submitted && name.invalid">
    Please enter a correct name
  </p>

  <button type="submit" name="button">Submit</button>

</form>
<!-- script omitted -->
```

Additionally it is a good practice to show the required `*` asterisk only
when the form is submitted:

```html
<form stateful novalidate action="/endpoint" method="post">

  <div class="form-item">
    <label for="create_account_email">Email <span sf-show="$form.submitted && email.invalid" class="req">*</span></label>

    <input type="email" name="email" id="create_account_email" required>

    <p class="desc" sf-show="$form.submitted && email.invalid" style="display: none;">
      Please enter a valid email
    </p>
  </div>

</form>
<!-- script omitted -->
```

### Give an element a class based on validation

* Useful to give a class to a surrounding element

```html
<form stateful novalidate action="/endpoint" method="post">

  <div class="form-item" sf-class="has-error: $form.submitted && email.invalid">
    <input type="email" name="email" value="" required>
    <p sf-show="$form.submitted && name.invalid">
      Please enter a correct name
    </p>
  </div>

  <button type="submit" name="button">Submit</button>

</form>
<!-- script omitted -->
```

### Disable submit button based on checkbox

* Useful for terms and conditions checkbox

```html
<form stateful novalidate action="/endpoint" method="post">

  <label class="form-item checkbox">
    <input name="terms_and_conditions" type="checkbox" required> I agree to the terms and conditions
  </label>

  <button class="button" sf-attributes="disabled: terms_and_conditions.invalid" type="submit" name="button">
    Create account
  </button>

</form>
<!-- script omitted -->
```

### Show value of form element when valid

* Useful to show a confirmation message with the users email

```html
<!-- form and script omitted -->
<div class="form-item">
  <label for="create_account_email">Email <span sf-show="$form.submitted && email.invalid" class="req">*</span></label>

  <input type="email" name="email" id="create_account_email" required>

  <p class="desc" sf-show="$form.submitted && email.invalid" style="display: none;">
    Please enter a valid email
  </p>
</div>

<p sf-show="email.valid" style="display: none;" class="form-item">
  We will send a confirmation email to <strong sf-text="email.value"></strong>.
</p>
```

### Show messages based on selected with a `select` element

```html
<!-- form and script omitted -->
<div class="form-item">
  <label for="inquiry">Inquiry</label>

  <select name="inquiry" class="select width-50">
    <option selected value="question">Question</option>
    <option value="feedback">Feedback</option>
    <option value="billing">Billing</option>
    <option value="other">Other</option>
  </select>

</div>

<div class="form-item">
  <span sf-show="inquiry.value == 'question'">
    Ask us any question.
  </span>
  <span sf-show="inquiry.value == 'feedback'" style="display: none;">
    We are always open for feedback.
  </span>
  <span sf-show="inquiry.value == 'billing'" style="display: none;">
    Let’s figure out this billing inquiry together.
  </span>
  <span sf-show="inquiry.value == 'other'" style="display: none;">
    Tell us what’s on your mind.
  </span>
</div>
```

## Acknowledgements

This project could not be made if it is wasn’t for the excellent work of the AngularJS
team. Especially on the [angular/expressionist.js](https://github.com/angular/expressionist.js) project which I happen to stumble upon.

## TODO

- [x] Build support for `input[type="radio"]`
- [x] Reflect classnames to form elements
- [x] Test out successful responses
- [x] Build support for `input[type="hidden"]`
- [x] Figure out what to do with `input[type="date"]`
- [x] Rename form, response and request to $form, $response, $request
- [x] Create a solid build step with minification
- [x] Publish to `npm`
- [ ] Publish to `bower`
- [ ] Publish to `cdnjs`
- [ ] Write installation guide
- [ ] Put in ESLint

## Author & License

Created by **Jeroen Ransijn** under the **MIT** license.
