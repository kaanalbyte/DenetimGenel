const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');
code = code.replace("createRoot(document.getElementById('root')!).render(", "window.addEventListener('error', (e) => { document.getElementById('root').innerHTML = '<div style=\"color:red;padding:20px;z-index:9999;position:relative\"><h3>Error:</h3><pre>' + e.message + '\\n' + e.error?.stack + '</pre></div>'; });\ncreateRoot(document.getElementById('root')!).render(");
fs.writeFileSync('src/main.tsx', code);
