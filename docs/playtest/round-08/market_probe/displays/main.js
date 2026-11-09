const { app, screen } = require('electron');
app.whenReady().then(() => { console.log(JSON.stringify(screen.getAllDisplays().map((d) => ({ id: d.id, bounds: d.bounds, workArea: d.workArea, scale: d.scaleFactor, primary: d.id === screen.getPrimaryDisplay().id })))); app.quit(); });
