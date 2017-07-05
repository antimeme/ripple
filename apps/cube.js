// A rotating cube demo
(function(cube) {

    cube.demo = function($, parent, viewport) {
        var animating = true;
        var renderer = new THREE.WebGLRenderer( { antialias: true } );
        var resize = function(event) {
            renderer.setSize(parent.width(), parent.height());
        }
        resize();
        parent.append(renderer.domElement);

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(
            45, parent.width() / parent.height());
        parent.append(renderer.domElement);
        camera.position.set(0, 0, 3);

        var light = new THREE.DirectionalLight(0xffffff, 1.5);
        light.position.set(0, 0, 1);
        scene.add(light);

        var update = function() {
            renderer.render(scene, camera);
            if (animating)
                cube.rotation.y -= 0.01;
            requestAnimationFrame(update);
        };
        var geometry = new THREE.CubeGeometry(1, 1, 1);
        var material, cube;
        var loader = new THREE.TextureLoader();
        loader.load("images/ripple.png", function(texture) {
            material = new THREE.MeshPhongMaterial({'map': texture});
            cube = new THREE.Mesh(geometry, material);
            cube.rotation.x = Math.PI / 5;
            cube.rotation.y = Math.PI / 5;
            scene.add(cube);

            renderer.domElement.addEventListener(
                'mouseup', function(event) {
                    event.preventDefault();
                    animating = !animating;
                });

            update();
        }, function(xhr) {
	    console.log( (xhr.loaded / xhr.total * 100) + '% loaded' );
	}, function ( xhr ) {
	    console.log( 'An error happened' );
	});
    };

})(typeof exports === 'undefined'? this['cube'] = {}: exports);
