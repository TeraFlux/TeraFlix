var config=require("../config.js")
var fetch = require('fetch-cookie')(require('node-fetch'));
const parseString = require('xml2js-parser').parseString;
var bodyParser = require('body-parser');
var plexToken=undefined;
var fs = require('./fileSystemClient.js');
var cacheInProgress=false;

function getMDBFromPlexID(key,cb){
	plexWebRequest("/library/metadata/"+key,function(xmlMovie){
		var guidString=xmlMovie.MediaContainer.Video[0]['$'].guid;
		cb(guidString.match("://([0-9]*)?")[1],key);
	});
}

function updatePlexMDBMapping(){
	plexWebRequest("/library/sections/2/all",function(xmlMovies){
		var plexMovies=xmlMovies.MediaContainer.Video;
		fs.readFileCreateIfNotExist(config.MDBToPlexIDPath,function(MDBToPlexIDMapping){		
			var missingPlexIDs=[];
			var allPlexMovieIDs=[];
			var deletedMovie=false;
			for(var i=0;i<plexMovies.length;i++){
				var plexID=plexMovies[i]['$'].ratingKey;
				//if mdb id doesn't exist in mapping file:
				if(Object.values(MDBToPlexIDMapping).indexOf(plexID)===-1){
					missingPlexIDs.push(plexID);
				}
				allPlexMovieIDs.push(plexID);
			}
			//remove deleted items from cache
			for(var mdbID in MDBToPlexIDMapping){
				var plexIDInFile=MDBToPlexIDMapping[mdbID]
				if(allPlexMovieIDs.indexOf(plexIDInFile)===-1){
					console.log("deleting "+mdbID);
					deletedMovie=true;
					delete MDBToPlexIDMapping[mdbID];
				}
			}
			function cacheMissingIDs(missingPlexIDs,collectedMDBIDs,cb){	
				if(missingPlexIDs.length===0){
					cb(collectedMDBIDs);
				}else{
					
					var pID=missingPlexIDs[missingPlexIDs.length-1];
					getMDBFromPlexID(pID,function(mdbID){
						//console.log("adding missing ID"+mdbID+" "+pID);
						collectedMDBIDs[mdbID]=pID;
						missingPlexIDs.splice(missingPlexIDs.length-1,1)
						cacheMissingIDs(missingPlexIDs,collectedMDBIDs,cb)
					});
				}
			}
			
			if(missingPlexIDs.length>0 || deletedMovie===true){
				//cache missing movie ids
				var collectedMDBIDs={};
				deletedMovie=false;
				console.log(missingPlexIDs);
				cacheMissingIDs(missingPlexIDs,collectedMDBIDs,function(retrievedMDBIDs){
					console.log("finished");
					//console.log(retrievedMDBIDs);
					for(var mdbID in retrievedMDBIDs){
						//map the new mdb id's to plexids
						MDBToPlexIDMapping[mdbID]=retrievedMDBIDs[mdbID];
					}
					fs.writeFile(config.MDBToPlexIDPath, JSON.stringify(MDBToPlexIDMapping), function(err) {
						console.log("flushed to disk.");
					});
				});
			}
		});
	});
}

function cacheAllMDBIDsToDisk(cb){
	cacheInProgress=true;
	function cacheMDBData(xmlMovies){
		console.log("Caching Full PlexID to MDBID to disk");
		function finishedProcessing(){
				fs.writeFile(config.MDBToPlexIDPath, JSON.stringify(asyncResult), function(err) {
				cacheInProgress=false;
				clearTimeout(timer);
				cb();
			});
		}
		
		var movies=xmlMovies.MediaContainer.Video;
		var asyncResult={};
		var timer=setTimeout(function(){ 
			console.log("Timed out. Caching current results to disk");
			finishedProcessing();
			
		}, 30000);
		
		for(var i=0;i<movies.length;i++){
			var pID=movies[i]['$'].ratingKey;
			getMDBFromPlexID(pID,function(mdbID,response){
				asyncResult[mdbID]=response;
				
				if(isNaN(mdbID)){
					console.log(mdbID);
				}
				//console.log("Processing :"+Object.keys(asyncResult).length+ "/" +movies.length);
				if(Object.keys(asyncResult).length===movies.length-1){
					console.log("full cache successful!");
					finishedProcessing();
				}
			});
		}
	}
	
	plexWebRequest("/library/sections/2/all",function(result){
		cacheMDBData(result);
	});
}

function plexCall(uri,cb){
	fetch(config.plex.personalPlexURL+uri+"?X-Plex-Token="+plexToken).then(function(res) {
		return res.text();
	}).then(function(body){
		parseString(body, (err, result) => {
			cb(result);
		});
	}).catch(function(err){
		console.log("Plex Web Request Call Fail.")
		console.log(err);
		
		if(err.code.toString().includes("ENOBUFS")){
			process.exit();
		}
		if(err.code.toString().includes("EADDRINUSE")){
			process.exit();
		}
	});
}

function plexWebRequest(uri,cb){
	if(plexToken===undefined){
		getPlexToken(function(){
			plexCall(uri,function(result){
				cb(result);
			});
		});
	}else{
		plexCall(uri,function(result){
			cb(result);
		});
	}
}
function getPlexToken(cb){
	fetch(config.plex.plexTvURL, {
	credentials: 'include',
	headers: {'Authorization': 'Basic '+config.plexAuthBase64(),
		"X-Plex-Client-Identifier":"TESTSCRIPTV1",
		"X-Plex-Product":"Test script",
		"X-Plex-Version":"V1"},
	method: "POST",
	timeout: 20000, 
	}).then(function(res) {
		return res.text();
	}).then(function(xmlBody) {
		parseString(xmlBody, (err, result) => {
			plexToken=result.user['authentication-token'][0];
			cb();
		});
	}).catch(function(err){
		console.log("Plex Token Call Fail.")
		console.log(err.code);
		
		if(err.code.toString().includes("ENOBUFS")){
			process.exit();
		}
		if(err.code.toString().includes("EADDRINUSE")){
			process.exit();
		}
	});
}

module.exports.plexWebRequest=plexWebRequest;
module.exports.cacheAllMDBIDsToDisk=cacheAllMDBIDsToDisk;
module.exports.updatePlexMDBMapping=updatePlexMDBMapping;