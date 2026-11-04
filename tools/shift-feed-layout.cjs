const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path'),http=require('node:http'),fs=require('node:fs');
(async()=>{
  const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const head=html.slice(0,html.indexOf('<body>')),shift=html.slice(html.indexOf('<div id="tab-shift"'),html.indexOf('<!-- 3. ВКЛАДКА: Колы'));
  const server=http.createServer((req,res)=>{
    if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(head+'<body><header style="height:100px;flex:none"></header>'+shift+'</body></html>');}
    if(!/^\/[\w-]+\.css$/.test(req.url)){res.statusCode=404;return res.end();}res.setHeader('Content-Type','text/css');fs.createReadStream(path.join(root,req.url.slice(1))).pipe(res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try{
    browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    for(const [width,height] of [[1784,850],[950,620],[640,460]]){
      const page=await browser.newPage({viewport:{width,height}});await page.goto('http://127.0.0.1:'+server.address().port);
      await page.evaluate(()=>{
        const tab=document.querySelector('#tab-shift');tab.classList.add('active','orbital-shift');tab.style.display='';tab.children[0].classList.add('orbit-card');
        document.querySelector('#counterBox').hidden=true;
        const panel=document.createElement('section');panel.id='teamLogFeed';panel.className='team-log-feed card';panel.innerHTML='<h3>Живая лента команды</h3><div id="teamLogList"></div>';tab.insertBefore(panel,tab.children[1]);
      });
      for(const count of [0,3,60]){
        const data=await page.evaluate(count=>{
          const tab=document.getElementById('tab-shift'),panel=document.getElementById('teamLogFeed'),list=document.getElementById('teamLogList');
          list.replaceChildren();for(let i=0;i<count;i++){const entry=document.createElement('article');entry.className='team-log-entry';entry.innerHTML='<strong>Сотрудник</strong><small>14:30</small><p>Описание лога</p>';const a=document.createElement('a');a.textContent='https://example.test/'+'x'.repeat(580);entry.append(a);list.append(entry);}
          const byId=id=>document.getElementById(id).closest('.card').getBoundingClientRect();
          return {bottom:panel.getBoundingClientRect().bottom,top:Math.min(byId('sendOvertimeBtn').top,byId('resetShiftBtn').top),scroll:list.scrollHeight>list.clientHeight,wide:tab.scrollWidth-tab.clientWidth};
        },count);
        console.log(width,height,count,data);
        assert(data.top>=data.bottom+1,'following cards overlap the feed');assert(data.wide<=2,'long link widens the tab');
        if(count===60)assert(data.scroll,'many entries scroll inside the list');
      }
      await page.close();
    }
  }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
