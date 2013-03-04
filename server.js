// server.js 
var mongoose = require('mongoose');
var status = 'Not connected';

var express = require('express'),
	url = require('url'),
  jsdom = require('jsdom'),
  util = require('util'),
  request = require('request'),
// Use RedisStore to avoid default MemoryStore warning in production environment
	RedisStore = require('connect-redis')(express);

var app = express();

 app.configure('production', function () {
    var redisUrl = url.parse(process.env.MYREDIS_URL),
        redisAuth = redisUrl.auth.split(':');  

    app.set('redisHost', redisUrl.hostname);
    app.set('redisPort', redisUrl.port);
    app.set('redisDb', redisAuth[0]);
    app.set('redisPass', redisAuth[1]);
 });

// Remote db for production environment
    mongoose.connect(process.env.MONGOHQ_URL, function (req,res) { 
    console.log('Connected to db.');
    console.log('---');
    status = 'Connected';
});

// local db for developing environment
// mongoose.connect('mongodb://localhost/local', function (req,res) { 
//     console.log('Connected to db.');
//     status = 'Connected';
// });

// Was going to use MemJS as a MemoryStore, but no.
// var MemJS = require("memjs").Client;
// memjs = MemJS.create()

app.use(express.bodyParser());
app.use(express.cookieParser());    
app.use(require('stylus').middleware({ src: __dirname + '/public' }));
app.use(express.static(__dirname + '/public'))
app.use(express.session({
        secret: 'secretpanda',
        store: new RedisStore({
            host: app.set('redisHost'),
            port: app.set('redisPort'),
            db: app.set('redisDb'),
            pass: app.set('redisPass')
        })
    }));

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

app.set('views', __dirname + '/views');
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

// login page
app.get('/login', function (req,res) {
    res.render('login', {signupEmail:''});
});

// login with email parameter
app.get('/login/:signupEmail', function (req,res) {
    res.render('login', {signupEmail: req.params.signupEmail});
});

// submit login form
app.post('/login', function (req,res) {
    User.findOne({ email: req.body.user.email, password: req.body.user.password }, function (err,doc) {
        if (err) return next(err);
        if (!doc) return res.send('<p>User not found. Go back and try again</p>');
        req.session.loggedIn = doc._id.toString();  
        res.redirect('/');
    });
});

// signup page
app.get('/signup', function(req,res) {
    res.render('signup');
});

// submit signup form
app.post('/signup', function(req,res,next) {
    var user = new User(req.body.user).save(function(err, user) {    
        if (err) return next(err);
        res.redirect('/login/' + user.email);
    });
});

// logout user
app.get('/logout', function(req,res) {
    req.session.loggedIn = null;
    res.redirect('/');
});

// new roof page
app.get('/newroof', function(req,res) {
	res.render('newroof');	
});

// submit new roof
app.post('/newroof', function(req,res) {
	var roof = new Roof(req.body.roof);
	roof.set({owner: res.locals.me._id,
		ownerName: res.locals.me.last});
	roof.save(function(err, roof) {
		if (err) return next(err);
		});
		res.redirect('/');	
});

// explore roof page
app.get('/explore', function(req,res) {
	Roof.find({}, function(err, doc) {
		if (err) return next(err);
		if (!doc) return res.send("No available rooftops.");
		var roof = doc;
		res.render('explore', {roofs:doc});	
	});
});

// get roof page
app.get('/roof/:roofid', function(req,res) {
	// Overkill declaration..?
	// var ObjectId = require('mongoose').Types.ObjectId;
	// myroofid = new ObjectId(req.params.roofid);
	Roof.findOne({_id:req.params.roofid}, function(err,roof) {
		res.render('roof', {roof:roof});
	});
});

app.post('/accessreq', function(req, res) {
	var accessRequest = new AccessRequest(req.body.AccessRequest);
	accessRequest.set({guestId: res.locals.me._id,
	       			guestName: res.locals.me.last,	
				paid:false, 	
				confirmed:false,
	});	
	accessRequest.save(function(err, accessRequest) {
		if (err) return next(err);
		});
		res.redirect('/');	
});	

app.get('/userrequests', function(req, res) {
	type = res.locals.me.type;
	userId = res.locals.me._id;
	var query = AccessRequest.find({});
	if (type=='guest')
	{
		query.where('guestId', userId);
	} else {
		query.where('hostId', userId);
	}
	query.exec(function (err, accessrequests) {
		res.render('userrequests', {userrequests:accessrequests,
			type: type});
	});
});

app.get('/confirm/:requestId', function(req, res) {
	var conditions = {_id:req.params.requestId}
		, update = {confirmed:true}
		, options = {multi:false};
	AccessRequest.update(conditions, update, options, function(err,areq) {
		res.redirect('/');
	});
});

app.get('/wishlist', function(req, res) {
  var wishListID = res.locals.me.wishlistID; // e.g: 3J3CNRKGZ6NNP
  var uri = util.format('http://www.amazon.com/registry/wishlist/%s?layout=compact', wishListID);
  fetchWishlistWithURI(uri, function(wishlistContent) {
    console.log(wishlistContent);
    res.render('wishlist', {wlID: wishListID, wishlistContent:wishlistContent});
  });
});

function fetchWishlistWithURI(uri, callback) {
  request({uri: uri}, function(err, response, body) {
    var wishlistContent = new Array();
    if (err && response.statusCode !== 200) { console.log('Request error.'); } 
    jsdom.env({
      html: body,
      scripts: ['http://code.jquery.com/jquery-1.6.min.js']
    }, function (err, window) {
      var $ = window.jQuery,
          $body = $('body'),
          $items = $body.find('table.compact-items.wlrdZeroTable');
      var $tbody = $items.find('tbody');
          $tbody.each(function (i, item) {
            var $a = $(item).find('a:first'),
                $href = $a.attr('href'),
                $name = $a.text(),
                regex = RegExp("(dp|gp/product)/(\\w+/)?(\\w{10})"),
                urls = $href.match(regex), // m contains array of matching urls, i.e:
                asin = urls[3],
                $price = $(item).find('span.price').text();
            wishlistContent[i] = {
              href: $href,
              name: $name,
              asin: asin,
              price: $price
            };
          });
    callback(wishlistContent);
    });
  });
}

app.post('/wishlist', function(req, res) {
  var newWishListID = req.body.user.wishlistID;
  var conditions = {_id:res.locals.me._id}
  , update = {wishlistID:newWishListID}
  , options = {multi:false};
  User.update(conditions, update, options, function(err, user) {
    res.redirect('/wishlist');
  });
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
    wishlistID: String,
    type: String
}));

var Roof = mongoose.model('Roof', new Schema({
    name: String,
    owner: String,
    ownerName: String,
    location: String,
    neighborhood: String,
    picture: String
}));

var AccessRequest = mongoose.model('AccessRequest', new Schema({
    guestId: String,
    guestName: String,
    hostId: String,
    hostName: String,
    roofId: String,
    roofName: String,
    roofNeighborhood: String,
    date: String,
    time: String,
    paid: Boolean,
    confirmed:Boolean
}));
