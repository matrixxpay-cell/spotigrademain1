import { useState, useEffect, useRef, useCallback } from "react";

// ─── COLOR SYSTEM ─────────────────────────────────────────────────────────────
const C = {
  bg:"#F2F4F8", surface:"#FFFFFF", surfaceAlt:"#F7F8FB", surfaceHover:"#F0F2F7",
  border:"#E1E6EF", borderStrong:"#C8D0DE",
  text:"#0C0E14", textSub:"#3D4A5C", textMuted:"#8492A6",
  violet:"#5B21B6", violetLight:"#EDE9FE", violetMid:"#7C3AED",
  green:"#059669", greenLight:"#ECFDF5", greenText:"#065F46", greenBorder:"#A7F3D0",
  blue:"#1D4ED8", blueLight:"#EFF6FF", blueText:"#1E3A8A", blueBorder:"#BFDBFE",
  red:"#DC2626", redLight:"#FEF2F2", redText:"#991B1B", redBorder:"#FECACA",
  amber:"#B45309", amberLight:"#FFFBEB", amberBorder:"#FDE68A", amberText:"#92400E",
  orange:"#C2410C", orangeLight:"#FFF7ED",
  cyan:"#0891B2", cyanLight:"#ECFEFF",
};

// ─── API CLIENT (Express + MongoDB backend) ───────────────────────────────────
const API = "/api";

const api = {
  // KEYS
  getKeys:       ()        => fetch(`${API}/keys`).then(r=>r.json()),
  getKey:        (keyStr)  => fetch(`${API}/keys/by-key/${encodeURIComponent(keyStr)}`).then(r=>r.ok?r.json():null),
  getKeyByUser:  (username)=> fetch(`${API}/keys/by-username/${encodeURIComponent(username)}`).then(r=>r.ok?r.json():null),
  generateKeys:  (count)   => fetch(`${API}/keys/generate`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({count})}).then(r=>r.json()),
  deleteKeys:    (ids)     => fetch(`${API}/keys`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids})}).then(r=>r.json()),
  updateKey:     (id,data) => fetch(`${API}/keys/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}).then(r=>r.json()),
  // UPGRADE REQUESTS
  getUpgradeRequests:    ()      => fetch(`${API}/upgrade-requests`).then(r=>r.json()),
  createUpgradeRequest:  (data)  => fetch(`${API}/upgrade-requests`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}).then(r=>r.json()),
  updateUpgradeRequest:  (id,d)  => fetch(`${API}/upgrade-requests/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(r=>r.json()),
  // RENEW REQUESTS
  getRenewRequests:    ()      => fetch(`${API}/renew-requests`).then(r=>r.json()),
  createRenewRequest:  (data)  => fetch(`${API}/renew-requests`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)}).then(r=>r.json()),
  updateRenewRequest:  (id,d)  => fetch(`${API}/renew-requests/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(r=>r.json()),
  // MAKERS
  getMakers:     ()    => fetch(`${API}/makers`).then(r=>r.json()),
  createMaker:   (d)   => fetch(`${API}/makers`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(r=>r.json()),
  updateMaker:   (id,d)=> fetch(`${API}/makers/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(r=>r.json()),
  deleteMaker:   (id)  => fetch(`${API}/makers/${id}`,{method:"DELETE"}).then(r=>r.json()),
  // PAYOUTS
  getPayouts:      ()    => fetch(`${API}/payouts`).then(r=>r.json()),
  getMakerPayouts: (mid) => fetch(`${API}/payouts/maker/${mid}`).then(r=>r.json()),
  createPayout:    (d)   => fetch(`${API}/payouts`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(r=>r.json()),
  updatePayout:    (id,d)=> fetch(`${API}/payouts/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(r=>r.json()),
  // SETTINGS
  getSettings:    ()  => fetch(`${API}/settings`).then(r=>r.json()),
  updateSettings: (d) => fetch(`${API}/settings`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)}).then(r=>r.json()),
  // AUTH
  checkKey: (k) => fetch(`${API}/auth/check-key/${encodeURIComponent(k)}`).then(r=>r.json()),
  // UPLOAD
  uploadFiles: (files) => {
    const fd = new FormData();
    files.forEach(f => fd.append("files", f));
    return fetch(`${API}/upload`, { method:"POST", body:fd }).then(r=>r.json());
  },
};

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {id:"upgrade",label:"Upgrade",emoji:"⚡"},
  {id:"renew",  label:"Renew",  emoji:"🔄"},
  {id:"keyinfo",label:"Key Info",emoji:"🔑"},
  {id:"status", label:"Status",  emoji:"📡"},
];

function Badge({status}){
  const map={
    available:   {bg:"#ECFDF5",color:"#065F46",dot:"#059669",label:"Available"},
    active:      {bg:"#ECFDF5",color:"#065F46",dot:"#059669",label:"Active"},
    used_upgrade:{bg:"#EFF6FF",color:"#1E3A8A",dot:"#1D4ED8",label:"Used – Upgrade"},
    used_renew:  {bg:"#F5F3FF",color:"#4C1D95",dot:"#7C3AED",label:"Used – Renew"},
    cooldown:    {bg:"#FFFBEB",color:"#92400E",dot:"#D97706",label:"Cooldown"},
    expired:     {bg:"#FEF2F2",color:"#991B1B",dot:"#DC2626",label:"Expired"},
    pending:     {bg:"#FFFBEB",color:"#92400E",dot:"#D97706",label:"Pending"},
    approved:    {bg:"#ECFDF5",color:"#065F46",dot:"#059669",label:"Approved"},
    declined:    {bg:"#FEF2F2",color:"#991B1B",dot:"#DC2626",label:"Declined"},
    processing:  {bg:"#EFF6FF",color:"#1E3A8A",dot:"#1D4ED8",label:"Processing"},
  };
  const s=map[status]||{bg:C.surfaceAlt,color:C.textMuted,dot:C.textMuted,label:status};
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:999,
      background:s.bg,color:s.color,fontSize:11,fontWeight:700,whiteSpace:"nowrap"}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:s.dot,display:"inline-block"}}/>
      {s.label}
    </span>
  );
}

function Spinner({size=16,color=C.violet}){
  return(
    <svg style={{animation:"spin 0.8s linear infinite",width:size,height:size,display:"block",flexShrink:0}}
      viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke={`${color}40`} strokeWidth="3"/>
      <path d="M4 12a8 8 0 018-8" stroke={color} strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

function Field({label,placeholder,value,onChange,type="text",hint,readOnly,autoFocus,error}){
  const [focused,setFocused]=useState(false);
  return(
    <div style={{display:"flex",flexDirection:"column",gap:5}}>
      {label&&<label style={{fontSize:12,fontWeight:700,color:C.textSub,letterSpacing:"0.03em",textTransform:"uppercase"}}>{label}</label>}
      <input type={type} placeholder={placeholder} value={value}
        onChange={e=>onChange&&onChange(e.target.value)}
        onFocus={()=>setFocused(true)} onBlur={()=>setFocused(false)}
        readOnly={readOnly} autoFocus={autoFocus}
        style={{background:readOnly?C.surfaceAlt:C.surface,
          border:`1.5px solid ${error?C.red:focused&&!readOnly?C.violet:C.border}`,
          borderRadius:10,padding:"10px 13px",fontSize:14,color:C.text,outline:"none",
          transition:"border-color 0.15s",width:"100%",boxSizing:"border-box",
          cursor:readOnly?"default":"text"}}/>
      {error&&<p style={{fontSize:12,color:C.red,margin:0,fontWeight:500}}>{error}</p>}
      {hint&&!error&&<p style={{fontSize:12,color:C.textMuted,margin:0}}>{hint}</p>}
    </div>
  );
}

function Card({children,style={},onClick}){
  return(
    <div onClick={onClick} style={{background:C.surface,border:`1px solid ${C.border}`,
      borderRadius:16,boxShadow:"0 1px 3px rgba(0,0,0,0.06),0 4px 12px rgba(0,0,0,0.04)",
      cursor:onClick?"pointer":"default",...style}}>
      {children}
    </div>
  );
}

function Btn({children,onClick,disabled,loading,variant="primary",size="md",color}={}){
  const variants={
    primary:{bg:color||C.violet,c:"#fff",border:"none"},
    secondary:{bg:C.surface,c:C.textSub,border:`1px solid ${C.border}`},
    success:{bg:C.green,c:"#fff",border:"none"},
    danger:{bg:C.red,c:"#fff",border:"none"},
    ghost:{bg:"transparent",c:C.violet,border:`1px solid ${C.violet}30`},
  };
  const sizes={sm:{p:"7px 14px",fs:12},md:{p:"10px 18px",fs:13},lg:{p:"13px 0",fs:14}};
  const v=variants[variant]||variants.primary;
  const sz=sizes[size]||sizes.md;
  const isDisabled=disabled||loading;
  return(
    <button onClick={!isDisabled?onClick:undefined} disabled={isDisabled}
      style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:7,
        padding:sz.p,borderRadius:10,background:isDisabled?"#D1D5DB":v.bg,
        color:isDisabled?"#9CA3AF":v.c,fontSize:sz.fs,fontWeight:700,
        border:isDisabled?`1px solid #E5E7EB`:v.border,cursor:isDisabled?"not-allowed":"pointer",
        transition:"all 0.15s",width:size==="lg"?"100%":"auto",whiteSpace:"nowrap"}}>
      {loading&&<Spinner size={14} color={v.c==="white"||v.c==="#fff"?"white":C.violet}/>}
      {children}
    </button>
  );
}

function Modal({title,children,onClose,width=480}){
  return(
    <div style={{position:"fixed",inset:0,zIndex:9000,background:"rgba(12,14,20,0.55)",
      backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:C.surface,borderRadius:20,border:`1px solid ${C.border}`,
        boxShadow:"0 24px 64px rgba(0,0,0,0.18)",width:"100%",maxWidth:width,
        maxHeight:"90vh",overflowY:"auto"}}>
        {title&&(
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
            padding:"20px 24px",borderBottom:`1px solid ${C.border}`}}>
            <h3 style={{margin:0,fontSize:16,fontWeight:800,color:C.text}}>{title}</h3>
            <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",
              color:C.textMuted,fontSize:20,lineHeight:1,padding:4}}>✕</button>
          </div>
        )}
        <div style={{padding:24}}>{children}</div>
      </div>
    </div>
  );
}

function InfoBox({type="info",children}){
  const map={
    info:{bg:C.blueLight,border:C.blueBorder,color:C.blueText,icon:"ℹ"},
    warn:{bg:C.amberLight,border:C.amberBorder,color:C.amberText,icon:"⚠"},
    success:{bg:C.greenLight,border:C.greenBorder,color:C.greenText,icon:"✓"},
    error:{bg:C.redLight,border:C.redBorder,color:C.redText,icon:"✕"},
  };
  const s=map[type];
  return(
    <div style={{display:"flex",alignItems:"flex-start",gap:10,padding:"12px 14px",
      background:s.bg,border:`1px solid ${s.border}`,borderRadius:12,color:s.color}}>
      <span style={{flexShrink:0,fontWeight:700,fontSize:14,marginTop:0}}>{s.icon}</span>
      <div style={{fontSize:13,lineHeight:1.6}}>{children}</div>
    </div>
  );
}

function StepBar({step,total,labels,color=C.violet}){
  return(
    <div style={{marginBottom:24}}>
      <div style={{display:"flex",alignItems:"center"}}>
        {Array.from({length:total}).map((_,i)=>{
          const done=i<step,active=i===step;
          return(
            <div key={i} style={{display:"flex",alignItems:"center",flex:i<total-1?1:"none"}}>
              <div style={{width:26,height:26,borderRadius:"50%",display:"flex",alignItems:"center",
                justifyContent:"center",flexShrink:0,
                background:done||active?color:C.surfaceAlt,
                border:`2px solid ${done||active?color:C.border}`,
                fontSize:10,fontWeight:800,color:done||active?"#fff":C.textMuted,transition:"all 0.3s"}}>
                {done?"✓":i+1}
              </div>
              {i<total-1&&<div style={{flex:1,height:2,background:done?color:C.border,margin:"0 3px",transition:"background 0.3s"}}/>}
            </div>
          );
        })}
      </div>
      {labels&&(
        <div style={{display:"flex",marginTop:6}}>
          {labels.map((l,i)=>(
            <div key={i} style={{flex:1,textAlign:"center"}}>
              <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",
                color:i===step?color:i<step?C.textSub:C.textMuted}}>{l}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── COUNTRY SELECT ───────────────────────────────────────────────────────────
const COUNTRIES=[
  {code:"AF",name:"Afghanistan"},{code:"AL",name:"Albania"},{code:"DZ",name:"Algeria"},
  {code:"AR",name:"Argentina"},{code:"AU",name:"Australia"},{code:"AT",name:"Austria"},
  {code:"BH",name:"Bahrain"},{code:"BD",name:"Bangladesh"},{code:"BE",name:"Belgium"},
  {code:"BR",name:"Brazil"},{code:"BG",name:"Bulgaria"},{code:"CA",name:"Canada"},
  {code:"CL",name:"Chile"},{code:"CN",name:"China"},{code:"CO",name:"Colombia"},
  {code:"HR",name:"Croatia"},{code:"CZ",name:"Czech Republic"},{code:"DK",name:"Denmark"},
  {code:"EG",name:"Egypt"},{code:"EE",name:"Estonia"},{code:"FI",name:"Finland"},
  {code:"FR",name:"France"},{code:"DE",name:"Germany"},{code:"GH",name:"Ghana"},
  {code:"GR",name:"Greece"},{code:"HK",name:"Hong Kong"},{code:"HU",name:"Hungary"},
  {code:"IN",name:"India"},{code:"ID",name:"Indonesia"},{code:"IE",name:"Ireland"},
  {code:"IL",name:"Israel"},{code:"IT",name:"Italy"},{code:"JP",name:"Japan"},
  {code:"JO",name:"Jordan"},{code:"KZ",name:"Kazakhstan"},{code:"KE",name:"Kenya"},
  {code:"KW",name:"Kuwait"},{code:"LV",name:"Latvia"},{code:"LT",name:"Lithuania"},
  {code:"MY",name:"Malaysia"},{code:"MX",name:"Mexico"},{code:"MA",name:"Morocco"},
  {code:"NL",name:"Netherlands"},{code:"NZ",name:"New Zealand"},{code:"NG",name:"Nigeria"},
  {code:"NO",name:"Norway"},{code:"OM",name:"Oman"},{code:"PK",name:"Pakistan"},
  {code:"PE",name:"Peru"},{code:"PH",name:"Philippines"},{code:"PL",name:"Poland"},
  {code:"PT",name:"Portugal"},{code:"QA",name:"Qatar"},{code:"RO",name:"Romania"},
  {code:"RU",name:"Russia"},{code:"SA",name:"Saudi Arabia"},{code:"RS",name:"Serbia"},
  {code:"SG",name:"Singapore"},{code:"ZA",name:"South Africa"},{code:"KR",name:"South Korea"},
  {code:"ES",name:"Spain"},{code:"LK",name:"Sri Lanka"},{code:"SE",name:"Sweden"},
  {code:"CH",name:"Switzerland"},{code:"TW",name:"Taiwan"},{code:"TH",name:"Thailand"},
  {code:"TR",name:"Turkey"},{code:"UA",name:"Ukraine"},{code:"AE",name:"United Arab Emirates"},
  {code:"GB",name:"United Kingdom"},{code:"US",name:"United States"},
  {code:"UZ",name:"Uzbekistan"},{code:"VN",name:"Vietnam"},{code:"ZW",name:"Zimbabwe"},
];

function CountrySelect({value,onChange,accentColor=C.violet}){
  const [search,setSearch]=useState("");
  const [open,setOpen]=useState(false);
  const sel=COUNTRIES.find(c=>c.code===value);
  const filtered=COUNTRIES.filter(c=>
    c.name.toLowerCase().includes(search.toLowerCase())||c.code.toLowerCase().includes(search.toLowerCase())
  );
  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"10px 13px",borderRadius:10,
        textAlign:"left",cursor:"pointer",background:C.surface,
        border:`1.5px solid ${open?accentColor:C.border}`,fontSize:14,
        color:sel?C.text:C.textMuted,display:"flex",alignItems:"center",
        justifyContent:"space-between",boxSizing:"border-box"}}>
        <span>{sel?sel.name:"Select country..."}</span>
        <span style={{fontSize:10,color:C.textMuted,transform:open?"rotate(180deg)":"none",
          transition:"transform 0.2s",display:"inline-block"}}>▼</span>
      </button>
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:500,
          background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,
          boxShadow:"0 8px 30px rgba(0,0,0,0.14)",overflow:"hidden"}}>
          <div style={{padding:"8px 8px 4px"}}>
            <input autoFocus placeholder="Search..." value={search}
              onChange={e=>setSearch(e.target.value)}
              style={{width:"100%",padding:"7px 11px",borderRadius:8,border:`1.5px solid ${C.border}`,
                fontSize:13,color:C.text,background:C.surfaceAlt,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <div style={{maxHeight:200,overflowY:"auto"}}>
            {filtered.length===0&&<p style={{textAlign:"center",padding:"14px 0",color:C.textMuted,fontSize:13,margin:0}}>Not found</p>}
            {filtered.map(c=>(
              <button key={c.code} onClick={()=>{onChange(c.code);setOpen(false);setSearch("");}}
                style={{width:"100%",padding:"8px 13px",textAlign:"left",cursor:"pointer",fontSize:13,
                  background:c.code===value?C.violetLight:"transparent",
                  color:c.code===value?C.violet:C.text,border:"none",fontWeight:c.code===value?700:400,
                  display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span>{c.name}</span>
                <span style={{fontSize:11,color:C.textMuted}}>{c.code}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── FILE UPLOAD ──────────────────────────────────────────────────────────────
// ─── PROOF FILE VIEWER ────────────────────────────────────────────────────────
function ProofViewer({urls=[],dark=false}){
  const [lightbox,setLightbox]=useState(null);
  if(!urls||urls.length===0)return<span style={{fontSize:12,color:dark?"#6B7280":C.textMuted}}>No files attached</span>;
  const isVideo=u=>u.match(/\.(mp4|webm|mov)$/i);
  const bg=dark?"#0F1117":C.surfaceAlt;
  const border=dark?"#1E2536":C.border;
  return(
    <>
      {lightbox!==null&&(
        <div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,zIndex:99999,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center",padding:20,cursor:"zoom-out"}}>
          {isVideo(urls[lightbox])
            ?<video src={urls[lightbox]} controls autoPlay style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:12}}/>
            :<img src={urls[lightbox]} alt="proof" style={{maxWidth:"90vw",maxHeight:"90vh",borderRadius:12,objectFit:"contain"}}/>}
          <button onClick={()=>setLightbox(null)} style={{position:"fixed",top:20,right:24,background:"none",border:"none",color:"#fff",fontSize:28,cursor:"pointer",lineHeight:1}}>✕</button>
        </div>
      )}
      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:6}}>
        {urls.map((u,i)=>(
          <div key={i} onClick={()=>setLightbox(i)}
            style={{width:80,height:80,borderRadius:8,border:`1px solid ${border}`,background:bg,
              overflow:"hidden",cursor:"zoom-in",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
            {isVideo(u)
              ?<div style={{textAlign:"center",padding:4}}><div style={{fontSize:22}}>🎬</div><p style={{margin:0,fontSize:9,color:dark?"#9CA3AF":C.textMuted}}>Video</p></div>
              :<img src={u} alt={`proof-${i}`} style={{width:"100%",height:"100%",objectFit:"cover"}}/>}
          </div>
        ))}
      </div>
    </>
  );
}

function FileUpload({files,onChange,accept=".png,.jpg,.jpeg,.webp,.mp4"}){
  const ref=useRef();
  const remove=i=>{const n=[...files];n.splice(i,1);onChange(n);};
  const add=e=>{onChange([...files,...Array.from(e.target.files)]);e.target.value="";};
  const icon=f=>{if(f.type.startsWith("video/"))return "🎬";if(f.type.startsWith("image/"))return "🖼️";return "📄";};
  const sz=b=>b>1024*1024?`${(b/1024/1024).toFixed(1)}MB`:`${Math.round(b/1024)}KB`;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div onClick={()=>ref.current.click()}
        style={{border:`2px dashed ${C.border}`,borderRadius:12,padding:"18px 16px",cursor:"pointer",
          background:C.surfaceAlt,textAlign:"center",transition:"border-color 0.15s"}}
        onMouseEnter={e=>e.currentTarget.style.borderColor=C.green}
        onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
        <p style={{margin:"0 0 3px",fontSize:20}}>📎</p>
        <p style={{margin:"0 0 2px",fontSize:13,fontWeight:700,color:C.text}}>Click to attach proof files</p>
        <p style={{margin:0,fontSize:11,color:C.textMuted}}>PNG · JPEG · WebP · MP4 — max 50MB</p>
        <input ref={ref} type="file" accept={accept} multiple onChange={add} style={{display:"none"}}/>
      </div>
      {files.map((f,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",
          background:C.surface,border:`1px solid ${C.border}`,borderRadius:10}}>
          <span style={{fontSize:16,flexShrink:0}}>{icon(f)}</span>
          <div style={{flex:1,minWidth:0}}>
            <p style={{margin:0,fontSize:12,fontWeight:600,color:C.text,
              overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{f.name}</p>
            <p style={{margin:0,fontSize:11,color:C.textMuted}}>{sz(f.size)}</p>
          </div>
          <button onClick={()=>remove(i)} style={{background:"none",border:"none",cursor:"pointer",
            color:C.textMuted,fontSize:15,padding:"2px 4px",flexShrink:0}}>✕</button>
        </div>
      ))}
    </div>
  );
}

// ─── COOLDOWN UTILS ───────────────────────────────────────────────────────────
function cooldownLeft(until){
  if(!until)return null;
  const ms=new Date(until)-new Date();
  if(ms<=0)return null;
  const d=Math.floor(ms/86400000);
  const h=Math.floor((ms%86400000)/3600000);
  if(d>0)return`${d}d ${h}h`;
  return`${h}h`;
}
function fmtDate(iso){
  if(!iso||iso==="—")return"—";
  return new Date(iso).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
}
function fmtRelTime(iso){
  if(!iso)return"—";
  const diff=Date.now()-new Date(iso).getTime();
  const mins=Math.floor(diff/60000);
  if(mins<1)return"just now";
  if(mins<60)return`${mins} min${mins===1?"":"s"} ago`;
  const hrs=Math.floor(mins/60);
  if(hrs<24)return`${hrs} hr${hrs===1?"":"s"} ago`;
  const days=Math.floor(hrs/24);
  return`${days} day${days===1?"":"s"} ago`;
}

// ════════════════════════════════════════════════════════════════════════════
//  KEY INFO PAGE
// ════════════════════════════════════════════════════════════════════════════
function KeyInfoPage({prefillKey="",onRenew}){
  const [tab,setTab]=useState("key");
  const [keyInput,setKeyInput]=useState(prefillKey);
  const [usernameInput,setUsernameInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);
  const [requests,setRequests]=useState([]);
  const [err,setErr]=useState("");

  const lookup=useCallback(async(q,byUsername=false)=>{
    if(!q.trim())return;
    setLoading(true);setData(null);setErr("");setRequests([]);
    try{
      const found=byUsername
        ?await api.getKeyByUser(q.trim())
        :await api.getKey(q.trim());
      if(!found){setErr("No record found for this "+(byUsername?"username":"key")+".");return;}
      let displayStatus=found.status;
      if(found.cooldownUntil&&new Date(found.cooldownUntil)>new Date())displayStatus="cooldown";
      setData({...found,displayStatus});
      // Fetch all requests for this key to show declined info
      const [upgrades,renewals]=await Promise.all([
        api.getUpgradeRequests(),api.getRenewRequests(),
      ]);
      const keyStr=found.key;
      const allReqs=[
        ...upgrades.filter(r=>r.key===keyStr).map(r=>({...r,_type:"upgrade"})),
        ...renewals.filter(r=>r.key===keyStr).map(r=>({...r,_type:"renew"})),
      ].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
      setRequests(allReqs);
    }catch(e){setErr("Server error. Please try again.");}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{if(prefillKey){setKeyInput(prefillKey);lookup(prefillKey);}},[ prefillKey]);

  const clLeft=data?cooldownLeft(data.cooldownUntil):null;
  const canRenew=data&&data.status==="used_upgrade"&&(!data.cooldownUntil||new Date(data.cooldownUntil)<=new Date());

  return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"32px 16px"}}>
      {/* Header */}
      <div style={{marginBottom:24}}>
        <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:999,
          background:C.blueLight,color:C.blue,fontSize:11,fontWeight:700,
          border:`1px solid ${C.blueBorder}`,marginBottom:12}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:C.blue,animation:"pulse 2s infinite"}}/>
          Lookup System
        </span>
        <h1 style={{fontSize:26,fontWeight:900,color:C.text,margin:"0 0 6px",letterSpacing:"-0.03em"}}>Key Information</h1>
        <p style={{color:C.textSub,fontSize:14,margin:0,lineHeight:1.6}}>Track upgrade status, verify your license key, or look up by Spotify username.</p>
      </div>

      {/* Search */}
      <Card style={{padding:20,marginBottom:16}}>
        <div style={{display:"flex",gap:3,background:C.bg,borderRadius:10,padding:3,marginBottom:14}}>
          {[["key","🔑 Check by Key"],["username","👤 Find by Username"]].map(([id,label])=>(
            <button key={id} onClick={()=>{setTab(id);setData(null);setErr("");}} style={{
              flex:1,padding:"8px 0",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",
              background:tab===id?C.violet:"transparent",color:tab===id?"#fff":C.textSub,
              border:"none",transition:"all 0.15s"}}>{label}</button>
          ))}
        </div>
        <div style={{display:"flex",gap:8}}>
          <input type="text"
            placeholder={tab==="key"?"XXXX-XXXX-XXXX-XXXX":"spotify_username"}
            value={tab==="key"?keyInput:usernameInput}
            onChange={e=>tab==="key"?setKeyInput(e.target.value):setUsernameInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&lookup(tab==="key"?keyInput:usernameInput,tab==="username")}
            style={{flex:1,background:C.surfaceAlt,border:`1.5px solid ${C.border}`,borderRadius:10,
              padding:"10px 13px",fontSize:14,color:C.text,outline:"none",boxSizing:"border-box"}}/>
          <Btn onClick={()=>lookup(tab==="key"?keyInput:usernameInput,tab==="username")}
            disabled={!(tab==="key"?keyInput:usernameInput)} loading={loading}>
            Search
          </Btn>
        </div>
        {err&&<p style={{margin:"10px 0 0",fontSize:13,color:C.red,fontWeight:600}}>{err}</p>}
      </Card>

      {/* Result */}
      {data&&(
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          {/* Declined request banners */}
          {requests.filter(r=>r.status==="declined").map(r=>(
            <div key={r._id} style={{padding:"14px 16px",borderRadius:14,background:C.redLight,
              border:`1px solid ${C.redBorder}`,display:"flex",gap:12,alignItems:"flex-start"}}>
              <span style={{fontSize:20,flexShrink:0}}>❌</span>
              <div>
                <p style={{margin:"0 0 3px",fontSize:13,fontWeight:800,color:C.redText}}>
                  {r._type==="renew"?"Renewal":"Upgrade"} Request Declined
                  <span style={{fontSize:11,fontWeight:500,marginLeft:8,opacity:0.7}}>{fmtDate(r.createdAt)}</span>
                </p>
                {r.declineReason
                  ?<p style={{margin:0,fontSize:13,color:C.redText}}><strong>Reason:</strong> {r.declineReason}</p>
                  :<p style={{margin:0,fontSize:12,color:C.redText,opacity:0.8}}>No reason provided. Contact support.</p>}
              </div>
            </div>
          ))}
          {/* Status banner */}
          {data.displayStatus==="cooldown"&&(
            <InfoBox type="warn">
              <strong>Key on cooldown</strong> — This key was recently used and cannot be used for another upgrade.
              Cooldown expires in <strong>{clLeft}</strong>.
            </InfoBox>
          )}
          {data.displayStatus==="processing"&&(
            <InfoBox type="info">
              <strong>Processing</strong> — Your request is currently being processed by our team.
            </InfoBox>
          )}

          {/* Main stat cards */}
          <div className="stat-grid" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:4}}>
            {[
              {label:"Spotify Username",value:data.usedByUsername||"—",icon:"👤",color:C.violet},
              {label:"Key Status",value:<Badge status={data.displayStatus}/>,icon:"🔑",color:C.blue},
              {label:"Purchase Date",value:fmtDate(data.purchaseDate),icon:"📅",color:C.green},
              {label:"Used Date",value:fmtDate(data.usedDate),icon:"✅",color:C.amber},
            ].map(({label,value,icon,color})=>(
              <div key={label} style={{padding:"16px",borderRadius:14,background:C.surface,
                border:`1px solid ${C.border}`,display:"flex",alignItems:"flex-start",gap:12}}>
                <div style={{width:36,height:36,borderRadius:10,background:`${color}15`,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                  {icon}
                </div>
                <div>
                  <p style={{margin:"0 0 3px",fontSize:11,fontWeight:700,color:C.textMuted,
                    textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</p>
                  <div style={{fontSize:13,fontWeight:700,color:C.text}}>{value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Cooldown time card */}
          <div style={{padding:"16px",borderRadius:14,background:clLeft?C.amberLight:C.greenLight,
            border:`1px solid ${clLeft?C.amberBorder:C.greenBorder}`,
            display:"flex",alignItems:"center",gap:14}}>
            <div style={{width:40,height:40,borderRadius:12,
              background:clLeft?"#FDE68A":"#A7F3D0",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>
              ⏳
            </div>
            <div>
              <p style={{margin:"0 0 2px",fontSize:11,fontWeight:700,
                color:clLeft?C.amberText:C.greenText,textTransform:"uppercase",letterSpacing:"0.06em"}}>Cooldown Time</p>
              <p style={{margin:0,fontSize:16,fontWeight:800,color:clLeft?C.amberText:C.greenText}}>
                {clLeft?`${clLeft} remaining`:"No cooldown — Key ready"}
              </p>
            </div>
          </div>

          {/* Details card */}
          <Card style={{padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <p style={{fontSize:10,fontWeight:800,color:C.textMuted,letterSpacing:"0.12em",textTransform:"uppercase",margin:"0 0 3px"}}>License Key</p>
                <p style={{fontSize:15,fontFamily:"monospace",fontWeight:800,color:C.text,letterSpacing:"0.08em",margin:0}}>{data.key}</p>
              </div>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                <Badge status={data.displayStatus}/>
                <button onClick={()=>navigator.clipboard?.writeText(data.key)}
                  style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:16,padding:0}}>📋</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
              {[
                ["Account Email",data.usedByEmail||"—"],["Plan",data.plan||"—"],
                ["Upgrade Type",data.upgradeType||"—"],["Country",data.country||"—"],
                ["Address",data.address||"—"],["Used For",data.usedFor||"—"],
              ].map(([lbl,val])=>(
                <div key={lbl} style={{padding:"10px 12px",borderRadius:10,background:C.surfaceAlt,border:`1px solid ${C.border}`}}>
                  <p style={{fontSize:10,color:C.textMuted,margin:"0 0 3px",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em"}}>{lbl}</p>
                  <p style={{fontSize:13,color:C.text,fontWeight:600,margin:0,wordBreak:"break-all"}}>{val}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Actions */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            {canRenew&&(
              <Btn variant="success" onClick={()=>onRenew(data.key)}>🔄 Renew This Key</Btn>
            )}
            <Btn variant="secondary" onClick={()=>navigator.clipboard?.writeText(data.key)}>📋 Copy Key</Btn>
          </div>
        </div>
      )}

      {!data&&!loading&&!err&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"60px 0",textAlign:"center"}}>
          <div style={{width:64,height:64,borderRadius:20,background:C.surfaceAlt,border:`1px solid ${C.border}`,
            display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:14}}>🔑</div>
          <p style={{color:C.textMuted,fontSize:14,margin:0}}>Enter a key or username above to view details</p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  PROCESSING SCREEN (shared by upgrade & renew)
// ════════════════════════════════════════════════════════════════════════════
function ProcessingScreen({type,keyStr,onViewStatus,onBack}){
  const [status,setStatus]=useState("pending"); // pending / approved / declined
  const [last,setLast]=useState(new Date());
  const steps={
    upgrade:[
      {label:"Request validated and queued"},
      {label:"Processing your upgrade..."},
      {label:"Account upgraded successfully"},
    ],
    renew:[
      {label:"Request validated and queued"},
      {label:"Revoking old account access..."},
      {label:"Account renewed successfully"},
    ],
  }[type]||[];

  // Poll real status every 10 seconds
  useEffect(()=>{
    const poll=async()=>{
      try{
        const getReqs = type==="renew"?api.getRenewRequests:api.getUpgradeRequests;
        const reqs=await getReqs();
        const match=reqs.find(r=>r.key===keyStr);
        if(match)setStatus(match.status);
        setLast(new Date());
      }catch{}
    };
    poll();
    const iv=setInterval(poll,10000);
    return()=>clearInterval(iv);
  },[keyStr,type]);

  const done=status==="approved";
  const declined=status==="declined";
  const s=done?2:status==="processing"?1:0;
  const accentColor=type==="renew"?C.green:C.violet;
  const fmt=d=>d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  return(
    <div style={{maxWidth:860,margin:"0 auto",padding:"32px 16px"}}>
      <div className="processing-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
        {/* Left */}
        <Card style={{padding:28}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:22}}>
            <div style={{width:48,height:48,borderRadius:14,
              background:done?C.greenLight:declined?C.redLight:C.amberLight,
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:24}}>
              {done?"✅":declined?"❌":"⏳"}
            </div>
            <div>
              <h2 style={{margin:"0 0 3px",fontSize:18,fontWeight:800,color:C.text}}>
                {done?(type==="renew"?"Renewal Complete!":"Upgrade Complete!"):declined?"Request Declined":(type==="renew"?"Renewal In Progress":"Upgrade In Progress")}
              </h2>
              <p style={{margin:0,fontSize:13,color:C.textSub}}>
                {done?"Your account is now Premium":declined?"Your request was declined by admin":"Processing your Spotify account..."}
              </p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:12,marginBottom:18,
            background:done?C.greenLight:declined?C.redLight:"#FFFBEB",
            border:`1px solid ${done?C.greenBorder:declined?C.redBorder:C.amberBorder}`}}>
            <span style={{flexShrink:0}}>
              {done?<span style={{color:C.green,fontSize:16,fontWeight:700}}>✓</span>:declined?<span style={{color:C.red,fontSize:16,fontWeight:700}}>✕</span>:<Spinner size={14} color={C.amber}/>}
            </span>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:done?C.greenText:declined?C.redText:C.amber}}>
              {done?"Successful — Premium is now active":declined?"Declined — Contact support for help":"In Queue — Waiting for admin to process"}
            </p>
          </div>
          <div style={{marginBottom:18}}>
            <p style={{fontSize:10,fontWeight:800,color:C.textMuted,letterSpacing:"0.1em",textTransform:"uppercase",margin:"0 0 7px"}}>
              {type==="renew"?"Renewal":"Upgrade"} Key
            </p>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 13px",
              background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:10}}>
              <span style={{flex:1,fontFamily:"monospace",fontSize:13,fontWeight:700,color:C.text}}>{keyStr}</span>
              <button onClick={()=>navigator.clipboard?.writeText(keyStr)}
                style={{background:"none",border:"none",cursor:"pointer",color:C.textMuted,fontSize:15,padding:0}}>📋</button>
            </div>
          </div>
          {!done&&!declined&&(
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 13px",
              background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:10}}>
              <Spinner size={12} color={accentColor}/>
              <div>
                <p style={{margin:0,fontSize:12,fontWeight:700,color:accentColor}}>Checking every 10 seconds</p>
                <p style={{margin:"1px 0 0",fontSize:11,color:C.textMuted}}>Last checked: {fmt(last)}</p>
              </div>
            </div>
          )}
        </Card>
        {/* Right */}
        <Card style={{padding:28}}>
          <h3 style={{margin:"0 0 6px",fontSize:16,fontWeight:800,color:C.text}}>What's happening?</h3>
          <p style={{margin:"0 0 18px",fontSize:13,color:C.textSub,lineHeight:1.7}}>
            {type==="renew"
              ?"Your renewal request has been submitted. We're revoking the old account and activating Premium. Usually takes 5–10 minutes."
              :"Your upgrade request has been submitted. We're processing your account now. Usually takes 5–10 minutes."}
          </p>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:22}}>
            {steps.map((step,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:20,height:20,borderRadius:"50%",flexShrink:0,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  background:i<=s?C.green:C.surfaceAlt,
                  border:`1.5px solid ${i<=s?C.green:C.border}`,transition:"all 0.4s"}}>
                  {i<=s?<span style={{color:"#fff",fontSize:9,fontWeight:800}}>✓</span>
                    :<span style={{width:5,height:5,borderRadius:"50%",background:C.border,display:"block"}}/>}
                </div>
                <span style={{fontSize:13,color:i<=s?C.text:C.textMuted,fontWeight:i<=s?600:400,transition:"all 0.4s"}}>{step.label}</span>
              </div>
            ))}
          </div>
          <Btn variant="success" size="lg" onClick={onViewStatus} style={{marginBottom:10}}>
            🔍 View Detailed Status Page
          </Btn>
          <p style={{textAlign:"center",fontSize:12,color:C.textMuted,margin:"8px 0 14px"}}>
            Bookmark the status page to track progress later.
          </p>
          <div style={{borderTop:`1px solid ${C.border}`,paddingTop:14}}>
            <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",
              color:accentColor,fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:5,padding:0}}>
              ← Back to {type==="renew"?"Renew":"Upgrade"}
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  UPGRADE PAGE
// ════════════════════════════════════════════════════════════════════════════
function UpgradePage({onViewStatus,onAdminLogin,onMakerLogin}){
  const [step,setStep]=useState(0);
  const [key,setKey]=useState("");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [country,setCountry]=useState("");
  const [loading,setLoading]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [reqId,setReqId]=useState(null);
  const [keyErr,setKeyErr]=useState("");

  const validateKey=async()=>{
    setKeyErr("");setLoading(true);
    try{
      const auth=await api.checkKey(key.trim());
      if(auth.type==="admin"){onAdminLogin&&onAdminLogin();return;}
      if(auth.type==="maker"){onMakerLogin&&onMakerLogin(auth.maker);return;}
      const k=auth.key;
      if(!k){setKeyErr("Key not found. Please check and try again.");return;}
      if(k.status!=="available"){
        if(k.status==="used_upgrade"||k.status==="used_renew"){setKeyErr("This key has already been used and cannot be used for a new upgrade.");}
        else if(k.cooldownUntil&&new Date(k.cooldownUntil)>new Date()){
          setKeyErr(`Key is on cooldown for ${cooldownLeft(k.cooldownUntil)} more.`);
        } else {setKeyErr("This key is not available for upgrade.");}
        return;
      }
      setStep(1);
    }catch(e){setKeyErr("Server error. Please try again.");}
    finally{setLoading(false);}
  };

  const handleSubmit=async()=>{
    setLoading(true);
    try{
      const req=await api.createUpgradeRequest({key:key.trim(),email,password:pass,country});
      const k=await api.getKey(key.trim());
      if(k)await api.updateKey(k._id,{status:"processing"});
      setReqId(req._id);setSubmitted(true);
    }catch(e){setKeyErr("Server error. Please try again.");}
    finally{setLoading(false);}
    return; // replaces setTimeout block below
  };

  const reset=()=>{setStep(0);setKey("");setEmail("");setPass("");setCountry("");setSubmitted(false);setReqId(null);setKeyErr("");};

  if(submitted)return <ProcessingScreen type="upgrade" keyStr={key} onViewStatus={()=>onViewStatus(key)} onBack={reset}/>;

  const labels=["License Key","Account","Country"];
  return(
    <div style={{maxWidth:540,margin:"0 auto",padding:"32px 16px"}}>
      <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:999,
        background:C.violetLight,color:C.violet,fontSize:11,fontWeight:700,
        border:`1px solid ${C.violet}30`,marginBottom:14}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:C.violet,animation:"pulse 2s infinite"}}/>
        Automated System Online
      </span>
      <h1 style={{fontSize:26,fontWeight:900,color:C.text,margin:"0 0 6px",letterSpacing:"-0.03em"}}>Upgrade Your Account</h1>
      <p style={{color:C.textSub,fontSize:14,margin:"0 0 24px",lineHeight:1.6}}>Follow the steps below to activate Spotify Premium instantly.</p>

      <Card style={{padding:26}}>
        <StepBar step={step} total={3} labels={labels}/>

        {step===0&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{textAlign:"center",paddingBottom:4}}>
              <div style={{width:52,height:52,borderRadius:16,background:C.violetLight,display:"flex",
                alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26}}>🔑</div>
              <h2 style={{margin:"0 0 5px",fontSize:17,fontWeight:800,color:C.text}}>Enter Your License Key</h2>
              <p style={{margin:0,fontSize:13,color:C.textSub}}>From your purchase confirmation email</p>
            </div>
            <Field placeholder="XXXX-XXXX-XXXX-XXXX" value={key} onChange={v=>{setKey(v);setKeyErr("");}} error={keyErr} autoFocus/>
            <Btn variant="primary" size="lg" onClick={validateKey} disabled={!key.trim()}>Continue →</Btn>
          </div>
        )}

        {step===1&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{textAlign:"center",paddingBottom:4}}>
              <div style={{width:52,height:52,borderRadius:16,background:C.violetLight,display:"flex",
                alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26}}>👤</div>
              <h2 style={{margin:"0 0 5px",fontSize:17,fontWeight:800,color:C.text}}>Spotify Account</h2>
              <p style={{margin:0,fontSize:13,color:C.textSub}}>The account you want to upgrade</p>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 13px",
              background:C.violetLight,borderRadius:10,border:`1px solid ${C.violet}25`}}>
              <span style={{fontSize:13}}>🔑</span>
              <span style={{fontSize:12,color:C.violet,fontWeight:700,fontFamily:"monospace"}}>{key}</span>
            </div>
            <Field label="Email / Username" placeholder="yourname@email.com" value={email} onChange={setEmail}/>
            <Field label="Password" placeholder="••••••••" value={pass} onChange={setPass} type="password"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Btn variant="secondary" size="lg" onClick={()=>setStep(0)}>← Back</Btn>
              <Btn variant="primary" size="lg" onClick={()=>setStep(2)} disabled={!email.trim()||!pass.trim()}>Continue →</Btn>
            </div>
          </div>
        )}

        {step===2&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{textAlign:"center",paddingBottom:4}}>
              <div style={{width:52,height:52,borderRadius:16,background:C.violetLight,display:"flex",
                alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26}}>🌍</div>
              <h2 style={{margin:"0 0 5px",fontSize:17,fontWeight:800,color:C.text}}>Select Your Country</h2>
              <p style={{margin:0,fontSize:13,color:C.textSub}}>Must match your Spotify account country</p>
            </div>
            <CountrySelect value={country} onChange={setCountry}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Btn variant="secondary" size="lg" onClick={()=>setStep(1)}>← Back</Btn>
              <Btn variant="primary" size="lg" onClick={handleSubmit} disabled={!country} loading={loading}>⚡ Submit Upgrade</Btn>
            </div>
          </div>
        )}
      </Card>

      <div className="three-col" style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:14}}>
        {[["🛡️","No Logs Kept"],["⚡","Instant Process"],["🔁","Free Renewals"]].map(([icon,label])=>(
          <div key={label} style={{display:"flex",flexDirection:"column",alignItems:"center",gap:7,
            padding:"14px 8px",borderRadius:12,background:C.surface,border:`1px solid ${C.border}`,textAlign:"center"}}>
            <span style={{fontSize:18}}>{icon}</span>
            <span style={{fontSize:11,fontWeight:700,color:C.textSub}}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  RENEW PAGE
// ════════════════════════════════════════════════════════════════════════════
function RenewPage({onViewStatus,prefillKey=""}){
  const [step,setStep]=useState(0);
  const [key,setKey]=useState(prefillKey);
  const [oldEmail,setOldEmail]=useState("");
  const [oldPass,setOldPass]=useState("");
  const [showModal,setShowModal]=useState(false);
  const [linkedUsername,setLinkedUsername]=useState("");
  const [newEmail,setNewEmail]=useState("");
  const [newPass,setNewPass]=useState("");
  const [files,setFiles]=useState([]);
  const [country,setCountry]=useState("");
  const [loading,setLoading]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [keyErr,setKeyErr]=useState("");

  const validateKey=async()=>{
    setKeyErr("");setLoading(true);
    try{
      const k=await api.getKey(key.trim());
      if(!k){setKeyErr("Key not found.");return;}
      if(k.status==="available"){setKeyErr("This key hasn't been used for an upgrade yet.");return;}
      if(k.status!=="used_upgrade"){setKeyErr("This key cannot be renewed (not an upgrade key or already renewed).");return;}
      if(k.cooldownUntil&&new Date(k.cooldownUntil)>new Date()){
        setKeyErr(`Key is on cooldown for ${cooldownLeft(k.cooldownUntil)} more.`);return;
      }
      setLinkedUsername(k.usedByUsername||"");
      setStep(1);
    }catch(e){setKeyErr("Server error. Please try again.");}
    finally{setLoading(false);}
  };

  const handleOldNext=()=>setShowModal(true);
  const handleConfirm=()=>{setShowModal(false);setStep(3);};

  const handleSubmit=async()=>{
    setLoading(true);
    try{
      let fileUrls=[];
      if(files.length>0){
        const up=await api.uploadFiles(files);
        fileUrls=up.urls||[];
      }
      await api.createRenewRequest({key:key.trim(),oldEmail,oldPassword:oldPass,newEmail,newPassword:newPass,country,files:fileUrls});
      const k=await api.getKey(key.trim());
      if(k)await api.updateKey(k._id,{status:"processing"});
      setSubmitted(true);
    }catch(e){setKeyErr("Server error. Please try again.");}
    finally{setLoading(false);}
  };

  const reset=()=>{setStep(0);setKey(prefillKey||"");setOldEmail("");setOldPass("");setNewEmail("");setNewPass("");setFiles([]);setCountry("");setSubmitted(false);setKeyErr("");setLinkedUsername("");};

  if(submitted)return <ProcessingScreen type="renew" keyStr={key} onViewStatus={()=>onViewStatus(key)} onBack={reset}/>;

  const labels=["Key","Old Account","Verify","New Account","Proof","Country"];

  return(
    <div style={{maxWidth:540,margin:"0 auto",padding:"32px 16px"}}>
      {showModal&&(
        <Modal title="Confirm Your Account" onClose={()=>setShowModal(false)} width={420}>
          <div style={{textAlign:"center"}}>
            <div style={{width:56,height:56,borderRadius:18,background:C.amberLight,
              display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:28}}>🔎</div>
            <p style={{fontSize:14,color:C.textSub,margin:"0 0 18px",lineHeight:1.6}}>
              We found the following Spotify account linked to your key. Please confirm this is you.
            </p>
            <div style={{background:C.surfaceAlt,border:`1.5px solid ${C.border}`,borderRadius:14,
              padding:"16px 20px",marginBottom:22}}>
              <p style={{margin:"0 0 3px",fontSize:10,fontWeight:800,color:C.textMuted,
                letterSpacing:"0.12em",textTransform:"uppercase"}}>Spotify Username</p>
              <p style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:C.text}}>@{linkedUsername}</p>
              <p style={{margin:0,fontSize:11,color:C.textMuted}}>Retrieved from admin records</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Btn variant="secondary" size="lg" onClick={()=>setShowModal(false)}>Not My Account</Btn>
              <Btn variant="success" size="lg" onClick={handleConfirm}>Yes, That's Me ✓</Btn>
            </div>
          </div>
        </Modal>
      )}

      <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:999,
        background:C.greenLight,color:C.green,fontSize:11,fontWeight:700,
        border:`1px solid ${C.greenBorder}`,marginBottom:14}}>
        <span style={{width:6,height:6,borderRadius:"50%",background:C.green,animation:"pulse 2s infinite"}}/>
        Lifetime Guarantee Active
      </span>
      <h1 style={{fontSize:26,fontWeight:900,color:C.text,margin:"0 0 6px",letterSpacing:"-0.03em"}}>Renew Premium Access</h1>
      <p style={{color:C.textSub,fontSize:14,margin:"0 0 24px",lineHeight:1.6}}>Restore your Premium — covered by your lifetime guarantee.</p>

      <Card style={{padding:26}}>
        <StepBar step={step>2?step-1:step} total={6} labels={labels} color={C.green}/>

        {step===0&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{textAlign:"center"}}>
              <div style={{width:52,height:52,borderRadius:16,background:C.greenLight,display:"flex",
                alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26}}>🔑</div>
              <h2 style={{margin:"0 0 5px",fontSize:17,fontWeight:800,color:C.text}}>Enter License Key</h2>
              <p style={{margin:0,fontSize:13,color:C.textSub}}>Your original purchase key</p>
            </div>
            <Field placeholder="XXXX-XXXX-XXXX-XXXX" value={key} onChange={v=>{setKey(v);setKeyErr("");}} error={keyErr} autoFocus/>
            <Btn variant="success" size="lg" onClick={validateKey} disabled={!key.trim()}>Continue →</Btn>
          </div>
        )}

        {step===1&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{textAlign:"center"}}>
              <div style={{width:52,height:52,borderRadius:16,background:"#FEF3C7",display:"flex",
                alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26}}>📧</div>
              <h2 style={{margin:"0 0 5px",fontSize:17,fontWeight:800,color:C.text}}>Old Spotify Account</h2>
              <p style={{margin:0,fontSize:13,color:C.textSub}}>Credentials of your downgraded account</p>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"9px 13px",
              background:C.greenLight,borderRadius:10,border:`1px solid ${C.greenBorder}`}}>
              <span>🔑</span>
              <span style={{fontSize:12,color:C.green,fontWeight:700,fontFamily:"monospace"}}>{key}</span>
            </div>
            <Field label="Old Email / Username" placeholder="old@email.com" value={oldEmail} onChange={setOldEmail}/>
            <Field label="Old Password" placeholder="••••••••" value={oldPass} onChange={setOldPass} type="password"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Btn variant="secondary" size="lg" onClick={()=>setStep(0)}>← Back</Btn>
              <Btn variant="success" size="lg" onClick={handleOldNext} disabled={!oldEmail.trim()||!oldPass.trim()}>Verify Account →</Btn>
            </div>
          </div>
        )}

        {step===3&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{textAlign:"center"}}>
              <div style={{width:52,height:52,borderRadius:16,background:C.blueLight,display:"flex",
                alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26}}>✨</div>
              <h2 style={{margin:"0 0 5px",fontSize:17,fontWeight:800,color:C.text}}>New Spotify Account</h2>
              <p style={{margin:0,fontSize:13,color:C.textSub}}>New credentials for your renewed account</p>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 13px",
              background:C.greenLight,borderRadius:10,border:`1px solid ${C.greenBorder}`}}>
              <span style={{color:C.green,fontWeight:800}}>✓</span>
              <div>
                <p style={{margin:0,fontSize:11,color:C.green,fontWeight:700}}>Account Verified</p>
                <p style={{margin:0,fontSize:12,color:C.greenText}}>@{linkedUsername}</p>
              </div>
            </div>
            <Field label="New Email" placeholder="new@email.com" value={newEmail} onChange={setNewEmail}/>
            <Field label="New Password" placeholder="••••••••" value={newPass} onChange={setNewPass} type="password"/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Btn variant="secondary" size="lg" onClick={()=>setStep(1)}>← Back</Btn>
              <Btn variant="success" size="lg" onClick={()=>setStep(4)} disabled={!newEmail.trim()||!newPass.trim()}>Continue →</Btn>
            </div>
          </div>
        )}

        {step===4&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{textAlign:"center"}}>
              <div style={{width:52,height:52,borderRadius:16,background:C.orangeLight,display:"flex",
                alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26}}>📸</div>
              <h2 style={{margin:"0 0 5px",fontSize:17,fontWeight:800,color:C.text}}>Revoke Proof</h2>
              <p style={{margin:0,fontSize:13,color:C.textSub}}>Screenshot/recording of Spotify access revocation</p>
            </div>
            <InfoBox type="warn">
              Go to <strong>Spotify → Settings → Apps</strong> and remove third-party access. Then screenshot or record the confirmation screen and attach it here.
            </InfoBox>
            <FileUpload files={files} onChange={setFiles}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Btn variant="secondary" size="lg" onClick={()=>setStep(3)}>← Back</Btn>
              <Btn variant="success" size="lg" onClick={()=>setStep(5)} disabled={files.length===0}>Continue →</Btn>
            </div>
          </div>
        )}

        {step===5&&(
          <div style={{display:"flex",flexDirection:"column",gap:18}}>
            <div style={{textAlign:"center"}}>
              <div style={{width:52,height:52,borderRadius:16,background:C.greenLight,display:"flex",
                alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:26}}>🌍</div>
              <h2 style={{margin:"0 0 5px",fontSize:17,fontWeight:800,color:C.text}}>Select Country</h2>
              <p style={{margin:0,fontSize:13,color:C.textSub}}>Must match your Spotify account country</p>
            </div>
            <CountrySelect value={country} onChange={setCountry} accentColor={C.green}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <Btn variant="secondary" size="lg" onClick={()=>setStep(4)}>← Back</Btn>
              <Btn variant="success" size="lg" onClick={handleSubmit} disabled={!country} loading={loading}>🔄 Submit Renewal</Btn>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN PANEL
// ════════════════════════════════════════════════════════════════════════════
function AdminPanel({onLogout}){
  const [tab,setTab]=useState("keys");
  const [showDecline,setShowDecline]=useState(null);
  const [stats,setStats]=useState({keys:0,upgrades:0,renewals:0,payouts:0});

  useEffect(()=>{
    Promise.all([
      api.getKeys().catch(()=>[]),
      api.getUpgradeRequests().catch(()=>[]),
      api.getRenewRequests().catch(()=>[]),
      api.getPayouts().catch(()=>[]),
    ]).then(([keys,upgrades,renewals,payouts])=>{
      setStats({
        keys: Array.isArray(keys)?keys.length:0,
        upgrades: Array.isArray(upgrades)?upgrades.filter(r=>r.status==="pending").length:0,
        renewals: Array.isArray(renewals)?renewals.filter(r=>r.status==="pending").length:0,
        payouts: Array.isArray(payouts)?payouts.filter(p=>p.status==="pending").length:0,
      });
    });
  },[]);

  const NAV_ITEMS=[
    {id:"keys",label:"Key Management",icon:"🔑",badge:null},
    {id:"upgrades",label:"Upgrade Requests",icon:"⚡",badge:stats.upgrades||null,badgeColor:"#F59E0B"},
    {id:"renewals",label:"Renewal Requests",icon:"🔄",badge:stats.renewals||null,badgeColor:"#10B981"},
    {id:"makers",label:"Manage Makers",icon:"👥",badge:null},
    {id:"payouts",label:"Payout Queue",icon:"💸",badge:stats.payouts||null,badgeColor:"#F59E0B"},
    {id:"settings",label:"Settings",icon:"⚙️",badge:null},
  ];

  return(
    <div style={{minHeight:"100vh",background:"#0A0D14",fontFamily:"Inter,-apple-system,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}*{box-sizing:border-box;}input::placeholder{color:#6B7280;}`}</style>
      {showDecline&&<DeclineModal onConfirm={showDecline.onConfirm} onClose={()=>setShowDecline(null)}/>}
      <div style={{display:"flex",minHeight:"100vh"}}>
        {/* Sidebar */}
        <div className="admin-sidebar" style={{width:240,background:"linear-gradient(180deg,#0D1117 0%,#161B27 100%)",
          borderRight:"1px solid rgba(255,255,255,0.06)",
          display:"flex",flexDirection:"column",padding:"20px 0",flexShrink:0}}>
          <div style={{padding:"0 20px 20px",borderBottom:"1px solid rgba(255,255,255,0.06)",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:36,height:36,borderRadius:10,
                background:"linear-gradient(135deg,#5B21B6,#7C3AED)",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 0 16px rgba(124,58,237,0.5)"}}>
                <span style={{color:"#fff",fontWeight:900,fontSize:16}}>A</span>
              </div>
              <div>
                <p style={{margin:0,fontSize:14,fontWeight:800,color:"#F9FAFB",letterSpacing:"-0.3px"}}>Spotigrader</p>
                <p style={{margin:0,fontSize:10,color:"#7C3AED",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.05em"}}>Admin</p>
              </div>
            </div>
          </div>
          {NAV_ITEMS.map(({id,label,icon,badge,badgeColor})=>(
            <button key={id} onClick={()=>setTab(id)}
              style={{width:"100%",padding:"10px 20px",textAlign:"left",cursor:"pointer",
                background:tab===id?"rgba(124,58,237,0.15)":"transparent",
                color:tab===id?"#A78BFA":"#9CA3AF",
                border:"none",borderLeft:tab===id?"3px solid #7C3AED":"3px solid transparent",
                fontSize:13,fontWeight:tab===id?700:500,
                display:"flex",alignItems:"center",gap:10,transition:"all 0.15s"}}>
              <span style={{fontSize:14}}>{icon}</span>
              <span style={{flex:1}}>{label}</span>
              {badge!=null&&(
                <span style={{background:badgeColor,color:"#fff",fontSize:10,fontWeight:800,
                  borderRadius:20,padding:"2px 7px",lineHeight:"1.4"}}>
                  {badge}
                </span>
              )}
            </button>
          ))}
          <div style={{flex:1}}/>
          {onLogout&&<button onClick={onLogout} style={{margin:"0 20px",padding:"9px 0",borderRadius:8,background:"#1F2937",color:"#9CA3AF",fontSize:12,fontWeight:600,border:"1px solid #374151",cursor:"pointer"}}>← Logout</button>}
        </div>
        {/* Content */}
        <div style={{flex:1,overflowY:"auto",background:"#0A0D14"}}>
          {/* Mobile tab bar for admin */}
          <div className="admin-mobile-tabs" style={{overflowX:"auto",padding:"12px 16px 0",gap:6,flexWrap:"nowrap",borderBottom:"1px solid #1E2536"}}>
            {NAV_ITEMS.map(({id,label,icon,badge,badgeColor})=>(
              <button key={id} onClick={()=>setTab(id)}
                style={{flexShrink:0,padding:"7px 14px",borderRadius:20,fontSize:11,fontWeight:700,cursor:"pointer",border:"none",
                  background:tab===id?"#5B21B6":"#161B27",color:tab===id?"#fff":"#9CA3AF",
                  display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap"}}>
                <span>{icon}</span>{label}
                {badge!=null&&<span style={{background:badgeColor,color:"#fff",fontSize:9,fontWeight:800,borderRadius:20,padding:"1px 5px"}}>{badge}</span>}
              </button>
            ))}
          </div>
          {/* Stats Bar */}
          <div className="stat-grid admin-stats-bar" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,padding:"24px 32px 0"}}>
            {[
              {label:"Total Keys",value:stats.keys,icon:"🔑",color:"#7C3AED",bg:"rgba(124,58,237,0.12)",border:"rgba(124,58,237,0.25)"},
              {label:"Pending Upgrades",value:stats.upgrades,icon:"⚡",color:"#3B82F6",bg:"rgba(59,130,246,0.12)",border:"rgba(59,130,246,0.25)"},
              {label:"Pending Renewals",value:stats.renewals,icon:"🔄",color:"#10B981",bg:"rgba(16,185,129,0.12)",border:"rgba(16,185,129,0.25)"},
              {label:"Pending Payouts",value:stats.payouts,icon:"💸",color:"#F59E0B",bg:"rgba(245,158,11,0.12)",border:"rgba(245,158,11,0.25)"},
            ].map(({label,value,icon,color,bg,border})=>(
              <div key={label} style={{background:"#161B27",border:`1px solid ${border}`,borderRadius:14,padding:"16px 18px",display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:42,height:42,borderRadius:10,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                  {icon}
                </div>
                <div>
                  <p style={{margin:0,fontSize:24,fontWeight:900,color,lineHeight:1}}>{value}</p>
                  <p style={{margin:"3px 0 0",fontSize:11,color:"#6B7280",fontWeight:500}}>{label}</p>
                </div>
              </div>
            ))}
          </div>
          <div style={{padding:"24px 32px"}}>
            {tab==="keys"&&<AdminKeys/>}
            {tab==="upgrades"&&<AdminUpgrades onShowDecline={cb=>setShowDecline(cb)}/>}
            {tab==="renewals"&&<AdminRenewals onShowDecline={cb=>setShowDecline(cb)}/>}
            {tab==="makers"&&<AdminMakers/>}
            {tab==="payouts"&&<AdminPayouts/>}
            {tab==="settings"&&<AdminSettings/>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Admin: Key Detail ────────────────────────────────────────────────────────
function AdminKeyDetail({keyObj,onBack}){
  const [upgradeReqs,setUpgradeReqs]=useState([]);
  const [renewReqs,setRenewReqs]=useState([]);
  const [makers,setMakers]=useState([]);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    const load=async()=>{
      try{
        const [u,r,m]=await Promise.all([api.getUpgradeRequests(),api.getRenewRequests(),api.getMakers()]);
        setUpgradeReqs(u.filter(x=>x.key===keyObj.key));
        setRenewReqs(r.filter(x=>x.key===keyObj.key));
        setMakers(m);
      }finally{setLoading(false);}
    };
    load();
  },[keyObj.key]);

  const getMakerName=(id)=>{
    if(!id)return"—";
    const m=makers.find(x=>x._id===id);
    return m?m.name:`Unknown (${id})`;
  };

  const clLeft=cooldownLeft(keyObj.cooldownUntil);
  const hasCooldown=keyObj.cooldownUntil&&new Date(keyObj.cooldownUntil)>new Date();

  const Row=({label,value,mono=false,highlight})=>(
    <div style={{display:"flex",justifyContent:"space-between",padding:"9px 0",borderBottom:"1px solid #1E2536",gap:12,flexWrap:"wrap"}}>
      <span style={{fontSize:12,color:"#6B7280",fontWeight:600,flexShrink:0}}>{label}</span>
      <span style={{fontSize:12,fontWeight:700,fontFamily:mono?"monospace":"inherit",wordBreak:"break-all",textAlign:"right",
        color:highlight||"#E5E7EB"}}>{value||"—"}</span>
    </div>
  );

  const Section=({title,children})=>(
    <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,padding:20,marginBottom:16}}>
      <p style={{margin:"0 0 14px",fontSize:11,fontWeight:800,color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.1em"}}>{title}</p>
      {children}
    </div>
  );

  return(
    <div>
      <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:"#9CA3AF",
        fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5,padding:0,marginBottom:20}}>
        ← Back to Keys
      </button>

      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:24}}>
        <div>
          <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:900,color:"#F9FAFB",fontFamily:"monospace",letterSpacing:"0.06em"}}>{keyObj.key}</h2>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <Badge status={keyObj.status}/>
            {hasCooldown&&<span style={{fontSize:11,color:"#FCD34D",fontWeight:600}}>⏳ Cooldown: {clLeft}</span>}
          </div>
        </div>
        <div style={{flex:1}}/>
        {hasCooldown&&(
          <button onClick={async()=>{await api.updateKey(keyObj._id,{cooldownUntil:null});onBack();}}
            style={{padding:"7px 14px",borderRadius:8,background:"#1C1917",color:"#FCD34D",fontSize:12,fontWeight:700,border:"1px solid #78350F",cursor:"pointer"}}>
            ⏳ Clear Cooldown
          </button>
        )}
        <button onClick={()=>navigator.clipboard?.writeText(keyObj.key)}
          style={{padding:"7px 14px",borderRadius:8,background:"#1F2937",color:"#9CA3AF",fontSize:12,fontWeight:700,border:"1px solid #374151",cursor:"pointer"}}>
          📋 Copy
        </button>
      </div>

      <div className="two-col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:4}}>
        {/* Key Details */}
        <Section title="Key Details">
          <Row label="Status" value={keyObj.status?.replace(/_/g," ")} highlight={keyObj.status==="available"?"#6EE7B7":keyObj.status==="used_upgrade"?"#A78BFA":"#9CA3AF"}/>
          <Row label="Used For" value={keyObj.usedFor}/>
          <Row label="Purchase Date" value={fmtDate(keyObj.purchaseDate)}/>
          <Row label="Used Date" value={fmtDate(keyObj.usedDate)}/>
          <Row label="Cooldown Until" value={keyObj.cooldownUntil?new Date(keyObj.cooldownUntil).toLocaleString():"None"} highlight={hasCooldown?"#FCD34D":undefined}/>
        </Section>

        {/* Account Details */}
        <Section title="Account Details">
          <Row label="Spotify Email" value={keyObj.usedByEmail}/>
          <Row label="Spotify Username" value={keyObj.usedByUsername?`@${keyObj.usedByUsername}`:null} highlight="#A78BFA"/>
          <Row label="Country" value={keyObj.country}/>
          <Row label="Plan" value={keyObj.plan}/>
          <Row label="Upgrade Type" value={keyObj.upgradeType}/>
          <Row label="Address" value={keyObj.address}/>
        </Section>
      </div>

      {/* Upgrade History */}
      <Section title={`Upgrade Requests (${upgradeReqs.length})`}>
        {loading?(
          <div style={{padding:"20px 0",textAlign:"center",color:"#6B7280"}}>Loading...</div>
        ):upgradeReqs.length===0?(
          <p style={{color:"#6B7280",fontSize:13,margin:0}}>No upgrade requests for this key.</p>
        ):upgradeReqs.map((r,i)=>(
          <div key={r._id} style={{marginBottom:i<upgradeReqs.length-1?16:0,paddingBottom:i<upgradeReqs.length-1?16:0,borderBottom:i<upgradeReqs.length-1?"1px solid #1E2536":"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <Badge status={r.status}/>
              <span style={{fontSize:11,color:"#6B7280"}}>{fmtDate(r.createdAt)}</span>
              {r.processedBy&&<span style={{fontSize:11,color:"#A78BFA",fontWeight:600}}>by {getMakerName(r.processedBy)}</span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {[["Email",r.email],["Password",r.password],["Country",r.country],["Username",r.confirmedUsername?`@${r.confirmedUsername}`:null],["Plan",r.plan],["Upgrade Type",r.upgradeType],["Address",r.address],["Decline Reason",r.declineReason]].filter(([,v])=>v).map(([lbl,val])=>(
                <div key={lbl} style={{padding:"7px 10px",background:"#0F1117",borderRadius:8,border:"1px solid #1E2536"}}>
                  <p style={{margin:"0 0 2px",fontSize:10,color:"#4B5563",fontWeight:700,textTransform:"uppercase"}}>{lbl}</p>
                  <p style={{margin:0,fontSize:12,color:"#E5E7EB",fontWeight:600,wordBreak:"break-all"}}>{val}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* Renewal History */}
      <Section title={`Renewal Requests (${renewReqs.length})`}>
        {loading?(
          <div style={{padding:"20px 0",textAlign:"center",color:"#6B7280"}}>Loading...</div>
        ):renewReqs.length===0?(
          <p style={{color:"#6B7280",fontSize:13,margin:0}}>No renewal requests for this key.</p>
        ):renewReqs.map((r,i)=>(
          <div key={r._id} style={{marginBottom:i<renewReqs.length-1?16:0,paddingBottom:i<renewReqs.length-1?16:0,borderBottom:i<renewReqs.length-1?"1px solid #1E2536":"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
              <Badge status={r.status}/>
              <span style={{fontSize:11,color:"#6B7280"}}>{fmtDate(r.createdAt)}</span>
              {r.processedBy&&<span style={{fontSize:11,color:"#A78BFA",fontWeight:600}}>by {getMakerName(r.processedBy)}</span>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {[["Old Email",r.oldEmail],["Old Password",r.oldPassword],["New Email",r.newEmail],["New Password",r.newPassword],["Country",r.country],["Username",r.confirmedUsername?`@${r.confirmedUsername}`:null],["Proof Files",(r.files||[]).join(", ")||null],["Decline Reason",r.declineReason]].filter(([,v])=>v).map(([lbl,val])=>(
                <div key={lbl} style={{padding:"7px 10px",background:"#0F1117",borderRadius:8,border:"1px solid #1E2536"}}>
                  <p style={{margin:"0 0 2px",fontSize:10,color:"#4B5563",fontWeight:700,textTransform:"uppercase"}}>{lbl}</p>
                  <p style={{margin:0,fontSize:12,color:"#E5E7EB",fontWeight:600,wordBreak:"break-all"}}>{val}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>
    </div>
  );
}

// ─── Admin: Key Management ────────────────────────────────────────────────────
function AdminKeys(){
  const [keys,setKeys]=useState([]);
  const [selected,setSelected]=useState([]);
  const [genCount,setGenCount]=useState("10");
  const [genLoading,setGenLoading]=useState(false);
  const [copied,setCopied]=useState(null);
  const [detailKey,setDetailKey]=useState(null);

  const refresh=()=>api.getKeys().then(setKeys).catch(()=>{});
  useEffect(()=>{refresh();},[]);

  const generate=async()=>{
    const n=parseInt(genCount)||1;
    if(n<1||n>500)return;
    setGenLoading(true);
    try{await api.generateKeys(n);await refresh();}finally{setGenLoading(false);}
  };

  const deleteSelected=async()=>{
    if(selected.length===0)return;
    await api.deleteKeys(selected);await refresh();setSelected([]);
  };
  const deleteAll=async()=>{
    if(!window.confirm("Delete ALL keys? This cannot be undone."))return;
    await api.deleteKeys(keys.map(k=>k._id));await refresh();setSelected([]);
  };

  const toggle=(id)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const toggleAll=()=>setSelected(selected.length===keys.length?[]:keys.map(k=>k._id));

  const copyKey=(k)=>{navigator.clipboard?.writeText(k.key);setCopied(k._id);setTimeout(()=>setCopied(null),2000);};

  const statusColor={available:"#059669",processing:"#1D4ED8",used_upgrade:"#6D28D9",
    used_renew:"#7C3AED",cooldown:"#D97706",expired:"#DC2626"};

  if(detailKey)return <AdminKeyDetail keyObj={detailKey} onBack={()=>{setDetailKey(null);refresh();}}/>;

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:"#F9FAFB"}}>Key Management</h2>
        <p style={{margin:0,fontSize:13,color:"#6B7280"}}>Generate, view, and manage license keys</p>
      </div>

      {/* Generate */}
      <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,padding:20,marginBottom:20}}>
        <p style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:"#E5E7EB"}}>Generate New Keys</p>
        <div style={{display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
          <div style={{display:"flex",flexDirection:"column",gap:5}}>
            <label style={{fontSize:11,fontWeight:700,color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.05em"}}>Count (1–500)</label>
            <input type="number" min="1" max="500" value={genCount} onChange={e=>setGenCount(e.target.value)}
              style={{background:"#0F1117",border:"1px solid #2D3748",borderRadius:8,padding:"8px 12px",
                fontSize:14,color:"#F9FAFB",outline:"none",width:120}}/>
          </div>
          <button onClick={generate} disabled={genLoading}
            style={{padding:"9px 20px",borderRadius:8,background:genLoading?"#374151":"#5B21B6",
              color:"#fff",fontSize:13,fontWeight:700,border:"none",cursor:genLoading?"not-allowed":"pointer",
              display:"flex",alignItems:"center",gap:8}}>
            {genLoading&&<Spinner size={13} color="white"/>}
            Generate Keys
          </button>
        </div>
      </div>

      {/* Actions */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,flexWrap:"wrap"}}>
        <span style={{fontSize:13,color:"#9CA3AF"}}>{keys.length} total · {selected.length} selected</span>
        <div style={{flex:1}}/>
        {/* Download buttons */}
        <button onClick={()=>{
          const avail=keys.filter(k=>k.status==="available");
          if(!avail.length)return;
          const txt=avail.map(k=>k.key).join("\n");
          const a=document.createElement("a");a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(txt);
          a.download="available-keys.txt";a.click();
        }} style={{padding:"7px 14px",borderRadius:8,background:"#064E3B",color:"#6EE7B7",fontSize:12,fontWeight:700,border:"1px solid #065F46",cursor:"pointer"}}>
          ↓ Download Available
        </button>
        <button onClick={()=>{
          const toDownload=selected.length>0?keys.filter(k=>selected.includes(k._id)):keys;
          const txt=toDownload.map(k=>k.key).join("\n");
          const a=document.createElement("a");a.href="data:text/plain;charset=utf-8,"+encodeURIComponent(txt);
          a.download="keys.txt";a.click();
        }} style={{padding:"7px 14px",borderRadius:8,background:"#1E3A5F",color:"#93C5FD",fontSize:12,fontWeight:700,border:"1px solid #1D4ED8",cursor:"pointer"}}>
          ↓ Download {selected.length>0?`Selected (${selected.length})`:"All"}
        </button>
        {selected.length>0&&(
          <button onClick={deleteSelected}
            style={{padding:"7px 14px",borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",
              fontSize:12,fontWeight:700,border:"1px solid #991B1B",cursor:"pointer"}}>
            Delete Selected ({selected.length})
          </button>
        )}
        <button onClick={deleteAll}
          style={{padding:"7px 14px",borderRadius:8,background:"#1F2937",color:"#F87171",
            fontSize:12,fontWeight:700,border:"1px solid #374151",cursor:"pointer"}}>
          Delete All
        </button>
      </div>

      {/* Table */}
      <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:"36px 1fr 110px 120px 110px 80px",
          padding:"10px 16px",borderBottom:"1px solid #1E2536",
          background:"#1A2035",gap:10}}>
          <input type="checkbox" checked={selected.length===keys.length&&keys.length>0}
            onChange={toggleAll} style={{accentColor:"#7C3AED",width:14,height:14}}/>
          {["Key","Status","Purchase Date","Used Date","Actions"].map(h=>(
            <span key={h} style={{fontSize:10,fontWeight:800,color:"#6B7280",textTransform:"uppercase",letterSpacing:"0.08em"}}>{h}</span>
          ))}
        </div>
        {keys.length===0&&(
          <div style={{padding:"40px 0",textAlign:"center",color:"#6B7280",fontSize:14}}>No keys found</div>
        )}
        {keys.map(k=>{
          const isSel=selected.includes(k._id);
          const clLeft=cooldownLeft(k.cooldownUntil);
          const hasCooldown=k.cooldownUntil&&new Date(k.cooldownUntil)>new Date();
          return(
            <div key={k._id} style={{display:"grid",gridTemplateColumns:"36px 1fr 110px 120px 110px auto",
              padding:"11px 16px",borderBottom:"1px solid #1E2536",gap:10,alignItems:"center",
              background:isSel?"rgba(91,33,182,0.12)":"transparent",
              transition:"background 0.15s"}}>
              <input type="checkbox" checked={isSel} onChange={()=>toggle(k._id)}
                style={{accentColor:"#7C3AED",width:14,height:14}}/>
              <div style={{cursor:"pointer"}} onClick={()=>setDetailKey(k)}>
                <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#A78BFA",letterSpacing:"0.05em",textDecoration:"underline",textDecorationStyle:"dotted"}}>{k.key}</span>
                {k.usedByUsername&&<p style={{margin:"2px 0 0",fontSize:10,color:"#6B7280"}}>@{k.usedByUsername}</p>}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{width:6,height:6,borderRadius:"50%",background:statusColor[k.status]||"#6B7280",
                  display:"inline-block",flexShrink:0}}/>
                <span style={{fontSize:11,fontWeight:600,color:"#D1D5DB",textTransform:"capitalize"}}>
                  {k.status.replace(/_/g," ")}
                </span>
              </div>
              <span style={{fontSize:11,color:"#9CA3AF"}}>{fmtDate(k.purchaseDate)}</span>
              <div>
                <span style={{fontSize:11,color:"#9CA3AF"}}>{fmtDate(k.usedDate)}</span>
                {clLeft&&<p style={{margin:"2px 0 0",fontSize:10,color:"#D97706"}}>⏳ {clLeft}</p>}
              </div>
              <div style={{display:"flex",gap:5}}>
                <button onClick={()=>copyKey(k)}
                  style={{padding:"4px 10px",borderRadius:6,
                    background:copied===k._id?"#065F46":"#1F2937",
                    color:copied===k._id?"#6EE7B7":"#9CA3AF",
                    fontSize:11,fontWeight:600,border:"1px solid #374151",cursor:"pointer"}}>
                  {copied===k._id?"✓":"Copy"}
                </button>
                {hasCooldown&&(
                  <button onClick={async()=>{
                    await api.updateKey(k._id,{cooldownUntil:null});
                    await refresh();
                  }} style={{padding:"4px 10px",borderRadius:6,background:"#1C1917",
                    color:"#FCD34D",fontSize:11,fontWeight:600,border:"1px solid #78350F",cursor:"pointer",whiteSpace:"nowrap"}}>
                    ⏳ Clear CD
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Admin: Upgrade Requests ──────────────────────────────────────────────────
function AdminUpgrades({onShowDecline}){
  const [requests,setRequests]=useState([]);
  const [selected,setSelected]=useState(null);
  const [tab,setTab]=useState("pending");

  const refresh=()=>api.getUpgradeRequests().then(setRequests).catch(()=>{});
  useEffect(()=>{refresh();},[]);

  const filtered=requests.filter(r=>r.status===tab);
  const counts={pending:requests.filter(r=>r.status==="pending").length,approved:requests.filter(r=>r.status==="approved").length,declined:requests.filter(r=>r.status==="declined").length};

  return(
    <div>
      <div style={{marginBottom:20}}>
        <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:"#F9FAFB"}}>Upgrade Requests</h2>
        <p style={{margin:0,fontSize:13,color:"#6B7280"}}>{requests.length} total requests</p>
      </div>
      {selected?(
        <AdminUpgradeDetail req={selected} onBack={()=>{setSelected(null);refresh();}} onRefresh={refresh} onShowDecline={onShowDecline}/>
      ):(
        <>
          <RequestTabs tab={tab} setTab={setTab} counts={counts}/>
          {filtered.length===0?(
            <div style={{padding:"60px 0",textAlign:"center",color:"#6B7280",fontSize:14}}>No {tab} requests.</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {filtered.map(r=>{
                const accentColor=r.status==="pending"?"#F59E0B":r.status==="approved"?"#10B981":"#EF4444";
                return(
                <div key={r._id}
                  style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,
                    padding:"14px 16px",transition:"border-color 0.15s",
                    borderLeft:`4px solid ${accentColor}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}
                    onClick={()=>setSelected(r)}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#E5E7EB"}}>{r.key}</span>
                        <Badge status={r.status}/>
                      </div>
                      <p style={{margin:0,fontSize:12,color:"#6B7280"}}>
                        {r.email} · <span style={{color:"#9CA3AF"}}>{fmtRelTime(r.createdAt)}</span>
                        {r.confirmedUsername&&<> · @{r.confirmedUsername}</>}
                      </p>
                      {r.declineReason&&<p style={{margin:"3px 0 0",fontSize:11,color:"#F87171"}}>Reason: {r.declineReason}</p>}
                    </div>
                    <span style={{color:"#6B7280",fontSize:16,fontWeight:700,flexShrink:0}}>→</span>
                  </div>
                  {r.status==="pending"&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #1E2536",display:"flex",gap:8}}>
                      <button onClick={e=>{e.stopPropagation();setSelected(r);}}
                        style={{flex:1,padding:"7px 0",borderRadius:8,background:"rgba(91,33,182,0.2)",color:"#A78BFA",fontSize:12,fontWeight:700,border:"1px solid #5B21B6",cursor:"pointer"}}>
                        Open →
                      </button>
                      <button onClick={e=>{e.stopPropagation();onShowDecline&&onShowDecline({onConfirm:async(reason)=>{
                        await api.updateUpgradeRequest(r._id,{status:"declined",declineReason:reason});
                        const k=await api.getKey(r.key);if(k)await api.updateKey(k._id,{status:"available"});
                        refresh();
                      }});}}
                        style={{flex:1,padding:"7px 0",borderRadius:8,background:"rgba(220,38,38,0.15)",color:"#F87171",fontSize:12,fontWeight:700,border:"1px solid #991B1B",cursor:"pointer"}}>
                        ✕ Decline
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AdminUpgradeDetail({req,onBack,onRefresh,onShowDecline}){
  const [username,setUsername]=useState(req.confirmedUsername||"");
  const [usernameConfirmed,setUsernameConfirmed]=useState(!!req.confirmedUsername);
  const [upgradeType,setUpgradeType]=useState(req.upgradeType||"");
  const [plan,setPlan]=useState(req.plan||"");
  const [duration,setDuration]=useState(req.duration||"");
  const [address,setAddress]=useState(req.address||"");
  const [country,setCountry]=useState(req.countryUpgraded||"");
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(req.status==="approved");
  const [r,setR]=useState(req);

  const confirmUsername=async()=>{
    if(!username.trim())return;
    await api.updateUpgradeRequest(r._id,{confirmedUsername:username.trim()});
    setUsernameConfirmed(true);
    setR({...r,confirmedUsername:username.trim()});
  };

  const handleApprove=async()=>{
    if(!upgradeType||!plan||!country)return;
    setLoading(true);
    try{
      const cooldown=new Date(Date.now()+15*24*60*60*1000).toISOString();
      const k=await api.getKey(r.key);
      if(k){
        await api.updateKey(k._id,{
          status:"used_upgrade",usedFor:"upgrade",
          usedByEmail:r.email,usedByUsername:username.trim(),
          country,plan,address:address||null,
          upgradeType,usedDate:new Date().toISOString(),
          cooldownUntil:cooldown,
        });
      }
      await api.updateUpgradeRequest(r._id,{
        status:"approved",confirmedUsername:username.trim(),
        upgradeType,plan,duration,address,countryUpgraded:country,
      });
      setDone(true);onRefresh();
    }finally{setLoading(false);}
  };

  const handleDecline=()=>{
    onShowDecline&&onShowDecline({onConfirm:async(reason)=>{
      await api.updateUpgradeRequest(r._id,{status:"declined",declineReason:reason});
      const k=await api.getKey(r.key);
      if(k)await api.updateKey(k._id,{status:"available"});
      onBack();onRefresh();
    }});
  };

  const INDIVIDUAL_PLANS=["individual_1m","individual_3m","individual_6m","individual_12m"];
  const FAMILY_PLANS=["family_1m","family_3m","family_6m","family_12m"];

  return(
    <div>
      <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",
        color:"#9CA3AF",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5,
        padding:0,marginBottom:20}}>
        ← Back to Requests
      </button>

      {done&&(
        <div style={{padding:"12px 16px",background:"#064E3B",border:"1px solid #065F46",
          borderRadius:12,marginBottom:20,color:"#6EE7B7",fontSize:13,fontWeight:600}}>
          ✓ Upgrade approved and key updated with 15-day cooldown.
        </div>
      )}

      <div className="two-col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        {/* Request Info */}
        <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,padding:20}}>
          <p style={{margin:"0 0 16px",fontSize:13,fontWeight:800,color:"#E5E7EB",textTransform:"uppercase",
            letterSpacing:"0.08em"}}>Request Info</p>
          {[["Key",r.key],["Email",r.email],["Password",r.password||"—"],["Country",r.country||"—"],["Status",r.status],["Submitted",fmtDate(r.createdAt)]].map(([lbl,val])=>(
            <div key={lbl} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",
              borderBottom:"1px solid #1E2536"}}>
              <span style={{fontSize:12,color:"#6B7280",fontWeight:600}}>{lbl}</span>
              <span style={{fontSize:12,color:"#E5E7EB",fontWeight:600,fontFamily:lbl==="Key"?"monospace":"inherit"}}>{val}</span>
            </div>
          ))}
        </div>

        {/* Admin Actions */}
        <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,padding:20}}>
          <p style={{margin:"0 0 16px",fontSize:13,fontWeight:800,color:"#E5E7EB",textTransform:"uppercase",letterSpacing:"0.08em"}}>Admin Actions</p>

          {/* Step 1: Confirm username */}
          {!usernameConfirmed?(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <p style={{margin:"0 0 4px",fontSize:12,color:"#9CA3AF"}}>Step 1: Enter the Spotify username manually</p>
              <input placeholder="spotify_username" value={username} onChange={e=>setUsername(e.target.value)}
                style={{background:"#0F1117",border:"1px solid #2D3748",borderRadius:8,padding:"8px 12px",
                  fontSize:13,color:"#F9FAFB",outline:"none",width:"100%"}}/>
              <button onClick={confirmUsername} disabled={!username.trim()}
                style={{padding:"9px 0",borderRadius:8,background:username.trim()?"#1D4ED8":"#374151",
                  color:"#fff",fontSize:13,fontWeight:700,border:"none",cursor:username.trim()?"pointer":"not-allowed",width:"100%"}}>
                Confirm Username
              </button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              <div style={{padding:"10px 12px",background:"#064E3B",border:"1px solid #065F46",
                borderRadius:10,display:"flex",alignItems:"center",gap:8}}>
                <span style={{color:"#6EE7B7",fontWeight:800}}>✓</span>
                <span style={{fontSize:13,color:"#6EE7B7",fontWeight:700}}>@{r.confirmedUsername||username}</span>
              </div>

              {!done&&(
                <>
                  {/* Step 2: Upgrade type */}
                  <p style={{margin:"0 0 4px",fontSize:12,color:"#9CA3AF",fontWeight:600}}>Step 2: Select upgrade type</p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    {["individual","family"].map(t=>(
                      <button key={t} onClick={()=>{setUpgradeType(t);setPlan("");}}
                        style={{padding:"10px 8px",borderRadius:8,cursor:"pointer",textAlign:"center",
                          background:upgradeType===t?"rgba(91,33,182,0.3)":"#0F1117",
                          border:`1.5px solid ${upgradeType===t?"#7C3AED":"#2D3748"}`,
                          color:upgradeType===t?"#A78BFA":"#9CA3AF",fontSize:12,fontWeight:700}}>
                        {t==="individual"?"👤 Individual":"👨‍👩‍👧 Family/Platinum"}
                      </button>
                    ))}
                  </div>

                  {upgradeType&&(
                    <>
                      {/* Plan */}
                      <p style={{margin:"4px 0",fontSize:12,color:"#9CA3AF",fontWeight:600}}>Select Plan & Duration</p>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                        {(upgradeType==="individual"?INDIVIDUAL_PLANS:FAMILY_PLANS).map(p=>(
                          <button key={p} onClick={()=>setPlan(p)}
                            style={{padding:"7px 6px",borderRadius:7,cursor:"pointer",
                              background:plan===p?"rgba(5,150,105,0.25)":"#0F1117",
                              border:`1.5px solid ${plan===p?C.green:"#2D3748"}`,
                              color:plan===p?"#6EE7B7":"#9CA3AF",fontSize:11,fontWeight:700}}>
                            {p.replace(/_/g," ")}
                          </button>
                        ))}
                      </div>

                      {upgradeType==="family"&&(
                        <>
                          <p style={{margin:"4px 0",fontSize:12,color:"#9CA3AF",fontWeight:600}}>Billing Address</p>
                          <input placeholder="e.g. 123 Main St, New York, NY 10001" value={address} onChange={e=>setAddress(e.target.value)}
                            style={{background:"#0F1117",border:"1px solid #2D3748",borderRadius:8,padding:"8px 12px",
                              fontSize:12,color:"#F9FAFB",outline:"none",width:"100%"}}/>
                        </>
                      )}

                      <p style={{margin:"4px 0",fontSize:12,color:"#9CA3AF",fontWeight:600}}>Country Used to Upgrade</p>
                      <select value={country} onChange={e=>setCountry(e.target.value)}
                        style={{background:"#0F1117",border:"1px solid #2D3748",borderRadius:8,padding:"8px 12px",
                          fontSize:12,color:"#F9FAFB",outline:"none",width:"100%"}}>
                        <option value="">Select country...</option>
                        {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>

                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:4}}>
                        <button onClick={handleDecline}
                          style={{padding:"10px 0",borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",
                            fontSize:12,fontWeight:700,border:"1px solid #991B1B",cursor:"pointer"}}>
                          ✕ Decline
                        </button>
                        <button onClick={handleApprove}
                          disabled={!plan||!country||loading}
                          style={{padding:"10px 0",borderRadius:8,
                            background:!plan||!country?"#374151":"#059669",
                            color:"#fff",fontSize:12,fontWeight:700,border:"none",
                            cursor:!plan||!country?"not-allowed":"pointer",
                            display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                          {loading&&<Spinner size={12} color="white"/>}
                          ✓ Confirm Upgrade
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Admin: Renewal Requests ──────────────────────────────────────────────────
function AdminRenewals({onShowDecline}){
  const [requests,setRequests]=useState([]);
  const [selected,setSelected]=useState(null);
  const [tab,setTab]=useState("pending");
  const refresh=()=>api.getRenewRequests().then(setRequests).catch(()=>{});
  useEffect(()=>{refresh();},[]);

  const filtered=requests.filter(r=>r.status===tab);
  const counts={pending:requests.filter(r=>r.status==="pending").length,approved:requests.filter(r=>r.status==="approved").length,declined:requests.filter(r=>r.status==="declined").length};

  return(
    <div>
      <div style={{marginBottom:20}}>
        <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:"#F9FAFB"}}>Renewal Requests</h2>
        <p style={{margin:0,fontSize:13,color:"#6B7280"}}>{requests.length} total requests</p>
      </div>
      {selected?(
        <AdminRenewDetail req={selected} onBack={()=>{setSelected(null);refresh();}} onRefresh={refresh} onShowDecline={onShowDecline}/>
      ):(
        <>
          <RequestTabs tab={tab} setTab={setTab} counts={counts}/>
          {filtered.length===0?(
            <div style={{padding:"60px 0",textAlign:"center",color:"#6B7280",fontSize:14}}>No {tab} requests.</div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {filtered.map(r=>{
                const accentColor=r.status==="pending"?"#F59E0B":r.status==="approved"?"#10B981":"#EF4444";
                return(
                <div key={r._id}
                  style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,
                    padding:"14px 16px",transition:"border-color 0.15s",
                    borderLeft:`4px solid ${accentColor}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}
                    onClick={()=>setSelected(r)}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                        <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#E5E7EB"}}>{r.key}</span>
                        <Badge status={r.status}/>
                        {r.proofStatus&&<Badge status={r.proofStatus==="confirmed"?"approved":"declined"}/>}
                      </div>
                      <p style={{margin:0,fontSize:12,color:"#6B7280"}}>{r.oldEmail} → {r.newEmail} · <span style={{color:"#9CA3AF"}}>{fmtRelTime(r.createdAt)}</span></p>
                      {r.declineReason&&<p style={{margin:"3px 0 0",fontSize:11,color:"#F87171"}}>Reason: {r.declineReason}</p>}
                    </div>
                    <span style={{color:"#6B7280",fontSize:16,fontWeight:700,flexShrink:0}}>→</span>
                  </div>
                  {r.status==="pending"&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #1E2536",display:"flex",gap:8}}>
                      <button onClick={e=>{e.stopPropagation();setSelected(r);}}
                        style={{flex:1,padding:"7px 0",borderRadius:8,background:"rgba(5,150,105,0.15)",color:"#6EE7B7",fontSize:12,fontWeight:700,border:"1px solid #059669",cursor:"pointer"}}>
                        Open →
                      </button>
                      <button onClick={e=>{e.stopPropagation();onShowDecline&&onShowDecline({onConfirm:async(reason)=>{
                        await api.updateRenewRequest(r._id,{status:"declined",declineReason:reason});
                        const k=await api.getKey(r.key);if(k)await api.updateKey(k._id,{status:"used_upgrade"});
                        refresh();
                      }});}}
                        style={{flex:1,padding:"7px 0",borderRadius:8,background:"rgba(220,38,38,0.15)",color:"#F87171",fontSize:12,fontWeight:700,border:"1px solid #991B1B",cursor:"pointer"}}>
                        ✕ Decline
                      </button>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AdminRenewDetail({req,onBack,onRefresh,onShowDecline}){
  const [r,setR]=useState(req);
  const [enteredUsername,setEnteredUsername]=useState("");
  const [usernameError,setUsernameError]=useState("");
  const [usernameMatch,setUsernameMatch]=useState(false);
  const [proofStatus,setProofStatus]=useState(req.proofStatus||null);
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(req.status==="approved");

  const [originalUsername,setOriginalUsername]=useState(null);
  useEffect(()=>{
    api.getKey(r.key).then(k=>setOriginalUsername(k?.usedByUsername||null)).catch(()=>{});
  },[r.key]);

  const checkUsername=async()=>{
    setUsernameError("");
    if(enteredUsername.trim()!==originalUsername){
      setUsernameError(`Username doesn't match! Expected: @${originalUsername}. Please decline this request.`);
      return;
    }
    setUsernameMatch(true);
    await api.updateRenewRequest(r._id,{confirmedUsername:enteredUsername.trim()});
    setR({...r,confirmedUsername:enteredUsername.trim()});
  };

  const setProof=async(status)=>{
    setProofStatus(status);
    await api.updateRenewRequest(r._id,{proofStatus:status});
    setR({...r,proofStatus:status});
  };

  const handleApprove=async()=>{
    if(!usernameMatch||proofStatus!=="confirmed")return;
    setLoading(true);
    try{
      const cooldown=new Date(Date.now()+15*24*60*60*1000).toISOString();
      const k=await api.getKey(r.key);
      if(k){
        await api.updateKey(k._id,{
          status:"used_renew",usedFor:"renew",
          usedByEmail:r.newEmail,
          usedDate:new Date().toISOString(),
          cooldownUntil:cooldown,
          country:r.country,
        });
      }
      await api.updateRenewRequest(r._id,{status:"approved"});
      setDone(true);onRefresh();
    }finally{setLoading(false);}
  };

  const handleDecline=()=>{
    onShowDecline&&onShowDecline({onConfirm:async(reason)=>{
      await api.updateRenewRequest(r._id,{status:"declined",declineReason:reason});
      const k=await api.getKey(r.key);
      if(k)await api.updateKey(k._id,{status:"used_upgrade"});
      onBack();onRefresh();
    }});
  };

  return(
    <div>
      <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",
        color:"#9CA3AF",fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5,padding:0,marginBottom:20}}>
        ← Back to Requests
      </button>

      {done&&(
        <div style={{padding:"12px 16px",background:"#064E3B",border:"1px solid #065F46",
          borderRadius:12,marginBottom:20,color:"#6EE7B7",fontSize:13,fontWeight:600}}>
          ✓ Renewal approved. Key updated with 15-day cooldown.
        </div>
      )}

      <div className="two-col" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        {/* Request Info */}
        <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,padding:20}}>
          <p style={{margin:"0 0 16px",fontSize:13,fontWeight:800,color:"#E5E7EB",textTransform:"uppercase",letterSpacing:"0.08em"}}>Request Info</p>
          {[
            ["Key",r.key],["Old Email",r.oldEmail],["Old Password",r.oldPassword||"—"],
            ["New Email",r.newEmail||"—"],["New Password",r.newPassword||"—"],
            ["Country",r.country||"—"],["Status",r.status],["Submitted",fmtDate(r.createdAt)],
          ].map(([lbl,val])=>(
            <div key={lbl} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",
              borderBottom:"1px solid #1E2536",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:"#6B7280",fontWeight:600,flexShrink:0}}>{lbl}</span>
              <span style={{fontSize:12,color:"#E5E7EB",fontWeight:600,
                fontFamily:lbl==="Key"?"monospace":"inherit",wordBreak:"break-all",textAlign:"right"}}>{val}</span>
            </div>
          ))}
          <div style={{padding:"8px 0",borderBottom:"1px solid #1E2536"}}>
            <span style={{fontSize:12,color:"#6B7280",fontWeight:600,display:"block",marginBottom:4}}>Proof Files</span>
            <ProofViewer urls={r.files||[]} dark={true}/>
          </div>
          {originalUsername&&(
            <div style={{marginTop:12,padding:"10px 12px",background:"#1A2035",border:"1px solid #2D3748",borderRadius:10}}>
              <p style={{margin:"0 0 2px",fontSize:10,color:"#6B7280",fontWeight:700,textTransform:"uppercase"}}>Original Upgrade Username</p>
              <p style={{margin:0,fontSize:14,color:"#A78BFA",fontWeight:800}}>@{originalUsername}</p>
            </div>
          )}
        </div>

        {/* Admin Actions */}
        <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,padding:20}}>
          <p style={{margin:"0 0 16px",fontSize:13,fontWeight:800,color:"#E5E7EB",textTransform:"uppercase",letterSpacing:"0.08em"}}>Admin Actions</p>

          {/* Step 1: Verify username match */}
          <div style={{marginBottom:16}}>
            <p style={{margin:"0 0 8px",fontSize:12,color:"#9CA3AF",fontWeight:700}}>Step 1: Enter username to verify match</p>
            <p style={{margin:"0 0 8px",fontSize:11,color:"#6B7280"}}>Must match the username from the original upgrade: <strong style={{color:"#A78BFA"}}>@{originalUsername||"unknown"}</strong></p>
            {!usernameMatch?(
              <>
                <input placeholder="Enter Spotify username" value={enteredUsername}
                  onChange={e=>{setEnteredUsername(e.target.value);setUsernameError("");}}
                  style={{background:"#0F1117",border:`1px solid ${usernameError?"#DC2626":"#2D3748"}`,
                    borderRadius:8,padding:"8px 12px",fontSize:13,color:"#F9FAFB",outline:"none",
                    width:"100%",marginBottom:8}}/>
                {usernameError&&<p style={{fontSize:12,color:"#F87171",margin:"0 0 8px",fontWeight:600}}>{usernameError}</p>}
                <button onClick={checkUsername} disabled={!enteredUsername.trim()}
                  style={{padding:"9px 0",borderRadius:8,
                    background:enteredUsername.trim()?"#1D4ED8":"#374151",
                    color:"#fff",fontSize:12,fontWeight:700,border:"none",
                    cursor:enteredUsername.trim()?"pointer":"not-allowed",width:"100%"}}>
                  Verify Username
                </button>
              </>
            ):(
              <div style={{padding:"10px 12px",background:"#064E3B",border:"1px solid #065F46",
                borderRadius:10,display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                <span style={{color:"#6EE7B7",fontWeight:800,fontSize:14}}>✓</span>
                <span style={{fontSize:13,color:"#6EE7B7",fontWeight:700}}>Username matches: @{enteredUsername}</span>
              </div>
            )}
          </div>

          {/* Step 2: Proof review */}
          {usernameMatch&&!done&&(
            <>
              <div style={{borderTop:"1px solid #1E2536",paddingTop:14,marginBottom:14}}>
                <p style={{margin:"0 0 10px",fontSize:12,color:"#9CA3AF",fontWeight:700}}>Step 2: Review revoke proof</p>
                <ProofViewer urls={r.files||[]} dark={true}/>
                <div style={{marginBottom:10}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
                  <button onClick={()=>setProof("confirmed")}
                    style={{padding:"9px 0",borderRadius:8,cursor:"pointer",
                      background:proofStatus==="confirmed"?"rgba(5,150,105,0.3)":"#0F1117",
                      border:`1.5px solid ${proofStatus==="confirmed"?"#059669":"#2D3748"}`,
                      color:proofStatus==="confirmed"?"#6EE7B7":"#9CA3AF",fontSize:12,fontWeight:700}}>
                    ✓ Proof Confirmed
                  </button>
                  <button onClick={()=>setProof("declined")}
                    style={{padding:"9px 0",borderRadius:8,cursor:"pointer",
                      background:proofStatus==="declined"?"rgba(220,38,38,0.2)":"#0F1117",
                      border:`1.5px solid ${proofStatus==="declined"?"#DC2626":"#2D3748"}`,
                      color:proofStatus==="declined"?"#F87171":"#9CA3AF",fontSize:12,fontWeight:700}}>
                    ✕ Proof Declined
                  </button>
                </div>
              </div>

              {/* Final actions */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                <button onClick={handleDecline}
                  style={{padding:"10px 0",borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",
                    fontSize:12,fontWeight:700,border:"1px solid #991B1B",cursor:"pointer"}}>
                  ✕ Decline
                </button>
                <button onClick={handleApprove}
                  disabled={proofStatus!=="confirmed"||loading}
                  style={{padding:"10px 0",borderRadius:8,
                    background:proofStatus!=="confirmed"?"#374151":"#059669",
                    color:"#fff",fontSize:12,fontWeight:700,border:"none",
                    cursor:proofStatus!=="confirmed"?"not-allowed":"pointer",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                  {loading&&<Spinner size={12} color="white"/>}
                  ✓ Confirm Renewal
                </button>
              </div>
            </>
          )}

          {usernameError&&!usernameMatch&&(
            <div style={{marginTop:12}}>
              <button onClick={handleDecline}
                style={{padding:"10px 0",borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",
                  fontSize:12,fontWeight:700,border:"1px solid #991B1B",cursor:"pointer",width:"100%"}}>
                ✕ Decline This Request
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  STATUS PAGE
// ════════════════════════════════════════════════════════════════════════════
function StatusPage(){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [lastChecked,setLastChecked]=useState(null);
  const [history,setHistory]=useState({api:[],database:[],service:[]});

  const check=useCallback(async()=>{
    setLoading(true);
    try{
      const t0=Date.now();
      const r=await fetch(`${API}/status`);
      const json=await r.json();
      const now=new Date();
      setData(json);
      setLastChecked(now);
      setHistory(h=>({
        api:[...h.api.slice(-29),{t:now,ok:json.api?.status==="operational"}],
        database:[...h.database.slice(-29),{t:now,ok:json.database?.status==="operational"}],
        service:[...h.service.slice(-29),{t:now,ok:json.service?.status==="operational"}],
      }));
    }catch{
      setData(null);
    }finally{setLoading(false);}
  },[]);

  useEffect(()=>{check();const iv=setInterval(check,30000);return()=>clearInterval(iv);},[check]);

  const statusStyle=(s)=>{
    if(s==="operational")return{bg:C.greenLight,border:C.greenBorder,color:C.greenText,dot:"#059669",label:"Operational"};
    if(s==="degraded")   return{bg:C.amberLight,border:C.amberBorder,color:C.amberText,dot:"#D97706",label:"Degraded"};
    return                     {bg:C.redLight,  border:C.redBorder,  color:C.redText,  dot:C.red,   label:"Down"};
  };

  const overall=data
    ? (["api","database","service"].every(k=>data[k]?.status==="operational")
        ?"operational"
        :["api","database","service"].some(k=>data[k]?.status==="down")
          ?"down":"degraded")
    : (loading ? "checking" : "down");

  const overallStyle=overall==="operational"
    ?{bg:C.greenLight,border:C.greenBorder,color:C.greenText,icon:"✓",title:"All Systems Operational"}
    :overall==="degraded"
    ?{bg:C.amberLight,border:C.amberBorder,color:C.amberText,icon:"⚠",title:"Partial Outage"}
    :overall==="checking"
    ?{bg:C.blueLight, border:C.blueBorder, color:C.blueText, icon:"·",title:"Checking Systems…"}
    :{bg:C.redLight,  border:C.redBorder,  color:C.redText,  icon:"✕",title:"System Outage"};

  const fmt=d=>d?d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"}):"—";
  const fmtMs=ms=>ms!=null?`${ms}ms`:"—";

  const UptimeBars=({bars})=>(
    <div style={{display:"flex",gap:2,alignItems:"flex-end"}}>
      {Array.from({length:30}).map((_,i)=>{
        const entry=bars[i-(30-bars.length)];
        const color=!entry?"#E1E6EF":entry.ok?"#059669":C.red;
        return<div key={i} style={{width:7,height:20,borderRadius:2,background:color,flexShrink:0}}/>;
      })}
    </div>
  );

  const services=[
    {key:"service",  label:"Web Service", icon:"🌐"},
    {key:"api",      label:"API Server",  icon:"⚙️"},
    {key:"database", label:"Database",    icon:"🗄️"},
  ];

  return(
    <div style={{maxWidth:720,margin:"0 auto",padding:"32px 16px"}}>
      {/* Header */}
      <div style={{marginBottom:28}}>
        <span style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:999,
          background:C.blueLight,color:C.blue,fontSize:11,fontWeight:700,
          border:`1px solid ${C.blueBorder}`,marginBottom:12}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:C.blue}}/>
          Live Status
        </span>
        <h1 style={{fontSize:26,fontWeight:900,color:C.text,margin:"0 0 6px",letterSpacing:"-0.03em"}}>System Status</h1>
        <p style={{color:C.textSub,fontSize:14,margin:0}}>Real-time health of all SpotiGrader.cc services.</p>
      </div>

      {/* Overall banner */}
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"16px",borderRadius:14,
        background:overallStyle.bg,border:`1.5px solid ${overallStyle.border}`,marginBottom:20,flexWrap:"wrap"}}>
        <div style={{flex:1,minWidth:0}}>
          <p style={{margin:"0 0 2px",fontSize:16,fontWeight:900,color:overallStyle.color}}>{overallStyle.title}</p>
          <p style={{margin:0,fontSize:11,color:overallStyle.color,opacity:0.8}}>
            Last checked: {fmt(lastChecked)} · Auto-refreshes every 30s
          </p>
        </div>
        <button onClick={check} disabled={loading}
          style={{padding:"7px 14px",borderRadius:9,background:"white",border:`1px solid ${overallStyle.border}`,
            color:overallStyle.color,fontSize:12,fontWeight:700,cursor:loading?"not-allowed":"pointer",
            display:"flex",alignItems:"center",gap:6,opacity:loading?0.6:1,flexShrink:0}}>
          {loading?<Spinner size={12} color={overallStyle.color}/>:"↻"} Refresh
        </button>
      </div>

      {/* Service cards */}
      <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:28}}>
        {services.map(({key,label,icon})=>{
          const s=data?.[key];
          const st=statusStyle(s?.status||"down");
          return(
            <Card key={key} style={{padding:"14px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{width:38,height:38,borderRadius:10,background:st.bg,
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>
                  {loading?<Spinner size={14} color={st.dot}/>:icon}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                    <p style={{margin:0,fontSize:14,fontWeight:800,color:C.text}}>{label}</p>
                    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",
                      borderRadius:999,background:st.bg,border:`1px solid ${st.border}`,
                      fontSize:11,fontWeight:700,color:st.color,whiteSpace:"nowrap"}}>
                      <span style={{width:5,height:5,borderRadius:"50%",background:st.dot,
                        animation:s?.status==="operational"?"pulse 2s infinite":"none",display:"inline-block"}}/>
                      {loading?"Checking…":st.label}
                    </span>
                    {s?.latency!=null&&(
                      <span style={{fontSize:11,color:C.textMuted,fontWeight:600}}>{fmtMs(s.latency)}</span>
                    )}
                  </div>
                </div>
                <div className="uptime-bars" style={{textAlign:"right",flexShrink:0}}>
                  <UptimeBars bars={history[key]}/>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Stats row — hardcoded base + real DB count */}
      <div style={{marginBottom:28}}>
        <p style={{fontSize:11,fontWeight:800,color:C.textMuted,letterSpacing:"0.1em",
          textTransform:"uppercase",margin:"0 0 12px"}}>Platform Stats</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {[
            {label:"Total Keys",value:(21567+(data?.stats?.keys||0)).toLocaleString()+"+",icon:"🔑",color:C.violet},
            {label:"Upgrades Done",value:(18567+(data?.stats?.upgrades||0)).toLocaleString()+"+",icon:"⚡",color:C.blue},
            {label:"Renewals Done",value:(5678+(data?.stats?.renewals||0)).toLocaleString()+"+",icon:"🔄",color:C.green},
          ].map(({label,value,icon,color})=>(
            <div key={label} style={{padding:"16px 10px",borderRadius:14,background:C.surface,
              border:`1px solid ${C.border}`,textAlign:"center"}}>
              <div style={{fontSize:20,marginBottom:6}}>{icon}</div>
              <p style={{margin:"0 0 2px",fontSize:20,fontWeight:900,color,lineHeight:1}}>{value}</p>
              <p style={{margin:0,fontSize:10,color:C.textMuted,fontWeight:600,lineHeight:1.3}}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Timestamp */}
      <div style={{textAlign:"center",padding:"14px",borderRadius:12,background:C.surfaceAlt,
        border:`1px solid ${C.border}`}}>
        <p style={{margin:0,fontSize:12,color:C.textMuted}}>
          {data
            ? <>Status as of <strong>{new Date(data.timestamp).toLocaleString()}</strong></>
            : loading ? "Fetching status…" : "Could not reach API server"}
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  DECLINE MODAL
// ════════════════════════════════════════════════════════════════════════════
const DECLINE_REASONS=[
  "Account detail is invalid",
  "Account cooldown period of 12m joining a family",
  "Contact support",
];
function DeclineModal({onConfirm,onClose}){
  const [reason,setReason]=useState("");
  const [custom,setCustom]=useState("");
  return(
    <div style={{position:"fixed",inset:0,zIndex:9999,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#161B27",border:"1px solid #374151",borderRadius:16,width:"100%",maxWidth:440,padding:24}}>
        <p style={{margin:"0 0 16px",fontSize:15,fontWeight:800,color:"#F9FAFB"}}>Select Decline Reason</p>
        {DECLINE_REASONS.map(r=>(
          <button key={r} onClick={()=>setReason(r)}
            style={{width:"100%",padding:"10px 13px",borderRadius:9,marginBottom:8,textAlign:"left",cursor:"pointer",
              background:reason===r?"rgba(220,38,38,0.2)":"#0F1117",
              border:`1.5px solid ${reason===r?"#DC2626":"#374151"}`,
              color:reason===r?"#FCA5A5":"#9CA3AF",fontSize:13,fontWeight:600}}>
            {r}
          </button>
        ))}
        <input placeholder="Or type custom reason..." value={custom} onChange={e=>{setCustom(e.target.value);setReason("");}}
          style={{width:"100%",background:"#0F1117",border:"1px solid #374151",borderRadius:8,
            padding:"9px 12px",color:"#F9FAFB",fontSize:13,marginBottom:14,boxSizing:"border-box",outline:"none"}}/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          <button onClick={onClose} style={{padding:"9px 0",borderRadius:8,background:"#1F2937",color:"#9CA3AF",fontSize:12,fontWeight:700,border:"1px solid #374151",cursor:"pointer"}}>Cancel</button>
          <button onClick={()=>onConfirm(reason||custom||"Declined")}
            disabled={!reason&&!custom.trim()}
            style={{padding:"9px 0",borderRadius:8,background:(!reason&&!custom.trim())?"#374151":"#7F1D1D",
              color:"#FCA5A5",fontSize:12,fontWeight:700,border:"1px solid #991B1B",cursor:(!reason&&!custom.trim())?"not-allowed":"pointer"}}>
            Confirm Decline
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN PANEL — TABS FOR UPGRADE / RENEW
// ════════════════════════════════════════════════════════════════════════════
function RequestTabs({tab,setTab,counts}){
  const TAB_STYLES={
    pending:{active:{background:"#F59E0B",color:"#fff"},dot:"#F59E0B"},
    approved:{active:{background:"#10B981",color:"#fff"},dot:"#10B981"},
    declined:{active:{background:"#EF4444",color:"#fff"},dot:"#EF4444"},
  };
  return(
    <div style={{display:"flex",gap:6,marginBottom:20,width:"fit-content"}}>
      {[["pending","Pending"],["approved","Completed"],["declined","Declined"]].map(([id,label])=>{
        const s=TAB_STYLES[id];
        const active=tab===id;
        return(
          <button key={id} onClick={()=>setTab(id)}
            style={{padding:"7px 18px",borderRadius:999,fontSize:12,fontWeight:700,cursor:"pointer",
              border:`1.5px solid ${active?s.active.background:"rgba(255,255,255,0.08)"}`,
              background:active?s.active.background:"rgba(255,255,255,0.04)",
              color:active?s.active.color:"#6B7280",
              transition:"all 0.15s",display:"flex",alignItems:"center",gap:7}}>
            {counts&&counts[id]>0&&(
              <span style={{width:7,height:7,borderRadius:"50%",background:active?"rgba(255,255,255,0.7)":s.dot,display:"inline-block",flexShrink:0}}/>
            )}
            {label}{counts&&counts[id]!=null?` (${counts[id]})`:""}</button>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN — MAKERS MANAGEMENT
// ════════════════════════════════════════════════════════════════════════════
function AdminMakers(){
  const [makers,setMakers]=useState([]);
  const [name,setName]=useState("");
  const [loading,setLoading]=useState(false);
  const [copied,setCopied]=useState(null);
  const refresh=()=>api.getMakers().then(setMakers).catch(()=>{});
  useEffect(()=>{refresh();},[]);

  const create=async()=>{
    if(!name.trim())return;
    setLoading(true);
    try{await api.createMaker({name:name.trim()});setName("");await refresh();}
    finally{setLoading(false);}
  };
  const toggle=async(m)=>{
    await api.updateMaker(m._id,{status:m.status==="active"?"suspended":"active"});await refresh();
  };
  const remove=async(id)=>{
    if(!window.confirm("Delete this maker?"))return;
    await api.deleteMaker(id);await refresh();
  };
  const copy=(key,id)=>{navigator.clipboard?.writeText(key);setCopied(id);setTimeout(()=>setCopied(null),2000);};

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:"#F9FAFB"}}>Manage Makers</h2>
        <p style={{margin:0,fontSize:13,color:"#6B7280"}}>Create maker accounts — they log in using their key on the Upgrade page</p>
      </div>
      <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:12,padding:18,marginBottom:20}}>
        <p style={{margin:"0 0 10px",fontSize:13,fontWeight:700,color:"#E5E7EB"}}>Create New Maker</p>
        <div style={{display:"flex",gap:10}}>
          <input placeholder="Maker name..." value={name} onChange={e=>setName(e.target.value)}
            style={{flex:1,background:"#0F1117",border:"1px solid #2D3748",borderRadius:8,padding:"8px 12px",fontSize:13,color:"#F9FAFB",outline:"none"}}/>
          <button onClick={create} disabled={loading||!name.trim()}
            style={{padding:"8px 18px",borderRadius:8,background:loading||!name.trim()?"#374151":"#5B21B6",color:"#fff",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
            {loading&&<Spinner size={12} color="white"/>}+ Create
          </button>
        </div>
      </div>
      {makers.length===0?(
        <div style={{padding:"40px 0",textAlign:"center",color:"#6B7280",fontSize:14}}>No makers yet.</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {makers.map(m=>(
            <div key={m._id} style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:12,padding:"14px 18px",
              display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
              <div style={{flex:1,minWidth:0}}>
                <p style={{margin:"0 0 3px",fontSize:14,fontWeight:700,color:"#F9FAFB"}}>{m.name}</p>
                <p style={{margin:0,fontSize:11,fontFamily:"monospace",color:"#6B7280"}}>{m.key}</p>
              </div>
              <span style={{fontSize:12,fontWeight:700,color:m.status==="active"?"#6EE7B7":"#F87171"}}>
                {m.status}
              </span>
              <span style={{fontSize:12,color:"#A78BFA",fontWeight:700}}>${m.earnings.toFixed(2)}</span>
              <button onClick={()=>copy(m.key,m._id)}
                style={{padding:"5px 12px",borderRadius:7,background:copied===m._id?"#064E3B":"#1F2937",
                  color:copied===m._id?"#6EE7B7":"#9CA3AF",fontSize:11,fontWeight:600,border:"1px solid #374151",cursor:"pointer"}}>
                {copied===m._id?"✓ Copied":"Copy Key"}
              </button>
              <button onClick={()=>toggle(m)}
                style={{padding:"5px 12px",borderRadius:7,background:"#1F2937",color:"#D1D5DB",fontSize:11,fontWeight:600,border:"1px solid #374151",cursor:"pointer"}}>
                {m.status==="active"?"Suspend":"Activate"}
              </button>
              <button onClick={()=>remove(m._id)}
                style={{padding:"5px 10px",borderRadius:7,background:"#7F1D1D",color:"#FCA5A5",fontSize:11,fontWeight:600,border:"1px solid #991B1B",cursor:"pointer"}}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN — SETTINGS (SMTP + RATE)
// ════════════════════════════════════════════════════════════════════════════
function AdminSettings(){
  const [s,setS]=useState({makerRate:0.09,smtpHost:"",smtpPort:587,smtpUser:"",smtpPass:"",smtpFrom:""});
  const [saved,setSaved]=useState(false);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{api.getSettings().then(r=>setS({...s,...r})).catch(()=>{});},[]);
  const save=async()=>{
    setLoading(true);
    try{await api.updateSettings(s);setSaved(true);setTimeout(()=>setSaved(false),2000);}
    finally{setLoading(false);}
  };
  const inp=(key)=>({value:s[key]||"",onChange:e=>setS({...s,[key]:e.target.value}),
    style:{width:"100%",background:"#0F1117",border:"1px solid #2D3748",borderRadius:8,padding:"8px 12px",
      fontSize:13,color:"#F9FAFB",outline:"none",boxSizing:"border-box"}});
  return(
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:"#F9FAFB"}}>Settings</h2>
        <p style={{margin:0,fontSize:13,color:"#6B7280"}}>Maker rate and SMTP configuration</p>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:480}}>
        <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:12,padding:18}}>
          <p style={{margin:"0 0 12px",fontSize:13,fontWeight:700,color:"#E5E7EB"}}>Maker Rate ($ per approved request)</p>
          <input type="number" step="0.01" min="0" {...inp("makerRate")} onChange={e=>setS({...s,makerRate:parseFloat(e.target.value)||0})}/>
        </div>
        <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:12,padding:18}}>
          <p style={{margin:"0 0 12px",fontSize:13,fontWeight:700,color:"#E5E7EB"}}>SMTP Configuration</p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {[["smtpHost","SMTP Host (e.g. smtp.gmail.com)"],["smtpUser","SMTP Username / Email"],["smtpPass","SMTP Password"],["smtpFrom","From Address"]].map(([k,ph])=>(
              <div key={k}>
                <label style={{fontSize:11,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:4}}>{ph}</label>
                <input type={k==="smtpPass"?"password":"text"} placeholder={ph} {...inp(k)}/>
              </div>
            ))}
            <div>
              <label style={{fontSize:11,color:"#6B7280",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.05em",display:"block",marginBottom:4}}>SMTP Port</label>
              <input type="number" {...inp("smtpPort")} onChange={e=>setS({...s,smtpPort:parseInt(e.target.value)||587})}/>
            </div>
          </div>
        </div>
        <button onClick={save} disabled={loading}
          style={{padding:"10px 0",borderRadius:9,background:saved?"#059669":loading?"#374151":"#5B21B6",
            color:"#fff",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          {loading&&<Spinner size={13} color="white"/>}
          {saved?"✓ Saved!":"Save Settings"}
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ADMIN — PAYOUT QUEUE
// ════════════════════════════════════════════════════════════════════════════
function AdminPayouts(){
  const [payouts,setPayouts]=useState([]);
  const [tab,setTab]=useState("pending");
  const refresh=()=>api.getPayouts().then(setPayouts).catch(()=>{});
  useEffect(()=>{refresh();},[]);
  const filtered=payouts.filter(p=>p.status===tab);
  const counts={pending:payouts.filter(p=>p.status==="pending").length,
    paid:payouts.filter(p=>p.status==="paid").length,
    rejected:payouts.filter(p=>p.status==="rejected").length};

  const mark=async(id,status,txnId="")=>{
    await api.updatePayout(id,{status,...(txnId?{txnId}:{})});await refresh();
  };

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:"#F9FAFB"}}>Payout Requests</h2>
        <p style={{margin:0,fontSize:13,color:"#6B7280"}}>Manage maker withdrawal requests</p>
      </div>
      <div style={{display:"flex",gap:3,background:"#0F1117",borderRadius:10,padding:3,marginBottom:20,width:"fit-content"}}>
        {[["pending","Pending"],["paid","Paid"],["rejected","Rejected"]].map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id)}
            style={{padding:"7px 16px",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",border:"none",
              background:tab===id?"#5B21B6":"transparent",color:tab===id?"#fff":"#6B7280"}}>
            {label} ({counts[id]||0})</button>
        ))}
      </div>
      {filtered.length===0?(
        <div style={{padding:"40px 0",textAlign:"center",color:"#6B7280",fontSize:14}}>No {tab} payouts.</div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {filtered.map(p=>(
            <div key={p._id} style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:12,padding:"14px 18px"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                <div>
                  <p style={{margin:"0 0 3px",fontSize:14,fontWeight:700,color:"#F9FAFB"}}>{p.makerName} — <span style={{color:"#A78BFA"}}>${p.amount.toFixed(2)}</span></p>
                  <p style={{margin:"0 0 2px",fontSize:12,color:"#6B7280"}}>{p.method.toUpperCase()} · {p.address}</p>
                  <p style={{margin:0,fontSize:11,color:"#4B5563"}}>{fmtDate(p.createdAt)}</p>
                  {p.txnId&&<p style={{margin:"3px 0 0",fontSize:11,color:"#6EE7B7"}}>TXN: {p.txnId}</p>}
                </div>
                {tab==="pending"&&(
                  <div style={{display:"flex",gap:8}}>
                    <button onClick={async()=>{
                      const txn=window.prompt("Enter transaction ID:");
                      if(txn!==null)await mark(p._id,"paid",txn);
                    }} style={{padding:"6px 14px",borderRadius:7,background:"rgba(5,150,105,0.3)",color:"#6EE7B7",fontSize:12,fontWeight:700,border:"1px solid #059669",cursor:"pointer"}}>
                      ✓ Mark Paid
                    </button>
                    <button onClick={()=>mark(p._id,"rejected")}
                      style={{padding:"6px 14px",borderRadius:7,background:"#7F1D1D",color:"#FCA5A5",fontSize:12,fontWeight:700,border:"1px solid #991B1B",cursor:"pointer"}}>
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  MAKER PANEL
// ════════════════════════════════════════════════════════════════════════════
function MakerPanel({maker,onLogout}){
  const [tab,setTab]=useState("upgrades");
  const [upgradeTab,setUpgradeTab]=useState("pending");
  const [renewTab,setRenewTab]=useState("pending");
  const [upgrades,setUpgrades]=useState([]);
  const [renewals,setRenewals]=useState([]);
  const [payouts,setPayouts]=useState([]);
  const [makerData,setMakerData]=useState(maker);
  const [rate,setRate]=useState(0.09);
  const [selectedUpgrade,setSelectedUpgrade]=useState(null);
  const [selectedRenew,setSelectedRenew]=useState(null);
  const [showDecline,setShowDecline]=useState(null); // {type,req}
  const [showPayoutForm,setShowPayoutForm]=useState(false);
  const [payMethod,setPayMethod]=useState("upi");
  const [payAddress,setPayAddress]=useState("");
  const [payLoading,setPayLoading]=useState(false);

  const refresh=async()=>{
    const [u,r,p,s,m]=await Promise.all([
      api.getUpgradeRequests(),api.getRenewRequests(),
      api.getMakerPayouts(maker._id),api.getSettings(),
      api.getMakers(),
    ]);
    setUpgrades(u);setRenewals(r);setPayouts(p);
    if(s.makerRate)setRate(s.makerRate);
    const me=m.find(x=>x._id===maker._id);if(me)setMakerData(me);
  };
  useEffect(()=>{refresh();},[]);

  const filteredU=upgrades.filter(r=>r.status===upgradeTab);
  const filteredR=renewals.filter(r=>r.status===renewTab);
  const uCounts={pending:upgrades.filter(r=>r.status==="pending").length,approved:upgrades.filter(r=>r.status==="approved").length,declined:upgrades.filter(r=>r.status==="declined").length};
  const rCounts={pending:renewals.filter(r=>r.status==="pending").length,approved:renewals.filter(r=>r.status==="approved").length,declined:renewals.filter(r=>r.status==="declined").length};
  const pendingPayout=payouts.filter(p=>p.status==="pending").reduce((a,b)=>a+b.amount,0);

  const handleDecline=async(type,req,reason)=>{
    setShowDecline(null);
    if(type==="upgrade"){
      await api.updateUpgradeRequest(req._id,{status:"declined",declineReason:reason,processedBy:maker._id});
      const k=await api.getKey(req.key);if(k)await api.updateKey(k._id,{status:"available"});
    }else{
      await api.updateRenewRequest(req._id,{status:"declined",declineReason:reason,processedBy:maker._id});
      const k=await api.getKey(req.key);if(k)await api.updateKey(k._id,{status:"used_upgrade"});
    }
    setSelectedUpgrade(null);setSelectedRenew(null);refresh();
  };

  const submitPayout=async()=>{
    if(!payAddress.trim())return;
    setPayLoading(true);
    try{
      await api.createPayout({makerId:maker._id,makerName:makerData.name,amount:makerData.earnings-pendingPayout,method:payMethod,address:payAddress.trim()});
      setShowPayoutForm(false);setPayAddress("");await refresh();
    }finally{setPayLoading(false);}
  };

  const DA="#0F1117",DS="#161B27",DB="#1E2536",DT="#F9FAFB",DM="#9CA3AF",DV="#7C3AED";

  return(
    <div style={{minHeight:"100vh",background:DA,fontFamily:"Inter,-apple-system,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}*{box-sizing:border-box;}input::placeholder{color:#6B7280;}`}</style>
      {showDecline&&<DeclineModal onConfirm={r=>handleDecline(showDecline.type,showDecline.req,r)} onClose={()=>setShowDecline(null)}/>}
      <div style={{display:"flex",minHeight:"100vh"}}>
        {/* Sidebar */}
        <div style={{width:220,background:DS,borderRight:`1px solid ${DB}`,display:"flex",flexDirection:"column",padding:"20px 0",flexShrink:0}}>
          <div style={{padding:"0 20px 20px",borderBottom:`1px solid ${DB}`,marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#059669,#10B981)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{color:"#fff",fontWeight:900,fontSize:14}}>M</span>
              </div>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:800,color:DT}}>{makerData.name}</p>
                <p style={{margin:0,fontSize:10,color:DM}}>Maker Panel</p>
              </div>
            </div>
          </div>
          {[{id:"upgrades",label:"Upgrade Requests",icon:"⚡"},{id:"renewals",label:"Renewal Requests",icon:"🔄"},{id:"earnings",label:"Earnings",icon:"💰"}].map(({id,label,icon})=>(
            <button key={id} onClick={()=>setTab(id)}
              style={{width:"100%",padding:"10px 20px",textAlign:"left",cursor:"pointer",
                background:tab===id?"rgba(5,150,105,0.2)":"transparent",
                color:tab===id?"#6EE7B7":DM,border:"none",
                borderLeft:tab===id?"3px solid #10B981":"3px solid transparent",
                fontSize:13,fontWeight:tab===id?700:500,display:"flex",alignItems:"center",gap:10}}>
              <span>{icon}</span>{label}
            </button>
          ))}
          <div style={{flex:1}}/>
          <button onClick={onLogout} style={{margin:"0 20px",padding:"9px 0",borderRadius:8,background:"#1F2937",color:DM,fontSize:12,fontWeight:600,border:"1px solid #374151",cursor:"pointer"}}>
            ← Logout
          </button>
        </div>
        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"28px 32px"}}>
          {tab==="upgrades"&&(
            <div>
              <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:DT}}>Upgrade Requests</h2>
              <p style={{margin:"0 0 16px",fontSize:13,color:DM}}>{upgrades.length} total</p>
              <RequestTabs tab={upgradeTab} setTab={setUpgradeTab} counts={uCounts}/>
              {selectedUpgrade?(
                <MakerUpgradeDetail req={selectedUpgrade} maker={maker} onBack={()=>{setSelectedUpgrade(null);refresh();}}
                  onDecline={req=>setShowDecline({type:"upgrade",req})} onApproved={refresh}/>
              ):(
                filteredU.length===0?<div style={{padding:"40px 0",textAlign:"center",color:DM,fontSize:14}}>No {upgradeTab} requests.</div>:(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {filteredU.map(r=>(
                      <div key={r._id} style={{background:DS,border:`1px solid ${DB}`,borderRadius:12,padding:"12px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setSelectedUpgrade(r)}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                              <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:DT}}>{r.key}</span>
                              <Badge status={r.status}/>
                            </div>
                            <p style={{margin:0,fontSize:12,color:DM}}>{r.email} · {fmtRelTime(r.createdAt)}</p>
                            {r.declineReason&&<p style={{margin:"3px 0 0",fontSize:11,color:"#F87171"}}>Reason: {r.declineReason}</p>}
                          </div>
                          <span style={{color:DM,fontSize:16,flexShrink:0}}>›</span>
                        </div>
                        {r.status==="pending"&&(
                          <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${DB}`,display:"flex",gap:8}}>
                            <button onClick={()=>setSelectedUpgrade(r)}
                              style={{flex:1,padding:"6px 0",borderRadius:7,background:"rgba(16,185,129,0.15)",color:"#6EE7B7",fontSize:11,fontWeight:700,border:`1px solid #059669`,cursor:"pointer"}}>
                              Open →
                            </button>
                            <button onClick={()=>setShowDecline({type:"upgrade",req:r})}
                              style={{flex:1,padding:"6px 0",borderRadius:7,background:"rgba(220,38,38,0.15)",color:"#F87171",fontSize:11,fontWeight:700,border:"1px solid #991B1B",cursor:"pointer"}}>
                              ✕ Decline
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
          {tab==="renewals"&&(
            <div>
              <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:DT}}>Renewal Requests</h2>
              <p style={{margin:"0 0 16px",fontSize:13,color:DM}}>{renewals.length} total</p>
              <RequestTabs tab={renewTab} setTab={setRenewTab} counts={rCounts}/>
              {selectedRenew?(
                <MakerRenewDetail req={selectedRenew} maker={maker} onBack={()=>{setSelectedRenew(null);refresh();}}
                  onDecline={req=>setShowDecline({type:"renew",req})} onApproved={refresh}/>
              ):(
                filteredR.length===0?<div style={{padding:"40px 0",textAlign:"center",color:DM,fontSize:14}}>No {renewTab} requests.</div>:(
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {filteredR.map(r=>(
                      <div key={r._id} style={{background:DS,border:`1px solid ${DB}`,borderRadius:12,padding:"12px 16px"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}} onClick={()=>setSelectedRenew(r)}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4,flexWrap:"wrap"}}>
                              <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:DT}}>{r.key}</span>
                              <Badge status={r.status}/>
                            </div>
                            <p style={{margin:0,fontSize:12,color:DM}}>{r.oldEmail} → {r.newEmail} · {fmtRelTime(r.createdAt)}</p>
                            {r.declineReason&&<p style={{margin:"3px 0 0",fontSize:11,color:"#F87171"}}>Reason: {r.declineReason}</p>}
                          </div>
                          <span style={{color:DM,fontSize:16,flexShrink:0}}>›</span>
                        </div>
                        {r.status==="pending"&&(
                          <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${DB}`,display:"flex",gap:8}}>
                            <button onClick={()=>setSelectedRenew(r)}
                              style={{flex:1,padding:"6px 0",borderRadius:7,background:"rgba(16,185,129,0.15)",color:"#6EE7B7",fontSize:11,fontWeight:700,border:`1px solid #059669`,cursor:"pointer"}}>
                              Open →
                            </button>
                            <button onClick={()=>setShowDecline({type:"renew",req:r})}
                              style={{flex:1,padding:"6px 0",borderRadius:7,background:"rgba(220,38,38,0.15)",color:"#F87171",fontSize:11,fontWeight:700,border:"1px solid #991B1B",cursor:"pointer"}}>
                              ✕ Decline
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
          {tab==="earnings"&&(
            <div>
              <h2 style={{margin:"0 0 20px",fontSize:22,fontWeight:900,color:DT}}>Earnings Dashboard</h2>
              <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:24}}>
                {[
                  {label:"Total Earned",value:`$${makerData.earnings.toFixed(2)}`,icon:"💰",color:"#A78BFA"},
                  {label:"Per Request",value:`$${rate.toFixed(2)}`,icon:"⚡",color:"#6EE7B7"},
                  {label:"Pending Payout",value:`$${pendingPayout.toFixed(2)}`,icon:"⏳",color:"#FCD34D"},
                ].map(({label,value,icon,color})=>(
                  <div key={label} style={{background:DS,border:`1px solid ${DB}`,borderRadius:14,padding:"18px 20px",textAlign:"center"}}>
                    <div style={{fontSize:24,marginBottom:8}}>{icon}</div>
                    <p style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color}}>{value}</p>
                    <p style={{margin:0,fontSize:12,color:DM,fontWeight:600}}>{label}</p>
                  </div>
                ))}
              </div>
              <button onClick={()=>setShowPayoutForm(true)}
                style={{padding:"11px 24px",borderRadius:10,background:"#5B21B6",color:"#fff",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",marginBottom:24}}>
                Request Payout →
              </button>
              {showPayoutForm&&(
                <div style={{background:DS,border:`1px solid ${DB}`,borderRadius:14,padding:20,marginBottom:20,maxWidth:420}}>
                  <p style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:DT}}>Request Payout</p>
                  <p style={{margin:"0 0 10px",fontSize:12,color:DM}}>Available: <strong style={{color:"#A78BFA"}}>${Math.max(0,makerData.earnings-pendingPayout).toFixed(2)}</strong></p>
                  <div style={{display:"flex",gap:6,marginBottom:12}}>
                    {[["upi","UPI"],["ltc","LTC"],["usdt_bep20","USDT BEP20"]].map(([id,label])=>(
                      <button key={id} onClick={()=>setPayMethod(id)}
                        style={{flex:1,padding:"8px 4px",borderRadius:8,cursor:"pointer",fontSize:11,fontWeight:700,
                          background:payMethod===id?"rgba(91,33,182,0.3)":"#0F1117",
                          border:`1.5px solid ${payMethod===id?"#7C3AED":"#2D3748"}`,
                          color:payMethod===id?"#A78BFA":"#6B7280"}}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <input placeholder={payMethod==="upi"?"UPI ID (e.g. name@upi)":"Wallet address"}
                    value={payAddress} onChange={e=>setPayAddress(e.target.value)}
                    style={{width:"100%",background:"#0F1117",border:"1px solid #2D3748",borderRadius:8,padding:"9px 12px",fontSize:13,color:DT,outline:"none",marginBottom:12,boxSizing:"border-box"}}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <button onClick={()=>{setShowPayoutForm(false);setPayAddress("");}}
                      style={{padding:"9px 0",borderRadius:8,background:"#1F2937",color:DM,fontSize:12,fontWeight:700,border:"1px solid #374151",cursor:"pointer"}}>
                      Cancel
                    </button>
                    <button onClick={submitPayout} disabled={payLoading||!payAddress.trim()}
                      style={{padding:"9px 0",borderRadius:8,background:payLoading||!payAddress.trim()?"#374151":"#5B21B6",color:"#fff",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                      {payLoading&&<Spinner size={12} color="white"/>}Submit
                    </button>
                  </div>
                </div>
              )}
              {payouts.length>0&&(
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:DT,marginBottom:10}}>Transaction History</p>
                  <div style={{display:"flex",flexDirection:"column",gap:6}}>
                    {payouts.map(p=>(
                      <div key={p._id} style={{background:DS,border:`1px solid ${DB}`,borderRadius:10,padding:"12px 16px",
                        display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                        <div>
                          <p style={{margin:"0 0 2px",fontSize:13,fontWeight:700,color:DT}}>${p.amount.toFixed(2)} via {p.method.toUpperCase()}</p>
                          <p style={{margin:0,fontSize:11,color:DM}}>{p.address} · {fmtDate(p.createdAt)}</p>
                          {p.txnId&&<p style={{margin:"2px 0 0",fontSize:11,color:"#6EE7B7"}}>TXN: {p.txnId}</p>}
                        </div>
                        <span style={{fontSize:12,fontWeight:700,color:p.status==="paid"?"#6EE7B7":p.status==="rejected"?"#F87171":"#FCD34D"}}>
                          {p.status.toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MakerUpgradeDetail({req,maker,onBack,onDecline,onApproved}){
  const [username,setUsername]=useState(req.confirmedUsername||"");
  const [usernameConfirmed,setUsernameConfirmed]=useState(!!req.confirmedUsername);
  const [upgradeType,setUpgradeType]=useState(req.upgradeType||"");
  const [plan,setPlan]=useState(req.plan||"");
  const [address,setAddress]=useState(req.address||"");
  const [country,setCountry]=useState(req.countryUpgraded||"");
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(req.status==="approved");
  const [r,setR]=useState(req);
  const INDIVIDUAL_PLANS=["individual_1m","individual_3m","individual_6m","individual_12m"];
  const FAMILY_PLANS=["family_1m","family_3m","family_6m","family_12m"];

  const confirmUsername=async()=>{
    if(!username.trim())return;
    await api.updateUpgradeRequest(r._id,{confirmedUsername:username.trim()});
    setUsernameConfirmed(true);setR({...r,confirmedUsername:username.trim()});
  };

  const handleApprove=async()=>{
    if(!upgradeType||!plan||!country)return;
    setLoading(true);
    try{
      const cooldown=new Date(Date.now()+15*24*60*60*1000).toISOString();
      const k=await api.getKey(r.key);
      if(k)await api.updateKey(k._id,{status:"used_upgrade",usedFor:"upgrade",usedByEmail:r.email,usedByUsername:username.trim(),country,plan,address:address||null,upgradeType,usedDate:new Date().toISOString(),cooldownUntil:cooldown});
      await api.updateUpgradeRequest(r._id,{status:"approved",confirmedUsername:username.trim(),upgradeType,plan,address,countryUpgraded:country,processedBy:maker._id});
      setDone(true);onApproved();
    }finally{setLoading(false);}
  };

  const DA="#0F1117",DS="#161B27",DB="#1E2536",DT="#F9FAFB",DM="#9CA3AF";
  return(
    <div>
      <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:DM,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5,padding:0,marginBottom:20}}>← Back</button>
      {done&&<div style={{padding:"12px 16px",background:"#064E3B",border:"1px solid #065F46",borderRadius:12,marginBottom:20,color:"#6EE7B7",fontSize:13,fontWeight:600}}>✓ Upgrade approved!</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div style={{background:DS,border:`1px solid ${DB}`,borderRadius:14,padding:20}}>
          <p style={{margin:"0 0 14px",fontSize:13,fontWeight:800,color:DT,textTransform:"uppercase",letterSpacing:"0.08em"}}>Request Info</p>
          {[["Key",r.key],["Email",r.email],["Password",r.password||"—"],["Country",r.country||"—"],["Status",r.status]].map(([lbl,val])=>(
            <div key={lbl} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${DB}`}}>
              <span style={{fontSize:12,color:DM,fontWeight:600}}>{lbl}</span>
              <span style={{fontSize:12,color:DT,fontWeight:600,fontFamily:lbl==="Key"?"monospace":"inherit"}}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{background:DS,border:`1px solid ${DB}`,borderRadius:14,padding:20}}>
          <p style={{margin:"0 0 14px",fontSize:13,fontWeight:800,color:DT,textTransform:"uppercase",letterSpacing:"0.08em"}}>Actions</p>
          {!usernameConfirmed?(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <input placeholder="Spotify username" value={username} onChange={e=>setUsername(e.target.value)}
                style={{background:DA,border:`1px solid #2D3748`,borderRadius:8,padding:"8px 12px",fontSize:13,color:DT,outline:"none",width:"100%"}}/>
              <button onClick={confirmUsername} disabled={!username.trim()}
                style={{padding:"9px 0",borderRadius:8,background:username.trim()?"#1D4ED8":"#374151",color:"#fff",fontSize:13,fontWeight:700,border:"none",cursor:"pointer",width:"100%"}}>
                Confirm Username
              </button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{padding:"9px 12px",background:"#064E3B",border:"1px solid #065F46",borderRadius:9,display:"flex",alignItems:"center",gap:7}}>
                <span style={{color:"#6EE7B7",fontWeight:800}}>✓</span>
                <span style={{fontSize:13,color:"#6EE7B7",fontWeight:700}}>@{r.confirmedUsername||username}</span>
              </div>
              {!done&&(
                <>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    {["individual","family"].map(t=>(
                      <button key={t} onClick={()=>{setUpgradeType(t);setPlan("");}}
                        style={{padding:"9px 6px",borderRadius:8,cursor:"pointer",background:upgradeType===t?"rgba(91,33,182,0.3)":DA,border:`1.5px solid ${upgradeType===t?"#7C3AED":"#2D3748"}`,color:upgradeType===t?"#A78BFA":DM,fontSize:12,fontWeight:700}}>
                        {t==="individual"?"👤 Individual":"👨‍👩‍👧 Family"}
                      </button>
                    ))}
                  </div>
                  {upgradeType&&(
                    <>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                        {(upgradeType==="individual"?INDIVIDUAL_PLANS:FAMILY_PLANS).map(p=>(
                          <button key={p} onClick={()=>setPlan(p)}
                            style={{padding:"6px 4px",borderRadius:7,cursor:"pointer",background:plan===p?"rgba(5,150,105,0.2)":DA,border:`1.5px solid ${plan===p?"#059669":"#2D3748"}`,color:plan===p?"#6EE7B7":DM,fontSize:11,fontWeight:700}}>
                            {p.replace(/_/g," ")}
                          </button>
                        ))}
                      </div>
                      {upgradeType==="family"&&<input placeholder="Billing address" value={address} onChange={e=>setAddress(e.target.value)} style={{background:DA,border:`1px solid #2D3748`,borderRadius:8,padding:"7px 10px",fontSize:12,color:DT,outline:"none",width:"100%"}}/>}
                      <select value={country} onChange={e=>setCountry(e.target.value)}
                        style={{background:DA,border:`1px solid #2D3748`,borderRadius:8,padding:"8px 10px",fontSize:12,color:DT,outline:"none",width:"100%"}}>
                        <option value="">Select country...</option>
                        {COUNTRIES.map(c=><option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                        <button onClick={()=>onDecline(r)}
                          style={{padding:"9px 0",borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",fontSize:12,fontWeight:700,border:"1px solid #991B1B",cursor:"pointer"}}>
                          ✕ Decline
                        </button>
                        <button onClick={handleApprove} disabled={!plan||!country||loading}
                          style={{padding:"9px 0",borderRadius:8,background:!plan||!country?"#374151":"#059669",color:"#fff",fontSize:12,fontWeight:700,border:"none",cursor:!plan||!country?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                          {loading&&<Spinner size={12} color="white"/>}✓ Approve
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MakerRenewDetail({req,maker,onBack,onDecline,onApproved}){
  const [enteredUsername,setEnteredUsername]=useState("");
  const [usernameError,setUsernameError]=useState("");
  const [usernameMatch,setUsernameMatch]=useState(false);
  const [proofStatus,setProofStatus]=useState(req.proofStatus||null);
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(req.status==="approved");
  const [r,setR]=useState(req);
  const [originalUsername,setOriginalUsername]=useState(null);
  useEffect(()=>{api.getKey(r.key).then(k=>setOriginalUsername(k?.usedByUsername||null)).catch(()=>{});},[r.key]);

  const checkUsername=async()=>{
    setUsernameError("");
    if(enteredUsername.trim()!==originalUsername){setUsernameError(`Doesn't match! Expected: @${originalUsername}`);return;}
    setUsernameMatch(true);
    await api.updateRenewRequest(r._id,{confirmedUsername:enteredUsername.trim()});
  };
  const setProof=async(status)=>{setProofStatus(status);await api.updateRenewRequest(r._id,{proofStatus:status});};
  const handleApprove=async()=>{
    if(!usernameMatch||proofStatus!=="confirmed")return;
    setLoading(true);
    try{
      const cooldown=new Date(Date.now()+15*24*60*60*1000).toISOString();
      const k=await api.getKey(r.key);
      if(k)await api.updateKey(k._id,{status:"used_renew",usedFor:"renew",usedByEmail:r.newEmail,usedDate:new Date().toISOString(),cooldownUntil:cooldown,country:r.country});
      await api.updateRenewRequest(r._id,{status:"approved",processedBy:maker._id});
      setDone(true);onApproved();
    }finally{setLoading(false);}
  };

  const DA="#0F1117",DS="#161B27",DB="#1E2536",DT="#F9FAFB",DM="#9CA3AF";
  return(
    <div>
      <button onClick={onBack} style={{background:"none",border:"none",cursor:"pointer",color:DM,fontSize:13,fontWeight:600,display:"flex",alignItems:"center",gap:5,padding:0,marginBottom:20}}>← Back</button>
      {done&&<div style={{padding:"12px 16px",background:"#064E3B",border:"1px solid #065F46",borderRadius:12,marginBottom:20,color:"#6EE7B7",fontSize:13,fontWeight:600}}>✓ Renewal approved!</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        <div style={{background:DS,border:`1px solid ${DB}`,borderRadius:14,padding:20}}>
          <p style={{margin:"0 0 14px",fontSize:13,fontWeight:800,color:DT,textTransform:"uppercase",letterSpacing:"0.08em"}}>Request Info</p>
          {[["Key",r.key],["Old Email",r.oldEmail],["Old Password",r.oldPassword||"—"],["New Email",r.newEmail||"—"],["New Password",r.newPassword||"—"],["Country",r.country||"—"],["Proof Files",(r.files||[]).join(", ")||"—"]].map(([lbl,val])=>(
            <div key={lbl} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${DB}`,gap:8,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:DM,fontWeight:600,flexShrink:0}}>{lbl}</span>
              <span style={{fontSize:12,color:DT,fontWeight:600,fontFamily:lbl==="Key"?"monospace":"inherit",textAlign:"right",wordBreak:"break-all"}}>{val}</span>
            </div>
          ))}
          {originalUsername&&<div style={{marginTop:10,padding:"9px 12px",background:"#1A2035",border:"1px solid #2D3748",borderRadius:9}}><p style={{margin:0,fontSize:12,color:"#A78BFA",fontWeight:700}}>@{originalUsername}</p></div>}
        </div>
        <div style={{background:DS,border:`1px solid ${DB}`,borderRadius:14,padding:20}}>
          <p style={{margin:"0 0 14px",fontSize:13,fontWeight:800,color:DT,textTransform:"uppercase",letterSpacing:"0.08em"}}>Actions</p>
          {!usernameMatch?(
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <p style={{margin:0,fontSize:12,color:DM}}>Enter username to verify: <strong style={{color:"#A78BFA"}}>@{originalUsername||"?"}</strong></p>
              <input placeholder="Spotify username" value={enteredUsername} onChange={e=>{setEnteredUsername(e.target.value);setUsernameError("");}}
                style={{background:DA,border:`1px solid ${usernameError?"#DC2626":"#2D3748"}`,borderRadius:8,padding:"8px 12px",fontSize:13,color:DT,outline:"none",width:"100%"}}/>
              {usernameError&&<p style={{fontSize:12,color:"#F87171",margin:0}}>{usernameError}</p>}
              <button onClick={checkUsername} disabled={!enteredUsername.trim()}
                style={{padding:"9px 0",borderRadius:8,background:enteredUsername.trim()?"#1D4ED8":"#374151",color:"#fff",fontSize:12,fontWeight:700,border:"none",cursor:"pointer",width:"100%"}}>
                Verify Username
              </button>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{padding:"9px 12px",background:"#064E3B",border:"1px solid #065F46",borderRadius:9,display:"flex",alignItems:"center",gap:7}}>
                <span style={{color:"#6EE7B7",fontWeight:800}}>✓</span>
                <span style={{fontSize:13,color:"#6EE7B7",fontWeight:700}}>@{enteredUsername}</span>
              </div>
              {!done&&(
                <>
                  <p style={{margin:"0 0 6px",fontSize:12,color:DM,fontWeight:700}}>Review Proof</p>
                  <ProofViewer urls={r.files||[]} dark={true}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:8}}>
                    <button onClick={()=>setProof("confirmed")} style={{padding:"8px 0",borderRadius:7,cursor:"pointer",background:proofStatus==="confirmed"?"rgba(5,150,105,0.3)":DA,border:`1.5px solid ${proofStatus==="confirmed"?"#059669":"#2D3748"}`,color:proofStatus==="confirmed"?"#6EE7B7":DM,fontSize:12,fontWeight:700}}>✓ Confirmed</button>
                    <button onClick={()=>setProof("declined")} style={{padding:"8px 0",borderRadius:7,cursor:"pointer",background:proofStatus==="declined"?"rgba(220,38,38,0.2)":DA,border:`1.5px solid ${proofStatus==="declined"?"#DC2626":"#2D3748"}`,color:proofStatus==="declined"?"#F87171":DM,fontSize:12,fontWeight:700}}>✕ Declined</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <button onClick={()=>onDecline(r)} style={{padding:"9px 0",borderRadius:8,background:"#7F1D1D",color:"#FCA5A5",fontSize:12,fontWeight:700,border:"1px solid #991B1B",cursor:"pointer"}}>✕ Decline</button>
                    <button onClick={handleApprove} disabled={proofStatus!=="confirmed"||loading}
                      style={{padding:"9px 0",borderRadius:8,background:proofStatus!=="confirmed"?"#374151":"#059669",color:"#fff",fontSize:12,fontWeight:700,border:"none",cursor:proofStatus!=="confirmed"?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
                      {loading&&<Spinner size={12} color="white"/>}✓ Approve
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
//  ROOT APP
// ════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [page,setPage]=useState("upgrade");
  const [isAdmin,setIsAdmin]=useState(()=>localStorage.getItem("role")==="admin");
  const [maker,setMaker]=useState(()=>{try{const m=localStorage.getItem("maker");return m?JSON.parse(m):null;}catch{return null;}});
  const [keyInfoPrefill,setKeyInfoPrefill]=useState("");
  const [renewPrefill,setRenewPrefill]=useState("");

  const goToKeyInfo=k=>{setKeyInfoPrefill(k);setPage("keyinfo");};
  const goToRenew=k=>{setRenewPrefill(k);setPage("renew");};
  const navTo=id=>{if(id!=="keyinfo")setKeyInfoPrefill("");if(id!=="renew")setRenewPrefill("");setPage(id);};

  const loginAdmin=()=>{localStorage.setItem("role","admin");setIsAdmin(true);};
  const loginMaker=m=>{localStorage.setItem("maker",JSON.stringify(m));setMaker(m);};
  const logoutAdmin=()=>{localStorage.removeItem("role");setIsAdmin(false);};
  const logoutMaker=()=>{localStorage.removeItem("maker");setMaker(null);};

  if(isAdmin)return <AdminPanel onLogout={logoutAdmin}/>;
  if(maker)return <MakerPanel maker={maker} onLogout={logoutMaker}/>;

  return(
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Inter,-apple-system,sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        *{box-sizing:border-box;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.45}}
        input::placeholder{color:#8492A6;}
        button:active{opacity:0.9;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:2px;}
        .nav-label{display:inline;}
        .mobile-bottom-nav{display:none;}
        .desktop-nav{display:flex;}
        @media(max-width:640px){
          .nav-label{display:none;}
          .mobile-bottom-nav{display:flex;}
          .desktop-nav{display:none;}
          .two-col{grid-template-columns:1fr!important;}
          .three-col{grid-template-columns:1fr 1fr!important;}
          .page-pad{padding:16px 12px!important;}
          .card-pad{padding:16px!important;}
          .stat-grid{grid-template-columns:1fr 1fr!important;}
          .processing-grid{grid-template-columns:1fr!important;}
          .admin-sidebar{display:none!important;}
          .admin-content{padding:16px!important;}
          .admin-stats-bar{padding:16px 16px 0!important;}
          .admin-mobile-tabs{display:flex!important;}
        }
        .admin-mobile-tabs{display:none;}
        @media(max-width:700px){.uptime-bars{display:none!important;}}
        @media(max-width:640px){.site-footer{margin-bottom:72px!important;}}
        @media(max-width:480px){
          .three-col{grid-template-columns:1fr!important;}
          .stat-grid{grid-template-columns:1fr 1fr!important;}
        }
        @media(min-width:641px) and (max-width:900px){
          .two-col{grid-template-columns:1fr!important;}
          .three-col{grid-template-columns:1fr 1fr!important;}
          .processing-grid{grid-template-columns:1fr!important;}
        }
      `}</style>

      {/* Nav — desktop */}
      <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(242,244,248,0.92)",
        backdropFilter:"blur(14px)",borderBottom:`1px solid ${C.border}`}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"0 16px",height:60,
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#5B21B6,#7C3AED)",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{color:"#fff",fontWeight:900,fontSize:14}}>S</span>
            </div>
            <span style={{fontWeight:900,fontSize:15,color:C.text}}>SpotiGrader</span>
            <span style={{fontWeight:400,color:C.textMuted,fontSize:15}}>.cc</span>
          </div>
          <div className="desktop-nav" style={{alignItems:"center",gap:3,background:C.surface,
            border:`1px solid ${C.border}`,borderRadius:12,padding:3}}>
            {NAV_ITEMS.map(({id,label,emoji})=>(
              <button key={id} onClick={()=>navTo(id)} style={{
                display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:9,
                fontSize:12,fontWeight:700,cursor:"pointer",
                background:page===id?C.violet:"transparent",
                color:page===id?"#fff":C.textSub,border:"none",transition:"all 0.15s"}}>
                <span style={{fontSize:13}}>{emoji}</span><span className="nav-label">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <div className="mobile-bottom-nav" style={{position:"fixed",bottom:0,left:0,right:0,zIndex:200,
        background:"rgba(242,244,248,0.97)",backdropFilter:"blur(14px)",
        borderTop:`1px solid ${C.border}`,padding:"6px 0 max(6px,env(safe-area-inset-bottom))"}}>
        {NAV_ITEMS.map(({id,label,emoji})=>(
          <button key={id} onClick={()=>navTo(id)} style={{
            flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"6px 4px",
            background:"none",border:"none",cursor:"pointer",
            color:page===id?C.violet:C.textMuted}}>
            <span style={{fontSize:20}}>{emoji}</span>
            <span style={{fontSize:9,fontWeight:700,letterSpacing:"0.03em"}}>{label}</span>
          </button>
        ))}
      </div>

      <main style={{paddingBottom:"env(safe-area-inset-bottom)"}}>
        <style>{`@media(max-width:640px){main{padding-bottom:72px!important;}}`}</style>
        {page==="upgrade"&&<UpgradePage onViewStatus={goToKeyInfo} onAdminLogin={loginAdmin} onMakerLogin={loginMaker}/>}
        {page==="renew"&&<RenewPage onViewStatus={goToKeyInfo} prefillKey={renewPrefill} key={renewPrefill}/>}
        {page==="keyinfo"&&<KeyInfoPage prefillKey={keyInfoPrefill} key={keyInfoPrefill} onRenew={goToRenew}/>}
        {page==="status"&&<StatusPage/>}
      </main>

      <footer style={{borderTop:`1px solid ${C.border}`,marginTop:20,paddingBottom:"env(safe-area-inset-bottom)"}} className="site-footer">
        <div style={{maxWidth:900,margin:"0 auto",padding:"20px",
          display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:24,height:24,borderRadius:7,background:"linear-gradient(135deg,#5B21B6,#7C3AED)",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{color:"#fff",fontWeight:900,fontSize:11}}>U</span>
            </div>
            <span style={{fontSize:12,color:C.textSub,fontWeight:500}}>SpotiGrader.cc — Lifetime Spotify Upgrades</span>
          </div>
          <div style={{display:"flex",gap:14,fontSize:11,color:C.textMuted,fontWeight:600}}>
            <span>No logs kept</span><span>·</span><span>Encrypted</span><span>·</span><span>Lifetime guarantee</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
