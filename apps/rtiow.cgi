#! /usr/bin/env node
// https://raytracing.github.io/books/RayTracingInOneWeekend.html
// Implemented up to but not including chapter 7

var multivec = require("../source/multivec.js");

var Scene = function() {
    if (!(this instanceof Scene))
        return new Scene();
    this.__things = [];
};
Scene.prototype.add = function(thing) {
    for (var ii = 0; ii < arguments.length; ++ii)
        this.__things.push(arguments[ii]);
};
Scene.prototype.check_hit = function(origin, direction, t_min, t_max) {
    var result = null;
    this.__things.forEach(function(thing) {
        var hit = thing.check_hit(origin, direction, t_min, t_max);
        if (hit && (!result || result.t > hit.t))
            result = hit;
    }, this);
    return result;
};

var Sphere = function(center, radius) {
    if (!(this instanceof Sphere))
        return new Sphere();
    this.center = multivec(center);
    this.radius = radius;
};
Sphere.prototype.check_hit = function(origin, direction, t_min, t_max) {
    var oc = origin.minus(this.center);
    var a = direction.normSquared();
    var b = oc.dot(direction);
    var c = oc.normSquared() - this.radius * this.radius;
    var discriminant = b * b - a * c;
    if (discriminant < 0)
        return null;

    var sqrtd = Math.sqrt(discriminant);
    var root = (-b - sqrtd) / a;
    if (root < t_min || root > t_max) {
        root = (-b + sqrtd) / a;
        if (root < t_min || root > t_max)
            return null;
    }

    var point = origin.plus(direction.times(root));
    var outward_normal = point.minus(this.center).divide(this.radius);
    var front_face = direction.dot(outward_normal) < 0;
    return {
        t: root, p: point, front_face: front_face,
        normal: outward_normal.times(front_face ? 1 : -1)
    };
};

var Camera = function() {
    if (!(this instanceof Camera))
        return new Camera();
    this.viewport = {width: 32/9, height: 2.0};
    this.focal_length = 1.0;
    this.origin = multivec({x: 0, y: 0, z: 0});
    this.horizontal = multivec([this.viewport.width, 0, 0]);
    this.vertical   = multivec([0, this.viewport.height, 0]);
    this.lower_left_corner = this.origin.minus(
        this.horizontal.divide(2),
        this.vertical.divide(2),
        [0, 0, this.focal_length]);
};
Camera.prototype.ray_color = function(direction, scene) {
    var color;
    var hit = scene.check_hit(this.origin, direction, 0, Infinity);

    if (hit) { // Scene Object
        color = hit.normal.plus([1, 1, 1]).divide(2);
    } else { // Background
        var unit_direction = multivec(direction).normalize();
        var t = 0.5 * (unit_direction.y + 1);
        color = multivec([1, 1, 1]).times(1 - t).plus(
            multivec([0.5, 0.7, 1.0]).times(t));
    }
    return color;
};

var write_color = function(pixel) {
    console.log(Math.floor(255.999 * pixel.x),
                Math.floor(255.999 * pixel.y),
                Math.floor(255.999 * pixel.z));
};

var write_image = function(camera, scene) {
    const image_width  = 400;
    const image_height = 225;

    console.log("P3");
    console.log(image_width, " ", image_height);
    console.log("255");
    for (var jj = image_height; jj >= 0; --jj) {
        console.error("Scanlines remaining:", jj);
        for (var ii = 0; ii < image_width; ++ii) {
            var u = ii / (image_width - 1);
            var v = jj / (image_height - 1);
            write_color(camera.ray_color(
                camera.lower_left_corner.plus(
                    camera.horizontal.times(u),
                    camera.vertical.times(v),
                    camera.origin.times(-1)), scene));
        }
    }
    console.error("Done.");
};

if ((typeof(require) !== "undefined") && (require.main === module)) {
    var scene = new Scene();
    scene.add(new Sphere([0, 0, -1], 0.5));
    scene.add(new Sphere([0, -100.5, -1], 100));
    write_image(new Camera(), scene);
}
