var qbittorrent={
	host:""
};
var plex={
	personalPlexURL:"",
	plexTvURL:"https://plex.tv/users/sign_in.xml",
	plexUsername:"",
	plexPassword:""
};
var googleAuth={
	googleClientId:"",
	googleClientSecret:"",
	googleCallbackURI:"/auth/google/callback",
	allowedGoogleAuthUserNames:['person1','person2']
};
var socks5={
	socks5Username:"",
	socks5Password:"",
	socks5URL:""
};
var jackett={
	uri:"",
	apikey:""
};
var cert={
	certPemPath:"",
	certFullChain:""
};
var downloadDirectory="";
var moviesDirectory=""
var downloadingMoviesPath=".\downloadingMovies.js";
var MDBToPlexIDPath="./MDBToPlexID.js"
var portListener=;
var mdbApiKey="";

module.exports = {
	'qbittorrent':qbittorrent,
	'plex':plex,
	'googleAuth':googleAuth,
	'cert':cert,
	'socks5':socks5,
	'downloadingMoviesPath':downloadingMoviesPath,
	'MDBToPlexIDPath':MDBToPlexIDPath,
	'portListener':portListener,
	'mdbApiKey':mdbApiKey,
	'jackett':jackett,
	'downloadDirectory':downloadDirectory,
	'moviesDirectory':moviesDirectory
}
module.exports.torrentAuthBase64=function(){
	return new Buffer(utorrent.utorrentUsername+":"+utorrent.utorrentPW).toString('base64');
}
module.exports.plexAuthBase64=function(){
	return new Buffer(plex.plexUsername+":"+plex.plexPassword).toString('base64');
}
