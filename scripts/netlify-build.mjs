import { cp, mkdir, rm } from "node:fs/promises";
const files=["index.html","login.html","admin.html","bar.html","track.html","manifest.webmanifest","sw.js","assets"];
await rm("dist",{recursive:true,force:true});
await mkdir("dist",{recursive:true});
for(const file of files)await cp(file,`dist/${file}`,{recursive:true});
console.log("Cheers listo para Netlify en dist/");
