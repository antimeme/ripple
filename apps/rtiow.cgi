#! /usr/bin/env node
// https://raytracing.github.io/books/RayTracingInOneWeekend.html
// Implemented up to chapter 5

var multivec = require("../source/multivec.js");

var write_color = function(pixel) {
    console.log(Math.floor(255.999 * pixel.x),
                Math.floor(255.999 * pixel.y),
                Math.floor(255.999 * pixel.z));
};

var ray_color = function(origin, direction) {
    var unit_direction = multivec(direction).normalize();
    var t = 0.5 * (unit_direction.y + 1);
    return multivec([1, 1, 1]).times(1 - t).plus(
        multivec([0.5, 0.7, 1.0]).times(t));
};

if ((typeof(require) !== "undefined") && (require.main === module)) {
    const image_width  = 400;
    const image_height = 225;

    var camera = {
        viewport: {width: 32/9, height: 2.0},
        focal_length: 1.0,
        origin: multivec({x: 0, y: 0, z: 0})
    };
    camera.horizontal = multivec([camera.viewport.width, 0, 0]);
    camera.vertical   = multivec([0, camera.viewport.height, 0]);
    camera.lower_left_corner = camera.origin.minus(
        camera.horizontal.divide(2),
        camera.vertical.divide(2),
        [0, 0, camera.focal_length]);

    console.log("P3");
    console.log(image_width, " ", image_height);
    console.log("255");
    for (var jj = image_height; jj >= 0; --jj) {
        console.error("Scanlines remaining:", jj);
        for (var ii = 0; ii < image_width; ++ii) {
            var u = ii / (image_width - 1);
            var v = jj / (image_height - 1);
            write_color(ray_color(
                camera.origin,
                camera.lower_left_corner.plus(
                    camera.horizontal.times(u),
                    camera.vertical.times(v),
                    camera.origin.times(-1))));
        }
    }
    console.error("Done.");
}
