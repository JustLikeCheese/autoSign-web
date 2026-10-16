'use strict';
const $ = id => document.getElementById(id);
const messages = {task_started:'开始执行 Bugku 签到任务',tests_passed:'离线测试通过',tests_failed:'离线测试未通过',login_success:'登录成功',checked_in:'签到成功',already_done:'今天已经签到，无需重复操作',captcha_retry:'验证码未通过，重新获取后重试',checkin_failed:'签到失败，请登录 GitHub 查看详情',checkin_skipped:'签到步骤未执行',network_failure:'请求超时或网络连接失败',captcha_failed:'验证码达到重试上限',task_finished:'本次执行结束'};
const stepNames = {python:'准备 Python 环境',dependencies:'安装运行依赖',tests:'运行离线测试',checkin:'登录并签到'};
const labels = {checked_in:'签到成功',already_done:'当日已签到',failed:'执行异常',unknown:'等待结果',skipped:'未执行'};
let data = {runs:[]}, filter = 'all', selectedId = null;
function date(value, options){return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Taipei',...options}).format(new Date(value));}
function el(tag,text,className){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(className)n.className=className;return n;}
function runLink(id){const owner=location.hostname.endsWith('.github.io')?location.hostname.slice(0,-'.github.io'.length):'';if(!owner)return 'https://github.com/';const base=`https://github.com/${owner}/autoSign/actions`;return /^\d+$/.test(String(id))?`${base}/runs/${id}`:base;}
function render(){
 const runs=data.runs||[], last=runs[0], recent=runs.slice(0,30), succeeded=recent.filter(r=>r.status==='success').length;
 $('run-count').replaceChildren(document.createTextNode(String(runs.length)),el('small','次'));
 $('record-count').textContent=String(runs.length);
 $('success-rate').replaceChildren(document.createTextNode(recent.length?String(Math.round(succeeded/recent.length*100)):'—'),el('small','%'));
 $('success-detail').textContent=recent.length?`${succeeded} 次成功 / ${recent.length} 次运行`:'还没有运行记录';
 $('duration').replaceChildren(document.createTextNode(last?String(Math.round(last.duration_seconds)):'—'),el('small','秒'));
 const now=new Date(), local=new Date(now.getTime()+8*3600000), next=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate(),0,17));if(next<=now)next.setUTCDate(next.getUTCDate()+1);
 $('next-run').textContent=`${date(next,{month:'2-digit',day:'2-digit'})} · 台北时间`;
 $('updated-at').textContent=data.updated_at?`最近同步 ${date(data.updated_at,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}`:'尚未同步运行数据';
 const hero=document.querySelector('.hero');hero.classList.toggle('failure',!!last&&last.status!=='success');
 $('hero-icon').textContent=last?(last.status==='success'?'✓':'!'):'◷';
 $('hero-title').textContent=last?(labels[last.result]||'运行已结束'):'等待首次运行';
 $('hero-description').textContent=last?(last.status==='success'?'最近一次签到任务已完成，继续专注你的挑战。':'这次运行需要关注，可展开记录查看步骤状态。'):'下一次签到完成后，记录会自动同步到这里。';
 $('hero-status').textContent=last?(last.status==='success'?'运行成功':'需要关注'):'等待同步';
 $('hero-time').textContent=last?date(last.finished_at,{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}):'每天 08:17 自动执行';
 $('latest-link').href=runLink(last?.id);
 const visible=runs.filter(r=>filter==='all'||(filter==='success'?r.status==='success':r.status!=='success'));
 const body=$('runs');body.replaceChildren();
 if(!visible.length){const row=el('tr'),cell=el('td',runs.length?'没有符合条件的记录':'尚无运行记录，等待首次同步','empty');cell.colSpan=6;row.append(cell);body.append(row);}
 for(const run of visible){const row=el('tr'), time=el('td',date(run.started_at,{year:'numeric',month:'2-digit',day:'2-digit'}));time.append(el('small',date(run.started_at,{hour:'2-digit',minute:'2-digit',second:'2-digit'})));const result=el('td');result.append(el('span',labels[run.result]||'执行结束',`result-badge ${run.status==='success'?'':'bad'}`));const trigger=el('td',run.trigger==='schedule'?'◷ 定时触发':'⌘ 手动触发','trigger'),duration=el('td',`${Math.round(run.duration_seconds)} 秒`),id=el('td',`#${run.id}`,'run-id'),action=el('td'),button=el('button','查看 →');button.type='button';button.setAttribute('aria-label',`查看运行 ${run.id} 的日志`);button.addEventListener('click',()=>showDetails(run.id));action.append(button);row.append(time,result,trigger,duration,id,action);body.append(row);}
 if(selectedId)showDetails(selectedId,false);
}
function showDetails(id,scroll=true){const run=data.runs.find(r=>r.id===id);if(!run)return;selectedId=id;$('details').hidden=false;$('detail-id').textContent=`#${run.id}`;$('detail-time').textContent=date(run.started_at,{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'});$('detail-link').href=runLink(run.id);$('steps').replaceChildren();for(const step of run.steps||[]){const n=el('div',undefined,'step');n.append(el('span',step.status==='success'?'✓':step.status==='skipped'?'—':'!',`step-icon ${step.status==='failure'?'bad':''}`),el('span',stepNames[step.name]||'执行步骤'),el('small',`${Math.round(step.duration_seconds)} 秒`));$('steps').append(n);}$('log-lines').replaceChildren();for(const log of run.logs||[]){if(!messages[log.code])continue;const n=el('div',undefined,log.level);n.append(el('span',log.level.toUpperCase()),document.createTextNode(messages[log.code]));$('log-lines').append(n);}if(scroll)$('details').scrollIntoView({behavior:'smooth',block:'nearest'});}
async function refresh(){const button=$('refresh');button.disabled=true;$('refresh-icon').classList.add('spin');try{const response=await fetch(`status.json?t=${Date.now()}`,{cache:'no-store',credentials:'omit'});if(!response.ok)throw new Error('fetch');const next=await response.json();if(next.schema_version!==1||!Array.isArray(next.runs))throw new Error('format');data=next;render();$('notice').hidden=true;}catch{$('notice').textContent='暂时无法获取最新记录。已加载的数据会保留，请稍后刷新。';$('notice').hidden=false;if(!data.runs.length){$('hero-title').textContent='暂时无法读取数据';$('hero-description').textContent='请稍后点击刷新，或前往 GitHub 查看运行状态。';$('runs').replaceChildren();const row=el('tr'),cell=el('td','数据读取失败','empty');cell.colSpan=6;row.append(cell);$('runs').append(row);}}finally{button.disabled=false;$('refresh-icon').classList.remove('spin');}}
document.querySelector('[data-actions]').href=runLink();
$('refresh').addEventListener('click',refresh);
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('selected',b===button));render();}));
$('close-details').addEventListener('click',()=>{$('details').hidden=true;selectedId=null;});
refresh();setInterval(()=>{if(!document.hidden)refresh();},60000);
