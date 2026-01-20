import assert from "assert";
import Ripple from "../ripple.mjs";

describe("Ripple", () => {
    it("zeroish zero", () => { assert.ok(Ripple.zeroish(0)); });
    it("zeroish not", () => {
        assert.ok(!Ripple.zeroish( 1.0));
        assert.ok(!Ripple.zeroish( 0.1));
        assert.ok(!Ripple.zeroish( 0.01));
        assert.ok(!Ripple.zeroish(-0.01));
        assert.ok(!Ripple.zeroish(-0.1));
        assert.ok(!Ripple.zeroish(-1));
    });

    it("pair/unpair", () => {
        const u = Ripple.unpair(Ripple.pair(2, -3));
        assert.ok(u.x === 2);
        assert.ok(u.y === -3);
    });

    it("chooseKey", () => {
        const data = {"a": 1, "b": 2, "c": 3};
        assert.ok(Object.keys(data).includes(Ripple.chooseKey(data)));
        assert.ok(Object.keys(data).includes(Ripple.chooseKey(data)));
        assert.ok(Object.keys(data).includes(Ripple.chooseKey(data)));
        assert.ok(Object.keys(data).includes(Ripple.chooseKey(data)));
        assert.ok(Object.keys(data).includes(Ripple.chooseKey(data)));
    });

    it("displayMetric", () => {
        assert.strictEqual(Ripple.displayMetric(
            1024, "m", 2), "1.02 km");
    });
});

