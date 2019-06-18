var redboxURL="https://www.redbox.com/rbweb/api/product/js/_dtitles7"; 

var fetch = require('fetch-cookie')(require('node-fetch'));

function parseRedbox(redBoxData){
	redboxTitles=JSON.parse(redBoxData);
	function compare(a,b) {
		return a.sortReleaseDays - b.sortReleaseDays;
	}
	redboxTitles.sort(compare);
	var newTitles=[];
	for(i=0;i<redboxTitles.length && i<500;i++){
		
		var movieName=redboxTitles[i].name.replace(/-/g, ' ');
		var productType=redboxTitles[i].productType;
		var seasonRegex=/season [0-9]/gm;
		var bluRayMatch=/blu ray/gm;
		var digitalCodeMatch=/ digitalcode/gm;
		if(
			newTitles.indexOf(movieName) === -1 && 
			productType===1 && 
			redboxTitles[i].soon!==1 &&
			!(movieName.match(seasonRegex)) &&
			!(movieName.match(bluRayMatch)) &&
			!(movieName.match(digitalCodeMatch))
		){
			newTitles.push(movieName);
		}
	}
	//Sorted list of redbox titles:
	return newTitles;
}

function getRedBoxData(cb){
	fetch(redboxURL, {
		method: "GET",
		timeout: 10000, 
	}).then(function(res) {
		return res.text();
	}).then(function(body) {
		cb(JSON.stringify(parseRedbox(body)));
	}).catch(function(err){
		console.log("redbox fetch error")
		console.log(err);
	});
}

module.exports.getRedBoxData=getRedBoxData;
