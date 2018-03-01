(function(exports) {
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

    var createSubject = function(shape, steps, previous, invert) {
        // Create a regular polyhedron inscribed within a unit sphere
        var meshColor = invert ? 0x80ff80 : 0x8080ff;
        var vertices = shape.vertices.slice();
        var faces = shape.faces.slice();
        var materials = [];
        var step;
        var subvert = function(v1, v2) {
            var vertex = [v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]];
            var norm = Math.sqrt(
                vertex[0] * vertex[0] + vertex[1] * vertex[1] +
                    vertex[2] * vertex[2]);
            vertex[0] /= norm;
            vertex[1] /= norm;
            vertex[2] /= norm;
            return vertex;
        }

        for (step = 0; step < steps; ++step) {
            var newfaces = [];
            faces.forEach(function(face) {
                vertices.push(subvert(
                    vertices[face[0]], vertices[face[1]]));
                vertices.push(subvert(
                    vertices[face[1]], vertices[face[2]]));
                vertices.push(subvert(
                    vertices[face[0]], vertices[face[2]]));

                newfaces.push([face[0], vertices.length - 3,
                               vertices.length - 1, face[3]]);
                newfaces.push([face[1], vertices.length - 2,
                               vertices.length - 3, face[3]]);
                newfaces.push([face[2], vertices.length - 1,
                               vertices.length - 2, face[3]]);
                newfaces.push([vertices.length - 1,
                               vertices.length - 3,
                               vertices.length - 2, face[3]]);
            });
            faces = newfaces;
        }

        var geometry = new THREE.Geometry();
        vertices.forEach(function(vertex) {
            geometry.vertices.push(
                new THREE.Vector3().fromArray(vertex));
        });
        faces.forEach(function(face, index) {
            geometry.faces.push(
                new THREE.Face3(face[0], face[1], face[2]));
        });
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
    onball.go = function(parent, viewport) {
        var shapeName = window.params['shape'] in shapes ?
            window.params['shape'] : 'cube';
        var steps = Math.min(8, parseInt(window.params['steps'], 10));
        var minzoom = 1.1;
        var camera = new THREE.PerspectiveCamera(
            75, viewport.width() / viewport.height(), 0.1, 1000);
        var renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setClearColor(0x202020);
        renderer.setSize(viewport.width(), viewport.height());
        parent.append(renderer.domElement);

        var light = new THREE.DirectionalLight( 0xffffff );
        light.position.set(1, 1, 1);

        camera.position.z = Math.max(minzoom, parseInt(
            window.params['zoom'], 10) || 2);

        var isDragging = false;
        var previousMousePosition = {
            x: 0,
            y: 0
        };

        var scene, subject = undefined;
        var createScene = function(invert) {
            var result = new THREE.Scene();
            subject = createSubject(
                shapes[shapeName], steps, subject, invert);
            result.add(subject);
            result.add(light);
            return result;
        }
        scene = createScene();

        var self = $(renderer.domElement);
        self.on('mousedown touchstart', function(event) {
            isDragging = true;
            scene = createScene(true);
            return false;
        });

        self.on('mouseup mouseleave touchend', function(event) {
            isDragging = false;
            scene = createScene(false);
            return false;
        });

        self.on('mousemove touchmove', function(event) {
            var tap = ripple.createTouches(event);
            var deltaMove = {
                x: tap.x - previousMousePosition.x,
                y: tap.y - previousMousePosition.y
            };

            if(isDragging) {
                var deltaRotationQuaternion = new THREE.Quaternion()
                    .setFromEuler(new THREE.Euler(
                        toRadians(deltaMove.y * 1),
                        toRadians(deltaMove.x * 1),
                        0,
                        'XYZ'
                    ));
                    
                subject.quaternion.multiplyQuaternions(
                    deltaRotationQuaternion, subject.quaternion);
            }

            previousMousePosition = {
                x: tap.x,
                y: tap.y
            };
            return false;
        });

        self.on('mousewheel', function(event) {
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

        var menu = $('<fieldset class="menu"></ul>');
        menu.append('<legend>On the Ball</legend>');
        var menuList = $('<ul></ul>').appendTo(menu);
        var selectShape = $('<select class="shape"></select>');
        Object.keys(shapes).forEach(function(shapeKey) {
            var prefix = '<option';
            if (shapeKey === shapeName)
                prefix += ' selected="selected"';
            selectShape.append(prefix + ' value="' + shapeKey + '">' +
                               shapeKey + '</option>');
        });
        var selectSteps = $('<select class="steps"></select>');
        var index;
        for (index = 0; index <= 8; ++index)
            selectSteps.append('<option value="' + index + '">' +
                               index + '</option>');
        menuList.append($('<li></li>').append(
            $('<label>Shape </label>').append(selectShape)));
        menuList.append($('<li></li>').append(
            $('<label>Steps </label>').append(selectSteps)));

        menu.on('change', '.shape', function(event) {
            shapeName = this.value;
            scene = createScene();
        });

        menu.on('change', '.steps', function(event) {
            var chosenSteps = parseInt(this.value, 10);
            if (chosenSteps >= 0 && chosenSteps <= 8)
                steps = chosenSteps;
            scene = createScene();
        });
        menu.appendTo(parent).css('top', 10).css('left', 25).show();
    };

})(typeof exports === 'undefined'? this['onball'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    console.log('Test!');
}
