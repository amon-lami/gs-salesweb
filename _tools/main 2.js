const{app,BrowserWindow,ipcMain,shell}=require("electron");
const path=require("path");
const Store=require("electron-store");
const store=new Store();

// Register custom protocol for deep linking from GS-Chat
if(process.defaultApp){
  if(process.argv.length>=2){
    app.setAsDefaultProtocolClient("gssales",process.execPath,[path.resolve(process.argv[1])]);
  }
}else{
  app.setAsDefaultProtocolClient("gssales");
}

let win;
let pendingDealId=null;

function createWindow(){
  win=new BrowserWindow({
    width:1100,height:700,
    titleBarStyle:process.platform==="darwin"?"hiddenInset":"default",
    frame:process.platform==="darwin",
    webPreferences:{preload:path.join(__dirname,"preload.js"),contextIsolation:true,nodeIntegration:false}
  });
  win.loadFile("src/index.html");
  win.webContents.on("did-finish-load",()=>{
    if(pendingDealId){
      win.webContents.send("navigate-deal",pendingDealId);
      pendingDealId=null;
    }
  });
}

function handleProtocolUrl(url){
  // Parse gssales://deal/DEAL_ID
  const match=url.match(/gssales:\/\/deal\/(.+)/);
  if(match){
    const dealId=decodeURIComponent(match[1]);
    if(win){
      win.show();
      win.focus();
      win.webContents.send("navigate-deal",dealId);
    }else{
      pendingDealId=dealId;
    }
  }
}

// macOS: open-url event
app.on("open-url",(event,url)=>{
  event.preventDefault();
  handleProtocolUrl(url);
});

// Windows/Linux: second-instance event
const gotTheLock=app.requestSingleInstanceLock();
if(!gotTheLock){
  app.quit();
}else{
  app.on("second-instance",(event,commandLine)=>{
    const url=commandLine.find(arg=>arg.startsWith("gssales://"));
    if(url)handleProtocolUrl(url);
    if(win){win.show();win.focus()}
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit()});
app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()});

ipcMain.handle("get-platform",()=>process.platform);
ipcMain.handle("get-config",()=>({supabaseUrl:store.get("supabaseUrl",""),supabaseKey:store.get("supabaseKey",""),email:store.get("email",""),password:store.get("password","")}));
ipcMain.handle("save-config",(e,cfg)=>{Object.entries(cfg).forEach(([k,v])=>store.set(k,v))});
ipcMain.handle("open-url",(e,url)=>shell.openExternal(url));
ipcMain.handle("win-minimize",()=>win?.minimize());
ipcMain.handle("win-maximize",()=>{win?.isMaximized()?win.unmaximize():win?.maximize()});
ipcMain.handle("win-close",()=>win?.close());
