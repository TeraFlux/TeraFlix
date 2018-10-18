module.exports.searchTorrents=function (socket,msg){
	findTorrents(socket,msg);
};
var fetch = require('fetch-cookie')(require('node-fetch'));
var torrMEURL="https://www.torrentdownloads.me/";
var limtTorrentsURL="https://www.limetorrents.info/";
var rarBGURL="https://rarbg.to/";
var config=require('../config.js');

function ezFetch(url,cb,extra){
	function retryOnce(){
		fetch(encodedURL, {
		method: "GET",
		timeout: 3000, 
		}).then(function(res) {
			return res.text();
		}).then(function(body) {
			cb(body,extra);
		}).catch(function(err){
			//console.log(err);
			console.log("Fetch Torrent Site Call Fail. "+encodedURL);
			console.log(err.message);
		});
	}
	
	var encodedURL=encodeURI(url);
	fetch(encodedURL, {
	method: "GET",
	timeout: 3000, 
	}).then(function(res) {
		return res.text();
	}).then(function(body) {
		cb(body,extra);
	}).catch(function(err){
		if(err.message.includes("timeout")){
			retryOnce()
		}else{
		//console.log(err);
			console.log("Fetch Torrent Site Call Fail. "+encodedURL);
			console.log(err.message);
		}
	});
	
}

function findTorrents(socket,msg){
	
	function getSeedsForMagnet(magnet,size,cb){
		var torrentClient = require('./bittorrent-tracker-proxy');
		var _magnet = require('magnet-uri');
		var parsedTorrent = _magnet(magnet.toString());
		var options = {
		  infoHash: parsedTorrent.infoHash,
		  announce: parsedTorrent.announce,
		  peerId: new Buffer('01234567890123456789'),
		  port: 6881, 
		  proxyOpts: {
			  socksProxy: {
				  proxy: {
					  ipaddress: config.socks5.socks5URL,
					  port: 1080,
					  type: 5,
					  authentication: {
						  username: config.socks5.socks5Username,
						  password: config.socks5.socks5Password
					  }
				  },
				  timeout: 10000
			  },
		  }
		}
		var client = new torrentClient(options);
		var highestSeed=0;
		client.scrape();

		client.on('scrape', function (data) {
			if(data.complete > highestSeed){
				highestSeed=data.complete;
			}
		});
		
		setTimeout(function(){	
			client.destroy();
			cb({"magnet":magnet,"seeds":highestSeed,"size":size.replace("&nbsp;"," ")});
		}, 10000);
	}

	function matchRegex(data,regex,count,cb){
		let m;
		var arr=[];
		var counter=0
		while ((m = regex.exec(data)) !== null) {
			if (m.index === regex.lastIndex) {
				regex.lastIndex++;
			}
			m.forEach((match, groupIndex) => {
				if(groupIndex===1){
					if(counter<count){
						arr.push(match);
					}else{
						return arr;
					}
					counter++;
				}
			});
		}
		return arr;
	}

	function retrieveTorrents(baseUrl,search,scrapeMagnets,scrapeSize,socket){
		ezFetch(baseUrl+search,function(body){
			var magnetList=matchRegex(body,scrapeMagnets,20);
			var sizeList=matchRegex(body,scrapeSize,20);
			console.log(baseUrl);
			console.log(magnetList.length);
			for(var i in magnetList){
				var magnet=magnetList[i].replace("//","/");
				if(magnet.startsWith("/")){
					magnet=magnet.substring(1);
				}
				ezFetch((baseUrl+magnet),function(data,size){
					var regex=/(magnet:.*?)\"/g;
					var magnet=matchRegex(data,regex,1);
					if(magnet.length===0){
						console.log(data);
					}
					getSeedsForMagnet(magnet,size,function(result){
						if(size!==undefined){
							socket.emit("torrentSearch",JSON.stringify(result));
						}
					});
				},sizeList[i]);
			}
		})
	}

	function searchTPB(TPBURI){
		ezFetch(TPBURI,function(body){
			var scrapeMagnets=/(magnet:\?.*?)\"/g;
			var scrapeSize=/, Size ([0-9.]*&nbsp;[GMBi]*)/g;
			var magnetList=matchRegex(body,scrapeMagnets,20);
			var sizeList=matchRegex(body,scrapeSize,20);
			console.log(TPBURI);
			console.log(magnetList.length);
			for(var i in magnetList){
				var magnet=magnetList[i].replace("//","/");
				var size=sizeList[i];
				getSeedsForMagnet(magnet,size,function(result){
					if(size!==undefined){
						socket.emit("torrentSearch",JSON.stringify(result));
					}
				});
			}
		});
	}
	
	if(msg.includes("FindMovie---")){
		var movieDetails=JSON.parse(msg.split("---")[1]);
		var movieID = movieDetails.id;
		var movieSearch = movieDetails.movieSearch.toString().replace(/[\:\(\)\']/gm,"");
		var movieSearchTerm = movieSearch.replace(/-/gm," ");
		console.log(movieSearchTerm);
		
		retrieveTorrents(torrMEURL,"search/?s_cat=4&search="+movieSearchTerm,
			/<a href=\"\/(torrent\/[0-9]{10}.*?)\"/g,
			/<span>[0-9]*<\/span><span>[0-9]*<\/span><span>([0-9.]*&nbsp;[A-Z]*)<\/span><a class=\"cloud\" rel=\"nofollow\" href=\"\/torrent\/[0-9]{10}/g,
			socket);
		retrieveTorrents(limtTorrentsURL,"search/movies/"+encodeURIComponent(movieSearchTerm)+"/seeds/1/",
			/><\/a><a href=\"(\/.*?)\"/g,
			/([0-9\.]* [A-Z]*)<\/td><td class="tdseed">[0-9,]*<\/td>/g,
			socket);
		retrieveTorrents(rarBGURL,"torrents.php?category=14;48;17;44;45;42;46&search="+movieSearchTerm+"&order=seeders&by=DESC",
			/href="(\/torrent\/[a-z0-9]*)\" title/g,
			/100px" class="lista">([0-9\., GBbM]*)<\/td>/g,
			socket);
		
			
		searchTPB("https://thepiratebay3.org/index.php?q="+encodeURIComponent(movieSearchTerm)+"&category=207&page=0&orderby=99");
		searchTPB("https://www.thepiratebay.se.net/search/"+encodeURIComponent(movieSearchTerm));
	}
}
