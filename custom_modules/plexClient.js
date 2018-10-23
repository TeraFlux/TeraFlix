var config=require("../config.js")
var fetch = require('fetch-cookie')(require('node-fetch'));
const parseString = require('xml2js-parser').parseString;
var plexToken=undefined;
var fs = require('./fileSystemClient.js');

function getMDBFromPlexID(key,cb){
	plexWebRequest("/library/metadata/"+key,function(xmlMovie){
		var displayName=xmlMovie.MediaContainer.Video[0]['$'].title + " ("+xmlMovie.MediaContainer.Video[0]['$'].year+")";
		var mdbID=xmlMovie.MediaContainer.Video[0]['$'].guid.match("://([0-9]*)?")[1];
		cb({"mdbID":mdbID,"displayName":displayName});
	});
}

function updatePlexMDBMapping(cb){
	//console.log("updating cache");
	plexWebRequest("/library/sections/2/all",function(xmlMovies){
		var plexMovies=xmlMovies.MediaContainer.Video;
		fs.readFileCreateIfNotExist(config.MDBToPlexIDPath,function(MDBToPlexIDMapping){
			var missingPlexIDs=[];
			var allPlexMovieIDs=[];
			var deletedMovie=false;
			//Create mapping of movies from plex library
			for(var i=0;i<plexMovies.length;i++){
				var plexID=plexMovies[i]['$'].ratingKey;
				//if mdb id doesn't exist in mapping file, add to list to be cached
				if(Object.values(MDBToPlexIDMapping).indexOf(plexID)===-1){
					missingPlexIDs.push(plexID);
				}
				allPlexMovieIDs.push(plexID);
			}
			//find movies cached that are no longer in library
			//console.log(allPlexMovieIDs.length);
			//console.log(Object.keys(MDBToPlexIDMapping).length);
			
			for(var mdbID in MDBToPlexIDMapping){
				var plexIDInFile=MDBToPlexIDMapping[mdbID];
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
					getMDBFromPlexID(pID,function(mdbResult){
						console.log("adding missing ID: "+mdbResult['mdbID']+" - "+pID+" - "+ mdbResult['displayName']);
						collectedMDBIDs[mdbResult['mdbID']]=pID;
						var ouput=missingPlexIDs.splice(missingPlexIDs.length-1,1);
						//callback to synchronously process, with a timeout to avoid overloading
						setTimeout(function(){ 
							cacheMissingIDs(missingPlexIDs,collectedMDBIDs,cb); 
						}, 300);
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
						cb();
					});
				});
			}else{
				//console.log("no work to do.");
				cb();
			}
		});
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
	});
}

module.exports.plexWebRequest=plexWebRequest;
module.exports.updatePlexMDBMapping=updatePlexMDBMapping;