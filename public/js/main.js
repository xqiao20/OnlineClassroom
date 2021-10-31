var wid = getQueryVariable("wid");
wid = wid || "myNewWhiteboard";
var myUsername = getQueryVariable("username");
myUsername = myUsername || "unknown" + (Math.random() + "").substring(2, 6);
var version = getQueryVariable("version");
version = version || 0;

var url = document.URL.substr(0, document.URL.lastIndexOf('/'));
var signaling_socket = null;
var urlSplit = url.split("/");
var subdir = "";
var page_number = 0;
var pages_n = 0
for (var i = 3; i < urlSplit.length; i++) {
    subdir = subdir + '/' + urlSplit[i];
}
cur_url = document.URL.split("/?")[0];

if (subdir != "") {
    // signaling_socket = io("", { "path": subdir + "/socket.io" }); //Connect even if we are in a subdir behind a reverse proxy
    try{
        signaling_socket = io();
    } catch (err) {
        alert(err)
    }
        
} else {
    alert("socket.io:");
    signaling_socket = io();
}

signaling_socket.on('connect', function () {
    console.log("Websocket connected!");

    console.log("next: drawToWhiteboard")
    signaling_socket.on('drawToWhiteboard', function (content) {
        whiteboard.handleEventsAndData(content, true);
    });

    console.log("next: refreshUserBadges")
    signaling_socket.on('refreshUserBadges', function () {
        whiteboard.refreshUserBadges();
    });
    console.log("next: joinWhiteboard")
    signaling_socket.emit('joinWhiteboard', wid);
});

$(document).ready(function () {
    console.log("--------------------")
    console.log("Page is ready!")
    whiteboard.loadWhiteboard("#whiteboardContainer", { //Load the whiteboard
        wid: wid,
        username: myUsername,
        sendFunction: function (content) {
            signaling_socket.emit('drawToWhiteboard', content);
        }
    });

    // request whiteboard from server
    $.get("/loadwhiteboard", { wid: wid, version: version }).done(function (req_data) {
    	resizePageSize(req_data['data']);
        whiteboard.loadData(req_data['data']);
        var session_exists = req_data['session_exists']
        pages_n = req_data['pages_n']
        page_number = req_data['page_number']
        console.log(pages_n)
        if (session_exists){
            console.log("Session already exist, join existing session!")
            // loadPage(0,use_ori=false);
        } else {
            console.log("Session does not exist, loading data from server")
            try{
                whiteboard.clearWhiteboard();
                loadPage(0,use_ori=false);
            } catch (err){
                alert(err)
            }
        }
    });

    /*----------------/
    Whiteboard actions
    /----------------*/
    if (myUsername != "teacher"){
        $('#preImgBtn').prop('disabled',true).css('opacity',0.5);
        $('#nextImgBtn').prop('disabled',true).css('opacity',0.5);
        $('#imgZoomIn').prop('disabled',true).css('opacity',0.5);
        $('#imgZoomOut').prop('disabled',true).css('opacity',0.5);
        $('#imgZoomSel').prop('disabled',true).css('opacity',0.5);
        $('#refreshSlides').prop('disabled',true).css('opacity',0.5);
    }

    // whiteboard clear button
    $("#whiteboardTrashBtn").click(function () {
        whiteboard.clearWhiteboard();
        loadPage(page_number);
    });

    // undo button
    $("#whiteboardUndoBtn").click(function () {
        whiteboard.undoWhiteboardClick();
    });

    // switch tool
    $(".whiteboardTool").click(function () {
        $(".whiteboardTool").removeClass("active");
        $(this).addClass("active");
        whiteboard.setTool($(this).attr("tool"));
    });

    // upload image button
    $("#addImgToCanvasBtn").click(function () {
        alert("Please drag the image into the browser.");
    });

    // upload pdf button
    $("#addPdfToCanvasBtn").click(function () {
        $("#myPdf").click();
    });

    // save image to png
    $("#saveAsImageBtn").click(function () {
        var imgData = whiteboard.getImageDataBase64();
        var a = document.createElement('a');
        a.href = imgData;
        a.download = 'whiteboard.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });


    // save image to json containing steps
    $("#saveAsJSONBtn").click(function () {
        var imgData = whiteboard.getImageDataJson();
        var a = window.document.createElement('a');
        a.href = window.URL.createObjectURL(new Blob([imgData], { type: 'text/json' }));
        a.download = 'whiteboard.json';
        // Append anchor to body.
        document.body.appendChild(a);
        a.click();
        // Remove anchor from body
        document.body.removeChild(a);
    });

    // upload json containing steps
    $("#uploadJsonBtn").click(function () {
        $("#myFile").click();
    });

    
    // Previous image button
    $("#preImgBtn").click(function () {
        var pageJsonDS = whiteboard.getImageDataJson();
        try {
            turnPage(0, pageJsonDS);
        } catch (err) {
            alert(err);
        }
    });
    // Next image button
    $("#nextImgBtn").click(function () {
        var pageJsonDS = whiteboard.getImageDataJson();
        try {
            turnPage(1, pageJsonDS);
        } catch (err) {
            alert(err);
        }
    });

    // Zoom in button
    $("#imgZoomIn").click(function () {
        var pageJsonDS = whiteboard.getImageDataJson();
        // if(pageJsonDS.length != 1){
            // alert(pageJsonDS.constructor.name);
            // alert(pageJsonDS.length);
            // alert(pageJsonDS);
        // }
        whiteboard.clearWhiteboard();
        zoomImg(1,pageJsonDS);
    });
    // Zoom out button
    $("#imgZoomOut").click(function () {
        var pageJsonDS = whiteboard.getImageDataJson();
        // if(pageJsonDS.length != 1){
            // alert(pageJsonDS.constructor.name);
            // alert(pageJsonDS.length);
            // alert(pageJsonDS);
        // }
        whiteboard.clearWhiteboard();
        zoomImg(-1,pageJsonDS);
    });

    // refresh slides
    $("#refreshSlides").click(function () {
        whiteboard.clearWhiteboard();
        refreshSlides();        
        loadPage(0,use_ori=false);
        $('#preImgBtn').prop('disabled', true).css('opacity',0.5);
        $('#nextImgBtn').prop('disabled', false).css('opacity',1.0);  
    });

    // Zoom out button
    $("#imgZoomSel").change(function () {
        var pageJsonDS = whiteboard.getImageDataJson();
        // if(pageJsonDS.length != 1){
            // alert(pageJsonDS.constructor.name);
            // alert(pageJsonDS.length);
            // alert(pageJsonDS);
        // }
        whiteboard.clearWhiteboard();
        zoomImgGlobal($(this).val(),pageJsonDS);
    });


    // load json to whiteboard
    $("#myFile").on("change", function () {
        var file = document.getElementById("myFile").files[0];
        var reader = new FileReader();
        reader.onload = function (e) {
            try {
                var j = JSON.parse(e.target.result);
                resizePageSize(j);
                whiteboard.loadJsonData(j);
            } catch (e) {
                alert("File was not a valid JSON!");
            }
        };
        reader.readAsText(file);
        $(this).val("");
    });

    // On thickness slider change
    $("#whiteboardThicknessSlider").on("change", function () {
        whiteboard.thickness = $(this).val();
    });

    // handle drag&drop
    var dragCounter = 0;
    $('#whiteboardContainer').on("dragenter", function (e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter++;
        whiteboard.dropIndicator.show();
    });

    $('#whiteboardContainer').on("dragleave", function (e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter--;
        if (dragCounter === 0) {
            whiteboard.dropIndicator.hide();
        }
    });

    $('#whiteboardContainer').on('drop', function (e) { //Handle drop
        if (e.originalEvent.dataTransfer) {
            if (e.originalEvent.dataTransfer.files.length) { //File from harddisc
                e.preventDefault();
                e.stopPropagation();

                var filename = e.originalEvent.dataTransfer.files[0]["name"];
                if (isImageFileName(filename)) {
                    var blob = e.originalEvent.dataTransfer.files[0];
                    var reader = new window.FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = function () {
                        base64data = reader.result;
                        uploadImgAndAddToWhiteboard(base64data);
                    }
                } else {
                    console.error("File must be an image!");
                }
            } else { //File from other browser
                var fileUrl = e.originalEvent.dataTransfer.getData('URL');
                var imageUrl = e.originalEvent.dataTransfer.getData('text/html');
                var rex = /src="?([^"\s]+)"?\s*/;
                var url = rex.exec(imageUrl);
                if (url && url.length > 1) {
                    url = url[1];
                } else {
                    url = "";
                }

                isValidImageUrl(fileUrl, function (isImage) {
                    if (isImage && isImageFileName(url)) {
                        whiteboard.addImgToCanvasByUrl(fileUrl);
                    } else {
                        isValidImageUrl(url, function (isImage) {
                            if (isImage) {
                                if (isImageFileName(url)) {
                                    whiteboard.addImgToCanvasByUrl(url);
                                } else {
                                    uploadImgAndAddToWhiteboard(url);
                                }
                            } else {
                                console.error("Can only upload imagedata!");
                            }
                        });
                    }
                });
            }
        }
        dragCounter = 0;
        whiteboard.dropIndicator.hide();
    });

    $('#whiteboardColorpicker').colorPicker({
        renderCallback: function (elm) {
            whiteboard.drawcolor = elm.val();
        }
    });
});

//Prevent site from changing tab on drag&drop
window.addEventListener("dragover", function (e) {
    e = e || event;
    e.preventDefault();
}, false);
window.addEventListener("drop", function (e) {
    e = e || event;
    e.preventDefault();
}, false);


function resizePageSize(pageJsonD){
	var pageHeight = 2000;
	try{
		pageHeight = pageJsonD[0]['d'][1];
	} catch(err) {
		console.log(err)
	}
	if (pageHeight > 1950){
		document.body.style.height = pageHeight + 50 + "px"
		document.getElementById("whiteboardCanvas").height=pageHeight + 50
	} else {
		document.body.style.height = "2000px"
		document.getElementById("whiteboardCanvas").height=2000
	}
}

function uploadImgAndAddToWhiteboard(base64data) {
    var date = (+new Date());
    $.ajax({
        type: 'POST',
        url: document.URL.substr(0, document.URL.lastIndexOf('/')) + '/upload',
        data: {
            'imagedata': base64data,
            'wid': wid,
            'date': date
        },
        success: function (msg) {
            var filename = wid + "_" + date + ".png";
            whiteboard.addImgToCanvasByUrl(document.URL.substr(0, document.URL.lastIndexOf('/')) + "/uploads/" + filename); //Add image to canvas
            console.log("Image uploaded!");
        },
        error: function (err) {
            console.error("Failed to upload frame: " + JSON.stringify(err));
        }
    });
}

function turnPage(direction, pageJsonDS) {
    var date = (+new Date());
    var page_number_save = page_number;
    if (direction==0){
        page_number--;
    } else {
        page_number++;
    };

    if (page_number < 0){
        page_number = 0;
        alert("Have reached the first page!")
        $('#preImgBtn').prop('disabled',true).css('opacity',0.5);
        return;
    } else if (page_number > (pages_n-1)){
        alert("Have reached the last page!")
        page_number = (pages_n-1);
        $('#nextImgBtn').prop('disabled',true).css('opacity',0.5);
        return;
    } else {
        whiteboard.clearWhiteboard();
        $('#preImgBtn').prop('disabled', false).css('opacity',1.0);
        $('#nextImgBtn').prop('disabled', false).css('opacity',1.0);  
    }
    
    $.ajax({
        type: 'POST',
        url: document.URL.substr(0, document.URL.lastIndexOf('/')) + '/turn',
        data: {
            'wid': wid,
            'date': date,
            'page_number': page_number,
            'page_number_save': page_number_save,
            'page_data': pageJsonDS,
            'cur_url': cur_url
        },
        success: function (msg) {
        	resizePageSize(msg);
            whiteboard.loadJsonData(msg);
        },
        error: function (err) {
            console.error("Failed to upload frame: " + JSON.stringify(err));
        }
    });
}

function loadPage(page_number, use_ori=true) {
    $.ajax({
        type: 'POST',
        url: document.URL.substr(0, document.URL.lastIndexOf('/')) + '/loadpage',
        data: {
            'wid': wid,
            'page_number': page_number,
            'cur_url': cur_url,
            'use_ori': use_ori,
        },
        success: function (msg) {
        	var pageJsonD = msg['pageJsonD'];
        	resizePageSize(pageJsonD);
            whiteboard.loadJsonData(pageJsonD);
        },
        error: function (err) {
            alert(err);
            console.error("Failed to upload frame: " + JSON.stringify(err));
        }
    });
}

function zoomImg(direction,pageJsonDS) {
    $.ajax({
        type: 'POST',
        url: document.URL.substr(0, document.URL.lastIndexOf('/')) + '/zoomimg',
        data: {
            'wid': wid,
            'page_number': page_number,
            'direction': direction,
            'page_data': pageJsonDS
        },
        success: function (msg) {
            // if(msg.length != 1){
                // alert(msg.length);    
            // }
            
        	resizePageSize(msg);
            whiteboard.loadJsonData(msg);
        },
        error: function (err) {
            // alert(err);
            console.error("Failed to upload frame: " + JSON.stringify(err));
        }
    });
}

function refreshSlides() {
    $.ajax({
        type: 'POST',
        url: document.URL.substr(0, document.URL.lastIndexOf('/')) + '/refreshslides',
        data: {
            'wid': wid,
            'page_number': page_number,
        },
        success: function (msg) {
            pages_n = msg['pages_n']
            page_number = msg['page_number']
        },
        error: function (err) {
            // alert(err);
            console.error("Failed to refresh slides: " + JSON.stringify(err));
        }
    });
}


function zoomImgGlobal(percent_str,pageJsonDS) {
    $.ajax({
        type: 'POST',
        url: document.URL.substr(0, document.URL.lastIndexOf('/')) + '/zoomimgglobal',
        data: {
            'wid': wid,
            'page_number': page_number,
            'percent_str': percent_str,
            'page_data': pageJsonDS
        },
        success: function (msg) {
            // if(msg.length != 1){
                // alert(msg.length);    
            // }
            
        	resizePageSize(msg);
            whiteboard.loadJsonData(msg);
        },
        error: function (err) {
            // alert(err);
            console.error("Failed to upload frame: " + JSON.stringify(err));
        }
    });
}

// verify if filename refers to an image
function isImageFileName(filename) {
    var extension = filename.split(".")[filename.split(".").length - 1];
    var known_extensions = ["png", "jpg", "jpeg", "gif", "tiff"];
    return known_extensions.includes(extension.toLowerCase());
}

// verify if given url is url to an image
function isValidImageUrl(url, callback) {
    var img = new Image();
    var timer = null;
    img.onerror = img.onabort = function () {
        clearTimeout(timer);
        callback(false);
    };
    img.onload = function () {
        clearTimeout(timer);
        callback(true);
    };
    timer = setTimeout(function () {
        callback(false);
    }, 2000);
    img.src = url;
}

// handle pasting from clipboard
window.addEventListener("paste", function (e) {
    if (e.clipboardData) {
        var items = e.clipboardData.items;
        if (items) {
            // Loop through all items, looking for any kind of image
            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") !== -1) {
                    // We need to represent the image as a file,
                    var blob = items[i].getAsFile();

                    var reader = new window.FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = function () {
                        console.log("Uploading image!");
                        base64data = reader.result;
                        uploadImgAndAddToWhiteboard(base64data);
                    }
                }
            }
        }
    }
});

// get 'GET' parameter by variable name
function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split("&");
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split("=");
        if (pair[0] == variable) {
            return pair[1];
        }
    }
    return false;
}