
//clientKey
// var clientKey = "GDT_123456789";
var merchant_id = "1111111111"

var express = require('express');
var app = express();
var port = process.env.PORT || 5040;
var bodyParser = require('body-parser');
var https = require('https');
var fs = require('fs');

// const crypto = require('crypto');
const fileUpload = require('express-fileupload');
app.use(bodyParser.urlencoded(
{
    extended: false
}))
app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/public'));

require('./app/routes.js')(app,merchant_id);



// https.createServer({
//     // key: fs.readFileSync('/etc/pki/tls/private/acs.gdtimagepro.com.key'),
//     // cert: fs.readFileSync('/etc/pki/tls/certs/acs.gdtimagepro.com_ssl_certificate.crt'),
//     // ca : fs.readFileSync('/etc/pki/tls/certs/ca-bundle.crt')
//     // passphrase: 'YOUR PASSPHRASE HERE'
// }, app).listen(port);


// app.get('/', function (req, res) {
//     res.writeHead(200);
//     res.end("hello world\n");
// });

app.listen(port);
console.log('The App runs on port ' + port);

