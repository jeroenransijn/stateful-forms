const express = require('express');
const app = express();
const bodyParser = require('body-parser');

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.use(express.static('examples'));
app.use(express.static('dist'));

app.post('/response', (req, res) => {
  console.log(req.body);

  if (req.body.is_success === 'true') {
    res.json({ success: true });
  } else {
    res.json({ success: false, errorMessage: 'Server side error message' });
  }

});

app.post('/json-request', (req, res) => {
  console.log(req.body);

  if (req.body.is_success) {
    res.json({ success: true });
  } else {
    res.json({ success: false, errorMessage: 'Server side error message' });
  }

});

app.listen(3000, () => console.log('listening on 3000'));
