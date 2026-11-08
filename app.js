const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const params=new URLSearchParams(location.search), serverAvailable=typeof io==='function';
const socket=serverAvailable?io():{on(){},emit(event,payload,ack){if(ack)ack({error:'Máy chủ quiz chưa chạy. Hãy cài Node.js rồi mở start-quizlab.bat.'})}};
let roomCode='',currentQuestion=null,selectedChoice=null,answerResult=null,timerHandle=null,toastHandle=null,serverOffset=0;
const storedName=localStorage.getItem('quizlabLiveName')||'';
$('#playerName').value=storedName;$('#headerAvatar').textContent=storedName?storedName[0].toUpperCase():'?';
if(params.get('room'))$('#roomCode').value=params.get('room').toUpperCase().slice(0,6);
function showToast(message){const el=$('#toast');el.textContent=message;el.classList.add('visible');clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('visible'),3200)}
function setServer(ready){$('#serverDot').classList.toggle('online',ready);$('#serverLabel').textContent=ready?'Máy chủ đang hoạt động':'Mất kết nối máy chủ'}
if(!serverAvailable){$('#serverLabel').textContent='Cần chạy start-quizlab.bat';$('#serverDot').classList.remove('online');$('#homeMessage').textContent='Để vào phòng trực tiếp, hãy khởi chạy máy chủ QuizLab trước.'}
function setScreen(name){$('#homeScreen').classList.toggle('hidden',name!=='home');$('#roomScreen').classList.toggle('hidden',name!=='room');window.scrollTo({top:0,behavior:'smooth'})}
function displayName(){const name=$('#playerName').value.trim().replace(/[<>]/g,'').slice(0,22);if(!name){$('#playerName').focus();showToast('Nhập tên hiển thị trước nhé.');return''}$('#playerName').value=name;localStorage.setItem('quizlabLiveName',name);$('#headerAvatar').textContent=name[0].toUpperCase();return name}
function enterRoom(ack){roomCode=ack.code;history.replaceState({},'',`${location.pathname}?room=${ack.code}`);$('#roomTitle').textContent=ack.title||'Phòng chơi';$('#displayRoomCode').textContent=ack.code;$('#roomSubtitle').textContent='Bạn đã vào phòng. Chờ host bắt đầu quiz nhé!';$('#waitingPanel').classList.remove('hidden');$('#questionPanel').classList.add('hidden');$('#resultPanel').classList.add('hidden');$('#roomStatus').textContent='PHÒNG CHỜ';setScreen('room')}
function joinRoom(){const name=displayName();if(!name)return;const code=$('#roomCode').value.trim().toUpperCase();if(code.length!==6){$('#homeMessage').textContent='Mã phòng gồm 6 ký tự.';return}$('#homeMessage').textContent='Đang tìm phòng…';socket.emit('room:join',{name,code},ack=>{ $('#homeMessage').textContent='';if(ack?.error){showToast(ack.error);return}enterRoom(ack)})}
$('#joinRoom').addEventListener('click',joinRoom);$('#roomCode').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6));$('#roomCode').addEventListener('keydown',e=>{if(e.key==='Enter')joinRoom()});
$('#leaveRoom').addEventListener('click',()=>{roomCode='';currentQuestion=null;clearInterval(timerHandle);setScreen('home');history.replaceState({},'',location.pathname)});
socket.on('connect',()=>{setServer(true);const sentAt=Date.now();socket.emit('server:time',{sentAt},reply=>{if(reply)serverOffset=reply.now-(sentAt+(Date.now()-sentAt)/2)});const code=params.get('room');if(code&&storedName&&!roomCode){socket.emit('room:join',{code,name:storedName},ack=>{if(ack?.error)showToast(ack.error);else enterRoom(ack)})}});
socket.on('disconnect',()=>setServer(false));socket.on('connect_error',()=>setServer(false));socket.on('server:ready',()=>setServer(true));
socket.on('room:update',data=>{if(roomCode&&data.code!==roomCode)return;if(!roomCode)roomCode=data.code;$('#roomTitle').textContent=data.title;$('#displayRoomCode').textContent=data.code;$('#playerCount').textContent=data.players.length;$('#playersEmpty').classList.toggle('hidden',data.players.length>0);$('#scoreboard').innerHTML=data.players.map(p=>`<div class="score-row ${p.id===socket.id?'is-you':''}"><span class="score-rank">${p.rank<4?['🥇','🥈','🥉'][p.rank-1]:String(p.rank).padStart(2,'0')}</span><span class="score-avatar">${escapeHtml(p.name[0].toUpperCase())}</span><span class="score-name"><strong>${escapeHtml(p.name)}${p.id===socket.id?' <i>BẠN</i>':''}</strong><small>${p.correct} câu đúng${data.state==='playing'?(p.answered?' · Đã trả lời':' · Đang chơi'):''}</small></span><b class="score-total">${p.score.toLocaleString('vi-VN')}<small>điểm</small></b></div>`).join('');if(data.state==='playing'){$('#roomStatus').textContent='ĐANG DIỄN RA';$('#waitingPanel').classList.add('hidden');$('#playersTitle').innerHTML=`Bảng xếp hạng <b>${data.players.length}</b>`}if(data.state==='finished')$('#roomStatus').textContent='ĐÃ KẾT THÚC'});
socket.on('question:show',q=>{currentQuestion=q;renderQuestion(q)});
function renderQuestion(q){
  clearInterval(timerHandle);selectedChoice=null;answerResult=null;
  $('#questionPanel').classList.remove('hidden');$('#waitingPanel').classList.add('hidden');$('#resultPanel').classList.add('hidden');
  const options=q.answers.map((answer,i)=>`<button class="live-answer" data-choice="${i}"><span>${String.fromCharCode(65+i)}</span>${escapeHtml(answer)}</button>`).join('');
  const image=q.image?`<img class="question-image" src="${escapeHtml(q.image)}" alt="${escapeHtml(q.imageAlt||q.text)}" loading="eager" onerror="this.hidden=true">`:'';
  $('#questionPanel').innerHTML=`<div class="question-meta"><span>CÂU ${q.index+1} / ${q.total}</span><span id="timerBadge" class="timer-badge">10 giây</span></div><div class="question-progress"><i style="width:${q.index/q.total*100}%"></i></div><p class="eyebrow">${escapeHtml(q.title)}</p><h2 class="live-question">${escapeHtml(q.text)}</h2>${image}<div class="live-answers">${options}</div><div class="question-bottom"><span id="answerFeedback">${q.answered?'Bạn đã trả lời câu này.':'Chọn đáp án của bạn'}</span><b>Đáp án hiện khi hết giờ</b></div>`;
  if(q.answered)disableChoices();
  $$('[data-choice]').forEach(button=>button.addEventListener('click',()=>{
    const chosen=Number(button.dataset.choice);selectedChoice=chosen;disableChoices();button.classList.add('chosen-answer');
    socket.emit('answer:submit',{choice:chosen},result=>{if(!result?.ok){$('#answerFeedback').textContent=result?.error||'Không gửi được câu trả lời.';return}answerResult=result;$('#answerFeedback').textContent='Đã ghi nhận. Đáp án sẽ hiện khi hết giờ.'});
  }));
  updateClock(q);
}
socket.on('question:reveal',data=>{
  if(!currentQuestion||data.index!==currentQuestion.index)return;
  if(selectedChoice!==null)$$('[data-choice]').forEach((button,i)=>{if(i===data.correctIndex)button.classList.add('right-answer');if(i===selectedChoice&&i!==data.correctIndex)button.classList.add('wrong-answer')});
  disableChoices();const feedback=$('#answerFeedback');if(!feedback)return;
  if(answerResult)feedback.textContent=answerResult.correct?`Chính xác! +${answerResult.points} điểm`:'Chưa chính xác.';
  else if(selectedChoice!==null)feedback.textContent=selectedChoice===data.correctIndex?'Chính xác!':'Chưa chính xác.';
  else feedback.textContent='Hết giờ! Bạn chưa chọn đáp án.';
  if(data.explanation)feedback.textContent+=` ${data.explanation}`;
});
function updateClock(q){const badge=$('#timerBadge');if(!badge)return;const tick=()=>{const seconds=Math.max(0,Math.ceil((q.endsAt-(Date.now()+serverOffset))/1000));badge.textContent=`${seconds} giây`;if(seconds<=5)badge.classList.add('timer-low');if(seconds<=0)clearInterval(timerHandle)};tick();timerHandle=setInterval(tick,150)}
function disableChoices(){$$('[data-choice]').forEach(b=>b.disabled=true)}
socket.on('game:finished',data=>{clearInterval(timerHandle);currentQuestion=null;$('#questionPanel').classList.add('hidden');$('#resultPanel').classList.remove('hidden');const mine=data.rankings.find(p=>p.id===socket.id);$('#resultPanel').innerHTML=`<div class="finish-card"><div class="finish-trophy">🏆</div><p class="eyebrow">${escapeHtml(data.title)}</p><h2>${mine?`Bạn xếp hạng #${mine.rank}!`:'Quiz đã kết thúc!'}</h2><p>Bạn đạt ${mine?mine.score:0} điểm và trả lời đúng ${mine?mine.correct:0} câu. Bảng xếp hạng cuối cùng ở bên cạnh.</p><button class="live-button primary-button" id="backFromResults">Về trang chủ <span>→</span></button></div>`;$('#backFromResults').onclick=()=>{roomCode='';setScreen('home');history.replaceState({},'',location.pathname)}});
socket.on('room:closed',()=>{clearInterval(timerHandle);roomCode='';currentQuestion=null;setScreen('home');showToast('Host đã đóng phòng chơi.')});
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
