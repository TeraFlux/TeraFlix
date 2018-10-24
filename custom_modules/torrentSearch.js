module.exports.searchTorrents=function (socket,msg){
	findTorrents(socket,msg);
};
var config=require('../config.js');
const fetch=require("node-fetch");
const parseString = require('xml2js-parser').parseString;
var _magnet = require('magnet-uri');
var limit=100;
function formatBytes(a,b){if(0==a)return"0 Bytes";var c=1024,d=b||2,e=["Bytes","KB","MB","GB","TB","PB","EB","ZB","YB"],f=Math.floor(Math.log(a)/Math.log(c));return parseFloat((a/Math.pow(c,f)).toFixed(d))+" "+e[f]}

function findTorrents(socket,msg){
	
	function getSeedsForMagnet(magnet,size,cb){
		var torrentClient = require('./bittorrent-tracker-proxy');
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
				  timeout: 4000
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
			cb({"magnet":magnet,"seeds":highestSeed,"size":size});
		}, 12000);
	}
	
	if(msg.includes("FindMovie---")){
		var movieDetails=JSON.parse(msg.split("---")[1]);
		var movieID = movieDetails.id;
		var movieSearch = movieDetails.movieSearch.toString().replace(/[\:\(\)\']/gm,"");
		var movieSearchTerm = movieSearch.replace(/-/gm," ");
		var movieSearchTerm = movieSearchTerm.replace(/&/gm,"and");
		
		console.log(movieSearchTerm);
		
		var magnetDupes=[];
		var uri=config.jackett.uri+"/api/v2.0/indexers/all/results/torznab/?apikey="+config.jackett.apikey+"&t=search&limit="+limit+"&cat=2000,2040&q="+encodeURIComponent(movieSearchTerm);
		fetch(uri).then(function(res) {
			return res.text();
		}).then(function(body){
			
			parseString(body, (err, result) => {				
				var items=result.rss.channel[0].item;
				var realResultCount=0
				if(items!==undefined){
					
					for(var i=0;i<items.length;i++){
						var torResult=items[i];
						var magnetURL=undefined;
						var attributes=items[i]['torznab:attr'];
						for(var attr in attributes){
							if(attributes[attr]['$'].name === "magneturl"){
								magnetURL=attributes[attr]['$'].value;
								break;
							}
						}
						if(magnetURL===undefined){continue}
						//don't search duplicate magnets for seeders
						realResultCount++;
						var torrentHash = _magnet(magnetURL).infoHash;
						//console.log(torrentHash);
						if(!magnetDupes.includes(torrentHash)){
							magnetDupes.push(torrentHash);	
							getSeedsForMagnet(magnetURL,formatBytes(torResult.size[0]),function(seedResults){
								socket.emit("torrentSearch",JSON.stringify(seedResults));
							});
						}	

					}
					socket.emit("torrentIndex",realResultCount);
				}else{
					console.log("no results found");
					socket.emit("torrentSearch","fail");
				}
			});
		}).catch(function(err){
			console.log("Failed Jackett API Call.")
			console.log(err);
			socket.emit("torrentSearch","fail");
		});
			
		
	}
}
