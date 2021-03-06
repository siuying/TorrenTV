var browser = require( 'airplay2' ).createBrowser();
var readTorrent = require( 'read-torrent' );
var numeral = require('numeral');
var gui = require('nw.gui');
var emitter = gui.Window.get();

var isMac = process.platform.indexOf('dar')>-1 || process.platform.indexOf('linux')>-1
var global_href = "192.168.0.101:8000"

//emitter.resizeTo(300, 320)
if(!isMac){
  emitter.resizeTo(300, 340)
}

//Local File Streamming
var path = require('path')
var port = 4007
var connect = require('connect');
var address = require('network-address');
var serveStatic = require('serve-static');
var escaped_str = require('querystring');
var last_played = ''
var peerflix = require('peerflix')

//Downloading torrent from link
var http = require('http');
var fs = require('fs');

var menu = new gui.Menu();
//menu.removeAt(1);

var openInFinder = function(file){
  gui.Shell.showItemInFolder(file);
}

var showMessage = function(message){
  document.getElementById('top-message').innerHTML = message
}
var secondaryMessage = function(message){
  document.getElementById('info-message').innerHTML = message
}

var bytes = function(num) {
  return numeral(num).format('0.0b');
};

var statusMessage = function(unchoked,wires,swarm){
  document.getElementById('box-message').innerHTML = "Peers: "+unchoked.length+"/"+wires.length+"</br> Speed: "+bytes(swarm.downloadSpeed())+"/s</br>  Downloaded: "+bytes(swarm.downloaded)
}

var cleanStatus = function(){
  document.getElementById('box-message').innerHTML = ""
}

var xmlRokuServer = function(){
  var http = require('http');
  var mu = require('mu2');
  var util = require('util');
  mu.root = 'src/app/';

  var server = http.createServer(function(req,res){
    console.log('valor de global_href:',global_href)
    mu.clearCache()
    var stream = mu.compileAndRender('index.xml', {source: global_href});
    stream.pipe(res);
    console.log('saying hola')
  })

  server.listen(9009)
}

xmlRokuServer()

function processTorrent(new_torrent){
  readTorrent(new_torrent, function(err, torrent) {
    if (err) {
      console.error(err.message);
      process.exit(1);
    }

    //console.log(torrent)
    if(JSON.stringify(torrent.files).toLowerCase().indexOf('mkv')>-1){
      secondaryMessage("<div class='error'>MKV format not supported by AppleTV</div>");
      showMessage("Torrent contains .MKV Movie");
      movieName = torrent.name
      movieHash = torrent.infoHash
      gotTorrent(torrent);
    }else{
      movieName = torrent.name
      movieHash = torrent.infoHash
      gotTorrent(torrent);
    }
  });
}

var download = function(url, dest, cb) {
  var file = fs.createWriteStream(dest);
  var request = http.get(url, function(response) {
    response.pipe(file);
    file.on('finish', function() {
      file.close(cb);  // close() is async, call cb after close completes.
    });
  });
}

var device = ""
var movieName = ""
var movieHash = ""
var intervalArr = new Array();
var loading = false;

var doc = document.documentElement;
doc.ondragover = function () { this.className = 'hover'; return false; };
doc.ondragend = function () { this.className = ''; return false; };
doc.ondrop2 = function(event){
  event.preventDefault && event.preventDefault();
  this.className = '';

	readTorrent(event.dataTransfer.files[0].path,function(err, torrent){
		gotTorrent(torrent)
	});



}

doc.ondrop = function (event) {

  cleanStatus();

  event.preventDefault && event.preventDefault();
  this.className = '';

  var magnet = event.dataTransfer.getData('Text');;
  var new_torrent = ""
  secondaryMessage("")

  if(!magnet.length>0){
    new_torrent = event.dataTransfer.files[0].path;
    //console.log(new_torrent)

    //Local .torrent file dragged
    if(new_torrent.toLowerCase().substring(new_torrent.length-7,new_torrent.length).indexOf('torrent')>-1){
      if(isMac){
        secondaryMessage(new_torrent.split('/').pop().replace(/\{|\}/g, '').substring(0,30)+"...")
      }else{
        secondaryMessage(new_torrent.split('\\').pop().replace(/\{|\}/g, '').substring(0,30)+"...")
      }
      //console.log(">>>>>>>>>>>>>>>>>>>>>>>>##########")
      //console.log(last_played==new_torrent)
      if(last_played==new_torrent){
        emitter.emit('wantToPlay');
      }else{
        processTorrent(new_torrent)
      }
      last_played = new_torrent

    }else{
      //Not a torrent, could be a local Movie, also send
      if(new_torrent.toLowerCase().substring(new_torrent.length-3,new_torrent.length).indexOf('mp4')>-1
          || new_torrent.toLowerCase().substring(new_torrent.length-3,new_torrent.length).indexOf('mov')>-1
          || new_torrent.toLowerCase().substring(new_torrent.length-3,new_torrent.length).indexOf('mp3')>-1){
        showMessage("Sending to AppleTV")

        var dirname = path.dirname(new_torrent)
        var basename = path.basename(new_torrent)
        if(basename.length<25)
          secondaryMessage("Local File: "+basename);
        else
          secondaryMessage("Local File: "+basename.substring(0,25)+" ...");

        port++;
        connect().use(serveStatic(dirname)).listen(port);

        var resource = 'http://'+address()+':'+port+'/'+escaped_str.escape(basename)
        if(device){
          console.log('Telling AppleTV to play: '+resource)
          device.play(resource, 0, function() {
          });
          console.log(">>> Playing in AirPlay device: "+basename);
        }else{
          showMessage("No AppleTV device detected");
          console.log(">>> Serving movie at: "+resource);
          global_href = resource
          //app.close()
        }


      }else{
        secondaryMessage("Invalid Filetype")
      }
    }
  }else{
    if(magnet.toLowerCase().substring(0,6).indexOf('magnet')>-1){
      //magnet link
      secondaryMessage("Magnet")
      if(last_played==magnet){
        emitter.emit('wantToPlay');
      }else{
        gotTorrent(magnet);
      }
      last_played = magnet

    }else{
      if(magnet.toLowerCase().substring(0,4).indexOf('http')>-1){
        secondaryMessage("HTTP Link")
        //it's a normal http link
        magnet = magnet.toLowerCase().split("?")[0]
        secondaryMessage(magnet)
        if(magnet.substring(magnet.length-7,magnet.length).indexOf('torrent')>-1){
          secondaryMessage("Downloading .torrent file")
          processTorrent(magnet)
        }else{
          if(self.device){
            self.device.play(href, 0, function() {
              console.log(">>> Playing in AirPlay device: "+href)
              showMessage("URL sent to AppleTV")
            });
          }else{
            secondaryMessage("Not sent")
            showMessage("Could not find AppleTV")
          }
        }
      }
    }
  }

  return false;
};


browser.on( 'deviceOn', function( device ) {
   document.getElementById('airplay-icon').src = 'AirplayIcon.png';
   self.device = device
   //console.log('tryToPlay')
   emitter.emit('wantToPlay');
});

browser.start();

function killIntervals(){
  //console.log("Killing all intervals");
  while(intervalArr.length > 0)
      clearInterval(intervalArr.pop());
};

var gotTorrent = function (this_torrent){

   killIntervals();

   showMessage("Processing Torrent")

   if(!loading){
     document.getElementById('arrow').classList.toggle('visible');
     document.getElementById('arrow').classList.toggle('hidden');
     document.getElementById('processing').classList.toggle('processing-icon');
   }
   loading = true


  //console.log("processing torrent");
  var address = require('network-address');
  //console.log('enviando a peerflix');

  var engine = peerflix(this_torrent, {});
  //engine.swarm.piecesGot = 0
  
  var hotswaps = 0;
  var verified = 0;
  var invalid = 0;

  var wires = engine.swarm.wires;
  var swarm = engine.swarm;

  var active = function(wire) {
    //console.log("peerChoking")
    return !wire.peerChoking;
  };

  engine.on('verify', function() {
    //console.log('verify')
    verified++;
    engine.swarm.piecesGot += 1;
  });

  engine.on('invalid-piece', function() {
    //console.log('invalidpiece')
    invalid++;
  });

  var onready = function() {
  //mostrar algo ya que el motor ya inicio
    console.log('We are ready')
  };
  if (engine.torrent) onready();
  else engine.on('ready', onready);

  engine.on('hotswap', function() {
    //console.log('hotswap')
    hotswaps++;
  });

  engine.server.on('listening', function() {
    console.log('Streaming server is listening')
    var href = 'http://'+address()+':'+engine.server.address().port+'/';
    global_href = href
    var filename = engine.server.index.name.split('/').pop().replace(/\{|\}/g, '');
    var filelength = engine.server.index.length;
    console.log(href);

    showMessage("Waiting for AppleTV")

    if(movieName.length>25){
        movieNameToShow = movieName.substring(0, 25)+"..."
    }else{
        movieNameToShow = movieName
    }
    if(movieHash.length>0 && isMac){
      secondaryMessage("<a class='cursored' onclick='openInFinder(\""+engine.path+"\"); '>"+movieNameToShow+" ["+bytes(filelength)+"] </a>");
    }else{
      secondaryMessage(movieNameToShow+" ["+bytes(filelength)+"]");
    }
    console.log("("+bytes(filelength)+") "+filename.substring(0, 13)+"...");

    var updateStatus = function(){
      var unchoked = engine.swarm.wires.filter(active);
      statusMessage(unchoked, wires, swarm)
    }

    intervalArr.push(setInterval(updateStatus,250))

    var tryToPlay = function(){
      console.log('tryToPlay')
      if(self.device){
        self.device.play(href, 0, function() {
          console.log(">>> Playing in AirPlay device: "+href)
          showMessage("Streaming to AppleTV")
        });
      }
    };

    emitter.on('wantToPlay', tryToPlay);

    emitter.emit('wantToPlay');

  });
}


