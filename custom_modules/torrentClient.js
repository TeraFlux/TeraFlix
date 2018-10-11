var config=require("../config.js")
var fetch = require('fetch-cookie')(require('node-fetch'));
var fs=require('./fileSystemClient.js');

function torrentCall(uri,cb){
	getTorrentToken(function(token){
		var url=config.utorrent.utorrentURI+"/gui/?token="+token+"&"+uri;
		fetch(url, {
			credentials: 'include',
			headers: {'Authorization': 'basic '+config.torrentAuthBase64()+''}
		}).then(function(res) {
			return res.text();
		}).then(function(body){
			cb(JSON.parse(body));
		}).catch(function(err){
			console.log("Torrent Call Fail");
			console.log(err);
			
			if(err.code.toString().includes("ENOBUFS")){
				process.exit();
			}
			if(err.code.toString().includes("EADDRINUSE")){
				process.exit();
			}
			console.log(err);
		});
	});
}

function getTorrentToken(callback){
	fetch(config.utorrent.utorrentURI+"/gui/token.html", {
		credentials: 'include',
		headers: {'Authorization': 'basic '+config.torrentAuthBase64()+''}
	}).then(function(res) {
		return res.text();
	}).then(function(body) {
		var cheerio = require('cheerio'),$ = cheerio.load(body);
		var token=$("#token")[0].children[0].data;
		callback(token);
	}).catch(function(err){
		console.log("Torrent Call Fail");
		console.log(err);
		
		if(err.code.toString().includes("ENOBUFS")){
			process.exit();
		}
		if(err.code.toString().includes("EADDRINUSE")){
			process.exit();
		}
		console.log("Torrent Token Call Fail.")
		console.log(err)}
	);
}

function cancelTorrent(movieHash,cb){
	//console.log("Cancel Torrent.")
	var url="action=removedatatorrent&hash="+movieHash+"&list=1&cid=702830465&getmsg=1";
	torrentCall(url,function(data){
		cb(data);
	});
}

function getTorrentData(cb){
	//console.log("Get Torrent data")
	torrentCall('list=1&cid=0&getmsg=1',function(data){
		cb(data);
	})
}

function downloadTorrent(req,cb){
	
	function parseTorrentNameFromMagnet(mg){
		return decodeURIComponent(mg.toString().match(/&dn=(.*?)&tr=/)[1].replace(/\.|\+/g," "));
	}
	function downloadTorrent(movieName,movieYear,movieID,magnet,cb){
		var hash=parseHash(magnet);
		fs.getDownloadingList(function(downloadingData){
			var downloading=downloadingData;
			if(downloading[movieID]){
				console.log("Movie ("+movieID+") Already being downloading");
				cb("Movie ("+movieID+") Already Downloading.");
				return;
			}
			var url="action=add-url&s="+magnet;
			torrentCall(url, function(data){
				console.log("Contents:");
				downloading[movieID]={'torrentHash':hash,'folderName':movieName + " ("+movieYear+")"};
				console.log(downloading);
				var json=JSON.stringify(downloading);
				fs.writeFile(config.downloadingMoviesPath, json, function(err) {
					if(err) {
						return console.log(err);
					}
					cb(parseTorrentNameFromMagnet(magnet)+" now downloading!");
					console.log("The file was saved!");	
				}); 
			});
		});
	}
	
	function parseHash(magnetURI){
		return (magnetURI.substring(magnetURI.indexOf("btih:")+5,magnetURI.indexOf("&dn=")));
	}
	
	var magnet = decodeURIComponent(req.query.magnet);
	var movieID = req.query.id;
	var movieName = decodeURIComponent(req.query.movieName).replace(":","");
	movieName=movieName.replace("'","");
	console.log(movieName);
	var movieYear = req.query.movieYear;
	downloadTorrent(movieName,movieYear,movieID,magnet,function(data){
		cb(data);
	});
}

module.exports.torrentCall=torrentCall;
module.exports.cancelTorrent=cancelTorrent;
module.exports.getTorrentData=getTorrentData;
module.exports.downloadTorrent=downloadTorrent;