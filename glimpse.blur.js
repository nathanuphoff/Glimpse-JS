var glimpse = function(document){ "use strict";
	
	// # Initialise
	// Set a class-name when a .canvas() or .image() are used.
	var classNames = {
		base: "preview", // Added to every element
		monochrome: "monochrome", // Added to monochrome images
	};	
	
	// WARNING: Changing following variables might break the library, proceed with caution.
	var type = "image/jpeg";
	var pool = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+/";
	var separateData = ",";
	var separateSize = ":";
	var tagImg 	   = "img";
	var tagCanvas  = "canvas";
	var hexPrefix  = "#";
	var monoPrefix = "m";
		
	// Generate all possible shorthand hex color combinations (#000 – #fff, 4.096 in total).
	var hexIndex = function(string){ // "0123456789ABCDEF"
		var length = string.length;
		var result = [];
		for (var a = 0; a < length; ++a){
			for (var b = 0; b < length; ++b){
				for (var c = 0; c < length; ++c){
					result.push([ string[a], string[b], string[c] ].join(""));
				}
			}
		}
		return result;
	}(pool.substr(0, 16));
	
	// Generate a two-byte key for each value in the hexIndex.
	var keyIndex = function(string){
		var length = string.length;
		var result = [];
		for (var a = 0; a < length; ++a){
			for (var b = 0; b < length; ++b){
				result.push([ string[a], string[b] ].join(""));
			}
		}
		return result;
	}(pool);
	
	// Generate a map to pair each key with its hex value and vice versa.
	var map = function(hexMap, keyMap){
		for (var i = 0; i < 4096; ++i){
			var hex = hexIndex[i], key = keyIndex[i];
			hexMap[hex] = key;
			keyMap[key] = hex;
		}
		return { hex: hexMap, key: keyMap };
	}({}, {});
	
	// Expose public methods
	return {
		create: encodeImage,
		base64: imageToBase64,
		canvas: imageToCanvas,
		image: imageToImg,
		meta: getImageMeta,
		get support(){ return !!getContext(createImage(tagCanvas)) }
	};

	
	// # Public methods
	// Load an image source URI/URL and generate a data-string from its imageData using canvas.
	function encodeImage(source, callback, quality, monochrome){
		
		var image = createImage(tagImg);
		image.onload = function(){
			
			var width  = image.naturalWidth;
			var height = image.naturalHeight;
			var scaled = resize(width, height, quality);
			var color  = null;
			
			var imageData = getData(image, scaled.width, scaled.height).data;
			var length = imageData.length;
			var i = 0;
			
			var result = []; // Here go the keys
			var a = 0, b = 0, c = 0;
			var colorIndex = [ 0, 0, 0 ]; // 
			var count = 0; // 
			
			if (!monochrome){
				
				for (i = 0; i < length; i += 4){
					
					a = imageData[i  ];	colorIndex[0] += a;
					b = imageData[i+1];	colorIndex[1] += b;
					c = imageData[i+2];	colorIndex[2] += c;
					
					if (monochrome !== false) monochrome = a === b && b === c;
					result[count++] = channelToKey(a, b, c);
				
				}
				color = getAverageColor(colorIndex, count);
				
			}

			if (monochrome === true){
				
				result = [], count = 0; // reset image
				// scaled.width += 1000; // map preview width to private key-range
				var getAverage = color === null; // c
				
				for (i = 0; i < length; i += 12){
					
					var trio = [];
					for (var pixel = 0; pixel < 12; pixel += 4){
						
						a = imageData[i+pixel  ]; // r
						b = imageData[i+pixel+1]; // g
						c = imageData[i+pixel+2]; // b
						
						trio.push(Math.round((a + b + c) / 3)); // push grayscale value
						
						if (getAverage && a){
							colorIndex[0] += a; // r
							colorIndex[1] += b; // g
							colorIndex[2] += c; // b
						}
						
					}
					result[count++] = channelToKey(trio[0], trio[1], trio[2]);
					
				}
				color = getAverage ? getAverageColor(colorIndex, count * 4) : color;
				
			}
			
			// Compose the data-string and pass it to a callback function.
			result = [
				(monochrome ? monoPrefix : hexPrefix) + color, // Prefix with Average color...
				width, separateSize, height, separateData, // and dimensions.
				keyIndex[scaled.width], result.join("") // Image data
			].join("");
			
			callback(result, {
				width: width,
				height: height,
				color: hexPrefix + color,
				black: hexPrefix + hexToMonochrome(color),
				monochrome: monochrome
			});
			
		}
		if (!isBase64(source)) image.crossOrigin = "anonymous";
		image.src = source;
		
	}
	
	// Pass a base64-encoded image to the callback
	function imageToBase64(string, callback, blur, width, height){ 
		decodeImage(string, callback, width, height); 
	}
	
	// Pass a canvas-element image to the callback
	function imageToCanvas(string, callback, blur, width, height){ 
		decodeImage(string, callback, width, height, tagCanvas);
	}
	
	// Pass an img-element to the callback
	function imageToImg(string, callback, blur, width, height){ 
		decodeImage(string, callback, width, height, tagImg);
	}
	
	// Draw a base64-encoded jpeg-image from a data-string created by preview.encode() using canvas.
	function decodeImage(input, callback, width, height, element){
		
		// If a base64-encoded image is passed at this stage its expected to be optimised so it
		// won’t affect its quality or resolution.
		if (isBase64(input)) return encodeImage(input, function(source){
			decodeImage(source, callback, element, width, height);
		}, false);
			
		// else...
		// Extract image data from the string parameter.
		var source = input.split(separateData);
		var data = source[1].match(/.{1,2}/g);
		
		// Extact meta data from the source prefix.
		var meta = getImageMeta(source[0]);
		if (!isNaN(width)){
			if (!isNaN(height)) meta.height = height;
			else meta.height = Math.round(meta.height * width / meta.width);
			meta.width = width;
		}
		
		var previewWidth  = keyIndex.indexOf(data.shift());
		var previewHeight = data.length / previewWidth; // calculate the preview’s height
		if (meta.monochrome) previewHeight = 0|previewHeight * 3; // compensate for the smaller data.length 
		
		// Prepare a html canvas.
		var canvas = createImage(tagCanvas, previewWidth, previewHeight);
		var imageData = createData(canvas, previewWidth, previewHeight);
		var length = imageData.data.length;
		var i = 0;
		
		// Set the canvas image data.
		var index = 0, current = 0;
		if (meta.monochrome) for (i = 0; i < length; i += 12){
			
			current = keyToChannel(data[index++]);
			var a = current[0], b = current[1], c = current[2];
			
			imageData.data[i  ] = a;
			imageData.data[i+1] = a;
			imageData.data[i+2] = a;
			imageData.data[i+3] = 255;
			
			imageData.data[i+4] = b; 
			imageData.data[i+5] = b;
			imageData.data[i+6] = b;
			imageData.data[i+7] = 255;
			
			imageData.data[i+8]  = c; 
			imageData.data[i+9]  = c
			imageData.data[i+10] = c;
			imageData.data[i+11] = 255;
			
		}
		else for (i = 0; i < length; i += 4){
			
			current = keyToChannel(data[index++]);
			imageData.data[i  ] = current[0];
			imageData.data[i+1] = current[1];
			imageData.data[i+2] = current[2];
			imageData.data[i+3] = 255;
			
		}
		setData(canvas, imageData);
		
		// Load and redraw the canvas image to its given dimensions,  
		// then pass it to the callback as a base64 encoded jpeg-image.
		var image = createImage(tagImg);
		image.onload = function(){
			
			var result = drawImage(image, meta.width, meta.height);
			
			// Blur using glimpse.blur if its is available
			if (typeof glimpse.blur === "function"){
				var imageData = getData(result, meta.width, meta.height);
				var stackBlur = glimpse.blur(imageData, meta.width, meta.height);
				setData(result, stackBlur);
			}
			
			if (element !== tagCanvas) result = result.toDataURL(type);
			if (element){
				
				if (element === tagImg){
					element = createImage(element, meta.width, meta.height);
					element.src = result;
					result = element;
				}
				
				var className = classNames.base;
				if (meta.monochrome) className += " " + classNames.monochrome;
				result.className = className;
				
			}
			
			callback(result, meta);
			
		}
		image.src = canvas.toDataURL(type);

	}
	
	// Extract meta data from an encoded string.
	function getImageMeta(string, key){
		
		string = string.split(separateData)[0];
		
		var dimensions = string.substr(7).split(separateSize);
		var color = string.substr(1, 6);
		var monochrome = string[0] === monoPrefix;
		
		var object = {
			width:  parseFloat(dimensions[0]),
			height: parseFloat(dimensions[1]),
			color: hexPrefix + color,
			black: hexPrefix + hexToMonochrome(color),
			monochrome: monochrome
		};
		
		return typeof key === "string" ? object[key] : object;
		
	}

	
	// # Private functions
	// Utilities
	function isBase64(value){ return /^data:image/.test(value) }
	
	function limit(value, min, max){ return value < min ? min : value > max ? max : value }
	
	function resize(width, height, quality){
		
		if (quality !== false){
		
			quality = !isNaN(quality) && limit(quality, 1, 100) || 50;
			var resolution = quality / 1500;
			var treshold = quality * 1.28;
			
			var ratio = width / height;
			if (ratio > 1){ 
				width = Math.round(limit(width * resolution, 6, treshold));
				height = Math.round(width / ratio);
			}
			else {
				height =  Math.round(limit(height * resolution, 6, treshold));
				width = Math.round(height * ratio);
			}
		
		}
		return { width: width, height: height };
	
	}
		
	// Color
	function channelToKey(a, b, c){
		return map.hex[get(a) + get(b) + get(c)];
		function get(value){ return pool[Math.round(value / 17)] }
	}
	
	function keyToChannel(key){
		var hex = map.key[key];
		return [ get(hex[0]), get(hex[1]), get(hex[2]) ];
		function get(value){ return parseInt(value + value, 16) }
	}
	
	function getAverageColor(average, index){
		index = !isNaN(index) ? index : 1;
		var a = average[0] / index, b = average[1] / index, c = average[2] / index;
		return channelToHex(a) + channelToHex(b) + channelToHex(c);
	}
	
	function channelToHex(channel) {
		var hex = Math.round(channel).toString(16);
		return hex.length === 1 ? 0 + hex : hex;
	}
	
	function hexToMonochrome(hex){
		hex = hex.match(/.{1,2}/g);
		hex = parseInt(hex[0], 16) + parseInt(hex[1], 16) + parseInt(hex[2], 16)
		hex = channelToHex(Math.round(hex / 3));
		return hex + hex + hex;
	}
	
	// Document
	function createImage(tag, width, height){
		var image = document.createElement(tag);
		if (width) image.width = width;
		if (height) image.height = height;
		return image;
	}
	
	// Canvas
	function getContext(canvas){ return canvas.getContext("2d") }
	
	function getData(image, width, height){
		return getContext(drawImage(image, width, height)).getImageData(0, 0, width, height);
	}
	
	function setData(canvas, data){
		getContext(canvas).putImageData(data, 0, 0);
	}
	
	function createData(canvas, width, height){
		return getContext(canvas).createImageData(width, height);
	}
	
	function drawImage(image, width, height){
		var canvas = createImage(tagCanvas, width, height);
		getContext(canvas).drawImage(image, 0, 0, width,  height);
		return canvas;
	}
	
}(document);

// The following method to blur image data comes from StackBlur()
// made by flozz (https://github.com/flozz/StackBlur):
/*
StackBlur - a fast almost Gaussian Blur For Canvas
Version:    0.5
Author:     Mario Klingemann
Contact:    mario@quasimondo.com
Website:    http://www.quasimondo.com/StackBlurForCanvas
Twitter:    @quasimondo
In case you find this class useful - especially in commercial projects -
I am not totally unhappy for a small donation to my PayPal account
mario@quasimondo.de
Or support me on flattr:
https://flattr.com/thing/72791/StackBlur-a-fast-almost-Gaussian-Blur-Effect-for-CanvasJavascript
Copyright (c) 2010 Mario Klingemann
Permission is hereby granted, free of charge, to any person
obtaining a copy of this software and associated documentation
files (the "Software"), to deal in the Software without
restriction, including without limitation the rights to use,
copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the
Software is furnished to do so, subject to the following
conditions:
The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
OTHER DEALINGS IN THE SOFTWARE.
*/
glimpse.blur = function(imageData, width, height){
	
	var radius = 0|(Math.sqrt(width * 10));
	if (radius > 150) radius = 150;
	
	var mul_table = [
		512,512,456,512,328,456,335,512,405,328,271,456,388,335,292,512,
		454,405,364,328,298,271,496,456,420,388,360,335,312,292,273,512,
		482,454,428,405,383,364,345,328,312,298,284,271,259,496,475,456,
		437,420,404,388,374,360,347,335,323,312,302,292,282,273,265,512,
		497,482,468,454,441,428,417,405,394,383,373,364,354,345,337,328,
		320,312,305,298,291,284,278,271,265,259,507,496,485,475,465,456,
		446,437,428,420,412,404,396,388,381,374,367,360,354,347,341,335,
		329,323,318,312,307,302,297,292,287,282,278,273,269,265,261,512,
		505,497,489,482,475,468,461,454,447,441,435,428,422,417,411,405,
		399,394,389,383,378,373,368,364,359,354,350,345,341,337,332,328,
		324,320,316,312,309,305,301,298,294,291,287,284,281,278,274,271,
		268,265,262,259,257,507,501,496,491,485,480,475,470,465,460,456,
		451,446,442,437,433,428,424,420,416,412,408,404,400,396,392,388,
		385,381,377,374,370,367,363,360,357,354,350,347,344,341,338,335,
		332,329,326,323,320,318,315,312,310,307,304,302,299,297,294,292,
		289,287,285,282,280,278,275,273,271,269,267,265,263,261,259 ];
	
	
	var shg_table = [
		9, 11, 12, 13, 13, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17,
		17, 17, 17, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 18, 19,
		19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 20, 20, 20,
		20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 21,
		21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 21,
		21, 21, 21, 21, 21, 21, 21, 21, 21, 21, 22, 22, 22, 22, 22, 22,
		22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22,
		22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 22, 23,
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
		23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23, 23,
		23, 23, 23, 23, 23, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24,
		24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24, 24 ];

	// Return
	return stackBlur(imageData, width, height);
	
	function stackBlur(imageData, width, height){
		
		var pixels = imageData.data;
		var i, x, y;
		var p, yp, yi, yw;
		var r_sum, g_sum, b_sum;
		var r_out_sum, g_out_sum, b_out_sum;
		var r_in_sum, g_in_sum, b_in_sum;
		var pr, pg, pb, rbs;
		
		var div = radius + radius + 1;
		var widthMinus1  = width - 1;
		var heightMinus1 = height - 1;
		var radiusPlus1  = radius + 1;
		var sumFactor = radiusPlus1 * (radiusPlus1 + 1) / 2;
		
		var stackStart = new BlurStack();
		var stackEnd;
		var stack = stackStart;
		
		for (i = 1; i < div; ++i){
			stack = stack.next = new BlurStack();
			if (i === radiusPlus1) stackEnd = stack;
		}
		stack.next = stackStart;
		var stackIn = null;
		var stackOut = null;
		
		yw = yi = 0;
		
		var mul_sum = mul_table[radius];
		var shg_sum = shg_table[radius];
		
		for (y = 0; y < height; y++){
			
			r_in_sum = g_in_sum = b_in_sum = r_sum = g_sum = b_sum = 0;
			
			r_out_sum = radiusPlus1 * (pr = pixels[yi]);
			g_out_sum = radiusPlus1 * (pg = pixels[yi+1]);
			b_out_sum = radiusPlus1 * (pb = pixels[yi+2]);
			
			r_sum += sumFactor * pr;
			g_sum += sumFactor * pg;
			b_sum += sumFactor * pb;
			
			stack = stackStart;
			
			for (i = 0; i <= radius; ++i){
				stack.r = pr;
				stack.g = pg;
				stack.b = pb;
				stack = stack.next;
			}
			
			for (i = 1; i <= radius; ++i){
				
				p = yi + ((widthMinus1 < i ? widthMinus1 : i) << 2);
				r_sum += (stack.r = (pr = pixels[p])) * (rbs = radiusPlus1 - i);
				g_sum += (stack.g = (pg = pixels[p+1])) * rbs;
				b_sum += (stack.b = (pb = pixels[p+2])) * rbs;
				
				r_in_sum += pr;
				g_in_sum += pg;
				b_in_sum += pb;
				
				stack = stack.next;
				
			}
			
			stackIn = stackStart;
			stackOut = stackEnd;
			
			for (x = 0; x < width; ++x){
				
				pixels[yi]   = (r_sum * mul_sum) >> shg_sum;
				pixels[yi+1] = (g_sum * mul_sum) >> shg_sum;
				pixels[yi+2] = (b_sum * mul_sum) >> shg_sum;
				
				r_sum -= r_out_sum;
				g_sum -= g_out_sum;
				b_sum -= b_out_sum;
				
				r_out_sum -= stackIn.r;
				g_out_sum -= stackIn.g;
				b_out_sum -= stackIn.b;
				
				p =  (yw + ((p = x + radius + 1) < widthMinus1 ? p : widthMinus1)) << 2;
				
				r_in_sum += (stackIn.r = pixels[p]);
				g_in_sum += (stackIn.g = pixels[p+1]);
				b_in_sum += (stackIn.b = pixels[p+2]);
				
				r_sum += r_in_sum;
				g_sum += g_in_sum;
				b_sum += b_in_sum;
				
				stackIn = stackIn.next;
				
				r_out_sum += (pr = stackOut.r);
				g_out_sum += (pg = stackOut.g);
				b_out_sum += (pb = stackOut.b);
				
				r_in_sum -= pr;
				g_in_sum -= pg;
				b_in_sum -= pb;
				
				stackOut = stackOut.next;
				
				yi += 4;
				
			}
			yw += width;
			
		}
		
		for (x = 0; x < width; ++x){
			
			g_in_sum = b_in_sum = r_in_sum = g_sum = b_sum = r_sum = 0;
			
			yi = x << 2;
			r_out_sum = radiusPlus1 * (pr = pixels[yi]);
			g_out_sum = radiusPlus1 * (pg = pixels[yi+1]);
			b_out_sum = radiusPlus1 * (pb = pixels[yi+2]);
			
			r_sum += sumFactor * pr;
			g_sum += sumFactor * pg;
			b_sum += sumFactor * pb;
			
			stack = stackStart;
			
			for (i = 0; i < radiusPlus1; ++i){
				stack.r = pr;
				stack.g = pg;
				stack.b = pb;
				stack = stack.next;
			}
			
			yp = width;
			
			for (i = 1; i <= radius; ++i){
				
				yi = (yp + x) << 2;
				
				r_sum += (stack.r = (pr = pixels[yi])) * (rbs = radiusPlus1 - i);
				g_sum += (stack.g = (pg = pixels[yi+1])) * rbs;
				b_sum += (stack.b = (pb = pixels[yi+2])) * rbs;
				
				r_in_sum += pr;
				g_in_sum += pg;
				b_in_sum += pb;
				
				stack = stack.next;
				
				if (i < heightMinus1) yp += width;
				
			}
			
			yi = x;
			stackIn = stackStart;
			stackOut = stackEnd;
			for (y = 0; y < height; ++y){
				
				p = yi << 2;
				pixels[p]   = (r_sum * mul_sum) >> shg_sum;
				pixels[p+1] = (g_sum * mul_sum) >> shg_sum;
				pixels[p+2] = (b_sum * mul_sum) >> shg_sum;
				
				r_sum -= r_out_sum;
				g_sum -= g_out_sum;
				b_sum -= b_out_sum;
				
				r_out_sum -= stackIn.r;
				g_out_sum -= stackIn.g;
				b_out_sum -= stackIn.b;
				
				p = (x + (((p = y + radiusPlus1) < heightMinus1 ? p : heightMinus1) * width)) << 2;
				
				r_sum += (r_in_sum += (stackIn.r = pixels[p]));
				g_sum += (g_in_sum += (stackIn.g = pixels[p+1]));
				b_sum += (b_in_sum += (stackIn.b = pixels[p+2]));
				
				stackIn = stackIn.next;
				
				r_out_sum += (pr = stackOut.r);
				g_out_sum += (pg = stackOut.g);
				b_out_sum += (pb = stackOut.b);
				
				r_in_sum -= pr;
				g_in_sum -= pg;
				b_in_sum -= pb;
				
				stackOut = stackOut.next;
				
				yi += width;
				
			}
		}
		
		return imageData;
	}
	
	function BlurStack(){
		this.r = 0;
		this.g = 0;
		this.b = 0;
		this.a = 0;
		this.next = null;
	}

}