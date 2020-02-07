(function(exports) {
    "use strict";
    var sqrt2 = Math.sqrt(2);
    var sqrt3 = Math.sqrt(3);
    var sqrt5 = Math.sqrt(5);
    var sqrt6 = Math.sqrt(6);
    var __ico_c1 = Math.sqrt((3 - sqrt5)/8);
    var __ico_s1 = Math.sqrt((5 + sqrt5)/8);
    var __ico_c2 = Math.sqrt((3 + sqrt5)/8);
    var __ico_s2 = Math.sqrt((5 - sqrt5)/8);

    var shapes = {
        tetrahedron: {
            vertices: [[0, 0, 1], [0, 2 * sqrt2 / 3, -1 / 3],
                       [sqrt6 / 3, -sqrt2 / 3, -1 / 3],
                       [-sqrt6 / 3, -sqrt2 / 3, -1 / 3]],
            faces: [[0, 2, 1], [0, 3, 2], [0, 1, 3], [1, 2, 3]],
            rotation: {x: Math.PI/12, y: 0}},
        cube: {
            vertices: [[1/sqrt3, 1/sqrt3, 1/sqrt3],
                       [1/sqrt3, 1/sqrt3, -1/sqrt3],
                       [1/sqrt3, -1/sqrt3, 1/sqrt3],
                       [1/sqrt3, -1/sqrt3, -1/sqrt3],
                       [-1/sqrt3, 1/sqrt3, 1/sqrt3],
                       [-1/sqrt3, 1/sqrt3, -1/sqrt3],
                       [-1/sqrt3, -1/sqrt3, 1/sqrt3],
                       [-1/sqrt3, -1/sqrt3, -1/sqrt3]],
            faces: [[0, 3, 1], [0, 2, 3], [4, 5, 7], [4, 7, 6],
                    [0, 5, 4], [0, 1, 5], [7, 3, 2], [7, 2, 6],,
                    [0, 4, 2], [6, 2, 4], [1, 3, 5], [7, 5, 3]],
            rotation: {x: Math.PI / 4, y: Math.PI / 4}},
        octahedron: {
            vertices: [[0, 0, 1], [1/sqrt2, 1/sqrt2, 0],
                       [-1/sqrt2, 1/sqrt2, 0],
                       [-1/sqrt2, -1/sqrt2, 0],
                       [1/sqrt2, -1/sqrt2, 0], [0, 0, -1]],
            faces: [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 1],
                    [5, 2, 1], [5, 3, 2], [5, 4, 3], [5, 1, 4]],
            rotation: {x: Math.PI / 3, y: Math.PI / 12}},
        icosahedron: {
            vertices: [
                [0, 0, 1],
                [2/sqrt5, 0, 1/sqrt5],
                [2/sqrt5 * __ico_c1, 2/sqrt5 * __ico_s1, 1/sqrt5],
                [-2/sqrt5 * __ico_c2, 2/sqrt5 * __ico_s2, 1/sqrt5],
                [-2/sqrt5 * __ico_c2, -2/sqrt5 * __ico_s2, 1/sqrt5],
                [2/sqrt5 * __ico_c1, -2/sqrt5 * __ico_s1, 1/sqrt5],
                [0, 0, -1],
                [-2/sqrt5, 0, -1/sqrt5],
                [-2/sqrt5 * __ico_c1, -2/sqrt5 * __ico_s1, -1/sqrt5],
                [2/sqrt5 * __ico_c2, -2/sqrt5 * __ico_s2, -1/sqrt5],
                [2/sqrt5 * __ico_c2, 2/sqrt5 * __ico_s2, -1/sqrt5],
                [-2/sqrt5 * __ico_c1, 2/sqrt5 * __ico_s1, -1/sqrt5]],
            faces: [[0, 1, 2], [0, 2, 3], [0, 3, 4], [0, 4, 5],
                    [0, 5, 1], [2, 1, 10], [3, 2, 11], [4, 3, 7],
                    [5, 4, 8], [1, 5, 9], [7, 8, 4], [8, 9, 5],
                    [9, 10, 1], [10, 11, 2], [11, 7, 3],
                    [6, 8, 7], [6, 9, 8], [6, 10, 9],
                    [6, 11, 10], [6, 7, 11]],
            rotation: {x: 0, y: 0}}
    };

    var Vertex = function(x, y, z) {
        if (!(this instanceof Vertex))
            return new Vertex(x, y, z);

        if (x instanceof Vertex) {
            this.x = x.x;
            this.y = x.y;
            this.z = x.z;
        } else if (Array.isArray(x)) {
            this.x = x[0];
            this.y = x[1];
            this.z = x[2];
        } else if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            this.x = x;
            this.y = y;
            this.z = z;
        } else throw new Error(
            "Invalid vertex: " + x + ", " + y + ", " + z);
    };

    Vertex.prototype.toString = function()
    { return '(' + this.x + ', ' + this.y + ', ' +  this.z + ')'; };

    Vertex.prototype.toArray = function()
    { return [this.x, this.y, this.z]; }

    Vertex.prototype.scale = function(factor) {
        return new Vertex(
            this.x * factor, this.y * factor, this.z * factor);
    };

    Vertex.prototype.plus = function(vertex) {
        return new Vertex(
            this.x + vertex.x, this.y + vertex.y, this.z + vertex.z);
    };

    Vertex.prototype.dot = function(other)
    { return this.x * other.x + this.y * other.y + this.z * other.z; };

    Vertex.prototype.quadrance = function() { return this.dot(this); };

    Vertex.prototype.norm = function()
    { return Math.sqrt(this.quadrance()); };

    Vertex.prototype.normalize = function() {
        var factor = 1 / this.norm();
        if (isNaN(factor))
            throw new Error("Vertex cannot be normalized");
        return this.scale(factor);
    };

    var Face = function(v1, v2, v3) {
        if (!(this instanceof Face))
            return new Face(v1, v2, v3);

        if (Array.isArray(v1)) {
            this.v1 = v1[0];
            this.v2 = v1[1];
            this.v3 = v1[2];
        } else {
            this.v1 = v1;
            this.v2 = v2;
            this.v3 = v3;
        }
    };

    Face.prototype.toString = function()
    { return '(' + this.v1.index + ', ' + this.v2.index + ', ' +
             this.v3.index + ')'; };

    Face.prototype.markVertex = function(v1, index, vertexCache) {
        if (!vertexCache[index]) {
            var vertex = v1.normalize();
            vertex.necessary = false;
            vertexCache[index] = vertex;
        }
        return vertexCache[index];
    };

    Face.prototype.splitEdge = function(v1, v2, vertexCache) {
        vertexCache = vertexCache || {};
        var cacheIndex = ripple.pair(v1.index, v2.index);
        return this.markVertex(v1.plus(v2), cacheIndex, vertexCache);
    };

    Face.prototype.maybePush = function(reference, threshold, dest) {
        if ((this.v1.dot(reference) >= threshold) ||
            (this.v2.dot(reference) >= threshold) ||
            (this.v3.dot(reference) >= threshold)) {
            dest.push(this);
            this.v1.necessary = true;
            this.v2.necessary = true;
            this.v3.necessary = true;
        }
        return this;
    };

    var Planet = function(config, extra) {
        // A planet represents a sphere approximation that can be
        // subdivided with optional culling.
        if (!(this instanceof Planet))
            return new Planet(config, extra);

        var vertices, faces;
        if (Array.isArray(config) && Array.isArray(extra)) {
            vertices = config;
            faces = extra;
        } else if (typeof(config) === 'object' &&
                   Array.isArray(config.vertices) &&
                   Array.isArray(config.faces)) {
            vertices = config.vertices;
            faces = config.faces;
        } else throw new Error('Invalid configuration');

        this.faces = [];
        this.vertices = [];
        vertices.forEach(function(vertexData, index) {
            var vertex = new Vertex(vertexData);
            vertex.index = index;
            this.vertices.push(vertex);
        }, this);
        faces.forEach(function(faceArray) {
            this.faces.push(new Face(faceArray.map(
                function(vertexIndex) {
                    return this.vertices[vertexIndex];
                }, this))); }, this);
    };

    Planet.prototype.subdivide = function(cull) {
        // To ensure that vertices are not unnecessarily duplicated
        // within a single Planet instance, we maintain two caches.
        // one is called vertexFlags and is indexed according to the
        // previous incarnation.  The other is called vertexCache
        // and is indexed according to the pair of vertices it is
        // created by splitting.
        var result = new Planet({vertices: [], faces: []});
        var vertexCache = {};
        var vertexFlags = {};
        var reference = new Vertex(0, 1, 0); // This is North

        cull = (cull - 50) / 50;

        this.faces.forEach(function(face) {
            face.markVertex(face.v1, face.v1.index, vertexFlags);
            face.markVertex(face.v2, face.v2.index, vertexFlags);
            face.markVertex(face.v3, face.v3.index, vertexFlags);

            var v1 = vertexFlags[face.v1.index];
            var v2 = vertexFlags[face.v2.index];
            var v3 = vertexFlags[face.v3.index];
            var v4 = face.splitEdge(face.v1, face.v2, vertexCache);
            var v5 = face.splitEdge(face.v2, face.v3, vertexCache);
            var v6 = face.splitEdge(face.v3, face.v1, vertexCache);

            new Face(v1, v4, v6).maybePush(reference, cull, result.faces);
            new Face(v4, v2, v5).maybePush(reference, cull, result.faces);
            new Face(v5, v3, v6).maybePush(reference, cull, result.faces);
            new Face(v6, v4, v5).maybePush(reference, cull, result.faces);
        });

        Object.keys(vertexFlags).forEach(function(key) {
            if (vertexFlags[key].necessary)
                result.vertices.push(vertexFlags[key]); });
        Object.keys(vertexCache).forEach(function(key) {
            if (vertexCache[key].necessary)
                result.vertices.push(vertexCache[key]); });
        result.vertices.forEach(function(vertex, index) {
            vertex.index = index; });
        return result;
    };

    var createSubject = function(shape, steps, cull, previous, invert) {
        // Create a regular polyhedron inscribed within a unit sphere
        var meshColor = invert ? 0x80ff80 : 0x8080ff;
        var materials = [];
        var step;
        var geometry = new THREE.Geometry();
        var planet = new Planet(shape);

        for (step = 0; step < steps; ++step)
            planet = planet.subdivide(cull);
        planet.vertices.forEach(function(vertex) {
            geometry.vertices.push(
                new THREE.Vector3().fromArray(vertex.toArray())); });
        planet.faces.forEach(function(face) {
            geometry.faces.push(
                new THREE.Face3(face.v1.index, face.v2.index,
                                face.v3.index)); });
        var result = THREE.SceneUtils.createMultiMaterialObject(
            geometry, [
                new THREE.MeshBasicMaterial({ color: meshColor }),
                new THREE.MeshBasicMaterial(
                    { color: 0x000000, wireframe: true,
                      transparent: true })]);

        if (previous) {
            result.rotation.x = previous.rotation.x || 0;
            result.rotation.y = previous.rotation.y || 0;
            result.rotation.z = previous.rotation.z || 0;
        } else {
            result.rotation.x = shape.rotation.x || 0;
            result.rotation.y = shape.rotation.y || 0;
            result.rotation.z = shape.rotation.z || 0;
        }
        return result;
    }

    // Creates a game rendered using three.js
    onball.go = function() {
        var parent = document.body;
        var shapeName = ripple.param('shape') in shapes ?
                        ripple.param('shape') : 'cube';
        var steps = ripple.paramInt(
            'steps', {default: 0, min: 0, max: 8});
        var cull = ripple.paramInt(
            'cull', {default: 0, min: 0, max: 100});
        var minzoom = 1.1;
        var camera = new THREE.PerspectiveCamera(
            75, window.innerWidth / window.innerHeight, 0.1, 1000);
        var renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setClearColor(0x202020);
        renderer.setSize(window.innerWidth, window.innerHeight);
        parent.appendChild(renderer.domElement);

        var light = new THREE.DirectionalLight( 0xffffff );
        light.position.set(1, 1, 1);

        camera.position.z = Math.max(minzoom, parseInt(
            ripple.param('zoom'), 10) || 2);

        var isDragging = false;
        var previousMousePosition = { x: 0, y: 0 };

        var scene, subject = undefined;
        var createScene = function(invert) {
            var result = new THREE.Scene();
            subject = createSubject(
                shapes[shapeName], steps, cull, subject, invert);
            result.add(subject);
            result.add(light);
            return result;
        }
        scene = createScene();

        var interactStart = function(event) {
            isDragging = true;
            scene = createScene(true);
            return false;
        };
        renderer.domElement.addEventListener(
            'mousedown', interactStart);
        renderer.domElement.addEventListener(
            'touchstart', interactStart);

        var interactEnd = function(event) {
            isDragging = false;
            scene = createScene(false);
            return false;
        };
        renderer.domElement.addEventListener('mouseup', interactEnd);
        renderer.domElement.addEventListener('mouseleave', interactEnd);
        renderer.domElement.addEventListener('touchend', interactEnd);

        var interactMove = function(event) {
            if (isDragging) {
                var tap = ripple.getInputPoints(event);
                var deltaMove = {
                    x: tap.x - previousMousePosition.x,
                    y: tap.y - previousMousePosition.y
                };
                var deltaRotationQuaternion =
                    new THREE.Quaternion()
                             .setFromEuler(new THREE.Euler(
                                 toRadians(deltaMove.y * 1),
                                 toRadians(deltaMove.x * 1),
                                 0, 'XYZ'));
                subject.quaternion.multiplyQuaternions(
                    deltaRotationQuaternion, subject.quaternion);
                previousMousePosition = {
                    x: tap.x,
                    y: tap.y
                };
            }
            return false;
        };
        renderer.domElement.addEventListener('mousemove', interactMove);
        renderer.domElement.addEventListener('touchmove', interactMove);

        ripple.addWheelListener(renderer.domElement, function(event) {
            camera.position.z += 0.2 * event.deltaY;
            if (camera.position.z < minzoom)
                camera.position.z = minzoom;
        });

        var lastFrameTime = new Date().getTime() / 1000;
        var totalGameTime = 0;
        function update(dt, t) {
            setTimeout(function() {
                var currTime = new Date().getTime() / 1000;
                var dt = currTime - (lastFrameTime || currTime);
                totalGameTime += dt;
                
                update(dt, totalGameTime);
                
                lastFrameTime = currTime;
            }, 0);
        }

        function render() {
            renderer.render(scene, camera);
            requestAnimationFrame(render);
        }
        render();
        update(0, totalGameTime);

        function toRadians(angle) {
	    return angle * (Math.PI / 180);
        }

        var menu = ripple.createElement(
            'fieldset', { className: 'menu' });
        menu.appendChild(ripple.createElement(
            'legend', null, 'On the Ball'));
        var menuList = ripple.createElement('ul');
        menu.appendChild(menuList);
        var selectShape = ripple.createElement(
            'select', { className: 'shape' });
        Object.keys(shapes).forEach(function(shapeKey) {
            selectShape.appendChild(ripple.createElement('option', {
                value: shapeKey,
                selected: (shapeKey === shapeName) ?
                          'selected' : undefined
            }, shapeKey));
        });
        menuList.append(ripple.createElement(
            'li', undefined, ripple.createElement('label', null, 'Shape '),
            selectShape));
        selectShape.addEventListener('change', function(event) {
            shapeName = this.value;
            scene = createScene();
        });

        // Allow a user to select the number of subdivision steps
        var selectSteps = ripple.createElement(
            'select', { className: steps });
        var index;
        for (index = 0; index <= 8; ++index) {
            selectSteps.appendChild(ripple.createElement('option', {
                value: index,
                selected: (steps === index) ? 'selected' : undefined
            }, index));
        }
        menuList.appendChild(ripple.createElement(
            'li', null, ripple.createElement(
                'label', null, 'Steps '), selectSteps));
        selectSteps.addEventListener('change', function(event) {
            var chosenSteps = parseInt(this.value, 10);
            if (chosenSteps >= 0 && chosenSteps <= 8)
                steps = chosenSteps;
            scene = createScene();
        });

        var selectCull = ripple.createElement('input', {
            name: "cull", className: "cull", type: "range",
            value: 0, min: 0, max: 100, step: 1
        });
        menuList.appendChild(ripple.createElement(
            'li', null, ripple.createElement('label', null, 'Cull '),
            selectCull));
        selectCull.addEventListener('change', function(event) {
            var chosenCull = parseFloat(this.value, 10);
            cull = chosenCull;
            scene = createScene();
        });

        parent.appendChild(menu);
    };

})(typeof exports === 'undefined'? this['onball'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    console.log('Test!');
}
