var passport=require('passport');
var GoogleStrategy=require('passport-google-oauth20');
var cookieParser = require('cookie-parser');
var cookieSession = require('cookie-session');
var config=require("../config.js")
var connectedUsers={};

function validateUser(req,res,next){
	if (req.session.token) {
		if(connectedUsers[req.session.token]){
			var userName=connectedUsers[req.session.token].displayName.toLowerCase();
			if(config.googleAuth.allowedGoogleAuthUserNames.indexOf(userName)===-1){
				//User not in allow list
				console.log("Not Authorized User "+userName);
				res.send(userName+" does not have access to this resource. "+
				"Please retry login as an authorized user. <a href=\"auth/google\">Click Here</a>");
			}else{
				next();
			}
		}else{
			console.log("token not in memory, relog");
			res.redirect('/auth/google');
		}
	}else{
		console.log("No Valid Token, redirecting to login");
        res.cookie('token', '')
		//res.send('Please retry login as an authorized user. <a href="auth/google">Click Here</a>');
		res.redirect('/auth/google');
	}
}

function getUserName(token){
	if(connectedUsers[token]){
		return connectedUsers[token].displayName;
	}else{
		return false
	}
}

function configureApp(app){
	passport.serializeUser((user, done) => {
		console.log('serialize user');
		connectedUsers[user.token]=user.profile;
		done(null, user);
		
	});

	passport.deserializeUser((user, done) => {
		console.log("deserialize");
		done(null, user);
	});

	passport.use(new GoogleStrategy({
		clientID: config.googleAuth.googleClientId,
		clientSecret: config.googleAuth.googleClientSecret,
		callbackURL: config.googleAuth.googleCallbackURI
	},(token, refreshToken, profile, done) => {
		return done(null, {
			profile: profile,
			token: token
		});
	}));

	app.use(passport.initialize());
	
	app.use(cookieSession({
		name: 'session',
		keys: ['SECRECT KEY'],
		maxAge: 24 * 60 * 60 * 1000
	}));
	
	app.use(cookieParser());

	app.get('/auth/google/callback',
		passport.authenticate('google', {failureRedirect:'/'}),
		(req, res) => {
			req.session.token = req.user.token;
			res.redirect('/');
		}
	);
	
	app.get('/auth/google', 	
		passport.authenticate('google', {
			scope: ['https://www.googleapis.com/auth/userinfo.profile']
		})
	);
	
	app.use('/', validateUser);
	
	app.get('/logout', (req, res) => {
		req.logout();
		req.session = null;
		res.redirect('/');
	});
	
	app.get('/getUserName',function (req, res, next) {
		var userName=getUserName(req.session.token);
		if(userName){
			res.send(userName);
		}else{
			res.redirect('auth/google');
		}
	});
	
}
module.exports={
	'connectedUsers':connectedUsers,
	'passport':passport
};

module.exports.configureApp=configureApp;