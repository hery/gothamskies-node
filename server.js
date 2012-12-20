// server.js

var status = 'Not connected';

var mongoose = require('mongoose');
mongoose.connect('mongodb://aeon:zamaek@linus.mongohq.com:10077/app10212447', function (req,res) { 
    console.log('Connected to db.');
    status = 'Connected';
});

var express = require('express');
var app = express();

var MemJS = require("memjs").Client;
memjs = MemJS.create()

app.use(express.bodyParser());
app.use(express.cookieParser());    
app.use(express.session({secret:'beautiful panda'}));

app.use(function(req,res,next) {
    if (req.session.loggedIn) {
        res.locals.authenticated = true;
        User.findById(req.session.loggedIn, function(err,doc) {
            if (err) return next(err);
            res.locals.me = doc;
            next();
        });
    } else {
        res.locals.authenticated = false;
        next();
    }
});

app.set('view engine', 'jade');
app.set('view options', {layout: false});

app.get('/', function (req,res) {
    res.render('index', {status: status});
});

app.get('/login', function (req,res) {
    res.render('login', {signupEmail:''});
});

app.get('/login/:signupEmail', function (req,res) {
    res.render('login', {signupEmail: req.params.signupEmail});
});

app.post('/login', function (req,res) {
    User.findOne({ email: req.body.user.email, password: req.body.user.password }, function (err,doc) {
        if (err) return next(err);
        if (!doc) return res.send('<p>User not found. Go back and try again</p>');
        req.session.loggedIn = doc._id.toString();  
        res.redirect('/');
    });
});

app.get('/signup', function(req,res) {
    res.render('signup');
});

app.post('/signup', function(req,res,next) {
    var user = new User(req.body.user).save(function(err, user) {    
        if (err) return next(err);
        res.redirect('/login/' + user.email);
    });
});

app.get('/logout', function(req,res) {
    req.session.loggedIn = null;
    res.redirect('/');
});

var port = process.env.PORT || 5000;
app.listen(port, function() {
  console.log("Listening on " + port);
});

var Schema = mongoose.Schema

var User = mongoose.model('User', new Schema({
    first: String,
    last: String,
    email: {type:String, unique:true},
    password: {type:String,index:true}
}));
