// modules =================================================
var express = require('express');
var app = express();
var bodyParser = require('body-parser');

// configuration ===========================================

// config files
/*var db = require('./db-config');
// connect database using mongoose
var mongoose = require('mongoose');
//console.log(db.url);
mongoose.connect(db.url, function(error) {
    if (error) {
        console.log(error);
    }
});*/

// set our port
var port = process.env.PORT || 9900;

// get all data/stuff of the body (POST) parameters
// parse application/json
app.use(bodyParser.json());

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({
    extended: true
}));
//app.UseCors(CorsOptions.AllowAll);
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});
// set the static files location /public/img will be /img for users
app.use(express.static(__dirname + '/'));

// routes ==================================================
var getUserDetailsRoute = require('./api/modules/getUserDetails/getUserDetails.route');

app.get('/getUserDetails', getUserDetailsRoute);

app.listen(port);

// shoutout to the user
console.log('Application can start hitting on this http://localhost:' + port );
