// Created by Robins 
//24th Dec 2018.
'use strict';

const Promise = require("bluebird");
//var qt = require('quickthumb');
const sharp = require('sharp');


const getLocalImageUrl = (res, fileName, containerName, prefix) => {
    const host = res.get('host')
    const protocol = res.get("protocol");
    const originalUrl = res.get("originalUrl");
    //console.log("Host", host, protocol, originalUrl) 
    //http://localhost:3001/api/containers/fasttrack/download/anonymous_1545629655956_8c7a59c4-276c-8e8b-cc2a-53e157ca33cc.jpeg
    if(prefix){
        fileName = prefix + fileName
    }

    /*
        {
		    "defaultUrl" : "/api/containers/relishtourprod/download/medium_5b1f49efde677ee306fcb02a_1529390039997_6e986c5e-50ef-7bdd-423d-f4b76df0a116.jpg",
            "unSignedUrl" : "http://d5rkhvvvxq6cw.cloudfront.net/medium_5b1f49efde677ee306fcb02a_1529390039997_6e986c5e-50ef-7bdd-423d-f4b76df0a116.jpg"
        }

    */

    const url = {
        defaultUrl: `/api/containers/${containerName}/download/${fileName}`,
        unSignedUrl: `http://${host}/api/containers/${containerName}/download/${fileName}`
    }

    return url
}


const convertFile = function(app, config, packageObj, ctx, res, persistentModel){
    return new Promise(function(resolve, reject){
        var FileDataSource = config.fileDataSource;
        var settings = app.dataSources[FileDataSource].settings;
        
        if (settings.provider === 'filesystem') {
            var rootFolder = settings.root;
            if(res.result && res.result.files && res.result.files.file && res.result.files.file.length){
                const file = res.result.files.file[0];
                var file_path = rootFolder + "/" + file.container + "/" + file.name;
                var file_medium_path = rootFolder + "/" + file.container + "/medium_" + file.name;
                var file_thumb_path  = rootFolder + "/" + file.container + "/thumb_" + file.name;
                //Converting medium type file..
                new Promise(function(resolve, reject){
                    if(config.fileProp && config.fileProp.variants.medium){
                        const image = sharp(file_path);
                        image
                        .metadata()
                        .then(metadata=>{
                            if(metadata.format === "jpeg"){
                                image.jpeg({quality: 30})
                            }

                            if(metadata.format === "png"){
                                image.withoutEnlargement()
                                image.png({compressionLevel: 3, adaptiveFiltering: true})
                            }

                            const width = config.fileProp.variants.medium.width || 300

                            if(width || config.fileProp.variants.medium.height){
                                image.resize(width, config.fileProp.variants.medium.height)
                            }
                            return image.toFile(file_medium_path)
                        })
                        .then(file=>{
                            resolve();
                        })
                        .catch(error=>{
                            reject(error);
                        })

                    //     sharp(file_path)
                    //     //.rotate()
                    //     // .resize(
                    //     //     config.fileProp.variants.medium.width, 
                    //     //     config.fileProp.variants.medium.height
                    //     // )
                    //     .jpeg({quality: 30})
                    //    // .png({compressionLevel: 5})
                    //     .toFile(file_medium_path, 
                    //         function (err, path) {
                    //             if(err){
                    //                 reject(err)
                    //             }else{
                    //                 resolve();
                    //             }
                    //     } );
                    }else{
                        resolve();
                    }
                })
                .then(data=>{
                    //Converting thumbnail type file..
                    return new Promise(function(resolve, reject){
                        if(config.fileProp && config.fileProp.variants.thumb){
                            sharp(file_path)
                                .rotate()
                                .resize(config.fileProp.variants.thumb.width, config.fileProp.variants.thumb.height)
                                .toFile(file_thumb_path, 
                                    function (err, path) {
                                        if(err){
                                            reject(err)
                                        }else{
                                            resolve();
                                        }
                                } );
                        }else{
                            resolve();
                        }
                    })
                })
                .then(done=>{
                    //Now save image to file and return the new response..
                    const url = getLocalImageUrl(ctx.req, file.name, file.container, config.fileProp.prefix);
                    return persistentModel.create({
                        name: file.name,
                        container: file.container,
                        url: url
                    })
                })
                .then(file=>{
                    resolve(file);
                })
                .catch(error=>{
                    reject(error);
                })
            }else{
                reject("Could not upload image some error occured");
            }
        }else{
            reject("Provider is not a filesystem");
        }
        
    });
}




module.exports = {
    convertFile,
}