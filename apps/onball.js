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


    onball.go = function(parent, viewport) {
        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(
            75, viewport.width() / viewport.height(), 0.1, 1000);
        var renderer = new THREE.WebGLRenderer();
        renderer.setSize(viewport.width(), viewport.height());
        parent.append(renderer.domElement);

        var geometry = new THREE.Geometry();
        geometry.vertices.push(
            new THREE.Vector3().fromArray(tetrahedron[0]),
            new THREE.Vector3().fromArray(tetrahedron[1]),
            new THREE.Vector3().fromArray(tetrahedron[2]),
            new THREE.Vector3().fromArray(tetrahedron[3]));
        geometry.faces.push(
            new THREE.Face3(0, 2, 1, undefined, undefined, 0),
            new THREE.Face3(0, 3, 2, undefined, undefined, 1),
            new THREE.Face3(0, 1, 3, undefined, undefined, 2),
            new THREE.Face3(1, 2, 3, undefined, undefined, 3));

        var material = new THREE.MeshFaceMaterial([
            new THREE.MeshBasicMaterial({
                color: 0x00ff00
            }),
            new THREE.MeshBasicMaterial({
                color: 0xff0000
            }),
            new THREE.MeshBasicMaterial({
                color: 0x0000ff,
            }),
            new THREE.MeshBasicMaterial({
                color: 0xffff00
            }),
            new THREE.MeshBasicMaterial({
                color: 0x00ffff
            }),
            new THREE.MeshBasicMaterial({
                color: 0xff00ff
            }),
            new THREE.MeshBasicMaterial({
                color: 0xffffff
            }),
            new THREE.MeshBasicMaterial({
                color: 0x222222
            })
        ]);
        /* */

        var subject = new THREE.Mesh(geometry, material);
        subject.rotation.x = Math.PI/4;
        subject.rotation.y = Math.PI/4;
        scene.add(subject);


        camera.position.z = 5;

        /* */
        var isDragging = false;
        var previousMousePosition = {
            x: 0,
            y: 0
        };
        $(renderer.domElement).on('mousedown', function(e) {
            isDragging = true;
        }).on('mousemove', function(e) {
            //console.log(e);
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

        $(document).on('mouseup', function(e) {
            isDragging = false;
        });

        // shim layer with setTimeout fallback
        window.requestAnimFrame = (function(){
            return  window.requestAnimationFrame ||
                window.webkitRequestAnimationFrame ||
                window.mozRequestAnimationFrame ||
                function(callback) {
                    window.setTimeout(callback, 1000 / 60);
                };
        })();

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
            
            
            requestAnimFrame(render);
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
