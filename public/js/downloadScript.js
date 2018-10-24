var filteredResults=[];
var downloadResults={};
var currentlyDownloading=[];
var alreadyHaveMovies=[];
var searchedMovies=[];
var myPlexIDs=[];
var redBoxData=[];
var redBoxPosition=0;
var socket;
var torrentResults=[];
var MovieData;
const IMGCDNPATH="http://cf2.imgobject.com/t/p/w342";
var redBoxDisplayCount=10;
var mdbAPIKey=undefined;

function sortSeeds(){
	var table=$("#torrentTable");
	var rows = table.find('tr:gt(0)').toArray().sort(comparer(1))
	rows.reverse();
	for (var i = 0; i < rows.length; i++){table.append(rows[i])}
	
	function comparer(index) {
		return function(a, b) {
			var valA = getCellValue(a, index), valB = getCellValue(b, index)
			return $.isNumeric(valA) && $.isNumeric(valB) ? valA - valB : valA.toString().localeCompare(valB)
		}
	}
	function getCellValue(row, index){ return $(row).children('td').eq(index).text() }
}


function findMovieById(id){
	for(var i=0;i<filteredResults.length;i++){
		if(filteredResults[i].id===id){
			return filteredResults[i];
		}
	}
	for(key in downloadResults){
		if(downloadResults[key][1].id===id){
			return downloadResults[key][1];
		}
	}
}


function cancelMovie(movieID){
	var movieData=downloadResults[movieID][0];
	//$(".loader").show();
	$.get( '/cancelMovie?hash='+movieData.hash+"&id="+movieData.id, function( data ) {
		delete downloadResults[movieID];
		getDownloadingStatus();
	});
}

function populateDownloading(){
	var movieDownloadDiv=$("#moviesDownloading");
	var resultsString="";
	for(var key in downloadResults){
		var percentComplete=Math.floor(downloadResults[key][0].status * 100);
		var results=downloadResults[key][1];
		var loadingWidth=0;

		var movieTitleDisplay=results.title + " ("+(results.release_date.substring(0,4))+")";
		resultsString+="<div class=\"downloadingWrapper\"><div style=background-image:url(\""
		+IMGCDNPATH+results.poster_path+"\") class=\"downloadingThumb\" data-name="+results.id+
		"><span class=\"movieTitle\">"+movieTitleDisplay+"</span><div style=\"width:"+percentComplete+"%\" class=\"loadingBar\"></div><div class=\"movieDBButton\">&#10068;</div><div class=\"cancelMovie\">Cancel Download</div></div><div class=\"downloadingStatus\">"
		+percentComplete+"%</div></div>";
	}
	movieDownloadDiv.html(resultsString);
	//$(".loader").hide();
	applyClickFunctions();
}

function searchMovieById(position,downloadDetails){
	if(downloadDetails.length===0){
		$("#moviesDownloading").html("No Movies Currently Downloading");
		//$(".loader").hide();
	}else if(downloadResults[downloadDetails[position].id]===undefined){
		//This goes insane if you don't rate limit
		var url="https://api.themoviedb.org/3/movie/"+downloadDetails[position].id+"?api_key="+mdbAPIKey+"&language=en";
		$.ajax({
			url: url,
			dataType: "jsonp",
			success: function( response ) {
				downloadResults[downloadDetails[position].id]=[downloadDetails[position],response];
				if(position+1 < downloadDetails.length){
					//throttle calls by spacing them out by 800ms
					setTimeout(function(){ 
						populateDownloading();
						searchMovieById((position+1),downloadDetails); 
					}, 500);
				}else{
					populateDownloading();
				}
			}
		});
	}else{
		if(position+1 < downloadDetails.length){
			searchMovieById((position+1),downloadDetails);
		}else{
			var downloadItem=downloadResults[downloadDetails[position].id][0]=downloadDetails[position];
			populateDownloading();
		}
	}
}

function parseTorrentNameFromMagnet(mg){
	return decodeURIComponent(mg.toString().match(/&dn=(.*?)&tr=/)[1].replace(/\.|\+/g," "));
}

function sortPopularity(obj) {
	return Object.keys(obj).sort(function(a, b) {
		return obj[b].popularity - obj[a].popularity;
	});
}

function applyClickFunctions(){
	
	var progressTimer;
	var searchTimer=undefined;
	function getMovieYear(movieDBID,cb){
		var url= 'https://api.themoviedb.org/3/movie/'+movieDBID+'?api_key='+mdbAPIKey+'&language=en&callback=?';
		$.ajax({
			url: url,
			dataType: "jsonp",
			success: function( response ) {
				$.get("/searchMovieYear?imdbID="+response.imdb_id,function(movieYear){
					cb(movieYear);
				});				
			},
			error: function(err){
				console.log(err);
			}
		});
	}
	
	function progress(timeleft, timetotal, $element) {
		$element.show();
		var progressBarWidth = timeleft * $element.width() / timetotal;
		$element.find('div').animate({ width: progressBarWidth }, 500);
		if(timeleft < timetotal) {
			progressTimer=setTimeout(function() {
				progress(timeleft + 1, timetotal, $element);
			}, 1000);
		}else{
			
			$element.find('div').animate({ width: progressBarWidth }, 500);
			progressTimer=setTimeout(function(){ 
				$element.hide();
				$element.find('div').animate({ width: 0 }, 500);
			}, 1000);
			
		}
	};
	function hideBoxes(){
		$("#searchContainer").hide();
		$("#searchResults").html("");
		$("#nonSearchContainer").hide();
		$(".loader").hide();
		$("#closeButton").hide();
		clearTimeout(progressTimer);
		
	}
	$(".movieThumb, .notDownloadingThumb, .downloadingThumb").unbind('click').click(function(){
		event.stopPropagation();

		var itemStyle=event.target.style;
		var movieData=findMovieById(JSON.parse(event.target.getAttribute('data-name')));

		if(itemStyle.backgroundImage.indexOf("http")>-1){
			var childEles=event.target.childNodes;
			for(var i=0;i<childEles.length;i++){
				childEles[i].style.display="block";
			}
			itemStyle.backgroundImage='';
		}else{
			itemStyle.backgroundImage="url(\""+IMGCDNPATH+movieData.poster_path+"\")";
			var childEles=event.target.childNodes;
			for(var i=0;i<childEles.length;i++){
				childEles[i].style.display="none";
			}
		}	
	});
	$(".downloadButton, #torrentSearchButton").unbind("click").click(function(){
		$('#progressBar').hide();
		event.stopPropagation();
		var torrentSearchName=$("#torrentSearchName");
		var movieSearchString="";
		if(torrentSearchName.length!==0){
			movieSearchString=torrentSearchName.val();
			var movieID=torrentSearchName.attr("data-name");
		}else{
			var parentNode=event.target.parentNode;
			MovieData=findMovieById(JSON.parse(parentNode.getAttribute('data-name')));
			var movieID=MovieData.id;
		}
		$(".loader").show();
		getMovieYear(movieID,function(movieYear){
			if(movieYear==="fail"){
				movieYear=MovieData.release_date.substring(0,4);
			}
			if(movieSearchString===""){
				movieSearchString=MovieData.title+" "+movieYear;
			}
			var movieSearchData="FindMovie---"+JSON.stringify({"id":movieID,"movieSearch":movieSearchString});
			torrentResults=[];
			socket.emit('torrentSearch', movieSearchData);
			$("#searchResults").html("<div class=\"Header\"><form onsubmit=\"return false;\"><input id=\"torrentSearchName\" data-name=\""+movieID+"\" value=\""+movieSearchString+"\"></input><input id=\"torrentSearchButton\" type=\"submit\" value=\"Search\"></form></div><div id=\"searchStatus\"></div><table id=\"torrentTable\"><tr><th>Name</th><th>Seeds</th><th>Size</th></tr></table>").show();
			$("#searchContainer").show();
			$("#torrentTable").hide();

			$("#nonSearchContainer, #closeButton").show().click(function(){
				hideBoxes();
			});
			
			$("#searchStatus").html("<h4>Searching Torrent Indexes...</h4>");
			socket.removeListener('torrentIndex');
			socket.on('torrentIndex',function(resultCount){
				$("#searchStatus").html("<h4>"+resultCount+" Torrents Found. Getting active seeder counts...</h4>");
				clearTimeout(searchTimer);
				progress(0, 20, $('#progressBar'));
				searchTimer=setTimeout(function(){ 
					$("#searchStatus").html("<h4>No Seeders Found.</h4>");
					$(".loader").hide();
					$('#progressBar').hide();
				}, 20000);
			});
			socket.removeListener('torrentSearch');
			socket.on('torrentSearch', function(msg){
				clearTimeout(searchTimer);
				if(msg=="fail"){
					$("#searchStatus").html("<h4>No Results Found.</h4>");
					$(".loader").hide();
					$('#progressBar').hide();
					
				}else{
					$("#torrentTable").show();
					$("#searchStatus").html("");
					clearTimeout(searchTimer);
					var torrentResult=JSON.parse(msg);
					var movieName=parseTorrentNameFromMagnet(torrentResult.magnet);
					
					var checkIfInArray=$.inArray(movieName, torrentResults); //DEDUPE!
					if(checkIfInArray==-1){
						$("#torrentTable").append("<tr><td class=\"downloadMovie\" data-name=\""+torrentResult.magnet+"\">"+movieName+"</td><td>"+torrentResult.seeds+"</td><td>"+torrentResult.size+"</td></tr>")
						sortSeeds();
						$(".downloadMovie").unbind("click").click(function(){
							var thisElement=$(this);
							var magnet=thisElement.attr('data-name');
							thisElement.off('click');
							var movieYear=MovieData.release_date.substring(0,4);
							
							var movieDownloadURI="/downloadMovie?id="+MovieData.id+"&movieName="+encodeURIComponent(MovieData.title)+"&movieYear="+movieYear+"&magnet="+encodeURIComponent(magnet);
							//console.log("DOWNLOADING: "+movieDownloadURI);
							$.get( movieDownloadURI, function( serverResponse ) {
								//console.log(serverResponse);
								if(serverResponse.indexOf("now downloading!")>-1){
									$("#"+MovieData.id).addClass("currentlyDownloading").find(".downloadButton").remove();
								}
								
							});
							hideBoxes();
						});
						$(".loader").hide();
						torrentResults.push(movieName);
					}
				}
			});
		});


	});
	$(".movieDBButton").unbind('click').click(function(){
		event.stopPropagation();
		var parentNode=event.target.parentNode;
		var movieID=JSON.parse(parentNode.getAttribute('data-name'));
		var url= 'https://api.themoviedb.org/3/movie/'+movieID+'?api_key='+mdbAPIKey+'&language=en&callback=?';
		$.ajax({
			url: url,
			dataType: "jsonp",
			success: function( response ) {
				window.open("https://www.imdb.com/title/"+response.imdb_id, '_blank');
			}
		});
	});
	$(".cancelMovie").unbind('click').click(function(){
		event.stopPropagation();
		cancelMovie(event.target.parentNode.getAttribute('data-name'));
	});
	$(".actorThumb").unbind('click').click(function(){
		event.stopPropagation();
		var actorID=$(this).attr('data-name');
		var actorURL= 'https://api.themoviedb.org/3/person/'+actorID+'/movie_credits?api_key='+mdbAPIKey+'&language=en';
		$.get(actorURL,function(data){
			var actingResults=data.cast;
			var sorted = Object.keys(actingResults).map(function (key) {
			  return [key, this[key]]
			}, actingResults).sort(function (a, b) {
			  return b[1].popularity - a[1].popularity;
			})
			var movieResults=[];
			for(var i=0;i<sorted.length;i++){
				movieResults.push(sorted[i][1]);
			}
			for(var i=0;i<movieResults.length;i++){
				mapPlexMoviePlexId(movieResults[i]);
			}
			populateMovieResults(movieResults,"actorMovieResults");
		})
	});
}

function populateActorResults(results){
	var top5=[];

	var resultsString="";
	if(results.length===0){
		$("#actorMovieResults").html("<span style=\"color:red\">No Actors found by that name.<br><span>");
		return;
	}else{
		//Filter out future movieSearch
		var counter=0;
		for(var i=0;i<results.length;i++){
			var actor=results[i];
			if(actor.profile_path!==null){
				counter++;
				resultsString+="<div style=background-image:url(\""+IMGCDNPATH+actor.profile_path+"\") class=\"actorThumb\" data-name="+actor.id+"><span class=\"actorTitle\">"
				+actor.name+"</span></div>";
			}	
			if(counter >=30){
				break;
			}
			
		}
	}
    $("#actorMovieResults").html(resultsString);
	applyClickFunctions();
}

function populateMovieResults(results,type,append){
	//console.log(results);
	
	function createMovieButtons(movie,cb){
		
		var movieString="";
		if(movie.release_date&&movie.poster_path){
			var movieReleaseDate=new Date(movie.release_date);
			var movieTitleDisplay=movie.title + " ("+(movie.release_date.substring(0,4))+")";
			var movieTitle=movie.title + " "+(movie.release_date.substring(0,4))+"";
			//searchDVDReleaseDate(movieTitle,movie.id);
			if(todaysDate > movieReleaseDate){		
				if(currentlyDownloading.indexOf(movie.id.toString())>-1){
					movieString+="<div style=background-image:url(\""+IMGCDNPATH+movie.poster_path+"\") class=\"movieThumb currentlyDownloading\" id=\""+movie.id+"\" data-name="+movie.id+"><span class=\"movieTitle\">"
					+movieTitleDisplay+" [Currently Downloading]</span><div class=\"movieDBButton\">&#10068;</div></div>";
				}else if(alreadyHaveMovies.indexOf(movie.id)>-1){
					movieString+="<div style=background-image:url(\""+IMGCDNPATH+movie.poster_path+"\") class=\"notDownloadingThumb\" id=\""+movie.id+"\" data-name="+movie.id+"><span class=\"movieTitle\">"
					+movieTitleDisplay+"</span><div class=\"movieDBButton\">&#10068;</div></div>";
				}else{
					movieString+="<div style=background-image:url(\""+IMGCDNPATH+movie.poster_path+"\") class=\"movieThumb\" id=\""+movie.id+"\" data-name="+movie.id+"><span class=\"movieTitle\">"
					+movieTitleDisplay+"</span><div class=\"movieDBButton\">&#10068;</div><div class=\"downloadButton\">Download</div></div>";
				}
			}
		}
		return cb(movieString);
	}
	
	var resultsDiv=$("#"+type);
	var resultsString="";
	if(results.length===0){
		resultsDiv.html("<span style=\"color:red\">No movies found by that name.<br><span>");
		return;
	}else{
		//Filter out future movieSearch
		var todaysDate=new Date();
		//console.log(results.length)
		if(results.length===undefined){
			createMovieButtons(results,function(movieHTML){
				resultsString+=movieHTML;
			});
		}else{
			for(var i=0;i<results.length && i<40;i++){
				createMovieButtons(results[i],function(movieHTML){
					resultsString+=movieHTML;
				});
			}
		}
	}
	if(append===true){
		resultsDiv.append(resultsString);
	}else{
		resultsDiv.html(resultsString);
	}
    
	applyClickFunctions();
}

function getDownloadingStatus(){
	$.ajax({
		url:"/downloading", 
		success: function( data ) {
			//downloadResults=[];
			var movieResultsDiv=$("#moviesDownloading");//.html('');
			var movieDownloadingList=JSON.parse(data);
			//populate curently downloading array
			currentlyDownloading=[];
			for(var i=0;i<movieDownloadingList.length;i++){
				currentlyDownloading.push(movieDownloadingList[i].id);
			}
			//remove movies from page when no longer downloading
			for(mdbID in downloadResults){
				var containsMovie=false;
				for(var i=0;i<movieDownloadingList.length;i++){
					if(movieDownloadingList[i].id===mdbID){
						containsMovie=true;
					}
				}
				if(containsMovie===false){
					delete downloadResults[mdbID];
				}
			}
			$("#downloadsTab").html("Active ("+movieDownloadingList.length+")");
			searchMovieById(0,movieDownloadingList,function(downloadDetails,movieData){
				
				populateDownloading(downloadDetails,movieData);
			});
		},
		error: function(data){
			location.reload();
		}
	});
}

function getPlexMDB(callback){
	$.get( "/getMyMDBIDs", function(data) {
		callback(JSON.parse(data));
	});
}

function mapPlexMoviePlexId(movie){

	var moviePos=myPlexIDs.indexOf(movie.id.toString());
	if(moviePos > -1){
		if(alreadyHaveMovies.indexOf(movie.id===-1)){
			alreadyHaveMovies.push(movie.id);
		}
	}

	filteredResults.push(movie);

}

function searchMovieTitle(title){
	//prevent endless loop of searching
	
	$.ajax({
		 url: "https://api.cognitive.microsoft.com/bing/v7.0/search?q="+title+" imdb&count=1&offset=0&mkt=en-us",
		 type: "GET",
		 beforeSend: function(xhr){xhr.setRequestHeader('Ocp-Apim-Subscription-Key', '70ed79c8bf9548b8a76e5bb2d277d8b2');},
		 success: function(data) {
			//grab name of movie from imdb and retry search
			//console.log("RESOLVED TITLE: "+data.webPages.value[0].about[0].name)
			if(searchedMovies.indexOf(title)===-1 && title !== undefined){
				findMovie(data.webPages.value[0].about[0].name);
				searchedMovies.push(title);
			}
		}
	});
}

function searchDVDReleaseDate(title,movieID){
	//prevent endless loop of searching
	console.log(title);
	$.ajax({
		 url: "https://api.cognitive.microsoft.com/bing/v7.0/search?q="+title+" dvd release date&count=1&offset=0&mkt=en-us",
		 type: "GET",
		 beforeSend: function(xhr){xhr.setRequestHeader('Ocp-Apim-Subscription-Key', '70ed79c8bf9548b8a76e5bb2d277d8b2');},
		 success: function(data) {
			 if(data.webPages.value[0].url.includes("dvdsreleasedates.com")){
				var rdString=data.webPages.value[0].name;
				var releaseDate=rdString.substring((rdString.indexOf("DVD Release Date"))+17);
				var releaseDateJS=new Date(releaseDate);
				var todaysDate = new Date();
				//If release date is later than today, display it differently.
				if(releaseDateJS.getTime() > todaysDate.getTime()){
					console.log("not on dvd yet!!");
					$("#"+movieID).css({"color":"red"});
				}
			 }else{
				 console.log(data.webPages.value[0].url);
			 }
		}
	});
}


function findMovie(title){
	var url= 'https://api.themoviedb.org/3/search/movie?query='+title+'&api_key='+mdbAPIKey+'&language=en';
	
	$.get({
		url: url,
		success: function( response ) {
			var movieResults=response.results;
			//console.log(response.results);
			if(movieResults.length===0){
				//call google to resolve title, call movieDB with new title
				searchMovieTitle(title);
			}else{
				mapPlexMoviePlexId(movieResults[0]);
				populateMovieResults(movieResults[0],"browseNewContent",true);
			}
		}
	});
}

function populateBrowseNew(){
	
	$.get("/getredbox",function(data){
		var movies=JSON.parse(data);
		redBoxData=movies;
		for(var i=0;i<redBoxData.length && i<redBoxDisplayCount;i++){
			findMovie(redBoxData[i]);
		}
		setTimeout(function(){ $(".rightArrow").show(); }, 500);
		redBoxPosition=redBoxDisplayCount;
	});
	$(".leftArrow").unbind('click').click(function(){
		redBoxPosition-=redBoxDisplayCount*2;
		var stopPoint=redBoxPosition+redBoxDisplayCount;
		setTimeout(function(){ $(".rightArrow").show(); }, 500);
		$("#browseNewContent").html("");
		for(var i=redBoxPosition;i>=0 && i<stopPoint;i++){
			findMovie(redBoxData[i]);
		}
		redBoxPosition+=redBoxDisplayCount;
		if(redBoxPosition<=10){
			$(".leftArrow").hide();
		}
		
	})
	$(".rightArrow").unbind('click').click(function(){		
		setTimeout(function(){ $(".leftArrow").show(); }, 500);
		$("#browseNewContent").html("");
		var stopPoint=redBoxPosition+redBoxDisplayCount;
		for(var i=redBoxPosition;i<redBoxData.length && i<stopPoint;i++){
			findMovie(redBoxData[i]);
		}
		redBoxPosition+=redBoxDisplayCount;
		if(redBoxData.length<redBoxPosition+redBoxDisplayCount){
			$(".rightArrow").hide();
		}
	})
}

function getUserName(){
	$.get('/getUserName',function(data){
		$("#userName").html(data);
	});
}

function getMdbApiKey(cb){
	$.get('/getMDBApiKey',function(data){
		mdbAPIKey=data;
		cb();
	});
}

$(document).ready(function() {
	socket = io.connect('https://home.traviswolfe.net:8284', {secure: true});
	getPlexMDB(function(plexIDs){
		myPlexIDs=plexIDs;
	});
	
	$("#movieSearchBox").change(function(event){
		$("#movieResults").html("<div class=\"loader\"></div>");
		var searchQuery=event.target.value;
		var url='https://api.themoviedb.org/3/search/movie?query='+searchQuery+'&api_key='+mdbAPIKey+'&language=en&callback=?';
		$.ajax({
			url: url,
			dataType: "jsonp",
			success: function( response ) {
				var movieResults=response.results;
				filteredResults=[];
				for(var i=0;i<movieResults.length;i++){
					mapPlexMoviePlexId(movieResults[i]);
				}
				populateMovieResults(filteredResults,"movieResults"); 

			}
		});
	});

	$(".tab").click(function(){
		var thisElement=$(this);
		if(thisElement.hasClass("active")===false){
			thisElement.addClass("active").siblings().removeClass("active");
			var id=thisElement.attr('id');
			$(".toggle").hide();
			console.log(id);
			if(id==="searchTab"){
				// if neither active, default to title
				if($("#titleSearchTab").hasClass("active")===false && $("#actorSearchTab").hasClass("active")===false){
					$("#titleSearchContent").show();
					$("#titleSearchTab").addClass("active");
					$(".searchToggle").show();
				}else if($("#titleSearchTab").hasClass("active")===false){
					$("#actorSearchContent").show();
					$(".searchToggle").show();
				}else{
					$("#titleSearchContent").show();
					$(".searchToggle").show();
				}
				$(".searchToggle").show();
			}else if(id==="downloadsTab"){
				$(".downloadToggle").show();
				$("#currentlyDownloadingTab").addClass("active");
			}else if(id==="browseTab"){
				$("#browseNewContent").html("");
				populateBrowseNew();
				$(".browseToggle").show();
				$("#newMoviesBrowseTab").addClass("active");
			}else if(id==="titleSearchTab"){
				$("#titleSearchContent").show();
				$(".searchToggle").show();
			}else if(id==="actorSearchTab"){
				$("#actorSearchContent").show();
				$(".searchToggle").show();
			}
		}
	});
	
	$("#actorSearchBox").change(function(event){
		$("#actorMovieResults").html("<div class=\"loader\"></div>");
		var searchQuery=event.target.value;
		var url= 'https://api.themoviedb.org/3/search/person?query='+searchQuery+'&api_key='+mdbAPIKey+'&language=en';
		//console.log("making request");
		$.get(url,function(response) {
			var actorResults=response.results;
			populateActorResults(response.results);
		});
	});
	
	getMdbApiKey(function(){;
		getDownloadingStatus();
		$("#browseTab").click();
		setInterval(function(){
			getDownloadingStatus();
			
		},30000);
	});
	getUserName();
	
});