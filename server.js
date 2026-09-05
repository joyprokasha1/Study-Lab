const express=require('express'); const session=require('express-session'); const multer=require('multer'); const path=require('path'); const fs=require('fs'); const Database=require('better-sqlite3');

const app=express(), PORT=process.env.PORT||3000; const root=__dirname; fs.mkdirSync(path.join(root,'uploads'),{recursive:true});

const db=new Database(path.join(root,'study-lab.db'));

db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, role TEXT); CREATE TABLE IF NOT EXISTS subjects(id INTEGER PRIMARY KEY, name TEXT UNIQUE); CREATE TABLE IF NOT EXISTS announcements(id INTEGER PRIMARY KEY, subject_id INTEGER,title TEXT,body TEXT,created_at TEXT); CREATE TABLE IF NOT EXISTS materials(id INTEGER PRIMARY KEY,subject_id INTEGER,title TEXT,type TEXT,url TEXT,created_at TEXT);`);

const adminUser=db.prepare('SELECT * FROM users WHERE username=?').get('admin'); 
if(!adminUser) db.prepare('INSERT INTO users(username,password,role) VALUES(?,?,?)').run('admin','studylab2026','admin');

['Electrical Circuit Theory','Electrical Circuit Lab','Physics 2 Theory','Physics 2 Lab','Data Structure Theory','Data Structure Lab'].forEach(n=>db.prepare('INSERT OR IGNORE INTO subjects(name) VALUES(?)').run(n));

app.use(express.json()); 
app.use(express.urlencoded({extended:true})); 
app.use(session({secret:process.env.SESSION_SECRET||'study-lab-change-me',resave:false,saveUninitialized:false,cookie:{httpOnly:true}})); 
app.use('/uploads',express.static(path.join(root,'uploads'))); 
app.use(express.static(path.join(root,'public')));

function auth(req,res,next){if(!req.session.user)return res.status(401).json({error:'Login required'});next()} 
function admin(req,res,next){if(!req.session.user||req.session.user.role!=='admin')return res.status(403).json({error:'Admin only'});next()}

app.post('/api/login',(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE username=? AND password=?').get(req.body.username,req.body.password); if(!u)return res.status(401).json({error:'Invalid login'}); req.session.user={username:u.username,role:u.role};res.json(req.session.user)});

app.post('/api/logout',(req,res)=>req.session.destroy(()=>res.json({ok:true})));

app.get('/api/me',(req,res)=>res.json(req.session.user||null));

app.get('/api/subjects',(req,res)=>res.json(db.prepare('SELECT * FROM subjects ORDER BY id').all()));

app.get('/api/announcements',auth,(req,res)=>res.json(db.prepare('SELECT a.*,s.name subject FROM announcements a JOIN subjects s ON s.id=a.subject_id ORDER BY a.id DESC').all()));

app.get('/api/materials',auth,(req,res)=>res.json(db.prepare('SELECT m.*,s.name subject FROM materials m JOIN subjects s ON s.id=m.subject_id ORDER BY m.id DESC').all()));

app.post('/api/announcements',admin,(req,res)=>{db.prepare('INSERT INTO announcements(subject_id,title,body,created_at) VALUES(?,?,?,datetime(\'now\'))').run(req.body.subject_id,req.body.title,req.body.body);res.json({ok:true})});

const upload=multer({dest:path.join(root,'uploads')}); 

app.post('/api/materials',admin,upload.single('file'),(req,res)=>{let url=req.body.url||'';if(req.file)url='/uploads/'+req.file.filename;db.prepare('INSERT INTO materials(subject_id,title,type,url,created_at) VALUES(?,?,?,?,datetime(\'now\'))').run(req.body.subject_id,req.body.title,req.body.type||'PDF',url);res.json({ok:true})});

app.delete('/api/announcements/:id',admin,(req,res)=>{db.prepare('DELETE FROM announcements WHERE id=?').run(req.params.id);res.json({ok:true})}); 

app.delete('/api/materials/:id',admin,(req,res)=>{db.prepare('DELETE FROM materials WHERE id=?').run(req.params.id);res.json({ok:true})});

app.listen(PORT,()=>console.log(`Study Lab running on http://localhost:${PORT}`));
