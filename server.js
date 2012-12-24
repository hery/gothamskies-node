// server.js

var mongoose = require('mongoose');
var status = 'Not connected';

// Remote db for production environment
// mongoose.connect('mongodb://pandaman:ilovebamboo@linus.mongohq.com:10077/app10212447', function (req,res) { 
//     console.log('Connected to db.');
//     status = 'Connected';
// });

// local db for developing environment
mongoose.connect('mongodb://localhost/local', function (req,res) { 
    console.log('Connected to db.');
    status = 'Connected';
});

var express = require('express');
// Use RedisStore to avoid default MemoryStore warning in production environment
var RedisStore = require('connect-redis')(express);
var app = express();

// Was going to use MemJS as a MemoryStore, but no.
// var MemJS = require("memjs").Client;
// memjs = MemJS.create()

app.use(express.bodyParser());
app.use(express.cookieParser());    

// app.use(express.session({secret:'beautiful panda'}));
app.use(express.session({store: new RedisStore, secret:'beautiful panda'}));

// Authentication middleware // Needs some review
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
    if (req.session.loggedIn) {
    	username = res.locals.me.first;
	usertype = res.locals.me.type;
    	res.render('index', {status: status, accountType: usertype, username: username});
    } else {
    	res.render('index');
    }
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
    password: {type:String,index:true},
    type: String
}));

var Root = mongoose.model('Root', new Schema({
    first: String,
    last: String,
    email: {type:String, unique:true},
    password: {type:String,index:true},
    type: String
}));
