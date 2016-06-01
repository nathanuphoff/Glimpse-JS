var reveal = function(document){ "use strict";
	
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
			
			var imageData = getData(image, scaled.width, scaled.height);
			var result = []; // Here go the keys
			var colorIndex = [ 0, 0, 0 ]; // 
			var count = 0; // 
			
			if (!monochrome){
				
				for (var i = 0, length = imageData.length; i < length; i += 4){
					
					var a = imageData[i  ];	colorIndex[0] += a;
					var b = imageData[i+1];	colorIndex[1] += b;
					var c = imageData[i+2];	colorIndex[2] += c;
					
					if (monochrome !== false) monochrome = a === b && b === c;
					result[count++] = channelToKey(a, b, c);
				
				}
				color = getAverageColor(colorIndex, count);
				
			}

			if (monochrome === true){
				
				result = [], count = 0; // reset image
				// scaled.width += 1000; // map preview width to private key-range
				var getAverage = color === null; // c
				
				for (var i = 0, length = imageData.length; i < length; i += 12){
					
					var trio = [];
					for (var pixel = 0; pixel < 12; pixel += 4){
						
						var a = imageData[i+pixel  ]; // r
						var b = imageData[i+pixel+1]; // g
						var c = imageData[i+pixel+2]; // b
						
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
	function imageToBase64(string, callback, width, height){ 
		decodeImage(string, callback, width, height); 
	}
	
	// Pass a canvas-element image to the callback
	function imageToCanvas(string, callback, width, height){ 
		decodeImage(string, callback, width, height, tagCanvas);
	}
	
	// Pass an img-element to the callback
	function imageToImg(string, callback, width, height){ 
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
		
		// Set the canvas image data.
		var index = 0, current = 0;
		if (meta.monochrome) for (var i = 0, length = imageData.data.length; i < length; i += 12){
			
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
		else for (var i = 0, length = imageData.data.length; i < length; i += 4){
			
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
			width:  dimensions[0],
			height: dimensions[1],
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
		return getContext(drawImage(image, width, height)).getImageData(0, 0, width, height).data;
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