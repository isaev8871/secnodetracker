const SecNode = require('./SecNodeTracker').auto();
const LocalStorage = require('node-localstorage').LocalStorage;
const local = new LocalStorage('./config');
const socket = require('socket.io-client')(local.getItem('serverurl'));  //('http://192.168.1.50:3333');
const os = require('os');
const pkg = require('./package.json');



//check if setup was run
if (local.length == 0) {
	console.log("Please run setup: node setup.js");
	process.exit();
}


//get cpu config
const cpus = os.cpus();
console.log("CPU " + cpus[0].model + "  cores=" + cpus.length + "  speed=" + cpus[0].speed);
const hw = { "CPU": cpus[0].model, "cores": cpus.length, "speed": cpus[0].speed }

//self version
const poolver = pkg.version;
console.log("Pool app version: " + poolver);


//check memory
let totmem = os.totalmem() / 1000000000;
let freemem = os.freemem() / 1000000000;
console.log("total memory=" + totmem.toFixed(2) + "  free memory=" + freemem.toFixed(2));

if (freemem < 4) {
	console.log("WARNING: Minimum available memory needed for creating shielded transactions is 4GB. swap file not checked.");
}


let taddr;

//check if already registered
let nodeid = local.getItem('nodeid') || null;
let ident = { "nid": nodeid, "stkaddr": local.getItem('stakeaddr') };

socket.on('connect', () => {
	// check connectivity by getting the t_address.
	// pass identity to server on success
	SecNode.getPrimaryAddress((err, taddr) => {
		if (err) {
			console.log(err);
			//	console.log("Unable to connect to zend. Please check the zen rpc settings and ensure zend is running");
			//process.exit();
		} else {
			ident.taddr = taddr;
			console.log("Secure Node t_address=" + taddr);
			SecNode.ident = ident;

				SecNode.getAddrWithBal((err, result) => {
				if (err) return console.log(err);

				if (result.bal == 0) {
					console.log("Challenge private address balance is 0");
					console.log("Please add at least .5 zen to the private address below");
					if (!nodeid) {
						console.log("Unable to register node. Exiting.")
						process.exit();
					}
				} else {
					console.log("Balance for challenge transactions is " + result.bal);
					if (result.bal < 0.001) {
					console.log("Challenge private address balance getting low");
					console.log("Please add at least .5 zen to the private addres below");
					}
				}

				console.log("Using the following address for challenges");
				console.log(result.addr)

				let identinit = ident;
				//only pass email on init.  
				identinit.email = local.getItem('email');
				socket.emit('initnode', identinit);

			})
		}
	});

	console.log(logtime(), "Connected to pool server");

});
	socket.on('msg', (msg) => {
		console.log(logtime(), msg);
	});

socket.on("action", (data) => {
	//console.log(data);
	switch (data.action) {
		case "set nid":
			local.setItem("nodeid", data.nid);
			break;

		case 'get stats':
			SecNode.getStats((err, stats)=>{
				if (err) {
                    if (ident) {
                        socket.emit("node", { type: "down", ident: ident });
                    }
                } else {
                    socket.emit("node", { type: "stats", stats: stats, ident: ident });
                }

			});
			console.log(logtime(), "send stats")
			break;
	
		case 'get config':
			SecNode.getConfig(poolver, hw);
			break;

		case 'challenge':
			SecNode.execChallenge(data.chal);
			break;
	}
})

const logtime = () => {
	return (new Date()).toISOString().replace(/T/, ' ').replace(/\..+/, '') + " GMT" + " --";
}

const conCheck = () =>{
	setInterval(() =>{
		if(!socket.connected) console.log(logtime(), "No connection to server");
	}, 60000
	)
}

SecNode.socket = socket;
SecNode.initialize();
conCheck();

