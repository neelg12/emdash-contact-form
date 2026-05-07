// Self-contained vanilla JS that hydrates `<div data-form-slug="contact">` shortcodes.
// Inlined into every public page via the page:fragments hook in sandbox-entry.ts.
// The plugin DOES NOT expose a public route for this — EmDash's plugin route
// wrapper coerces all responses to JSON so a separate JS file can't be served.

const LOADER_CSS = `
.cf-wrapper{max-width:560px;font-family:system-ui,-apple-system,sans-serif;color:inherit}
.cf-desc{color:#666;margin:0 0 1rem}
.cf-form{display:flex;flex-direction:column;gap:1rem}
.cf-field{display:flex;flex-direction:column;gap:.25rem}
.cf-field--check{flex-direction:row;align-items:center;gap:.5rem}
.cf-label{font-weight:500;font-size:.9rem}
.cf-required{color:#c00}
.cf-help{font-size:.8rem;color:#666}
.cf-input{padding:.5rem .75rem;border:1px solid #ccc;border-radius:6px;font-size:1rem;width:100%;box-sizing:border-box;font-family:inherit;color:inherit;background:transparent}
.cf-input:focus{outline:2px solid #0070f3;border-color:#0070f3}
textarea.cf-input{min-height:120px;resize:vertical}
.cf-btn{padding:.6rem 1.4rem;background:#0070f3;color:#fff;border:none;border-radius:6px;font-size:1rem;cursor:pointer;align-self:flex-start;font-family:inherit}
.cf-btn:disabled{opacity:.6;cursor:not-allowed}
.cf-error-summary{padding:.75rem;background:#fff0f0;border:1px solid #f99;border-radius:6px;font-size:.9rem;color:#c00;white-space:pre-wrap}
.cf-success{padding:1rem;background:#f0fff4;border:1px solid #6dcc7e;border-radius:6px;color:#1a6b2e}
.cf-privacy{font-size:.8rem;color:#777;margin-top:.25rem}
.cf-error{padding:.75rem;color:#c00}
`.trim();

// IIFE — keep all state private. Idempotent (won't double-init).
// Exported so sandbox-entry.ts can inline it via page:fragments —
// EmDash's plugin route wrapper coerces all responses to JSON, so we can't
// reliably serve this as an external script from a plugin route.
export const LOADER_JS = `(function(){
if(window.__emdashContactFormInit)return;window.__emdashContactFormInit=true;
var SUBMIT_URL="/_emdash/api/plugins/contact-form/submit";
var CONFIG_URL="/_emdash/api/plugins/contact-form/form-config";
var CSS=${JSON.stringify(LOADER_CSS)};

function unwrapApiPayload(json){
  if(json&&typeof json==="object"&&json.data&&typeof json.data==="object"){
    return json.data;
  }
  return json;
}

function injectStyles(){
  if(document.getElementById("cf-styles"))return;
  var s=document.createElement("style");s.id="cf-styles";s.textContent=CSS;
  document.head.appendChild(s);
}

function escHtml(str){
  var d=document.createElement("div");
  d.textContent=str==null?"":String(str);
  return d.innerHTML;
}

function buildField(f){
  var id="cf-"+f.name+"-"+Math.random().toString(36).slice(2,7);
  var req=f.required?" required":"";
  var help=f.helpText?'<span class="cf-help">'+escHtml(f.helpText)+'</span>':"";
  var label='<label class="cf-label" for="'+id+'">'+escHtml(f.label)+(f.required?' <span class="cf-required">*</span>':'')+'</label>';
  if(f.type==="textarea"){
    return '<div class="cf-field">'+label+help+'<textarea id="'+id+'" name="'+escHtml(f.name)+'" placeholder="'+escHtml(f.placeholder||"")+'" maxlength="'+(f.maxLength||5000)+'" class="cf-input"'+req+'></textarea></div>';
  }
  if(f.type==="select"&&Array.isArray(f.options)){
    var opts='<option value="">Select…</option>';
    f.options.forEach(function(o){opts+='<option value="'+escHtml(o.value)+'">'+escHtml(o.label)+'</option>';});
    return '<div class="cf-field">'+label+help+'<select id="'+id+'" name="'+escHtml(f.name)+'" class="cf-input"'+req+'>'+opts+'</select></div>';
  }
  if(f.type==="checkbox"){
    return '<div class="cf-field cf-field--check"><input type="checkbox" id="'+id+'" name="'+escHtml(f.name)+'" value="true" class="cf-checkbox"'+req+'>'+label+help+'</div>';
  }
  if(f.type==="hidden"){
    return '<input type="hidden" name="'+escHtml(f.name)+'" value="'+escHtml(f.defaultValue||"")+'">';
  }
  // text, email, phone (plus any unknown type fallback)
  var inputType=f.type==="phone"?"tel":(f.type==="email"?"email":"text");
  return '<div class="cf-field">'+label+help+'<input type="'+inputType+'" id="'+id+'" name="'+escHtml(f.name)+'" placeholder="'+escHtml(f.placeholder||"")+'" class="cf-input"'+req+'></div>';
}

function renderForm(container,config){
  var fieldsHtml=(config.fields||[]).map(buildField).join("");
  container.innerHTML=
    '<div class="cf-wrapper">'+
      (config.title?'<h3 style="margin:0 0 .5rem">'+escHtml(config.title)+'</h3>':"")+
      (config.description?'<p class="cf-desc">'+escHtml(config.description)+'</p>':"")+
      '<form class="cf-form" novalidate>'+
        fieldsHtml+
        '<input type="text" name="_hp" tabindex="-1" aria-hidden="true" autocomplete="off" style="position:absolute;left:-9999px;height:0;width:0;overflow:hidden">'+
        '<input type="hidden" name="_submitTime">'+
        '<div class="cf-error-summary" role="alert" style="display:none"></div>'+
        '<button type="submit" class="cf-btn">'+escHtml(config.submitLabel||"Send Message")+'</button>'+
        (config.privacyNote?'<p class="cf-privacy">'+escHtml(config.privacyNote)+'</p>':"")+
      '</form>'+
      '<div class="cf-success" style="display:none" role="status">'+escHtml(config.successMessage||"Thank you!")+'</div>'+
    '</div>';

  var form=container.querySelector(".cf-form");
  var success=container.querySelector(".cf-success");
  var errEl=container.querySelector(".cf-error-summary");
  var btn=container.querySelector(".cf-btn");
  var stEl=container.querySelector('input[name="_submitTime"]');
  if(stEl)stEl.value=String(Date.now());
  var origLabel=btn.textContent;

  form.addEventListener("submit",function(e){
    e.preventDefault();
    errEl.style.display="none";
    btn.disabled=true;btn.textContent="Sending…";
    var data={};
    var fd=new FormData(form);
    fd.forEach(function(v,k){data[k]=v;});
    var honeypot=data._hp||"";
    var submitTime=parseInt(data._submitTime||"0",10);
    delete data._hp;delete data._submitTime;

    var payload={
      formId:config.id,
      pageSlug:window.location.pathname,
      fields:data,
      honeypot:honeypot,
      _submitTime:submitTime,
      meta:{userAgent:navigator.userAgent,referrer:document.referrer}
    };

    fetch(SUBMIT_URL,{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload)
    }).then(function(r){return r.json();}).then(function(json){
      json=unwrapApiPayload(json);
      if(json.ok){
        form.style.display="none";
        success.style.display="block";
      }else if(json.error==="validation_error"&&json.fields){
        errEl.textContent=Object.values(json.fields).join("\\n");
        errEl.style.display="block";
        btn.disabled=false;btn.textContent=origLabel;
      }else if(json.error==="rate_limited"){
        errEl.textContent=json.message||"Too many submissions. Please wait a moment.";
        errEl.style.display="block";
        btn.disabled=false;btn.textContent=origLabel;
      }else{
        errEl.textContent="Something went wrong. Please try again.";
        errEl.style.display="block";
        btn.disabled=false;btn.textContent=origLabel;
      }
    }).catch(function(){
      errEl.textContent="Network error. Please try again.";
      errEl.style.display="block";
      btn.disabled=false;btn.textContent=origLabel;
    });
  });
}

function hydrate(el){
  var formId=el.getAttribute("data-contact-form");
  var slug=el.getAttribute("data-form-slug");
  if(!formId&&!slug)return;
  if(el.dataset.cfReady)return;
  el.dataset.cfReady="true";
  el.innerHTML='<p style="color:#999">Loading form…</p>';

  var qs=formId?"id="+encodeURIComponent(formId):"slug="+encodeURIComponent(slug);
  fetch(CONFIG_URL+"?"+qs).then(function(r){
    if(!r.ok)throw new Error("not_found");
    return r.json();
  }).then(function(config){
    config=unwrapApiPayload(config);
    renderForm(el,config);
  }).catch(function(){
    el.innerHTML='<p class="cf-error">Contact form unavailable.</p>';
  });
}

function init(){
  injectStyles();
  var nodes=document.querySelectorAll("[data-contact-form],[data-form-slug]");
  for(var i=0;i<nodes.length;i++)hydrate(nodes[i]);

  // Watch for forms inserted dynamically (e.g. by SPA navigation).
  if(typeof MutationObserver!=="undefined"){
    var mo=new MutationObserver(function(muts){
      muts.forEach(function(m){
        m.addedNodes.forEach(function(n){
          if(n.nodeType!==1)return;
          if(n.matches&&n.matches("[data-contact-form],[data-form-slug]"))hydrate(n);
          if(n.querySelectorAll){
            n.querySelectorAll("[data-contact-form],[data-form-slug]").forEach(hydrate);
          }
        });
      });
    });
    mo.observe(document.body,{childList:true,subtree:true});
  }
}

if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded",init);
}else{
  init();
}
})();`;
