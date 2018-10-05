const express = require('express');
var app = express();

var path = require('path');

var config=require("./config.js");
var torrentSearch=require('./custom_modules/torrentSearch.js');
var torrentClient=require('./custom_modules/torrentClient.js');
var plexClient=require('./custom_modules/plexClient.js');
var redBoxClient=require('./custom_modules/redBoxClient.js');
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
			var torrents=torrentData.torrents;
			for(var i=0;i<torrents.length;i++){
				var torrentHash=torrents[i][0].toLowerCase();
				for(var id in downloadingData){
					if(downloadingData[id]['torrentHash'].toLowerCase()===torrentHash){
						downloadingList.push({'id':id,'hash':torrentHash,'status':torrents[i][21]});
					}
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
	})
	
});

app.get('/getRedBox', function (req, res, next) {
	console.log("retrieving redbox list");
	redBoxClient.getRedBoxData(function(result){
		res.send(result);
	})
});

plexClient.cacheAllMDBIDsToDisk(function(){
	setInterval(function(){
		plexClient.updatePlexMDBMapping();
	},15000);
});
