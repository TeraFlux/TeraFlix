var fs = require('fs');
var config=require('../config.js')

function readFileCreateIfNotExist(filePath,cb){
	function readFile(){
		fs.readFile(filePath,'utf8',function(err,data){
			cb(JSON.parse(data));
		});
	}
	
	if (fs.existsSync(filePath)) {
		readFile();
	}else{
		//create file
		fs.writeFile(filePath, "{}", { flag: 'wx' }, function (err) {
			if (err) throw err;
			console.log(filePath+" Created!");
			readFile();
		});
	}
}

function writeFile(path,data,cb){
	fs.writeFile(path,data,function(err){
		cb(err);
	});
}

function readFileSync(path){
	return fs.readFileSync(path);
}

function getDownloadingList(callback){
	readFileCreateIfNotExist(config.downloadingMoviesPath,function(data){
		callback(data);
	});
}


module.exports.readFileCreateIfNotExist=readFileCreateIfNotExist;
module.exports.writeFile=writeFile;
module.exports.readFileSync=readFileSync;
module.exports.getDownloadingList=getDownloadingList;