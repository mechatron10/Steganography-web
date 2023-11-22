var fs = require('fs');
var PNG = require('pngjs').PNG;
var express = require('express');
var multer  = require('multer');
var upload = multer({ dest: 'uploads/' });
var crypto = require('crypto');
var app = express();
const PORT =  3000;
var stego = require('./stego');
var path=require('path');

app.use(express.static('static'));
app.set('views', './views')
app.set('view engine', 'ejs');
/*******this engine is changed by me so that I can allow rendering in the HTML format instead of the jade format */
// app.set('view engine', 'jade');
app.get('/', function (req, res) {
  res.sendFile('index.html', {root: './client'});
});

app.get('/stegano_encrypt', function (req, res) {
    res.sendFile('stegano_encrypt.html', {root: './client'});
});

//The upload.array('files',2) indicates that from the form with the field as the file we can have two inputs with
//name attribute as file and we will recieve the uploaded files in the upload.array('files',2)
app.post('/stegano_encrypt', upload.array('files',2), function (req, res, next) {
    console.log("inside the encryption process");
    console.log(req.files);
    console.log(req.body);

    //Output directories
    var original_file_path = 'static/data/original_files/'+req.files[0].originalname;//creating a original file_path 
    var encoded_file_path = 'static/data/processed_files/'+req.files[0].originalname;//creating a encoded_file_path
    
    //This rename files below move the files to be encoded to the original_file_path directory of the server 
     //and once the process of moving is complete the call back function is called 
     //The files are stored in the original_files folder because it is easier to manage the files from there
    fs.rename(req.files[0].path, original_file_path, function(){

        //Process image file
        //The png-js module, as the name suggests, is primarily designed for working with PNG files. It provides
        // functionality to read, create, and manipulate PNG images
        // For example, for JPEG images, you can use the jpeg-js module, and for GIF images, you can use the gifwrap module. Each module 
        //is specifically designed to handle a particular image format
        //The createrRead stream reads the data in chunks from the path specified and memory efficiency and the 
        /*The 'parsed' event is indeed a built-in event emitted by the PNG object when the parsing of the PNG image 
        data is completed. It is triggered after the data has been parsed and the PNG object has processed the 
        image data
        THe new PNG is the object that is used to recieve the data from the createReadStream and it encodes that data
        //in the PNG form this data is defined inside the data property of the new object and this new object is refered 
        as the this in the logic inside the code 
        also the .on is a listener which is used to emit the event parsed (built-in) which tells that the parsing 
        of the png file is now complete and now we will process the data of the obect of the module PNG
        various other properties like the the height and the width of the image that has been read  
        1 this.width and this.height are used to get the dimensions of the parsed PNG image.
        2 this.data is an array that contains the pixel data of the parsed PNG image. The loop in the code snippet 
        is used to modify the pixel data based on the processed data obtained from the stego.encodeDataFromPixelArray function.
        */
        fs.createReadStream(original_file_path).pipe(new PNG({
            filterType: 4
        })).on('parsed', function() {

            //stego.reformatPixelArrayToBufferData();
            var pw = req.body.pw || null;
            var processed;
           
                var text = req.body.text_data;//as the req object is recieved from the form we we using it as the 
                //text_data in the form submission filed the text_data serves as the name of the text_data 
                //attribute
                
                console.log('Processing text.');
                if (pw){
                    // The crypto.createCipher() method returns an encryption object, which is used to specify 
                    // the encryption algorithm and the encryption key (password). Once the encryption object is 
                    // created, you use the update() method to process the data you want to encrypt. This method 
                    // takes the data and returns the encrypted result in chunks. If there are any remaining bits 
                    // that need to be processed after all the data is updated, the final() method is used to 
                    // handle those.
                    //this encrypt variable is used to store 
                    //the ciphter text encrypted form of the password that is generated from the aes-256-cbc method 
                    var encrypt = crypto.createCipher('aes-256-cbc', pw);
                    text = encrypt.update(text, 'utf8', 'binary') + encrypt.final('binary');//this text is generated in the 
                    //binary form
                }
                //console.log(text);
                processed = stego.encodeDataFromPixelArray(stego.parseImageBufferToPixelArray(this)  , text, 'text');
            //The encode_type is recieved from the request .
            var n = 0;
            for (var y = 0; y < this.height; y++) {
                for (var x = 0; x < this.width; x++) {
                    var idx = (this.width * y + x) << 2;

                    if(n < processed.length) {
                        this.data[idx] =   processed[n].r;
                        this.data[idx+1] = processed[n].g;
                        this.data[idx+2] = processed[n].b;
                        this.data[idx+3] = processed[n].alpha;
                        n++;
                    }

                }
            }
            //this is the png image that is now modified with the information of the processed and the .pack()
            //is used to convert this image into a png packet which can be written or transported to enocded_file_path
            //.pipe means the output from the pack() function is used to write the file in the encoded_file_path
            //data is written in the form of small chunks and this process of writing the data into the file is 
            //represented by a stream object(everything in javascript is a object)
            //At last when the write operation is completed then a event listener .on is added in the stream process
            //with the event name finished which has a call back function that takes the user to another page using the 
            //res.redirect('path of the web page to which the user is directed to ')
            //in the processed file directory we have written the PNG file where the user will be directed to 
              var stream = this.pack().pipe(fs.createWriteStream(encoded_file_path));
            // stream.on('finish', function(){
            //     // Instead of redirecting, send a download link response
            //     var downloadLink = '/download/' + req.files[0].originalname; // Modify the link as needed
            //     res.render('download', { downloadLink: downloadLink });
            // });
               stream.on('finish', function(){
                // Instead of rendering an HTML page, send the image file as a response
                console.log('encoded_file_path=',encoded_file_path);
                res.sendFile(path.resolve(encoded_file_path), function(err) {
               if(err){
            // Handle errors, such as file not found
                 res.status(500).send(err);
              }
               else {
            // Optionally, you can delete the file after it's sent
                 fs.unlinkSync(encoded_file_path);
               }
          });
        });    //marker
       });
     });

 });

app.get('/stegano_decrypt', function (req, res) {
    res.sendFile('stegano_decrypt.html', {root: './client'});
});

app.post('/stegano_decrypt', upload.single('original_image'), function (req, res, next) {

    console.log(req.file);
    console.log(req.body);
    //Process image file
    //the req.file.path gets the path of the uploaded file from where we can read the file from 
    fs.createReadStream(req.file.path).pipe(new PNG({
        filterType: 4
    })).on('parsed', function() {

        var decoded = stego.decodeDataFromPixelArray(stego.parseImageBufferToPixelArray(this), req.body.expected_type);
        var pw = req.body.pw || null;
        //we can use the try and the catch block anywhere in the javascript for the error handling 
        //and in the below code the if the pw is present and the decryption process is done using that password and 
        //if the password is not correct then decrypting process will fail and the error will be handled in the 
        //errr block where the message of incorrect or here the bad text password is displayed and if there is no error 
        //then the error block will be ignored and the output of text is provided 
            var text = decoded.data;
            try {
                if (pw) {
                    var decrypt = crypto.createDecipher('aes-256-cbc', pw);
                    text = decrypt.update(text, 'binary', 'utf8') + decrypt.final('utf8');
                }
                //console.log(text)
                res.render('Output', {
                    text: text
                });
            }
            catch (err) {
                res.render('error', {
                    text: 'Password is incorrect '
                });
            }
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
app.get('/decode', function (req, res) {
    res.sendFile('decode.html', {root: './client'});
});
