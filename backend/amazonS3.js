'use strict';
var IncomingForm = require('formidable');
var Imager = require('imager');
var imagerConfig = require("./../../../settings/fileUpload/credentials/imagerConfig");
var fs = require("fs");
var fileHelper = require('./helper');
var cf = require('aws-cloudfront-sign');
var path = require("path");
var s3 = require('s3');
var localFileConvert = require("./localFileConvert")

//Constructor for loading amazon image s3 and cloud front..
var init = function(server, databaseObj, helper, packageObj) {
    //run a loop of config and start defiging methods for each settings..
    var configList = packageObj.config;
    //Now add generate url method..
    generateSignedUrl(server, databaseObj, helper, packageObj);
    generateUnsignedUrl(server, databaseObj, helper, packageObj);
    configList.forEach(function(config) {
        loadConfig(config, server, databaseObj, helper, packageObj);
    });
};


//Start defigning config for settings..
var loadConfig = function(config, app, databaseObj, helper, packageObj) {
    //get the container object..
    var Container = app.models[config.containerModel];
    //PersistentModel for exposing the containe with this model..
    var PersistentModel = app.models[config.fileModel];
    //Add container remote methods
    modifyContainerUpload(app, Container, config, helper, packageObj, PersistentModel);
};


var generateUnsignedUrl = function(server, databaseObj, helper, packageObj) {
    var app = server;
    var FileModel = packageObj.fileDefaultModel;
    FileModel = app.models[FileModel];
    //Options accepts suffix or prefix like -original, -medium, -thumb, -original
    FileModel.getUnsignedUrl = function(container, file, options, callback) {
        var app = this.app;
        var unSignedUrl = "";
        try {
            if (packageObj.cdn) {
                for (var provider in packageObj.cdn) {
                    if (packageObj.cdn.hasOwnProperty(provider)) {
                        var cdnSetting = packageObj.cdn[provider];
                        if(cdnSetting){
                            if(cdnSetting[container]){
                                var containerService = cdnSetting[container];
                                if(containerService){
                                    if (provider === "amazon") {
                                        if(options){
                                            if (options.type === "prefix") {
                                                unSignedUrl = containerService.url +"/" + options.value + file;
                                            }else if(options.type === "suffix"){
                                                unSignedUrl = containerService.url +"/"  + file + options.value;
                                            }else{
                                                unSignedUrl = containerService.url +"/"  + file;
                                            }
                                        }else{
                                            unSignedUrl = containerService.url +"/"  + file;
                                        }
                                    } else if (provider === "rackspace") {
                                        //TODO DO IT LATER..
                                        //
                                        //
                                    } else {
                                        //do nothing...

                                    }
                                }
                            }
                        }
                    }
                } //for loop.
            }
        } catch (err) {
            //return error..
            return callback(err);
        }

        var defaultUrl;

        if (options) {
            if (options.type === "prefix") {
                defaultUrl = "/api/containers/" + container + "/download/" + options.value + file;
            } else if (options.type === "suffix") {
                defaultUrl = "/api/containers/" + container + "/download/" + file + options.value;
            } else {
                //else return normal url ..
                defaultUrl = "/api/containers/" + container + "/download/" + file;
            }
        } else {
            //else return normal url ..
            defaultUrl = "/api/containers/" + container + "/download/" + file;
        }



        return callback(null, {
            defaultUrl: defaultUrl,
            unSignedUrl: unSignedUrl
        });
    };
};




//Add get url methods for the basic models..also generateSignedApk for cdn containers automatically..
var generateSignedUrl = function(server, databaseObj, helper, packageObj) {
    var app = server;
    var FileModel = packageObj.fileDefaultModel;
    FileModel = app.models[FileModel];
    //Options accepts suffix or prefix like -original, -medium, -thumb, -original
    FileModel.getUrl = function(container, file, options, callback) {
        var app = this.app;
        var signedUrl = "";
        try {
            if (packageObj.cdn) {
                for (var provider in packageObj.cdn) {
                    if (packageObj.cdn.hasOwnProperty(provider)) {
                        var givedContainer = packageObj.cdn[provider].container;
                        if (givedContainer === container) {
                            if (provider === "amazon") {
                                signedUrl = generateAmazonSignedUrl(app, file, options, packageObj.cdn[provider].keyPairId, packageObj.cdn[provider].url, packageObj);
                            } else if (provider === "rackspace") {
                                //TODO DO IT LATER..
                                //
                                //
                            } else {
                                //do nothing...

                            }

                        }
                    }
                } //for loop.
            }
        } catch (err) {
            //return error..
            return callback(err);
        }

        var defaultUrl;

        if (options) {
            if (options.type === "prefix") {
                defaultUrl = "/api/containers/" + container + "/download/" + options.value + file;
            } else if (options.type === "suffix") {
                defaultUrl = "/api/containers/" + container + "/download/" + file + options.value;
            } else {
                //else return normal url ..
                defaultUrl = "/api/containers/" + container + "/download/" + file;
            }
        } else {
            //else return normal url ..
            defaultUrl = "/api/containers/" + container + "/download/" + file;
        }



        return callback(null, {
            defaultUrl: defaultUrl,
            signedUrl: signedUrl
        });
    };


    FileModel.remoteMethod(
        'getUrl', {
            'description': "Get download url for the file. Also generates signed url automatically if provided.",
            accepts: [{
                arg: 'container',
                type: 'string'
            }, {
                arg: 'file',
                type: 'string'
            }, {
                arg: 'options',
                type: "object"
            }],
            returns: {
                arg: 'url',
                type: 'object',
                root: true
            }
        }
    );

};


/**
 * Generate Amazon Cloud Front Signed URL.
 * @param  {[type]} app       [description]
 * @param  {[type]} container [description]
 * @param  {[type]} file      [description]
 * @param  {[type]} options   {type:"prefix||suffix", value: "thumb-"|| "medium_" etc}
 * @param  {[type]} keypairId [description]
 * @param  {[type]} url       [description]
 * @param  {[type]} packageObj       [description]
 * @return {[type]}           [description]
 */
var generateAmazonSignedUrl = function(app, file, options, keypairId, url, packageObj) {
    try{
        var time = (new Date().getTime() + (1000 * 15 * 60 * 60));
        var PRIVATE_KEY_PATH = path.join(__dirname + '../../../settings/fileUpload/credentials/' + packageObj.cdn.amazon.privateKeyFile);
        var cfOptions = {
            keypairId: keypairId,
            privateKeyPath: PRIVATE_KEY_PATH,
            expireTime: time
        };
        var signedUrl;
        if (options) {
            if (options.type === "prefix") {
                signedUrl = cf.getSignedUrl(url + "/" + options.value + file, cfOptions);
            } else if (options.type === "suffix") {
                signedUrl = cf.getSignedUrl(url + "/" + file + options.value, cfOptions);
            } else {
                signedUrl = cf.getSignedUrl(url + "/" + file, cfOptions);
            }
        } else {
            signedUrl = cf.getSignedUrl(url + "/" + file, cfOptions);
        }
        return signedUrl;
    }
    catch(e){
        console.error("Error:common/plugins/fileUpload/amazons3.js: ", e.toString());
        return null;
    }
};




var modifyContainerUpload = function(app, Container, config, helper, packageObj, persistentModel) {
    //Get the dataSource object..
    var FileDataSource = config.fileDataSource;
    var settings = app.dataSources[FileDataSource].settings;
    Container.beforeRemote('upload', function(ctx, res, next) {
        console.log("Uploading Data..");
        if (settings.provider === 'filesystem') {
            //handle the file system upload..
            next();
        }
        else if(settings.provider === "amazon"){
            //console.log("I am inside amazon block");
            //Handle the amazon cloud front + Amazon S3 upload
            //Start the file uploading process..
            uploadFileToS3(app, ctx.req, ctx.res, config, packageObj, persistentModel, function(err, data, type) {
                if (err) {
                    next(err);
                } else {
                    //console.log(data.result.files.file);
                    
                    var name = data.result.files.file[0].name;
                    var container = data.result.files.file[0].container;

                    
                    var options = {};
                    if(type === "image"){
                        options = {
                            type: "prefix",
                            value: "thumb_"
                        };
                    }
                        
                    persistentModel.getUnsignedUrl (container, name, options, function(err, url)  {
                        if(err){
                            return ctx.res.status(500).send(err);
                        }
                        persistentModel.create({
                            name: name,
                            container: container,
                            url: url
                        }, function(err, obj) {
                            if (err) {
                                console.log("Error occured");
                                ctx.res.status(500).send(err);
                            } else {
                                console.log("Successfully uploaded with file to the server..");
                                return ctx.res.send(obj);
                            }
                            //next();
                        });
                    });
                }
            });
        }else{
            //Handle the file upload related to some other type..some other server type upload..proceed the default upload type..
            next();
        }      
    });

    Container.afterRemote('upload', function(ctx, res, next){
        if (settings.provider === 'filesystem') {
            //IF u have large image then. use this to avoid timeout..    
            ctx.req.connection.setTimeout(16000);
            //handle the file system upload..
            //Convert Image to FileSystem..
            localFileConvert.convertFile(app, config, packageObj, ctx, res, persistentModel)
            .then(file=>{
                ctx.res.send(file);
            })
            .error(error=>{
                console.log("Error occured");
                ctx.res.status(500).send(err);
            })
        }else{
            next();
        }
    });
}; //modifyContainerUpload files..





/**
 * Custom handler for handling the amazon upload type
 * @param  {Object}   app             loopback app type object
 * @param  {Object}   provider        Provider type either filesystem | Amazon S3 etc
 * @param  {Object}   req             Request object
 * @param  {Object}   res             Response Object
 * @param  {Object}   config          Plugin Config of PackageObj of snaphy
 * @param  {Object}   packageObj      Settings of PackageObj
 * @param  {Object}   persistentModel Data model storing the file upload the.
 * @param  {Object}   options         Extra options for storing file description or details.
 * @param  {Function} cb              Callback function. arguments (err, file)
 */
var handler = function(app, provider, req, res, config, packageObj, persistentModel, options, cb) {

    if (!cb && 'function' === typeof options) {
        cb = options;
        options = {};
    }




    // if (!options.maxFileSize) {
    //   options.maxFileSize = defaultOptions.maxFileSize;
    // }

    var form = new IncomingForm(options);

    var fields = {};
    var files = [];

    form
        .on('field', function(field, value) {
            fields[field] = value;
        })
        .on('file', function(field, file) {
            //Verify here for file type first then move to image or file upload path..
            var ImageTypePatt = /^image\/(.+)$/;
            var PDFTypePatt = /^application\/pdf$/;
            var DOCXTypePatt = /^application\/vnd\.(.+)$/; //http://stackoverflow.com/questions/4212861/what-is-a-correct-mime-type-for-docx-pptx-etc
            var MSWord = /^application\/msword$/;
            var OCTETSTREAM = /^application\/octet-stream$/;

            if(!file.type){
                return cb(new Error("No file type found. File Mime type must present for upload"));
            }

            //Get the type of the file..
            var fileType;


            if(ImageTypePatt.test(file.type)){
                fileType = "image";
            }
            else if(PDFTypePatt.test(file.type)){
                fileType = "pdf";
            }else if(DOCXTypePatt.test(file.type)){
                //In case of mobile upload..
                fileType = "docx";
            }else if(MSWord.test(file.type)){
                //In case of mobile upload..
                fileType = "doc";
            }else if(OCTETSTREAM.test(file.type)){
                //In case of mobile upload..
                fileType = "image";
            }
            else{
                return cb(new Error("No suitable file type match found in config file. File Mime type must present for upload"));
            }



            if(config.fileProp){
                //Now loop through properties..
                for(var i=0; i < config.fileProp.length; i++){
                    var prop = config.fileProp[i];
                    if(prop.type === fileType){
                        //rename the file name..
                        var fileName = fileHelper.renameFile(file, req);
                        if(fileType === "image"){
                            uploadImageToCloud(app, file, fields.container, res, req, fileName, config, cb);
                        }
                        else if(fileType === "pdf"){
                            uploadFileToCloud(app, file, fields.container, res, req, fileName, config, cb);
                        }
                        else if(fileType === "doc"){
                            uploadFileToCloud(app, file, fields.container, res, req, fileName, config, cb);
                        }else if(fileType === "docx"){
                            uploadFileToCloud(app, file, fields.container, res, req, fileName, config, cb);
                        }
                        else{
                            //ALERT Other file type not supported yet...
                            //uploadFileToCloud(app, file, fields.container, res, req, fileName, config, cb);
                        }

                        //Call the callback here without waiting..
                        //TODO HERE ALWAYS ONLY FILE IS GETTING SEND CHECK FOR BUG FIXING..
                        //SENDING RESPONCE ASSUMNG FILE IS ALWAYS UPLOADED TO SERVER..
                        var fileArr = [];
                        fileArr.push({
                            name: fileName,
                            container: fields.container || config.defaultContainer || imagerConfig.storage.S3.bucket
                        });
                        var data = {
                            result: {
                                files: {
                                    file: fileArr
                                }
                            }
                        };
                        //res.send(); //res.status
                        //call the callback..now..
                        cb(null, data, fileType);

                        //Now break the loop..
                        break;
                    }
                        
                }
            }else{
                return cb(new Error("No file properties defined for config in packageObj of fileUpload plugin."));
            }
        })
        .on('end', function(name, file) {
            //console.log("END-> File fetched\n");
        });

    form.parse(req);
};



//
/**
 * Amazon s3 client object for file uploading..
 * https://github.com/andrewrk/node-s3-client
 */
var getS3Client = function(){
    var client = s3.createClient({
      maxAsyncS3: 20,     // this is the default
      s3RetryCount: 3,    // this is the default
      s3RetryDelay: 1000, // this is the default
      multipartUploadThreshold: 30971520, // this is the default (20 MB)
      multipartUploadSize: 15728640, // this is the default (15 MB)
      s3Options: {
        accessKeyId: imagerConfig.storage.S3.key,
        secretAccessKey: imagerConfig.storage.S3.secret,
        region: ""
      }
    });

    return client;
};





var uploadFileToS3 = function(app, req, res, config, packageObj, persistentModel, options, cb) {
    //console.log("Now uploading files to S3");
    var storageService = app.dataSources[config.fileDataSource].connector;
    if (!cb && 'function' === typeof options) {
        cb = options;
        options = {};
    }
    if (storageService.getFilename && !options.getFilename) {
        options.getFilename = storageService.getFilename;
    }
    if (storageService.acl && !options.acl) {
        options.acl = storageService.acl;
    }
    if (storageService.allowedContentTypes && !options.allowedContentTypes) {
        options.allowedContentTypes = storageService.allowedContentTypes;
    }
    if (storageService.maxFileSize && !options.maxFileSize) {
        options.maxFileSize = storageService.maxFileSize;
    }
    return handler(app, storageService.client, req, res, config, packageObj, persistentModel, options, cb);
};



var uploadFileToCloud = function(app, path, container, res, req, fileName, config, callback){
    //console.log("Now uploading image to cloud");
    var clientFileName = path.name;
    //Add normal file upload to s3 amazon...
    var params = {
      localFile: path.path,
      s3Params: {
        Bucket: imagerConfig.storage.S3.bucket,
        Key: fileName,
        StorageClass: imagerConfig.storage.S3.storageClass,
        ACL: "public-read"
      }
    };

    //Now start uploading of the file..
    var uploader = getS3Client().uploadFile(params);
    uploader.on('error', function(err) {
      console.error("unable to upload:", err.stack);
    });
    uploader.on('progress', function() {
        //console.log("progress", uploader.progressMd5Amount, uploader.progressAmount, uploader.progressTotal);
    });
    uploader.on('end', function() {
        console.log("Done!! uploading file to amazon s3 server");
        //TODO Now deleting the original file..
        deleteLocalFile(path.path);
    });
};


const uploadImageLocally = (server, filePath, fileName_, config, container, req) => {
    return new Promise((resolve, reject)=> {
        const file = {
            name: fileName_
        }

        var fileName = fileHelper.renameFile(file, req);
        container = config.defaultContainer;
        imagerConfig.storage.S3.bucket = container || config.defaultContainer || imagerConfig.storage.S3.bucket;
         //Now add the rename function..
        imagerConfig.variants.items.rename = function() {
            return fileName;
        }
        var imager = new Imager(imagerConfig, "S3") // or 'S3' for amazon
        imager.upload([filePath], function(err, cdnUri, files) {
            // do your stuff
            if (err) {
                console.error(err);
                reject(err);
            } else {
                console.log("Successfully saved to the amazon server..");
                var PersistentModel = server.models[config.fileModel];
                var options = {};
                options = {
                    type: "prefix",
                    value: "thumb_"
                };
        
                PersistentModel.getUnsignedUrl (container, fileName, options, function(err, url)  {
                    if(err){
                       reject(err);
                    }else{
                        PersistentModel.create({
                            name: fileName,
                            container: container,
                            url: url
                        }, function(err, obj) {
                            if (err) {
                                console.log("Error occured");
                                reject(err);
                            } else {
                                console.log("Successfully uploaded with file to the server..");
                                resolve(obj);
                            }
                        });
                    }
                });
            }
        }, 'items');
    });
};




var uploadImageToCloud = function(app, path, container, res, req, fileName, config, callback) {
        var clientFileName = path.name;
        imagerConfig.storage.S3.bucket = container || config.defaultContainer || imagerConfig.storage.S3.bucket;


        //var fileName = fileHelper.renameFile(path, req);

        //Now add the rename function..
        imagerConfig.variants.items.rename = function() {
            return fileName;
        }



        var imager = new Imager(imagerConfig, "S3") // or 'S3' for amazon
        imager.upload([path], function(err, cdnUri, files) {
            // do your stuff
            if (err) {
                return console.error(err);

            } else {
                console.log("Successfully saved to the amazon server..");
            }

            //TODO Now deleting the original file..
            deleteLocalFile(path.path);
        }, 'items');
    }; //uploadImageToCloud..





var deleteLocalFile = function(path) {
    fs.unlink(path, function(err) {
        if (err) {
            console.error("Error deleting image from the path.");
        } else {
            console.log('successfully deleted ' + path);
        }

    });
};




module.exports = {
    init: init,
    uploadImageLocally: uploadImageLocally,
};
