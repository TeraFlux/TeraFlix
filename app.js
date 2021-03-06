const express = require('express');
var app = express();

var path = require('path');

var config=require("./config.js");
var torrentSearch=require('./custom_modules/torrentSearch.js');
var torrentClient=require('./custom_modules/torrentClient.js');
var plexClient=require('./custom_modules/plexClient.js');
var redBoxClient=require('./custom_modules/redBoxClient.js');
var moviedbClient= require('./custom_modules/movieDBClient.js');
var imdbClient=require('./custom_modules/imdbClient.js');
var fs = require('./custom_modules/fileSystemClient.js');
var googleAuthClient=require('./custom_modules/googleAuthClient.js').configureApp(app);


var https = require('https');
var server = https.createServer({
	key: fs.readFileSync(config.cert.certPemPath),
	cert: fs.readFileSync(config.cert.certFullChain)
},app);
server.listen(config.portListener);

var io = require('socket.io').listen(server);

io.on('connection', function(socket){
	console.log('user connected')
	socket.on('torrentSearch', function(msg){
		torrentSearch.searchTorrents(socket,msg);
	});
});

app.use('/', express.static(path.join(__dirname, 'public')));

app.get('/getMyMDBIDs', function (req, res, next) {
	fs.readFileCreateIfNotExist(config.MDBToPlexIDPath,function(data){
		res.send(JSON.stringify(Object.keys(data)));
	});
});

app.get('/getMDBApiKey',function(req,res,next){
	res.send(config.mdbApiKey);
})

app.get('/downloadMovie', function (req, res, next) {
	torrentClient.downloadTorrent(req,function(result){
		res.send(result);
	})
});

app.get('/downloading', function (req, res, next) {
	var downloadingList=[];
	fs.getDownloadingList(function(downloadingData){
		torrentClient.getTorrentData(function(torrentData){ 
			for(var id in downloadingData){
				torrentHash=downloadingData[id]['torrentHash'].toLowerCase();
				if(torrentData[torrentHash]){
					downloadingList.push({'id':id,'hash':torrentHash,'status':(torrentData[torrentHash].progress)});
				}
			}
			
			res.send(JSON.stringify(downloadingList));
		});
	});
});

app.get('/cancelMovie', function (req, res, next) {
	var movieHash = req.query.hash;
	var movieID = req.query.id;
	console.log("Cancelling "+movieHash+" id " + movieID);
	torrentClient.cancelTorrent(movieHash,function(data){
		fs.getDownloadingList(function(downloadingData){
			delete downloadingData[movieID];
			var json=JSON.stringify(downloadingData);
			fs.writeFile(config.downloadingMoviesPath, json, function(err) {
				console.log("Movie cancelled!"+movieID);
				res.send("OK");
			}); 
			
		});
		console.log("deleted from torrent");
	});
});

app.get('/searchMovieYear',function(req,res,next){
	console.log("Searching Movie Year");
	imdbClient.searchIMDBYear(req.query.imdbID,function(result){
		res.send(result)
	});
});

app.get('/getRedBox', function (req, res, next) {
	console.log("retrieving redbox list");
	redBoxClient.getRedBoxData(function(redBoxData){
		res.send(JSON.stringify(redBoxData));

	})
});

app.get('/getMovieDB', function (req, res, next) {
	console.log("retrieving moviedb list");
	moviedbClient.getPopularMovies(function(movieDBData){
		res.send(JSON.stringify(movieDBData));
	});
	

});

function updatePlexInterval(interval){
	plexClient.updatePlexMDBMapping(function(){
		setTimeout(function(){ 
			updatePlexInterval(interval);
		}, interval);
	});
}

setInterval(function(){ 
	torrentClient.cleanUp(function(){
		
	});
}, 30000);

updatePlexInterval(20000);

torrentClient.cleanUp(function(){
	
});
