const CACHE="hbg-static-v2";
const ASSETS=["./","./index.html","./style.css","./app.js","./manifest.json","./icon.svg"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener("fetch",event=>{
  const u=new URL(event.request.url);
  if(u.origin===location.origin && event.request.method==="GET"){
    event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
      const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy));return response;
    }).catch(()=>caches.match("./index.html"))));
  }
});
