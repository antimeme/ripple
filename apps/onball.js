(function(exports) {
    var sqrt2 = Math.sqrt(2);
    var sqrt6 = Math.sqrt(6);

    var createTetrahedron = function() {
        return [[0, 1, 0], [0, -1 / 3, 2 * sqrt2 / 3],
                [sqrt6 / 3, -1 / 3, -sqrt2 / 3],
                [-sqrt6 / 3, -1 / 3, -sqrt2 / 3]];
    };

    var quaternion = {
        // Defines a quaternion.  The real part is a while the
        // imaginary part is bi + cj + dk.
        a: 0, b: 0, c: 0, d: 0,
        multiply: function(p) {
            if (p instanceof this)
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
            if (p instanceof this)
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

})(typeof exports === 'undefined'? this['onball'] = {}: exports);

if ((typeof require !== 'undefined') && (require.main === module)) {
    console.log('Test!');
}
