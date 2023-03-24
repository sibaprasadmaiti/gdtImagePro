var express = require('express');
var app = express();
var fs = require('fs');
var port = process.env.PORT || 5041;
var bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
var con = require('./dbcon.js');
/*var con = mysql.createConnection(
{
    host: "amazoncustomsolution.cwt03gcjd3dj.us-east-2.rds.amazonaws.com",
    user: "admin",
    password: "Messold12"
});
con.connect(function(err)
{
    if (err) throw err;
    console.log("Connected!");
});*/
app.use(bodyParser.urlencoded(
{
    extended: false
}))
app.use(express.static(__dirname + '/public'));
require('./app/routes.js')(app, con);

app.listen(port);
console.log('The App runs on port ' + port);
