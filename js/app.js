const video=document.getElementById("video"),canvas=document.getElementById("canvas"),ctx=canvas.getContext("2d");
const startBtn=document.getElementById("startBtn"),resetBtn=document.getElementById("resetBtn"),statusText=document.getElementById("statusText"),statusDot=document.getElementById("statusDot");
const objectsEl=document.getElementById("objects");
let model=null,stream=null,running=false,lastTime=performance.now(),frames=0,lastFps=0,tracks=[],nextId=1,confirmed=new Set();
const acc={plastic:{count:0,kg:0},paper:{count:0,kg:0},glass:{count:0,kg:0},metal:{count:0,kg:0},organic:{count:0,kg:0},b3:{count:0,kg:0}};
const weights={plastic:.055,paper:.12,glass:.35,metal:.09,organic:.18,b3:.08};
const map={
 bottle:["PLASTIC","plastic"],cup:["PLASTIC","plastic"],book:["PAPER","paper"],paper:["PAPER","paper"],
 wine_glass:["GLASS","glass"],can:["METAL","metal"],banana:["ORGANIC","organic"],apple:["ORGANIC","organic"],
 orange:["ORGANIC","organic"],broccoli:["ORGANIC","organic"],carrot:["ORGANIC","organic"],laptop:["B3 / E-WASTE","b3"],
 cell_phone:["B3 / E-WASTE","b3"],keyboard:["B3 / E-WASTE","b3"],mouse:["B3 / E-WASTE","b3"]
};
const pretty={plastic:"Plastik",paper:"Kertas",glass:"Kaca",metal:"Logam",organic:"Organik",b3:"B3 / E-waste"};

function toast(t){const x=document.getElementById("toast");x.textContent=t;x.classList.add("show");setTimeout(()=>x.classList.remove("show"),2200)}
function iou(a,b){const ax=Math.max(a[0],b[0]),ay=Math.max(a[1],b[1]),bx=Math.min(a[0]+a[2],b[0]+b[2]),by=Math.min(a[1]+a[3],b[1]+b[3]);const inter=Math.max(0,bx-ax)*Math.max(0,by-ay);return inter/(a[2]*a[3]+b[2]*b[3]-inter+1e-6)}
function center(b){return [b[0]+b[2]/2,b[1]+b[3]/2]}
function dist(a,b){return Math.hypot(a[0]-b[0],a[1]-b[1])}
function category(cls){return map[cls]||null}

function matchTracks(preds){
  const used=new Set(), next=[];
  preds.forEach(p=>{
    let best=null,bestScore=0;
    tracks.forEach(t=>{
      if(used.has(t.id)||t.label!==p.class) return;
      const score=iou(t.box,p.bbox);
      const d=dist(center(t.box),center(p.bbox));
      if(score>.15 && score+Math.max(0,1-d/300)>.7 && score>bestScore){best=t;bestScore=score}
    });
    if(best){
      used.add(best.id); best.box=p.bbox; best.score=p.score; best.missed=0; next.push(best);
    } else {
      next.push({id:nextId++,label:p.class,box:p.bbox,score:p.score,missed:0,age:1,stable:0});
    }
  });
  tracks.forEach(t=>{if(!used.has(t.id)){t.missed++;if(t.missed<8)next.push(t)}});
  tracks=next;
}

function confirmTracks(){
  tracks.forEach(t=>{
    t.age=(t.age||1)+1;
    if(t.score>.55)t.stable=(t.stable||0)+1;
    if(t.stable>=3 && !confirmed.has(t.id)){
      confirmed.add(t.id);
      const c=category(t.label);
      if(c){acc[c[1]].count++;acc[c[1]].kg+=weights[c[1]];toast(`+1 ${pretty[c[1]]} • Track #${t.id}`)}
    }
  });
}

function draw(preds){
  const w=video.videoWidth,h=video.videoHeight;if(!w||!h)return;
  if(canvas.width!==w){canvas.width=w;canvas.height=h}
  ctx.clearRect(0,0,w,h);
  preds.forEach(p=>{
    const [x,y,bw,bh]=p.bbox;const c=category(p.class);const color=c?"#8df2b3":"#e8c86b";
    ctx.strokeStyle=color;ctx.lineWidth=Math.max(2,w/500);ctx.strokeRect(x,y,bw,bh);
    const t=tracks.find(t=>t.label===p.class&&iou(t.box,p.bbox)>.15);
    const id=t?`TRACK #${t.id}`:"NEW";
    ctx.fillStyle=color;ctx.font=`700 ${Math.max(12,w/90)}px Manrope`;
    ctx.fillText(`${id}  ${c?c[0]:p.class}  ${Math.round(p.score*100)}%`,x+5,Math.max(16,y-7));
    ctx.fillStyle=color+"18";ctx.fillRect(x,y,bw,bh);
  });
}

function render(){
  document.getElementById("trackedCount").textContent=tracks.length;
  document.getElementById("objectCount").textContent=tracks.length;
  const total=Object.values(acc).reduce((s,x)=>s+x.count,0),kg=Object.values(acc).reduce((s,x)=>s+x.kg,0);
  document.getElementById("sessionTotal").textContent=total;
  document.getElementById("kgTotal").textContent=kg.toFixed(2)+" kg";
  document.getElementById("impactKg").textContent=kg.toFixed(2)+" kg";
  document.getElementById("xp").textContent=total*25;
  document.getElementById("impactObjects").textContent=total;
  document.getElementById("impactScore").textContent=total*35;
  Object.keys(acc).forEach(k=>{
    document.getElementById(k+"Count").textContent=`${acc[k].count} item · ${acc[k].kg.toFixed(2)} kg`;
    document.getElementById(k+"Bar").textContent=acc[k].count;
  });
  if(!tracks.length)objectsEl.innerHTML='<div class="empty">Belum ada objek terdeteksi.</div>';
  else objectsEl.innerHTML=tracks.map(t=>{
    const c=category(t.label), name=c?c[0]:t.label;
    return `<div class="object-row"><span class="track-id">#${String(t.id).padStart(2,"0")}</span><div><b>${name}</b><small>${c?pretty[c[1]]:"general object"} · tracking</small></div><strong class="confidence">${Math.round(t.score*100)}%</strong></div>`
  }).join("");
}

async function loop(){
 if(!running)return;
 const now=performance.now();frames++;
 if(now-lastTime>1000){lastFps=frames;frames=0;lastTime=now;document.getElementById("fps").textContent=lastFps}
 const preds=await model.detect(video);
 const filtered=preds.filter(p=>p.score>=.55);
 matchTracks(filtered);confirmTracks();draw(filtered);render();
 requestAnimationFrame(loop);
}

startBtn.onclick=async()=>{
 if(running)return;
 try{
  statusText.textContent="LOADING MODEL…";statusDot.classList.add("on");
  model=await cocoSsd.load({base:"lite_mobilenet_v2"});
  stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment",width:{ideal:1280},height:{ideal:720}},audio:false});
  video.srcObject=stream;await video.play();running=true;document.getElementById("cameraHint").style.display="none";
  statusText.textContent="CAMERA ONLINE";startBtn.textContent="CAMERA ACTIVE";toast("Live tracking aktif.");
  loop();
 }catch(e){statusText.textContent="CAMERA ERROR";statusDot.classList.remove("on");toast("Kamera/model gagal dimuat. Gunakan HTTPS atau localhost.")}
};

resetBtn.onclick=()=>{
 tracks=[];confirmed.clear();nextId=1;Object.keys(acc).forEach(k=>{acc[k].count=0;acc[k].kg=0});render();toast("Session di-reset.");
};
document.getElementById("saveBtn").onclick=()=>{
 const total=Object.values(acc).reduce((s,x)=>s+x.count,0);
 if(!total)return toast("Belum ada objek yang terkonfirmasi.");
 const payload={savedAt:new Date().toISOString(),summary:acc};
 localStorage.setItem("sirkula_last_session",JSON.stringify(payload));
 toast(`Session disimpan • ${total} objek`);
};
render();
