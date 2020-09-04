var movieDBURL="https://api.themoviedb.org/3"; 
var config=require("../config.js");
config.mdbApiKey;
var fetch = require('fetch-cookie')(require('node-fetch'));
var maxPages=10;


function addMovieNamesToList(movieList,result){
	
	movies=JSON.parse(result).results
	for(var i=0;i<movies.length;i++){
		var movie=movies[i];
		movieTitle=movie.title.replace(/-/g, ' ');
		movieList.push(movieTitle);
	}
	return movieList;
}

function getPopularMovies(done){
	var movieList=[];
	var popularURL=movieDBURL+"/movie/popular?";
	
	function getPopularSet(page,callback){
		if(page<maxPages){
			getMovieDB(popularURL+"page="+page,function(result){
				movieList=addMovieNamesToList(movieList,result);
				page++;
				getPopularSet(page,callback);
			});
		}else{
			callback(movieList);
		}
	}
	
	getPopularSet(1,function(){
		done(movieList);
	});
	
}

function getMovieDB(url,cb){
	url=url+"&api_key="+config.mdbApiKey+"&language=en";
	console.log(url);
	fetch(url, {
		method: "GET",
		timeout: 10000, 
	}).then(function(res) {
		return res.text();
	}).then(function(body) {
		cb(body);
	}).catch(function(err){
		console.log("movie DB fetch error")
		console.log(err);
	});
}

module.exports.getPopularMovies=getPopularMovies;
