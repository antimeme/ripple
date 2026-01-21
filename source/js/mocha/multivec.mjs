import assert from "assert";
import multivec from "../multivec.mjs";

describe("Multivec", () => {

    describe("create", () => {
        it("should create scalars", () => {
            const value = multivec.create(5.1);
            assert(value.isScalar());
            assert.strictEqual(value.scalar, 5.1);
        });
        it("should create vectors", () => {
            const v1 = multivec.create({x: 2, y: -1.2});
            const v2 = multivec.create([2, -1.2])
            const v3 = multivec.create("2x - 1.2o2");
            assert(v1.isVector());
            assert(v2.isVector());
            assert(v3.isVector());
            assert.strictEqual(v1.toString(), v2.toString());
            assert.strictEqual(v2.toString(), v3.toString());
            assert.strictEqual(v3.toString(), v1.toString());
        });

        it("should accept close enough", () => {
            const v1 = multivec.create([2, -1]);
            const v2 = multivec.create([2, -1.01]);
            const v3 = multivec.create([2, -1.000000000001]);
            assert.notStrictEqual(v1.toString(), v2.toString());
            assert.strictEqual(v1.toString(), v3.toString());
            assert(!v1.equals(v2));
            assert(v1.equals(v3));
        });
    });

    describe("addition", () => {
        it("should add scalars", () => {
            const a = multivec.create(3);
            const b = multivec.create(4);
            const result = a.add(b);
            assert(result.isScalar());
            assert.strictEqual(result.scalar, 7);
            assert(result.equals(7));
        });
        it("should add vectors", () => {
            const a = multivec.create([1, 2, 3]);
            const b = multivec.create([4, 5, 6]);
            const result = a.add(b);
            assert(result.isVector());
            assert.strictEqual(result.x, 5);
            assert.strictEqual(result.y, 7);
            assert.strictEqual(result.z, 9);
        });
        it("should add mixed", () => {
            const a = multivec.create({'': 1, x: 2});
            const b = multivec.create({'': 3, xy: 4});
            const result = a.add(b);
            assert.strictEqual(result.scalar, 4);
            assert.strictEqual(result.x, 2);
            assert.strictEqual(result.coeff("xy"), 4);
        });
        it("should subtract scalars", () => {
            const a = multivec.create(5);
            const b = multivec.create(3);
            const result = a.subtract(b);
            assert(result.isScalar());
            assert.strictEqual(result.scalar, 2);
            assert(result.equals(2));
        });
        it("should subtract vectors", () => {
            const a = multivec.create([1, 2, 6]);
            const b = multivec.create([4, 5, 3]);
            const result = b.subtract(a);
            assert(result.isVector());
            assert.strictEqual(result.x,  3);
            assert.strictEqual(result.y,  3);
            assert.strictEqual(result.z, -3);
        });

    });
    describe("multiplication", () => {
        it("should multiply scalars", () => {
            const a = multivec.create(3);
            const b = multivec.create(4);
            const result = a.multiply(b);
            assert(result.isScalar());
            assert.strictEqual(result.scalar, 12);
            assert(result.equals(12));
        });
        it("should multiply vector by scalar", () => {
            const a = multivec.create([1, -2, 3]);
            const result = a.multiply(2);
            assert(result.isVector());
            assert.strictEqual(result.x,  2);
            assert.strictEqual(result.y, -4);
            assert.strictEqual(result.z,  6);
            assert(result.equals("2x - 4y + 6z"));
        });
        it("should multiply vectors", () => {
            const a = multivec.create([1, 2, 3]);
            const b = multivec.create([4, 5, 6]);
            const result = a.multiply(b);
            assert.strictEqual(result.scalar, 32);
            assert.strictEqual(result.coeff("xy"), -3);
            assert.strictEqual(result.coeff("yz"), -3);
            assert.strictEqual(result.coeff("xz"), -6);
            assert(result.equals("32 - 3xy - 3yz - 6xz"));
        });
        it("should divide scalars", () => {
            const a = multivec.create(3);
            const b = multivec.create(4);
            const result = a.divide(b);
            assert(result.isScalar());
            assert.strictEqual(result.scalar, 0.75);
            assert(result.equals(0.75));
        });
        it("should divide vector by scalar", () => {
            const a = multivec.create([1, -2, 3]);
            const result = a.divide(2);
            assert(result.isVector());
            assert.strictEqual(result.x,  0.5);
            assert.strictEqual(result.y, -1);
            assert.strictEqual(result.z,  1.5);
            assert(result.equals("0.5x - y + 1.5z"));
        });
        it("should divide vectors", () => {
            const a = multivec.create([2, 2, 2]);
            const b = multivec.create([1, 0, 1]);
            const result = a.divide(b);
            assert.strictEqual(result.scalar, 2);
            assert.strictEqual(result.coeff("xy"), -1);
            assert.strictEqual(result.coeff("yz"),  1);
            assert.strictEqual(result.coeff("xz"),  0);
            assert(result.equals("2 - xy + yz"));
        });
    });

    describe("operations", () => {
        it("should compute conjugate", () => {
            const a = multivec.create({
                '': 1, x: 2, xy: 3, xyz: 4});
            const result = a.conjugate();
            assert.strictEqual(result.scalar, 1);
            assert.strictEqual(result.x, 2);
            assert.strictEqual(result.coeff("xy"), -3);
            assert.strictEqual(result.coeff("xyz"), -4);
            assert(result.equals("1 + 2x - 3xy - 4xyz"));
        });
        it("should compute quadrance", () => {
            const a = multivec.create(3).quadrance();
            assert(a.isScalar());
            assert.strictEqual(a.scalar, 9);

            const b = multivec.create([3, 4]).quadrance();
            assert(b.isScalar());
            assert.strictEqual(b.scalar, 25);

            const c = multivec.create("3xy - 2yz + 1xz").quadrance();
            assert(c.isScalar());
            assert.strictEqual(c.scalar, 14);
        });
        it("should compute norm", () => {
            const a = multivec.create(3).norm();
            assert.strictEqual(a, 3);

            const b = multivec.create([3, 4]).norm();
            assert.strictEqual(b, 5);

            const c = multivec.create("3xy - 2yz + 1xz").norm();
            assert.strictEqual(c * c, 14);
        });
        it("should normalize a vector", () => {
            const a = multivec.create([3, 4]);
            const b = a.normalize();
            assert.strictEqual(b.norm(), 1);
        });
        it("should wedge vectors", () => {
            const a = multivec.create([1, 0, 0]);
            const b = multivec.create([0, 1, 0]);
            const result = a.wedge(b);
            assert(result.isBivector());
            assert.strictEqual(result.coeff("xy"), 1);
        });
        it("should wedge parallel to zero", () => {
            const a = multivec.create([1, 2, 3]);
            const b = multivec.create([2, 4, 6]);
            const result = a.wedge(b);
            assert(result.isZeroish());
        });
        it("should contract vectors", () => {
            const a = multivec.create([-2, 3, 1]);
            const b = multivec.create([0, 1, 0]);
            const result = a.contract(b);
            assert(result.isScalar());
            assert.strictEqual(result.scalar, 3);
        });
        it("should contract perpendicular vectors to zero", () => {
            const a = multivec.create([1, 0, 1]);
            const b = multivec.create([0, 2, 0]);
            const result = a.contract(b);
            assert(result.isZeroish());
        });
    });
});
