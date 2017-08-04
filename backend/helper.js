var renameFile = function (file, req){
    //var fileExtension = file.name.split(/\.$/).pop();
    var fileExtension;
    //var container = file.container;
    var time = new Date().getTime();
    var userId = getUserId(req);

    var UUID = guid();
    //Now preparing the file name..
    //customerId_time_orderId.extension
    //Pattern for detecting the file extension
    var pattern = /^.+\/(.+)$/;
    if(!fileExtension){
        var extension = pattern.exec(file.type);
        try {
            if (extension.length) {
                var DOCXTypePatt = /^application\/vnd\.(.+)$/; //http://stackoverflow.com/questions/4212861/what-is-a-correct-mime-type-for-docx-pptx-etc
                var MSWord = /^application\/msword$/;
                if(DOCXTypePatt.test(file.type)){
                    //In case of mobile upload..
                    fileExtension = "docx";
                }else if(MSWord.test(file.type)){
                    //In case of mobile upload..
                    fileExtension = "doc";
                }else{
                    if(file.name){
                        fileExtension = file.name.split('.').pop();
                    }else{
                        fileExtension = extension[1];
                    }
                }
            } else {
                var err = new Error("Error: File Extension not found");
                console.error("Error: File Extension not found");
                return err;
            }
        } catch (err) {
            console.error(err);
            return err;
        }
        if (fileExtension === 'jpeg') {
            fileExtension = "jpg";
        }
    }
    /*if(fileExtension !== "jpg" || fileExtension !== "png" || fileExtension !== "gif"){
        fileExtension = "jpg";
    }*/

    const NewFileName = '' + userId + '_' + time + '_' + UUID + '.' + fileExtension;

    //And the file name will be saved as defined..
    return NewFileName;
};


function getUserId(req){
    var userId;
    try{
        //var query = req.query;
        userId = req.accessToken.userId;
    }
    catch(err){
        //TODO Remove this to support only login user upload..
        userId = guid();
        console.error("Got error accessing user information from accesstoken in helper.js file in fileUpload");
    }

    return userId;
}


function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
        s4() + '-' + s4() + s4() + s4();
}



module.exports = {
    renameFile : renameFile
}
