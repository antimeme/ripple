import assert from "assert";
import multivec from "../multivec.mjs";

describe('multivec', function () {
    describe('create', function () {
        it('should create vectors', () => {
            const v1 = multivec.create({x: 2, y: -1});
            const v2 = multivec.create([2, -1])
            assert(v1.equals(v2));
        });

        it('should accept close enough', () => {
            const v1 = multivec.create([2, -1]);
            const v2 = multivec.create([2, -1.01]);
            const v3 = multivec.create([2, -1.000000000001]);
            assert(!v1.equals(v2));
            assert(v1.equals(v3));
        });
    });
});
