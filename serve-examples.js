var express = require('express');
var app = express();

app.use(express.static('examples'));
app.use(express.static('dist'));

app.listen(3000, () => console.log('listening on 3000'));
