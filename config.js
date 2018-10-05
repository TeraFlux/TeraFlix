var utorrent={
	utorrentURI:"http://utorrentwebguiaddress",
	utorrentUsername:"",
	utorrentPW:""
};
var plex={
	personalPlexURL:"http://personalplexpath",
	plexTvURL:"https://plex.tv/users/sign_in.xml",
	plexUsername:"",
	plexPassword:""
};
var googleAuth={
	googleClientId:"",
	googleClientSecret:"",
	googleCallbackURI:"/auth/google/callback",
	allowedGoogleAuthUserNames:['username1','username2']
};
var socks5={
	socks5Username:"",
	socks5Password:"",
	socks5URL:""
};
var cert={
	certPemPath:"pathto/privkey.pem",
	certFullChain:"pathto/fullchain.pem"
};
var downloadingMoviesPath="pathto\downloadingMovies.js";
var MDBToPlexIDPath="pathto/MDBToPlexID.js"
var portListener=//portnumber;
var mdbApiKey="yourMDBAPIKey";

module.exports = {
	'utorrent':utorrent,
	'plex':plex,
	'googleAuth':googleAuth,
	'cert':cert,
	'socks5':socks5,
	'downloadingMoviesPath':downloadingMoviesPath,
	'MDBToPlexIDPath':MDBToPlexIDPath,
	'portListener':portListener,
	'mdbApiKey':mdbApiKey
}
module.exports.torrentAuthBase64=function(){
	return new Buffer(utorrent.utorrentUsername+":"+utorrent.utorrentPW).toString('base64');
}
module.exports.plexAuthBase64=function(){
	return new Buffer(plex.plexUsername+":"+plex.plexPassword).toString('base64');
}
