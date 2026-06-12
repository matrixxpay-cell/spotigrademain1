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

// ─── MOCK DB (simulates MongoDB spotigrader_main) ─────────────────────────────
// In production replace this with fetch() calls to Express/MongoDB backend
// MongoDB schema mirrors exactly what's defined here
const DB = (() => {
  const now = () => new Date().toISOString();
  const uid = () => Math.random().toString(36).slice(2,10).toUpperCase();
  const keyFmt = () => {
    const s = () => Math.random().toString(36).slice(2,6).toUpperCase();
    return `${s()}-${s()}-${s()}-${s()}`;
  };

  let keys = [
    { _id:"k1", key:"ABCD-1234-EFGH-5678", status:"available", usedFor:null, usedByEmail:null,
      usedByUsername:null, country:null, plan:null, address:null,
      purchaseDate:"2025-01-10T10:00:00.000Z", usedDate:null, cooldownUntil:null,
      upgradeType:null, createdAt:"2025-01-10T10:00:00.000Z" },
    { _id:"k2", key:"WXYZ-9876-MNOP-4321", status:"used_upgrade", usedFor:"upgrade",
      usedByEmail:"john@example.com", usedByUsername:"john_music",
      country:"US", plan:"individual_1m", address:null,
      purchaseDate:"2025-02-01T09:00:00.000Z", usedDate:"2025-03-01T12:00:00.000Z",
      cooldownUntil: new Date(Date.now()+8*24*60*60*1000).toISOString(),
      upgradeType:"individual", createdAt:"2025-02-01T09:00:00.000Z" },
    { _id:"k3", key:"LMNO-5555-PQRS-7777", status:"available",usedFor:null,usedByEmail:null,
      usedByUsername:null,country:null,plan:null,address:null,
      purchaseDate:"2025-03-15T08:00:00.000Z",usedDate:null,cooldownUntil:null,
      upgradeType:null,createdAt:"2025-03-15T08:00:00.000Z" },
  ];
  let upgradeRequests = [];
  let renewRequests = [];

  return {
    // KEYS
    getKeys: () => [...keys],
    getKey: (keyStr) => keys.find(k=>k.key===keyStr)||null,
    generateKeys: (count) => {
      const newKeys = Array.from({length:count},()=>({
        _id:uid(), key:keyFmt(), status:"available", usedFor:null,
        usedByEmail:null, usedByUsername:null, country:null, plan:null, address:null,
        purchaseDate:now(), usedDate:null, cooldownUntil:null, upgradeType:null, createdAt:now()
      }));
      keys = [...keys,...newKeys];
      return newKeys;
    },
    deleteKeys: (ids) => { keys = keys.filter(k=>!ids.includes(k._id)); },
    updateKey: (id, update) => {
      keys = keys.map(k=>k._id===id?{...k,...update}:k);
    },
    // UPGRADE REQUESTS
    createUpgradeRequest: (data) => {
      const req = {_id:uid(), ...data, status:"pending", createdAt:now(), adminNote:null,
        confirmedUsername:null, plan:null, duration:null, address:null, countryUpgraded:null};
      upgradeRequests.push(req);
      return req;
    },
    getUpgradeRequests: () => [...upgradeRequests].reverse(),
    getUpgradeRequest: (id) => upgradeRequests.find(r=>r._id===id)||null,
    updateUpgradeRequest: (id, update) => {
      upgradeRequests = upgradeRequests.map(r=>r._id===id?{...r,...update}:r);
    },
    // RENEW REQUESTS
    createRenewRequest: (data) => {
      const req = {_id:uid(), ...data, status:"pending", createdAt:now(), adminNote:null,
        proofStatus:null, confirmedUsername:null};
      renewRequests.push(req);
      return req;
    },
    getRenewRequests: () => [...renewRequests].reverse(),
    getRenewRequest: (id) => renewRequests.find(r=>r._id===id)||null,
    updateRenewRequest: (id, update) => {
      renewRequests = renewRequests.map(r=>r._id===id?{...r,...update}:r);
    },
  };
})();

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  {id:"upgrade",label:"Upgrade",emoji:"⚡"},
  {id:"renew",  label:"Renew",  emoji:"🔄"},
  {id:"keyinfo",label:"Key Info",emoji:"🔑"},
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

function Btn({children,onClick,disabled,loading,variant="primary",size="md",color,style:{}}={}){
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

// ════════════════════════════════════════════════════════════════════════════
//  KEY INFO PAGE
// ════════════════════════════════════════════════════════════════════════════
function KeyInfoPage({prefillKey="",onRenew}){
  const [tab,setTab]=useState("key");
  const [keyInput,setKeyInput]=useState(prefillKey);
  const [usernameInput,setUsernameInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);
  const [err,setErr]=useState("");

  const lookup=useCallback((q,byUsername=false)=>{
    if(!q.trim())return;
    setLoading(true);setData(null);setErr("");
    setTimeout(()=>{
      setLoading(false);
      let found=byUsername
        ?DB.getKeys().find(k=>k.usedByUsername===q.trim())
        :DB.getKey(q.trim());
      if(!found){setErr("No record found for this "+(byUsername?"username":"key")+".");return;}
      // determine display status
      let displayStatus=found.status;
      if(found.cooldownUntil&&new Date(found.cooldownUntil)>new Date())displayStatus="cooldown";
      setData({...found,displayStatus});
    },900);
  },[]);

  useEffect(()=>{if(prefillKey){setKeyInput(prefillKey);lookup(prefillKey);}},[ prefillKey]);

  const clLeft=data?cooldownLeft(data.cooldownUntil):null;
  const canRenew=data&&data.status==="used_upgrade"&&(!data.cooldownUntil||new Date(data.cooldownUntil)<=new Date());

  return(
    <div style={{maxWidth:680,margin:"0 auto",padding:"32px 20px"}}>
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
          <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:4}}>
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
  const [s,setS]=useState(0);
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
  useEffect(()=>{
    const t1=setTimeout(()=>setS(1),2800);
    const t2=setTimeout(()=>setS(2),5500);
    return()=>{clearTimeout(t1);clearTimeout(t2);};
  },[]);
  useEffect(()=>{const iv=setInterval(()=>setLast(new Date()),4000);return()=>clearInterval(iv);},[]);
  const done=s>=2;
  const accentColor=type==="renew"?C.green:C.violet;
  const fmt=d=>d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit"});
  return(
    <div style={{maxWidth:860,margin:"0 auto",padding:"32px 20px"}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>
        {/* Left */}
        <Card style={{padding:28}}>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:22}}>
            <div style={{width:48,height:48,borderRadius:14,
              background:done?C.greenLight:C.amberLight,
              display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:24}}>
              {done?"✅":"⏳"}
            </div>
            <div>
              <h2 style={{margin:"0 0 3px",fontSize:18,fontWeight:800,color:C.text}}>
                {done?(type==="renew"?"Renewal Complete!":"Upgrade Complete!"):(type==="renew"?"Renewal In Progress":"Upgrade In Progress")}
              </h2>
              <p style={{margin:0,fontSize:13,color:C.textSub}}>
                {done?"Your account is now Premium":"Processing your Spotify account..."}
              </p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",borderRadius:12,marginBottom:18,
            background:done?C.greenLight:"#FFFBEB",border:`1px solid ${done?C.greenBorder:C.amberBorder}`}}>
            <span style={{flexShrink:0}}>
              {done?<span style={{color:C.green,fontSize:16,fontWeight:700}}>✓</span>:<Spinner size={14} color={C.amber}/>}
            </span>
            <p style={{margin:0,fontSize:13,fontWeight:700,color:done?C.greenText:C.amber}}>
              {done?"Successful — Premium is now active":"In Queue — Your request is being processed"}
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
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 13px",
            background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:10}}>
            <Spinner size={12} color={accentColor}/>
            <div>
              <p style={{margin:0,fontSize:12,fontWeight:700,color:accentColor}}>Auto-refreshing status</p>
              <p style={{margin:"1px 0 0",fontSize:11,color:C.textMuted}}>Last checked: {fmt(last)}</p>
            </div>
          </div>
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
function UpgradePage({onViewStatus}){
  const [step,setStep]=useState(0);
  const [key,setKey]=useState("");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [country,setCountry]=useState("");
  const [loading,setLoading]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [reqId,setReqId]=useState(null);
  const [keyErr,setKeyErr]=useState("");

  const validateKey=()=>{
    setKeyErr("");
    const k=DB.getKey(key.trim());
    if(!k){setKeyErr("Key not found. Please check and try again.");return;}
    if(k.status!=="available"){
      if(k.status==="used_upgrade"||k.status==="used_renew"){setKeyErr("This key has already been used and cannot be used for a new upgrade.");}
      else if(k.cooldownUntil&&new Date(k.cooldownUntil)>new Date()){
        setKeyErr(`Key is on cooldown for ${cooldownLeft(k.cooldownUntil)} more.`);
      } else {setKeyErr("This key is not available for upgrade.");}
      return;
    }
    setStep(1);
  };

  const handleSubmit=()=>{
    setLoading(true);
    setTimeout(()=>{
      const req=DB.createUpgradeRequest({key:key.trim(),email,country,step:"submitted"});
      // mark key as pending
      const k=DB.getKey(key.trim());
      if(k)DB.updateKey(k._id,{status:"processing"});
      setReqId(req._id);setLoading(false);setSubmitted(true);
    },1400);
  };

  const reset=()=>{setStep(0);setKey("");setEmail("");setPass("");setCountry("");setSubmitted(false);setReqId(null);setKeyErr("");};

  if(submitted)return <ProcessingScreen type="upgrade" keyStr={key} onViewStatus={()=>onViewStatus(key)} onBack={reset}/>;

  const labels=["License Key","Account","Country"];
  return(
    <div style={{maxWidth:540,margin:"0 auto",padding:"32px 20px"}}>
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

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginTop:14}}>
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
const STATIC_ADMIN_USERNAME="spotify_user_4821";

function RenewPage({onViewStatus,prefillKey=""}){
  const [step,setStep]=useState(0);
  const [key,setKey]=useState(prefillKey);
  const [oldEmail,setOldEmail]=useState("");
  const [oldPass,setOldPass]=useState("");
  const [showModal,setShowModal]=useState(false);
  const [newEmail,setNewEmail]=useState("");
  const [newPass,setNewPass]=useState("");
  const [files,setFiles]=useState([]);
  const [country,setCountry]=useState("");
  const [loading,setLoading]=useState(false);
  const [submitted,setSubmitted]=useState(false);
  const [keyErr,setKeyErr]=useState("");

  const validateKey=()=>{
    setKeyErr("");
    const k=DB.getKey(key.trim());
    if(!k){setKeyErr("Key not found.");return;}
    if(k.status==="available"){setKeyErr("This key hasn't been used for an upgrade yet.");return;}
    if(k.status!=="used_upgrade"){setKeyErr("This key cannot be renewed (not an upgrade key or already renewed).");return;}
    if(k.cooldownUntil&&new Date(k.cooldownUntil)>new Date()){
      setKeyErr(`Key is on cooldown for ${cooldownLeft(k.cooldownUntil)} more.`);return;
    }
    setStep(1);
  };

  const handleOldNext=()=>setShowModal(true);
  const handleConfirm=()=>{setShowModal(false);setStep(3);};

  const handleSubmit=()=>{
    setLoading(true);
    setTimeout(()=>{
      DB.createRenewRequest({key:key.trim(),oldEmail,newEmail,country,files:files.map(f=>f.name)});
      const k=DB.getKey(key.trim());
      if(k)DB.updateKey(k._id,{status:"processing"});
      setLoading(false);setSubmitted(true);
    },1400);
  };

  const reset=()=>{setStep(0);setKey(prefillKey||"");setOldEmail("");setOldPass("");setNewEmail("");setNewPass("");setFiles([]);setCountry("");setSubmitted(false);setKeyErr("");};

  if(submitted)return <ProcessingScreen type="renew" keyStr={key} onViewStatus={()=>onViewStatus(key)} onBack={reset}/>;

  const labels=["Key","Old Account","Verify","New Account","Proof","Country"];

  return(
    <div style={{maxWidth:540,margin:"0 auto",padding:"32px 20px"}}>
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
              <p style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:C.text}}>@{STATIC_ADMIN_USERNAME}</p>
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
                <p style={{margin:0,fontSize:12,color:C.greenText}}>@{STATIC_ADMIN_USERNAME}</p>
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
function AdminPanel(){
  const [tab,setTab]=useState("keys");
  return(
    <div style={{minHeight:"100vh",background:"#0F1117",fontFamily:"Inter,-apple-system,sans-serif"}}>
      <style>{`@keyframes spin{to{transform:rotate(360deg);}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}*{box-sizing:border-box;}input::placeholder{color:#6B7280;}`}</style>
      <div style={{display:"flex",minHeight:"100vh"}}>
        {/* Sidebar */}
        <div style={{width:220,background:"#161B27",borderRight:"1px solid #1E2536",
          display:"flex",flexDirection:"column",padding:"20px 0",flexShrink:0}}>
          <div style={{padding:"0 20px 20px",borderBottom:"1px solid #1E2536",marginBottom:8}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:32,height:32,borderRadius:8,
                background:"linear-gradient(135deg,#5B21B6,#7C3AED)",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{color:"#fff",fontWeight:900,fontSize:14}}>A</span>
              </div>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:800,color:"#F9FAFB"}}>Admin Panel</p>
                <p style={{margin:0,fontSize:10,color:"#6B7280"}}>spotigrader_main</p>
              </div>
            </div>
          </div>
          {[
            {id:"keys",label:"Key Management",icon:"🔑"},
            {id:"upgrades",label:"Upgrade Requests",icon:"⚡"},
            {id:"renewals",label:"Renewal Requests",icon:"🔄"},
          ].map(({id,label,icon})=>(
            <button key={id} onClick={()=>setTab(id)}
              style={{width:"100%",padding:"10px 20px",textAlign:"left",cursor:"pointer",
                background:tab===id?"rgba(91,33,182,0.25)":"transparent",
                color:tab===id?"#A78BFA":"#9CA3AF",
                border:"none",borderLeft:tab===id?"3px solid #7C3AED":"3px solid transparent",
                fontSize:13,fontWeight:tab===id?700:500,
                display:"flex",alignItems:"center",gap:10,transition:"all 0.15s"}}>
              <span>{icon}</span>{label}
            </button>
          ))}
        </div>
        {/* Content */}
        <div style={{flex:1,overflowY:"auto",padding:"28px 32px"}}>
          {tab==="keys"&&<AdminKeys/>}
          {tab==="upgrades"&&<AdminUpgrades/>}
          {tab==="renewals"&&<AdminRenewals/>}
        </div>
      </div>
    </div>
  );
}

// ─── Admin: Key Management ────────────────────────────────────────────────────
function AdminKeys(){
  const [keys,setKeys]=useState(()=>DB.getKeys());
  const [selected,setSelected]=useState([]);
  const [genCount,setGenCount]=useState("10");
  const [genLoading,setGenLoading]=useState(false);
  const [copied,setCopied]=useState(null);

  const refresh=()=>setKeys(DB.getKeys());

  const generate=()=>{
    const n=parseInt(genCount)||1;
    if(n<1||n>500)return;
    setGenLoading(true);
    setTimeout(()=>{DB.generateKeys(n);refresh();setGenLoading(false);},600);
  };

  const deleteSelected=()=>{
    if(selected.length===0)return;
    DB.deleteKeys(selected);refresh();setSelected([]);
  };
  const deleteAll=()=>{
    if(!window.confirm("Delete ALL keys? This cannot be undone."))return;
    DB.deleteKeys(keys.map(k=>k._id));refresh();setSelected([]);
  };

  const toggle=(id)=>setSelected(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id]);
  const toggleAll=()=>setSelected(selected.length===keys.length?[]:keys.map(k=>k._id));

  const copyKey=(k)=>{navigator.clipboard?.writeText(k.key);setCopied(k._id);setTimeout(()=>setCopied(null),2000);};

  const statusColor={available:"#059669",processing:"#1D4ED8",used_upgrade:"#6D28D9",
    used_renew:"#7C3AED",cooldown:"#D97706",expired:"#DC2626"};

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
          return(
            <div key={k._id} style={{display:"grid",gridTemplateColumns:"36px 1fr 110px 120px 110px 80px",
              padding:"11px 16px",borderBottom:"1px solid #1E2536",gap:10,alignItems:"center",
              background:isSel?"rgba(91,33,182,0.12)":"transparent",
              transition:"background 0.15s"}}>
              <input type="checkbox" checked={isSel} onChange={()=>toggle(k._id)}
                style={{accentColor:"#7C3AED",width:14,height:14}}/>
              <div>
                <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:"#E5E7EB",letterSpacing:"0.05em"}}>{k.key}</span>
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
              <button onClick={()=>copyKey(k)}
                style={{padding:"4px 10px",borderRadius:6,
                  background:copied===k._id?"#065F46":"#1F2937",
                  color:copied===k._id?"#6EE7B7":"#9CA3AF",
                  fontSize:11,fontWeight:600,border:"1px solid #374151",cursor:"pointer"}}>
                {copied===k._id?"✓":"Copy"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Admin: Upgrade Requests ──────────────────────────────────────────────────
function AdminUpgrades(){
  const [requests,setRequests]=useState(()=>DB.getUpgradeRequests());
  const [selected,setSelected]=useState(null);

  const refresh=()=>setRequests(DB.getUpgradeRequests());

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:"#F9FAFB"}}>Upgrade Requests</h2>
        <p style={{margin:0,fontSize:13,color:"#6B7280"}}>{requests.length} total requests</p>
      </div>

      {selected?(
        <AdminUpgradeDetail req={selected} onBack={()=>{setSelected(null);refresh();}} onRefresh={refresh}/>
      ):(
        requests.length===0?(
          <div style={{padding:"60px 0",textAlign:"center",color:"#6B7280",fontSize:14}}>
            No upgrade requests yet.
          </div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {requests.map(r=>(
              <div key={r._id} onClick={()=>setSelected(r)}
                style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,
                  padding:"16px 20px",cursor:"pointer",transition:"border-color 0.15s",
                  display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"center"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#5B21B6"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#1E2536"}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <span style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:"#E5E7EB"}}>{r.key}</span>
                    <Badge status={r.status}/>
                  </div>
                  <p style={{margin:0,fontSize:12,color:"#6B7280"}}>
                    {r.email} · {fmtDate(r.createdAt)}
                    {r.confirmedUsername&&<> · @{r.confirmedUsername}</>}
                  </p>
                </div>
                <span style={{color:"#6B7280",fontSize:18}}>›</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function AdminUpgradeDetail({req,onBack,onRefresh}){
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

  const confirmUsername=()=>{
    if(!username.trim())return;
    DB.updateUpgradeRequest(r._id,{confirmedUsername:username.trim()});
    setUsernameConfirmed(true);
    setR({...r,confirmedUsername:username.trim()});
  };

  const handleApprove=()=>{
    if(!upgradeType||!plan||!country)return;
    setLoading(true);
    setTimeout(()=>{
      const cooldown=new Date(Date.now()+15*24*60*60*1000).toISOString();
      const k=DB.getKey(r.key);
      if(k){
        DB.updateKey(k._id,{
          status:"used_upgrade",usedFor:"upgrade",
          usedByEmail:r.email,usedByUsername:username.trim(),
          country,plan,address:address||null,
          upgradeType,usedDate:new Date().toISOString(),
          cooldownUntil:cooldown,
        });
      }
      DB.updateUpgradeRequest(r._id,{
        status:"approved",confirmedUsername:username.trim(),
        upgradeType,plan,duration,address,countryUpgraded:country,
      });
      setDone(true);setLoading(false);onRefresh();
    },1200);
  };

  const handleDecline=()=>{
    DB.updateUpgradeRequest(r._id,{status:"declined"});
    const k=DB.getKey(r.key);
    if(k)DB.updateKey(k._id,{status:"available"});
    onBack();onRefresh();
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

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        {/* Request Info */}
        <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,padding:20}}>
          <p style={{margin:"0 0 16px",fontSize:13,fontWeight:800,color:"#E5E7EB",textTransform:"uppercase",
            letterSpacing:"0.08em"}}>Request Info</p>
          {[["Key",r.key],["Email",r.email],["Country",r.country||"—"],["Status",r.status],["Submitted",fmtDate(r.createdAt)]].map(([lbl,val])=>(
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
function AdminRenewals(){
  const [requests,setRequests]=useState(()=>DB.getRenewRequests());
  const [selected,setSelected]=useState(null);
  const refresh=()=>setRequests(DB.getRenewRequests());

  return(
    <div>
      <div style={{marginBottom:24}}>
        <h2 style={{margin:"0 0 4px",fontSize:22,fontWeight:900,color:"#F9FAFB"}}>Renewal Requests</h2>
        <p style={{margin:0,fontSize:13,color:"#6B7280"}}>{requests.length} total requests</p>
      </div>
      {selected?(
        <AdminRenewDetail req={selected} onBack={()=>{setSelected(null);refresh();}} onRefresh={refresh}/>
      ):(
        requests.length===0?(
          <div style={{padding:"60px 0",textAlign:"center",color:"#6B7280",fontSize:14}}>No renewal requests yet.</div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {requests.map(r=>(
              <div key={r._id} onClick={()=>setSelected(r)}
                style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,
                  padding:"16px 20px",cursor:"pointer",transition:"border-color 0.15s",
                  display:"grid",gridTemplateColumns:"1fr auto",gap:12,alignItems:"center"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor="#059669"}
                onMouseLeave={e=>e.currentTarget.style.borderColor="#1E2536"}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
                    <span style={{fontFamily:"monospace",fontSize:13,fontWeight:700,color:"#E5E7EB"}}>{r.key}</span>
                    <Badge status={r.status}/>
                    {r.proofStatus&&<Badge status={r.proofStatus==="confirmed"?"approved":"declined"}/>}
                  </div>
                  <p style={{margin:0,fontSize:12,color:"#6B7280"}}>
                    {r.oldEmail} → {r.newEmail} · {fmtDate(r.createdAt)}
                  </p>
                </div>
                <span style={{color:"#6B7280",fontSize:18}}>›</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function AdminRenewDetail({req,onBack,onRefresh}){
  const [r,setR]=useState(req);
  const [enteredUsername,setEnteredUsername]=useState("");
  const [usernameError,setUsernameError]=useState("");
  const [usernameMatch,setUsernameMatch]=useState(false);
  const [proofStatus,setProofStatus]=useState(req.proofStatus||null);
  const [loading,setLoading]=useState(false);
  const [done,setDone]=useState(req.status==="approved");

  // Fetch original key's username for comparison
  const originalKey=DB.getKey(r.key);
  const originalUsername=originalKey?.usedByUsername||null;

  const checkUsername=()=>{
    setUsernameError("");
    if(enteredUsername.trim()!==originalUsername){
      setUsernameError(`Username doesn't match! Expected: @${originalUsername}. Please decline this request.`);
      return;
    }
    setUsernameMatch(true);
    DB.updateRenewRequest(r._id,{confirmedUsername:enteredUsername.trim()});
    setR({...r,confirmedUsername:enteredUsername.trim()});
  };

  const setProof=(status)=>{
    setProofStatus(status);
    DB.updateRenewRequest(r._id,{proofStatus:status});
    setR({...r,proofStatus:status});
  };

  const handleApprove=()=>{
    if(!usernameMatch||proofStatus!=="confirmed")return;
    setLoading(true);
    setTimeout(()=>{
      const cooldown=new Date(Date.now()+15*24*60*60*1000).toISOString();
      const k=DB.getKey(r.key);
      if(k){
        DB.updateKey(k._id,{
          status:"used_renew",usedFor:"renew",
          usedByEmail:r.newEmail,
          usedDate:new Date().toISOString(),
          cooldownUntil:cooldown,
          country:r.country,
        });
      }
      DB.updateRenewRequest(r._id,{status:"approved"});
      setDone(true);setLoading(false);onRefresh();
    },1200);
  };

  const handleDecline=()=>{
    DB.updateRenewRequest(r._id,{status:"declined"});
    const k=DB.getKey(r.key);
    if(k)DB.updateKey(k._id,{status:"used_upgrade"});
    onBack();onRefresh();
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

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20}}>
        {/* Request Info */}
        <div style={{background:"#161B27",border:"1px solid #1E2536",borderRadius:14,padding:20}}>
          <p style={{margin:"0 0 16px",fontSize:13,fontWeight:800,color:"#E5E7EB",textTransform:"uppercase",letterSpacing:"0.08em"}}>Request Info</p>
          {[
            ["Key",r.key],["Old Email",r.oldEmail],["New Email",r.newEmail],
            ["Country",r.country||"—"],["Status",r.status],["Submitted",fmtDate(r.createdAt)],
            ["Proof Files",(r.files||[]).join(", ")||"—"],
          ].map(([lbl,val])=>(
            <div key={lbl} style={{display:"flex",justifyContent:"space-between",padding:"8px 0",
              borderBottom:"1px solid #1E2536",gap:10,flexWrap:"wrap"}}>
              <span style={{fontSize:12,color:"#6B7280",fontWeight:600,flexShrink:0}}>{lbl}</span>
              <span style={{fontSize:12,color:"#E5E7EB",fontWeight:600,
                fontFamily:lbl==="Key"?"monospace":"inherit",wordBreak:"break-all",textAlign:"right"}}>{val}</span>
            </div>
          ))}
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
                <p style={{margin:"0 0 10px",fontSize:12,color:"#6B7280"}}>
                  Files: <span style={{color:"#E5E7EB"}}>{(r.files||[]).join(", ")||"none attached"}</span>
                </p>
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
//  ROOT APP
// ════════════════════════════════════════════════════════════════════════════
export default function App(){
  const [page,setPage]=useState("upgrade");
  const [isAdmin,setIsAdmin]=useState(false);
  const [adminPass,setAdminPass]=useState("");
  const [adminErr,setAdminErr]=useState("");
  const [keyInfoPrefill,setKeyInfoPrefill]=useState("");
  const [renewPrefill,setRenewPrefill]=useState("");
  const ADMIN_PASSWORD="admin123";

  const goToKeyInfo=k=>{setKeyInfoPrefill(k);setPage("keyinfo");};
  const goToRenew=k=>{setRenewPrefill(k);setPage("renew");};
  const navTo=id=>{if(id!=="keyinfo")setKeyInfoPrefill("");if(id!=="renew")setRenewPrefill("");setPage(id);};

  if(isAdmin)return <AdminPanel/>;

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
      `}</style>

      {/* Nav */}
      <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(242,244,248,0.92)",
        backdropFilter:"blur(14px)",borderBottom:`1px solid ${C.border}`}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"0 20px",height:60,
          display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#5B21B6,#7C3AED)",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{color:"#fff",fontWeight:900,fontSize:14}}>U</span>
            </div>
            <span style={{fontWeight:900,fontSize:15,color:C.text}}>upgrader</span>
            <span style={{fontWeight:400,color:C.textMuted,fontSize:15}}>.cc</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:3,background:C.surface,
            border:`1px solid ${C.border}`,borderRadius:12,padding:3}}>
            {NAV_ITEMS.map(({id,label,emoji})=>(
              <button key={id} onClick={()=>navTo(id)} style={{
                display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:9,
                fontSize:12,fontWeight:700,cursor:"pointer",
                background:page===id?C.violet:"transparent",
                color:page===id?"#fff":C.textSub,border:"none",transition:"all 0.15s"}}>
                <span style={{fontSize:13}}>{emoji}</span>{label}
              </button>
            ))}
            <div style={{width:1,height:20,background:C.border,margin:"0 4px"}}/>
            <button onClick={()=>{
              const p=prompt("Admin password:");
              if(p===ADMIN_PASSWORD)setIsAdmin(true);
              else if(p!==null)alert("Wrong password");
            }} style={{padding:"6px 12px",borderRadius:9,fontSize:12,fontWeight:700,cursor:"pointer",
              background:"transparent",color:C.textMuted,border:"none"}}>
              🔐 Admin
            </button>
          </div>
        </div>
      </nav>

      <main>
        {page==="upgrade"&&<UpgradePage onViewStatus={goToKeyInfo}/>}
        {page==="renew"&&<RenewPage onViewStatus={goToKeyInfo} prefillKey={renewPrefill} key={renewPrefill}/>}
        {page==="keyinfo"&&<KeyInfoPage prefillKey={keyInfoPrefill} key={keyInfoPrefill} onRenew={goToRenew}/>}
      </main>

      <footer style={{borderTop:`1px solid ${C.border}`,marginTop:20}}>
        <div style={{maxWidth:900,margin:"0 auto",padding:"20px",
          display:"flex",flexWrap:"wrap",alignItems:"center",justifyContent:"space-between",gap:12}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:24,height:24,borderRadius:7,background:"linear-gradient(135deg,#5B21B6,#7C3AED)",
              display:"flex",alignItems:"center",justifyContent:"center"}}>
              <span style={{color:"#fff",fontWeight:900,fontSize:11}}>U</span>
            </div>
            <span style={{fontSize:12,color:C.textSub,fontWeight:500}}>upgrader.cc — Automated Premium Service</span>
          </div>
          <div style={{display:"flex",gap:14,fontSize:11,color:C.textMuted,fontWeight:600}}>
            <span>No logs kept</span><span>·</span><span>Encrypted</span><span>·</span><span>Lifetime guarantee</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
