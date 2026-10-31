const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');
const defaultBank = require('./question-bank');
const bankPath = path.join(__dirname, 'question-bank.json');
let bank = fs.existsSync(bankPath) ? JSON.parse(fs.readFileSync(bankPath, 'utf8')) : defaultBank;
const hostPassword = process.env.HOST_PASSWORD || crypto.randomBytes(9).toString('base64url');
const hostSessions = new Map();
if (!process.env.HOST_PASSWORD) console.log(`Host access password (keep private): ${hostPassword}`);

function sessionFromCookie(cookieHeader = '') {
  const token = cookieHeader.split(';').map(v=>v.trim()).find(v=>v.startsWith('quizlab_host='))?.slice('quizlab_host='.length);
  const expiry = token && hostSessions.get(token);
  if (!expiry || expiry < Date.now()) { if(token)hostSessions.delete(token); return null; }
  return token;
}
function isHostRequest(req) { return Boolean(sessionFromCookie(req.headers.cookie)); }
function isHostSocket(socket) { return Boolean(sessionFromCookie(socket.request.headers.cookie)); }

const port = Number(process.env.PORT || 3000);
const root = __dirname;
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname);
  if (pathname === '/health') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"ok":true}'); }
  if (pathname === '/api/host-login' && req.method === 'POST') {
    let body=''; req.on('data',chunk=>{body+=chunk;if(body.length>4096)req.destroy()});
    req.on('end',()=>{
      let password=''; try { password=String(JSON.parse(body).password||''); } catch {}
      const sent=Buffer.from(password), expected=Buffer.from(hostPassword);
      if(sent.length!==expected.length || !crypto.timingSafeEqual(sent,expected)) { res.writeHead(401,{'Content-Type':'application/json'});return res.end('{"error":"Mật khẩu host chưa đúng."}'); }
      const token=crypto.randomBytes(32).toString('hex');hostSessions.set(token,Date.now()+12*60*60*1000);
      const secure=(req.headers['x-forwarded-proto']==='https');
      res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':`quizlab_host=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure?'; Secure':''}`});res.end('{"ok":true}');
    }); return;
  }
  if (pathname === '/api/host-logout' && req.method === 'POST') {
    const token=sessionFromCookie(req.headers.cookie);if(token)hostSessions.delete(token);
    res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':'quizlab_host=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0'});return res.end('{"ok":true}');
  }
  if ((pathname === '/host.html' || pathname === '/host.js') && !isHostRequest(req)) { res.writeHead(302,{Location:'/host-login.html'});return res.end(); }
  if (['/server.js', '/question-bank.js', '/question-bank.json'].includes(pathname)) { res.writeHead(404); return res.end('Not found'); }
  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const file = path.resolve(root, `.${requestPath}`);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404); return res.end('Not found');
  }
  const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8' };
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});
const io = new Server(server, { cors: { origin: true }, maxHttpBufferSize: 1e5 });
const rooms = new Map();
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const cleanName = value => String(value || '').trim().replace(/[<>]/g, '').slice(0, 22);
const publicQuestion = (room, socketId) => {
  const q = room.questions[room.index];
  if (!q) return null;
  return { title: room.title, icon: room.icon, index: room.index, total: room.questions.length, text: q.q, answers: q.a, timeLimit: 25, endsAt: room.endsAt, answered: room.answered.has(socketId) };
};
function rankings(room) {
  return [...room.players.values()].sort((a,b) => b.score-a.score || b.correct-a.correct || a.joinOrder-b.joinOrder)
    .map((p,i) => ({ id:p.id, name:p.name, score:p.score, correct:p.correct, answered:room.answered.has(p.id), rank:i+1 }));
}
function broadcastRoom(room) {
  const players = rankings(room);
  io.to(room.code).emit('room:update', { code:room.code, title:room.title, state:room.state, hostName:room.hostName, players, index:room.index, total:room.questions.length, answersReceived:room.answered.size });
}
function stopTimer(room) { if (room.timer) clearTimeout(room.timer); room.timer = null; }
function advance(room) {
  if (room.state !== 'playing') return;
  stopTimer(room);
  room.index++;
  room.answered.clear();
  if (room.index >= room.questions.length) {
    room.state = 'finished';
    broadcastRoom(room);
    io.to(room.code).emit('game:finished', { rankings:rankings(room), title:room.title });
    return;
  }
  broadcastRoom(room);
  room.questionStartedAt = Date.now();
  room.endsAt = room.questionStartedAt + 25000;
  for (const socketId of [...room.players.keys(), room.hostId]) io.to(socketId).emit('question:show', publicQuestion(room, socketId));
  room.timer = setTimeout(() => advance(room), 25000);
}
io.on('connection', socket => {
  socket.data.hostAuthenticated=isHostSocket(socket);
  socket.emit('server:ready', { now:Date.now() });
  socket.on('server:time', ({ sentAt } = {}, ack = () => {}) => ack({ now:Date.now(), sentAt }));
  socket.on('bank:get', (ack = () => {}) => { if(!socket.data.hostAuthenticated)return ack({error:'Cần đăng nhập bằng mật khẩu host.'});ack({ bank }); });
  socket.on('bank:update', (incoming, ack = () => {}) => {
    try {
      if(!socket.data.hostAuthenticated) throw new Error('Cần đăng nhập bằng mật khẩu host.');
      if (!incoming || typeof incoming !== 'object' || Object.keys(incoming).length < 1 || Object.keys(incoming).length > 12) throw new Error('Bộ câu hỏi không hợp lệ.');
      const updated = {};
      for (const [id, set] of Object.entries(incoming)) {
        if (!/^[a-z0-9_-]{1,30}$/.test(id) || !set || typeof set.title !== 'string' || !Array.isArray(set.questions) || set.questions.length < 1 || set.questions.length > 100) throw new Error('Mỗi bộ câu hỏi cần có ít nhất một câu.');
        const questions = set.questions.map(q => {
          if (!q || typeof q.q !== 'string' || !q.q.trim() || q.q.length > 500 || !Array.isArray(q.a) || q.a.length !== 4 || q.a.some(a => typeof a !== 'string' || !a.trim() || a.length > 300) || !Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3) throw new Error('Mỗi câu cần nội dung, đủ 4 đáp án và đáp án đúng.');
          return { q:q.q.trim(), a:q.a.map(a=>a.trim()), correct:q.correct };
        });
        updated[id] = { title:set.title.trim().slice(0,80), icon:String(set.icon||'✦').slice(0,8), questions };
      }
      fs.writeFileSync(bankPath, JSON.stringify(updated, null, 2), 'utf8');
      bank = updated;
      for (const room of rooms.values()) if (room.state === 'waiting' && room.quizId) {
        const sets = room.quizId === 'all' ? Object.values(bank) : (bank[room.quizId] ? [bank[room.quizId]] : []);
        if (sets.length) { room.questions = sets.flatMap(set=>set.questions.map(q=>({...q}))); room.title = room.quizId === 'all' ? 'Tất cả chủ đề' : sets[0].title; }
      }
      ack({ ok:true, bank });
    } catch (error) { ack({ error:error.message || 'Không thể lưu bộ câu hỏi.' }); }
  });
  socket.on('room:create', ({ name, quizId } = {}, ack = () => {}) => {
    if(!socket.data.hostAuthenticated)return ack({error:'Cần đăng nhập bằng mật khẩu host.'});
    name = cleanName(name);
    if (!name) return ack({ error:'Nhập tên của bạn trước khi tạo phòng.' });
    const selected = quizId === 'all' ? Object.values(bank) : [bank[bank[quizId] ? quizId : Object.keys(bank)[0]]];
    const questions = selected.flatMap(set => set.questions.map(q => ({ ...q })));
    let code;
    do { code = Array.from({length:6}, () => alphabet[Math.floor(Math.random()*alphabet.length)]).join(''); } while (rooms.has(code));
    const room = { code, hostId:socket.id, hostName:name, quizId, title:selected.length===1?selected[0].title:'Tất cả chủ đề', icon:selected.length===1?selected[0].icon:'✳', questions, players:new Map(), state:'waiting', index:-1, answered:new Set(), joinOrder:0, timer:null };
    rooms.set(code, room);
    socket.join(code); socket.data.roomCode=code; socket.data.role='host';
    ack({ ok:true, code, title:room.title, players:[] });
    broadcastRoom(room);
  });
  socket.on('room:join', ({ code, name } = {}, ack = () => {}) => {
    code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6); name=cleanName(name);
    const room=rooms.get(code);
    if (!name) return ack({error:'Nhập tên hiển thị trước khi vào phòng.'});
    if (!room) return ack({error:'Không tìm thấy phòng. Kiểm tra lại mã hoặc link mời nhé.'});
    if (room.state !== 'waiting') return ack({error:'Quiz đã bắt đầu rồi. Hãy xin host mở phòng mới.'});
    const player={id:socket.id,name,score:0,correct:0,joinOrder:room.joinOrder++};
    room.players.set(socket.id,player); socket.join(code); socket.data.roomCode=code; socket.data.role='player';
    ack({ok:true,code,title:room.title,role:'player'}); broadcastRoom(room);
  });
  socket.on('game:start', () => {
    const room=rooms.get(socket.data.roomCode);
    if (!socket.data.hostAuthenticated || !room || room.hostId!==socket.id || room.state!=='waiting') return;
    room.state='playing'; room.index=-1; advance(room);
  });
  socket.on('answer:submit', ({ choice } = {}, ack = () => {}) => {
    const room=rooms.get(socket.data.roomCode), player=room?.players.get(socket.id);
    if (!room || !player || room.state!=='playing') return ack({error:'Lượt chơi hiện không nhận câu trả lời.'});
    if (room.answered.has(socket.id)) return ack({error:'Bạn đã trả lời câu này rồi.'});
    const q=room.questions[room.index];
    if (!Number.isInteger(choice) || choice<0 || choice>=q.a.length) return ack({error:'Đáp án không hợp lệ.'});
    room.answered.add(socket.id);
    const correct=choice===q.correct;
    const elapsed=Date.now()-room.questionStartedAt;
    const points=correct?100+Math.max(0,Math.floor((25000-elapsed)/1000)*2):0;
    if(correct){player.score+=points;player.correct++;}
    ack({ok:true,correct,correctIndex:q.correct,points,explanation:q.note||''});
    broadcastRoom(room);
  });
  socket.on('game:next', () => { const room=rooms.get(socket.data.roomCode); if(socket.data.hostAuthenticated && room && room.hostId===socket.id) advance(room); });
  socket.on('room:close', (ack = () => {}) => {
    const code=socket.data.roomCode, room=rooms.get(code);
    if(!socket.data.hostAuthenticated || !room || room.hostId!==socket.id) return ack({error:'Chỉ host đã đăng nhập mới có thể đóng phòng.'});
    stopTimer(room); io.to(code).emit('room:closed'); rooms.delete(code); socket.data.roomCode=null; ack({ok:true});
  });
  socket.on('disconnect', () => {
    const code=socket.data.roomCode, room=rooms.get(code); if(!room) return;
    if(room.hostId===socket.id){stopTimer(room);io.to(code).emit('room:closed');rooms.delete(code);return;}
    room.players.delete(socket.id);room.answered.delete(socket.id);broadcastRoom(room);
  });
});
server.listen(port, '0.0.0.0', () => console.log(`QuizLab Live listening on ${port}`));
