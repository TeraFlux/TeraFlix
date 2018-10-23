var fs = require('fs');
var config=require('../config.js')
const rimraf=require("rimraf");

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
function listFiles(path,cb){
	fs.readdir(path, function(err, items) {
		
		cb(err,items);
	});
}

function statSync(filePath){
	return fs.statSync(filePath);
}

function checkIfDirectory(path,cb){
	fs.lstat(path, (err, stats) => {
		if(err){
			cb("fail") //Handle error
		}
		if(stats.isDirectory() ===true){
			cb(true);
		}else{
			cb(false);
		}
	});
}
function removeDirectory(path,cb){
	rimraf(path,function(){
		cb();
	})
}
function moveFile(oldPath,newPath,callback){
	fs.rename(oldPath, newPath, function (err) {
        if (err) {
            if (err.code === 'EXDEV') {
                copy();
            } else {
                callback(err);
            }
            return;
        }
        callback();
    });

    function copy() {
        var readStream = fs.createReadStream(oldPath);
        var writeStream = fs.createWriteStream(newPath);

        readStream.on('error', callback);
        writeStream.on('error', callback);

        readStream.on('close', function () {
            fs.unlink(oldPath, callback);
        });

        readStream.pipe(writeStream);
    }
}

function createDirIfNotExist(dir){
	if (!fs.existsSync(dir)){
		fs.mkdirSync(dir);
	}
}

module.exports.readFileCreateIfNotExist=readFileCreateIfNotExist;
module.exports.writeFile=writeFile;
module.exports.checkIfDirectory=checkIfDirectory;
module.exports.createDirIfNotExist=createDirIfNotExist;
module.exports.listFiles=listFiles;
module.exports.removeDirectory=removeDirectory;
module.exports.statSync=statSync;
module.exports.moveFile=moveFile;
module.exports.readFileSync=readFileSync;
module.exports.getDownloadingList=getDownloadingList;