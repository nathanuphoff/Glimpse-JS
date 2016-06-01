Reveal JS is a dependency-free image library to create image previews that load in an instant. 

Inspiration was drawn from Facebook and Medium where tiny placeholder images are rendered blurry, until the actual full-size completes loading. This technique greatly reduces perceived load time, and gives page visitors a glimpse of an image instead of a blank space.

Image previews are encoded with a propitiatory data-string optimised for compression. Alternatively, a base64-encoded image can be passed to the image-decoding methods. While encoding image previews, optional parameters can be set for image quality, and conversion to monochrome.

To blur a preview image CSS filter-support is required. 

# Demo
Coming soon...

# How it works
While creating preview a source image is loaded, scaled down and drawn to a canvas. The RGB value for each pixel is encoded to a two-byte key that maps to a hex shorthand code (#000–#fff) which result in 4.096 color combinations. If an image is monochrome, a single key is used for three pixels.

While decoding an image the keys are mapped to their respective color values. These values are written to the imageData of a canvas element which in turn is passed to a callback function.

A simple test with 23 coloured images (3.5MB) lead to a combined preview transfer size of 9KB compressed. Because its a string all 23 images can be transferred as a single file.

# Usage
## Creating a preview image
An image preview is created using reveal.create(), the encoded string passed to a callback function, from where it can be uploaded the server to be stored. 

Alternatively, an existing base64-encoded thumbnail image can be passed to an image decoding method (below), which leads to the same result.

```
// Using a URL...
reveal.create("/image.jpg", callback);

// ...or base64-encoded string.
reveal.create(base64, callback);

// Preview quality and monochromatic conversion can be set with the third and fourth parameters...
reveal.create("/image.jpg", callback, quality, monochrome);
```
The quality parameter expects a number between 0 and 100 which defaults to 50. 

The monochrome parameter expects a boolean. Using monochrome preview images reduces the string size even further. If monochrome is set to true, all images will be rendered in black and white. Already monochrome images will automatically be detected and encoded accordingly. If monochrome is set to false, all images will be rendered in RGB regardless of whether the image has color (not advised).

The callback arguments are a propitiatory encoded data-string, and an object containing meta-data.
```
function callback(image, meta){
	// image {string}: an image data-string.
	// meta {object}: {
	//	 width {number}: the image naturalWidth.
	//	 height {number}: the image naturalHeight.
	// color {string}: the average hex color.
	// black {string}: the average brightness as a hex color.
	// monochrome {boolean}: true if the image is monochromatic
	// }
}
```

## Decoding a preview image
Reveal JS has three methods for generating an image from an encoded data-string. It accepts both a Reveal JS propitiatory string and a base64-encoded image, note that the latter does not affect the dimensions (quality) of the preview image.

Methods to decode a preview image are; .base64(), .canvas(), and .image(). These methods are identical except for the first argument passed to the callback function.

- reveal.base64() passes a base64-encoded string,
- reveal.image() passes a img-element,
- and reveal.canvas() passes a canvas-element.

If an element is passed, the element width, height, and class attributes are set according to the image properties.

```
// Using a propitiatory string...
reveal.image(reveal64, callback);

// ...or base64-encoded string.
reveal.image(base64, callback);

// Optionally the width and height can be overridden for the resulting preview image.
reveal.create("/image.jpg", callback, width, height);
```
By default the dimensions of the original image are set as the width and height which leads to faster rendering by the browser.


The callback arguments are a propitiatory encoded data-string, and an object containing meta-data.
```
function callback(result, meta){
	// result {string || element}: an base64-encoded image or an element depending on the method used.
	// meta {object}: {
	//	 width {number}: the image width.
	//	 height {number}: the image height.
	// color {string}: the average hex color.
	// black {string}: the average brightness as a hex color.
	// monochrome {boolean}: true if the image is monochromatic
	// }
}
```

## Retrieving image meta-data
To get the image properties a Reveal JS data-string can be passed to `reveal.meta(string)`. This returns an object with the image meta data. The object is identical to the meta-object passed to method callback functions.

## Checking for browser support
Reveal JS relies on canvas support, this can be checked using `reveal.support`.

# Performance
Coming soon...

# Support
Should work on IE9 and above. Tested using Chrome 51, Firefox 46 and Safari 9.1 on Mac OS X.
