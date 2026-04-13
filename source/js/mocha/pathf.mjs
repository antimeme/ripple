import assert from "assert";
import Ripple from "../ripple.mjs";
import Pathf  from "../pathf.mjs";

describe("Pathf", () => {
    describe("Heap", () => {
        it("should sort entries", () => {
            const heap = new Pathf.Heap([7, 5, 4, 6]);
            [2, 3, 9, 8, 1].forEach(value => heap.push(value));
            let last = undefined;
            let count = 0;
            while (heap.size() > 0) {
                const current = heap.pop();
                ++count;
                if (!isNaN(last))
                    assert.ok(
                        current >= last,
                        `${current} should be at least ${last}`);
                last = current;
            }
            assert.strictEqual(count, 9);
        });
    });

    describe("createPath", () => {
        const neighbors = [
            { row: -1, col:  0 }, { row: -1, col: +1 },
            { row:  0, col: +1 }, { row: +1, col: +1 },
            { row: +1, col:  0 }, { row: +1, col: -1 },
            { row:  0, col: -1 }, { row: -1, col: -1 }];
        const isSameNode = (nodeA, nodeB) =>
            ((nodeA.row === nodeB.row) && (nodeA.col === nodeB.col));
        const getNodeIndex = (node) => Ripple.pair(node.col, node.row);
        const heuristic = (node, goal) =>
            Math.hypot(goal.row - node.row, goal.col - node.col);

        function connected(path) {
            let prev = undefined;
            return path.every((node) => {
                const result = !prev || neighbors.some(
                    (neigh) => isSameNode({
                        row: node.row + neigh.row,
                        col: node.col + neigh.col
                    }, prev));
                prev = node;
                return result;
            });
        }

        it("should find an easy path", () => {
            const path = Pathf.createPath({
                start: {row: 0, col: -3}, goal: {row: 0, col: 3},
                isSameNode: isSameNode, getNodeIndex: getNodeIndex,
                heuristic: heuristic,
                eachNeighbor: (node, fn, context) =>
                    neighbors.forEach(neigh => fn.call(context, {
                        row: node.row + neigh.row,
                        col: node.col + neigh.col }))
            });
            assert.ok(path, "path should exist");
            assert.ok(connected(path), "path should be connected");
        });

        it("should fail due to exhausting limit", () => {
            const path = Pathf.createPath({
                start: {row: 0, col: -3}, goal: {row: 0, col: 3},
                isSameNode: isSameNode, getNodeIndex: getNodeIndex,
                heuristic: heuristic, limit: 5,
                eachNeighbor: (node, fn, context) =>
                    neighbors.forEach(neigh => fn.call(context, {
                        row: node.row + neigh.row,
                        col: node.col + neigh.col }))
            });
            assert.ok(!path, "no path should be found");
        });

        it("should avoid obstruction", () => {
            const path = Pathf.createPath({
                start: {row: 0, col: -3}, goal: {row: 0, col: 3},
                isSameNode: isSameNode, getNodeIndex: getNodeIndex,
                heuristic: heuristic,
                eachNeighbor: (node, fn, context) =>
                    neighbors.forEach(neigh => {
                        if ((node.col + neigh.col !== 0) ||
                            (node.row + neigh.row >  3) ||
                            (node.row + neigh.row < -3))
                            fn.call(context, {
                                row: node.row + neigh.row,
                                col: node.col + neigh.col });
                    })
            });
            assert.ok(path, "path should exist");
            assert.ok(connected(path), "path should be connected");
        });
    });
});
