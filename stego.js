var stego = {};


//Takes a png.js image buffer and turns it into a pixel array
stego.parseImageBufferToPixelArray = function(buffer) {

    var image = [];
   //buffer is the object or the instance of the png object that is made 
   //The buffer.width tells the number of the pixel of the image per row
   //The buffer.height tells the number of the pixel of the image per column
   //The buffer.data contains the data of the color of each of the pixel and since each pixel has four values associated 
   //with it hence the  four consecutive values of the data represent 4 things r,g,b,alpha .
   //now we can have the the index of the pixel as the buffer.width*y+x these ,y number of the rows are skipped 
   //and the x number of the pixels of the columns are skipped 
   //hence the first four values are being stored in the form of the object of the pixel and then complete array 
   //with all these properties is returned 
    for (var y = 0; y < buffer.height; y++) {
        for (var x = 0; x < buffer.width; x++) {
            var idx = (buffer.width * y + x) << 2;
            image.push({r: buffer.data[idx], g: buffer.data[idx+1], b: buffer.data[idx+2], alpha: buffer.data[idx+3]});
        }
    }

    return image;
};


stego.reformatPixelArrayToBufferData = function(pixelArray) {

    var bufferData = [];
    for(var i = 0; i < pixelArray; i++) {
        bufferData.push(pixelArray[i].r);
        bufferData.push(pixelArray[i].g);
        bufferData.push(pixelArray[i].b);
        bufferData.push(pixelArray[i].alpha);
    }

};


//Takes a pixel array and encodes binary data into the pixel array
stego.encodeDataFromPixelArray = function(pixelArray, data, dataType) {
    var encodedPixelArray = pixelArray;
    var pixel, byte;

    for(var i = 0; i < data.length; i++) {
        if (dataType == 'text') {//THe data type tells the type of the data that is encoded 
            byte = data[i].charCodeAt(0);//this charCode at (0) is used to get the ASCII value of the character 
            //that is being encoded
        }
        else {
            byte = data[i];
        }
        pixel = pixelArray[i];//now the ith pixel from the start is used to encode the data 
        pixel = stego.encodeByteInPixel(pixel, byte);

        //For the alpha channel the last bit position values are used to mark the ending of the data and if the last 
        //alpha bit is 1 then this marks the end of the data and  if the last bit if 0 then it means that we still have 
        //some data to be read hence we can stop parsing at a point when the last bit value of the MSB value of the bit 
        //that is present in the 0th position is not 1 
        //Since the last value is used to indicate whether we have reached the end or not hence the data to be stored in 
        //the alpha value of the pixel is stored in the 1st and the 2nd bit position not the 0th and the 1st bit position
        //Hence we have done the position=i%2-1 for i=6 and i=7
        if (i === data.length-1) {
            pixel['alpha'] |= (1 << 0); //sets to 1
        }
        else {
            pixel['alpha'] &= ~(1 << 0); //sets to 0
        }
        encodedPixelArray[i] = pixel;
    }

    return encodedPixelArray;
};

stego.encodeByteInPixel = function(pixel, byte) {
    var bit;
    for (var i = 0; i < 8; i++) {
        // get value of bit
        //we are encoding the values in the bit by bit fashion one bit of the byte at a time from the left most 
        //The byte of the character which represents its ASCII value is encoded in the bit by bit fashion from 
        //left to right that is if the byte is 7,6,5,4,3,2,1,0 then firstly 7 value is written in the red pixel  
        if (byte & (1 << 7-i)) {
            bit = 1;
        }
        else {
            bit = 0;
        }

        // encode bit in appropriate position in appropriate channel
        //THe encoding is done from the left to the right part that is if complete part is 
        //7,6,5,4,3,2,1,0 we start encoding the bit values from the right to left 
        if (i == 0 || i == 1) {
            pixel = stego.encodeBitInChannel(pixel, 'r', bit, i);
        }
        else if (i == 2 || i == 3) {
            pixel = stego.encodeBitInChannel(pixel, 'g', bit, i % 2);
        }
        else if (i == 4 || i == 5) {
            pixel = stego.encodeBitInChannel(pixel, 'b', bit, i % 2);
        }
        else {
            // position-1 to do LSBs 2 and 1 instead of 1 and 0
            pixel = stego.encodeBitInChannel(pixel, 'alpha', bit, (i % 2)-1);
        }
    }
    return pixel;
};

stego.encodeBitInChannel = function(pixel, channel, bit, position) {
    //the least significant bits of the channel are modified first 
     //in the below lines of the code the first bit from the left side of the TWO LSB of RGB are set first and then 
     //the other bits are set or unset
    if (bit) {
       pixel[channel] |= (1 << 1-position);
    }
    else {
        // set bit to 0
        pixel[channel] &= ~(1 << 1-position);//least significant bits are modified first and since we are encoding 
        //two bits in each of he pixels 0 and 1 hence we are doing 1-position
    }
    return pixel;
};

//Takes a pixel array and encodes binary data into the pixel array
stego.decodeDataFromPixelArray = function(pixelArray, dataType) {

    var binaryArrayOfData = [];
    var pixel, byte, textResult = '';
    if(dataType !== 'text') {
        textResult = [];
    }
    for(var i = 0; i < pixelArray.length; i++) {
        pixel = pixelArray[i];
        //byte is made again and again form the pixel element pixelArray is array of obects containing attributes
        //r,g,b,alpha pixel values 
        //The byte is recieved and then the byte is convert to a character and the text is formed 
        byte = stego.decodeByteFromPixel(pixel);
        if(dataType === 'text') {
            textResult += String.fromCharCode(byte);//we are converting the byte to its character form and then it
            //it is appended in the end of the string message or the textResult
        }
        else { //assume binary
            //textResult.push(byte);
            textResult += String.fromCharCode(byte);
        }
        if (pixel['alpha'] & (1 << 0)) {
            break;
        }
    }
    return {
        dataType: dataType,
        data: textResult
    };
};

stego.decodeByteFromPixel = function(pixel) {
    //this decoding code has the same logic as the encoding but instead of changing the bit we are doing the and of 
    //the bit at the position and 1 at that position that is pixel[channel]&(1<<7-i) if this gives us 1 then the data is 
    //present in the image is 1 and if it is not 1 then it is 0
    var byte = 0;
    for (var i = 0; i < 8; i++) {

        // decode bit from appropriate position in appropriate channel
        if (i == 0 || i == 1) {
            bit = stego.decodeBitFromChannel(pixel, 'r', i);
        }
        else if (i == 2 || i == 3) {
            bit = stego.decodeBitFromChannel(pixel, 'g', i % 2);
        }
        else if (i == 4 || i == 5) {
            bit = stego.decodeBitFromChannel(pixel, 'b', i % 2);
        }
        else {
            // position-1 to do LSBs 2 and 1 instead of 1 and 0
            bit = stego.decodeBitFromChannel(pixel, 'alpha', (i % 2)-1);
        }

        if (bit) {
            byte |= (1 << 7-i);
        }
    }
    return byte;
};

stego.decodeBitFromChannel = function(pixel, channel, position) {
    var bit;
    // get value of bit
    if (pixel[channel] & (1 << 1-position)) {
        bit = 1;
    }
    else {
        bit = 0;
    }
    return bit;
};



module.exports = stego;
