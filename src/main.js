const { app, BrowserWindow, Menu, ipcMain } = require('electron');

const https = require('https');

const SerialPort = require('serialport')
const Readline = require('@serialport/parser-readline')

const url = require('url');
const path = require('path');

const file = require('fs');

let dataConfigReader = file.readFileSync(path.join(__dirname,'gpsConfig.json'));

var dataConfig = JSON.parse(dataConfigReader);

var portName = dataConfig.gpsConfigPort;

const port = new SerialPort(portName, { baudRate: dataConfig.gpsConfigBaud });
const parser = new Readline();

port.pipe(parser)


const { electron } = require('process');


let mainWindow

let lon, lat, rlon, rlat
let vel
let time,hora, year, month, day, date

let countTrame = 0;

if(process.env.NODE_ENV !== 'production'){
  require('electron-reload')(__dirname, {
    electron: path.join(__dirname, '../node_modules',".bin", "electron")
  });
}

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 500,
    title: "Visor datos GPS",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // mainWindow.webContents.openDevTools();

  mainWindow.loadURL(path.join(__dirname, "views/index.html"));
  
  const menuMain = Menu.buildFromTemplate(menu)
  Menu.setApplicationMenu(menuMain);

  mainWindow.webContents.on('did-finish-load',WindowsReady);


  
});

function WindowsReady() {
  var detailsData = {
    port: dataConfig.gpsConfigPort,
    bauds: dataConfig.gpsConfigBaud
  }

  mainWindow.webContents.send('details',detailsData);
}

parser.on('data', (line) =>{
  let dataArray = line.split(",")
  dataReceive = line , 
  dataLen = dataReceive.length

  let protocol = dataArray[0];
  
  // $GPZDA,143042.00,25,08,2005,,*6E
  switch(protocol){
    case '$GPGLL':
      lon = dataArray[1]; //Longitud
      rlon = dataArray[2]; //Rumbo longitud
      
      lat = dataArray[3]; //Latitud
      rlat = dataArray[4].split("*")[0]; //Rumbo latitud
      countTrame++;
      break;
    case '$GPVTG':
      vel = dataArray[7]; //Velocidad
      countTrame++;
      break;
    case '$GPZDA':
      time = dataArray[1]; //Datos hora entregados por el gps
      day = dataArray[2]; 
      month = dataArray[3]; 
      year = dataArray[4];

      let timeArray = (time.match(/.{1,2}/g)); // separación de los datos en grupos de 2
      
      hora = timeArray[0]+":"+timeArray[1]+":"+timeArray[2]; // Reestructuración de los datos
      date = day+"/"+month+"/"+year;
      
      countTrame++;
      break;
  }

  var gpsData = {
    longitud: lon+" "+rlon,
    latitud: lat+" "+rlat,
    velocidad: vel,
    horaData: hora,
    fechaData: date
  }

  mainWindow.webContents.send('data', gpsData);
  if(countTrame > 2){
    let apiReq = `/${gpsData.longitud}/${gpsData.latitud}/${gpsData.velocidad}/${gpsData.horaData}/${gpsData.fechaData.replaceAll('/','-')}`;
    // console.log(apiReq);
    sendDataToServer(apiReq); 
    countTrame = 0;}
});

const menu =[
  {
    label: "inicio",
    submenu: [
      {
        label: "cerrar aplicación",
        accelerator:  'Ctrl+Q', 
        click(){
          app.quit();
        }
      }
    ]
  }
]


function sendDataToServer(request){
  const req = https.request({
    hostname: 'apipruebacotecmar.cvrelectronica.com',
    port: 443,
    path: "/saveGpsData"+encodeURI(request),
    method: "GET"
  }, res => {
    if(res.statusCode == 200){
      mainWindow.webContents.send('api-status', 1);
    }else{
      mainWindow.webContents.send('api-status', 0);
    }
  
    res.on('data', d => {
      process.stdout.write(d)
    })
  })

  req.on('error', error => {
    console.error(error)
  })

  req.end();
}
