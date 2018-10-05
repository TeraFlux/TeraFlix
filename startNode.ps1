while($true){
	if((get-process node -ErrorAction SilentlyContinue) -eq $null){
		write-host "Restarting Node";
		node .\app.js
	}else{
		write-host "Already Running";
	}
	start-sleep -seconds 5
}