var PORT = 8000; //Set port for the app
var fs = require("fs-extra");
var sprintf = require('sprintf-js').sprintf,
    vsprintf = require('sprintf-js').vsprintf
var Image = require('canvas').Image;
const FileSet = require('file-set');
var express = require('express');
var formidable = require('formidable'); //form upload processing
var s_whiteboard = require("./s_whiteboard.js");
var whiteboard = require(__dirname + "/public/js/whiteboard.js");
var dateFormat = require('dateformat');

var app = express();
// app.use(express.static(__dirname + '/public'));
var server = require('http').Server(app);
var io = require('socket.io')(server);
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var morgan = require('morgan');
var User = require('./models/user');

var fsbase = require('fs');
var util = require('util');
var log_file = fsbase.createWriteStream(__dirname + '/debug.log', {flags : 'w'});
var log_stdout = process.stdout;
var multer = require("multer");
var path = require("path");
var unzip = require("unzip");
var ree = /(?<=page_)\d+(?=\.)/g


console.log = function(d) { //
  log_file.write(util.format(d) + '\n');
  log_stdout.write(util.format(d) + '\n');
};

// ====================================================================================================
// initiate empty json 
// XXXD for data
// xxxR for raw
var slidesJsonD = {};
var slidesJsonD_ori = {};

function getLocalImageSize(fname, callback){
    var img = new Image();
    img.onload = function() {
      var result = {"width":img.width,"height":img.height};
      console.log(result);
      callback(result);
    }
    img.src = fname;
}

app.get('/uploadslides', function(req, res) {
    res.render(__dirname+'/public/uploadzip.ejs')
})

app.post('/uploadslides', function(req, res) {
    var upload = multer({
        storage: multer.memoryStorage()
    }).single('userFile')
    upload(req, res, function(err) {
        var now = new Date();
        var datestr = dateFormat(now, "yyyymmdd");
        var buffer = req.file.buffer
        // var filename = req.file.fieldname + '-' + Date.now() + path.extname(req.file.originalname)
        var filename = __dirname + '/public/uploads/slides/' + "YangMing" + datestr
        fs.writeFile(filename + path.extname(req.file.originalname), buffer, 'binary', function(err) {
            if (err) throw err
            if (!fs.existsSync(filename)){
                fs.mkdirSync(filename);
            }
            try {
                fs.createReadStream(filename + path.extname(req.file.originalname)).pipe(unzip.Extract({ path:filename }));
            } catch (e) {
                console.log(e)
            }
            // res.end('File is uploaded')
            res.redirect('/dashboard');
        })

    })
})


app.get('/loadwhiteboard', function(req, res) {
    var wid = req["query"]["wid"];
    var version = req["query"]["version"];
    console.log("----------------------");
    var slides_dir = sprintf("public/uploads/slides/%s/slides/",wid);
    fnamev = sprintf("./public/uploads/slides/%s/slides_autosave_%s.json",wid,version)
    fnamebare = sprintf("./public/uploads/slides/%s/slides.json",wid)
    var session_exists = false
    var pages_n = 0
    var page_number = 0
    if(wid in slidesJsonD){
        session_exists = true
    } else {

        slidesJsonD[wid] = {};
        slidesJsonD_ori[wid] = {};

        var img_files = new FileSet([slides_dir+'*.jpg',slides_dir+'*.png'])['files'].sort();
        console.log(img_files);

        if(img_files.length > 0){
            for (i = 0; i < img_files.length; i++) {
                var fname = img_files[i];
                console.log("Now working on:" + fname)
                var pageJsonD = [];
                getLocalImageSize(fname, function(result){
                    var width = result["width"];
                    var height = result["height"];
                    var new_width = width;
                    var new_height = height;
                    if (new_width > 1200) {
                        new_width = 1200
                        new_height = parseInt(height*1200/width)
                    }
                    pageJsonD = ([{
                        "t":"addImgBG",
                        "draw":"0",
                        "url":fname.replace(/^public\//g,""),
                        "d":[new_width,new_height,50,50]
                    }])
                    console.log(pageJsonD)
                    slidesJsonD[wid][i.toString()] = pageJsonD;
                    slidesJsonD_ori[wid][i.toString()] = pageJsonD;
                });
            }
        }

    }
    pages_n = Object.keys(slidesJsonD[wid]).length
    console.log(pages_n+" pages in the slides");

    var data = s_whiteboard.loadStoredData(wid);
    try{
        var cur_img_url = data[0]['url']
        console.log(cur_img_url)
        page_number = Number(cur_img_url.match(ree)[0])
        console.log("Retrieve page number " + page_number)
    } catch(err){
        console.log("Cannot find url in the original data, probably not exist")
    }
    var req_data = {
        "session_exists": session_exists,
        "pages_n": pages_n,
        "page_number": page_number,
        "data": data
    }
    res.send(req_data);
    res.end();
});

app.post('/whiteboard/upload', function(req, res) { //File upload
    var form = new formidable.IncomingForm(); //Receive form
    var formData = {
        files : {},
        fields : {}
    }

    form.on('file', function(name, file) {
        formData["files"][file.name] = file;      
    });

    form.on('field', function(name, value) {
        formData["fields"][name] = value;
    });

    form.on('error', function(err) {
      console.log('File uplaod Error!');
    });

    form.on('end', function() {
        progressUploadFormData(formData);
        res.send("done");
        //End file upload
    });
    form.parse(req);
}); 


app.post('/whiteboard/refreshslides', function(req, res) { //File upload
    console.log("In refreshslides");
    var form = new formidable.IncomingForm(); //Receive form
    var formData = {
        files : {},
        fields : {}
    }

    form.on('field', function(name, value) {
        formData["fields"][name] = value;
    });

    form.on('end', function() {
        var wid = formData['fields']['wid']
        var slides_dir = sprintf("public/uploads/slides/%s/slides/",wid);
        var pages_n = 0
        var page_number = 0

        slidesJsonD[wid] = {};
        slidesJsonD_ori[wid] = {};

        var img_files = new FileSet([slides_dir+'*.jpg',slides_dir+'*.png'])['files'].sort();
        console.log(img_files);

        if(img_files.length > 0){
            for (i = 0; i < img_files.length; i++) {
                var fname = img_files[i];
                console.log("Now working on:" + fname)
                var pageJsonD = [];
                getLocalImageSize(fname, function(result){
                    var width = result["width"];
                    var height = result["height"];
                    var new_width = width;
                    var new_height = height;
                    if (new_width > 1200) {
                        new_width = 1200
                        new_height = parseInt(height*1200/width)
                    }
                    pageJsonD = ([{
                        "t":"addImgBG",
                        "draw":"0",
                        "url":fname.replace(/^public\//g,""),
                        "d":[new_width,new_height,50,50]
                    }])
                    console.log(pageJsonD)
                    slidesJsonD[wid][i.toString()] = pageJsonD;
                    slidesJsonD_ori[wid][i.toString()] = pageJsonD;
                });
            }
        }

        pages_n = Object.keys(slidesJsonD[wid]).length

        var req_data = {
            "pages_n": pages_n,
            "page_number": page_number,
        }
        res.send(req_data);
    });
    form.parse(req);
}); 


app.post('/whiteboard/turn', function(req, res) { //File upload
    console.log("In turn page")
    var form = new formidable.IncomingForm(); //Receive form
    // console.log("In turn page")
    var formData = {
        files : {},
        fields : {}
    };
    form.on('field', function(name, value) {
        formData["fields"][name] = value;
    });

    form.on('end', function() {
        var page_number = formData['fields']['page_number']
        var page_number_save = formData['fields']['page_number_save']
        var wid = formData['fields']['wid']
        var page_data = formData['fields']['page_data']
        try{
            console.log(sprintf("Save json to page %s", page_number_save))
            var img_url = JSON.parse(page_data)[0]['url']
            var page_number_img = Number(img_url.match(ree)[0])
            if (page_number_save != page_number_img){
                throw "Page number does not match!"
            }
            console.log(sprintf("Page image link is %s", JSON.parse(page_data)[0]['url']))
            slidesJsonD[wid][page_number_save.toString()] = JSON.parse(page_data)
            console.log("Save old page succeed!")
        } catch (err){
            console.log(err)
            console.log("Save old page failed!")
        }
        try{
            console.log("Move to new page " + page_number);
            var pageJsonD = slidesJsonD[wid][page_number.toString()]
            if (pageJsonD === undefined || pageJsonD.length == 0) {
                console.log("Use empty page instead")
                pageJsonD = slidesJsonD_ori[wid][page_number.toString()]
            }
            console.log("New page image link is " + pageJsonD[0]['url'])
            console.log("Move to new page succeed!")
            console.log("----------------------------------------")
        } catch (err){
            console.log(err)
            console.log("Move to new page failed!")
            console.log("----------------------------------------")
        }

        try {
            var img_url = pageJsonD[0]['url']
            var page_number_img = Number(img_url.match(ree)[0])
            if (page_number_img != page_number){
                throw "Image does not match page number!";
            }
        } catch(err){
            console.log(err)
        }

        res.send(pageJsonD);
    });
    form.parse(req);
});

app.post('/whiteboard/zoomimg', function(req, res) { //File upload
    var form = new formidable.IncomingForm(); //Receive form
    var formData = {
        files : {},
        fields : {}
    };
    form.on('field', function(name, value) {
        formData["fields"][name] = value;
    });

    form.on('end', function() {
        var page_number = formData['fields']['page_number']
        var wid = formData['fields']['wid']
        var page_data = formData['fields']['page_data']
        var direction = formData['fields']['direction']
        var page_data = JSON.parse(page_data)
        // console.log(pageJsonD[0]['d'][1])
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
        console.log(page_data.length);
        if (page_data.length == 0){
            page_data = slidesJsonD[wid][page_number.toString()]
        }
        console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>");
        console.log(page_data);
        console.log(page_data.length);

        page_data[0]['d'][0] = Math.round(Math.pow(1.1,direction)*page_data[0]['d'][0]);
        page_data[0]['d'][1] = Math.round(Math.pow(1.1,direction)*page_data[0]['d'][1]);
        
        // console.log(pageJsonD[0]['d'][1])
        slidesJsonD[wid][page_number.toString()] = page_data;
        res.send(page_data);
    });
    form.parse(req);
});

app.post('/whiteboard/zoomimgglobal', function(req, res) { //File upload
    var form = new formidable.IncomingForm(); //Receive form
    var formData = {
        files : {},
        fields : {}
    };
    form.on('field', function(name, value) {
        formData["fields"][name] = value;
    });

    form.on('end', function() {
        var page_number = formData['fields']['page_number']
        var wid = formData['fields']['wid']
        var page_data = formData['fields']['page_data']
        var percent_str = formData['fields']['percent_str']
        var pageJsonD = JSON.parse(page_data)
        slidesJsonD[wid][page_number.toString()] = pageJsonD
        var i;
        try{
            for(i=0; i<Object.keys(slidesJsonD[wid]).length; i++){
                slidesJsonD[wid][i.toString()][0]['d'][0] = Math.round(parseInt(percent_str)/100*slidesJsonD_ori[wid][i.toString()][0]['d'][0]);
                slidesJsonD[wid][i.toString()][0]['d'][1] = Math.round(parseInt(percent_str)/100*slidesJsonD_ori[wid][i.toString()][0]['d'][1]);
            }
        } catch(err){
            console.log(err);
        }
        // console.log(pageJsonD[page_number.toString()]['d'][1]);
        res.send(slidesJsonD[wid][page_number.toString()]);
    });
    form.parse(req);
});

app.post('/whiteboard/loadpage', function(req, res) { //File upload
    console.log("Loading single page")
    var form = new formidable.IncomingForm(); //Receive form
    // console.log("In turn page")
    var formData = {
        files : {},
        fields : {}
    };
    form.on('field', function(name, value) {
        formData["fields"][name] = value;
    });

    form.on('end', function() {
        var page_number = formData['fields']['page_number']
        var wid = formData['fields']['wid']
        var use_ori = formData['fields']['use_ori']
        if(use_ori=='true'){
            try{
                var pageJsonD = slidesJsonD_ori[wid][page_number.toString()]
                console.log("Load original page")
            } catch(err){
                var pageJsonD = []
                console.log("Original page is empty!")
            }
            
        } else {
            try{
                var pageJsonD = slidesJsonD_ori[wid][page_number.toString()]
                console.log("Load saved page")
                console.log(sprintf("Page image link is %s", pageJsonD[0]['url']))
                console.log("Load saved page succeed!")
            } catch(err) {
                var pageJsonD = slidesJsonD_ori[wid][page_number.toString()]
                console.log("Load saved page failed!")
            }
        }
        try {
            var img_url = pageJsonD[0]['url']
            var page_number_img = Number(img_url.match(ree)[0])
            if (page_number_img != page_number){
                throw "Image does not match page number!";
            }
        } catch(err){
            console.log(err)
        }

        var pages_n = 0
        try{
            pages_n = Object.keys(slidesJsonD_ori[wid]).length
        } catch(err) {
            pages_n = 0
        }
        var req_data = {
            "pageJsonD": pageJsonD,
            "pages_n": pages_n
        }
        res.send(req_data);
    });
    form.parse(req);
});

function progressUploadFormData(formData) {
    console.log("Progress new Form Data");
    var fields = formData.fields;
    var files = formData.files;
    var wid = fields["wid"];

    var name = fields["name"] || "";
    var date = fields["date"] || (+new Date());
    var filename = wid+"_"+date+".png";

    fs.ensureDir("./public/uploads", function(err) {
        if(err) {
            console.log("Could not create upload folder!", err);
            return;
        }
        var imagedata = fields["imagedata"];
        if(imagedata && imagedata != "") { //Save from base64 data
            imagedata = imagedata.replace(/^data:image\/png;base64,/, "").replace(/^data:image\/jpeg;base64,/, "");
            console.log(filename, "uploaded");
            fs.writeFile('./public/uploads/'+filename, imagedata, 'base64', function(err) {
                if(err) {
                    console.log("error", err);
                }
            });
        }
    });
}

io.on('connection', function(socket){

    socket.on('disconnect', function () {
        console.log("------------------------------")
        var now = new Date();
        var timeStamp = dateFormat(now, "yyyy-mm-dd HH:MM:ss");
        console.log(sprintf("%s: disconnected!", timeStamp))
        socket.broadcast.emit('refreshUserBadges', null); //Removes old user Badges
    });

    socket.on('drawToWhiteboard', function(content) {
        // console.log("------------------------------")
        // console.log("drawing!")
        content = escapeAllContentStrings(content);
        socket.broadcast.to(content["wid"]).emit('drawToWhiteboard', content); //Send to all users in the room (not own socket)
        s_whiteboard.handleEventsAndData(content); //save whiteboardchanges on the server
    });

    socket.on('joinWhiteboard', function(wid) {
        console.log("------------------------------")
        console.log("join!")
        socket.join(wid); //Joins room name=wid
    });
});

//Prevent cross site scripting
function escapeAllContentStrings(content, cnt) {
    if(!cnt)
        cnt = 0;

    if(typeof(content)=="string") {
        return content.replace(/<\/?[^>]+(>|$)/g, "");
    }
    for(var i in content) {
        if(typeof(content[i])=="string") {
            content[i] = content[i].replace(/<\/?[^>]+(>|$)/g, "");
        } if(typeof(content[i])=="object" && cnt < 10) {
            content[i] = escapeAllContentStrings(content[i], ++cnt);
        }
    }
    return content;
}


//// added by myself

// set morgan to log info about our requests for development use.
app.use(morgan('dev'));

// initialize body-parser to parse incoming parameters requests to req.body
app.use(bodyParser.urlencoded({ extended: true }));

// initialize cookie-parser to allow us access the cookies stored in the browser. 
app.use(cookieParser());

// initialize express-session to allow us track the logged-in user across sessions.
app.use(session({
    key: 'user_sid',
    secret: 'somerandonstuffs',
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 9000000
    }
}));


// This middleware will check if user's cookie is still saved in browser and user is not set, then automatically log the user out.
// This usually happens when you stop your express server after login, your cookie still remains saved in the browser.
app.use((req, res, next) => {
    console.log("--------------------");
    if (req.cookies.user_sid && !req.session.user) {
        console.log("cookies are cleared")
        res.clearCookie('user_sid');        
    }
    next();
});

// middleware function to check for logged-in users
// middleware function to check for logged-in users
var sessionChecker = (req, res, next) => {
    if (req.session.user && req.cookies.user_sid) {
        res.redirect('/dashboard');
    } else {
        next();
    }    
};

// route for Home-Page
app.get('/', sessionChecker, (req, res) => {
	console.log("redirecting to /login")
    res.redirect('/login');
});

// route for user signup
app.route('/signup')
    .get(sessionChecker, (req, res) => {
        console.log("landing on signup page")
        res.sendFile(__dirname + '/public/signup.html');
    })
    .post((req, res) => {

        console.log("++++++++++++++++++++");
        console.log(req.body.username);
        User.create({
            username: req.body.username,
            role: req.body.role,
            email: req.body.email,
            password: req.body.password
        })
        .then(user => {
            req.session.user = user.dataValues;
            res.redirect('/dashboard');
        })
        .catch(error => {
            console.log(error);
            res.redirect('/signup');
        });
    });


// route for user Login
app.route('/login')
    .get(sessionChecker, (req, res) => {
        console.log("----------------------------------------")
        console.log("getting login page")
        try{
            res.sendFile(__dirname + '/public/login.html');
        } catch(err){
            console.log("----------------------------------------")
            console.log("have an error!!!")
            console.log(err)
        }
            
    })
    .post((req, res) => {
        console.log("----------------------------------------")
        console.log("post login page")
        var username = req.body.username,
            password = req.body.password;
        console.log("User name is " + username);

        User.findOne({ where: { username: username } }).then(function (user) {
            if (!user) {
            	console.log("User not exist!")
                res.redirect('/login');
            } else if (!user.validPassword(password)) {
            	console.log("password incorrect!")
                res.redirect('/login');
            } else {
            	console.log("Open dashboard!")
                req.session.user = user.dataValues;
                res.redirect('/dashboard');
            }
        });
    });


// route for user's dashboard
app.get('/dashboard', (req, res) => {
    console.log("open dashboard...");
    if (req.session.user && req.cookies.user_sid) {
        // console.log(Object.keys(req));
        // res.sendFile(__dirname + '/public/dashboard.html');
        var now = new Date();
        var datestr = dateFormat(now, "yyyymmdd");
        var role = req.session.user['role'];
        var username = req.session.user['username'];

        if(role=="student"){
            console.log("user role is students")
            var whiteboardlink = "/whiteboard/?wid="+username+"&username="+role;
            res.render(__dirname + '/public/dashboard.ejs',{user:username,whiteboardlink:whiteboardlink});
        } else {
            console.log("user role is not students")
            User.findAll({ where: { role: 'student' } }).then(function (students) {
                var students_names = [];
                var students_links = [];
                for (i = 0; i < students.length; i++){
                    var students_name = students[i].dataValues['username'];
                    var students_link = "/whiteboard/?wid="+students_name+"&username=teacher";
                    students_names.push(students_name);
                    students_links.push(students_link);
                };
                res.render(__dirname + '/public/dashboard_teacher.ejs',{user:username,students_names:students_names,students_links:students_links});
            });

        }

    } else {
        console.log("--------------------")
        console.log("open login")
        res.redirect('/classroom/login');
    }
});


// route for user logout
app.get('/logout', (req, res) => {
    if (req.session.user && req.cookies.user_sid) {
        res.clearCookie('user_sid');
        res.redirect('/');
    } else {
        res.redirect('/login');
    }
});

function ensureAuthenticated(req, res, next) {
  if (req.session.user && req.cookies.user_sid) {
    return next(); }
  res.redirect('/');
}


app.use("/whiteboard",ensureAuthenticated);
app.use("/whiteboard",express.static(__dirname + '/public'));


// route for handling 404 requests(unavailable routes)
app.use(function (req, res, next) {
  res.status(404).send("Sorry can't find that!")
});

// ====================================================================================================

// app.use(express.static(__dirname + '/public'));

server.listen(PORT);
// http.listen(PORT);
console.log("Webserver & socketserver running on port:"+PORT);
