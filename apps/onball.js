(function(exports) {
    var sqrt2 = Math.sqrt(2);
    var sqrt6 = Math.sqrt(6);
    var tetrahedron = [[0, 0, 1], [0, 2 * sqrt2 / 3, -1 / 3],
                       [sqrt6 / 3, -sqrt2 / 3, -1 / 3],
                       [-sqrt6 / 3, -sqrt2 / 3, -1 / 3]];

    var quaternion = {
        // Defines a quaternion.  The real part is a while the
        // imaginary part is bi + cj + dk.
        a: 0, b: 0, c: 0, d: 0,
        multiply: function(p) {
            if (p instanceof quaternion)
                return this.create(
                    this.a * p.a - this.b * p.b -
                        this.c * p.c - this.d - p.d,
                    this.a * p.b + this.b * p.a +
                        this.c * p.c - this.d * p.c,
                    this.a * p.c - this.b * p.d +
                        this.c * p.a + this.d * p.b,
                    this.a * p.d + this.b * p.c -
                        this.c * p.b + this.d * p.a);
            else return this.create(
                this.a * p, this.b * p, this.c * p, this.d * p);
        },
        add: function(p) {
            if (p instanceof quaternion)
                return this.create(
                    this.a + p.a, this.b + p.b,
                    this.c + p.c, this.d + p.d);
            else return this.create(
                this.a + p, this.b, this.c, this.d);
        },
        conjugate: function() {
            return this.create(this.a, -this.b, -this.c, -this.d);
        },
        norm: function() {
            return Math.sqrt(this.a * this.a + this.b * this.b +
                             this.c * this.c + this.d * this.d);
        },
        reciprocal: function() {
            return this.conjugate().multiply(
                1 / (this.a * this.a + this.b * this.b +
                     this.c * this.c + this.d * this.d));
        },
        create: function(a, b, c, d) {
            var result = Object.create(this);
            result.a = a;
            result.b = b;
            result.c = c;
            result.d = d;
            return result;
        },
        rotation: function(ux, uy, uz, theta) {
            return this.create(0, ux, uy, uz).
                multiply(Math.sin(theta/2)).
                add(Math.cos(theta / 2));
        },
        rotate: function(p) {
            this.multiply(p).multiply(this.reciprocal());
        }
    };

    var createSubject = function(steps) {
        // Create a tetrahedron inscribed within a unit sphere
        var vertices = tetrahedron.slice();
        var faces = [[0, 2, 1], [0, 3, 2], [0, 1, 3], [1, 2, 3]];
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
        return THREE.SceneUtils.createMultiMaterialObject(
            geometry, [
                new THREE.MeshBasicMaterial({ color: 0x8080ff }),
                new THREE.MeshBasicMaterial(
                    { color: 0x000000, wireframe: true,
                      transparent: true })]);
    }

    // Creates a game rendered using three.js
    onball.go = function(parent, viewport) {
        var minzoom = 1.1;
        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(
            75, viewport.width() / viewport.height(), 0.1, 1000);
        var renderer = new THREE.WebGLRenderer({antialias: true});
        renderer.setClearColor(0x202020);
        renderer.setSize(viewport.width(), viewport.height());
        parent.append(renderer.domElement);

        var subject = createSubject(Math.min(8, parseInt(
            window.params['steps'], 10)));
        subject.rotation.x = 0;
        subject.rotation.y = Math.PI / 2;
        scene.add(subject);

        var light = new THREE.DirectionalLight( 0xffffff );
        light.position.set(1, 1, 1);
        scene.add(light);

        camera.position.z = Math.max(minzoom, parseInt(
            window.params['zoom'], 10) || 2);

        var isDragging = false;
        var previousMousePosition = {
            x: 0,
            y: 0
        };

        var self = $(renderer.domElement);
        self.on('mousedown touchstart', function(e) {
            isDragging = true;
        });

        self.on('mouseup mouseleave touchend', function(e) {
            isDragging = false;
        });

        self.on('mousemove touchmove', function(e) {
            var deltaMove = {
                x: e.offsetX-previousMousePosition.x,
                y: e.offsetY-previousMousePosition.y
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
                x: e.offsetX,
                y: e.offsetY
            };
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
    };

})(typeof exports === 'undefined'? this['onball'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    console.log('Test!');
}
