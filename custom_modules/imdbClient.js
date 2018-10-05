var fetch = require('fetch-cookie')(require('node-fetch'));

function searchIMDBYear(imdbID,cb){
	fetch("https://www.imdb.com/title/"+imdbID+"/", {
		credentials: 'include'
	}).then(function(res) {
		return res.text();
	}).then(function(body) {
		cb(/\"titleYear\">\(<a href="\/year\/([0-9]{4})/gm.exec(body)[1]);
	}).catch(function(err){
		console.log("Search IMDB Movie Year Fail.")
		console.log(err.code);
		res.send("fail");
		if(err.code.toString().includes("ENOBUFS")){
			process.exit();
		}
		if(err.code.toString().includes("EADDRINUSE")){
			process.exit();
		}
	});
}

module.exports.searchIMDBYear=searchIMDBYear;