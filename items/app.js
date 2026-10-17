const asset = (name) => `borders/${name}`;
const seedCards = [
  {name:'Goblet of Crimson Delight',category:'Wondrous Item',rarity:'Uncommon',attune:'Yes',type:'Wondrous Item',flavour:'A goblet of ruby glass, forever filled with deep red wine.',effect:'Consume (1/day): Drink to regain 1d6 hit points.\n\nUse (1/day): As an action, raise a toast. One creature within 15 ft. must succeed on a DC 13 Wis save or be charmed until the end of its next turn.',damage:'',art:''},
  {name:'Fragment of the Platinum Altar',category:'Wondrous Item',rarity:'Rare',attune:'Yes',type:'Wondrous Item',flavour:'A cracked piece of silver dragon altar, warm to the touch.',effect:'Use (1/long rest): Add 1d6 radiant damage to one melee weapon attack.\n\nPassive: Advantage on saving throws against being frightened.',damage:'',art:''},
  {name:'Displacer Beast Hide',category:'Wondrous Item',rarity:'Rare',attune:'No',type:'Wondrous Item',flavour:'A hide from a slain displacer beast that could be used for crafting.',effect:'A skilled leatherworker can turn this hide into a cloak that shimmers at the edge of sight.',damage:'',art:''},
  {name:'Crimson Rapier',category:'Rapier',rarity:'Very Rare',attune:'Yes',type:'Weapon',flavour:'A slender blood-red blade that hums when drawn.',effect:'+1 bonus to attack and damage rolls.\n\nOn a critical hit, it deals an extra 1d6 necrotic damage.',damage:'1d8 piercing',art:''},
  {name:'Rope of Knots',category:'Wondrous Item',rarity:'Common',attune:'No',type:'Wondrous Item',flavour:'A coiled rope that twitches faintly in your hands.',effect:'Use: 15 metres of rope. Can tie or untie itself on command.',damage:'',art:''},
  {name:'Battered Bulwark',category:'Plate Armor',rarity:'Uncommon',attune:'Yes',type:'Armor',flavour:'A battered and scarred suit of plate armor, marked by dents from countless battles.',effect:'Armor Class (AC): 17\nStrength Requirement 15\nStealth: Disadvantage\n\nGuardian\'s Stance: Once per short rest, when a creature within 5 feet is targeted by an attack, you can use your reaction to grant that creature +1 AC against that attack.',damage:'',art:''},
  {name:'Silent Whisper',category:'Hand Crossbow',rarity:'Rare',attune:'Yes',type:'Weapon',flavour:'A sleek hand crossbow of blackened steel, its limbs engraved with faint runes.',effect:'Fires without a sound. When fired, its string releases no twang, and the bolt vanishes in a curl of smoke upon striking its mark.\n\nHidden Fire: You have advantage on Stealth checks to remain hidden after attacking with it.',damage:'1d6 piercing',art:''},
  {name:'Bloodmoon Gem',category:'Wondrous Item',rarity:'Very Rare',attune:'Yes',type:'Wondrous Item',flavour:'A dark garnet that seems to hold a tiny eclipsed moon.',effect:'Passive: Grants darkvision 60 ft. (or +30 ft. if already had darkvision).\n\nCorruption: At each dawn, the bearer must succeed on a DC 13 Wisdom saving throw.',damage:'',art:''}
];
// Older saves/library items may still have separate flavour+effect fields; fold flavour into the single effect field they now share.
function migrateCard(card){if(card.flavour!==undefined){card.effect=[card.flavour,card.effect].filter(Boolean).join('\n\n');delete card.flavour;}return card;}
let cards=(JSON.parse(localStorage.getItem('relic-press-cards')||'null')||seedCards).map(migrateCard), selected=0, side='front', zoom=.72;
let library=JSON.parse(localStorage.getItem('relic-press-library')||'null')||[];
if(['llama3.2','gemmae4b'].includes(localStorage.getItem('ollamaModel')))localStorage.removeItem('ollamaModel');
const $=id=>document.getElementById(id), rarityBorder=rarity=>asset(`CardBorder${rarity.replace(' ','')}.png`), backBorder=asset('CardBorderBack.png');
const RARITIES=['Common','Uncommon','Rare','Very Rare','Legendary'];
const RARITY_ABBR={Common:'C',Uncommon:'U',Rare:'R','Very Rare':'VR',Legendary:'L'};
// Shared JSON-field guidance for every Ollama item prompt, so category always names a specific variant instead of a generic bucket.
const FIELD_SPEC='name, category (a specific noun naming exactly what kind of item this is - e.g. "Shortsword", "Greataxe", "Hand Crossbow", "Leather Armor", "Chain Mail", "Shield", "Potion", "Elixir", "Poison", "Scroll", "Ring", "Wand", "Rod", "Staff", "Cloak", "Amulet", "Instrument", "Bag" - be specific, never just "Weapon", "Armor" or "Item"), rarity (Common/Uncommon/Rare/Very Rare/Legendary), attune ("Yes"/"No"), type ("Weapon" only if it deals damage in combat, "Armor" only if it is worn armor or a shield, otherwise "Wondrous Item" - this covers potions, scrolls, rings, wands, rods, staves and every other kind of magic item), flavour (one evocative sentence), effect (concise rules text, AT MOST 2 short sentences / 40 words total - this must fit on a small printed card, do not pad), damage (dice string like "1d8 slashing" if type is "Weapon", else empty string)';
// Fixed art-generation model + prompt style: JuggernautXL checkpoint, weighted emphasis prompt, background removed via the rembg custom node before saving.
const ART_CHECKPOINT='juggernautXL_ragnarok.safetensors';
const ART_NEGATIVE_PROMPT='((cut off:1.5)), ((out of frame:1.5)), cropped, body part, hand, close up, medium shot, zoom, blur, messy, background, environment, watermark';
// JuggernautXL tends to collapse similar-sounding categories (rapier/shortsword/greatsword, etc.) into one generic "ornate sword" shape;
// spelling out the actual silhouette/size per category and weighting it heavily keeps each item visually distinct.
const CATEGORY_SHAPE_HINTS=[
  [/great\s*sword|claymore|zweih[ae]nder/i,'a massive two-handed sword with a very long, broad blade and an extended two-handed grip'],
  [/long\s*sword|broadsword|arming sword/i,'a medium-length straight double-edged blade with a simple cross-guard'],
  [/short\s*sword|gladius/i,'a short, compact single-handed blade no longer than the wielder\'s forearm'],
  [/rapier|smallsword|foil/i,'a very slender, needle-thin thrusting blade with an ornate swept or basket hilt'],
  [/dagger|knife|dirk|kris|stiletto/i,'a tiny single-handed blade shorter than a hand'],
  [/scimitar|falchion|sabre|saber/i,'a curved, single-edged blade'],
  [/katana|wakizashi|tachi/i,'a gently curved single-edged long blade with a cord-wrapped handle'],
  [/great\s*axe/i,'a massive two-handed axe with a wide double-bladed head on a long haft'],
  [/hand\s*axe|hatchet|\baxe\b/i,'a compact single-handed axe with a short haft'],
  [/war\s*hammer|maul/i,'a heavy two-handed hammer with a thick haft and a large blunt head'],
  [/mace|flail|morning\s*star/i,'a one-handed blunt weapon with a heavy spiked or studded head'],
  [/glaive|halberd|pike|pole\s*arm|poleaxe/i,'a long polearm with an elaborate blade mounted on a very long shaft'],
  [/spear|lance|javelin|trident/i,'a long, slender shaft tipped with a narrow pointed head'],
  [/hand\s*crossbow/i,'a small, compact one-handed crossbow'],
  [/crossbow/i,'a two-handed crossbow with a stock, prod and trigger'],
  [/long\s*bow/i,'a tall, strongly curved longbow'],
  [/short\s*bow|recurve/i,'a small, compact recurve bow'],
  [/wand/i,'a slender handheld wand no longer than a forearm'],
  [/\brod\b/i,'a short, rigid rod'],
  [/\bstaff\b/i,'a tall wooden or metal staff as long as a person is tall'],
  [/shield/i,'a round or kite-shaped shield with a hand grip on the back'],
  [/whip/i,'a long, thin coiled leather whip'],
];
// A lightweight pool of camera/lighting/finish phrases shuffled per render so repeat generations and similar items don't all come out looking alike.
const ART_LIGHTING_VARIANTS=['soft rim lighting','dramatic raking side lighting','warm golden-hour lighting','cool blue-toned studio lighting','gentle top-down softbox lighting','bright even lighting'];
const ART_MATERIAL_VARIANTS=['pristine and freshly forged','weathered and battle-worn with small nicks and scratches','etched with fine ornamental engravings','wrapped in aged leather and brass fittings','polished to a mirror sheen','dusted with a faint magical glow along its edges'];
const ART_ANGLE_VARIANTS=['three-quarter view','straight-on front view','slightly elevated three-quarter view','low-angle heroic view'];
const pick=list=>list[Math.floor(Math.random()*list.length)];
// Looks up the most specific matching shape hint for a free-text category string, falling back to the category text itself.
function categoryShapeHint(category){const match=CATEGORY_SHAPE_HINTS.find(([pattern])=>pattern.test(category));return match?match[1]:`a ${category.toLowerCase()}`;}
// Escapes text for safe splicing into a JSON string literal (quotes/backslashes from user-edited card text would otherwise break the workflow JSON).
function jsonStringContent(text){return JSON.stringify(text).slice(1,-1);}
const DEFAULT_COMFY_WORKFLOW=`{"4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":"${ART_CHECKPOINT}"}},"5":{"class_type":"EmptyLatentImage","inputs":{"width":832,"height":1248,"batch_size":1}},"6":{"class_type":"CLIPTextEncode","inputs":{"text":"{{prompt}}","clip":["4",1]}},"7":{"class_type":"CLIPTextEncode","inputs":{"text":"{{negative}}","clip":["4",1]}},"3":{"class_type":"KSampler","inputs":{"seed":{{seed}},"steps":25,"cfg":6.5,"sampler_name":"dpmpp_2m","scheduler":"karras","denoise":1,"model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},"8":{"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},"10":{"class_type":"SwarmRemBg","inputs":{"images":["8",0]}},"9":{"class_type":"SaveImage","inputs":{"filename_prefix":"RelicPress","images":["10",0]}}}`;
// Recognise leading quantity words/digits ("8 potions", "a sheet of 8 potions", "3x rapiers") so a batch request fills every matching slot.
const QUANTITY_WORDS={a:1,an:1,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:8,ten:8,pair:2,couple:2,few:3,several:4,dozen:8};
function parseSeedSegment(raw){
  // Strip leading command phrasing ("make", "generate 8 rapiers", "give me a set of...") so the quantity words below still parse correctly.
  let text=raw.replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:make|generate|create|design|craft|give\s+me|i\s+want|i'?d\s+like)\s+/i,'').trim();
  text=text.replace(/^(?:a|an|the)\s+(?:sheet|set|batch|bunch|collection|group)\s+of\s+/i,'').trim();
  let count=null,match;
  if((match=text.match(/^(\d+)\s*x\s+(.+)$/i))||(match=text.match(/^x\s*(\d+)\s+(.+)$/i))){count=parseInt(match[1],10);text=match[2].trim();}
  else if((match=text.match(/^(.+?)\s*x\s*(\d+)$/i))){text=match[1].trim();count=parseInt(match[2],10);}
  else if((match=text.match(/^(\d+|[a-z]+)\s+(.+)$/i))){const word=match[1].toLowerCase(),n=/^\d+$/.test(word)?parseInt(word,10):QUANTITY_WORDS[word];if(n){count=n;text=match[2].trim();}}
  return {description:text,count:count&&count>0?count:1};
}
const escapeHtml=value=>(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
// Only these inline formatting tags survive, with every attribute stripped, so bold/italic/underline round-trip safely without opening up script/style/event-handler injection.
const RICH_TEXT_TAGS=new Set(['B','STRONG','I','EM','U','BR']);
function sanitizeRichText(html){
  const container=document.createElement('div');
  container.innerHTML=html||'';
  const clean=node=>{
    [...node.childNodes].forEach(child=>{
      if(child.nodeType===Node.TEXT_NODE)return;
      if(child.nodeType!==Node.ELEMENT_NODE){node.removeChild(child);return;}
      clean(child);
      if(RICH_TEXT_TAGS.has(child.tagName)){
        [...child.attributes].forEach(attr=>child.removeAttribute(attr.name));
      }else{
        while(child.firstChild)node.insertBefore(child.firstChild,child);
        node.removeChild(child);
      }
    });
  };
  clean(container);
  return container.innerHTML;
}
// Plain-text readout of a rich-text field, for places (sidebar list, toasts, AI prompts) that can't show markup.
function stripTags(html){const container=document.createElement('div');container.innerHTML=html||'';return container.textContent||'';}
function editField(field,value,tag='span'){return `<${tag} class="editable" data-edit="${field}" contenteditable="true" spellcheck="true">${sanitizeRichText(value)}</${tag}>`;}
function raritySelect(card){return `<select class="editable" data-edit="rarity" title="Rarity: ${card.rarity}">${RARITIES.map(r=>`<option value="${r}"${r===card.rarity?' selected':''}>${RARITY_ABBR[r]}</option>`).join('')}</select>`;}
function attuneSelect(card){return `<select class="editable" data-edit="attune" title="Requires attunement">${['Yes','No'].map(v=>`<option value="${v}"${v===card.attune?' selected':''}>${v==='Yes'?'Y':'N'}</option>`).join('')}</select>`;}
function cardMarkup(card,index,backside=false,interactive=true){
  const isSelected=interactive&&index===selected;
  const frontContent=`<h3 class="card-name">${editField('name',card.name,'span')}</h3>`;
  const artButton=isSelected?`<button type="button" class="art-action" data-generate-art="${index}">${card.art?'Regenerate image':'Generate image'}</button>`:'';
  const artMarkup=backside?'':`<div class="card-art ${card.art?'has-art':''}" style="${card.art?`background-image:url('${card.art}')`:''}"><span>${card.art?'':'No artwork yet'}</span>${artButton}</div>`;
  const backContent=`<div class="card-content"><h3 class="card-name">${editField('name',card.name,'span')}</h3><div class="card-meta-row"><div class="meta-box meta-category"><span class="meta-label">Category</span><span class="stat-box">${editField('category',card.category,'span')}</span></div><div class="meta-box meta-rarity"><span class="meta-label">Rarity</span><span class="stat-box">${raritySelect(card)}</span></div><div class="meta-box meta-attune"><span class="meta-label">Attune</span><span class="stat-box">${attuneSelect(card)}</span></div></div><div class="card-body"><p class="card-effect">${editField('effect',card.effect,'span')}</p></div>${card.type==='Weapon'?`<div class="card-damage stat-box"><span class="damage-label">Damage</span>${editField('damage',card.damage,'span')}</div>`:''}</div>`;
  const toolbar=isSelected?`<div class="card-toolbar"><div class="regen-popover"><input type="text" class="regen-input-inline" placeholder="Optional prompt..."><button type="button" data-regen-send>Go</button></div><button type="button" data-refine>Refine</button><button type="button" data-regen-toggle>Regenerate</button></div>`:'';
  return `<article class="card${backside?' back-card':''}${isSelected?' selected':''}" data-index="${index}">${artMarkup}${backside?backContent:`<div class="front-name">${frontContent}</div>`}<div class="card-border" style="background-image:url('${backside?backBorder:rarityBorder(card.rarity)}')"></div>${toolbar}</article>`;
}
function backOrder(){return [3,2,1,0,7,6,5,4];}
// Find the largest font size (down to minCqi) at which linesFn(px) stays within the 2-line budget.
function bestNameSize(nameEl){
  const card=nameEl&&nameEl.closest('.card');
  if(!card)return null;
  const cardWidth=card.offsetWidth;
  if(!cardWidth)return null;
  const toPx=cqi=>cardWidth*cqi/100;
  const minPx=toPx(3.4),maxPx=toPx(8);
  nameEl.style.fontSize='';
  const cs=getComputedStyle(nameEl);
  const ratio=(parseFloat(cs.lineHeight)||parseFloat(cs.fontSize)*1.18)/parseFloat(cs.fontSize);
  const linesAt=px=>{nameEl.style.fontSize=`${px}px`;return Math.round(nameEl.scrollHeight/(px*ratio));};
  let size=maxPx,guard=0;
  while(linesAt(size)>2&&size>minPx&&guard++<120)size=Math.max(minPx,size-0.25);
  return size;
}
// Find the largest font size (down to minCqi) at which the shared body wrapper doesn't overflow.
function bestBodySize(bodyEl){
  const card=bodyEl&&bodyEl.closest('.card');
  if(!card)return null;
  const cardWidth=card.offsetWidth;
  if(!cardWidth)return null;
  const toPx=cqi=>cardWidth*cqi/100;
  const minPx=toPx(3),maxPx=toPx(5);
  const children=[...bodyEl.children];
  const setSize=px=>children.forEach(c=>c.style.fontSize=`${px}px`);
  let size=maxPx,guard=0;
  setSize(size);
  while(bodyEl.scrollHeight>bodyEl.clientHeight+1&&size>minPx&&guard++<120){
    size=Math.max(minPx,size-0.2);
    setSize(size);
  }
  return size;
}
// Fit each card's name and body text to its own content, independently of every other card on the sheet.
function fitAllCards(root=document){
  const cardEls=[...root.querySelectorAll('.card')];
  cardEls.forEach(card=>{
    const nameEl=card.querySelector('.card-name');
    if(nameEl){
      nameEl.style.fontSize='';
      const nameSize=bestNameSize(nameEl);
      if(nameSize!=null)nameEl.style.fontSize=`${nameSize}px`;
    }
    const bodyEl=card.querySelector('.card-body');
    if(bodyEl){
      const bodyChildren=[...bodyEl.children];
      bodyChildren.forEach(c=>c.style.fontSize='');
      const bodySize=bestBodySize(bodyEl);
      if(bodySize!=null)bodyChildren.forEach(c=>c.style.fontSize=`${bodySize}px`);
    }
  });
}
function render(){
  $('cardCount').textContent=`${cards.length} / 8`;
  $('cardList').innerHTML=cards.map((card,index)=>`<div class="card-row-wrap"><button class="card-row ${index===selected?'active':''}" data-select="${index}"><span class="card-thumb"></span><span><strong>${escapeHtml(stripTags(card.name))}</strong><small>${escapeHtml(card.rarity)} · ${escapeHtml(stripTags(card.category))}</small></span></button><button class="icon-button card-save" data-save="${index}" title="Save this item to your library">\u{1F4BE}</button></div>`).join('');
  // On-screen preview always shows items in their natural left-to-right order (same position on front and back); the duplex mirror is applied only at print/export time in buildPrintSheets().
  const order=cards.map((_,i)=>i); $('sheet').innerHTML=order.map(i=>cardMarkup(cards[i],i,side==='back')).join(''); $('previewTitle').textContent=`${side==='front'?'Front side':'Back side'} · 4 × 2`; $('sheet').style.transform=`scale(${zoom})`; $('zoomValue').textContent=`${Math.round(zoom*100)}%`;
  document.querySelectorAll('[data-select]').forEach(button=>button.addEventListener('click',()=>{selected=Number(button.dataset.select);render();}));
  document.querySelectorAll('[data-save]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();saveCardToLibrary(Number(button.dataset.save));}));
  document.querySelectorAll('.card[data-index]').forEach(article=>article.addEventListener('click',event=>{
    if(event.target.closest('button,select,input,[contenteditable]'))return;
    const idx=Number(article.dataset.index);
    if(idx!==selected){selected=idx;render();}
  }));
  document.querySelectorAll('[data-generate-art]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();generateArt(button);}));
  document.querySelectorAll('[data-refine]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();refineWithOllama(button);}));
  document.querySelectorAll('[data-regen-toggle]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();const popover=button.closest('.card-toolbar').querySelector('.regen-popover');popover.classList.toggle('open');if(popover.classList.contains('open'))popover.querySelector('input').focus();}));
  document.querySelectorAll('[data-regen-send]').forEach(button=>button.addEventListener('click',event=>{event.stopPropagation();const popover=button.closest('.regen-popover');regenerateCard(popover.querySelector('input').value.trim(),button);}));
  document.querySelectorAll('.regen-input-inline').forEach(input=>input.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();input.closest('.regen-popover').querySelector('[data-regen-send]').click();}}));
  document.querySelectorAll('[data-edit]').forEach(field=>{const evt=field.tagName==='SELECT'?'change':'input';field.addEventListener(evt,()=>{const card=cards[Number(field.closest('.card').dataset.index)],key=field.dataset.edit,raw=field.tagName==='SELECT'?field.value:sanitizeRichText(field.innerHTML).trim();card[key]=raw;if(key==='attune')card.attune=raw==='Yes'?'Yes':'No';if(key==='rarity')card.rarity=raw;localStorage.setItem('relic-press-cards',JSON.stringify(cards));syncSidebarRow(Number(field.closest('.card').dataset.index));
      if(key==='name'||key==='effect')fitAllCards();
    });});
  fitAllCards();
}
function syncSidebarRow(index){const card=cards[index],row=document.querySelector(`[data-select="${index}"]`);if(row){row.querySelector('strong').textContent=stripTags(card.name);row.querySelector('small').textContent=`${card.rarity} · ${stripTags(card.category)}`;}}
// Persists the library both locally (instant reload) and on the server (survives a server restart, not just a page refresh).
function persistLibrary(){localStorage.setItem('relic-press-library',JSON.stringify(library));fetch('/api/library',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(library)}).catch(()=>{});}
async function loadLibraryFromServer(){try{const response=await fetch('/api/library');if(!response.ok)return;const items=await response.json();if(Array.isArray(items)){library=items;localStorage.setItem('relic-press-library',JSON.stringify(library));renderLibrary();}}catch{}}
function saveCardToLibrary(index){const card=cards[index];library.push({...card,id:`${Date.now()}-${Math.random().toString(36).slice(2,7)}`});persistLibrary();renderLibrary();toast(`Saved "${stripTags(card.name)}" to your library.`);}
function loadLibraryItem(id){const item=library.find(entry=>entry.id===id);if(!item)return;const {id:_ignored,...cardData}=item;cards[selected]=migrateCard(cardData);localStorage.setItem('relic-press-cards',JSON.stringify(cards));render();toast(`Loaded "${stripTags(item.name)}" into the selected slot.`);}
function deleteLibraryItem(id){library=library.filter(entry=>entry.id!==id);persistLibrary();renderLibrary();}
function renderLibrary(){
  $('libraryList').innerHTML=library.length?library.map(item=>`<div class="card-row-wrap"><div class="card-row library-row"><span class="card-thumb" style="${item.art?`background-image:url('${item.art}')`:''}"></span><span><strong>${escapeHtml(stripTags(item.name))}</strong><small>${escapeHtml(item.rarity)} · ${escapeHtml(stripTags(item.category))}</small></span></div><button class="icon-button" data-load="${item.id}" title="Load into the selected slot">\u21E9</button><button class="icon-button" data-delete="${item.id}" title="Remove from library">×</button></div>`).join(''):'<p class="hint">No saved items yet. Use the \u{1F4BE} button on a card to save it here.</p>';
  document.querySelectorAll('[data-load]').forEach(button=>button.addEventListener('click',()=>loadLibraryItem(button.dataset.load)));
  document.querySelectorAll('[data-delete]').forEach(button=>button.addEventListener('click',()=>deleteLibraryItem(button.dataset.delete)));
}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');setTimeout(()=>$('toast').classList.remove('visible'),3200);}
function serviceUrl(key,fallback){return (localStorage.getItem(key)||fallback).replace(/\/$/,'');}
async function readError(response){try{const data=await response.json();return data.error||`HTTP ${response.status}`;}catch{return `HTTP ${response.status}`;}}
// Asks this app's own local server to launch Ollama if it isn't already running, so the user never has to start it by hand.
async function ensureOllamaRunning(){try{const response=await fetch('/api/ensure-ollama',{method:'POST'});if(!response.ok)return false;return (await response.json()).running;}catch{return false;}}
async function fetchOllamaModels(){await ensureOllamaRunning();const response=await fetch(`${serviceUrl('ollamaUrl','http://localhost:11434')}/api/tags`);if(!response.ok)throw new Error(await readError(response));return (await response.json()).models||[];}
async function populateModelSelect(){const select=$('ollamaModel'),current=localStorage.getItem('ollamaModel');try{const models=await fetchOllamaModels();select.innerHTML=models.map(model=>`<option value="${model.name}">${model.name}</option>`).join('')||'<option value="">No models installed</option>';if(current&&models.some(model=>model.name===current))select.value=current;return models;}catch(error){select.innerHTML='<option value="">Could not load models</option>';throw error;}}
async function testOllama(){try{const models=await populateModelSelect();toast(`Ollama connected · ${models.length} model${models.length===1?'':'s'} found.`);}catch(error){toast(`Ollama connection failed: ${error.message}`);}}
async function requestOllama(endpoint,body){await ensureOllamaRunning();await unloadComfyModel(serviceUrl('comfyUrl','http://127.0.0.1:8188'));const response=await fetch(`${serviceUrl('ollamaUrl','http://localhost:11434')}${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!response.ok)throw new Error(await readError(response));return response.json();}
function parseJsonLoose(text){const cleaned=(text||'').trim().replace(/^```[a-z]*\n?/i,'').replace(/```\s*$/,'').trim();return JSON.parse(cleaned);}
async function callOllamaJson(model,prompt){
  try{const data=await requestOllama('/api/generate',{model,prompt,format:'json',stream:false});return parseJsonLoose(data.response);}
  catch(generateError){
    try{const data=await requestOllama('/api/chat',{model,messages:[{role:'user',content:prompt}],format:'json',stream:false});return parseJsonLoose(data.message.content);}
    catch(chatError){throw new Error(`generate: ${generateError.message} / chat: ${chatError.message}`);}
  }
}
// keep_alive:0 tells Ollama to evict the model from memory right away; best-effort, never blocks the caller
async function unloadOllamaModel(model){try{await requestOllama('/api/generate',{model,keep_alive:0});}catch{}}
// Routes a ComfyUI/SwarmUI call through our own server, since that backend may not send CORS headers for direct browser fetches.
function comfyProxyUrl(target){return `/api/comfy-proxy?url=${encodeURIComponent(target)}`;}
// Frees ComfyUI's VRAM right after a render so it never overlaps with an Ollama model (shared, limited VRAM); best-effort
async function unloadComfyModel(base){try{await fetch(comfyProxyUrl(`${base}/free`),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({unload_models:true,free_memory:true})});}catch{}}
function normaliseItem(item,fallback){const effect=[item.flavour,item.effect].filter(Boolean).join('\n\n')||fallback.effect||'';return {name:item.name||fallback.name,category:item.category||fallback.category,rarity:RARITIES.includes(item.rarity)?item.rarity:fallback.rarity,attune:item.attune==='Yes'?'Yes':'No',type:['Weapon','Armor'].includes(item.type)?item.type:'Wondrous Item',effect,damage:item.damage||''};}
async function refineWithOllama(button){const card=cards[selected],model=localStorage.getItem('ollamaModel');if(!model){toast('Pick an Ollama model in Settings first.');return;}if(button)button.disabled=true;const prompt=`Create concise D&D 5e item card text as JSON. Return only JSON with keys ${FIELD_SPEC}. Item: ${stripTags(card.name)}. Existing effect: ${stripTags(card.effect)}`;try{Object.assign(card,normaliseItem(await callOllamaJson(model,prompt),card));localStorage.setItem('relic-press-cards',JSON.stringify(cards));render();toast('Ollama refined this card.');}catch(error){toast(`Ollama request failed: ${error.message}`);}finally{if(button)button.disabled=false;}}
async function generateItemsFromIdea(){
  const promptText=$('ideaPrompt').value.trim();
  if(!promptText){toast('Describe one or more items first.');return;}
  const model=localStorage.getItem('ollamaModel');
  if(!model){toast('Pick an Ollama model in Settings first.');return;}
  const slots=8;
  const parsedSeeds=promptText.split(/[,;\n]+/).map(s=>s.trim()).filter(Boolean).map(parseSeedSegment);
  const seedSlots=[];
  for(const seed of parsedSeeds){
    const remaining=slots-seedSlots.length;
    if(remaining<=0)break;
    const n=Math.min(seed.count,remaining);
    for(let i=0;i<n;i++)seedSlots.push({description:seed.description,index:i,total:seed.count});
  }
  const button=$('generateAllButton');button.disabled=true;
  try{
    const results=[];
    for(let i=0;i<slots;i++){
      const seed=seedSlots[i];
      toast(`Designing item ${i+1} of ${slots}...`);
      const instruction=seed
        ?`You design D&D 5e magic item cards. Design this item: "${seed.description}".${seed.total>1?` This is variant ${seed.index+1} of ${seed.total} in a themed set based on "${seed.description}" - keep the same general concept/category but give it a distinct name and a different specific effect from the other variants so the set feels varied.`:''} Return ONLY JSON (no prose, no markdown) with keys ${FIELD_SPEC}.`
        :`You design D&D 5e magic item cards. Invent an original D&D 5e magic item not already used elsewhere in this set, picking a varied category and rarity so a full set of ${slots} feels diverse. Return ONLY JSON (no prose, no markdown) with keys ${FIELD_SPEC}.`;
      const item=await callOllamaJson(model,instruction);
      results.push(normaliseItem(item,{name:seed?.description||'Unnamed Item',category:'Wondrous Item',rarity:'Common'}));
    }
    results.forEach((item,i)=>{cards[i]=Object.assign(item,{art:'',seed:seedSlots[i]?.description||item.name});});
    selected=0;
    localStorage.setItem('relic-press-cards',JSON.stringify(cards));
    render();
    toast(`Generated a full set of ${slots} items.`);
  }catch(error){toast(`Ollama generation failed: ${error.message}`);}
  finally{button.disabled=false;}
}
async function regenerateCard(customPrompt,button){
  const card=cards[selected],model=localStorage.getItem('ollamaModel');
  if(!model){toast('Pick an Ollama model in Settings first.');return;}
  const seed=customPrompt||card.seed||stripTags(card.name);
  const instruction=`You design D&D 5e magic item cards. Design a fresh alternative take on this item idea: "${seed}". Return ONLY JSON (no prose, no markdown) with keys ${FIELD_SPEC}.`;
  if(button)button.disabled=true;
  try{
    const result=await callOllamaJson(model,instruction);
    Object.assign(card,normaliseItem(result,card),{seed});
    localStorage.setItem('relic-press-cards',JSON.stringify(cards));
    render();
    toast('Ollama generated a new take on this item.');
  }catch(error){toast(`Ollama request failed: ${error.message}`);}
  finally{if(button)button.disabled=false;}
}
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
async function testComfy(){try{const response=await fetch(comfyProxyUrl(`${serviceUrl('comfyUrl','http://127.0.0.1:8188')}/system_stats`));if(!response.ok)throw new Error(`HTTP ${response.status}`);toast('ComfyUI connected.');}catch(error){toast(`ComfyUI connection failed. Start ComfyUI or SwarmUI and check its API URL: ${error.message}`);}}
// Downloads the freshly-generated image into this app's own data folder, so the art survives even after ComfyUI stops running; falls back to the live ComfyUI link if saving fails.
async function saveImageLocally(remoteUrl){try{const response=await fetch('/api/save-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:remoteUrl})});if(!response.ok)return remoteUrl;return (await response.json()).path;}catch{return remoteUrl;}}
async function generateArt(button){if(button){button.dataset.label=button.textContent;button.disabled=true;button.textContent='Generating…';}const workflow=localStorage.getItem('comfyWorkflow')||DEFAULT_COMFY_WORKFLOW;const ollamaModel=localStorage.getItem('ollamaModel');if(ollamaModel)await unloadOllamaModel(ollamaModel);try{const base=serviceUrl('comfyUrl','http://127.0.0.1:8188'),card=cards[selected],category=stripTags(card.category),name=stripTags(card.name),flavourLine=stripTags(card.effect).split('\n\n')[0],shapeHint=categoryShapeHint(category),positiveText=`((3d asset render of a fantasy ${category.toLowerCase()} named ${name}:1.2)), ((${shapeHint}:1.5)), ${flavourLine}, ${pick(ART_MATERIAL_VARIANTS)}, ${pick(ART_ANGLE_VARIANTS)}, ((full item in view:1.5)), ((centered composition:1.3)), ${pick(ART_LIGHTING_VARIANTS)}, high detail, sharp focus, (isolated on a solid plain white background:1.4)`,seedText=String(Math.floor(Math.random()*1e15));
    // Splice as JSON-escaped substrings (not raw text) since the prompt can contain quotes/backslashes from user-edited card text.
    const workflowObject=JSON.parse(workflow.replaceAll('{{prompt}}',jsonStringContent(positiveText)).replaceAll('{{negative}}',jsonStringContent(ART_NEGATIVE_PROMPT)).replaceAll('{{seed}}',seedText));const response=await fetch(comfyProxyUrl(`${base}/prompt`),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:workflowObject,client_id:'relic-press'})});if(!response.ok)throw new Error(`HTTP ${response.status}`);const promptId=(await response.json()).prompt_id;if(!promptId)throw new Error('No prompt id returned');toast('Image queued in ComfyUI...');for(let attempt=0;attempt<180;attempt++){await wait(1000);const history=await (await fetch(comfyProxyUrl(`${base}/history/${promptId}`))).json(),result=history[promptId];if(!result?.outputs)continue;for(const output of Object.values(result.outputs)){const image=output.images?.[0];if(image){const query=new URLSearchParams({filename:image.filename,subfolder:image.subfolder||'',type:image.type||'output'});const remoteUrl=`${base}/view?${query}`;card.art=await saveImageLocally(remoteUrl);localStorage.setItem('relic-press-cards',JSON.stringify(cards));render();toast('Artwork generated and attached.');return;}}}throw new Error('Timed out waiting for an image');}catch(error){toast(`ComfyUI request failed: ${error.message}`);if(button){button.disabled=false;button.textContent=button.dataset.label||'Generate image';}}}
// Build an offscreen front page + back page (each on its own printed sheet) so duplex printing lines up.
function buildPrintSheets(){
  const front=cards.map((_,i)=>i).map(i=>cardMarkup(cards[i],i,false,false)).join('');
  const back=backOrder().map(i=>cardMarkup(cards[i],i,true,false)).join('');
  const root=document.createElement('div');
  root.id='printSheets';
  root.innerHTML=`<div class="print-sheet-page"><div class="sheet print-sheet">${front}</div></div><div class="print-sheet-page"><div class="sheet print-sheet">${back}</div></div>`;
  return root;
}
function exportSheet(){
  toast('Preview export is ready to print.');
  const root=buildPrintSheets();
  document.body.appendChild(root);
  fitAllCards(root);
  window.print();
  root.remove();
}
document.querySelectorAll('.mode').forEach(button=>button.addEventListener('click',()=>{side=button.dataset.side;document.querySelectorAll('.mode').forEach(item=>item.classList.toggle('active',item===button));render();}));
$('exportButton').addEventListener('click',exportSheet);$('downloadCards').addEventListener('click',exportSheet);$('generateAllButton').addEventListener('click',generateItemsFromIdea);$('zoomIn').addEventListener('click',()=>{zoom=Math.min(1.2,zoom+.08);render();});$('zoomOut').addEventListener('click',()=>{zoom=Math.max(.4,zoom-.08);render();});
$('settingsButton').addEventListener('click',()=>{$('ollamaUrl').value=localStorage.getItem('ollamaUrl')||'http://localhost:11434';$('comfyUrl').value=localStorage.getItem('comfyUrl')||'http://127.0.0.1:8188';$('workflowInput').value=localStorage.getItem('comfyWorkflow')||'';$('settingsDialog').showModal();populateModelSelect().catch(()=>{});});$('saveSettings').addEventListener('click',()=>{localStorage.setItem('ollamaUrl',$('ollamaUrl').value);localStorage.setItem('ollamaModel',$('ollamaModel').value);localStorage.setItem('comfyUrl',$('comfyUrl').value);localStorage.setItem('comfyWorkflow',$('workflowInput').value);toast('Local connections saved.');});$('testOllama').addEventListener('click',testOllama);$('testComfy').addEventListener('click',testComfy);
// Lets the user drag the sidebar wider/narrower; width is clamped and remembered across reloads.
(function initSidebarResize(){
  const root=document.documentElement,resizer=$('sidebarResizer');
  if(!resizer)return;
  const MIN=200,MAX=520;
  const clamp=width=>Math.min(MAX,Math.max(MIN,width));
  const stored=parseInt(localStorage.getItem('relic-press-sidebar-width'),10);
  if(stored)root.style.setProperty('--sidebar-width',`${clamp(stored)}px`);
  let dragging=false;
  resizer.addEventListener('pointerdown',event=>{dragging=true;resizer.setPointerCapture(event.pointerId);resizer.classList.add('active');});
  resizer.addEventListener('pointermove',event=>{if(!dragging)return;root.style.setProperty('--sidebar-width',`${clamp(event.clientX)}px`);});
  const stopDrag=()=>{
    if(!dragging)return;
    dragging=false;
    resizer.classList.remove('active');
    localStorage.setItem('relic-press-sidebar-width',parseInt(getComputedStyle(root).getPropertyValue('--sidebar-width'),10));
    fitAllCards();
  };
  resizer.addEventListener('pointerup',stopDrag);
  resizer.addEventListener('pointercancel',stopDrag);
})();
render();
renderLibrary();
loadLibraryFromServer();