const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');
code = code.replace("createRoot(document.getElementById('root')!).render(", "window.addEventListener('error', (e) => { document.body.innerHTML += '<div style=\"color:red;padding:20px;z-index:9999;position:relative;background:white\"><h3>Error:</h3><pre>' + e.error?.message + '\\n' + e.error?.stack + '</pre></div>'; }); window.addEventListener('unhandledrejection', (e) => { document.body.innerHTML += '<div style=\"color:red;padding:20px;z-index:9999;position:relative;background:white\"><h3>Unhandled Promise:</h3><pre>' + e.reason + '</pre></div>'; });\ncreateRoot(document.getElementById('root')!).render(");
fs.writeFileSync('src/main.tsx', code);
