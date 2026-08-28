/*
 * 两个人的地图：所有交互逻辑
 * 数据结构与部署建议见 README.md。
 */
import { defaultData } from './data.js';
      const STORE_KEY = 'love-memories-data-v1';
      let data = loadData();
      const letterDateUpdates = {
        'chat-letter-29-2026-08-28-100days': {date:'2026-08-24', title:'8.24'},
        'chat-letter-30-2026-08-28-hongkong': {date:'2026-08-25', title:'8.25'},
        'chat-letter-31-2026-08-28-vancouver': {date:'2026-08-26', title:'8.26'}
      };
      const letterSeed = new Map(defaultData.letters.map(letter => [letter.id, letter]));
      data.letters = data.letters.map(letter => {
        const update = letterDateUpdates[letter.id];
        return update ? {...letter, body:letterSeed.get(letter.id)?.body || letter.body, ...update} : letter;
      });
      let activePlaceId = data.places[0]?.id;
      let map, markers = [], currentSlide = 0;
      let currentMemoryIndex = null;
      let calendarCursor = new Date();
      let selectedCalendarDate = formatDate(new Date());
      const $ = (selector, scope=document) => scope.querySelector(selector);
      const $$ = (selector, scope=document) => [...scope.querySelectorAll(selector)];
      function clone(obj){ return JSON.parse(JSON.stringify(obj)); }
      function isPreviousDemoItem(item){
        if(item?.id==='p1') return item.name==='西安' && item.intro==='我们在西安留下的第一段共同记忆。';
        if(item?.id==='chat-place-first-meet-xian') return item.intro==='七月中旬，你们终于把屏幕里的陪伴，变成了并肩走过的三天。';
        if(item?.id==='chat-place-second-meet-xian') return item.intro==='在开学前又一次见到彼此。上一次写下的“下一次见面”，终于在西安变成了真的。';
        if(item?.id==='chat-2026-05-19-first-520' || item?.id==='chat-2026-07-16-first-meet') return true;
        if(item?.id==='chat-promise-write-520' && item.targetDate==='2026-05-19') return true;
        const legacyEvents={
          e1:['2026-02-08','相遇日'],
          e2:['2026-05-15','在一起的日子'],
          e3:['2026-07-16','第一次见面']
        };
        const legacy=legacyEvents[item?.id];
        return Boolean(legacy && item.date===legacy[0] && item.title===legacy[1]);
      }
      function mergeItems(seedItems, savedItems){
        const merged = new Map(seedItems.map(item=>[item.id,item]));
        (Array.isArray(savedItems)?savedItems:[]).filter(item=>!isPreviousDemoItem(item)).forEach(item=>{
          const seeded=merged.get(item.id);
          const videos=Array.isArray(seeded?.videos)?[...new Set([...(seeded.videos||[]),...(item.videos||[])])]:item.videos;
          merged.set(item.id, videos ? {...item,videos} : item);
        });
        return [...merged.values()];
      }
      function loadData(){
        const defaults=clone(defaultData);
        try {
          const saved=localStorage.getItem(STORE_KEY);
          if(!saved) return defaults;
          const previous=JSON.parse(saved);
          return {
            ...defaults,
            ...previous,
            relationshipStart:previous.relationshipStart && previous.relationshipStart>='2026-01-01' ? previous.relationshipStart : defaults.relationshipStart,
            places:mergeItems(defaults.places,previous.places),
            events:mergeItems(defaults.events,previous.events),
            letters:mergeItems(defaults.letters,previous.letters),
            conversations:mergeItems(defaults.conversations,previous.conversations),
            wishes:mergeItems(defaults.wishes,previous.wishes),
            timeCapsules:mergeItems(defaults.timeCapsules,previous.timeCapsules),
            careKitTemplates:defaults.careKitTemplates,
            careKitNotes:{...defaults.careKitNotes,...(previous.careKitNotes||{})}
          };
        } catch { return defaults; }
      }
      function formatDate(date){ const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date; return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
      function dateText(date){ return new Intl.DateTimeFormat('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'short'}).format(new Date(date+'T12:00:00')); }
      function shortDate(date){ return new Intl.DateTimeFormat('zh-CN',{month:'numeric',day:'numeric'}).format(new Date(date+'T12:00:00')); }
      function escapeHtml(value=''){ return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
      function daysUntil(date){ const now = new Date(); now.setHours(0,0,0,0); const target = new Date(date+'T12:00:00'); target.setHours(0,0,0,0); return Math.round((target-now)/86400000); }
      function anniversaryUpcoming(event){ const today = new Date(); const source = new Date(event.date+'T12:00:00'); const target = new Date(today.getFullYear(), source.getMonth(), source.getDate()); if (target < new Date(today.getFullYear(),today.getMonth(),today.getDate())) target.setFullYear(target.getFullYear()+1); return {...event,nextDate:formatDate(target)}; }
      function showToast(message){ const el=$('#toast'); el.textContent=message; el.classList.add('show'); clearTimeout(showToast.timer); showToast.timer=setTimeout(()=>el.classList.remove('show'),2400); }
      function initMap(){
        if (!window.L) { $('#map').innerHTML='<div style="padding:24px;color:#6a4b43">地图组件暂未加载，请检查网络后刷新。</div>'; return; }
        map=L.map('map',{zoomControl:false,scrollWheelZoom:true}).setView([34.3416,108.9398],5);
        L.control.zoom({position:'bottomright'}).addTo(map);

        const fallbackEl=$('#map-fallback');
        const showMapFallback=()=>fallbackEl.classList.add('show');
        const hideMapFallback=()=>fallbackEl.classList.remove('show');
        const osmTile=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'});
        osmTile.on('load',hideMapFallback);
        osmTile.on('tileerror',showMapFallback);
        osmTile.addTo(map);
        setTimeout(()=>{
          if (!map.getContainer().querySelector('.leaflet-tile-loaded')) {
            showMapFallback();
          }
        },1800);

        window.setTimeout(()=>{
          map.invalidateSize();
          if (data.places.length) {
            const bounds=L.latLngBounds(data.places.map(p=>[p.lat,p.lng]));
            map.fitBounds(bounds,{padding:[40,40],maxZoom:9});
          }
        },180);
        window.addEventListener('resize',()=>map.invalidateSize());
        renderMapMarkers();
      }
      function getDefaultPlaceCoordinates(){
        const anchor = data.places[0];
        return anchor ? [anchor.lat, anchor.lng] : [34.3416, 108.9398];
      }
      function renderMapMarkers(){
        if(!map) return; markers.forEach(marker=>marker.remove()); markers=[];
        const type=$('#place-type-filter').value, city=$('#place-city-filter').value;
        const filtered=data.places.filter(p=>(type==='all'||p.type===type)&&(city==='all'||p.city===city));
        filtered.forEach(place=>{
          // 同一城市的不同回忆可能共用坐标；轻微错开，保证每一次见面都能被点到。
          const sameSpot=filtered.filter(item=>item.lat===place.lat&&item.lng===place.lng);
          const spotIndex=sameSpot.findIndex(item=>item.id===place.id);
          const offset=(spotIndex-(sameSpot.length-1)/2)*0.008;
          const markerPosition=[place.lat+offset*.65,place.lng+offset];
          const icon=L.divIcon({className:'',html:'<div class="memory-pin"><span>♥</span></div>',iconSize:[32,32],iconAnchor:[16,30]});
          const marker=L.marker(markerPosition,{icon}).addTo(map).bindTooltip(escapeHtml(place.name),{direction:'top',offset:[0,-25]});
          marker.on('click',()=>selectPlace(place.id,true)); markers.push(marker);
        });
        if(filtered.length) map.fitBounds(L.latLngBounds(filtered.map(p=>[p.lat,p.lng])),{padding:[52,52],maxZoom:9});
        if(!filtered.some(p=>p.id===activePlaceId)) activePlaceId=filtered[0]?.id;
        renderPlacePanel();
      }
      function selectPlace(id, pan=false){ activePlaceId=id; currentSlide=0; if(pan&&map){const p=data.places.find(x=>x.id===id); map.flyTo([p.lat,p.lng],Math.max(map.getZoom(),8),{duration:.6});} renderPlacePanel(); }
      function renderHome(){
        const today=new Date(); const start=new Date(data.relationshipStart+'T12:00:00'); const days=Math.max(0,Math.floor((today-start)/86400000)+1);
        $('#days-together').textContent=`${days.toLocaleString()} 天`; $('#place-count').textContent=`${data.places.length} 个`; $('#letter-count').textContent=`${data.letters.length} 封`;
        const annual=data.events.filter(e=>e.type==='纪念日').map(anniversaryUpcoming).sort((a,b)=>a.nextDate.localeCompare(b.nextDate)); const next=annual[0] || data.events.map(e=>({...e,nextDate:e.date})).filter(e=>e.nextDate>=formatDate(today)).sort((a,b)=>a.nextDate.localeCompare(b.nextDate))[0];
        $('#next-event-title').textContent=next?next.title:'下一次说好的幸福'; $('#next-event-count').textContent=next?`${daysUntil(next.nextDate)===0?'就是今天':`还有 ${daysUntil(next.nextDate)} 天`} · ${new Intl.DateTimeFormat('zh-CN',{month:'long',day:'numeric'}).format(new Date(next.nextDate+'T12:00:00'))}`:'去写下一次约定吧';
        const latest=[...data.letters].sort((a,b)=>b.date.localeCompare(a.date))[0]; $('#latest-letter').innerHTML=latest?`<article class="mini-letter"><span class="date">${dateText(latest.date)} · ${escapeHtml(latest.to)}</span><h3>${escapeHtml(latest.title)}</h3><p>${escapeHtml(latest.body).replace(/\n/g,'<br>')}</p><button class="link-btn" data-action="open-letter" data-id="${latest.id}">打开信件 →</button></article>`:'<p class="empty-note">第一封信，等着被写下。</p>';
        const upcoming=data.events.map(e=>({...e,nextDate: e.type==='纪念日'?anniversaryUpcoming(e).nextDate:e.date})).filter(e=>e.nextDate>=formatDate(today)).sort((a,b)=>a.nextDate.localeCompare(b.nextDate)).slice(0,3); $('#upcoming-events').innerHTML=upcoming.length?upcoming.map((e,i)=>`<div class="today-item"><span class="event-dot ${i%2?'sage':''}"></span><div><strong>${escapeHtml(e.title)}</strong><span>${dateText(e.nextDate)} · ${daysUntil(e.nextDate)===0?'就是今天':`还有 ${daysUntil(e.nextDate)} 天`}</span></div></div>`).join(''):'<p class="empty-note">未来会慢慢填满期待。</p>';
        renderWishList();
        renderCapsuleList();
        renderTodayMemory();
      }
      function fillCities(){ const current=$('#place-city-filter').value; const cities=[...new Set(data.places.map(p=>p.city))]; $('#place-city-filter').innerHTML='<option value="all">全部城市</option>'+cities.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join(''); $('#place-city-filter').value=cities.includes(current)?current:'all'; }
      function renderCalendar(){
        const year=calendarCursor.getFullYear(), month=calendarCursor.getMonth(); $('#month-label').textContent=`${year} 年 ${month+1} 月`;
        const first=new Date(year,month,1), start=new Date(year,month,1-first.getDay()), today=formatDate(new Date()); let html='';
        for(let i=0;i<42;i++){ const d=new Date(start); d.setDate(start.getDate()+i); const key=formatDate(d), entries=data.events.filter(e=>e.date===key), muted=d.getMonth()!==month; html+=`<button class="day ${muted?'muted':''} ${key===selectedCalendarDate?'selected':''} ${key===today?'today':''}" data-date="${key}"><span class="date-num">${d.getDate()}</span>${entries.slice(0,1).map(e=>`<span class="event-pill">${escapeHtml(e.title)}</span>`).join('')}${entries.length>1?`<span class="day-event-more">+${entries.length-1}</span>`:''}</button>`; }
        $('#calendar-grid').innerHTML=html; renderDayDetail();
      }
      function renderLetters(){ const letters=[...data.letters].sort((a,b)=>b.date.localeCompare(a.date)); $('#letters-grid').innerHTML=letters.length?letters.map(l=>`<button class="letter-card" data-action="open-letter" data-id="${l.id}"><span class="to">${escapeHtml(l.to)} · ${dateText(l.date)}</span><h2>${escapeHtml(l.title)}</h2><p>${escapeHtml(l.body).replace(/\n/g,'<br>')}</p><span class="letter-footer"><span>${escapeHtml(l.from||'我')}</span><span>打开 →</span></span></button>`).join(''):'<p class="empty-note">还没有信件。</p>'; }
      function renderCommunications(){
        const records=[...(data.conversations||[])].sort((a,b)=>b.date.localeCompare(a.date));
        $('#communication-list').innerHTML=records.length?records.map(record=>{
          const linkedLetters=(record.letterIds||[]).map(id=>data.letters.find(letter=>letter.id===id)).filter(Boolean);
          const links=linkedLetters.length?linkedLetters.map(letter=>`<button class="letter-link" data-action="open-letter" data-id="${letter.id}">${escapeHtml(letter.title)} <span>打开原文 →</span></button>`).join(''):'<span class="small-note">这次沟通还没有关联长文。</span>';
          return `<article class="communication-card"><div class="communication-top"><div><span class="date">${dateText(record.date)}</span><h2>${escapeHtml(record.title)}</h2></div><span class="tag ${record.status==='已达成'?'done':''}">${escapeHtml(record.status||'还在路上')}</span></div><div class="communication-section"><h3>当时的问题</h3><p>${escapeHtml(record.issue||'')}</p></div><div class="communication-section"><h3>我们怎样沟通</h3><p>${escapeHtml(record.process||'')}</p></div><div class="communication-section letters"><h3>当时写下的小作文</h3><div class="letter-link-list">${links}</div></div><div class="communication-section solution"><h3>最后的处理方式</h3><p>${escapeHtml(record.resolution||'')}</p></div></article>`;
        }).join(''):'<p class="empty-note">还没有沟通记录。把一次认真说清楚的事记下来吧。</p>';
      }
      function renderWishList(){
        const wishes=[...data.wishes].sort((a,b)=>a.status===b.status?0:(a.status==='done'?-1:1));
        $('#wish-list').innerHTML=wishes.length?wishes.map(w=>`<article class="wish-item"><span class="tag">${w.status==='done'?'已完成':'还在路上'}</span><h3>${escapeHtml(w.title)}</h3><p>${escapeHtml(w.note||'')}</p><div class="pill-row">${w.category?`<span class="pill">${escapeHtml(w.category)}</span>`:''}${w.targetDate?`<span class="pill">${escapeHtml(w.targetDate)}</span>`:''}</div>${w.status!=='done' ? `<button class="link-btn" data-action="finish-wish" data-id="${w.id}">标记实现 →</button>` : ''}</article>`).join(''):'<p class="empty-note sm">还没有约定，先写一句吧。</p>';
      }
      function renderPreferences(){
        const preferences=data.herPreferences||{likes:[],dislikes:[]};
        const renderGroups=groups=>groups.length?groups.map(group=>`<article class="preference-group"><h3>${escapeHtml(group.category)}</h3><div class="preference-pills">${(group.items||[]).map(item=>`<span>${escapeHtml(item)}</span>`).join('')}</div></article>`).join(''):'<p class="empty-note">还没有写下内容。</p>';
        $('#likes-list').innerHTML=renderGroups(preferences.likes||[]);
        $('#dislikes-list').innerHTML=renderGroups(preferences.dislikes||[]);
      }
      function renderCareKit(){
        const templates=data.careKitTemplates||[], notes=data.careKitNotes||{};
        $('#care-kit-list').innerHTML=templates.map(item=>`<article class="care-kit-card"><h2>${escapeHtml(item.title)}</h2><textarea data-care-note="${escapeHtml(item.id)}" placeholder="在这里写下：她这时想吃什么、想听什么、希望怎样被陪伴……">${escapeHtml(notes[item.id]||'')}</textarea></article>`).join('');
      }
      function renderCapsuleList(){
        const capsules=[...data.timeCapsules].sort((a,b)=>a.unlockDate.localeCompare(b.unlockDate));
        $('#capsule-list').innerHTML=capsules.length?capsules.map(c=>`<article class="capsule-item"><span class="tag">${daysUntil(c.unlockDate) <= 0 ? '已可打开' : `还剩 ${daysUntil(c.unlockDate)} 天`}</span><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.note||'')}</p><div class="pill-row"><span class="pill">${escapeHtml(c.type||'信件/照片')}</span><span class="pill">${escapeHtml(c.unlockDate)}</span></div>${daysUntil(c.unlockDate) <= 0 ? `<button class="link-btn" data-action="open-capsule" data-id="${c.id}">打开胶囊 →</button>` : ''}</article>`).join(''):'<p class="empty-note sm">还没有胶囊，留一份给未来吧。</p>';
      }
      function getTodayMemory(step=0){
        const today = formatDate(new Date());
        const candidates = [
          ...data.events.map(e=>({kind:'日子', title:e.title, note:e.description || '这一天被记住了。', date:e.date})),
          ...data.places.map(p=>({kind:'地点', title:p.name, note:p.intro || '这段回忆还在。', date:p.date})),
          ...data.letters.map(l=>({kind:'信件', title:l.title, note:l.body, date:l.date}))
        ].filter(item => item.date <= today);
        if (!candidates.length) return null;
        const seed = today.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
        if (currentMemoryIndex === null || currentMemoryIndex >= candidates.length) currentMemoryIndex = seed % candidates.length;
        currentMemoryIndex = (currentMemoryIndex + step + candidates.length) % candidates.length;
        return candidates[currentMemoryIndex];
      }
      function renderTodayMemory(step=0){
        const memory = getTodayMemory(step);
        $('#today-memory').innerHTML=memory?`<article class="memory-item"><span class="tag">${escapeHtml(memory.kind)}</span><h3>${escapeHtml(memory.title)}</h3><p>${escapeHtml(memory.note).replace(/\n/g,'<br>')}</p><div class="pill-row"><span class="pill">${escapeHtml(memory.date)}</span></div></article>`:'<p class="empty-note sm">还没有可翻开的旧回忆。</p>';
      }
      function renderTimeline(){
        const items=[...data.events.map(e=>({...e,kind:'重要日子'})),...data.places.map(p=>({date:p.date,title:p.name,type:p.type,description:p.intro,kind:'地点',id:p.id})),...data.letters.map(l=>({date:l.date,title:l.title,type:l.to,description:l.body.replace(/\n/g,' '),kind:'信件',id:l.id})),...data.wishes.filter(w=>w.status==='done').map(w=>({date:w.completedDate||w.targetDate||formatDate(new Date()),title:w.title,type:'愿望',description:w.note,kind:'愿望',id:w.id})),...data.timeCapsules.filter(c=>daysUntil(c.unlockDate) <= 0).map(c=>({date:c.unlockDate,title:c.title,type:'胶囊',description:c.note,kind:'胶囊',id:c.id}))].sort((a,b)=>a.date.localeCompare(b.date)); $('#timeline').innerHTML=items.map(i=>`<article class="timeline-item"><div class="timeline-date">${dateText(i.date)}</div><div class="timeline-content"><span class="type">${escapeHtml(i.kind)} · ${escapeHtml(i.type)}</span><h3>${escapeHtml(i.title)}</h3><p>${escapeHtml(i.description||'')}</p>${i.kind==='地点'?`<button class="link-btn" data-action="open-place" data-id="${i.id}">重温地点 →</button>`:i.kind==='信件'?`<button class="link-btn" data-action="open-letter" data-id="${i.id}">打开信件 →</button>`:''}</div></article>`).join(''); }
      function renderAll(){ fillCities(); renderHome(); renderCalendar(); renderLetters(); renderPreferences(); renderCareKit(); renderCommunications(); renderTimeline(); renderMapMarkers(); }
      function openModal(inner, wide=false){ $('#modal').className=`modal ${wide?'wide':''}`; $('#modal').innerHTML=inner; $('#modal-backdrop').classList.add('show'); setTimeout(()=>$('#modal button, #modal input, #modal textarea, #modal select')?.focus(),10); }
      function closeModal(){ $('#modal-backdrop').classList.remove('show'); }
      function changeSlide(step){ const slides=$$('#gallery .slide'); if(!slides.length)return; slides[currentSlide].classList.remove('active'); currentSlide=(currentSlide+step+slides.length)%slides.length; slides[currentSlide].classList.add('active'); }
      function openLetter(id){ const l=data.letters.find(x=>x.id===id); if(!l)return; openModal(`<div class="modal-head"><div><p class="eyebrow">JAY CHOU · 开不了口</p><h2 id="modal-title">${escapeHtml(l.title)}</h2></div><button class="close" data-action="close-modal" aria-label="关闭">×</button></div><article class="modal-letter"><p class="letter-meta">${escapeHtml(l.to)} · ${dateText(l.date)}</p><h3>${escapeHtml(l.title)}</h3><div class="body">${escapeHtml(l.body)}</div><p class="sign">${escapeHtml(l.from||'我')}</p></article>`); }
      function openEventForm(existing=null, date=''){
        const e=existing||{}, types=['纪念日','生日','旅行','第一次约会','重要时刻','需要抱抱','支持与陪伴','日常'];
        const options=types.map(type=>`<option ${e.type===type?'selected':''}>${type}</option>`).join('');
        openModal(`<div class="modal-head"><div><p class="eyebrow">JAY CHOU · 说好的幸福呢</p><h2 id="modal-title">${existing?'重写这个约定':'写下一个约定'}</h2></div><button class="close" data-action="close-modal" aria-label="关闭">×</button></div><form id="event-form" data-id="${e.id||''}"><div class="form-grid"><div class="field"><label>日期</label><input name="date" type="date" required value="${e.date||date||formatDate(new Date())}"></div><div class="field"><label>类型</label><select name="type">${options}</select></div></div><div class="field"><label>这一天的名称</label><input name="title" required maxlength="40" value="${escapeHtml(e.title||'')}" placeholder="例如：我们相识的那天"></div><div class="field"><label>写一点说明</label><textarea name="description" maxlength="300" placeholder="这一天发生了什么？">${escapeHtml(e.description||'')}</textarea></div><div class="modal-actions">${existing?'<button type="button" class="btn danger" data-action="delete-event" data-id="'+e.id+'">删除</button>':''}<button type="button" class="btn secondary" data-action="close-modal">取消</button><button type="submit" class="btn primary">保存</button></div></form>`);
      }
      function openLetterForm(){ openModal(`<div class="modal-head"><div><p class="eyebrow">JAY CHOU · 开不了口</p><h2 id="modal-title">把想说的话写下来</h2></div><button class="close" data-action="close-modal" aria-label="关闭">×</button></div><form id="letter-form"><div class="form-grid"><div class="field"><label>日期</label><input name="date" type="date" required value="${formatDate(new Date())}"></div><div class="field"><label>写给谁</label><input name="to" required value="给你"></div></div><div class="field"><label>标题</label><input name="title" required maxlength="50" placeholder="例如：想和你再去一次海边"></div><div class="field"><label>信的内容</label><textarea name="body" required style="min-height:210px" placeholder="慢慢写，不着急。"></textarea></div><div class="field"><label>署名</label><input name="from" value="我"></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close-modal">取消</button><button type="submit" class="btn primary">收进信箱</button></div></form>`); }
      function openConversationForm(){
        const letters=[...data.letters].sort((a,b)=>b.date.localeCompare(a.date));
        const options=letters.map(letter=>`<option value="${letter.id}">${escapeHtml(dateText(letter.date))} · ${escapeHtml(letter.title)}</option>`).join('');
        openModal(`<div class="modal-head"><div><p class="eyebrow">JAY CHOU · 蒲公英的约定</p><h2 id="modal-title">把这次沟通记下来</h2></div><button class="close" data-action="close-modal" aria-label="关闭">×</button></div><form id="conversation-form"><div class="form-grid"><div class="field"><label>日期</label><input name="date" type="date" required value="${formatDate(new Date())}"></div><div class="field"><label>目前状态</label><select name="status"><option>已达成</option><option selected>还在路上</option></select></div></div><div class="field"><label>这次沟通的主题</label><input name="title" required maxlength="50" placeholder="例如：关于聊天频率的沟通"></div><div class="field"><label>当时的问题</label><textarea name="issue" required maxlength="320" placeholder="是什么让彼此卡住了？"></textarea></div><div class="field"><label>我们怎样沟通</label><textarea name="process" required maxlength="500" placeholder="各自说了什么、理解到了什么？"></textarea></div><div class="field"><label>关联的小作文（可多选）</label><select name="letterIds" multiple size="6">${options}</select><p class="small-note">按住 ⌘（Windows 按 Ctrl）可以选择多封。</p></div><div class="field"><label>最后的处理方式</label><textarea name="resolution" required maxlength="500" placeholder="最后达成了什么约定，或接下来准备怎样做？"></textarea></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close-modal">取消</button><button type="submit" class="btn primary">保存沟通记录</button></div></form>`); 
      }
      document.addEventListener('click',e=>{ if(e.target.closest('[data-action="open-add-conversation"]')) openConversationForm(); });
      function openWishForm(){ openModal(`<div class="modal-head"><div><p class="eyebrow">JAY CHOU · 蒲公英的约定</p><h2 id="modal-title">写下一份约定</h2></div><button class="close" data-action="close-modal" aria-label="关闭">×</button></div><form id="wish-form"><div class="field"><label>约定标题</label><input name="title" required maxlength="40" placeholder="例如：一起看一场演出"></div><div class="field"><label>分类</label><input name="category" maxlength="20" placeholder="见面 / 旅行 / 日常"></div><div class="field"><label>备注</label><textarea name="note" maxlength="220" placeholder="这是怎样的一份约定？"></textarea></div><div class="form-grid"><div class="field"><label>预计实现日期</label><input name="targetDate" type="date"></div><div class="field"><label>实现状态</label><select name="status"><option value="todo">还在路上</option><option value="done">已经实现</option></select></div></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close-modal">取消</button><button type="submit" class="btn primary">保存约定</button></div></form>`); }
      function openCapsuleForm(){ openModal(`<div class="modal-head"><div><p class="eyebrow">JAY CHOU · 回到过去</p><h2 id="modal-title">留给未来的你</h2></div><button class="close" data-action="close-modal" aria-label="关闭">×</button></div><form id="capsule-form"><div class="field"><label>胶囊标题</label><input name="title" required maxlength="40" placeholder="例如：给周年纪念日的信"></div><div class="field"><label>内容类型</label><input name="type" maxlength="20" placeholder="信件 / 照片 / 小纸条"></div><div class="field"><label>说明</label><textarea name="note" maxlength="220" placeholder="未来打开时想看到什么？"></textarea></div><div class="field"><label>上传照片（可选）</label><input name="photoFile" type="file" accept="image/*"></div><div class="field"><label>打开日期</label><input name="unlockDate" type="date" required></div><div class="modal-actions"><button type="button" class="btn secondary" data-action="close-modal">取消</button><button type="submit" class="btn primary">保存胶囊</button></div></form>`); }
      function openPasswordForm(){ openModal(`<div class="modal-head"><div><p class="eyebrow">JAY CHOU · 说好不哭</p><h2 id="modal-title">${data.password?'修改我们的小秘密':'设置我们的小秘密'}</h2></div><button class="close" data-action="close-modal" aria-label="关闭">×</button></div><form id="password-form"><div class="field"><label>新密码</label><input name="password" type="password" required minlength="4" autocomplete="new-password" placeholder="至少 4 位"></div><p class="small-note">原型会把密码保存在当前浏览器。正式上线时请使用安全的账号系统和服务器端加密。</p><div class="modal-actions">${data.password?'<button type="button" class="btn danger" data-action="remove-password">关闭保护</button>':''}<button type="button" class="btn secondary" data-action="close-modal">取消</button><button type="submit" class="btn primary">保存并锁定</button></div></form>`); }
      function changeView(view){ $$('.view').forEach(v=>v.classList.toggle('active',v.id===view+'-view')); $$('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===view)); window.scrollTo({top:0,behavior:'smooth'}); if(view==='home'&&map) setTimeout(()=>map.invalidateSize(),100); }
      document.addEventListener('click', e=>{
        const button=e.target.closest('button,[data-view]'); if(!button)return;
        if(button.dataset.view){ changeView(button.dataset.view); return; }
        const action=button.dataset.action;
        if(action==='close-modal') closeModal(); if(action==='open-place') openPlace(button.dataset.id); if(action==='select-place') selectPlace(button.dataset.id); if(action==='open-place-name'){const p=data.places.find(x=>x.name===button.dataset.name); if(p)openPlace(p.id);} if(action==='open-letter') openLetter(button.dataset.id); if(action==='open-add-event') openEventForm(null,button.dataset.date||''); if(action==='open-add-place') openPlaceForm(); if(action==='open-add-letter') openLetterForm(); if(action==='open-add-wish') openWishForm(); if(action==='open-add-capsule') openCapsuleForm(); if(action==='refresh-memory') { renderTodayMemory(1); showToast('已换一条回忆'); } if(action==='slide-next')changeSlide(1); if(action==='slide-prev')changeSlide(-1); if(action==='finish-wish'){const wish=data.wishes.find(x=>x.id===button.dataset.id); if(wish){wish.status='done'; wish.completedDate=formatDate(new Date()); const existing=data.places.some(p=>p.sourceId===wish.id); if(!existing){ const [lat,lng]=getDefaultPlaceCoordinates(); data.places.push({id:'p'+Date.now(),sourceId:wish.id,name:wish.title,city:wish.category||'愿望',date:wish.completedDate,type:'愿望',lat,lng,intro:wish.note||'愿望已完成。',shared:'',her:'',mine:'',letter:'',photos:[]}); } saveData(); showToast('愿望已完成');}} if(action==='open-capsule'){const capsule=data.timeCapsules.find(x=>x.id===button.dataset.id); if(capsule){ const body = capsule.photo ? `<img src="${capsule.photo}" alt="${escapeHtml(capsule.title)}" style="width:100%;max-height:320px;object-fit:cover;border-radius:12px;margin-bottom:12px;">` : ''; openModal(`<div class="modal-head"><div><p class="eyebrow">TIME CAPSULE</p><h2 id="modal-title">${escapeHtml(capsule.title)}</h2></div><button class="close" data-action="close-modal" aria-label="关闭">×</button></div><article class="modal-letter"><p class="letter-meta">${escapeHtml(capsule.type||'未来的内容')}</p>${body}<div class="body">${escapeHtml(capsule.note||'')}</div><p class="sign">${escapeHtml(capsule.unlockDate)}</p></article>`); }} if(action==='delete-event'){ if(confirm('确定删除这个重要日子吗？')){data.events=data.events.filter(x=>x.id!==button.dataset.id);saveData();closeModal();showToast('已删除');}} if(action==='remove-password'){data.password='';saveData();closeModal();showToast('访问保护已关闭');}
      });
      document.addEventListener('submit',handleSubmit);
      document.addEventListener('input',e=>{ const id=e.target.dataset.careNote; if(!id)return; data.careKitNotes={...(data.careKitNotes||{}),[id]:e.target.value}; localStorage.setItem(STORE_KEY,JSON.stringify(data)); });
      $('#modal-backdrop').addEventListener('click',e=>{if(e.target===e.currentTarget)closeModal();});
      $('#place-type-filter').addEventListener('change',renderMapMarkers); $('#place-city-filter').addEventListener('change',renderMapMarkers);
      $('#calendar-grid').addEventListener('click',e=>{const d=e.target.closest('.day')?.dataset.date;if(d){selectedCalendarDate=d;calendarCursor=new Date(d+'T12:00:00');renderCalendar();}});
      $('#prev-month').addEventListener('click',()=>{calendarCursor.setMonth(calendarCursor.getMonth()-1);renderCalendar();}); $('#next-month').addEventListener('click',()=>{calendarCursor.setMonth(calendarCursor.getMonth()+1);renderCalendar();}); $('#today-month').addEventListener('click',()=>{calendarCursor=new Date();selectedCalendarDate=formatDate(new Date());renderCalendar();});
      $('#password-button').addEventListener('click',openPasswordForm); $('#export-data').addEventListener('click',()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`两个人的地图-${formatDate(new Date())}.json`;a.click();URL.revokeObjectURL(a.href);showToast('备份文件已导出');});
      $('#import-data').addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(reader.result);if(!Array.isArray(parsed.places)||!Array.isArray(parsed.events)||!Array.isArray(parsed.letters))throw Error();data={...clone(defaultData),...parsed};activePlaceId=data.places[0]?.id;saveData();showToast('备份已恢复');}catch{alert('这不是有效的备份文件。');}};reader.readAsText(file);e.target.value='';});
      function updatePrivacy(){ $('#privacy-status').textContent=data.password?'访问密码已开启。每次重新打开浏览器时需要输入密码。':'尚未设置访问密码。演示数据只保存在这台设备的浏览器中。'; $('#password-button').textContent=data.password?'修改密码':'设置密码'; }
      function isDataPhoto(photo){ return typeof photo==='string' && /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(photo); }
      function isImagePhoto(photo){ return isDataPhoto(photo) || (typeof photo==='string' && /\.(png|jpe?g|webp|gif|heic)(?:[?#].*)?$/i.test(photo)); }
      function isVideoMedia(media){ return typeof media==='string' && /\.(mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(media); }
      function photoLabel(photo, place){ return place?.photoCaptions?.[photo] || (isDataPhoto(photo)?'我们拍下的照片':(photo||'一张照片')); }
      function readPhoto(file){ return new Promise((resolve,reject)=>{ const reader=new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); }); }
      function saveData(){ localStorage.setItem(STORE_KEY, JSON.stringify(data)); renderAll(); updatePrivacy(); }
      function renderPlacePanel(){
        const p=data.places.find(x=>x.id===activePlaceId)||data.places[0], panel=$('#place-panel');
        if(!p){panel.innerHTML='<p class="empty-note">还没有地点。去添加第一枚标记吧。</p>';return;}
        const photo=p.photos?.find(isImagePhoto), displayPhoto=photo||p.photos?.[0]||'一张照片';
        const cityMemories=data.places.filter(item=>item.city===p.city).sort((a,b)=>a.date.localeCompare(b.date));
        const citySwitch=cityMemories.length>1?`<div class="city-memory-switch"><span>同城回忆</span><div>${cityMemories.map(item=>`<button class="${item.id===p.id?'active':''}" data-action="select-place" data-id="${item.id}">${shortDate(item.date)} · ${escapeHtml(item.name.replace(`${item.city} · `,''))}</button>`).join('')}</div></div>`:'';
        panel.innerHTML=`<div class="place-photo">${photo?`<img src="${photo}" alt="${escapeHtml(p.name)} 的照片">`:''}<span class="photo-label">${escapeHtml(photoLabel(displayPhoto,p))}</span></div><span class="place-type">${escapeHtml(p.type)}</span><h3>${escapeHtml(p.name)}</h3><span class="place-date">${escapeHtml(p.city)} · ${dateText(p.date)}</span><p>${escapeHtml(p.intro)}</p>${citySwitch}<div class="panel-action"><button class="btn secondary tiny" data-action="open-place" data-id="${p.id}">翻开这段回忆 →</button></div>`;
      }
      function renderDayDetail(){
        const events=data.events.filter(e=>e.date===selectedCalendarDate).map(e=>({...e,event:true}));
        const places=data.places.filter(p=>p.date===selectedCalendarDate).map(p=>({id:p.id,title:p.name,type:p.type,description:p.intro,place:true}));
        const all=[...events,...places];
        $('#day-detail').innerHTML=`<div class="detail-day">${dateText(selectedCalendarDate)}</div><h2>${all.length?all.length===1?'晴天':'那些回不去的年少':'留给我们的空白'}</h2>${all.length?all.map(item=>`<article class="day-event"><span class="tag">${escapeHtml(item.type)}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description||'')}</p>${item.place?`<button class="link-btn" data-action="open-place" data-id="${item.id}">打开地点回忆 →</button>`:`<button class="link-btn" data-action="edit-event" data-id="${item.id}">编辑这个日子 →</button>`}</article>`).join(''):`<p class="empty-note">还没有记录。也许今天就值得写下第一件小事。</p><button class="btn rose tiny" data-action="open-add-event" data-date="${selectedCalendarDate}">添加重要日子</button>`}`;
      }
      function openPlace(id){
        const p=data.places.find(x=>x.id===id); if(!p)return; currentSlide=0;
        const media=[...(p.photos||[]).map(source=>({kind:'photo',source})),...(p.videos||[]).filter(isVideoMedia).map(source=>({kind:'video',source}))];
        if(!media.length) media.push({kind:'note',source:'新的回忆'});
        const slides=media.map((item,i)=>item.kind==='video'?`<div class="slide video-slide ${i===0?'active':''}"><video controls playsinline preload="metadata" src="${escapeHtml(item.source)}">你的浏览器暂不支持播放视频。</video></div>`:isImagePhoto(item.source)?`<div class="slide photo-real ${i===0?'active':''}" style="background-image:url(${item.source})"></div>`:`<div class="slide ${i===0?'active':''} ${['one','two','three'][i%3]}">${escapeHtml(item.source)}</div>`).join('');
        openModal(`<div class="modal-head"><div><p class="eyebrow">JAY CHOU · ${escapeHtml(p.type)} · ${dateText(p.date)}</p><h2 id="modal-title">${escapeHtml(p.name)}</h2></div><div class="inline-control"><button class="btn secondary tiny" data-action="edit-place" data-id="${p.id}">编辑</button><button class="close" data-action="close-modal" aria-label="关闭">×</button></div></div><div class="modal-place"><div class="gallery" id="gallery">${slides}<div class="gallery-nav"><button data-action="slide-prev" aria-label="上一张">‹</button><button data-action="slide-next" aria-label="下一张">›</button></div></div><div><p style="color:var(--muted);line-height:1.7">${escapeHtml(p.intro)}</p><div class="memory-sections"><section class="memory-section"><h3>《不能说的秘密》· 共同回忆</h3><p>${escapeHtml(p.shared||p.intro||'')}</p></section><section class="memory-section"><h3>《简单爱》· 她的喜好</h3><p>${escapeHtml(p.her||'')}</p></section><section class="memory-section"><h3>《晴天》· 我的喜好</h3><p>${escapeHtml(p.mine||'')}</p></section><section class="memory-section love"><h3>《开不了口》· 写给对方</h3><p>${escapeHtml(p.letter||'')}</p></section></div></div></div>`,true);
      }
      function openPlaceForm(existing=null){
        const p=existing||{}, labels=(p.photos||[]).filter(photo=>!isImagePhoto(photo)).join('，');
        openModal(`<div class="modal-head"><div><p class="eyebrow">JAY CHOU · 晴天</p><h2 id="modal-title">${existing?'再看一遍这片风景':'写下新的风景'}</h2></div><button class="close" data-action="close-modal" aria-label="关闭">×</button></div><form id="place-form" data-id="${p.id||''}"><div class="form-grid"><div class="field"><label>地点名称</label><input name="name" required maxlength="40" value="${escapeHtml(p.name||'')}" placeholder="例如：湖边咖啡馆"></div><div class="field"><label>城市</label><input name="city" required maxlength="20" value="${escapeHtml(p.city||'')}" placeholder="例如：北京"></div></div><div class="form-grid"><div class="field"><label>日期</label><input name="date" type="date" required value="${p.date||formatDate(new Date())}"></div><div class="field"><label>类型</label><select name="type"><option ${p.type==='日常'?'selected':''}>日常</option><option ${p.type==='第一次约会'?'selected':''}>第一次约会</option><option ${p.type==='旅行'?'selected':''}>旅行</option><option ${p.type==='纪念日'?'selected':''}>纪念日</option></select></div></div><div class="form-grid"><div class="field"><label>纬度</label><input name="lat" type="number" step="any" required value="${p.lat??''}" placeholder="39.9042"></div><div class="field"><label>经度</label><input name="lng" type="number" step="any" required value="${p.lng??''}" placeholder="116.4074"></div></div><p class="small-note">可在地图服务中长按/点击地点查看经纬度；接入高德地图后可换成地址搜索。</p><div class="field"><label>这一天发生了什么</label><textarea name="intro" required placeholder="这一天发生了什么？">${escapeHtml(p.intro||'')}</textarea></div><div class="field"><label>共同回忆</label><textarea name="shared" placeholder="一张照片、一个笑话，或一个舍不得忘记的片段">${escapeHtml(p.shared||'')}</textarea></div><div class="form-grid"><div class="field"><label>她的喜好</label><textarea name="her" placeholder="她喜欢的味道、风景或瞬间">${escapeHtml(p.her||'')}</textarea></div><div class="field"><label>我的喜好</label><textarea name="mine" placeholder="我记得的细节">${escapeHtml(p.mine||'')}</textarea></div></div><div class="field"><label>写给对方的话</label><textarea name="letter" placeholder="留一句只给对方看的话">${escapeHtml(p.letter||'')}</textarea></div><div class="field"><label>上传照片（可选，最多 3 张）</label><input name="photoFiles" type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple></div><p class="small-note">照片会保存到当前浏览器。建议每张不超过 900KB；也可以用下方文字暂代照片说明。</p><div class="field"><label>照片说明（用逗号分隔）</label><input name="photos" value="${escapeHtml(labels)}" placeholder="夕阳，牵手，咖啡"></div><div class="modal-actions">${existing?`<button type="button" class="btn danger" data-action="delete-place" data-id="${p.id}">删除地点</button>`:''}<button type="button" class="btn secondary" data-action="close-modal">取消</button><button type="submit" class="btn primary">${existing?'保存修改':'添加地点'}</button></div></form>`,true);
      }
      async function handleSubmit(e){
        if(!['event-form','place-form','letter-form','conversation-form','wish-form','capsule-form','password-form','unlock-form'].includes(e.target.id))return; e.preventDefault();
        if(e.target.id==='event-form'){ const f=new FormData(e.target), id=e.target.dataset.id, item={id:id||'e'+Date.now(),date:f.get('date'),type:f.get('type'),title:f.get('title').trim(),description:f.get('description').trim()}; if(id)data.events=data.events.map(x=>x.id===id?item:x);else data.events.push(item); selectedCalendarDate=item.date;calendarCursor=new Date(item.date+'T12:00:00');saveData();closeModal();showToast(id?'重要日子已更新':'重要日子已添加'); return; }
        if(e.target.id==='place-form'){ const f=new FormData(e.target), id=e.target.dataset.id, files=f.getAll('photoFiles').filter(file=>file && file.size); if(files.length>3||files.some(file=>file.size>900000)){alert('请上传最多 3 张、每张不超过 900KB 的照片。');return;} const uploaded=await Promise.all(files.map(readPhoto)); const prior=id?data.places.find(x=>x.id===id):null; const priorImages=(prior?.photos||[]).filter(isImagePhoto); const labels=f.get('photos').split(/[,，]/).map(x=>x.trim()).filter(Boolean); const item={id:id||'p'+Date.now(),name:f.get('name').trim(),city:f.get('city').trim(),date:f.get('date'),type:f.get('type'),lat:Number(f.get('lat')),lng:Number(f.get('lng')),intro:f.get('intro').trim(),shared:f.get('shared').trim(),her:f.get('her').trim(),mine:f.get('mine').trim(),letter:f.get('letter').trim(),photos:[...priorImages,...uploaded,...labels],photoCaptions:prior?.photoCaptions||{}}; if(id)data.places=data.places.map(x=>x.id===id?item:x);else data.places.push(item);activePlaceId=item.id;saveData();closeModal();showToast(id?'地点已更新':'新的地点已钉在地图上'); return; }
        if(e.target.id==='letter-form'){ const f=new FormData(e.target); data.letters.push({id:'l'+Date.now(),date:f.get('date'),to:f.get('to').trim(),title:f.get('title').trim(),body:f.get('body').trim(),from:f.get('from').trim()});saveData();closeModal();showToast('这封信已收好');return; }
        if(e.target.id==='conversation-form'){ const f=new FormData(e.target); data.conversations.push({id:'conversation-'+Date.now(),date:f.get('date'),title:f.get('title').trim(),status:f.get('status'),issue:f.get('issue').trim(),process:f.get('process').trim(),letterIds:f.getAll('letterIds'),resolution:f.get('resolution').trim()});saveData();closeModal();showToast('沟通记录已收好');return; }
        if(e.target.id==='wish-form'){ const f=new FormData(e.target), status=f.get('status')==='done'?'done':'todo', targetDate=f.get('targetDate')||''; data.wishes.push({id:'w'+Date.now(),title:f.get('title').trim(),category:f.get('category').trim(),note:f.get('note').trim(),targetDate,status,completedDate:status==='done'?(targetDate||formatDate(new Date())):''});saveData();closeModal();showToast('约定已记下');return; }
        if(e.target.id==='capsule-form'){ const f=new FormData(e.target); const file=f.get('photoFile'); const photo = file && file.size ? await readPhoto(file) : ''; data.timeCapsules.push({id:'c'+Date.now(),title:f.get('title').trim(),type:f.get('type').trim(),note:f.get('note').trim(),unlockDate:f.get('unlockDate'),photo});saveData();closeModal();showToast('胶囊已放好');return; }
        if(e.target.id==='password-form'){data.password=new FormData(e.target).get('password');saveData();closeModal();sessionStorage.removeItem('love-memories-unlocked');location.reload();return;}
        if(e.target.id==='unlock-form'){const candidate=$('#unlock-password').value;if(candidate===data.password){sessionStorage.setItem('love-memories-unlocked','yes');$('#lock-screen').classList.remove('show');$('#unlock-error').textContent='';}else $('#unlock-error').textContent='密码不正确，请再试一次。';}
      }
      document.addEventListener('click',e=>{ const button=e.target.closest('button'); if(!button)return; const action=button.dataset.action; if(action==='edit-event'){const event=data.events.find(x=>x.id===button.dataset.id);if(event)openEventForm(event);} if(action==='edit-place'){const place=data.places.find(x=>x.id===button.dataset.id);if(place)openPlaceForm(place);} if(action==='delete-place'&&confirm('确定删除这个地点和它的照片吗？')){data.places=data.places.filter(x=>x.id!==button.dataset.id);activePlaceId=data.places[0]?.id;saveData();closeModal();showToast('地点已删除');} });
      function boot(){ fillCities(); renderAll(); initMap(); updatePrivacy(); if(data.password&&sessionStorage.getItem('love-memories-unlocked')!=='yes') $('#lock-screen').classList.add('show'); }
      boot();
