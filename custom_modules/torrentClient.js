var config=require("../config.js")
var fetch = require('fetch-cookie')(require('node-fetch'));
var fs=require('./fileSystemClient.js');

function getTorrentData(cb){
	var uri=config.qbittorrent.host+"/api/v2/torrents/info";
	fetch(uri).then(function(res) {
		return res.text();
	}).then(function(body){
		var torrentData=JSON.parse(body);
		var results={};
		for(var i=0;i<torrentData.length;i++){
			results[torrentData[i].hash.toLowerCase()]={
				"progress":torrentData[i].progress,
				"name":torrentData[i].name
			};
		}
		cb(results);
	});
}

function downloadMagnet(magnet,cb){
	var uri=config.qbittorrent.host+"/api/v2/torrents/add";
	fetch(uri,
		{
			headers: {
				"Content-Type":"application/x-www-form-urlencoded"
			},
			method:"post",
			body:"urls="+magnet
		}
	).then(function(res) {
		return res.text();
	}).then(function(body){
		cb(body);
	});
	
}

function cancelTorrent(hash,cb,data){
	var uri=config.qbittorrent.host+"/api/v2/torrents/delete";
	fetch(uri,
		{
			headers: {
				"Content-Type":"application/x-www-form-urlencoded"
			},
			method:"post",
			body:"hashes="+hash+"&deleteFiles=false"
		}
	).then(function(res) {
		return res.text();
	}).then(function(){
		cb(data);
	}).catch(function(err){
		console.log(err);
	});
	
}

function downloadTorrent(req,cb){
	
	function parseTorrentNameFromMagnet(mg){
		return decodeURIComponent(mg.toString().match(/&dn=(.*?)&tr=/)[1].replace(/\.|\+/g," "));
	}
	
	function parseHash(magnetURI){
		return (magnetURI.substring(magnetURI.indexOf("btih:")+5,magnetURI.indexOf("&dn=")));
	}
	
	function checkAndDownload(movieName,movieYear,movieID,magnet,cb){
		var hash=parseHash(magnet);
		fs.getDownloadingList(function(downloadingData){
			var downloading=downloadingData;
			if(downloading[movieID]){
				console.log("Movie ("+movieID+") Already being downloading");
				cb("Movie ("+movieID+") Already Downloading.");
				return;
			}
			downloadMagnet(magnet,function(){
				console.log("Download Started: ");
				var sanitizedMovieName=movieName.replace(/[/\\?%*:|"<>]/g,"");
				console.log('torrentHash: '+hash+ ' folderName: '+ sanitizedMovieName + ' ('+movieYear+')');
				downloading[movieID]={'torrentHash':hash,'folderName':sanitizedMovieName + ' ('+movieYear+')'};
				var json=JSON.stringify(downloading);
				fs.writeFile(config.downloadingMoviesPath, json, function(err) {
					if(err) {
						return console.log(err);
					}
					cb(parseTorrentNameFromMagnet(magnet)+" now downloading!");
					console.log("The file was saved!");	
				}); 
			})
		});
	}
	
	var magnet = decodeURIComponent(req.query.magnet);
	var movieID = req.query.id;
	var movieName = decodeURIComponent(req.query.movieName).replace(":","");
	movieName=movieName.replace("'","");
	console.log(movieName);
	var movieYear = req.query.movieYear;
	checkAndDownload(movieName,movieYear,movieID,magnet,function(data){
		cb(data);
	});
}

function moveFiles(fromPath,toName,cb){
	
	function moveVideoFile(videoFilePath,complete){
		var videoExtension=videoFilePath.split('.').pop();
		var newFileName=toName+"."+videoExtension;
		var destinationPath=config.moviesDirectory+"\\"+toName+"\\"+newFileName;
		console.log("FROM: "+ videoFilePath);		
		console.log("TO: "+destinationPath);
		fs.createDirIfNotExist(config.moviesDirectory+"\\"+toName);
		fs.moveFile(videoFilePath,destinationPath,function(err){
			if(err){
				console.log(err);
			}else{
				console.log("File Move Complete.")
			}
			complete();
		});
	}
	
	fs.checkIfDirectory(fromPath,function(response){
		if(response){
			fs.listFiles(fromPath, function(err, items) {
				var largestFile=0;
				var videoFile=undefined;
				//Get largest item AKA video file
				for (var i=0; i<items.length; i++) {
					var videoPath=fromPath+"\\"+items[i];
					var stats = fs.statSync(videoPath);
					var fileSizeInBytes = stats["size"];
					if(fileSizeInBytes > largestFile){
						largestFile=fileSizeInBytes;
						videoFile=videoPath;
					}
				}
				if(videoFile!==undefined){
					moveVideoFile(videoFile,function(){
						//Clean up old folder 
						fs.removeDirectory(fromPath,function(){
							console.log("Cleanup Complete.");
							cb()
						});		
					});
				}else{
					console.log("video file not found");
					cb();
				}
			});
		}else{
			moveVideoFile(fromPath,function(){
				//no cleanup logic necessary for single file
				console.log("Cleanup Complete.");
				cb();
			});
		}
	});

}

function cleanUp(complete){
	getTorrentData(function(torrentDownloads){
		fs.getDownloadingList(function(downloadingData){
			for(var torrentHash in torrentDownloads){
				var torrentData=torrentDownloads[torrentHash];
				//COMPLETED TORRENTS:
				if(torrentData.progress===1){
					for(var movieID in downloadingData){
						var downloadingHash=downloadingData[movieID].torrentHash;
						var folderName=downloadingData[movieID].folderName;
						if(downloadingHash.toLowerCase()===torrentHash){
							//TORRENT NAME=FOLDERNAME
							//Download Directory 
							console.log(torrentData.name + " Complete! Starting Copy to Movies Directory");
							var fromName=config.downloadDirectory+"\\"+torrentData.name;
							cancelTorrent(torrentHash,function(){
								moveFiles(fromName,folderName,function(){
									//Update actively downloading disk status
									delete downloadingData[movieID];
									var json=JSON.stringify(downloadingData);
									fs.writeFile(config.downloadingMoviesPath, json, function(err) {
										if(err) {
											return console.log(err);
										}
										complete();
									}); 
									
								});
							});
							break; //once hash is found, end looping
						}
					}
					break; //only process one completed movie at a time
				}
			}
		});
	});
}

module.exports.cancelTorrent=cancelTorrent;
module.exports.cleanUp=cleanUp;
module.exports.getTorrentData=getTorrentData;
module.exports.downloadTorrent=downloadTorrent;